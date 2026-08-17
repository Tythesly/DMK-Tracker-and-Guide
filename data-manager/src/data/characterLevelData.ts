import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

import type {
  CharacterLevelInput,
  CharacterLevelRecord,
  CharacterLevelTokenRequirementRecord,
  TokenRarity,
} from "../types/editor";

const EDITOR_DATABASE =
  "sqlite:dmk-editor.db";

type CharacterLevelRow = {
  character_id: string;
  target_level: number;
  magic_cost: number | null;
  level_time_seconds: number | null;
};

type RequirementRow = {
  character_id: string;
  target_level: number;
  token_id: string;
  token_name: string;
  token_type: string;
  rarity: TokenRarity | null;
  quantity: number;
};

function getEditorDatabase() {
  return Database.get(
    EDITOR_DATABASE,
  );
}

export async function loadCharacterLevels(
  characterId: string,
): Promise<CharacterLevelRecord[]> {
  const db =
    getEditorDatabase();

  const levelRows =
    await db.select<
      CharacterLevelRow[]
    >(
      `
      SELECT
        character_id,
        target_level,
        magic_cost,
        level_time_seconds
      FROM character_levels
      WHERE character_id = $1
      ORDER BY target_level
      `,
      [characterId],
    );

  const requirementRows =
    await db.select<
      RequirementRow[]
    >(
      `
      SELECT
        r.character_id,
        r.target_level,
        r.token_id,
        t.display_name
          AS token_name,
        t.token_type,
        t.rarity,
        r.quantity
      FROM character_level_token_requirements r
      INNER JOIN tokens t
        ON t.id =
          r.token_id
      WHERE
        r.character_id = $1
      ORDER BY
        r.target_level,
        t.sort_order,
        t.display_name
          COLLATE NOCASE
      `,
      [characterId],
    );

  const requirementsByLevel =
    new Map<
      number,
      CharacterLevelTokenRequirementRecord[]
    >();

  for (
    const row
    of requirementRows
  ) {
    const requirements =
      requirementsByLevel.get(
        Number(
          row.target_level,
        ),
      ) ?? [];

    requirements.push({
      tokenId:
        row.token_id,

      tokenName:
        row.token_name,

      tokenType:
        row.token_type,

      rarity:
        row.rarity,

      quantity:
        Number(
          row.quantity,
        ),
    });

    requirementsByLevel.set(
      Number(
        row.target_level,
      ),
      requirements,
    );
  }

  return levelRows.map(
    (row) => ({
      characterId:
        row.character_id,

      targetLevel:
        Number(
          row.target_level,
        ),

      magicCost:
        row.magic_cost ===
        null
          ? null
          : Number(
              row.magic_cost,
            ),

      levelTimeSeconds:
        row.level_time_seconds ===
        null
          ? null
          : Number(
              row.level_time_seconds,
            ),

      requirements:
        requirementsByLevel.get(
          Number(
            row.target_level,
          ),
        ) ?? [],
    }),
  );
}

export async function saveCharacterLevel(
  input: CharacterLevelInput,
) {
  await invoke(
    "save_character_level",
    {
      input: {
        characterId:
          input.characterId,

        targetLevel:
          input.targetLevel,

        magicCost:
          input.magicCost,

        levelTimeSeconds:
          input.levelTimeSeconds,

        requirements:
          input.requirements.map(
            (
              requirement,
            ) => ({
              tokenId:
                requirement.tokenId,

              quantity:
                requirement.quantity,
            }),
          ),
      },
    },
  );
}