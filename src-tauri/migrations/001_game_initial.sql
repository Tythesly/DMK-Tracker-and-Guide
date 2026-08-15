CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO metadata (key, value)
VALUES ('schema_version', '0.1');


CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_limited_time INTEGER NOT NULL DEFAULT 0
        CHECK (is_limited_time IN (0, 1)),
    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),
    notes TEXT
);


CREATE TABLE characters (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    max_level INTEGER NOT NULL
        CHECK (max_level > 0),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_premium INTEGER NOT NULL DEFAULT 0
        CHECK (is_premium IN (0, 1)),
    is_limited_time INTEGER NOT NULL DEFAULT 0
        CHECK (is_limited_time IN (0, 1)),
    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),
    notes TEXT,

    FOREIGN KEY (collection_id)
        REFERENCES collections(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
);

CREATE INDEX idx_characters_collection_id
    ON characters(collection_id);


CREATE TABLE tokens (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    token_type TEXT NOT NULL,
    associated_character_id TEXT,
    associated_collection_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),
    notes TEXT,

    FOREIGN KEY (associated_character_id)
        REFERENCES characters(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    FOREIGN KEY (associated_collection_id)
        REFERENCES collections(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
);

CREATE INDEX idx_tokens_associated_character_id
    ON tokens(associated_character_id);

CREATE INDEX idx_tokens_associated_collection_id
    ON tokens(associated_collection_id);


CREATE TABLE character_levels (
    character_id TEXT NOT NULL,
    target_level INTEGER NOT NULL
        CHECK (target_level > 0),
    magic_cost INTEGER
        CHECK (magic_cost IS NULL OR magic_cost >= 0),
    level_time_seconds INTEGER
        CHECK (level_time_seconds IS NULL OR level_time_seconds >= 0),

    PRIMARY KEY (
        character_id,
        target_level
    ),

    FOREIGN KEY (character_id)
        REFERENCES characters(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
);


CREATE TABLE character_level_token_requirements (
    character_id TEXT NOT NULL,
    target_level INTEGER NOT NULL,
    token_id TEXT NOT NULL,
    quantity INTEGER NOT NULL
        CHECK (quantity >= 0),

    PRIMARY KEY (
        character_id,
        target_level,
        token_id
    ),

    FOREIGN KEY (
        character_id,
        target_level
    )
        REFERENCES character_levels(
            character_id,
            target_level
        )
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

    FOREIGN KEY (token_id)
        REFERENCES tokens(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
);

CREATE INDEX idx_character_level_token_requirements_token_id
    ON character_level_token_requirements(token_id);


CREATE TABLE aliases (
    record_type TEXT NOT NULL,
    alias_text TEXT NOT NULL,
    target_id TEXT NOT NULL,
    first_supported_data_version TEXT,
    notes TEXT,

    PRIMARY KEY (
        record_type,
        alias_text
    )
);