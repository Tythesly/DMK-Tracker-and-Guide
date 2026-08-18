import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  confirm,
} from "@tauri-apps/plugin-dialog";

import {
  createToken,
  getNextTokenSortOrder,
  loadCharacters,
  loadCollections,
  loadTokens,
  previewTokenStableId,
  updateToken,
} from "../data/editorData";

import type {
  CharacterRecord,
  CollectionRecord,
  TokenInput,
  TokenRecord,
  TokenRarity,
} from "../types/editor";

type EditorMode =
  | "create"
  | "edit"
  | null;

type TokenFormState = {
  displayName: string;
  tokenType: string;

  rarity:
    | ""
    | TokenRarity;

  associatedCharacterId:
    string;

  associatedCollectionId:
    string;

  sortOrder: string;

  isActive: boolean;
  notes: string;
};

type TokensEditorPageProps = {
  onDirtyChange: (
    dirty: boolean,
  ) => void;
};

const emptyTokenForm: TokenFormState =
  {
    displayName: "",
    tokenType: "",

    rarity: "",

    associatedCharacterId:
      "",

    associatedCollectionId:
      "",

    sortOrder: "0",

    isActive: true,
    notes: "",
  };

function normalizeTokenType(
  tokenType: string,
) {
  if (
    tokenType
      .trim()
      .toLowerCase() ===
    "common token"
  ) {
    return "Shared Token";
  }

  return tokenType;
}

function tokenToForm(
  token: TokenRecord,
): TokenFormState {
  return {
    displayName:
      token.displayName,

    tokenType:
      normalizeTokenType(
        token.tokenType,
      ),

    rarity:
      token.rarity ?? "",

    associatedCharacterId:
      token.associatedCharacterId ??
      "",

    associatedCollectionId:
      token.associatedCollectionId ??
      "",

    sortOrder:
      String(
        token.sortOrder,
      ),

    isActive:
      token.isActive,

    notes:
      token.notes,
  };
}

function formsMatch(
  first: TokenFormState,
  second: TokenFormState,
) {
  return (
    first.displayName ===
      second.displayName &&
    first.tokenType ===
      second.tokenType &&
    first.rarity ===
      second.rarity &&
    first.associatedCharacterId ===
      second.associatedCharacterId &&
    first.associatedCollectionId ===
      second.associatedCollectionId &&
    first.sortOrder ===
      second.sortOrder &&
    first.isActive ===
      second.isActive &&
    first.notes ===
      second.notes
  );
}

function formatRarity(
  rarity: TokenRarity | null,
) {
  if (!rarity) {
    return "Unspecified";
  }

  return (
    rarity.charAt(0).toUpperCase() +
    rarity.slice(1)
  );
}

