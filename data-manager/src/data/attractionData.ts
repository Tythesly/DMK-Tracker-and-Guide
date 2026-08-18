import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

import type {
  AttractionEnchantmentDefaultRecord,
  AttractionGroupRecord,
  AttractionInput,
  AttractionRecord,
} from "../types/attractionEditor";

const EDITOR_DATABASE =
  "sqlite:dmk-editor.db";

const SPECIAL_ATTRACTION_GROUPS = [
  {
    id: "attraction_group_park_anchors",
    displayName: "Park Anchors",
    sortOrder: 100000,
  },
  {
    id: "attraction_group_unclassified",
    displayName: "Unclassified",
    sortOrder: 100001,
  },
] as const;

type AttractionGroupRow = {
  id: string;
  display_name: string;
  collection_id: string | null;
  collection_name: string | null;
  sort_order: number;
  is_active: number;
  notes: string | null;
};

type AttractionRow = {
  id: string;
  group_id: string;
  group_name: string;
  group_collection_id: string | null;
  display_name: string;
  sort_order: number;
  max_enchantment_level: number;
  relic_collection_id: string | null;
  relic_collection_name: string | null;
  obtain_source_text: string | null;
  obtain_magic_cost: number | null;
  obtain_elixir_cost: number | null;
  obtain_gem_cost: number | null;
  requirement_type: string | null;
  unlock_quest_source_name: string | null;
  required_character_id: string | null;
  required_character_name: string | null;
  required_character_collection_name: string | null;
  required_character_level: number | null;
  build_quest_source_name: string | null;
  other_requirement_text: string | null;
  is_active: number;
  notes: string | null;
};

type AttractionEnchantmentDefaultRow = {
  target_level: number;
  blueprint_rarity: string;
  blueprint_quantity: number;
  relic_quantity: number;
  magic_cost: number;
  level_time_seconds: number;
  notes: string | null;
};

function getEditorDatabase() {
  return Database.get(
    EDITOR_DATABASE,
  );
}

function createStableIdPart(
  displayName: string,
) {
  const normalized =
    displayName
      .normalize("NFKD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(
        /[^a-z0-9]+/g,
        "_",
      )
      .replace(
        /^_+|_+$/g,
        "",
      );

  return normalized || "unnamed";
}

export function previewAttractionStableId(
  displayName: string,
) {
  return `attraction_${createStableIdPart(
    displayName,
  )}`;
}

function attractionGroupIdFromCollectionId(
  collectionId: string,
) {
  const suffix =
    collectionId.startsWith(
      "collection_",
    )
      ? collectionId.slice(
          "collection_".length,
        )
      : createStableIdPart(
          collectionId,
        );

  return `attraction_group_${suffix}`;
}

export async function syncCollectionAttractionGroups() {
  const db =
    getEditorDatabase();

  const collections =
    await db.select<
      {
        id: string;
        display_name: string;
        sort_order: number;
        is_active: number;
      }[]
    >(
      `
      SELECT
        id,
        display_name,
        sort_order,
        is_active
      FROM collections
      ORDER BY
        sort_order,
        display_name COLLATE NOCASE
      `,
    );

  for (const collection of collections) {
    const groupId =
      attractionGroupIdFromCollectionId(
        collection.id,
      );

    await db.execute(
      `
      INSERT OR IGNORE INTO attraction_groups (
        id,
        display_name,
        collection_id,
        sort_order,
        is_active,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, NULL)
      `,
      [
        groupId,
        collection.display_name,
        collection.id,
        Number(
          collection.sort_order,
        ),
        collection.is_active === 1
          ? 1
          : 0,
      ],
    );

    await db.execute(
      `
      UPDATE attraction_groups
      SET
        display_name = $1,
        sort_order = $2,
        is_active = $3
      WHERE collection_id = $4
      `,
      [
        collection.display_name,
        Number(
          collection.sort_order,
        ),
        collection.is_active === 1
          ? 1
          : 0,
        collection.id,
      ],
    );
  }

  for (
    const specialGroup of
    SPECIAL_ATTRACTION_GROUPS
  ) {
    await db.execute(
      `
      INSERT OR IGNORE INTO attraction_groups (
        id,
        display_name,
        collection_id,
        sort_order,
        is_active,
        notes
      )
      VALUES ($1, $2, NULL, $3, 1, $4)
      `,
      [
        specialGroup.id,
        specialGroup.displayName,
        specialGroup.sortOrder,
        "Special attraction grouping that is not a normal character collection.",
      ],
    );

    await db.execute(
      `
      UPDATE attraction_groups
      SET
        display_name = $1,
        sort_order = $2,
        is_active = 1
      WHERE
        id = $3
        AND collection_id IS NULL
      `,
      [
        specialGroup.displayName,
        specialGroup.sortOrder,
        specialGroup.id,
      ],
    );
  }
}

