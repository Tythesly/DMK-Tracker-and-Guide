use serde::Deserialize;
use sqlx::{
    sqlite::SqliteConnectOptions,
    Connection,
    SqliteConnection,
};
use std::time::Duration;
use tauri::{AppHandle, Manager};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttractionWriteInput {
    pub id: String,
    pub group_id: String,
    pub display_name: String,
    pub sort_order: i64,
    pub max_enchantment_level: i64,
    pub relic_collection_id: Option<String>,
    pub obtain_source_text: Option<String>,
    pub obtain_magic_cost: Option<i64>,
    pub obtain_elixir_cost: Option<i64>,
    pub obtain_gem_cost: Option<i64>,
    pub requirement_type: Option<String>,
    pub unlock_quest_source_name: Option<String>,
    pub required_character_id: Option<String>,
    pub required_character_level: Option<i64>,
    pub build_quest_source_name: Option<String>,
    pub other_requirement_text: Option<String>,
    pub is_active: bool,
    pub notes: Option<String>,
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
        .busy_timeout(
            Duration::from_secs(5),
        );

    SqliteConnection::connect_with(
        &options,
    )
    .await
    .map_err(|error| {
        format!(
            "Unable to open dmk-editor.db: {error}"
        )
    })
}

fn trimmed_optional(
    value: &Option<String>,
) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| {
            !value.is_empty()
        })
        .map(str::to_string)
}

fn validate_input(
    input: &AttractionWriteInput,
) -> Result<(), String> {
    if input.id.trim().is_empty() {
        return Err(
            "Attraction Stable ID is required."
                .to_string(),
        );
    }

    if input.group_id.trim().is_empty() {
        return Err(
            "Attraction Group is required."
                .to_string(),
        );
    }

    if input.display_name.trim().is_empty() {
        return Err(
            "Display Name is required."
                .to_string(),
        );
    }

    if input.sort_order < 0 {
        return Err(
            "Sort Order must be 0 or greater."
                .to_string(),
        );
    }

    if input.max_enchantment_level != 0
        && input.max_enchantment_level != 5
    {
        return Err(
            "Attractions must either be non-enchantable or use the standard maximum enchantment level of 5."
                .to_string(),
        );
    }

    for (label, value) in [
        ("Magic Cost", input.obtain_magic_cost),
        ("Elixir Cost", input.obtain_elixir_cost),
        ("Gem Cost", input.obtain_gem_cost),
    ] {
        if value.is_some_and(|value| value < 0) {
            return Err(
                format!(
                    "{label} cannot be negative."
                ),
            );
        }
    }

    if let Some(level) =
        input.required_character_level
    {
        if !(1..=10).contains(&level) {
            return Err(
                "Required Character Level must be between 1 and 10."
                    .to_string(),
            );
        }

        if trimmed_optional(
            &input.required_character_id,
        )
        .is_none()
        {
            return Err(
                "Select a Required Character before setting a Required Character Level."
                    .to_string(),
            );
        }
    }

    if let Some(requirement_type) =
        trimmed_optional(
            &input.requirement_type,
        )
    {
        const ALLOWED: &[&str] = &[
            "None",
            "Quest",
            "Character Level",
            "Quest + Character Level",
            "Other",
        ];

        if !ALLOWED.contains(
            &requirement_type.as_str(),
        ) {
            return Err(
                "Requirement Type is not recognized."
                    .to_string(),
            );
        }
    }

    Ok(())
}

