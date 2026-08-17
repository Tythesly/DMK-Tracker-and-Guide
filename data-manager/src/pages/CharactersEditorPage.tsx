import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createCharacter,
  getNextCharacterSortOrder,
  loadCharacters,
  loadCollections,
  previewCharacterStableId,
  updateCharacter,
} from "../data/editorData";

import type {
  CharacterInput,
  CharacterRecord,
  CollectionRecord,
} from "../types/editor";

type EditorMode =
  | "create"
  | "edit"
  | null;

type CharacterFormState = {
  collectionId: string;
  displayName: string;
  sortOrder: string;
  isPremium: boolean;
  isLimitedTime: boolean;
  isActive: boolean;
  notes: string;
};

type CharactersEditorPageProps = {
  onDirtyChange: (
    dirty: boolean,
  ) => void;
};

const emptyCharacterForm: CharacterFormState =
  {
    collectionId: "",
    displayName: "",
    sortOrder: "0",
    isPremium: false,
    isLimitedTime: false,
    isActive: true,
    notes: "",
  };

function characterToForm(
  character: CharacterRecord,
): CharacterFormState {
  return {
    collectionId:
      character.collectionId,
    displayName:
      character.displayName,
    sortOrder:
      String(
        character.sortOrder,
      ),
    isPremium:
      character.isPremium,
    isLimitedTime:
      character.isLimitedTime,
    isActive:
      character.isActive,
    notes:
      character.notes,
  };
}

function formsMatch(
  first: CharacterFormState,
  second: CharacterFormState,
) {
  return (
    first.collectionId ===
      second.collectionId &&
    first.displayName ===
      second.displayName &&
    first.sortOrder ===
      second.sortOrder &&
    first.isPremium ===
      second.isPremium &&
    first.isLimitedTime ===
      second.isLimitedTime &&
    first.isActive ===
      second.isActive &&
    first.notes ===
      second.notes
  );
}

