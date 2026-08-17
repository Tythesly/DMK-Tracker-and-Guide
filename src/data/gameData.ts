import Database from "@tauri-apps/plugin-sql";

import type {
  Character,
  CharacterLevel,
  LevelRequirement,
  Token,
} from "../types/dmk";

const GAME_DATABASE =
  "sqlite:dmk-data.db";

function getGameDatabase() {
  return Database.get(
    GAME_DATABASE,
  );
}

export async function getAllCharacters(): Promise<
  Character[]
> {
  const db =
    getGameDatabase();

  return db.select<Character[]>(
    `
    SELECT
      characters.id,
      characters.display_name,
      characters.max_level,
      collections.display_name AS collection_name
    FROM characters
    INNER JOIN collections
      ON collections.id = characters.collection_id
    WHERE characters.is_active = 1
    ORDER BY
      collections.sort_order,
      collections.display_name,
      characters.sort_order,
      characters.display_name
    `,
  );
}

export async function getCharacterById(
  characterId: string,
): Promise<Character> {
  const db =
    getGameDatabase();

  const rows =
    await db.select<Character[]>(
      `
      SELECT
        characters.id,
        characters.display_name,
        characters.max_level,
        collections.display_name AS collection_name
      FROM characters
      INNER JOIN collections
        ON collections.id = characters.collection_id
      WHERE characters.id = $1
      `,
      [characterId],
    );

  if (rows.length !== 1) {
    throw new Error(
      `Character could not be found: ${characterId}`,
    );
  }

  return rows[0];
}

export async function getCharacterTokens(
  characterId: string,
): Promise<Token[]> {
  const db =
    getGameDatabase();

  return db.select<Token[]>(
    `
    SELECT DISTINCT
      tokens.id,
      tokens.display_name,
      tokens.token_type,
      tokens.rarity,
      tokens.sort_order
    FROM tokens
    INNER JOIN character_level_token_requirements AS requirements
      ON requirements.token_id = tokens.id
    WHERE requirements.character_id = $1
      AND tokens.is_active = 1
    ORDER BY
      tokens.sort_order,
      tokens.display_name
    `,
    [characterId],
  );
}

export async function getCharacterLevelRequirements(
  characterId: string,
): Promise<
  LevelRequirement[]
> {
  const db =
    getGameDatabase();

  return db.select<
    LevelRequirement[]
  >(
    `
    SELECT
      requirements.target_level,
      requirements.token_id,
      tokens.display_name AS token_name,
      requirements.quantity
    FROM character_level_token_requirements AS requirements
    INNER JOIN tokens
      ON tokens.id = requirements.token_id
    WHERE requirements.character_id = $1
    ORDER BY
      requirements.target_level,
      tokens.sort_order,
      tokens.display_name
    `,
    [characterId],
  );
}

export async function getCharacterLevels(
  characterId: string,
): Promise<
  CharacterLevel[]
> {
  const db =
    getGameDatabase();

  return db.select<
    CharacterLevel[]
  >(
    `
    SELECT
      target_level,
      magic_cost,
      level_time_seconds
    FROM character_levels
    WHERE character_id = $1
    ORDER BY target_level
    `,
    [characterId],
  );
}

export async function loadCharacterGameData(
  characterId: string,
) {
  const [
    character,
    tokens,
    requirements,
    levels,
  ] = await Promise.all([
    getCharacterById(
      characterId,
    ),
    getCharacterTokens(
      characterId,
    ),
    getCharacterLevelRequirements(
      characterId,
    ),
    getCharacterLevels(
      characterId,
    ),
  ]);

  return {
    character,
    tokens,
    requirements,
    levels,
  };
}