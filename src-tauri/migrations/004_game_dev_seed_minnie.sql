-- Development seed data for the second character-tracking test.
-- Minnie Mouse is used to verify multi-character progress and shared token inventory.

INSERT INTO characters (
    id,
    collection_id,
    display_name,
    max_level,
    sort_order,
    is_premium,
    is_limited_time,
    is_active,
    notes
)
VALUES (
    'character_minnie_mouse',
    'collection_mickey_friends',
    'Minnie Mouse',
    10,
    2,
    0,
    0,
    1,
    NULL
);


INSERT INTO tokens (
    id,
    display_name,
    token_type,
    associated_character_id,
    associated_collection_id,
    sort_order,
    is_active,
    notes
)
VALUES
(
    'token_minnie_bow',
    'Minnie Bow',
    'unique',
    'character_minnie_mouse',
    'collection_mickey_friends',
    2,
    1,
    NULL
),
(
    'token_minnie_ears',
    'Minnie Ears',
    'ears',
    'character_minnie_mouse',
    'collection_mickey_friends',
    3,
    1,
    NULL
);


INSERT INTO character_levels (
    character_id,
    target_level,
    magic_cost,
    level_time_seconds
)
VALUES
('character_minnie_mouse', 1, 25000, 14400),
('character_minnie_mouse', 2, 2250, 31),
('character_minnie_mouse', 3, 3400, 360),
('character_minnie_mouse', 4, 5100, 2100),
('character_minnie_mouse', 5, 6650, 3600),
('character_minnie_mouse', 6, 8650, 7200),
('character_minnie_mouse', 7, 11250, 14400),
('character_minnie_mouse', 8, 14650, 28800),
('character_minnie_mouse', 9, 19050, 57600),
('character_minnie_mouse', 10, 24750, 86400);


INSERT INTO character_level_token_requirements (
    character_id,
    target_level,
    token_id,
    quantity
)
VALUES
-- Welcome
('character_minnie_mouse', 1, 'token_mickey_balloon', 25),
('character_minnie_mouse', 1, 'token_minnie_bow', 10),
('character_minnie_mouse', 1, 'token_minnie_ears', 10),

-- Level 2
('character_minnie_mouse', 2, 'token_mickey_balloon', 5),
('character_minnie_mouse', 2, 'token_minnie_bow', 2),
('character_minnie_mouse', 2, 'token_minnie_ears', 2),

-- Level 3
('character_minnie_mouse', 3, 'token_mickey_balloon', 10),
('character_minnie_mouse', 3, 'token_minnie_bow', 3),
('character_minnie_mouse', 3, 'token_minnie_ears', 3),

-- Level 4
('character_minnie_mouse', 4, 'token_mickey_balloon', 15),
('character_minnie_mouse', 4, 'token_minnie_bow', 5),
('character_minnie_mouse', 4, 'token_minnie_ears', 5),

-- Level 5
('character_minnie_mouse', 5, 'token_mickey_balloon', 20),
('character_minnie_mouse', 5, 'token_minnie_bow', 7),
('character_minnie_mouse', 5, 'token_minnie_ears', 7),

-- Level 6
('character_minnie_mouse', 6, 'token_mickey_balloon', 25),
('character_minnie_mouse', 6, 'token_minnie_bow', 10),
('character_minnie_mouse', 6, 'token_minnie_ears', 10),

-- Level 7
('character_minnie_mouse', 7, 'token_mickey_balloon', 30),
('character_minnie_mouse', 7, 'token_minnie_bow', 13),
('character_minnie_mouse', 7, 'token_minnie_ears', 13),

-- Level 8
('character_minnie_mouse', 8, 'token_mickey_balloon', 35),
('character_minnie_mouse', 8, 'token_minnie_bow', 16),
('character_minnie_mouse', 8, 'token_minnie_ears', 16),

-- Level 9
('character_minnie_mouse', 9, 'token_mickey_balloon', 40),
('character_minnie_mouse', 9, 'token_minnie_bow', 20),
('character_minnie_mouse', 9, 'token_minnie_ears', 20),

-- Level 10
('character_minnie_mouse', 10, 'token_mickey_balloon', 50),
('character_minnie_mouse', 10, 'token_minnie_bow', 25),
('character_minnie_mouse', 10, 'token_minnie_ears', 25);