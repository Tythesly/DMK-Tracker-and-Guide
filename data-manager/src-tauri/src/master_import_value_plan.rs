use calamine::{open_workbook_auto, Data, DataType, Range, Reader};
use serde::Serialize;
use sqlx::{sqlite::SqliteConnectOptions, Connection, SqliteConnection};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    path::Path,
    time::Duration,
};
use tauri::{AppHandle, Manager};
use unicode_normalization::{char::is_combining_mark, UnicodeNormalization};

const EXPECTED_WORKBOOK_ID: &str = "DMK_COMPLETE_TRACKER";
const MAX_EXAMPLES_PER_SECTION: usize = 15;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValuePlanFieldDifference {
    pub field: String,
    pub workbook_value: String,
    pub database_value: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValuePlanExample {
    pub status: String,
    pub source: String,
    pub display_name: String,
    pub record_id: Option<String>,
    pub detail: String,
    pub differences: Vec<ValuePlanFieldDifference>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValuePlanIssue {
    pub section: String,
    pub source: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValuePlanSection {
    pub key: String,
    pub label: String,
    pub workbook_records: usize,
    pub database_records: usize,
    pub new_records: usize,
    pub unchanged_records: usize,
    pub changed_records: usize,
    pub invalid_records: usize,
    pub unresolved_references: usize,
    pub database_only_records: usize,
    pub compared_fields: Vec<String>,
    pub examples: Vec<ValuePlanExample>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MasterImportValuePlan {
    pub file_name: String,
    pub workbook_version: Option<String>,
    pub plan_ready: bool,
    pub sections: Vec<ValuePlanSection>,
    pub issues: Vec<ValuePlanIssue>,
    pub deferred_references: Vec<ValuePlanIssue>,
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
    sort_order: i64,
}

#[derive(Clone)]
struct CharacterCandidate {
    source: String,
    collection_name: String,
    display_name: String,
    proposed_id: String,
    sort_order: i64,
}

#[derive(Clone)]
struct TokenCandidate {
    source: String,
    collection_name: String,
    character_name: Option<String>,
    display_name: String,
    proposed_id: String,
    token_type: String,
    rarity: Option<String>,
    sort_order: i64,
}

#[derive(Clone)]
struct LevelCandidate {
    source: String,
    collection_name: String,
    character_name: String,
    target_level: i64,
    common_quantity: i64,
    unique_quantity: i64,
    ears_quantity: i64,
    magic_cost: Option<i64>,
    level_time_seconds: Option<i64>,
}

#[derive(Clone)]
struct ExistingCollection {
    id: String,
    display_name: String,
    sort_order: i64,
}

#[derive(Clone)]
struct ExistingCharacter {
    id: String,
    collection_id: String,
    display_name: String,
    max_level: i64,
    sort_order: i64,
}

#[derive(Clone)]
struct ExistingToken {
    id: String,
    display_name: String,
    token_type: String,
    rarity: Option<String>,
    associated_character_id: Option<String>,
    associated_collection_id: Option<String>,
    sort_order: i64,
}

#[derive(Clone)]
struct ExistingLevel {
    character_id: String,
    target_level: i64,
    magic_cost: Option<i64>,
    level_time_seconds: Option<i64>,
}

#[derive(Clone)]
struct ExistingRequirement {
    character_id: String,
    target_level: i64,
    token_id: String,
    quantity: i64,
}

#[derive(Clone)]
struct AliasRecord {
    record_type: String,
    alias_text: String,
    target_id: String,
}

struct ValueAccumulator {
    key: String,
    label: String,
    workbook_records: usize,
    database_records: usize,
    new_records: usize,
    unchanged_records: usize,
    changed_records: usize,
    invalid_records: usize,
    unresolved_references: usize,
    matched_database_keys: HashSet<String>,
    compared_fields: Vec<String>,
    examples: Vec<ValuePlanExample>,
}

impl ValueAccumulator {
    fn new(
        key: &str,
        label: &str,
        workbook_records: usize,
        database_records: usize,
        compared_fields: &[&str],
    ) -> Self {
        Self {
            key: key.to_string(),
            label: label.to_string(),
            workbook_records,
            database_records,
            new_records: 0,
            unchanged_records: 0,
            changed_records: 0,
            invalid_records: 0,
            unresolved_references: 0,
            matched_database_keys: HashSet::new(),
            compared_fields: compared_fields.iter().map(|value| value.to_string()).collect(),
            examples: Vec::new(),
        }
    }

    fn push_example(&mut self, example: ValuePlanExample) {
        if self.examples.len() < MAX_EXAMPLES_PER_SECTION {
            self.examples.push(example);
        }
    }

    fn record_new(&mut self, source: &str, display_name: &str, record_id: String) {
        self.new_records += 1;
        self.push_example(ValuePlanExample {
            status: "new".to_string(),
            source: source.to_string(),
            display_name: display_name.to_string(),
            record_id: Some(record_id),
            detail: "Record does not exist in dmk-editor.db and would be inserted by a future import.".to_string(),
            differences: Vec::new(),
        });
    }

    fn record_unchanged(
        &mut self,
        source: &str,
        display_name: &str,
        record_key: String,
        record_id: String,
    ) {
        self.unchanged_records += 1;
        self.matched_database_keys.insert(record_key);
        self.push_example(ValuePlanExample {
            status: "unchanged".to_string(),
            source: source.to_string(),
            display_name: display_name.to_string(),
            record_id: Some(record_id),
            detail: "Compared workbook values match the existing database record.".to_string(),
            differences: Vec::new(),
        });
    }

    fn record_changed(
        &mut self,
        source: &str,
        display_name: &str,
        record_key: String,
        record_id: String,
        differences: Vec<ValuePlanFieldDifference>,
    ) {
        self.changed_records += 1;
        self.matched_database_keys.insert(record_key);
        self.push_example(ValuePlanExample {
            status: "changed".to_string(),
            source: source.to_string(),
            display_name: display_name.to_string(),
            record_id: Some(record_id),
            detail: "Identity matched, but one or more compared values differ.".to_string(),
            differences,
        });
    }

    fn record_invalid(&mut self, source: &str, display_name: &str, detail: &str) {
        self.invalid_records += 1;
        self.push_example(ValuePlanExample {
            status: "invalid".to_string(),
            source: source.to_string(),
            display_name: display_name.to_string(),
            record_id: None,
            detail: detail.to_string(),
            differences: Vec::new(),
        });
    }

    fn record_unresolved_reference(&mut self) {
        self.unresolved_references += 1;
    }

    fn finish(self) -> ValuePlanSection {
        ValuePlanSection {
            key: self.key,
            label: self.label,
            workbook_records: self.workbook_records,
            database_records: self.database_records,
            new_records: self.new_records,
            unchanged_records: self.unchanged_records,
            changed_records: self.changed_records,
            invalid_records: self.invalid_records,
            unresolved_references: self.unresolved_references,
            database_only_records: self
                .database_records
                .saturating_sub(self.matched_database_keys.len()),
            compared_fields: self.compared_fields,
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

fn find_header(range: &Range<Data>, headers: &[&str]) -> Option<HeaderLocation> {
    let normalized_headers = headers
        .iter()
        .map(|header| normalize_text(header))
        .collect::<Vec<_>>();

    for (row_index, row) in range.rows().enumerate() {
        if row.len() < normalized_headers.len() {
            continue;
        }

        for column_index in 0..=(row.len() - normalized_headers.len()) {
            if normalized_headers.iter().enumerate().all(|(offset, expected)| {
                normalized_cell_text(&row[column_index + offset]) == *expected
            }) {
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
    format!(
        "{}!{}{}",
        sheet_name,
        excel_column_name(start_column as usize + column_index),
        start_row as usize + row_index + 1
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
            ((value - rounded).abs() <= 0.000_001).then_some(rounded as i64)
        }
        Data::String(value) => value.trim().replace(',', "").parse::<i64>().ok(),
        _ => cell.as_f64().and_then(|value| {
            let rounded = value.round();
            ((value - rounded).abs() <= 0.000_001).then_some(rounded as i64)
        }),
    }
}

fn parse_nonnegative_integer(cell: Option<&Data>) -> Result<i64, String> {
    match cell {
        None | Some(Data::Empty) => Ok(0),
        Some(value) if display_cell_text(value).trim().is_empty() => Ok(0),
        Some(value) => parse_integer(Some(value))
            .filter(|number| *number >= 0)
            .ok_or_else(|| format!("'{}' is not a non-negative whole number.", display_cell_text(value))),
    }
}

fn parse_optional_integer(cell: Option<&Data>) -> Result<Option<i64>, String> {
    match cell {
        None | Some(Data::Empty) => Ok(None),
        Some(value) if display_cell_text(value).trim().is_empty() => Ok(None),
        Some(value) => parse_integer(Some(value))
            .filter(|number| *number >= 0)
            .map(Some)
            .ok_or_else(|| format!("'{}' is not a non-negative whole number.", display_cell_text(value))),
    }
}

fn parse_duration_string(value: &str) -> Option<i64> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Ok(number) = trimmed.parse::<f64>() {
        if number >= 0.0 {
            return Some((number * 86_400.0).round() as i64);
        }
    }

    let lower = trimmed.to_lowercase();
    let mut total = 0_i64;
    let mut consumed = false;
    for piece in lower.split_whitespace() {
        let split_at = piece
            .find(|character: char| !character.is_ascii_digit())
            .unwrap_or(piece.len());
        if split_at == 0 {
            continue;
        }
        let number = piece[..split_at].parse::<i64>().ok()?;
        let unit = &piece[split_at..];
        let multiplier = match unit {
            "d" | "day" | "days" => 86_400,
            "h" | "hr" | "hrs" | "hour" | "hours" => 3_600,
            "m" | "min" | "mins" | "minute" | "minutes" => 60,
            "s" | "sec" | "secs" | "second" | "seconds" => 1,
            _ => continue,
        };
        total += number * multiplier;
        consumed = true;
    }
    if consumed {
        return Some(total);
    }

    let parts = trimmed.split(':').collect::<Vec<_>>();
    if parts.len() == 2 || parts.len() == 3 {
        let hours = parts[0].parse::<i64>().ok()?;
        let minutes = parts[1].parse::<i64>().ok()?;
        let seconds = if parts.len() == 3 {
            parts[2].parse::<f64>().ok()?.round() as i64
        } else {
            0
        };
        if hours >= 0 && (0..60).contains(&minutes) && (0..60).contains(&seconds) {
            return Some(hours * 3_600 + minutes * 60 + seconds);
        }
    }

    None
}

fn parse_optional_duration_seconds(cell: Option<&Data>) -> Result<Option<i64>, String> {
    let Some(cell) = cell else {
        return Ok(None);
    };
    let text = display_cell_text(cell);
    if text.trim().is_empty() {
        return Ok(None);
    }

    if let Some(serial_days) = cell.as_f64() {
        if serial_days >= 0.0 {
            return Ok(Some((serial_days * 86_400.0).round() as i64));
        }
    }

    parse_duration_string(&text)
        .map(Some)
        .ok_or_else(|| format!("Time value '{}' could not be interpreted.", text))
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

fn metadata_value(range: &Range<Data>, key: &str) -> Option<String> {
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
        "shared" | "shared token" | "common token" => Some("Shared Token".to_string()),
        "unique" | "unique token" => Some("Unique Token".to_string()),
        "ears" | "ears token" => Some("Ears Token".to_string()),
        _ => None,
    }
}

fn normalize_rarity(value: &str) -> Option<String> {
    match normalize_text(value).as_str() {
        "common" => Some("common".to_string()),
        "uncommon" => Some("uncommon".to_string()),
        "rare" => Some("rare".to_string()),
        "epic" => Some("epic".to_string()),
        "legendary" => Some("legendary".to_string()),
        "unknown" => Some("unknown".to_string()),
        "" => None,
        _ => None,
    }
}

fn parse_collections(helper: &Range<Data>) -> Result<Vec<CollectionCandidate>, String> {
    let header = find_header(helper, &["Name", "Initials"])
        .ok_or_else(|| "Could not find the Collections Name / Initials header in Helper.".to_string())?;

    let mut records = Vec::new();
    let mut id_occurrences = HashMap::new();
    for (row_index, row) in helper.rows().enumerate().skip(header.row_index + 1) {
        let name = cell_text(row, header.column_index);
        let initials = cell_text(row, header.column_index + 1);
        if name.trim().is_empty() || initials.trim().is_empty() {
            continue;
        }
        let sort_order = records.len() as i64;
        records.push(CollectionCandidate {
            source: source_cell(helper, "Helper", row_index, header.column_index),
            proposed_id: allocate_stable_id("collection", &name, &mut id_occurrences),
            display_name: name,
            sort_order,
        });
    }
    Ok(records)
}

fn parse_characters(
    characters: &Range<Data>,
    collections: &[CollectionCandidate],
) -> Result<Vec<CharacterCandidate>, String> {
    let header = find_header(characters, &["Page", "Character Name", "Lvl"])
        .ok_or_else(|| "Could not find the Page / Character Name / Lvl header on Characters.".to_string())?;
    let collection_names = collections
        .iter()
        .map(|collection| normalize_text(&collection.display_name))
        .collect::<HashSet<_>>();

    let mut current_collection: Option<String> = None;
    let mut order_by_collection: HashMap<String, i64> = HashMap::new();
    let mut id_occurrences = HashMap::new();
    let mut records = Vec::new();

    for (row_index, row) in characters.rows().enumerate().skip(header.row_index + 1) {
        let page_or_collection = cell_text(row, header.column_index);
        let character_name = cell_text(row, header.column_index + 1);
        let level = parse_integer(row.get(header.column_index + 2));

        if character_name.trim().is_empty() {
            if collection_names.contains(&normalize_text(&page_or_collection)) {
                current_collection = Some(page_or_collection.trim().to_string());
            }
            continue;
        }
        if !matches!(level, Some(0..=10)) {
            continue;
        }
        let collection_name = current_collection.clone().ok_or_else(|| {
            format!("No collection heading was resolved for character '{}'.", character_name)
        })?;
        let normalized_collection = normalize_text(&collection_name);
        let sort_order = *order_by_collection.entry(normalized_collection).or_insert(0);
        *order_by_collection
            .get_mut(&normalize_text(&collection_name))
            .expect("collection order must exist") += 1;

        records.push(CharacterCandidate {
            source: source_cell(characters, "Characters", row_index, header.column_index + 1),
            collection_name,
            proposed_id: allocate_stable_id("character", &character_name, &mut id_occurrences),
            display_name: character_name,
            sort_order,
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
        &["Collection", "Character", "Token Type", "Token Name", "Quality"],
    )
    .ok_or_else(|| "Could not find the token source header in Helper.".to_string())?;

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

    let mut scope_orders: HashMap<(String, String), i64> = HashMap::new();
    let mut id_occurrences = HashMap::new();
    let mut records = Vec::new();

    for (row_index, row) in helper.rows().enumerate().skip(header.row_index + 1) {
        let collection_name = cell_text(row, header.column_index);
        let character_text = cell_text(row, header.column_index + 1);
        let token_type_text = cell_text(row, header.column_index + 2);
        let token_name = cell_text(row, header.column_index + 3);
        let rarity_text = cell_text(row, header.column_index + 4);
        if token_type_text.trim().is_empty() || token_name.trim().is_empty() {
            continue;
        }

        if !collection_names.contains(&normalize_text(&collection_name)) {
            return Err(format!("Token '{}' references unknown collection '{}'.", token_name, collection_name));
        }
        let token_type = normalize_token_type(&token_type_text).ok_or_else(|| {
            format!("Token '{}' has unsupported Token Type '{}'.", token_name, token_type_text)
        })?;
        let character_name = if character_text.trim().is_empty() {
            None
        } else {
            if !character_names.contains(&(
                normalize_text(&collection_name),
                normalize_text(&character_text),
            )) {
                return Err(format!(
                    "Token '{}' references unknown character '{}' in '{}'.",
                    token_name, character_text, collection_name
                ));
            }
            Some(character_text)
        };

        let rarity = if rarity_text.trim().is_empty() {
            None
        } else {
            Some(normalize_rarity(&rarity_text).ok_or_else(|| {
                format!("Token '{}' has unsupported rarity '{}'.", token_name, rarity_text)
            })?)
        };
        let scope_key = (
            normalize_text(&collection_name),
            character_name
                .as_deref()
                .map(normalize_text)
                .unwrap_or_default(),
        );
        let sort_order = *scope_orders.entry(scope_key.clone()).or_insert(0);
        *scope_orders.get_mut(&scope_key).expect("scope order must exist") += 1;

        records.push(TokenCandidate {
            source: source_cell(helper, "Helper", row_index, header.column_index + 3),
            collection_name,
            character_name,
            proposed_id: allocate_stable_id("token", &token_name, &mut id_occurrences),
            display_name: token_name,
            token_type,
            rarity,
            sort_order,
        });
    }
    Ok(records)
}

fn parse_levels(levels: &Range<Data>) -> Result<Vec<LevelCandidate>, String> {
    let header = find_header(
        levels,
        &["Collection", "Character", "Level", "Common", "Unique", "Ears", "Magic", "Time"],
    )
    .ok_or_else(|| "Could not find the CharacterLevels source header.".to_string())?;

    let mut records = Vec::new();
    for (row_index, row) in levels.rows().enumerate().skip(header.row_index + 1) {
        let collection_name = cell_text(row, header.column_index);
        let character_name = cell_text(row, header.column_index + 1);
        let level_text = cell_text(row, header.column_index + 2);
        if collection_name.trim().is_empty() || character_name.trim().is_empty() || level_text.trim().is_empty() {
            continue;
        }
        let source = source_cell(levels, "CharacterLevels", row_index, header.column_index + 2);
        let target_level = parse_integer(row.get(header.column_index + 2))
            .filter(|level| (1..=10).contains(level))
            .ok_or_else(|| format!("{} has an invalid target level.", source))?;
        let common_quantity = parse_nonnegative_integer(row.get(header.column_index + 3))
            .map_err(|error| format!("{} Common requirement: {}", source, error))?;
        let unique_quantity = parse_nonnegative_integer(row.get(header.column_index + 4))
            .map_err(|error| format!("{} Unique requirement: {}", source, error))?;
        let ears_quantity = parse_nonnegative_integer(row.get(header.column_index + 5))
            .map_err(|error| format!("{} Ears requirement: {}", source, error))?;
        let magic_cost = parse_optional_integer(row.get(header.column_index + 6))
            .map_err(|error| format!("{} Magic: {}", source, error))?;
        let level_time_seconds = parse_optional_duration_seconds(row.get(header.column_index + 7))
            .map_err(|error| format!("{} Time: {}", source, error))?;

        records.push(LevelCandidate {
            source,
            collection_name,
            character_name,
            target_level,
            common_quantity,
            unique_quantity,
            ears_quantity,
            magic_cost,
            level_time_seconds,
        });
    }
    Ok(records)
}

async fn open_editor_connection(app: &AppHandle) -> Result<SqliteConnection, String> {
    let database_path = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("Unable to locate the Data Manager application directory: {error}"))?
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

async fn load_existing_collections(connection: &mut SqliteConnection) -> Result<Vec<ExistingCollection>, String> {
    let rows = sqlx::query_as::<_, (String, String, i64)>(
        "SELECT id, display_name, sort_order FROM collections",
    )
    .fetch_all(&mut *connection)
    .await
    .map_err(|error| format!("Unable to read existing collections: {error}"))?;
    Ok(rows
        .into_iter()
        .map(|(id, display_name, sort_order)| ExistingCollection { id, display_name, sort_order })
        .collect())
}

async fn load_existing_characters(connection: &mut SqliteConnection) -> Result<Vec<ExistingCharacter>, String> {
    let rows = sqlx::query_as::<_, (String, String, String, i64, i64)>(
        "SELECT id, collection_id, display_name, max_level, sort_order FROM characters",
    )
    .fetch_all(&mut *connection)
    .await
    .map_err(|error| format!("Unable to read existing characters: {error}"))?;
    Ok(rows
        .into_iter()
        .map(|(id, collection_id, display_name, max_level, sort_order)| ExistingCharacter {
            id,
            collection_id,
            display_name,
            max_level,
            sort_order,
        })
        .collect())
}

async fn load_existing_tokens(connection: &mut SqliteConnection) -> Result<Vec<ExistingToken>, String> {
    let rows = sqlx::query_as::<_, (String, String, String, Option<String>, Option<String>, Option<String>, i64)>(
        "SELECT id, display_name, token_type, rarity, associated_character_id, associated_collection_id, sort_order FROM tokens",
    )
    .fetch_all(&mut *connection)
    .await
    .map_err(|error| format!("Unable to read existing tokens: {error}"))?;
    Ok(rows
        .into_iter()
        .map(|(id, display_name, token_type, rarity, associated_character_id, associated_collection_id, sort_order)| ExistingToken {
            id,
            display_name,
            token_type,
            rarity,
            associated_character_id,
            associated_collection_id,
            sort_order,
        })
        .collect())
}

async fn load_existing_levels(connection: &mut SqliteConnection) -> Result<Vec<ExistingLevel>, String> {
    let rows = sqlx::query_as::<_, (String, i64, Option<i64>, Option<i64>)>(
        "SELECT character_id, target_level, magic_cost, level_time_seconds FROM character_levels",
    )
    .fetch_all(&mut *connection)
    .await
    .map_err(|error| format!("Unable to read existing character levels: {error}"))?;
    Ok(rows
        .into_iter()
        .map(|(character_id, target_level, magic_cost, level_time_seconds)| ExistingLevel {
            character_id,
            target_level,
            magic_cost,
            level_time_seconds,
        })
        .collect())
}

async fn load_existing_requirements(connection: &mut SqliteConnection) -> Result<Vec<ExistingRequirement>, String> {
    let rows = sqlx::query_as::<_, (String, i64, String, i64)>(
        "SELECT character_id, target_level, token_id, quantity FROM character_level_token_requirements",
    )
    .fetch_all(&mut *connection)
    .await
    .map_err(|error| format!("Unable to read existing character-level token requirements: {error}"))?;
    Ok(rows
        .into_iter()
        .map(|(character_id, target_level, token_id, quantity)| ExistingRequirement {
            character_id,
            target_level,
            token_id,
            quantity,
        })
        .collect())
}

async fn load_aliases(connection: &mut SqliteConnection) -> Result<Vec<AliasRecord>, String> {
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

fn alias_targets(aliases: &[AliasRecord], record_type: &str, source_text: &str) -> Vec<String> {
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

fn unique_matches(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    values
        .into_iter()
        .filter(|value| seen.insert(value.clone()))
        .collect()
}

fn collection_matches(candidate: &CollectionCandidate, existing: &[ExistingCollection], aliases: &[AliasRecord]) -> Vec<String> {
    let mut matches = existing
        .iter()
        .filter(|record| {
            record.id == candidate.proposed_id
                || normalize_text(&record.display_name) == normalize_text(&candidate.display_name)
        })
        .map(|record| record.id.clone())
        .collect::<Vec<_>>();
    matches.extend(alias_targets(aliases, "collection", &candidate.display_name));
    unique_matches(matches)
}

fn character_matches(
    candidate: &CharacterCandidate,
    collection_id: &str,
    existing: &[ExistingCharacter],
    aliases: &[AliasRecord],
) -> Vec<String> {
    let mut matches = existing
        .iter()
        .filter(|record| {
            record.id == candidate.proposed_id
                || (record.collection_id == collection_id
                    && normalize_text(&record.display_name) == normalize_text(&candidate.display_name))
        })
        .map(|record| record.id.clone())
        .collect::<Vec<_>>();
    matches.extend(alias_targets(aliases, "character", &candidate.display_name));
    unique_matches(matches)
}

fn token_matches(
    candidate: &TokenCandidate,
    collection_id: &str,
    character_id: Option<&str>,
    existing: &[ExistingToken],
    aliases: &[AliasRecord],
) -> Vec<String> {
    let mut matches = existing
        .iter()
        .filter(|record| {
            record.id == candidate.proposed_id
                || (record.associated_collection_id.as_deref() == Some(collection_id)
                    && record.associated_character_id.as_deref() == character_id
                    && normalize_text(&record.display_name) == normalize_text(&candidate.display_name))
        })
        .map(|record| record.id.clone())
        .collect::<Vec<_>>();
    matches.extend(alias_targets(aliases, "token", &candidate.display_name));
    unique_matches(matches)
}

fn difference(field: &str, workbook_value: impl ToString, database_value: impl ToString) -> ValuePlanFieldDifference {
    ValuePlanFieldDifference {
        field: field.to_string(),
        workbook_value: workbook_value.to_string(),
        database_value: database_value.to_string(),
    }
}

fn option_number_text(value: Option<i64>) -> String {
    value.map(|number| number.to_string()).unwrap_or_else(|| "(blank)".to_string())
}

fn option_text(value: Option<&str>) -> String {
    value.unwrap_or("(blank)").to_string()
}

fn level_key(character_id: &str, target_level: i64) -> String {
    format!("{}|{}", character_id, target_level)
}

fn requirement_map_for_level(
    requirements: &[ExistingRequirement],
    character_id: &str,
    target_level: i64,
) -> BTreeMap<String, i64> {
    requirements
        .iter()
        .filter(|record| record.character_id == character_id && record.target_level == target_level)
        .map(|record| (record.token_id.clone(), record.quantity))
        .collect()
}

fn format_requirement_map(values: &BTreeMap<String, i64>) -> String {
    if values.is_empty() {
        return "(none)".to_string();
    }
    values
        .iter()
        .map(|(token_id, quantity)| format!("{} x{}", token_id, quantity))
        .collect::<Vec<_>>()
        .join(", ")
}

fn add_issue(issues: &mut Vec<ValuePlanIssue>, section: &str, source: &str, message: &str) {
    issues.push(ValuePlanIssue {
        section: section.to_string(),
        source: source.to_string(),
        message: message.to_string(),
    });
}

#[tauri::command]
pub async fn build_master_import_value_plan(
    app: AppHandle,
    path: String,
) -> Result<MasterImportValuePlan, String> {
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
        .map_err(|error| format!("Unable to read Workbook Metadata: {error}"))?;
    let workbook_id = metadata_value(&metadata, "Workbook ID");
    let workbook_type = metadata_value(&metadata, "Workbook Type");
    let workbook_version = metadata_value(&metadata, "Workbook Version");

    if workbook_id.as_deref().map(|value| value.trim().eq_ignore_ascii_case(EXPECTED_WORKBOOK_ID)) != Some(true) {
        return Err("The selected workbook does not have the expected DMK Workbook ID.".to_string());
    }
    if workbook_type.as_deref().map(|value| value.trim().eq_ignore_ascii_case("Master")) != Some(true) {
        return Err("The selected workbook is not identified as a Master workbook.".to_string());
    }

    let helper = workbook
        .worksheet_range("Helper")
        .map_err(|error| format!("Unable to read Helper: {error}"))?;
    let characters_sheet = workbook
        .worksheet_range("Characters")
        .map_err(|error| format!("Unable to read Characters: {error}"))?;
    let levels_sheet = workbook
        .worksheet_range("CharacterLevels")
        .map_err(|error| format!("Unable to read CharacterLevels: {error}"))?;

    let collections = parse_collections(&helper)?;
    let characters = parse_characters(&characters_sheet, &collections)?;
    let tokens = parse_tokens(&helper, &collections, &characters)?;
    let levels = parse_levels(&levels_sheet)?;

    let mut connection = open_editor_connection(&app).await?;
    let existing_collections = load_existing_collections(&mut connection).await?;
    let existing_characters = load_existing_characters(&mut connection).await?;
    let existing_tokens = load_existing_tokens(&mut connection).await?;
    let existing_levels = load_existing_levels(&mut connection).await?;
    let existing_requirements = load_existing_requirements(&mut connection).await?;
    let aliases = load_aliases(&mut connection).await?;

    let mut issues = Vec::new();
    let mut deferred_references = Vec::new();

    let mut collection_section = ValueAccumulator::new(
        "collections",
        "Collections",
        collections.len(),
        existing_collections.len(),
        &["Display Name", "Sort Order"],
    );
    let mut collection_ids: HashMap<String, String> = HashMap::new();

    for candidate in &collections {
        let matches = collection_matches(candidate, &existing_collections, &aliases);
        if matches.len() > 1 {
            let message = format!("Collection '{}' has multiple existing identity matches.", candidate.display_name);
            collection_section.record_invalid(&candidate.source, &candidate.display_name, &message);
            add_issue(&mut issues, "Collections", &candidate.source, &message);
            continue;
        }
        let resolved_id = matches.first().cloned().unwrap_or_else(|| candidate.proposed_id.clone());
        collection_ids.insert(normalize_text(&candidate.display_name), resolved_id.clone());

        let Some(matched_id) = matches.first() else {
            collection_section.record_new(&candidate.source, &candidate.display_name, resolved_id);
            continue;
        };
        let existing = existing_collections.iter().find(|record| record.id == *matched_id).expect("matched collection must exist");
        let mut differences = Vec::new();
        if existing.display_name != candidate.display_name {
            differences.push(difference("Display Name", &candidate.display_name, &existing.display_name));
        }
        if existing.sort_order != candidate.sort_order {
            differences.push(difference("Sort Order", candidate.sort_order, existing.sort_order));
        }
        if differences.is_empty() {
            collection_section.record_unchanged(&candidate.source, &candidate.display_name, matched_id.clone(), matched_id.clone());
        } else {
            collection_section.record_changed(&candidate.source, &candidate.display_name, matched_id.clone(), matched_id.clone(), differences);
        }
    }

    let mut character_section = ValueAccumulator::new(
        "characters",
        "Characters",
        characters.len(),
        existing_characters.len(),
        &["Display Name", "Collection", "Sort Order", "Maximum Level"],
    );
    let mut character_ids: HashMap<(String, String), String> = HashMap::new();

    for candidate in &characters {
        let Some(collection_id) = collection_ids.get(&normalize_text(&candidate.collection_name)) else {
            let message = format!("Collection '{}' could not be resolved.", candidate.collection_name);
            character_section.record_invalid(&candidate.source, &candidate.display_name, &message);
            add_issue(&mut issues, "Characters", &candidate.source, &message);
            continue;
        };
        let matches = character_matches(candidate, collection_id, &existing_characters, &aliases);
        if matches.len() > 1 {
            let message = format!("Character '{}' has multiple existing identity matches.", candidate.display_name);
            character_section.record_invalid(&candidate.source, &candidate.display_name, &message);
            add_issue(&mut issues, "Characters", &candidate.source, &message);
            continue;
        }
        let resolved_id = matches.first().cloned().unwrap_or_else(|| candidate.proposed_id.clone());
        character_ids.insert(
            (normalize_text(&candidate.collection_name), normalize_text(&candidate.display_name)),
            resolved_id.clone(),
        );

        let Some(matched_id) = matches.first() else {
            character_section.record_new(&candidate.source, &candidate.display_name, resolved_id);
            continue;
        };
        let existing = existing_characters.iter().find(|record| record.id == *matched_id).expect("matched character must exist");
        let mut differences = Vec::new();
        if existing.display_name != candidate.display_name {
            differences.push(difference("Display Name", &candidate.display_name, &existing.display_name));
        }
        if existing.collection_id != *collection_id {
            differences.push(difference("Collection", collection_id, &existing.collection_id));
        }
        if existing.sort_order != candidate.sort_order {
            differences.push(difference("Sort Order", candidate.sort_order, existing.sort_order));
        }
        if existing.max_level != 10 {
            differences.push(difference("Maximum Level", 10, existing.max_level));
        }
        if differences.is_empty() {
            character_section.record_unchanged(&candidate.source, &candidate.display_name, matched_id.clone(), matched_id.clone());
        } else {
            character_section.record_changed(&candidate.source, &candidate.display_name, matched_id.clone(), matched_id.clone(), differences);
        }
    }

    let mut token_section = ValueAccumulator::new(
        "tokens",
        "Tokens & Rarity",
        tokens.len(),
        existing_tokens.len(),
        &["Display Name", "Token Type", "Rarity", "Collection", "Character", "Sort Order"],
    );
    let mut token_ids_by_scope_type: HashMap<(String, String, String), String> = HashMap::new();

    for candidate in &tokens {
        let Some(collection_id) = collection_ids.get(&normalize_text(&candidate.collection_name)) else {
            let message = format!("Collection '{}' could not be resolved.", candidate.collection_name);
            token_section.record_invalid(&candidate.source, &candidate.display_name, &message);
            add_issue(&mut issues, "Tokens & Rarity", &candidate.source, &message);
            continue;
        };
        let character_id = candidate.character_name.as_ref().and_then(|name| {
            character_ids.get(&(normalize_text(&candidate.collection_name), normalize_text(name)))
        });
        if candidate.character_name.is_some() && character_id.is_none() {
            let message = format!("Character '{}' could not be resolved.", candidate.character_name.as_deref().unwrap_or(""));
            token_section.record_invalid(&candidate.source, &candidate.display_name, &message);
            add_issue(&mut issues, "Tokens & Rarity", &candidate.source, &message);
            continue;
        }

        let matches = token_matches(
            candidate,
            collection_id,
            character_id.map(String::as_str),
            &existing_tokens,
            &aliases,
        );
        if matches.len() > 1 {
            let message = format!("Token '{}' has multiple existing identity matches.", candidate.display_name);
            token_section.record_invalid(&candidate.source, &candidate.display_name, &message);
            add_issue(&mut issues, "Tokens & Rarity", &candidate.source, &message);
            continue;
        }
        let resolved_id = matches.first().cloned().unwrap_or_else(|| candidate.proposed_id.clone());
        token_ids_by_scope_type.insert(
            (
                normalize_text(&candidate.collection_name),
                candidate.character_name.as_deref().map(normalize_text).unwrap_or_default(),
                normalize_text(&candidate.token_type),
            ),
            resolved_id.clone(),
        );

        let Some(matched_id) = matches.first() else {
            token_section.record_new(&candidate.source, &candidate.display_name, resolved_id);
            continue;
        };
        let existing = existing_tokens.iter().find(|record| record.id == *matched_id).expect("matched token must exist");
        let mut differences = Vec::new();
        if existing.display_name != candidate.display_name {
            differences.push(difference("Display Name", &candidate.display_name, &existing.display_name));
        }
        if normalize_text(&existing.token_type) != normalize_text(&candidate.token_type) {
            differences.push(difference("Token Type", &candidate.token_type, &existing.token_type));
        }
        if existing.rarity.as_deref() != candidate.rarity.as_deref() {
            differences.push(difference("Rarity", option_text(candidate.rarity.as_deref()), option_text(existing.rarity.as_deref())));
        }
        if existing.associated_collection_id.as_deref() != Some(collection_id.as_str()) {
            differences.push(difference("Collection", collection_id, option_text(existing.associated_collection_id.as_deref())));
        }
        if existing.associated_character_id.as_deref() != character_id.map(String::as_str) {
            differences.push(difference(
                "Character",
                option_text(character_id.map(String::as_str)),
                option_text(existing.associated_character_id.as_deref()),
            ));
        }
        if existing.sort_order != candidate.sort_order {
            differences.push(difference("Sort Order", candidate.sort_order, existing.sort_order));
        }
        if differences.is_empty() {
            token_section.record_unchanged(&candidate.source, &candidate.display_name, matched_id.clone(), matched_id.clone());
        } else {
            token_section.record_changed(&candidate.source, &candidate.display_name, matched_id.clone(), matched_id.clone(), differences);
        }
    }

    let mut level_section = ValueAccumulator::new(
        "characterLevels",
        "Character Levels",
        levels.len(),
        existing_levels.len(),
        &["Magic Cost", "Level/Welcome Time", "Shared Token Requirement", "Unique Token Requirement", "Ears Token Requirement"],
    );

    for candidate in &levels {
        let character_key = (
            normalize_text(&candidate.collection_name),
            normalize_text(&candidate.character_name),
        );
        let Some(character_id) = character_ids.get(&character_key) else {
            let message = format!(
                "Character '{}' could not be resolved in collection '{}'.",
                candidate.character_name, candidate.collection_name
            );
            level_section.record_invalid(&candidate.source, &candidate.character_name, &message);
            add_issue(&mut issues, "Character Levels", &candidate.source, &message);
            continue;
        };

        let shared_token_id = token_ids_by_scope_type.get(&(
            normalize_text(&candidate.collection_name),
            String::new(),
            normalize_text("Shared Token"),
        ));
        let unique_token_id = token_ids_by_scope_type.get(&(
            normalize_text(&candidate.collection_name),
            normalize_text(&candidate.character_name),
            normalize_text("Unique Token"),
        ));
        let ears_token_id = token_ids_by_scope_type.get(&(
            normalize_text(&candidate.collection_name),
            normalize_text(&candidate.character_name),
            normalize_text("Ears Token"),
        ));

        let mut expected_requirements = BTreeMap::new();
        let mut has_unresolved_requirements = false;

        for (quantity, token_id, label) in [
            (candidate.common_quantity, shared_token_id, "Shared Token"),
            (candidate.unique_quantity, unique_token_id, "Unique Token"),
            (candidate.ears_quantity, ears_token_id, "Ears Token"),
        ] {
            if quantity <= 0 {
                continue;
            }

            if let Some(token_id) = token_id {
                expected_requirements.insert(token_id.clone(), quantity);
                continue;
            }

            has_unresolved_requirements = true;
            level_section.record_unresolved_reference();

            let message = format!(
                "{} requires {} x{}, but that token has not been defined for {} in {} yet. The requirement is treated as a deferred reference rather than invalid data.",
                candidate.source,
                label,
                quantity,
                candidate.character_name,
                candidate.collection_name
            );

            add_issue(
                &mut deferred_references,
                "Character Levels",
                &candidate.source,
                &message,
            );
        }

        let key = level_key(character_id, candidate.target_level);
        let existing = existing_levels.iter().find(|record| {
            record.character_id == *character_id && record.target_level == candidate.target_level
        });
        let display_name = format!("{} — Level {}", candidate.character_name, candidate.target_level);
        let Some(existing) = existing else {
            level_section.record_new(&candidate.source, &display_name, key);
            continue;
        };

        let existing_requirements = requirement_map_for_level(
            &existing_requirements,
            character_id,
            candidate.target_level,
        );
        let mut differences = Vec::new();
        if existing.magic_cost != candidate.magic_cost {
            differences.push(difference(
                "Magic Cost",
                option_number_text(candidate.magic_cost),
                option_number_text(existing.magic_cost),
            ));
        }
        if existing.level_time_seconds != candidate.level_time_seconds {
            differences.push(difference(
                "Level/Welcome Time (seconds)",
                option_number_text(candidate.level_time_seconds),
                option_number_text(existing.level_time_seconds),
            ));
        }
        if !has_unresolved_requirements && existing_requirements != expected_requirements {
            differences.push(difference(
                "Token Requirements",
                format_requirement_map(&expected_requirements),
                format_requirement_map(&existing_requirements),
            ));
        }

        if differences.is_empty() {
            level_section.record_unchanged(&candidate.source, &display_name, key.clone(), key);
        } else {
            level_section.record_changed(&candidate.source, &display_name, key.clone(), key, differences);
        }
    }

    let sections = vec![
        collection_section.finish(),
        character_section.finish(),
        token_section.finish(),
        level_section.finish(),
    ];
    let plan_ready = issues.is_empty() && sections.iter().all(|section| section.invalid_records == 0);

    Ok(MasterImportValuePlan {
        file_name,
        workbook_version,
        plan_ready,
        sections,
        issues,
        deferred_references,
        notes: vec![
            "Read-only value comparison: no database records are inserted, updated, or deleted.".to_string(),
            "Collections compare Display Name and workbook order. Limited-Time, Active, and Notes are not inferred yet.".to_string(),
            "Characters compare Display Name, Collection, workbook order, and fixed Maximum Level 10. Premium, Limited-Time, Active, and Notes are not inferred yet.".to_string(),
            "Tokens compare type, rarity, collection/character association, and scoped order.".to_string(),
            "Character Levels compare Magic, time, and Shared/Unique/Ears token requirements when the corresponding token records exist.".to_string(),
            "A positive Character Level token quantity may legitimately appear before its token record exists. Those forward references are reported as deferred, not invalid, and do not block the read-only value comparison.".to_string(),
            "Database writes remain disabled until the importer can persist deferred token requirements safely and resolve them after the missing token is added.".to_string(),
        ],
    })
}