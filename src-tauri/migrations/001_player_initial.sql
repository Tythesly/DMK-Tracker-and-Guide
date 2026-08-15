CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO metadata (key, value)
VALUES ('schema_version', '0.1');


CREATE TABLE character_progress (
    character_id TEXT PRIMARY KEY,

    is_unlocked INTEGER NOT NULL DEFAULT 0
        CHECK (is_unlocked IN (0, 1)),

    current_level INTEGER NOT NULL DEFAULT 0
        CHECK (current_level >= 0),

    is_favorite INTEGER NOT NULL DEFAULT 0
        CHECK (is_favorite IN (0, 1)),

    priority INTEGER NOT NULL DEFAULT 0,

    notes TEXT,

    updated_at TEXT NOT NULL
);


CREATE TABLE token_inventory (
    token_id TEXT PRIMARY KEY,

    quantity INTEGER NOT NULL DEFAULT 0
        CHECK (quantity >= 0),

    updated_at TEXT NOT NULL
);