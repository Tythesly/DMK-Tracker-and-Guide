PRAGMA foreign_keys = ON;

CREATE TABLE attraction_enchantment_defaults (
    target_level INTEGER PRIMARY KEY
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

    notes TEXT
);

INSERT INTO attraction_enchantment_defaults (
    target_level,
    blueprint_rarity,
    blueprint_quantity,
    relic_quantity,
    magic_cost,
    level_time_seconds,
    notes
)
VALUES
    (1, 'common',    10,   10,   2500,   7200,  'Standard Level 1 attraction enchantment requirements'),
    (2, 'uncommon',  10,   50,   5000,  14400,  'Standard Level 2 attraction enchantment requirements'),
    (3, 'rare',      10,  200,  15000,  28800,  'Standard Level 3 attraction enchantment requirements'),
    (4, 'epic',      10,  600,  60000,  43200,  'Standard Level 4 attraction enchantment requirements'),
    (5, 'legendary', 10, 1200, 300000,  86400,  'Standard Level 5 attraction enchantment requirements');

UPDATE metadata
SET value = '0.4'
WHERE key = 'schema_version';