export async function loadAttractionGroups(): Promise<
  AttractionGroupRecord[]
> {
  const db =
    getEditorDatabase();

  const rows =
    await db.select<
      AttractionGroupRow[]
    >(
      `
      SELECT
        ag.id,
        ag.display_name,
        ag.collection_id,
        c.display_name AS collection_name,
        ag.sort_order,
        ag.is_active,
        ag.notes
      FROM attraction_groups ag
      LEFT JOIN collections c
        ON c.id = ag.collection_id
      ORDER BY
        ag.sort_order,
        ag.display_name COLLATE NOCASE
      `,
    );

  return rows.map(
    (row) => ({
      id: row.id,
      displayName:
        row.display_name,
      collectionId:
        row.collection_id,
      collectionName:
        row.collection_name,
      sortOrder: Number(
        row.sort_order,
      ),
      isActive:
        row.is_active === 1,
      notes: row.notes ?? "",
    }),
  );
}

export async function loadAttractions(): Promise<
  AttractionRecord[]
> {
  const db =
    getEditorDatabase();

  const rows =
    await db.select<
      AttractionRow[]
    >(
      `
      SELECT
        a.id,
        a.group_id,
        ag.display_name AS group_name,
        ag.collection_id AS group_collection_id,
        a.display_name,
        a.sort_order,
        a.max_enchantment_level,
        a.relic_collection_id,
        rc.display_name AS relic_collection_name,
        a.obtain_source_text,
        a.obtain_magic_cost,
        a.obtain_elixir_cost,
        a.obtain_gem_cost,
        a.requirement_type,
        a.unlock_quest_source_name,
        a.required_character_id,
        ch.display_name AS required_character_name,
        cc.display_name AS required_character_collection_name,
        a.required_character_level,
        a.build_quest_source_name,
        a.other_requirement_text,
        a.is_active,
        a.notes
      FROM attractions a
      INNER JOIN attraction_groups ag
        ON ag.id = a.group_id
      LEFT JOIN collections rc
        ON rc.id = a.relic_collection_id
      LEFT JOIN characters ch
        ON ch.id = a.required_character_id
      LEFT JOIN collections cc
        ON cc.id = ch.collection_id
      ORDER BY
        ag.sort_order,
        ag.display_name COLLATE NOCASE,
        a.sort_order,
        a.display_name COLLATE NOCASE
      `,
    );

  return rows.map(
    (row) => ({
      id: row.id,
      groupId: row.group_id,
      groupName: row.group_name,
      groupCollectionId:
        row.group_collection_id,
      displayName:
        row.display_name,
      sortOrder: Number(
        row.sort_order,
      ),
      maxEnchantmentLevel:
        Number(
          row.max_enchantment_level,
        ),
      relicCollectionId:
        row.relic_collection_id,
      relicCollectionName:
        row.relic_collection_name,
      obtainSourceText:
        row.obtain_source_text ?? "",
      obtainMagicCost:
        row.obtain_magic_cost === null
          ? null
          : Number(
              row.obtain_magic_cost,
            ),
      obtainElixirCost:
        row.obtain_elixir_cost === null
          ? null
          : Number(
              row.obtain_elixir_cost,
            ),
      obtainGemCost:
        row.obtain_gem_cost === null
          ? null
          : Number(
              row.obtain_gem_cost,
            ),
      requirementType:
        row.requirement_type,
      unlockQuestSourceName:
        row.unlock_quest_source_name ??
        "",
      requiredCharacterId:
        row.required_character_id,
      requiredCharacterName:
        row.required_character_name,
      requiredCharacterCollectionName:
        row.required_character_collection_name,
      requiredCharacterLevel:
        row.required_character_level ===
        null
          ? null
          : Number(
              row.required_character_level,
            ),
      buildQuestSourceName:
        row.build_quest_source_name ??
        "",
      otherRequirementText:
        row.other_requirement_text ??
        "",
      isActive:
        row.is_active === 1,
      notes: row.notes ?? "",
    }),
  );
}