async fn verify_references(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    input: &AttractionWriteInput,
) -> Result<(), String> {
    let group_count =
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM attraction_groups WHERE id = ?",
        )
        .bind(input.group_id.trim())
        .fetch_one(&mut **transaction)
        .await
        .map_err(|error| {
            format!(
                "Unable to verify the selected Attraction Group: {error}"
            )
        })?;

    if group_count == 0 {
        return Err(
            "The selected Attraction Group no longer exists."
                .to_string(),
        );
    }

    if let Some(collection_id) =
        trimmed_optional(
            &input.relic_collection_id,
        )
    {
        let count =
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM collections WHERE id = ?",
            )
            .bind(&collection_id)
            .fetch_one(&mut **transaction)
            .await
            .map_err(|error| {
                format!(
                    "Unable to verify the Relic Collection: {error}"
                )
            })?;

        if count == 0 {
            return Err(
                "The selected Relic Collection no longer exists."
                    .to_string(),
            );
        }
    }

    if let Some(character_id) =
        trimmed_optional(
            &input.required_character_id,
        )
    {
        let count =
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM characters WHERE id = ?",
            )
            .bind(&character_id)
            .fetch_one(&mut **transaction)
            .await
            .map_err(|error| {
                format!(
                    "Unable to verify the Required Character: {error}"
                )
            })?;

        if count == 0 {
            return Err(
                "The selected Required Character no longer exists."
                    .to_string(),
            );
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn create_attraction_with_sort(
    app: AppHandle,
    input: AttractionWriteInput,
) -> Result<(), String> {
    validate_input(&input)?;

    let mut connection =
        open_editor_connection(&app).await?;

    let mut transaction =
        connection.begin().await.map_err(
            |error| {
                format!(
                    "Unable to start the attraction save transaction: {error}"
                )
            },
        )?;

    verify_references(
        &mut transaction,
        &input,
    )
    .await?;

    let id_count =
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM attractions WHERE id = ?",
        )
        .bind(input.id.trim())
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| {
            format!(
                "Unable to verify the Attraction Stable ID: {error}"
            )
        })?;

    if id_count > 0 {
        let _ = transaction.rollback().await;
        return Err(
            "An attraction with this Stable ID already exists."
                .to_string(),
        );
    }

    let duplicate_count =
        sqlx::query_scalar::<_, i64>(
            "
            SELECT COUNT(*)
            FROM attractions
            WHERE
                group_id = ?
                AND lower(trim(display_name)) = lower(trim(?))
            ",
        )
        .bind(input.group_id.trim())
        .bind(input.display_name.trim())
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| {
            format!(
                "Unable to check for duplicate attractions: {error}"
            )
        })?;

    if duplicate_count > 0 {
        let _ = transaction.rollback().await;
        return Err(
            "An attraction with this display name already exists in the selected group."
                .to_string(),
        );
    }

    let group_count =
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM attractions WHERE group_id = ?",
        )
        .bind(input.group_id.trim())
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| {
            format!(
                "Unable to determine the Attraction Sort Order: {error}"
            )
        })?;

    let final_sort_order =
        input.sort_order.min(group_count);

    sqlx::query(
        "
        UPDATE attractions
        SET sort_order = sort_order + 1
        WHERE
            group_id = ?
            AND sort_order >= ?
        ",
    )
    .bind(input.group_id.trim())
    .bind(final_sort_order)
    .execute(&mut *transaction)
    .await
    .map_err(|error| {
        format!(
            "Unable to make room for the Attraction Sort Order: {error}"
        )
    })?;

    let relic_collection_id =
        trimmed_optional(
            &input.relic_collection_id,
        );
    let obtain_source_text =
        trimmed_optional(
            &input.obtain_source_text,
        );
    let requirement_type =
        trimmed_optional(
            &input.requirement_type,
        );
    let unlock_quest_source_name =
        trimmed_optional(
            &input.unlock_quest_source_name,
        );
    let required_character_id =
        trimmed_optional(
            &input.required_character_id,
        );
    let build_quest_source_name =
        trimmed_optional(
            &input.build_quest_source_name,
        );
    let other_requirement_text =
        trimmed_optional(
            &input.other_requirement_text,
        );
    let notes =
        trimmed_optional(&input.notes);

    sqlx::query(
        "
        INSERT INTO attractions (
            id,
            group_id,
            display_name,
            sort_order,
            max_enchantment_level,
            relic_collection_id,
            obtain_source_text,
            obtain_magic_cost,
            obtain_elixir_cost,
            obtain_gem_cost,
            requirement_type,
            unlock_quest_source_name,
            required_character_id,
            required_character_level,
            build_quest_source_name,
            other_requirement_text,
            is_active,
            notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ",
    )
    .bind(input.id.trim())
    .bind(input.group_id.trim())
    .bind(input.display_name.trim())
    .bind(final_sort_order)
    .bind(input.max_enchantment_level)
    .bind(relic_collection_id)
    .bind(obtain_source_text)
    .bind(input.obtain_magic_cost)
    .bind(input.obtain_elixir_cost)
    .bind(input.obtain_gem_cost)
    .bind(requirement_type)
    .bind(unlock_quest_source_name)
    .bind(required_character_id)
    .bind(input.required_character_level)
    .bind(build_quest_source_name)
    .bind(other_requirement_text)
    .bind(if input.is_active { 1 } else { 0 })
    .bind(notes)
    .execute(&mut *transaction)
    .await
    .map_err(|error| {
        format!(
            "Unable to create the attraction: {error}"
        )
    })?;

    transaction.commit().await.map_err(
        |error| {
            format!(
                "Unable to commit the attraction save: {error}"
            )
        },
    )?;

    Ok(())
}

