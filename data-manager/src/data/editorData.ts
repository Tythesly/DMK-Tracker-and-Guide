import Database from "@tauri-apps/plugin-sql";

import type {
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

  return (
    normalized ||
    "unnamed"
  );
}

export function previewCollectionStableId(
  displayName: string,
) {
  return `collection_${createStableIdPart(
    displayName,
  )}`;
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