export async function loadAttractionEnchantmentDefaults(): Promise<
  AttractionEnchantmentDefaultRecord[]
> {
  const db =
    getEditorDatabase();

  const rows =
    await db.select<
      AttractionEnchantmentDefaultRow[]
    >(
      `
      SELECT
        target_level,
        blueprint_rarity,
        blueprint_quantity,
        relic_quantity,
        magic_cost,
        level_time_seconds,
        notes
      FROM attraction_enchantment_defaults
      ORDER BY target_level
      `,
    );

  return rows.map(
    (row) => ({
      targetLevel: Number(
        row.target_level,
      ),
      blueprintRarity:
        row.blueprint_rarity,
      blueprintQuantity:
        Number(
          row.blueprint_quantity,
        ),
      relicQuantity: Number(
        row.relic_quantity,
      ),
      magicCost: Number(
        row.magic_cost,
      ),
      levelTimeSeconds: Number(
        row.level_time_seconds,
      ),
      notes: row.notes ?? "",
    }),
  );
}

export async function getNextAttractionSortOrder(
  groupId: string,
) {
  const db =
    getEditorDatabase();

  const rows =
    await db.select<
      { next_sort_order: number }[]
    >(
      `
      SELECT
        COALESCE(
          MAX(sort_order) + 1,
          0
        ) AS next_sort_order
      FROM attractions
      WHERE group_id = $1
      `,
      [groupId],
    );

  return Number(
    rows[0]?.next_sort_order ?? 0,
  );
}

