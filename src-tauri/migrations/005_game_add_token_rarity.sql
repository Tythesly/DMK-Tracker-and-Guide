-- Add token rarity as a separate game-data property.
--
-- token_type describes what kind of token a record is
-- (collection/common, unique character token, ears token, etc.).
--
-- rarity describes the DMK drop rarity:
-- Common, Uncommon, Rare, Epic, or Legendary.
--
-- Current values below are temporary development seed data.
-- Production data will eventually be generated automatically
-- from the authoritative DMK Master workbook.

ALTER TABLE tokens
ADD COLUMN rarity TEXT
    CHECK (
        rarity IS NULL
        OR rarity IN (
            'common',
            'uncommon',
            'rare',
            'epic',
            'legendary',
            'unknown'
        )
    );


UPDATE tokens
SET rarity = 'common'
WHERE id IN (
    'token_mickey_balloon',
    'token_mickey_gloves',
    'token_mickey_ears'
);


UPDATE tokens
SET rarity = 'rare'
WHERE id IN (
    'token_minnie_bow',
    'token_minnie_ears'
);


INSERT INTO metadata (
    key,
    value
)
VALUES (
    'schema_version',
    '0.2'
)
ON CONFLICT(key) DO UPDATE SET
    value = excluded.value;