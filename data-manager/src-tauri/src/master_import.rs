use calamine::{
    open_workbook_auto,
    Data,
    DataType,
    Range,
    Reader,
};
use serde::Serialize;
use std::{
    fs,
    path::Path,
};

const EXPECTED_WORKBOOK_ID: &str =
    "DMK_COMPLETE_TRACKER";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkbookSheetInspection {
    pub name: String,
    pub rows: usize,
    pub columns: usize,
    pub recognized: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoreSourceInspection {
    pub key: String,
    pub label: String,
    pub sheet_name: Option<String>,
    pub found: bool,
    pub header_cell: Option<String>,
    pub record_count: usize,
    pub detail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MasterWorkbookInspection {
    pub file_name: String,
    pub file_path: String,
    pub extension: String,
    pub file_size_bytes: u64,

    pub workbook_id: Option<String>,
    pub workbook_version: Option<String>,
    pub structure_version: Option<String>,
    pub workbook_type: Option<String>,
    pub metadata_valid: bool,

    pub sheet_count: usize,
    pub core_ready: bool,
    pub ready_for_mapping: bool,

    pub sheets: Vec<WorkbookSheetInspection>,
    pub core_sources: Vec<CoreSourceInspection>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Copy)]
struct HeaderLocation {
    row_index: usize,
    column_index: usize,
}

fn normalize_text(
    value: &str,
) -> String {
    value
        .replace('\u{00A0}', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn display_cell_text(
    cell: &Data,
) -> String {
    match cell {
        Data::Empty => String::new(),
        _ => cell
            .to_string()
            .trim()
            .to_string(),
    }
}

fn normalized_cell_text(
    cell: &Data,
) -> String {
    normalize_text(
        &display_cell_text(
            cell,
        ),
    )
}

fn has_text(
    cell: Option<&Data>,
) -> bool {
    cell
        .map(display_cell_text)
        .map(|value| {
            !value
                .trim()
                .is_empty()
        })
        .unwrap_or(false)
}

fn integer_in_range(
    cell: Option<&Data>,
    minimum: i64,
    maximum: i64,
) -> bool {
    let Some(cell) = cell
    else {
        return false;
    };

    let Some(value) =
        cell.as_f64()
    else {
        return false;
    };

    if !value.is_finite() {
        return false;
    }

    let rounded =
        value.round();

    if (value - rounded)
        .abs()
        > 0.000_001
    {
        return false;
    }

    let integer =
        rounded as i64;

    integer >= minimum &&
        integer <= maximum
}

fn find_header(
    range: &Range<Data>,
    headers: &[&str],
) -> Option<HeaderLocation> {
    if headers.is_empty() {
        return None;
    }

    let normalized_headers =
        headers
            .iter()
            .map(|header| {
                normalize_text(
                    header,
                )
            })
            .collect::<Vec<_>>();

    for (
        row_index,
        row,
    ) in range
        .rows()
        .enumerate()
    {
        if row.len() <
            normalized_headers.len()
        {
            continue;
        }

        let final_start =
            row.len() -
            normalized_headers.len();

        for column_index
            in 0..=final_start
        {
            let matches =
                normalized_headers
                    .iter()
                    .enumerate()
                    .all(
                        |(
                            offset,
                            expected,
                        )| {
                            normalized_cell_text(
                                &row[
                                    column_index +
                                        offset
                                ],
                            ) ==
                                *expected
                        },
                    );

            if matches {
                return Some(
                    HeaderLocation {
                        row_index,
                        column_index,
                    },
                );
            }
        }
    }

    None
}

fn excel_column_name(
    zero_based_column: usize,
) -> String {
    let mut number =
        zero_based_column + 1;

    let mut characters =
        Vec::new();

    while number > 0 {
        let remainder =
            (number - 1) % 26;

        characters.push(
            (
                b'A' +
                remainder as u8
            ) as char,
        );

        number =
            (number - 1) / 26;
    }

    characters
        .iter()
        .rev()
        .collect()
}

fn header_cell_address(
    range: &Range<Data>,
    location: HeaderLocation,
) -> Option<String> {
    let (
        start_row,
        start_column,
    ) = range.start()?;

    let absolute_row =
        start_row as usize +
        location.row_index;

    let absolute_column =
        start_column as usize +
        location.column_index;

    Some(
        format!(
            "{}{}",
            excel_column_name(
                absolute_column,
            ),
            absolute_row + 1,
        ),
    )
}

fn inspect_collections(
    sheet_name: &str,
    range: &Range<Data>,
) -> Option<CoreSourceInspection> {
    let header =
        find_header(
            range,
            &[
                "Name",
                "Initials",
            ],
        )?;

    let record_count =
        range
            .rows()
            .skip(
                header.row_index +
                    1,
            )
            .filter(|row| {
                has_text(
                    row.get(
                        header.column_index,
                    ),
                ) &&
                    has_text(
                        row.get(
                            header.column_index +
                                1,
                        ),
                    )
            })
            .count();

    Some(
        CoreSourceInspection {
            key:
                "collections"
                    .to_string(),

            label:
                "Collections"
                    .to_string(),

            sheet_name:
                Some(
                    sheet_name
                        .to_string(),
                ),

            found: true,

            header_cell:
                header_cell_address(
                    range,
                    header,
                ),

            record_count,

            detail:
                "Detected the Name / Initials collection list."
                    .to_string(),
        },
    )
}

fn inspect_characters(
    sheet_name: &str,
    range: &Range<Data>,
) -> Option<CoreSourceInspection> {
    let header =
        find_header(
            range,
            &[
                "Page",
                "Character Name",
                "Lvl",
            ],
        )?;

    let record_count =
        range
            .rows()
            .skip(
                header.row_index +
                    1,
            )
            .filter(|row| {
                has_text(
                    row.get(
                        header.column_index +
                            1,
                    ),
                ) &&
                    integer_in_range(
                        row.get(
                            header.column_index +
                                2,
                        ),
                        0,
                        10,
                    )
            })
            .count();

    Some(
        CoreSourceInspection {
            key:
                "characters"
                    .to_string(),

            label:
                "Characters"
                    .to_string(),

            sheet_name:
                Some(
                    sheet_name
                        .to_string(),
                ),

            found: true,

            header_cell:
                header_cell_address(
                    range,
                    header,
                ),

            record_count,

            detail:
                "Detected character rows using Character Name and Lvl."
                    .to_string(),
        },
    )
}

fn inspect_tokens(
    sheet_name: &str,
    range: &Range<Data>,
) -> Option<CoreSourceInspection> {
    let header =
        find_header(
            range,
            &[
                "Collection",
                "Character",
                "Token Type",
                "Token Name",
                "Quality",
            ],
        )?;

    let record_count =
        range
            .rows()
            .skip(
                header.row_index +
                    1,
            )
            .filter(|row| {
                has_text(
                    row.get(
                        header.column_index +
                            2,
                    ),
                ) &&
                    has_text(
                        row.get(
                            header.column_index +
                                3,
                        ),
                    )
            })
            .count();

    Some(
        CoreSourceInspection {
            key:
                "tokens"
                    .to_string(),

            label:
                "Tokens & Rarity"
                    .to_string(),

            sheet_name:
                Some(
                    sheet_name
                        .to_string(),
                ),

            found: true,

            header_cell:
                header_cell_address(
                    range,
                    header,
                ),

            record_count,

            detail:
                "Detected Token Type / Token Name / Quality source data."
                    .to_string(),
        },
    )
}

fn inspect_character_levels(
    sheet_name: &str,
    range: &Range<Data>,
) -> Option<CoreSourceInspection> {
    let header =
        find_header(
            range,
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
        )?;

    let record_count =
        range
            .rows()
            .skip(
                header.row_index +
                    1,
            )
            .filter(|row| {
                has_text(
                    row.get(
                        header.column_index,
                    ),
                ) &&
                    has_text(
                        row.get(
                            header.column_index +
                                1,
                        ),
                    ) &&
                    integer_in_range(
                        row.get(
                            header.column_index +
                                2,
                        ),
                        1,
                        10,
                    )
            })
            .count();

    Some(
        CoreSourceInspection {
            key:
                "characterLevels"
                    .to_string(),

            label:
                "Character Levels"
                    .to_string(),

            sheet_name:
                Some(
                    sheet_name
                        .to_string(),
                ),

            found: true,

            header_cell:
                header_cell_address(
                    range,
                    header,
                ),

            record_count,

            detail:
                "Detected Collection / Character / Level requirement rows."
                    .to_string(),
        },
    )
}

fn missing_source(
    key: &str,
    label: &str,
    detail: &str,
) -> CoreSourceInspection {
    CoreSourceInspection {
        key:
            key.to_string(),

        label:
            label.to_string(),

        sheet_name: None,
        found: false,
        header_cell: None,
        record_count: 0,

        detail:
            detail.to_string(),
    }
}

fn find_sheet<'a>(
    worksheets: &'a [
        (
            String,
            Range<Data>,
        )
    ],
    expected_name: &str,
) -> Option<(
    &'a String,
    &'a Range<Data>,
)> {
    let expected =
        normalize_text(
            expected_name,
        );

    worksheets
        .iter()
        .find(
            |(
                sheet_name,
                _,
            )| {
                normalize_text(
                    sheet_name,
                ) ==
                    expected
            },
        )
        .map(
            |(
                sheet_name,
                range,
            )| {
                (
                    sheet_name,
                    range,
                )
            },
        )
}

fn locate_source(
    worksheets: &[
        (
            String,
            Range<Data>,
        )
    ],
    expected_sheet: &str,
    inspector: fn(
        &str,
        &Range<Data>,
    ) -> Option<CoreSourceInspection>,
) -> Option<CoreSourceInspection> {
    if let Some(
        (
            sheet_name,
            range,
        ),
    ) =
        find_sheet(
            worksheets,
            expected_sheet,
        )
    {
        if let Some(
            inspection,
        ) =
            inspector(
                sheet_name,
                range,
            )
        {
            return Some(
                inspection,
            );
        }
    }

    for (
        sheet_name,
        range,
    ) in worksheets.iter()
    {
        if normalize_text(
            sheet_name,
        ) ==
            normalize_text(
                expected_sheet,
            )
        {
            continue;
        }

        if let Some(
            inspection,
        ) =
            inspector(
                sheet_name,
                range,
            )
        {
            return Some(
                inspection,
            );
        }
    }

    None
}

fn metadata_value(
    range: &Range<Data>,
    key: &str,
) -> Option<String> {
    let expected =
        normalize_text(
            key,
        );

    for row in range.rows() {
        for column_index
            in 0..row.len()
        {
            if normalized_cell_text(
                &row[
                    column_index
                ],
            ) != expected
            {
                continue;
            }

            let Some(value_cell) =
                row.get(
                    column_index +
                        1,
                )
            else {
                continue;
            };

            let value =
                display_cell_text(
                    value_cell,
                );

            if !value
                .trim()
                .is_empty()
            {
                return Some(
                    value,
                );
            }
        }
    }

    None
}

fn locate_metadata_sheet<'a>(
    worksheets: &'a [
        (
            String,
            Range<Data>,
        )
    ],
) -> Option<(
    &'a String,
    &'a Range<Data>,
)> {
    if let Some(expected) =
        find_sheet(
            worksheets,
            "Workbook Metadata",
        )
    {
        return Some(
            expected,
        );
    }

    worksheets
        .iter()
        .find(
            |(
                _,
                range,
            )| {
                metadata_value(
                    range,
                    "Workbook ID",
                )
                .is_some()
            },
        )
        .map(
            |(
                sheet_name,
                range,
            )| {
                (
                    sheet_name,
                    range,
                )
            },
        )
}

