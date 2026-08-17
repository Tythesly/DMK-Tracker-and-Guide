use serde::Deserialize;
use sqlx::{
    sqlite::SqliteConnectOptions,
    Connection,
    SqliteConnection,
};
use std::time::Duration;
use tauri::{
    AppHandle,
    Manager,
};

const CHARACTER_MAX_LEVEL: i64 = 10;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterWriteInput {
    pub id: String,
    pub collection_id: String,
    pub display_name: String,
    pub sort_order: i64,
    pub is_premium: bool,
    pub is_limited_time: bool,
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

fn validate_character_input(
    input: &CharacterWriteInput,
) -> Result<(), String> {
    if input.id.trim().is_empty() {
        return Err(
            "Character Stable ID is required."
                .to_string(),
        );
    }

    if input
        .collection_id
        .trim()
        .is_empty()
    {
        return Err(
            "Collection is required."
                .to_string(),
        );
    }

    if input
        .display_name
        .trim()
        .is_empty()
    {
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

    Ok(())
}

async fn collection_exists(
    connection: &mut SqliteConnection,
    collection_id: &str,
) -> Result<bool, String> {
    let count =
        sqlx::query_scalar::<_, i64>(
            "
            SELECT COUNT(*)
            FROM collections
            WHERE id = ?
            ",
        )
        .bind(collection_id)
        .fetch_one(connection)
        .await
        .map_err(|error| {
            format!(
                "Unable to verify the selected collection: {error}"
            )
        })?;

    Ok(count > 0)
}

#[tauri::command]
pub async fn create_character_with_sort(
    app: AppHandle,
    input: CharacterWriteInput,
) -> Result<(), String> {
    validate_character_input(
        &input,
    )?;

    let mut connection =
        open_editor_connection(
            &app,
        )
        .await?;

    let mut transaction =
        connection
            .begin()
            .await
            .map_err(|error| {
                format!(
                    "Unable to start the character save transaction: {error}"
                )
            })?;

    let collection_count =
        sqlx::query_scalar::<_, i64>(
            "
            SELECT COUNT(*)
            FROM collections
            WHERE id = ?
            ",
        )
        .bind(
            input.collection_id.trim(),
        )
        .fetch_one(
            &mut *transaction,
        )
        .await
        .map_err(|error| {
            format!(
                "Unable to verify the selected collection: {error}"
            )
        })?;

    if collection_count == 0 {
        return Err(
            "The selected collection no longer exists."
                .to_string(),
        );
    }

    let id_count =
        sqlx::query_scalar::<_, i64>(
            "
            SELECT COUNT(*)
            FROM characters
            WHERE id = ?
            ",
        )
        .bind(input.id.trim())
        .fetch_one(
            &mut *transaction,
        )
        .await
        .map_err(|error| {
            format!(
                "Unable to verify the character Stable ID: {error}"
            )
        })?;

    if id_count > 0 {
        return Err(
            "A character with this Stable ID already exists."
                .to_string(),
        );
    }

    let duplicate_name_count =
        sqlx::query_scalar::<_, i64>(
            "
            SELECT COUNT(*)
            FROM characters
            WHERE
                collection_id = ?
                AND lower(
                    trim(display_name)
                ) = lower(trim(?))
            ",
        )
        .bind(
            input.collection_id.trim(),
        )
        .bind(
            input.display_name.trim(),
        )
        .fetch_one(
            &mut *transaction,
        )
        .await
        .map_err(|error| {
            format!(
                "Unable to validate the character name: {error}"
            )
        })?;

    if duplicate_name_count > 0 {
        return Err(
            "A character with this display name already exists in the selected collection."
                .to_string(),
        );
    }

    let character_count =
        sqlx::query_scalar::<_, i64>(
            "
            SELECT COUNT(*)
            FROM characters
            WHERE collection_id = ?
            ",
        )
        .bind(
            input.collection_id.trim(),
        )
        .fetch_one(
            &mut *transaction,
        )
        .await
        .map_err(|error| {
            format!(
                "Unable to determine the collection character count: {error}"
            )
        })?;

    let final_sort_order =
        input
            .sort_order
            .clamp(
                0,
                character_count,
            );

    sqlx::query(
        "
        UPDATE characters
        SET
            sort_order =
                sort_order + 1
        WHERE
            collection_id = ?
            AND sort_order >= ?
        ",
    )
    .bind(
        input.collection_id.trim(),
    )
    .bind(final_sort_order)
    .execute(
        &mut *transaction,
    )
    .await
    .map_err(|error| {
        format!(
            "Unable to make room for the new character: {error}"
        )
    })?;

    let notes = input
        .notes
        .as_deref()
        .map(str::trim)
        .filter(
            |value| !value.is_empty(),
        );

    sqlx::query(
        "
        INSERT INTO characters (
            id,
            collection_id,
            display_name,
            max_level,
            sort_order,
            is_premium,
            is_limited_time,
            is_active,
            notes
        )
        VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
        )
        ",
    )
    .bind(input.id.trim())
    .bind(
        input.collection_id.trim(),
    )
    .bind(
        input.display_name.trim(),
    )
    .bind(CHARACTER_MAX_LEVEL)
    .bind(final_sort_order)
    .bind(
        if input.is_premium {
            1
        } else {
            0
        },
    )
    .bind(
        if input.is_limited_time {
            1
        } else {
            0
        },
    )
    .bind(
        if input.is_active {
            1
        } else {
            0
        },
    )
    .bind(notes)
    .execute(
        &mut *transaction,
    )
    .await
    .map_err(|error| {
        format!(
            "Unable to create the character: {error}"
        )
    })?;

    transaction
        .commit()
        .await
        .map_err(|error| {
            format!(
                "Unable to commit the character save: {error}"
            )
        })?;

    Ok(())
}

#[tauri::command]
pub async fn update_character_with_sort(
    app: AppHandle,
    input: CharacterWriteInput,
) -> Result<(), String> {
    validate_character_input(
        &input,
    )?;

    let mut connection =
        open_editor_connection(
            &app,
        )
        .await?;

    let mut transaction =
        connection
            .begin()
            .await
            .map_err(|error| {
                format!(
                    "Unable to start the character update transaction: {error}"
                )
            })?;

    let existing:
        Option<(String, i64)> =
        sqlx::query_as(
            "
            SELECT
                collection_id,
                sort_order
            FROM characters
            WHERE id = ?
            LIMIT 1
            ",
        )
        .bind(input.id.trim())
        .fetch_optional(
            &mut *transaction,
        )
        .await
        .map_err(|error| {
            format!(
                "Unable to load the existing character position: {error}"
            )
        })?;

    let Some((
        old_collection_id,
        old_sort_order,
    )) = existing
    else {
        return Err(
            "The character could not be updated because its record was not found."
                .to_string(),
        );
    };

    let collection_count =
        sqlx::query_scalar::<_, i64>(
            "
            SELECT COUNT(*)
            FROM collections
            WHERE id = ?
            ",
        )
        .bind(
            input.collection_id.trim(),
        )
        .fetch_one(
            &mut *transaction,
        )
        .await
        .map_err(|error| {
            format!(
                "Unable to verify the selected collection: {error}"
            )
        })?;

    if collection_count == 0 {
        return Err(
            "The selected collection no longer exists."
                .to_string(),
        );
    }

    let duplicate_name_count =
        sqlx::query_scalar::<_, i64>(
            "
            SELECT COUNT(*)
            FROM characters
            WHERE
                collection_id = ?
                AND lower(
                    trim(display_name)
                ) = lower(trim(?))
                AND id <> ?
            ",
        )
        .bind(
            input.collection_id.trim(),
        )
        .bind(
            input.display_name.trim(),
        )
        .bind(input.id.trim())
        .fetch_one(
            &mut *transaction,
        )
        .await
        .map_err(|error| {
            format!(
                "Unable to validate the character name: {error}"
            )
        })?;

    if duplicate_name_count > 0 {
        return Err(
            "A character with this display name already exists in the selected collection."
                .to_string(),
        );
    }

    let target_character_count =
        sqlx::query_scalar::<_, i64>(
            "
            SELECT COUNT(*)
            FROM characters
            WHERE
                collection_id = ?
                AND id <> ?
            ",
        )
        .bind(
            input.collection_id.trim(),
        )
        .bind(input.id.trim())
        .fetch_one(
            &mut *transaction,
        )
        .await
        .map_err(|error| {
            format!(
                "Unable to determine the target collection character count: {error}"
            )
        })?;

    let final_sort_order =
        input
            .sort_order
            .clamp(
                0,
                target_character_count,
            );

    if old_collection_id
        == input.collection_id
    {
        if final_sort_order
            < old_sort_order
        {
            sqlx::query(
                "
                UPDATE characters
                SET
                    sort_order =
                        sort_order + 1
                WHERE
                    collection_id = ?
                    AND id <> ?
                    AND sort_order >= ?
                    AND sort_order < ?
                ",
            )
            .bind(
                input.collection_id.trim(),
            )
            .bind(input.id.trim())
            .bind(final_sort_order)
            .bind(old_sort_order)
            .execute(
                &mut *transaction,
            )
            .await
            .map_err(|error| {
                format!(
                    "Unable to shift characters down: {error}"
                )
            })?;
        } else if final_sort_order
            > old_sort_order
        {
            sqlx::query(
                "
                UPDATE characters
                SET
                    sort_order =
                        sort_order - 1
                WHERE
                    collection_id = ?
                    AND id <> ?
                    AND sort_order > ?
                    AND sort_order <= ?
                ",
            )
            .bind(
                input.collection_id.trim(),
            )
            .bind(input.id.trim())
            .bind(old_sort_order)
            .bind(final_sort_order)
            .execute(
                &mut *transaction,
            )
            .await
            .map_err(|error| {
                format!(
                    "Unable to shift characters up: {error}"
                )
            })?;
        }
    } else {
        sqlx::query(
            "
            UPDATE characters
            SET
                sort_order =
                    sort_order - 1
            WHERE
                collection_id = ?
                AND sort_order > ?
            ",
        )
        .bind(
            old_collection_id,
        )
        .bind(old_sort_order)
        .execute(
            &mut *transaction,
        )
        .await
        .map_err(|error| {
            format!(
                "Unable to close the character's old sort position: {error}"
            )
        })?;

        sqlx::query(
            "
            UPDATE characters
            SET
                sort_order =
                    sort_order + 1
            WHERE
                collection_id = ?
                AND sort_order >= ?
            ",
        )
        .bind(
            input.collection_id.trim(),
        )
        .bind(final_sort_order)
        .execute(
            &mut *transaction,
        )
        .await
        .map_err(|error| {
            format!(
                "Unable to open the character's new sort position: {error}"
            )
        })?;
    }

    let notes = input
        .notes
        .as_deref()
        .map(str::trim)
        .filter(
            |value| !value.is_empty(),
        );

    sqlx::query(
        "
        UPDATE characters
        SET
            collection_id = ?,
            display_name = ?,
            max_level = ?,
            sort_order = ?,
            is_premium = ?,
            is_limited_time = ?,
            is_active = ?,
            notes = ?
        WHERE id = ?
        ",
    )
    .bind(
        input.collection_id.trim(),
    )
    .bind(
        input.display_name.trim(),
    )
    .bind(CHARACTER_MAX_LEVEL)
    .bind(final_sort_order)
    .bind(
        if input.is_premium {
            1
        } else {
            0
        },
    )
    .bind(
        if input.is_limited_time {
            1
        } else {
            0
        },
    )
    .bind(
        if input.is_active {
            1
        } else {
            0
        },
    )
    .bind(notes)
    .bind(input.id.trim())
    .execute(
        &mut *transaction,
    )
    .await
    .map_err(|error| {
        format!(
            "Unable to update the character: {error}"
        )
    })?;

    transaction
        .commit()
        .await
        .map_err(|error| {
            format!(
                "Unable to commit the character update: {error}"
            )
        })?;

    Ok(())
}