async function attractionIdExists(
  id: string,
) {
  const db =
    getEditorDatabase();

  const rows =
    await db.select<
      { id: string }[]
    >(
      `
      SELECT id
      FROM attractions
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

  return rows.length > 0;
}

async function generateAttractionStableId(
  displayName: string,
) {
  const baseId =
    previewAttractionStableId(
      displayName,
    );

  if (
    !await attractionIdExists(
      baseId,
    )
  ) {
    return baseId;
  }

  let suffix = 2;

  while (suffix < 10000) {
    const candidate =
      `${baseId}_${suffix}`;

    if (
      !await attractionIdExists(
        candidate,
      )
    ) {
      return candidate;
    }

    suffix += 1;
  }

  throw new Error(
    "Unable to generate a unique Attraction Stable ID.",
  );
}

function normalizeOptionalText(
  value: string,
) {
  const trimmed =
    value.trim();

  return trimmed || null;
}

function normalizeAttractionInput(
  input: AttractionInput,
): AttractionInput {
  const displayName =
    input.displayName.trim();

  const groupId =
    input.groupId.trim();

  if (!displayName) {
    throw new Error(
      "Display Name is required.",
    );
  }

  if (!groupId) {
    throw new Error(
      "Attraction Group is required.",
    );
  }

  if (
    !Number.isInteger(
      input.sortOrder,
    ) ||
    input.sortOrder < 0
  ) {
    throw new Error(
      "Sort Order must be a whole number of 0 or greater.",
    );
  }

  if (
    input.maxEnchantmentLevel !==
      0 &&
    input.maxEnchantmentLevel !==
      5
  ) {
    throw new Error(
      "Attractions must either be non-enchantable or use the standard maximum enchantment level of 5.",
    );
  }

  for (const [label, value] of [
    [
      "Magic Cost",
      input.obtainMagicCost,
    ],
    [
      "Elixir Cost",
      input.obtainElixirCost,
    ],
    [
      "Gem Cost",
      input.obtainGemCost,
    ],
  ] as const) {
    if (
      value !== null &&
      (!Number.isInteger(value) ||
        value < 0)
    ) {
      throw new Error(
        `${label} must be a whole number of 0 or greater, or left blank.`,
      );
    }
  }

  if (
    input.requiredCharacterLevel !==
      null &&
    (!Number.isInteger(
      input.requiredCharacterLevel,
    ) ||
      input.requiredCharacterLevel < 1 ||
      input.requiredCharacterLevel > 10)
  ) {
    throw new Error(
      "Required Character Level must be between 1 and 10, or left blank.",
    );
  }

  if (
    input.requiredCharacterLevel !==
      null &&
    !input.requiredCharacterId
  ) {
    throw new Error(
      "Select a Required Character before setting a Required Character Level.",
    );
  }

  return {
    groupId,
    displayName,
    sortOrder:
      input.sortOrder,
    maxEnchantmentLevel:
      input.maxEnchantmentLevel,
    relicCollectionId:
      input.relicCollectionId
        ?.trim() || null,
    obtainSourceText:
      input.obtainSourceText.trim(),
    obtainMagicCost:
      input.obtainMagicCost,
    obtainElixirCost:
      input.obtainElixirCost,
    obtainGemCost:
      input.obtainGemCost,
    requirementType:
      input.requirementType
        ?.trim() || null,
    unlockQuestSourceName:
      input.unlockQuestSourceName.trim(),
    requiredCharacterId:
      input.requiredCharacterId
        ?.trim() || null,
    requiredCharacterLevel:
      input.requiredCharacterLevel,
    buildQuestSourceName:
      input.buildQuestSourceName.trim(),
    otherRequirementText:
      input.otherRequirementText.trim(),
    isActive:
      input.isActive,
    notes:
      input.notes.trim(),
  };
}

export async function createAttraction(
  input: AttractionInput,
) {
  const normalized =
    normalizeAttractionInput(
      input,
    );

  const id =
    await generateAttractionStableId(
      normalized.displayName,
    );

  await invoke(
    "create_attraction_with_sort",
    {
      input: {
        id,
        ...normalized,
        relicCollectionId:
          normalized.relicCollectionId,
        obtainSourceText:
          normalizeOptionalText(
            normalized.obtainSourceText,
          ),
        requirementType:
          normalized.requirementType,
        unlockQuestSourceName:
          normalizeOptionalText(
            normalized.unlockQuestSourceName,
          ),
        requiredCharacterId:
          normalized.requiredCharacterId,
        buildQuestSourceName:
          normalizeOptionalText(
            normalized.buildQuestSourceName,
          ),
        otherRequirementText:
          normalizeOptionalText(
            normalized.otherRequirementText,
          ),
        notes:
          normalizeOptionalText(
            normalized.notes,
          ),
      },
    },
  );

  return id;
}

export async function updateAttraction(
  id: string,
  input: AttractionInput,
) {
  const normalized =
    normalizeAttractionInput(
      input,
    );

  await invoke(
    "update_attraction_with_sort",
    {
      input: {
        id,
        ...normalized,
        relicCollectionId:
          normalized.relicCollectionId,
        obtainSourceText:
          normalizeOptionalText(
            normalized.obtainSourceText,
          ),
        requirementType:
          normalized.requirementType,
        unlockQuestSourceName:
          normalizeOptionalText(
            normalized.unlockQuestSourceName,
          ),
        requiredCharacterId:
          normalized.requiredCharacterId,
        buildQuestSourceName:
          normalizeOptionalText(
            normalized.buildQuestSourceName,
          ),
        otherRequirementText:
          normalizeOptionalText(
            normalized.otherRequirementText,
          ),
        notes:
          normalizeOptionalText(
            normalized.notes,
          ),
      },
    },
  );
}