fn version_from_filename(
    file_name: &str,
) -> Option<String> {
    let characters =
        file_name
            .chars()
            .collect::<Vec<_>>();

    for index
        in 0..characters.len()
    {
        if characters[index] != 'V' &&
            characters[index] != 'v'
        {
            continue;
        }

        let mut digits =
            String::new();

        let mut cursor =
            index + 1;

        while cursor <
            characters.len()
        {
            let character =
                characters[cursor];

            if !character
                .is_ascii_digit()
            {
                break;
            }

            digits.push(
                character,
            );

            cursor += 1;
        }

        if digits.len() >= 3 {
            return Some(
                format!(
                    "V{}",
                    digits,
                ),
            );
        }
    }

    None
}

fn recognized_sheet(
    name: &str,
) -> bool {
    let normalized =
        normalize_text(
            name,
        );

    const KNOWN_SHEETS: &[&str] = &[
        "summary and guide",
        "workbook health check",
        "workbook metadata",
        "change log",
        "full guide",
        "collection completion",
        "characters",
        "characterlevels",
        "bookpages",
        "character send out guide",
        "mvps",
        "costumes",
        "costume unlocks",
        "costume token tracker",
        "costume unlock data",
        "costume token activities",
        "park inventory checklist",
        "attractions",
        "attractionlevelup guide",
        "floats",
        "quest checklist",
        "quest tasks",
        "attractionlevels",
        "relic sources",
        "tokenactivities",
        "tokenearners",
        "characterearners",
        "costumeearners",
        "floatearners",
        "attractionearners",
        "tokensperattractionlevel",
        "tokensearnavailable",
        "tokensearntotals",
        "characterstokentotals",
        "tokentotals",
        "helper",
    ];

    KNOWN_SHEETS.contains(
        &normalized.as_str(),
    )
}