#[tauri::command]
pub async fn update_attraction_with_sort(
    app: AppHandle,
    input: AttractionWriteInput,
) -> Result<(), String> {
    validate_input(&input)?;

    let mut connection =
        open_editor_connection(&app).await?;

    let mut transaction =
        connection.begin().await.map_err(
            |error| {
                format!(
                    "Unable to start the attraction update transaction: {error}"
                )
            },
        )?;

    let existing: Option<(String, i64)> =
        sqlx::query_as(
            "
            SELECT group_id, sort_order
            FROM attractions
            WHERE id = ?
            LIMIT 1
            ",
        )
        .bind(input.id.trim())
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| {
            format!(
                "Unable to load the existing attraction position: {error}"
            )
        })?;

    let Some((old_group_id, old_sort_order)) =
        existing
    else {
        let _ = transaction.rollback().await;
        return Err(
            "The attraction could not be updated because its record was not found."
                .to_string(),
        );
    };

    verify_references(
        &mut transaction,
        &input,
    )
    .await?;

    let duplicate_count =
        sqlx::query_scalar::<_, i64>(
            "
            SELECT COUNT(*)
            FROM attractions
            WHERE
                group_id = ?
                AND lower(trim(display_name)) = lower(trim(?))
                AND id <> ?
            ",
        )
        .bind(input.group_id.trim())
        .bind(input.display_name.trim())
        .bind(input.id.trim())
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| {
            format!(
                "Unable to check for duplicate attractions: {error}"
            )
        })?;

    if duplicate_count > 0 {
        let _ = transaction.rollback().await;
        return Err(
            "An attraction with this display name already exists in the selected group."
                .to_string(),
        );
    }

    let new_group_id =
        input.group_id.trim();

    let final_sort_order =
        if old_group_id == new_group_id {
            let group_count =
                sqlx::query_scalar::<_, i64>(
                    "SELECT COUNT(*) FROM attractions WHERE group_id = ?",
                )
                .bind(new_group_id)
                .fetch_one(&mut *transaction)
                .await
                .map_err(|error| {
                    format!(
                        "Unable to determine the Attraction Sort Order: {error}"
                    )
                })?;

            let max_sort_order =
                (group_count - 1).max(0);

            let final_sort =
                input.sort_order.min(
                    max_sort_order,
                );

            if final_sort < old_sort_order {
                sqlx::query(
                    "
                    UPDATE attractions
                    SET sort_order = sort_order + 1
                    WHERE
                        group_id = ?
                        AND id <> ?
                        AND sort_order >= ?
                        AND sort_order < ?
                    ",
                )
                .bind(new_group_id)
                .bind(input.id.trim())
                .bind(final_sort)
                .bind(old_sort_order)
                .execute(&mut *transaction)
                .await
                .map_err(|error| {
                    format!(
                        "Unable to shift Attraction Sort Orders: {error}"
                    )
                })?;
            } else if final_sort > old_sort_order {
                sqlx::query(
                    "
                    UPDATE attractions
                    SET sort_order = sort_order - 1
                    WHERE
                        group_id = ?
                        AND id <> ?
                        AND sort_order > ?
                        AND sort_order <= ?
                    ",
                )
                .bind(new_group_id)
                .bind(input.id.trim())
                .bind(old_sort_order)
                .bind(final_sort)
                .execute(&mut *transaction)
                .await
                .map_err(|error| {
                    format!(
                        "Unable to shift Attraction Sort Orders: {error}"
                    )
                })?;
            }

            final_sort
        } else {
            sqlx::query(
                "
                UPDATE attractions
                SET sort_order = sort_order - 1
                WHERE
                    group_id = ?
                    AND sort_order > ?
                ",
            )
            .bind(&old_group_id)
            .bind(old_sort_order)
            .execute(&mut *transaction)
            .await
            .map_err(|error| {
                format!(
                    "Unable to close the old Attraction Sort Order gap: {error}"
                )
            })?;

            let new_group_count =
                sqlx::query_scalar::<_, i64>(
                    "SELECT COUNT(*) FROM attractions WHERE group_id = ?",
                )
                .bind(new_group_id)
                .fetch_one(&mut *transaction)
                .await
                .map_err(|error| {
                    format!(
                        "Unable to determine the new Attraction Sort Order: {error}"
                    )
                })?;

            let final_sort =
                input.sort_order.min(
                    new_group_count,
                );

            sqlx::query(
                "
                UPDATE attractions
                SET sort_order = sort_order + 1
                WHERE
                    group_id = ?
                    AND sort_order >= ?
                ",
            )
            .bind(new_group_id)
            .bind(final_sort)
            .execute(&mut *transaction)
            .await
            .map_err(|error| {
                format!(
                    "Unable to make room in the new Attraction Group: {error}"
                )
            })?;

            final_sort
        };

    let relic_collection_id =
        trimmed_optional(
            &input.relic_collection_id,
        );
    let obtain_source_text =
        trimmed_optional(
            &input.obtain_source_text,
        );
    let requirement_type =
        trimmed_optional(
            &input.requirement_type,
        );
    let unlock_quest_source_name =
        trimmed_optional(
            &input.unlock_quest_source_name,
        );
    let required_character_id =
        trimmed_optional(
            &input.required_character_id,
        );
    let build_quest_source_name =
        trimmed_optional(
            &input.build_quest_source_name,
        );
    let other_requirement_text =
        trimmed_optional(
            &input.other_requirement_text,
        );
    let notes =
        trimmed_optional(&input.notes);

    sqlx::query(
        "
        UPDATE attractions
        SET
            group_id = ?,
            display_name = ?,
            sort_order = ?,
            max_enchantment_level = ?,
            relic_collection_id = ?,
            obtain_source_text = ?,
            obtain_magic_cost = ?,
            obtain_elixir_cost = ?,
            obtain_gem_cost = ?,
            requirement_type = ?,
            unlock_quest_source_name = ?,
            required_character_id = ?,
            required_character_level = ?,
            build_quest_source_name = ?,
            other_requirement_text = ?,
            is_active = ?,
            notes = ?
        WHERE id = ?
        ",
    )
    .bind(new_group_id)
    .bind(input.display_name.trim())
    .bind(final_sort_order)
    .bind(input.max_enchantment_level)
    .bind(relic_collection_id)
    .bind(obtain_source_text)
    .bind(input.obtain_magic_cost)
    .bind(input.obtain_elixir_cost)
    .bind(input.obtain_gem_cost)
    .bind(requirement_type)
    .bind(unlock_quest_source_name)
    .bind(required_character_id)
    .bind(input.required_character_level)
    .bind(build_quest_source_name)
    .bind(other_requirement_text)
    .bind(if input.is_active { 1 } else { 0 })
    .bind(notes)
    .bind(input.id.trim())
    .execute(&mut *transaction)
    .await
    .map_err(|error| {
        format!(
            "Unable to update the attraction: {error}"
        )
    })?;

    transaction.commit().await.map_err(
        |error| {
            format!(
                "Unable to commit the attraction update: {error}"
            )
        },
    )?;

    Ok(())
}