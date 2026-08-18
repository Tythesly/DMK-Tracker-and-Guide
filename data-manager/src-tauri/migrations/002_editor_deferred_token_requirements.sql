PRAGMA foreign_keys = ON;

CREATE TABLE character_level_deferred_token_requirements (
    character_id TEXT NOT NULL,
    target_level INTEGER NOT NULL,

    token_type TEXT NOT NULL
        CHECK (
            token_type IN (
                'Shared Token',
                'Unique Token',
                'Ears Token'
            )
        ),

    associated_collection_id TEXT NOT NULL,
    associated_character_id TEXT,

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    source_cell TEXT,
    first_seen_data_version TEXT,
    last_seen_data_version TEXT,

    PRIMARY KEY (
        character_id,
        target_level,
        token_type
    ),

    FOREIGN KEY (
        character_id,
        target_level
    )
        REFERENCES character_levels (
            character_id,
            target_level
        )
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

    FOREIGN KEY (associated_collection_id)
        REFERENCES collections(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    FOREIGN KEY (associated_character_id)
        REFERENCES characters(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CHECK (
        (
            token_type = 'Shared Token'
            AND associated_character_id IS NULL
        )
        OR
        (
            token_type IN (
                'Unique Token',
                'Ears Token'
            )
            AND associated_character_id = character_id
        )
    )
);

CREATE INDEX idx_deferred_token_requirements_scope
    ON character_level_deferred_token_requirements (
        associated_collection_id,
        associated_character_id,
        token_type
    );

UPDATE metadata
SET value = '0.2'
WHERE key = 'schema_version';