function CharactersEditorPage({
  onDirtyChange,
}: CharactersEditorPageProps) {
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
    useState<CharacterFormState>(
      emptyCharacterForm,
    );

  const [
    originalForm,
    setOriginalForm,
  ] =
    useState<CharacterFormState>(
      emptyCharacterForm,
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

  const activeCollections =
    useMemo(
      () =>
        collections.filter(
          (collection) =>
            collection.isActive,
        ),
      [collections],
    );

  const filteredCharacters =
    useMemo(() => {
      const normalizedSearch =
        searchText
          .trim()
          .toLowerCase();

      if (
        !normalizedSearch
      ) {
        return characters;
      }

      return characters.filter(
        (character) =>
          character.displayName
            .toLowerCase()
            .includes(
              normalizedSearch,
            ),
      );
    }, [
      characters,
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
        ] =
          await Promise.all([
            loadCollections(),
            loadCharacters(),
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
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to load character editor data:",
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

  function confirmDiscard() {
    if (!isDirty) {
      return true;
    }

    return window.confirm(
      "You have unsaved character changes. Discard them?",
    );
  }

  function clearMessages() {
    setFormError(null);
  }

  async function startCreate() {
    if (
      activeCollections.length ===
      0
    ) {
      return;
    }

    if (!confirmDiscard()) {
      return;
    }

    clearMessages();

    try {
      const collectionId =
        activeCollections[0].id;

      const nextSortOrder =
        await getNextCharacterSortOrder(
          collectionId,
        );

      const newForm: CharacterFormState =
        {
          ...emptyCharacterForm,
          collectionId,
          sortOrder:
            String(
              nextSortOrder,
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

  function startEdit(
    character: CharacterRecord,
  ) {
    if (!confirmDiscard()) {
      return;
    }

    const editForm =
      characterToForm(
        character,
      );

    setEditorMode(
      "edit",
    );

    setEditingId(
      character.id,
    );

    setForm(editForm);

    setOriginalForm(
      editForm,
    );

    clearMessages();
  }

  function cancelEditor() {
    if (!confirmDiscard()) {
      return;
    }

    setEditorMode(null);
    setEditingId(null);

    setForm({
      ...emptyCharacterForm,
    });

    setOriginalForm({
      ...emptyCharacterForm,
    });

    clearMessages();
  }

  function updateForm<
    Key extends keyof CharacterFormState,
  >(
    key: Key,
    value:
      CharacterFormState[Key],
  ) {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );

    setFormError(null);
  }

  async function handleCollectionChange(
    collectionId: string,
  ) {
    if (
      collectionId ===
      form.collectionId
    ) {
      return;
    }

    setFormError(null);

    try {
      const nextSortOrder =
        await getNextCharacterSortOrder(
          collectionId,
        );

      setForm(
        (current) => ({
          ...current,
          collectionId,
          sortOrder:
            String(
              nextSortOrder,
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

  async function refreshCharacters() {
    const loaded =
      await loadCharacters();

    setCharacters(
      loaded,
    );
  }

  async function handleSave() {
    setFormError(null);

    const sortOrder =
      Number(form.sortOrder);

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

    const input: CharacterInput =
      {
        collectionId:
          form.collectionId,
        displayName:
          form.displayName,
        sortOrder,
        isPremium:
          form.isPremium,
        isLimitedTime:
          form.isLimitedTime,
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
        await createCharacter(
          input,
        );
      } else if (
        editorMode ===
          "edit" &&
        editingId !== null
      ) {
        await updateCharacter(
          editingId,
          input,
        );
      } else {
        throw new Error(
          "No character is currently selected for editing.",
        );
      }

      await refreshCharacters();

      setEditorMode(null);
      setEditingId(null);

      setForm({
        ...emptyCharacterForm,
      });

      setOriginalForm({
        ...emptyCharacterForm,
      });
    } catch (error) {
      console.error(
        "Failed to save character:",
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
        ? previewCharacterStableId(
            form.displayName,
          )
        : "Generated after a name is entered";

  const selectableCollections =
    editorMode === "create"
      ? activeCollections
      : collections;

  return (
    <>
      <header className="manager-page-header">
        <div>
          <div className="manager-eyebrow">
            GAME DATA
          </div>

          <h1>
            Characters
          </h1>

          <p>
            Create and maintain
            characters and their
            collection
            relationships.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={
            activeCollections.length ===
            0
          }
          onClick={() =>
            void startCreate()
          }
        >
          + Add Character
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

      {activeCollections.length ===
        0 && (
        <div className="manager-warning-banner">
          <strong>
            An active collection
            is required before a
            character can be
            created.
          </strong>

          <span>
            Create or reactivate
            a Collection first.
          </span>
        </div>
      )}

      {loadError && (
        <div className="manager-error-banner">
          <strong>
            Unable to load
            characters.
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
                Characters
              </h2>

              <p>
                {
                  characters.length
                }{" "}
                record
                {characters.length ===
                1
                  ? ""
                  : "s"}
              </p>
            </div>

            <input
              type="search"
              className="manager-search"
              placeholder="Search character names..."
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
              Loading
              characters...
            </div>
          ) : filteredCharacters.length ===
            0 ? (
            <div className="manager-empty-state">
              {characters.length ===
              0
                ? "No characters have been created yet."
                : "No characters match your search."}
            </div>
          ) : (
            <div className="manager-table-wrap">
              <table className="manager-table">
                <thead>
                  <tr>
                    <th>
                      Character
                    </th>

                    <th>
                      Collection
                    </th>

                    <th>
                      Stable ID
                    </th>

                    <th className="number-column">
                      Sort
                    </th>

                    <th>
                      Flags
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
                  {filteredCharacters.map(
                    (
                      character,
                    ) => (
                      <tr
                        key={
                          character.id
                        }
                        className={
                          editingId ===
                          character.id
                            ? "manager-table-row-selected"
                            : ""
                        }
                      >
                        <td>
                          <strong>
                            {
                              character.displayName
                            }
                          </strong>
                        </td>

                        <td>
                          {
                            character.collectionName
                          }
                        </td>

                        <td>
                          <code>
                            {
                              character.id
                            }
                          </code>
                        </td>

                        <td className="number-column">
                          {
                            character.sortOrder
                          }
                        </td>

                        <td>
                          <div className="record-pill-group">
                            {character.isPremium && (
                              <span className="record-pill record-pill-premium">
                                Premium
                              </span>
                            )}

                            {character.isLimitedTime && (
                              <span className="record-pill record-pill-limited">
                                Limited-Time
                              </span>
                            )}

                            {!character.isPremium &&
                              !character.isLimitedTime && (
                                <span className="record-pill">
                                  Standard
                                </span>
                              )}
                          </div>
                        </td>

                        <td>
                          {character.isActive ? (
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
                              startEdit(
                                character,
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
                Select a character
              </h2>

              <p>
                Choose Edit from
                the character list,
                or create a new
                character.
              </p>

              <button
                type="button"
                className="primary-button"
                disabled={
                  activeCollections.length ===
                  0
                }
                onClick={() =>
                  void startCreate()
                }
              >
                Add Character
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
                      ? "Add Character"
                      : form.displayName ||
                        "Edit Character"}
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
                    placeholder="Example: Mickey Mouse"
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
                      ? "Generated automatically when the character is saved."
                      : "Locked permanently. Renaming the character will not change this ID."}
                  </small>
                </label>

                <label className="form-field">
                  <span>
                    Collection
                  </span>

                  <select
                    value={
                      form.collectionId
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
                    {selectableCollections.map(
                      (
                        collection,
                      ) => (
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
                    Relationships
                    use the
                    collection's
                    permanent stable
                    ID behind the
                    scenes.
                  </small>
                </label>

                <label className="form-field">
                  <span>
                    Sort Order
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      form.sortOrder
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "sortOrder",
                        event
                          .currentTarget
                          .value,
                      )
                    }
                  />

                  <small>
                    New characters
                    automatically use
                    the next
                    available position.
                    Enter an earlier
                    position to insert
                    the character there;
                    other characters
                    will be shifted
                    automatically.
                  </small>
                </label>

                <div className="form-checkbox-group">
                  <label className="form-checkbox-row">
                    <input
                      type="checkbox"
                      checked={
                        form.isPremium
                      }
                      onChange={(
                        event,
                      ) =>
                        updateForm(
                          "isPremium",
                          event
                            .currentTarget
                            .checked,
                        )
                      }
                    />

                    <span>
                      <strong>
                        Premium
                      </strong>

                      <small>
                        Mark the
                        character as
                        premium
                        content.
                      </small>
                    </span>
                  </label>

                  <label className="form-checkbox-row">
                    <input
                      type="checkbox"
                      checked={
                        form.isLimitedTime
                      }
                      onChange={(
                        event,
                      ) =>
                        updateForm(
                          "isLimitedTime",
                          event
                            .currentTarget
                            .checked,
                        )
                      }
                    />

                    <span>
                      <strong>
                        Limited-Time
                      </strong>

                      <small>
                        Mark the
                        character as
                        limited-time
                        content.
                      </small>
                    </span>
                  </label>

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
                        Active
                        characters are
                        available for
                        normal use.
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
                    onClick={
                      cancelEditor
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
                      : "Save Character"}
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

export default CharactersEditorPage;