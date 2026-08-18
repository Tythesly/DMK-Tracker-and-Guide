mod editor_commands;
mod master_import;
mod master_import_plan;
mod master_import_value_plan;

use tauri_plugin_sql::{
    Migration,
    MigrationKind,
};

fn editor_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_editor_schema",
            sql: include_str!(
                "../migrations/001_editor_initial.sql"
            ),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(
    mobile,
    tauri::mobile_entry_point
)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(
            tauri::generate_handler![
                editor_commands::create_character_with_sort,
                editor_commands::update_character_with_sort,
                editor_commands::save_character_level,
                master_import::inspect_master_workbook,
                master_import_plan::build_master_import_identity_plan,
                master_import_value_plan::build_master_import_value_plan,
            ],
        )
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:dmk-editor.db",
                    editor_migrations(),
                )
                .build(),
        )
        .plugin(
            tauri_plugin_dialog::init(),
        )
        .plugin(
            tauri_plugin_opener::init(),
        )
        .run(
            tauri::generate_context!(),
        )
        .expect(
            "error while running DMK Data Manager",
        );
}