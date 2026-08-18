use calamine::{
    open_workbook_auto,
    Data,
    Range,
    Reader,
};
use serde::Serialize;
use sqlx::{
    sqlite::SqliteConnectOptions,
    Connection,
    SqliteConnection,
};
use std::{
    collections::{HashMap, HashSet},
    path::Path,
    time::Duration,
};
use tauri::{
    AppHandle,
    Manager,
};
use unicode_normalization::{
    char::is_combining_mark,
    UnicodeNormalization,
};

const EXPECTED_WORKBOOK_ID: &str = "DMK_COMPLETE_TRACKER";
const MAX_EXAMPLES_PER_SECTION: usize = 12;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityPlanExample {
    pub status: String,
    pub source: String,
    pub display_name: String,
    pub proposed_id: Option<String>,
    pub matched_id: Option<String>,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityPlanIssue {
    pub section: String,
    pub source: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityPlanSection {
    pub key: String,
    pub label: String,
    pub workbook_records: usize,
    pub database_records: usize,
    pub matched_records: usize,
    pub new_records: usize,
    pub ambiguous_records: usize,
    pub invalid_records: usize,
    pub database_only_records: usize,
    pub examples: Vec<IdentityPlanExample>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MasterImportIdentityPlan {
    pub file_name: String,
    pub workbook_version: Option<String>,
    pub plan_ready: bool,
    pub sections: Vec<IdentityPlanSection>,
    pub issues: Vec<IdentityPlanIssue>,
    pub notes: Vec<String>,
}

#[derive(Clone, Copy)]
struct HeaderLocation {
    row_index: usize,
    column_index: usize,
}

#[derive(Clone)]
struct CollectionCandidate {
    source: String,
    display_name: String,
    proposed_id: String,
    invalid_reason: Option<String>,
}

#[derive(Clone)]
struct CharacterCandidate {
    source: String,
    collection_name: String,
    display_name: String,
    proposed_id: String,
    invalid_reason: Option<String>,
}

#[derive(Clone)]
struct TokenCandidate {
    source: String,
    collection_name: String,
    character_name: Option<String>,
    display_name: String,
    proposed_id: String,
    invalid_reason: Option<String>,
}

#[derive(Clone)]
struct LevelCandidate {
    source: String,
    collection_name: String,
    character_name: String,
    target_level: i64,
    invalid_reason: Option<String>,
}

#[derive(Clone)]
struct ExistingCollection {
    id: String,
    display_name: String,
}

#[derive(Clone)]
struct ExistingCharacter {
    id: String,
    collection_id: String,
    display_name: String,
}

#[derive(Clone)]
struct ExistingToken {
    id: String,
    display_name: String,
    associated_character_id: Option<String>,
    associated_collection_id: Option<String>,
}

#[derive(Clone)]
struct ExistingLevel {
    character_id: String,
    target_level: i64,
}

#[derive(Clone)]
struct AliasRecord {
    record_type: String,
    alias_text: String,
    target_id: String,
}

#[derive(Clone)]
struct ParentResolution {
    proposed_id: String,
    matched_id: Option<String>,
    usable: bool,
}

struct SectionAccumulator {
    key: String,
    label: String,
    workbook_records: usize,
    database_records: usize,
    matched_records: usize,
    new_records: usize,
    ambiguous_records: usize,
    invalid_records: usize,
    matched_database_ids: HashSet<String>,
    examples: Vec<IdentityPlanExample>,
}

impl SectionAccumulator {
    fn new(
        key: &str,
        label: &str,
        workbook_records: usize,
        database_records: usize,
    ) -> Self {
        Self {
            key: key.to_string(),
            label: label.to_string(),
            workbook_records,
            database_records,
            matched_records: 0,
            new_records: 0,
            ambiguous_records: 0,
            invalid_records: 0,
            matched_database_ids: HashSet::new(),
            examples: Vec::new(),
        }
    }

    fn push_example(
        &mut self,
        example: IdentityPlanExample,
    ) {
        if self.examples.len() < MAX_EXAMPLES_PER_SECTION {
            self.examples.push(example);
        }
    }

    fn record_invalid(
        &mut self,
        source: &str,
        display_name: &str,
        proposed_id: Option<String>,
        detail: &str,
    ) {
        self.invalid_records += 1;
        self.push_example(IdentityPlanExample {
            status: "invalid".to_string(),
            source: source.to_string(),
            display_name: display_name.to_string(),
            proposed_id,
            matched_id: None,
            detail: detail.to_string(),
        });
    }

    fn record_ambiguous(
        &mut self,
        source: &str,
        display_name: &str,
        proposed_id: Option<String>,
        matches: &[String],
    ) {
        self.ambiguous_records += 1;
        self.push_example(IdentityPlanExample {
            status: "ambiguous".to_string(),
            source: source.to_string(),
            display_name: display_name.to_string(),
            proposed_id,
            matched_id: None,
            detail: format!(
                "Multiple existing records could match: {}",
                matches.join(", ")
            ),
        });
    }

    fn record_match(
        &mut self,
        source: &str,
        display_name: &str,
        proposed_id: Option<String>,
        matched_id: &str,
        detail: &str,
    ) {
        self.matched_records += 1;
        self.matched_database_ids
            .insert(matched_id.to_string());
        self.push_example(IdentityPlanExample {
            status: "matched".to_string(),
            source: source.to_string(),
            display_name: display_name.to_string(),
            proposed_id,
            matched_id: Some(matched_id.to_string()),
            detail: detail.to_string(),
        });
    }

    fn record_new(
        &mut self,
        source: &str,
        display_name: &str,
        proposed_id: Option<String>,
        detail: &str,
    ) {
        self.new_records += 1;
        self.push_example(IdentityPlanExample {
            status: "new".to_string(),
            source: source.to_string(),
            display_name: display_name.to_string(),
            proposed_id,
            matched_id: None,
            detail: detail.to_string(),
        });
    }

    fn finish(self) -> IdentityPlanSection {
        IdentityPlanSection {
            key: self.key,
            label: self.label,
            workbook_records: self.workbook_records,
            database_records: self.database_records,
            matched_records: self.matched_records,
            new_records: self.new_records,
            ambiguous_records: self.ambiguous_records,
            invalid_records: self.invalid_records,
            database_only_records: self
                .database_records
                .saturating_sub(self.matched_database_ids.len()),
            examples: self.examples,
        }
    }
}

fn normalize_text(value: &str) -> String {
    value
        .replace('\u{00A0}', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn display_cell_text(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        _ => cell.to_string().trim().to_string(),
    }
}

fn normalized_cell_text(cell: &Data) -> String {
    normalize_text(&display_cell_text(cell))
}

fn find_header(
    range: &Range<Data>,
    headers: &[&str],
) -> Option<HeaderLocation> {
    if headers.is_empty() {
        return None;
    }

    let normalized_headers = headers
        .iter()
        .map(|header| normalize_text(header))
        .collect::<Vec<_>>();

    for (row_index, row) in range.rows().enumerate() {
        if row.len() < normalized_headers.len() {
            continue;
        }

        let final_start = row.len() - normalized_headers.len();

        for column_index in 0..=final_start {
            let matches = normalized_headers
                .iter()
                .enumerate()
                .all(|(offset, expected)| {
                    normalized_cell_text(&row[column_index + offset])
                        == *expected
                });

            if matches {
                return Some(HeaderLocation {
                    row_index,
                    column_index,
                });
            }
        }
    }

    None
}

fn excel_column_name(zero_based_column: usize) -> String {
    let mut number = zero_based_column + 1;
    let mut characters = Vec::new();

    while number > 0 {
        let remainder = (number - 1) % 26;
        characters.push((b'A' + remainder as u8) as char);
        number = (number - 1) / 26;
    }

    characters.iter().rev().collect()
}

fn source_cell(
    range: &Range<Data>,
    sheet_name: &str,
    row_index: usize,
    column_index: usize,
) -> String {
    let (start_row, start_column) = range.start().unwrap_or((0, 0));
    let absolute_row = start_row as usize + row_index;
    let absolute_column = start_column as usize + column_index;

    format!(
        "{}!{}{}",
        sheet_name,
        excel_column_name(absolute_column),
        absolute_row + 1
    )
}

fn cell_text(row: &[Data], column_index: usize) -> String {
    row.get(column_index)
        .map(display_cell_text)
        .unwrap_or_default()
}

fn parse_integer(cell: Option<&Data>) -> Option<i64> {
    let cell = cell?;

    match cell {
        Data::Int(value) => Some(*value),
        Data::Float(value) => {
            if !value.is_finite() {
                return None;
            }

            let rounded = value.round();

            if (value - rounded).abs() > 0.000_001 {
                return None;
            }

            Some(rounded as i64)
        }
        Data::String(value) => value.trim().parse::<i64>().ok(),
        _ => None,
    }
}

fn stable_id_part(display_name: &str) -> String {
    let decomposed = display_name
        .nfkd()
        .filter(|character| !is_combining_mark(*character))
        .collect::<String>()
        .to_lowercase()
        .replace('&', " and ");

    let mut result = String::new();
    let mut previous_was_separator = false;

    for character in decomposed.chars() {
        if character.is_ascii_lowercase() || character.is_ascii_digit() {
            result.push(character);
            previous_was_separator = false;
        } else if !previous_was_separator && !result.is_empty() {
            result.push('_');
            previous_was_separator = true;
        }
    }

    while result.ends_with('_') {
        result.pop();
    }

    if result.is_empty() {
        "unnamed".to_string()
    } else {
        result
    }
}

fn allocate_stable_id(
    prefix: &str,
    display_name: &str,
    occurrences: &mut HashMap<String, usize>,
) -> String {
    let base = format!("{}_{}", prefix, stable_id_part(display_name));
    let count = occurrences.entry(base.clone()).or_insert(0);
    *count += 1;

    if *count == 1 {
        base
    } else {
        format!("{}_{}", base, count)
    }
}

fn metadata_value(
    range: &Range<Data>,
    key: &str,
) -> Option<String> {
    let expected = normalize_text(key);

    for row in range.rows() {
        for column_index in 0..row.len() {
            if normalized_cell_text(&row[column_index]) != expected {
                continue;
            }

            let value = row
                .get(column_index + 1)
                .map(display_cell_text)
                .unwrap_or_default();

            if !value.trim().is_empty() {
                return Some(value);
            }
        }
    }

    None
}

fn normalize_token_type(value: &str) -> Option<String> {
    match normalize_text(value).as_str() {
        "shared" | "shared token" | "common token" => {
            Some("Shared Token".to_string())
        }
        "unique" | "unique token" => {
            Some("Unique Token".to_string())
        }
        "ears" | "ears token" => Some("Ears Token".to_string()),
        _ => None,
    }
}

fn parse_collections(
    helper: &Range<Data>,
) -> Result<Vec<CollectionCandidate>, String> {
    let header = find_header(helper, &["Name", "Initials"])
        .ok_or_else(|| {
            "Could not find the Collections Name / Initials header in Helper."
                .to_string()
        })?;

    let mut records = Vec::new();
    let mut id_occurrences = HashMap::new();
    let mut seen_names = HashSet::new();

    for (row_index, row) in helper.rows().enumerate().skip(header.row_index + 1) {
        let name = cell_text(row, header.column_index);
        let initials = cell_text(row, header.column_index + 1);

        if name.trim().is_empty() || initials.trim().is_empty() {
            continue;
        }

        let normalized_name = normalize_text(&name);
        let duplicate = !seen_names.insert(normalized_name);
        let proposed_id = allocate_stable_id(
            "collection",
            &name,
            &mut id_occurrences,
        );

        records.push(CollectionCandidate {
            source: source_cell(
                helper,
                "Helper",
                row_index,
                header.column_index,
            ),
            display_name: name,
            proposed_id,
            invalid_reason: duplicate.then(|| {
                "The workbook contains the same collection name more than once."
                    .to_string()
            }),
        });
    }

    Ok(records)
}

fn parse_characters(
    characters: &Range<Data>,
    collections: &[CollectionCandidate],
) -> Result<Vec<CharacterCandidate>, String> {
    let header = find_header(
        characters,
        &["Page", "Character Name", "Lvl"],
    )
    .ok_or_else(|| {
        "Could not find the Page / Character Name / Lvl header on Characters."
            .to_string()
    })?;

    let collection_names = collections
        .iter()
        .map(|collection| normalize_text(&collection.display_name))
        .collect::<HashSet<_>>();

    let mut current_collection: Option<String> = None;
    let mut id_occurrences = HashMap::new();
    let mut seen_scoped_names = HashSet::new();
    let mut records = Vec::new();

    for (row_index, row) in characters
        .rows()
        .enumerate()
        .skip(header.row_index + 1)
    {
        let page_or_collection = cell_text(row, header.column_index);
        let character_name = cell_text(row, header.column_index + 1);
        let level = parse_integer(row.get(header.column_index + 2));

        if character_name.trim().is_empty() {
            let normalized_collection = normalize_text(&page_or_collection);

            if collection_names.contains(&normalized_collection) {
                current_collection = Some(page_or_collection.trim().to_string());
            }

            continue;
        }

        if !matches!(level, Some(0..=10)) {
            continue;
        }

        let source = source_cell(
            characters,
            "Characters",
            row_index,
            header.column_index + 1,
        );

        let proposed_id = allocate_stable_id(
            "character",
            &character_name,
            &mut id_occurrences,
        );

        let Some(collection_name) = current_collection.clone() else {
            records.push(CharacterCandidate {
                source,
                collection_name: String::new(),
                display_name: character_name,
                proposed_id,
                invalid_reason: Some(
                    "No collection heading was resolved for this character row."
                        .to_string(),
                ),
            });
            continue;
        };

        let scoped_key = (
            normalize_text(&collection_name),
            normalize_text(&character_name),
        );
        let duplicate = !seen_scoped_names.insert(scoped_key);

        records.push(CharacterCandidate {
            source,
            collection_name,
            display_name: character_name,
            proposed_id,
            invalid_reason: duplicate.then(|| {
                "The workbook contains the same character name more than once in this collection."
                    .to_string()
            }),
        });
    }

    Ok(records)
}

fn parse_tokens(
    helper: &Range<Data>,
    collections: &[CollectionCandidate],
    characters: &[CharacterCandidate],
) -> Result<Vec<TokenCandidate>, String> {
    let header = find_header(
        helper,
        &[
            "Collection",
            "Character",
            "Token Type",
            "Token Name",
            "Quality",
        ],
    )
    .ok_or_else(|| {
        "Could not find the token source header in Helper.".to_string()
    })?;

    let collection_names = collections
        .iter()
        .map(|collection| normalize_text(&collection.display_name))
        .collect::<HashSet<_>>();

    let character_names = characters
        .iter()
        .map(|character| {
            (
                normalize_text(&character.collection_name),
                normalize_text(&character.display_name),
            )
        })
        .collect::<HashSet<_>>();

    let mut id_occurrences = HashMap::new();
    let mut seen_scoped_names = HashSet::new();
    let mut records = Vec::new();

    for (row_index, row) in helper.rows().enumerate().skip(header.row_index + 1) {
        let collection_name = cell_text(row, header.column_index);
        let character_name = cell_text(row, header.column_index + 1);
        let token_type = cell_text(row, header.column_index + 2);
        let token_name = cell_text(row, header.column_index + 3);

        if token_type.trim().is_empty() || token_name.trim().is_empty() {
            continue;
        }

        let source = source_cell(
            helper,
            "Helper",
            row_index,
            header.column_index + 3,
        );

        let proposed_id = allocate_stable_id(
            "token",
            &token_name,
            &mut id_occurrences,
        );

        let normalized_collection = normalize_text(&collection_name);
        let normalized_character = normalize_text(&character_name);
        let normalized_type = normalize_token_type(&token_type);

        let mut invalid_reason = None;

        if collection_name.trim().is_empty()
            || !collection_names.contains(&normalized_collection)
        {
            invalid_reason = Some(format!(
                "Collection '{}' could not be resolved.",
                collection_name
            ));
        } else if normalized_type.is_none() {
            invalid_reason = Some(format!(
                "Token Type '{}' is not a recognized character-token type.",
                token_type
            ));
        } else if !character_name.trim().is_empty()
            && !character_names.contains(&(
                normalized_collection.clone(),
                normalized_character.clone(),
            ))
        {
            invalid_reason = Some(format!(
                "Character '{}' could not be resolved in collection '{}'.",
                character_name,
                collection_name
            ));
        }

        let scope_key = (
            normalized_collection,
            normalized_character,
            normalize_text(&token_name),
        );

        if invalid_reason.is_none() && !seen_scoped_names.insert(scope_key) {
            invalid_reason = Some(
                "The workbook contains the same token name more than once in this scope."
                    .to_string(),
            );
        }

        records.push(TokenCandidate {
            source,
            collection_name,
            character_name: if character_name.trim().is_empty() {
                None
            } else {
                Some(character_name)
            },
            display_name: token_name,
            proposed_id,
            invalid_reason,
        });
    }

    Ok(records)
}

fn parse_levels(
    levels: &Range<Data>,
    characters: &[CharacterCandidate],
) -> Result<Vec<LevelCandidate>, String> {
    let header = find_header(
        levels,
        &[
            "Collection",
            "Character",
            "Level",
            "Common",
            "Unique",
            "Ears",
            "Magic",
            "Time",
        ],
    )
    .ok_or_else(|| {
        "Could not find the CharacterLevels source header.".to_string()
    })?;

    let character_names = characters
        .iter()
        .map(|character| {
            (
                normalize_text(&character.collection_name),
                normalize_text(&character.display_name),
            )
        })
        .collect::<HashSet<_>>();

    let mut seen_level_keys = HashSet::new();
    let mut records = Vec::new();

    for (row_index, row) in levels.rows().enumerate().skip(header.row_index + 1) {
        let collection_name = cell_text(row, header.column_index);
        let character_name = cell_text(row, header.column_index + 1);
        let level_text = cell_text(row, header.column_index + 2);

        if collection_name.trim().is_empty()
            || character_name.trim().is_empty()
            || level_text.trim().is_empty()
        {
            continue;
        }

        let source = source_cell(
            levels,
            "CharacterLevels",
            row_index,
            header.column_index + 2,
        );

        let Some(target_level) = parse_integer(row.get(header.column_index + 2)) else {
            records.push(LevelCandidate {
                source,
                collection_name,
                character_name,
                target_level: 0,
                invalid_reason: Some(
                    "Target Level is not a whole number.".to_string(),
                ),
            });
            continue;
        };

        let normalized_key = (
            normalize_text(&collection_name),
            normalize_text(&character_name),
        );

        let mut invalid_reason = None;

        if !(1..=10).contains(&target_level) {
            invalid_reason = Some(
                "Target Level must be between 1 and 10.".to_string(),
            );
        } else if !character_names.contains(&normalized_key) {
            invalid_reason = Some(format!(
                "Character '{}' could not be resolved in collection '{}'.",
                character_name,
                collection_name
            ));
        }

        let level_key = (
            normalized_key.0,
            normalized_key.1,
            target_level,
        );

        if invalid_reason.is_none() && !seen_level_keys.insert(level_key) {
            invalid_reason = Some(
                "The workbook contains this character level more than once."
                    .to_string(),
            );
        }

        records.push(LevelCandidate {
            source,
            collection_name,
            character_name,
            target_level,
            invalid_reason,
        });
    }

    Ok(records)
}

async fn open_editor_connection(
    app: &AppHandle,
) -> Result<SqliteConnection, String> {
    let database_path = app
        .path()
        .app_config_dir()
        .map_err(|error| {
            format!(
                "Unable to locate the Data Manager application directory: {error}"
            )
        })?
        .join("dmk-editor.db");

    let options = SqliteConnectOptions::new()
        .filename(database_path)
        .create_if_missing(false)
        .foreign_keys(true)
        .busy_timeout(Duration::from_secs(5));

    SqliteConnection::connect_with(&options)
        .await
        .map_err(|error| format!("Unable to open dmk-editor.db: {error}"))
}

async fn load_existing_collections(
    connection: &mut SqliteConnection,
) -> Result<Vec<ExistingCollection>, String> {
    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT id, display_name FROM collections",
    )
    .fetch_all(&mut *connection)
    .await
    .map_err(|error| format!("Unable to read existing collections: {error}"))?;

    Ok(rows
        .into_iter()
        .map(|(id, display_name)| ExistingCollection { id, display_name })
        .collect())
}

async fn load_existing_characters(
    connection: &mut SqliteConnection,
) -> Result<Vec<ExistingCharacter>, String> {
    let rows = sqlx::query_as::<_, (String, String, String)>(
        "SELECT id, collection_id, display_name FROM characters",
    )
    .fetch_all(&mut *connection)
    .await
    .map_err(|error| format!("Unable to read existing characters: {error}"))?;

    Ok(rows
        .into_iter()
        .map(|(id, collection_id, display_name)| ExistingCharacter {
            id,
            collection_id,
            display_name,
        })
        .collect())
}

async fn load_existing_tokens(
    connection: &mut SqliteConnection,
) -> Result<Vec<ExistingToken>, String> {
    let rows = sqlx::query_as::<
        _,
        (
            String,
            String,
            Option<String>,
            Option<String>,
        ),
    >(
        "
        SELECT
            id,
            display_name,
            associated_character_id,
            associated_collection_id
        FROM tokens
        ",
    )
    .fetch_all(&mut *connection)
    .await
    .map_err(|error| format!("Unable to read existing tokens: {error}"))?;

    Ok(rows
        .into_iter()
        .map(
            |(
                id,
                display_name,
                associated_character_id,
                associated_collection_id,
            )| ExistingToken {
                id,
                display_name,
                associated_character_id,
                associated_collection_id,
            },
        )
        .collect())
}

async fn load_existing_levels(
    connection: &mut SqliteConnection,
) -> Result<Vec<ExistingLevel>, String> {
    let rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT character_id, target_level FROM character_levels",
    )
    .fetch_all(&mut *connection)
    .await
    .map_err(|error| format!("Unable to read existing character levels: {error}"))?;

    Ok(rows
        .into_iter()
        .map(|(character_id, target_level)| ExistingLevel {
            character_id,
            target_level,
        })
        .collect())
}

async fn load_aliases(
    connection: &mut SqliteConnection,
) -> Result<Vec<AliasRecord>, String> {
    let rows = sqlx::query_as::<_, (String, String, String)>(
        "SELECT record_type, alias_text, target_id FROM aliases",
    )
    .fetch_all(&mut *connection)
    .await
    .map_err(|error| format!("Unable to read aliases: {error}"))?;

    Ok(rows
        .into_iter()
        .map(|(record_type, alias_text, target_id)| AliasRecord {
            record_type,
            alias_text,
            target_id,
        })
        .collect())
}

fn alias_type_matches(record_type: &str, expected: &str) -> bool {
    let normalized = normalize_text(record_type);

    match expected {
        "collection" => normalized == "collection" || normalized == "collections",
        "character" => normalized == "character" || normalized == "characters",
        "token" => normalized == "token" || normalized == "tokens",
        _ => false,
    }
}

fn alias_targets(
    aliases: &[AliasRecord],
    record_type: &str,
    source_text: &str,
) -> Vec<String> {
    let normalized_source = normalize_text(source_text);

    aliases
        .iter()
        .filter(|alias| {
            alias_type_matches(&alias.record_type, record_type)
                && normalize_text(&alias.alias_text) == normalized_source
        })
        .map(|alias| alias.target_id.clone())
        .collect()
}

fn unique_matches(matches: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut unique = Vec::new();

    for value in matches {
        if seen.insert(value.clone()) {
            unique.push(value);
        }
    }

    unique
}

fn match_collection(
    candidate: &CollectionCandidate,
    existing: &[ExistingCollection],
    aliases: &[AliasRecord],
) -> Vec<String> {
    let mut matches = existing
        .iter()
        .filter(|record| {
            normalize_text(&record.display_name)
                == normalize_text(&candidate.display_name)
                || record.id == candidate.proposed_id
        })
        .map(|record| record.id.clone())
        .collect::<Vec<_>>();

    matches.extend(
        alias_targets(
            aliases,
            "collection",
            &candidate.display_name,
        )
        .into_iter()
        .filter(|target_id| {
            existing.iter().any(|record| record.id == target_id.as_str())
        }),
    );

    unique_matches(matches)
}

fn match_character(
    candidate: &CharacterCandidate,
    collection_match_id: Option<&str>,
    existing: &[ExistingCharacter],
    aliases: &[AliasRecord],
) -> Vec<String> {
    let mut matches = existing
        .iter()
        .filter(|record| {
            let proposed_id_matches = record.id == candidate.proposed_id;

            let scoped_name_matches = collection_match_id
                .map(|collection_id| {
                    record.collection_id == collection_id
                        && normalize_text(&record.display_name)
                            == normalize_text(&candidate.display_name)
                })
                .unwrap_or(false);

            proposed_id_matches || scoped_name_matches
        })
        .map(|record| record.id.clone())
        .collect::<Vec<_>>();

    matches.extend(
        alias_targets(
            aliases,
            "character",
            &candidate.display_name,
        )
        .into_iter()
        .filter(|target_id| {
            existing.iter().any(|record| record.id == target_id.as_str())
        }),
    );

    unique_matches(matches)
}

fn match_token(
    candidate: &TokenCandidate,
    collection_match_id: Option<&str>,
    character_match_id: Option<&str>,
    existing: &[ExistingToken],
    aliases: &[AliasRecord],
) -> Vec<String> {
    let mut matches = existing
        .iter()
        .filter(|record| {
            let proposed_id_matches = record.id == candidate.proposed_id;

            let parent_scope_is_resolved = collection_match_id.is_some()
                && (candidate.character_name.is_none()
                    || character_match_id.is_some());

            let scope_matches = parent_scope_is_resolved
                && record.associated_collection_id.as_deref()
                    == collection_match_id
                && record.associated_character_id.as_deref()
                    == character_match_id;

            let scoped_name_matches = scope_matches
                && normalize_text(&record.display_name)
                    == normalize_text(&candidate.display_name);

            proposed_id_matches || scoped_name_matches
        })
        .map(|record| record.id.clone())
        .collect::<Vec<_>>();

    matches.extend(
        alias_targets(
            aliases,
            "token",
            &candidate.display_name,
        )
        .into_iter()
        .filter(|target_id| {
            existing.iter().any(|record| record.id == target_id.as_str())
        }),
    );

    unique_matches(matches)
}

fn add_issue(
    issues: &mut Vec<IdentityPlanIssue>,
    section: &str,
    source: &str,
    message: &str,
) {
    issues.push(IdentityPlanIssue {
        section: section.to_string(),
        source: source.to_string(),
        message: message.to_string(),
    });
}

#[tauri::command]
pub async fn build_master_import_identity_plan(
    app: AppHandle,
    path: String,
) -> Result<MasterImportIdentityPlan, String> {
    let workbook_path = Path::new(&path);

    if !workbook_path.exists() || !workbook_path.is_file() {
        return Err("The selected workbook could not be found.".to_string());
    }

    let extension = workbook_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();

    if extension != "xlsx" && extension != "xlsm" {
        return Err("Select an Excel .xlsx or .xlsm workbook.".to_string());
    }

    let file_name = workbook_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Selected Workbook")
        .to_string();

    let mut workbook = open_workbook_auto(workbook_path)
        .map_err(|error| format!("Unable to open the selected workbook: {error}"))?;

    let metadata = workbook
        .worksheet_range("Workbook Metadata")
        .map_err(|error| {
            format!("Unable to read Workbook Metadata: {error}")
        })?;

    let workbook_id = metadata_value(&metadata, "Workbook ID");
    let workbook_type = metadata_value(&metadata, "Workbook Type");
    let workbook_version = metadata_value(&metadata, "Workbook Version");

    if workbook_id
        .as_deref()
        .map(|value| value.trim().eq_ignore_ascii_case(EXPECTED_WORKBOOK_ID))
        != Some(true)
    {
        return Err(
            "The selected workbook does not have the expected DMK Workbook ID."
                .to_string(),
        );
    }

    if workbook_type
        .as_deref()
        .map(|value| value.trim().eq_ignore_ascii_case("Master"))
        != Some(true)
    {
        return Err(
            "The selected workbook is not identified as a Master workbook."
                .to_string(),
        );
    }

    let helper = workbook
        .worksheet_range("Helper")
        .map_err(|error| format!("Unable to read Helper: {error}"))?;

    let characters_sheet = workbook
        .worksheet_range("Characters")
        .map_err(|error| format!("Unable to read Characters: {error}"))?;

    let character_levels_sheet = workbook
        .worksheet_range("CharacterLevels")
        .map_err(|error| format!("Unable to read CharacterLevels: {error}"))?;

    let collections = parse_collections(&helper)?;
    let characters = parse_characters(&characters_sheet, &collections)?;
    let tokens = parse_tokens(&helper, &collections, &characters)?;
    let levels = parse_levels(&character_levels_sheet, &characters)?;

    let mut connection = open_editor_connection(&app).await?;
    let existing_collections = load_existing_collections(&mut connection).await?;
    let existing_characters = load_existing_characters(&mut connection).await?;
    let existing_tokens = load_existing_tokens(&mut connection).await?;
    let existing_levels = load_existing_levels(&mut connection).await?;
    let aliases = load_aliases(&mut connection).await?;

    let mut issues = Vec::new();

    let mut collection_section = SectionAccumulator::new(
        "collections",
        "Collections",
        collections.len(),
        existing_collections.len(),
    );

    let mut collection_resolutions: HashMap<String, ParentResolution> = HashMap::new();

    for candidate in &collections {
        let normalized_name = normalize_text(&candidate.display_name);

        if let Some(reason) = &candidate.invalid_reason {
            collection_section.record_invalid(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                reason,
            );
            add_issue(
                &mut issues,
                "Collections",
                &candidate.source,
                reason,
            );
            collection_resolutions.insert(
                normalized_name,
                ParentResolution {
                    proposed_id: candidate.proposed_id.clone(),
                    matched_id: None,
                    usable: false,
                },
            );
            continue;
        }

        let matches = match_collection(candidate, &existing_collections, &aliases);

        if matches.len() > 1 {
            collection_section.record_ambiguous(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                &matches,
            );
            add_issue(
                &mut issues,
                "Collections",
                &candidate.source,
                &format!(
                    "Collection '{}' has multiple possible existing matches.",
                    candidate.display_name
                ),
            );
            collection_resolutions.insert(
                normalized_name,
                ParentResolution {
                    proposed_id: candidate.proposed_id.clone(),
                    matched_id: None,
                    usable: false,
                },
            );
        } else if let Some(matched_id) = matches.first() {
            collection_section.record_match(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                matched_id,
                "Existing collection identity matched.",
            );
            collection_resolutions.insert(
                normalized_name,
                ParentResolution {
                    proposed_id: candidate.proposed_id.clone(),
                    matched_id: Some(matched_id.clone()),
                    usable: true,
                },
            );
        } else {
            collection_section.record_new(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                "No existing collection identity matched.",
            );
            collection_resolutions.insert(
                normalized_name,
                ParentResolution {
                    proposed_id: candidate.proposed_id.clone(),
                    matched_id: None,
                    usable: true,
                },
            );
        }
    }

    let mut character_section = SectionAccumulator::new(
        "characters",
        "Characters",
        characters.len(),
        existing_characters.len(),
    );

    let mut character_resolutions: HashMap<(String, String), ParentResolution> = HashMap::new();

    for candidate in &characters {
        let key = (
            normalize_text(&candidate.collection_name),
            normalize_text(&candidate.display_name),
        );

        if let Some(reason) = &candidate.invalid_reason {
            character_section.record_invalid(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                reason,
            );
            add_issue(
                &mut issues,
                "Characters",
                &candidate.source,
                reason,
            );
            character_resolutions.insert(
                key,
                ParentResolution {
                    proposed_id: candidate.proposed_id.clone(),
                    matched_id: None,
                    usable: false,
                },
            );
            continue;
        }

        let collection_resolution = collection_resolutions
            .get(&normalize_text(&candidate.collection_name));

        let Some(collection_resolution) = collection_resolution else {
            let reason = format!(
                "Collection '{}' was not available in the collection mapping plan.",
                candidate.collection_name
            );
            character_section.record_invalid(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                &reason,
            );
            add_issue(
                &mut issues,
                "Characters",
                &candidate.source,
                &reason,
            );
            character_resolutions.insert(
                key,
                ParentResolution {
                    proposed_id: candidate.proposed_id.clone(),
                    matched_id: None,
                    usable: false,
                },
            );
            continue;
        };

        if !collection_resolution.usable {
            let reason = format!(
                "Collection '{}' has an unresolved identity mapping.",
                candidate.collection_name
            );
            character_section.record_invalid(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                &reason,
            );
            add_issue(
                &mut issues,
                "Characters",
                &candidate.source,
                &reason,
            );
            character_resolutions.insert(
                key,
                ParentResolution {
                    proposed_id: candidate.proposed_id.clone(),
                    matched_id: None,
                    usable: false,
                },
            );
            continue;
        }

        let matches = match_character(
            candidate,
            collection_resolution.matched_id.as_deref(),
            &existing_characters,
            &aliases,
        );

        if matches.len() > 1 {
            character_section.record_ambiguous(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                &matches,
            );
            add_issue(
                &mut issues,
                "Characters",
                &candidate.source,
                &format!(
                    "Character '{}' has multiple possible existing matches.",
                    candidate.display_name
                ),
            );
            character_resolutions.insert(
                key,
                ParentResolution {
                    proposed_id: candidate.proposed_id.clone(),
                    matched_id: None,
                    usable: false,
                },
            );
        } else if let Some(matched_id) = matches.first() {
            character_section.record_match(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                matched_id,
                "Existing character identity matched.",
            );
            character_resolutions.insert(
                key,
                ParentResolution {
                    proposed_id: candidate.proposed_id.clone(),
                    matched_id: Some(matched_id.clone()),
                    usable: true,
                },
            );
        } else {
            character_section.record_new(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                "No existing character identity matched.",
            );
            character_resolutions.insert(
                key,
                ParentResolution {
                    proposed_id: candidate.proposed_id.clone(),
                    matched_id: None,
                    usable: true,
                },
            );
        }
    }

    let mut token_section = SectionAccumulator::new(
        "tokens",
        "Tokens & Rarity",
        tokens.len(),
        existing_tokens.len(),
    );

    for candidate in &tokens {
        if let Some(reason) = &candidate.invalid_reason {
            token_section.record_invalid(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                reason,
            );
            add_issue(
                &mut issues,
                "Tokens & Rarity",
                &candidate.source,
                reason,
            );
            continue;
        }

        let collection_resolution = collection_resolutions
            .get(&normalize_text(&candidate.collection_name));

        let Some(collection_resolution) = collection_resolution else {
            let reason = format!(
                "Collection '{}' was not available in the collection mapping plan.",
                candidate.collection_name
            );
            token_section.record_invalid(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                &reason,
            );
            add_issue(
                &mut issues,
                "Tokens & Rarity",
                &candidate.source,
                &reason,
            );
            continue;
        };

        if !collection_resolution.usable {
            let reason = format!(
                "Collection '{}' has an unresolved identity mapping.",
                candidate.collection_name
            );
            token_section.record_invalid(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                &reason,
            );
            add_issue(
                &mut issues,
                "Tokens & Rarity",
                &candidate.source,
                &reason,
            );
            continue;
        }

        let character_resolution = candidate.character_name.as_ref().and_then(|name| {
            character_resolutions.get(&(
                normalize_text(&candidate.collection_name),
                normalize_text(name),
            ))
        });

        if candidate.character_name.is_some()
            && character_resolution.map(|resolution| resolution.usable) != Some(true)
        {
            let reason = format!(
                "Character '{}' has an unresolved identity mapping.",
                candidate.character_name.as_deref().unwrap_or("")
            );
            token_section.record_invalid(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                &reason,
            );
            add_issue(
                &mut issues,
                "Tokens & Rarity",
                &candidate.source,
                &reason,
            );
            continue;
        }

        let matches = match_token(
            candidate,
            collection_resolution.matched_id.as_deref(),
            character_resolution.and_then(|resolution| resolution.matched_id.as_deref()),
            &existing_tokens,
            &aliases,
        );

        if matches.len() > 1 {
            token_section.record_ambiguous(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                &matches,
            );
            add_issue(
                &mut issues,
                "Tokens & Rarity",
                &candidate.source,
                &format!(
                    "Token '{}' has multiple possible existing matches.",
                    candidate.display_name
                ),
            );
        } else if let Some(matched_id) = matches.first() {
            token_section.record_match(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                matched_id,
                "Existing token identity matched.",
            );
        } else {
            token_section.record_new(
                &candidate.source,
                &candidate.display_name,
                Some(candidate.proposed_id.clone()),
                "No existing token identity matched.",
            );
        }
    }

    let mut level_section = SectionAccumulator::new(
        "characterLevels",
        "Character Levels",
        levels.len(),
        existing_levels.len(),
    );

    let existing_level_keys = existing_levels
        .iter()
        .map(|level| (level.character_id.clone(), level.target_level))
        .collect::<HashSet<_>>();

    for candidate in &levels {
        let display_name = format!(
            "{} — Level {}",
            candidate.character_name,
            candidate.target_level
        );

        if let Some(reason) = &candidate.invalid_reason {
            level_section.record_invalid(
                &candidate.source,
                &display_name,
                None,
                reason,
            );
            add_issue(
                &mut issues,
                "Character Levels",
                &candidate.source,
                reason,
            );
            continue;
        }

        let character_resolution = character_resolutions.get(&(
            normalize_text(&candidate.collection_name),
            normalize_text(&candidate.character_name),
        ));

        let Some(character_resolution) = character_resolution else {
            let reason = "Character identity was not available in the mapping plan.";
            level_section.record_invalid(
                &candidate.source,
                &display_name,
                None,
                reason,
            );
            add_issue(
                &mut issues,
                "Character Levels",
                &candidate.source,
                reason,
            );
            continue;
        };

        if !character_resolution.usable {
            let reason = "Character identity is unresolved, so this level cannot be mapped safely.";
            level_section.record_invalid(
                &candidate.source,
                &display_name,
                None,
                reason,
            );
            add_issue(
                &mut issues,
                "Character Levels",
                &candidate.source,
                reason,
            );
            continue;
        }

        if let Some(matched_character_id) = character_resolution.matched_id.as_deref() {
            let key = (
                matched_character_id.to_string(),
                candidate.target_level,
            );

            if existing_level_keys.contains(&key) {
                level_section.record_match(
                    &candidate.source,
                    &display_name,
                    Some(format!(
                        "{}:level_{}",
                        character_resolution.proposed_id,
                        candidate.target_level
                    )),
                    &format!(
                        "{}:level_{}",
                        matched_character_id,
                        candidate.target_level
                    ),
                    "Existing character-level identity matched.",
                );
            } else {
                level_section.record_new(
                    &candidate.source,
                    &display_name,
                    Some(format!(
                        "{}:level_{}",
                        character_resolution.proposed_id,
                        candidate.target_level
                    )),
                    "Character exists, but this target level is not stored yet.",
                );
            }
        } else {
            level_section.record_new(
                &candidate.source,
                &display_name,
                Some(format!(
                    "{}:level_{}",
                    character_resolution.proposed_id,
                    candidate.target_level
                )),
                "Parent character is new, so this level will also be new.",
            );
        }
    }

    let sections = vec![
        collection_section.finish(),
        character_section.finish(),
        token_section.finish(),
        level_section.finish(),
    ];

    let plan_ready = sections.iter().all(|section| {
        section.ambiguous_records == 0 && section.invalid_records == 0
    });

    Ok(MasterImportIdentityPlan {
        file_name,
        workbook_version,
        plan_ready,
        sections,
        issues,
        notes: vec![
            "Read-only identity mapping only. No database records were added, changed, deactivated, or deleted."
                .to_string(),
            "Database-only records are preserved. This stage does not interpret them as deletions."
                .to_string(),
            "The next comparison stage will verify field values, token rarity/type, Magic, level times, and token requirements after identity mapping is proven safe."
                .to_string(),
        ],
    })
}