#[tauri::command]
pub fn inspect_master_workbook(
    path: String,
) -> Result<
    MasterWorkbookInspection,
    String,
> {
    let workbook_path =
        Path::new(
            &path,
        );

    if !workbook_path.exists() {
        return Err(
            "The selected workbook no longer exists."
                .to_string(),
        );
    }

    if !workbook_path.is_file() {
        return Err(
            "The selected path is not a file."
                .to_string(),
        );
    }

    let extension =
        workbook_path
            .extension()
            .and_then(
                |value| {
                    value.to_str()
                },
            )
            .unwrap_or("")
            .to_lowercase();

    if extension != "xlsx" &&
        extension != "xlsm"
    {
        return Err(
            "Select an Excel .xlsx or .xlsm workbook."
                .to_string(),
        );
    }

    let file_name =
        workbook_path
            .file_name()
            .and_then(
                |value| {
                    value.to_str()
                },
            )
            .unwrap_or(
                "Selected Workbook",
            )
            .to_string();

    let file_size_bytes =
        fs::metadata(
            workbook_path,
        )
        .map_err(
            |error| {
                format!(
                    "Unable to read workbook file information: {error}"
                )
            },
        )?
        .len();

    let mut workbook =
        open_workbook_auto(
            workbook_path,
        )
        .map_err(
            |error| {
                format!(
                    "Unable to open the selected workbook: {error}"
                )
            },
        )?;

    let sheet_names =
        workbook.sheet_names();

    let sheet_count =
        sheet_names.len();

    let mut warnings =
        Vec::new();

    let mut worksheets:
        Vec<(
            String,
            Range<Data>,
        )> =
        Vec::new();

    let mut sheets =
        Vec::new();

    for sheet_name
        in &sheet_names
    {
        match workbook
            .worksheet_range(
                sheet_name,
            )
        {
            Ok(range) => {
                sheets.push(
                    WorkbookSheetInspection {
                        name:
                            sheet_name
                                .clone(),

                        rows:
                            range.height(),

                        columns:
                            range.width(),

                        recognized:
                            recognized_sheet(
                                sheet_name,
                            ),
                    },
                );

                worksheets.push(
                    (
                        sheet_name
                            .clone(),
                        range,
                    ),
                );
            }

            Err(error) => {
                warnings.push(
                    format!(
                        "Could not read worksheet '{sheet_name}': {error}"
                    ),
                );

                sheets.push(
                    WorkbookSheetInspection {
                        name:
                            sheet_name
                                .clone(),

                        rows: 0,
                        columns: 0,

                        recognized:
                            recognized_sheet(
                                sheet_name,
                            ),
                    },
                );
            }
        }
    }

    let (
        workbook_id,
        metadata_version,
        structure_version,
        workbook_type,
    ) =
        if let Some(
            (
                _,
                metadata_range,
            ),
        ) =
            locate_metadata_sheet(
                &worksheets,
            )
        {
            (
                metadata_value(
                    metadata_range,
                    "Workbook ID",
                ),

                metadata_value(
                    metadata_range,
                    "Workbook Version",
                ),

                metadata_value(
                    metadata_range,
                    "Structure Version",
                ),

                metadata_value(
                    metadata_range,
                    "Workbook Type",
                ),
            )
        } else {
            (
                None,
                None,
                None,
                None,
            )
        };

    let workbook_version =
        metadata_version
            .or_else(
                || {
                    version_from_filename(
                        &file_name,
                    )
                },
            );

    let workbook_id_valid =
        workbook_id
            .as_deref()
            .map(
                |value| {
                    value
                        .trim()
                        .eq_ignore_ascii_case(
                            EXPECTED_WORKBOOK_ID,
                        )
                },
            )
            .unwrap_or(
                false,
            );

    let workbook_type_valid =
        workbook_type
            .as_deref()
            .map(
                |value| {
                    value
                        .trim()
                        .eq_ignore_ascii_case(
                            "Master",
                        )
                },
            )
            .unwrap_or(
                false,
            );

    let metadata_valid =
        workbook_id_valid &&
        workbook_type_valid;

    if workbook_id.is_none() {
        warnings.push(
            "Workbook ID was not found. The importer expects a DMK Master with Workbook Metadata."
                .to_string(),
        );
    } else if !workbook_id_valid {
        warnings.push(
            format!(
                "Workbook ID does not match the expected value '{}'.",
                EXPECTED_WORKBOOK_ID
            ),
        );
    }

    if workbook_type.is_none() {
        warnings.push(
            "Workbook Type was not found in Workbook Metadata."
                .to_string(),
        );
    } else if !workbook_type_valid {
        warnings.push(
            format!(
                "Workbook Type is '{}'. Select the Master workbook for authoring import.",
                workbook_type
                    .as_deref()
                    .unwrap_or(
                        "Unknown",
                    )
            ),
        );
    }

    if structure_version.is_none() {
        warnings.push(
            "Structure Version was not detected."
                .to_string(),
        );
    }

    let collections =
        locate_source(
            &worksheets,
            "Helper",
            inspect_collections,
        )
        .unwrap_or_else(
            || {
                missing_source(
                    "collections",
                    "Collections",
                    "Could not find the Name / Initials collection list.",
                )
            },
        );

    let characters =
        locate_source(
            &worksheets,
            "Characters",
            inspect_characters,
        )
        .unwrap_or_else(
            || {
                missing_source(
                    "characters",
                    "Characters",
                    "Could not find the Page / Character Name / Lvl header.",
                )
            },
        );

    let tokens =
        locate_source(
            &worksheets,
            "Helper",
            inspect_tokens,
        )
        .unwrap_or_else(
            || {
                missing_source(
                    "tokens",
                    "Tokens & Rarity",
                    "Could not find the Collection / Character / Token Type / Token Name / Quality header.",
                )
            },
        );

    let character_levels =
        locate_source(
            &worksheets,
            "CharacterLevels",
            inspect_character_levels,
        )
        .unwrap_or_else(
            || {
                missing_source(
                    "characterLevels",
                    "Character Levels",
                    "Could not find the Collection / Character / Level / Common / Unique / Ears / Magic / Time header.",
                )
            },
        );

    for source in [
        &collections,
        &characters,
        &tokens,
        &character_levels,
    ] {
        if !source.found {
            warnings.push(
                format!(
                    "{} source data was not detected.",
                    source.label
                ),
            );
        } else if source.record_count == 0 {
            warnings.push(
                format!(
                    "{} was detected but no candidate records were counted.",
                    source.label
                ),
            );
        }
    }

    let core_ready = [
        &collections,
        &characters,
        &tokens,
        &character_levels,
    ]
    .iter()
    .all(
        |source| {
            source.found &&
                source.record_count > 0
        },
    );

    let ready_for_mapping =
        metadata_valid &&
        core_ready;

    Ok(
        MasterWorkbookInspection {
            file_name,

            file_path:
                workbook_path
                    .to_string_lossy()
                    .to_string(),

            extension,

            file_size_bytes,

            workbook_id,

            workbook_version,

            structure_version,

            workbook_type,

            metadata_valid,

            sheet_count,

            core_ready,

            ready_for_mapping,

            sheets,

            core_sources:
                vec![
                    collections,
                    characters,
                    tokens,
                    character_levels,
                ],

            warnings,
        },
    )
}