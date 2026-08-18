PRAGMA foreign_keys = ON;

CREATE TABLE attraction_groups (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    collection_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
        CHECK (sort_order >= 0),
    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),
    notes TEXT,

    FOREIGN KEY (collection_id)
        REFERENCES collections(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
);

CREATE UNIQUE INDEX idx_attraction_groups_display_name
    ON attraction_groups(
        lower(trim(display_name))
    );

CREATE INDEX idx_attraction_groups_collection_id
    ON attraction_groups(collection_id);

CREATE TABLE attractions (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
        CHECK (sort_order >= 0),

    max_enchantment_level INTEGER NOT NULL DEFAULT 0
        CHECK (max_enchantment_level >= 0),

    relic_collection_id TEXT,

    obtain_source_text TEXT,
    obtain_magic_cost INTEGER
        CHECK (
            obtain_magic_cost IS NULL
            OR obtain_magic_cost >= 0
        ),
    obtain_elixir_cost INTEGER
        CHECK (
            obtain_elixir_cost IS NULL
            OR obtain_elixir_cost >= 0
        ),
    obtain_gem_cost INTEGER
        CHECK (
            obtain_gem_cost IS NULL
            OR obtain_gem_cost >= 0
        ),

    requirement_type TEXT
        CHECK (
            requirement_type IS NULL
            OR requirement_type IN (
                'None',
                'Quest',
                'Character Level',
                'Quest + Character Level',
                'Other'
            )
        ),

    unlock_quest_source_name TEXT,

    required_character_id TEXT,
    required_character_level INTEGER
        CHECK (
            required_character_level IS NULL
            OR required_character_level BETWEEN 1 AND 10
        ),

    build_quest_source_name TEXT,
    other_requirement_text TEXT,

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),
    notes TEXT,

    FOREIGN KEY (group_id)
        REFERENCES attraction_groups(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    FOREIGN KEY (relic_collection_id)
        REFERENCES collections(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    FOREIGN KEY (required_character_id)
        REFERENCES characters(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
);

CREATE UNIQUE INDEX idx_attractions_group_display_name
    ON attractions(
        group_id,
        lower(trim(display_name))
    );

CREATE INDEX idx_attractions_group_id
    ON attractions(group_id);

CREATE INDEX idx_attractions_relic_collection_id
    ON attractions(relic_collection_id);

CREATE INDEX idx_attractions_required_character_id
    ON attractions(required_character_id);

CREATE TABLE attraction_levels (
    attraction_id TEXT NOT NULL,
    target_level INTEGER NOT NULL
        CHECK (target_level BETWEEN 1 AND 5),

    blueprint_rarity TEXT NOT NULL
        CHECK (
            blueprint_rarity IN (
                'common',
                'uncommon',
                'rare',
                'epic',
                'legendary'
            )
        ),

    blueprint_quantity INTEGER NOT NULL
        CHECK (blueprint_quantity >= 0),

    relic_quantity INTEGER NOT NULL
        CHECK (relic_quantity >= 0),

    magic_cost INTEGER NOT NULL
        CHECK (magic_cost >= 0),

    level_time_seconds INTEGER NOT NULL
        CHECK (level_time_seconds >= 0),

    PRIMARY KEY (
        attraction_id,
        target_level
    ),

    FOREIGN KEY (attraction_id)
        REFERENCES attractions(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE
);

CREATE INDEX idx_attraction_levels_target_level
    ON attraction_levels(target_level);

UPDATE metadata
SET value = '0.3'
WHERE key = 'schema_version';