import Database from "@tauri-apps/plugin-sql";

import type {
  Token,
  TokenQuantities,
  CharacterProgressRow,
  TokenInventoryRow,
} from "../types/dmk";

const PLAYER_DATABASE = "sqlite:dmk-player.db";

function getPlayerDatabase() {
  return Database.get(PLAYER_DATABASE);
}

export type LoadedCharacterProgress = {
  isUnlocked: boolean;
  currentLevel: number;
  tokenQuantities: TokenQuantities;
};

export async function loadCharacterPlayerProgress(
  characterId: string,
  tokens: Token[],
): Promise<LoadedCharacterProgress> {
  const db = getPlayerDatabase();

  const progressRows =
    await db.select<CharacterProgressRow[]>(
      `
      SELECT
        is_unlocked,
        current_level
      FROM character_progress
      WHERE character_id = $1
      `,
      [characterId],
    );

  const tokenQuantities: TokenQuantities = {};

  for (const token of tokens) {
    tokenQuantities[token.id] = 0;
  }

  if (tokens.length > 0) {
    const tokenIds = tokens.map((token) => token.id);

    const placeholders = tokenIds
      .map((_, index) => `$${index + 1}`)
      .join(", ");

    const inventoryRows =
      await db.select<TokenInventoryRow[]>(
        `
        SELECT
          token_id,
          quantity
        FROM token_inventory
        WHERE token_id IN (${placeholders})
        `,
        tokenIds,
      );

    for (const inventory of inventoryRows) {
      if (inventory.token_id in tokenQuantities) {
        tokenQuantities[inventory.token_id] =
          Number(inventory.quantity);
      }
    }
  }

  if (progressRows.length === 1) {
    return {
      isUnlocked: progressRows[0].is_unlocked === 1,
      currentLevel: Number(
        progressRows[0].current_level,
      ),
      tokenQuantities,
    };
  }

  return {
    isUnlocked: false,
    currentLevel: 0,
    tokenQuantities,
  };
}

export async function saveCharacterPlayerProgress(
  characterId: string,
  isUnlocked: boolean,
  currentLevel: number,
  tokens: Token[],
  tokenQuantities: TokenQuantities,
): Promise<void> {
  const db = getPlayerDatabase();
  const updatedAt = new Date().toISOString();

  await db.execute(
    `
    INSERT INTO character_progress (
      character_id,
      is_unlocked,
      current_level,
      updated_at
    )
    VALUES ($1, $2, $3, $4)

    ON CONFLICT(character_id) DO UPDATE SET
      is_unlocked = excluded.is_unlocked,
      current_level = excluded.current_level,
      updated_at = excluded.updated_at
    `,
    [
      characterId,
      isUnlocked ? 1 : 0,
      currentLevel,
      updatedAt,
    ],
  );

  for (const token of tokens) {
    const quantity =
      tokenQuantities[token.id] ?? 0;

    await db.execute(
      `
      INSERT INTO token_inventory (
        token_id,
        quantity,
        updated_at
      )
      VALUES ($1, $2, $3)

      ON CONFLICT(token_id) DO UPDATE SET
        quantity = excluded.quantity,
        updated_at = excluded.updated_at
      `,
      [
        token.id,
        quantity,
        updatedAt,
      ],
    );
  }
}