use tauri_plugin_sql::{Migration, MigrationKind};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn game_data_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_game_schema_v0_1",
            sql: include_str!("../migrations/001_game_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed_mickey_development_data",
            sql: include_str!("../migrations/002_game_dev_seed_mickey.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

fn player_data_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create_player_schema_v0_1",
        sql: include_str!("../migrations/001_player_initial.sql"),
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:dmk-data.db", game_data_migrations())
                .add_migrations("sqlite:dmk-player.db", player_data_migrations())
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}