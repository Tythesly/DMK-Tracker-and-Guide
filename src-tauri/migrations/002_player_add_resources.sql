CREATE TABLE player_resources (
    resource_id TEXT PRIMARY KEY,

    quantity INTEGER NOT NULL DEFAULT 0
        CHECK (quantity >= 0),

    updated_at TEXT NOT NULL
);

INSERT INTO metadata (key, value)
VALUES ('schema_version', '0.2')
ON CONFLICT(key) DO UPDATE SET
    value = excluded.value;