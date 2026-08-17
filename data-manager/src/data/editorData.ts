import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

import type {
  CharacterInput,
  CharacterRecord,
  CollectionInput,
  CollectionRecord,
} from "../types/editor";

const EDITOR_DATABASE =
  "sqlite:dmk-editor.db";

type CollectionRow = {
  id: string;
  display_name: string;
  sort_order: number;
  is_limited_time: number;
  is_active: number;
  notes: string | null;
};

type CharacterRow = {
  id: string;
  collection_id: string;
  collection_name: string;
  display_name: string;
  max_level: number;
  sort_order: number;
  is_premium: number;
  is_limited_time: number;
  is_active: number;
  notes: string | null;
};

function getEditorDatabase() {
  return Database.get(
    EDITOR_DATABASE,
  );
}

function mapCollectionRow(
  row: CollectionRow,
): CollectionRecord {
  return {
    id: row.id,
    displayName:
      row.display_name,
    sortOrder: Number(
      row.sort_order,
    ),
    isLimitedTime:
      row.is_limited_time ===
      1,
    isActive:
      row.is_active === 1,
    notes: row.notes ?? "",
  };
}

function mapCharacterRow(
  row: CharacterRow,
): CharacterRecord {
  return {
    id: row.id,
    collectionId:
      row.collection_id,
    collectionName:
      row.collection_name,
    displayName:
      row.display_name,
    maxLevel: Number(
      row.max_level,
    ),
    sortOrder: Number(
      row.sort_order,
    ),
    isPremium:
      row.is_premium === 1,
    isLimitedTime:
      row.is_limited_time ===
      1,
    isActive:
      row.is_active === 1,
    notes: row.notes ?? "",
  };
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
      .replace(
        /&/g,
        " and ",
      )
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

export function previewCollectionStableId(
  displayName: string,
) {
  return `collection_${createStableIdPart(
    displayName,
  )}`;
}

export function previewCharacterStableId(
  displayName: string,
) {
  return `character_${createStableIdPart(
    displayName,
  )}`;
}

function normalizeCollectionInput(
  input: CollectionInput,
): CollectionInput {
  const displayName =
    input.displayName.trim();

  if (!displayName) {
    throw new Error(
      "Display Name is required.",
    );
  }

  if (
    !Number.isInteger(
      input.sortOrder,
    )
  ) {
    throw new Error(
      "Sort Order must be a whole number.",
    );
  }

  return {
    displayName,
    sortOrder:
      input.sortOrder,
    isLimitedTime:
      input.isLimitedTime,
    isActive:
      input.isActive,
    notes:
      input.notes.trim(),
  };
}

function normalizeCharacterInput(
  input: CharacterInput,
): CharacterInput {
  const displayName =
    input.displayName.trim();

  const collectionId =
    input.collectionId.trim();

  if (!displayName) {
    throw new Error(
      "Display Name is required.",
    );
  }

  if (!collectionId) {
    throw new Error(
      "Collection is required.",
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

  return {
    collectionId,
    displayName,
    sortOrder:
      input.sortOrder,
    isPremium:
      input.isPremium,
    isLimitedTime:
      input.isLimitedTime,
    isActive:
      input.isActive,
    notes:
      input.notes.trim(),
  };
}

async function collectionNameExists(
  displayName: string,
  excludeId?: string,
) {
  const db =
    getEditorDatabase();

  const rows =
    excludeId === undefined
      ? await db.select<
          { id: string }[]
        >(
          `
          SELECT id
          FROM collections
          WHERE
            lower(
              trim(display_name)
            ) =
            lower(
              trim($1)
            )
          LIMIT 1
          `,
          [displayName],
        )
      : await db.select<
          { id: string }[]
        >(
          `
          SELECT id
          FROM collections
          WHERE
            lower(
              trim(display_name)
            ) =
            lower(
              trim($1)
            )
            AND id <> $2
          LIMIT 1
          `,
          [
            displayName,
            excludeId,
          ],
        );

  return rows.length > 0;
}

async function collectionIdExists(
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
      FROM collections
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

  return rows.length > 0;
}

async function characterIdExists(
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
      FROM characters
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

  return rows.length > 0;
}

async function characterNameExists(
  displayName: string,
  collectionId: string,
  excludeId?: string,
) {
  const db =
    getEditorDatabase();

  const rows =
    excludeId === undefined
      ? await db.select<
          { id: string }[]
        >(
          `
          SELECT id
          FROM characters
          WHERE
            collection_id = $1
            AND lower(
              trim(display_name)
            ) =
            lower(
              trim($2)
            )
          LIMIT 1
          `,
          [
            collectionId,
            displayName,
          ],
        )
      : await db.select<
          { id: string }[]
        >(
          `
          SELECT id
          FROM characters
          WHERE
            collection_id = $1
            AND lower(
              trim(display_name)
            ) =
            lower(
              trim($2)
            )
            AND id <> $3
          LIMIT 1
          `,
          [
            collectionId,
            displayName,
            excludeId,
          ],
        );

  return rows.length > 0;
}

async function generateCollectionStableId(
  displayName: string,
) {
  const baseId =
    previewCollectionStableId(
      displayName,
    );

  let candidate =
    baseId;

  let suffix = 2;

  while (
    await collectionIdExists(
      candidate,
    )
  ) {
    candidate =
      `${baseId}_${suffix}`;

    suffix += 1;
  }

  return candidate;
}

async function generateCharacterStableId(
  displayName: string,
) {
  const baseId =
    previewCharacterStableId(
      displayName,
    );

  let candidate =
    baseId;

  let suffix = 2;

  while (
    await characterIdExists(
      candidate,
    )
  ) {
    candidate =
      `${baseId}_${suffix}`;

    suffix += 1;
  }

  return candidate;
}

export async function getNextCharacterSortOrder(
  collectionId: string,
) {
  const db =
    getEditorDatabase();

  const rows =
    await db.select<
      {
        next_sort_order: number;
      }[]
    >(
      `
      SELECT
        COALESCE(
          MAX(sort_order) + 1,
          0
        ) AS next_sort_order
      FROM characters
      WHERE collection_id = $1
      `,
      [collectionId],
    );

  return Number(
    rows[0]?.next_sort_order ??
      0,
  );
}

export async function loadCollections(): Promise<
  CollectionRecord[]
> {
  const db =
    getEditorDatabase();

  const rows =
    await db.select<
      CollectionRow[]
    >(
      `
      SELECT
        id,
        display_name,
        sort_order,
        is_limited_time,
        is_active,
        notes
      FROM collections
      ORDER BY
        sort_order,
        display_name COLLATE NOCASE
      `,
    );

  return rows.map(
    mapCollectionRow,
  );
}

export async function createCollection(
  input: CollectionInput,
): Promise<CollectionRecord> {
  const normalized =
    normalizeCollectionInput(
      input,
    );

  if (
    await collectionNameExists(
      normalized.displayName,
    )
  ) {
    throw new Error(
      "A collection with this display name already exists.",
    );
  }

  const id =
    await generateCollectionStableId(
      normalized.displayName,
    );

  const db =
    getEditorDatabase();

  await db.execute(
    `
    INSERT INTO collections (
      id,
      display_name,
      sort_order,
      is_limited_time,
      is_active,
      notes
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6
    )
    `,
    [
      id,
      normalized.displayName,
      normalized.sortOrder,
      normalized.isLimitedTime
        ? 1
        : 0,
      normalized.isActive
        ? 1
        : 0,
      normalized.notes ||
        null,
    ],
  );

  return {
    id,
    ...normalized,
  };
}

export async function updateCollection(
  id: string,
  input: CollectionInput,
): Promise<CollectionRecord> {
  const normalized =
    normalizeCollectionInput(
      input,
    );

  if (
    await collectionNameExists(
      normalized.displayName,
      id,
    )
  ) {
    throw new Error(
      "A collection with this display name already exists.",
    );
  }

  const db =
    getEditorDatabase();

  const result =
    await db.execute(
      `
      UPDATE collections
      SET
        display_name = $1,
        sort_order = $2,
        is_limited_time = $3,
        is_active = $4,
        notes = $5
      WHERE id = $6
      `,
      [
        normalized.displayName,
        normalized.sortOrder,
        normalized.isLimitedTime
          ? 1
          : 0,
        normalized.isActive
          ? 1
          : 0,
        normalized.notes ||
          null,
        id,
      ],
    );

  if (
    result.rowsAffected !== 1
  ) {
    throw new Error(
      "The collection could not be updated because its record was not found.",
    );
  }

  return {
    id,
    ...normalized,
  };
}

export async function loadCharacters(): Promise<
  CharacterRecord[]
> {
  const db =
    getEditorDatabase();

  const rows =
    await db.select<
      CharacterRow[]
    >(
      `
      SELECT
        ch.id,
        ch.collection_id,
        c.display_name
          AS collection_name,
        ch.display_name,
        ch.max_level,
        ch.sort_order,
        ch.is_premium,
        ch.is_limited_time,
        ch.is_active,
        ch.notes
      FROM characters ch
      INNER JOIN collections c
        ON c.id =
          ch.collection_id
      ORDER BY
        c.sort_order,
        c.display_name
          COLLATE NOCASE,
        ch.sort_order,
        ch.display_name
          COLLATE NOCASE
      `,
    );

  return rows.map(
    mapCharacterRow,
  );
}

export async function createCharacter(
  input: CharacterInput,
): Promise<CharacterRecord> {
  const normalized =
    normalizeCharacterInput(
      input,
    );

  if (
    !await collectionIdExists(
      normalized.collectionId,
    )
  ) {
    throw new Error(
      "The selected collection no longer exists.",
    );
  }

  if (
    await characterNameExists(
      normalized.displayName,
      normalized.collectionId,
    )
  ) {
    throw new Error(
      "A character with this display name already exists in the selected collection.",
    );
  }

  const id =
    await generateCharacterStableId(
      normalized.displayName,
    );

  await invoke(
    "create_character_with_sort",
    {
      input: {
        id,
        collectionId:
          normalized.collectionId,
        displayName:
          normalized.displayName,
        sortOrder:
          normalized.sortOrder,
        isPremium:
          normalized.isPremium,
        isLimitedTime:
          normalized.isLimitedTime,
        isActive:
          normalized.isActive,
        notes:
          normalized.notes ||
          null,
      },
    },
  );

  const characters =
    await loadCharacters();

  const saved =
    characters.find(
      (character) =>
        character.id === id,
    );

  if (!saved) {
    throw new Error(
      "The character was saved, but its record could not be reloaded.",
    );
  }

  return saved;
}

export async function updateCharacter(
  id: string,
  input: CharacterInput,
): Promise<CharacterRecord> {
  const normalized =
    normalizeCharacterInput(
      input,
    );

  if (
    !await collectionIdExists(
      normalized.collectionId,
    )
  ) {
    throw new Error(
      "The selected collection no longer exists.",
    );
  }

  if (
    await characterNameExists(
      normalized.displayName,
      normalized.collectionId,
      id,
    )
  ) {
    throw new Error(
      "A character with this display name already exists in the selected collection.",
    );
  }

  await invoke(
    "update_character_with_sort",
    {
      input: {
        id,
        collectionId:
          normalized.collectionId,
        displayName:
          normalized.displayName,
        sortOrder:
          normalized.sortOrder,
        isPremium:
          normalized.isPremium,
        isLimitedTime:
          normalized.isLimitedTime,
        isActive:
          normalized.isActive,
        notes:
          normalized.notes ||
          null,
      },
    },
  );

  const characters =
    await loadCharacters();

  const saved =
    characters.find(
      (character) =>
        character.id === id,
    );

  if (!saved) {
    throw new Error(
      "The character was updated, but its record could not be reloaded.",
    );
  }

  return saved;
}