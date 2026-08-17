import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

import type {
  CharacterInput,
  CharacterRecord,
  CollectionInput,
  CollectionRecord,
  TokenInput,
  TokenRecord,
  TokenRarity,
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

type TokenRow = {
  id: string;
  display_name: string;
  token_type: string;
  rarity: TokenRarity | null;

  associated_character_id:
    string | null;

  associated_character_name:
    string | null;

  associated_collection_id:
    string | null;

  associated_collection_name:
    string | null;

  sort_order: number;
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

function mapTokenRow(
  row: TokenRow,
): TokenRecord {
  return {
    id: row.id,
    displayName:
      row.display_name,
    tokenType:
      row.token_type,
    rarity: row.rarity,

    associatedCharacterId:
      row.associated_character_id,

    associatedCharacterName:
      row.associated_character_name,

    associatedCollectionId:
      row.associated_collection_id,

    associatedCollectionName:
      row.associated_collection_name,

    sortOrder: Number(
      row.sort_order,
    ),

    isActive:
      row.is_active === 1,

    notes:
      row.notes ?? "",
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

export function previewTokenStableId(
  displayName: string,
) {
  return `token_${createStableIdPart(
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

function normalizeTokenInput(
  input: TokenInput,
): TokenInput {
  const displayName =
    input.displayName.trim();

  const tokenType =
    input.tokenType.trim();

  if (!displayName) {
    throw new Error(
      "Display Name is required.",
    );
  }

  if (!tokenType) {
    throw new Error(
      "Token Type is required.",
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
    displayName,
    tokenType,
    rarity:
      input.rarity,

    associatedCharacterId:
      input.associatedCharacterId
        ?.trim() ||
      null,

    associatedCollectionId:
      input.associatedCollectionId
        ?.trim() ||
      null,

    sortOrder:
      input.sortOrder,

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

async function tokenIdExists(
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
      FROM tokens
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

  return rows.length > 0;
}

async function tokenNameExistsInScope(
  displayName: string,
  characterId:
    string | null,
  collectionId:
    string | null,
  excludeId?: string,
) {
  const db =
    getEditorDatabase();

  const parameters:
    unknown[] = [
      displayName,
      characterId,
      collectionId,
    ];

  let exclusionSql = "";

  if (excludeId) {
    exclusionSql =
      "AND id <> $4";

    parameters.push(
      excludeId,
    );
  }

  const rows =
    await db.select<
      { id: string }[]
    >(
      `
      SELECT id
      FROM tokens
      WHERE
        lower(
          trim(display_name)
        ) =
        lower(
          trim($1)
        )
        AND COALESCE(
          associated_character_id,
          ''
        ) =
        COALESCE(
          $2,
          ''
        )
        AND COALESCE(
          associated_collection_id,
          ''
        ) =
        COALESCE(
          $3,
          ''
        )
        ${exclusionSql}
      LIMIT 1
      `,
      parameters,
    );

  return rows.length > 0;
}

async function loadCharacterCollectionId(
  characterId: string,
) {
  const db =
    getEditorDatabase();

  const rows =
    await db.select<
      {
        collection_id: string;
      }[]
    >(
      `
      SELECT
        collection_id
      FROM characters
      WHERE id = $1
      LIMIT 1
      `,
      [characterId],
    );

  return (
    rows[0]
      ?.collection_id ??
    null
  );
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

async function generateTokenStableId(
  displayName: string,
) {
  const baseId =
    previewTokenStableId(
      displayName,
    );

  let candidate =
    baseId;

  let suffix = 2;

  while (
    await tokenIdExists(
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

export async function getNextTokenSortOrder(
  characterId:
    string | null,
  collectionId:
    string | null,
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
      FROM tokens
      WHERE
        COALESCE(
          associated_character_id,
          ''
        ) =
        COALESCE(
          $1,
          ''
        )
        AND COALESCE(
          associated_collection_id,
          ''
        ) =
        COALESCE(
          $2,
          ''
        )
      `,
      [
        characterId,
        collectionId,
      ],
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

export async function loadTokens(): Promise<
  TokenRecord[]
> {
  const db =
    getEditorDatabase();

  const rows =
    await db.select<
      TokenRow[]
    >(
      `
      SELECT
        t.id,
        t.display_name,
        t.token_type,
        t.rarity,

        t.associated_character_id,

        ch.display_name
          AS associated_character_name,

        t.associated_collection_id,

        c.display_name
          AS associated_collection_name,

        t.sort_order,
        t.is_active,
        t.notes

      FROM tokens t

      LEFT JOIN characters ch
        ON ch.id =
          t.associated_character_id

      LEFT JOIN collections c
        ON c.id =
          t.associated_collection_id

      ORDER BY
        COALESCE(
          c.sort_order,
          999999
        ),
        COALESCE(
          c.display_name,
          ''
        )
          COLLATE NOCASE,

        COALESCE(
          ch.sort_order,
          999999
        ),
        COALESCE(
          ch.display_name,
          ''
        )
          COLLATE NOCASE,

        t.sort_order,
        t.display_name
          COLLATE NOCASE
      `,
    );

  return rows.map(
    mapTokenRow,
  );
}

async function validateTokenRelationships(
  input: TokenInput,
): Promise<TokenInput> {
  let collectionId =
    input.associatedCollectionId;

  if (
    input.associatedCharacterId
  ) {
    const characterCollectionId =
      await loadCharacterCollectionId(
        input.associatedCharacterId,
      );

    if (
      !characterCollectionId
    ) {
      throw new Error(
        "The selected character no longer exists.",
      );
    }

    collectionId =
      characterCollectionId;
  } else if (
    collectionId &&
    !await collectionIdExists(
      collectionId,
    )
  ) {
    throw new Error(
      "The selected collection no longer exists.",
    );
  }

  return {
    ...input,

    associatedCollectionId:
      collectionId,
  };
}

export async function createToken(
  input: TokenInput,
): Promise<TokenRecord> {
  let normalized =
    normalizeTokenInput(
      input,
    );

  normalized =
    await validateTokenRelationships(
      normalized,
    );

  if (
    await tokenNameExistsInScope(
      normalized.displayName,

      normalized.associatedCharacterId,

      normalized.associatedCollectionId,
    )
  ) {
    throw new Error(
      "A token with this display name already exists for the selected Character/Collection.",
    );
  }

  const id =
    await generateTokenStableId(
      normalized.displayName,
    );

  const db =
    getEditorDatabase();

  await db.execute(
    `
    INSERT INTO tokens (
      id,
      display_name,
      token_type,
      rarity,
      associated_character_id,
      associated_collection_id,
      sort_order,
      is_active,
      notes
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9
    )
    `,
    [
      id,
      normalized.displayName,
      normalized.tokenType,
      normalized.rarity,

      normalized.associatedCharacterId,

      normalized.associatedCollectionId,

      normalized.sortOrder,

      normalized.isActive
        ? 1
        : 0,

      normalized.notes ||
        null,
    ],
  );

  const tokens =
    await loadTokens();

  const saved =
    tokens.find(
      (token) =>
        token.id === id,
    );

  if (!saved) {
    throw new Error(
      "The token was saved, but its record could not be reloaded.",
    );
  }

  return saved;
}

export async function updateToken(
  id: string,
  input: TokenInput,
): Promise<TokenRecord> {
  let normalized =
    normalizeTokenInput(
      input,
    );

  normalized =
    await validateTokenRelationships(
      normalized,
    );

  if (
    await tokenNameExistsInScope(
      normalized.displayName,

      normalized.associatedCharacterId,

      normalized.associatedCollectionId,

      id,
    )
  ) {
    throw new Error(
      "A token with this display name already exists for the selected Character/Collection.",
    );
  }

  const db =
    getEditorDatabase();

  const result =
    await db.execute(
      `
      UPDATE tokens
      SET
        display_name = $1,
        token_type = $2,
        rarity = $3,
        associated_character_id = $4,
        associated_collection_id = $5,
        sort_order = $6,
        is_active = $7,
        notes = $8
      WHERE id = $9
      `,
      [
        normalized.displayName,
        normalized.tokenType,
        normalized.rarity,

        normalized.associatedCharacterId,

        normalized.associatedCollectionId,

        normalized.sortOrder,

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
      "The token could not be updated because its record was not found.",
    );
  }

  const tokens =
    await loadTokens();

  const saved =
    tokens.find(
      (token) =>
        token.id === id,
    );

  if (!saved) {
    throw new Error(
      "The token was updated, but its record could not be reloaded.",
    );
  }

  return saved;
}