function TokensEditorPage({
  onDirtyChange,
}: TokensEditorPageProps) {
  const [
    collections,
    setCollections,
  ] = useState<
    CollectionRecord[]
  >([]);

  const [
    characters,
    setCharacters,
  ] = useState<
    CharacterRecord[]
  >([]);

  const [
    tokens,
    setTokens,
  ] = useState<
    TokenRecord[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    searchText,
    setSearchText,
  ] = useState("");

  const [
    editorMode,
    setEditorMode,
  ] =
    useState<EditorMode>(
      null,
    );

  const [
    editingId,
    setEditingId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    form,
    setForm,
  ] =
    useState<TokenFormState>(
      emptyTokenForm,
    );

  const [
    originalForm,
    setOriginalForm,
  ] =
    useState<TokenFormState>(
      emptyTokenForm,
    );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    formError,
    setFormError,
  ] =
    useState<string | null>(
      null,
    );

  const isDirty =
    editorMode !== null &&
    !formsMatch(
      form,
      originalForm,
    );

  useEffect(() => {
    onDirtyChange(
      isDirty,
    );
  }, [
    isDirty,
    onDirtyChange,
  ]);

  const duplicateCharacterNames =
    useMemo(() => {
      const counts =
        new Map<
          string,
          number
        >();

      for (
        const character
        of characters
      ) {
        const key =
          character.displayName
            .trim()
            .toLowerCase();

        counts.set(
          key,
          (counts.get(key) ?? 0) +
            1,
        );
      }

      const duplicates =
        new Set<string>();

      for (
        const [
          name,
          count,
        ] of counts
      ) {
        if (count > 1) {
          duplicates.add(
            name,
          );
        }
      }

      return duplicates;
    }, [characters]);

  function characterOptionLabel(
    character: CharacterRecord,
  ) {
    const key =
      character.displayName
        .trim()
        .toLowerCase();

    if (
      duplicateCharacterNames.has(
        key,
      )
    ) {
      return `${character.displayName} — ${character.collectionName}`;
    }

    return character.displayName;
  }

  const filteredTokens =
    useMemo(() => {
      const search =
        searchText
          .trim()
          .toLowerCase();

      if (!search) {
        return tokens;
      }

      return tokens.filter(
        (token) =>
          token.displayName
            .toLowerCase()
            .includes(search),
      );
    }, [
      tokens,
      searchText,
    ]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);

      try {
        const [
          loadedCollections,
          loadedCharacters,
          loadedTokens,
        ] =
          await Promise.all([
            loadCollections(),
            loadCharacters(),
            loadTokens(),
          ]);

        if (cancelled) {
          return;
        }

        setCollections(
          loadedCollections,
        );

        setCharacters(
          loadedCharacters,
        );

        setTokens(
          loadedTokens,
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to load token editor data:",
            error,
          );

          setLoadError(
            error instanceof Error
              ? error.message
              : String(error),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function confirmDiscard() {
    if (!isDirty) {
      return true;
    }

    return confirm(
      "You have unsaved token changes. Discard them?",
      {
        title: "Unsaved Changes",
        kind: "warning",
        okLabel: "Discard Changes",
        cancelLabel: "Keep Editing",
      },
    );
  }

  function clearMessages() {
    setFormError(null);
  }

  async function startCreate() {
    if (!(await confirmDiscard())) {
      return;
    }

    clearMessages();

    try {
      const sortOrder =
        await getNextTokenSortOrder(
          null,
          null,
        );

      const newForm: TokenFormState =
        {
          ...emptyTokenForm,

          sortOrder:
            String(
              sortOrder,
            ),
        };

      setEditorMode(
        "create",
      );

      setEditingId(null);

      setForm(newForm);

      setOriginalForm(
        newForm,
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  async function startEdit(
    token: TokenRecord,
  ) {
    if (!(await confirmDiscard())) {
      return;
    }

    const editForm =
      tokenToForm(
        token,
      );

    setEditorMode(
      "edit",
    );

    setEditingId(
      token.id,
    );

    setForm(editForm);

    setOriginalForm(
      editForm,
    );

    clearMessages();
  }

  async function cancelEditor() {
    if (!(await confirmDiscard())) {
      return;
    }

    setEditorMode(null);
    setEditingId(null);

    setForm({
      ...emptyTokenForm,
    });

    setOriginalForm({
      ...emptyTokenForm,
    });

    clearMessages();
  }

  function updateForm<
    Key extends keyof TokenFormState,
  >(
    key: Key,
    value:
      TokenFormState[Key],
  ) {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );

    setFormError(null);
  }

  async function handleCharacterChange(
    characterId: string,
  ) {
    setFormError(null);

    if (!characterId) {
      const collectionId =
        form.associatedCollectionId ||
        null;

      const sortOrder =
        await getNextTokenSortOrder(
          null,
          collectionId,
        );

      setForm(
        (current) => ({
          ...current,

          associatedCharacterId:
            "",

          sortOrder:
            String(
              sortOrder,
            ),
        }),
      );

      return;
    }

    const character =
      characters.find(
        (item) =>
          item.id ===
          characterId,
      );

    if (!character) {
      setFormError(
        "The selected character could not be found.",
      );

      return;
    }

    try {
      const sortOrder =
        await getNextTokenSortOrder(
          character.id,
          character.collectionId,
        );

      setForm(
        (current) => ({
          ...current,

          associatedCharacterId:
            character.id,

          associatedCollectionId:
            character.collectionId,

          sortOrder:
            String(
              sortOrder,
            ),
        }),
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  async function handleCollectionChange(
    collectionId: string,
  ) {
    if (
      form.associatedCharacterId
    ) {
      return;
    }

    setFormError(null);

    try {
      const sortOrder =
        await getNextTokenSortOrder(
          null,

          collectionId ||
            null,
        );

      setForm(
        (current) => ({
          ...current,

          associatedCollectionId:
            collectionId,

          sortOrder:
            String(
              sortOrder,
            ),
        }),
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  async function refreshTokens() {
    const loaded =
      await loadTokens();

    setTokens(
      loaded,
    );
  }

  async function handleSave() {
    setFormError(null);

    const sortOrder =
      Number(
        form.sortOrder,
      );

    if (
      !Number.isInteger(
        sortOrder,
      ) ||
      sortOrder < 0
    ) {
      setFormError(
        "Sort Order must be a whole number of 0 or greater.",
      );

      return;
    }

    const input: TokenInput =
      {
        displayName:
          form.displayName,

        tokenType:
          form.tokenType,

        rarity:
          form.rarity ||
          null,

        associatedCharacterId:
          form.associatedCharacterId ||
          null,

        associatedCollectionId:
          form.associatedCollectionId ||
          null,

        sortOrder,

        isActive:
          form.isActive,

        notes:
          form.notes,
      };

    setSaving(true);

    try {
      if (
        editorMode ===
        "create"
      ) {
        await createToken(
          input,
        );
      } else if (
        editorMode ===
          "edit" &&
        editingId !== null
      ) {
        await updateToken(
          editingId,
          input,
        );
      } else {
        throw new Error(
          "No token is currently selected for editing.",
        );
      }

      await refreshTokens();

      setEditorMode(null);
      setEditingId(null);

      setForm({
        ...emptyTokenForm,
      });

      setOriginalForm({
        ...emptyTokenForm,
      });
    } catch (error) {
      console.error(
        "Failed to save token:",
        error,
      );

      setFormError(
        error instanceof Error
          ? error.message
          : String(error),
      );
    } finally {
      setSaving(false);
    }
  }

  const stableIdDisplay =
    editorMode === "edit" &&
    editingId !== null
      ? editingId
      : form.displayName.trim()
        ? previewTokenStableId(
            form.displayName,
          )
        : "Generated after a name is entered";

  const selectedCharacter =
    characters.find(
      (character) =>
        character.id ===
        form.associatedCharacterId,
    );

  return (
    <>
      <header className="manager-page-header">
        <div>
          <div className="manager-eyebrow">
            GAME DATA
          </div>

          <h1>
            Tokens & Rarity
          </h1>

          <p>
            Create and maintain
            tokens, rarity, and
            character or collection
            relationships.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() =>
            void startCreate()
          }
        >
          + Add Token
        </button>
      </header>

      <section className="database-status-bar">
        <div>
          <strong>
            Local Authoring Database
          </strong>

          <span>
            dmk-editor.db
          </span>
        </div>

        <div className="database-status-pill">
          Connected
        </div>
      </section>

      {loadError && (
        <div className="manager-error-banner">
          <strong>
            Unable to load
            tokens.
          </strong>

          <span>
            {loadError}
          </span>
        </div>
      )}

      <div className="collection-editor-layout">
        <section className="manager-panel">
          <div className="manager-panel-header">
            <div>
              <h2>
                Tokens
              </h2>

              <p>
                {
                  tokens.length
                }{" "}
                record
                {tokens.length ===
                1
                  ? ""
                  : "s"}
              </p>
            </div>

            <input
              type="search"
              className="manager-search"
              placeholder="Search token names..."
              value={
                searchText
              }
              onChange={(
                event,
              ) =>
                setSearchText(
                  event
                    .currentTarget
                    .value,
                )
              }
            />
          </div>

          {loading ? (
            <div className="manager-empty-state">
              Loading tokens...
            </div>
          ) : filteredTokens.length ===
            0 ? (
            <div className="manager-empty-state">
              {tokens.length ===
              0
                ? "No tokens have been created yet."
                : "No tokens match your search."}
            </div>
          ) : (
            <div className="manager-table-wrap">
              <table className="manager-table">
                <thead>
                  <tr>
                    <th>
                      Token
                    </th>

                    <th>
                      Type
                    </th>

                    <th>
                      Rarity
                    </th>

                    <th>
                      Associated With
                    </th>

                    <th>
                      Stable ID
                    </th>

                    <th className="number-column">
                      Sort
                    </th>

                    <th>
                      Status
                    </th>

                    <th className="action-column">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTokens.map(
                    (token) => (
                      <tr
                        key={
                          token.id
                        }
                        className={
                          editingId ===
                          token.id
                            ? "manager-table-row-selected"
                            : ""
                        }
                      >
                        <td>
                          <strong>
                            {
                              token.displayName
                            }
                          </strong>
                        </td>

                        <td>
                          {normalizeTokenType(
                            token.tokenType,
                          )}
                        </td>

                        <td>
                          <span className="record-pill">
                            {formatRarity(
                              token.rarity,
                            )}
                          </span>
                        </td>

                        <td>
                          {token.associatedCharacterName ? (
                            <>
                              {
                                token.associatedCharacterName
                              }
                              <br />
                              <small>
                                {
                                  token.associatedCollectionName
                                }
                              </small>
                            </>
                          ) : token.associatedCollectionName ? (
                            token.associatedCollectionName
                          ) : (
                            "None"
                          )}
                        </td>

                        <td>
                          <code>
                            {
                              token.id
                            }
                          </code>
                        </td>

                        <td className="number-column">
                          {
                            token.sortOrder
                          }
                        </td>

                        <td>
                          {token.isActive ? (
                            <span className="record-pill record-pill-active">
                              Active
                            </span>
                          ) : (
                            <span className="record-pill record-pill-inactive">
                              Inactive
                            </span>
                          )}
                        </td>

                        <td className="action-column">
                          <button
                            type="button"
                            className="table-edit-button"
                            onClick={() =>
                              void startEdit(
                                token,
                              )
                            }
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="manager-panel collection-form-panel">
          {editorMode ===
          null ? (
            <div className="editor-welcome-state">
              <div className="editor-welcome-icon">
                +
              </div>

              <h2>
                Select a token
              </h2>

              <p>
                Choose Edit from
                the token list,
                or create a new
                token.
              </p>

              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  void startCreate()
                }
              >
                Add Token
              </button>
            </div>
          ) : (
            <>
              <div className="manager-panel-header form-panel-header">
                <div>
                  <div className="manager-eyebrow">
                    {editorMode ===
                    "create"
                      ? "NEW RECORD"
                      : "EDIT RECORD"}
                  </div>

                  <h2>
                    {editorMode ===
                    "create"
                      ? "Add Token"
                      : form.displayName ||
                        "Edit Token"}
                  </h2>
                </div>

                {isDirty && (
                  <span className="unsaved-pill">
                    Unsaved
                  </span>
                )}
              </div>

              <div className="collection-form">
                <label className="form-field">
                  <span>
                    Display Name
                  </span>

                  <input
                    type="text"
                    value={
                      form.displayName
                    }
                    placeholder="Example: Mickey Balloon"
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "displayName",
                        event
                          .currentTarget
                          .value,
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>
                    Permanent
                    Stable ID
                  </span>

                  <input
                    type="text"
                    value={
                      stableIdDisplay
                    }
                    readOnly
                  />

                  <small>
                    {editorMode ===
                    "create"
                      ? "Generated automatically when the token is saved."
                      : "Locked permanently. Renaming the token will not change this ID."}
                  </small>
                </label>

                <label className="form-field">
                  <span>
                    Token Type
                  </span>

                  <select
                    value={
                      form.tokenType
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "tokenType",
                        event
                          .currentTarget
                          .value,
                      )
                    }
                  >
                    <option value="">
                      Select Token Type...
                    </option>

                    <option value="Shared Token">
                      Shared Token
                    </option>

                    <option value="Unique Token">
                      Unique Token
                    </option>

                    <option value="Ears Token">
                      Ears Token
                    </option>
                  </select>

                  <small>
                    Token Type and
                    Rarity are
                    separate DMK
                    properties.
                  </small>
                </label>

                <label className="form-field">
                  <span>
                    Rarity
                  </span>

                  <select
                    value={
                      form.rarity
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "rarity",
                        event
                          .currentTarget
                          .value as
                          | ""
                          | TokenRarity,
                      )
                    }
                  >
                    <option value="">
                      Unspecified
                    </option>

                    <option value="common">
                      Common
                    </option>

                    <option value="uncommon">
                      Uncommon
                    </option>

                    <option value="rare">
                      Rare
                    </option>

                    <option value="epic">
                      Epic
                    </option>

                    <option value="legendary">
                      Legendary
                    </option>

                    <option value="unknown">
                      Unknown
                    </option>
                  </select>
                </label>

                <label className="form-field">
                  <span>
                    Associated Character
                  </span>

                  <select
                    value={
                      form.associatedCharacterId
                    }
                    onChange={(
                      event,
                    ) =>
                      void handleCharacterChange(
                        event
                          .currentTarget
                          .value,
                      )
                    }
                  >
                    <option value="">
                      None
                    </option>

                    {characters.map(
                      (character) => (
                        <option
                          key={
                            character.id
                          }
                          value={
                            character.id
                          }
                        >
                          {characterOptionLabel(
                            character,
                          )}
                        </option>
                      ),
                    )}
                  </select>

                  <small>
                    Collection names
                    are shown only
                    when duplicate
                    character names
                    need to be
                    distinguished.
                  </small>
                </label>

                <label className="form-field">
                  <span>
                    Associated Collection
                  </span>

                  <select
                    value={
                      form.associatedCollectionId
                    }
                    disabled={
                      Boolean(
                        form.associatedCharacterId,
                      )
                    }
                    onChange={(
                      event,
                    ) =>
                      void handleCollectionChange(
                        event
                          .currentTarget
                          .value,
                      )
                    }
                  >
                    <option value="">
                      None
                    </option>

                    {collections.map(
                      (collection) => (
                        <option
                          key={
                            collection.id
                          }
                          value={
                            collection.id
                          }
                        >
                          {
                            collection.displayName
                          }
                          {!collection.isActive
                            ? " (Inactive)"
                            : ""}
                        </option>
                      ),
                    )}
                  </select>

                  <small>
                    {selectedCharacter
                      ? `Automatically linked to ${selectedCharacter.collectionName} because ${selectedCharacter.displayName} is selected.`
                      : "Use this for collection-level Shared Tokens."}
                  </small>
                </label>

                <label className="form-field">
                  <span>
                    Sort Order
                  </span>

                  <input
                    type="number"
                    value={
                      form.sortOrder
                    }
                    readOnly
                  />

                  <small>
                    Assigned automatically
                    within the selected
                    Character/Collection.
                  </small>
                </label>

                <div className="form-checkbox-group">
                  <label className="form-checkbox-row">
                    <input
                      type="checkbox"
                      checked={
                        form.isActive
                      }
                      onChange={(
                        event,
                      ) =>
                        updateForm(
                          "isActive",
                          event
                            .currentTarget
                            .checked,
                        )
                      }
                    />

                    <span>
                      <strong>
                        Active
                      </strong>

                      <small>
                        Active tokens
                        are available
                        for normal use.
                      </small>
                    </span>
                  </label>
                </div>

                <label className="form-field">
                  <span>
                    Notes
                  </span>

                  <textarea
                    rows={5}
                    value={
                      form.notes
                    }
                    placeholder="Optional editor notes..."
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "notes",
                        event
                          .currentTarget
                          .value,
                      )
                    }
                  />
                </label>

                {formError && (
                  <div className="form-message form-message-error">
                    {
                      formError
                    }
                  </div>
                )}

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      saving
                    }
                    onClick={() =>
                      void cancelEditor()
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      saving
                    }
                    onClick={() =>
                      void handleSave()
                    }
                  >
                    {saving
                      ? "Saving..."
                      : "Save Token"}
                  </button>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

export default TokensEditorPage;