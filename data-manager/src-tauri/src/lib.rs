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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:dmk-editor.db",
                    editor_migrations(),
                )
                .build(),
        )
        .plugin(
            tauri_plugin_opener::init(),
        )
        .run(tauri::generate_context!())
        .expect(
            "error while running DMK Data Manager",
        );
}