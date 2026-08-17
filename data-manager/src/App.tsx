import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createCollection,
  loadCollections,
  previewCollectionStableId,
  updateCollection,
} from "./data/editorData";

import type {
  CollectionInput,
  CollectionRecord,
} from "./types/editor";

import "./App.css";

type EditorMode =
  | "create"
  | "edit"
  | null;

type CollectionFormState = {
  displayName: string;
  sortOrder: string;
  isLimitedTime: boolean;
  isActive: boolean;
  notes: string;
};

const emptyCollectionForm: CollectionFormState =
  {
    displayName: "",
    sortOrder: "0",
    isLimitedTime: false,
    isActive: true,
    notes: "",
  };

function collectionToForm(
  collection: CollectionRecord,
): CollectionFormState {
  return {
    displayName:
      collection.displayName,
    sortOrder:
      String(
        collection.sortOrder,
      ),
    isLimitedTime:
      collection.isLimitedTime,
    isActive:
      collection.isActive,
    notes:
      collection.notes,
  };
}

function formsMatch(
  first: CollectionFormState,
  second: CollectionFormState,
) {
  return (
    first.displayName ===
      second.displayName &&
    first.sortOrder ===
      second.sortOrder &&
    first.isLimitedTime ===
      second.isLimitedTime &&
    first.isActive ===
      second.isActive &&
    first.notes ===
      second.notes
  );
}

function App() {
  const [
    collections,
    setCollections,
  ] = useState<
    CollectionRecord[]
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
    useState<CollectionFormState>(
      emptyCollectionForm,
    );

  const [
    originalForm,
    setOriginalForm,
  ] =
    useState<CollectionFormState>(
      emptyCollectionForm,
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

  const [
    saveMessage,
    setSaveMessage,
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

  const filteredCollections =
    useMemo(() => {
      const normalizedSearch =
        searchText
          .trim()
          .toLowerCase();

      if (
        !normalizedSearch
      ) {
        return collections;
      }

      return collections.filter(
        (collection) =>
          collection.displayName
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          collection.id
            .toLowerCase()
            .includes(
              normalizedSearch,
            ),
      );
    }, [
      collections,
      searchText,
    ]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);

      try {
        const loaded =
          await loadCollections();

        if (!cancelled) {
          setCollections(
            loaded,
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to load collections:",
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
      "You have unsaved collection changes. Discard them?",
    );
  }

  function clearMessages() {
    setFormError(null);
    setSaveMessage(null);
  }

  function startCreate() {
    if (!confirmDiscard()) {
      return;
    }

    const newForm = {
      ...emptyCollectionForm,
    };

    setEditorMode(
      "create",
    );

    setEditingId(null);

    setForm(newForm);

    setOriginalForm(
      newForm,
    );

    clearMessages();
  }

  function startEdit(
    collection: CollectionRecord,
  ) {
    if (!confirmDiscard()) {
      return;
    }

    const editForm =
      collectionToForm(
        collection,
      );

    setEditorMode(
      "edit",
    );

    setEditingId(
      collection.id,
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
      ...emptyCollectionForm,
    });

    setOriginalForm({
      ...emptyCollectionForm,
    });

    clearMessages();
  }

  function updateForm<
    Key extends keyof CollectionFormState,
  >(
    key: Key,
    value:
      CollectionFormState[Key],
  ) {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );

    setFormError(null);
    setSaveMessage(null);
  }

  async function refreshCollections() {
    const loaded =
      await loadCollections();

    setCollections(
      loaded,
    );
  }

  async function handleSave() {
    setFormError(null);
    setSaveMessage(null);

    const sortOrder =
      Number(form.sortOrder);

    if (
      !Number.isInteger(
        sortOrder,
      )
    ) {
      setFormError(
        "Sort Order must be a whole number.",
      );

      return;
    }

    const input: CollectionInput =
      {
        displayName:
          form.displayName,
        sortOrder,
        isLimitedTime:
          form.isLimitedTime,
        isActive:
          form.isActive,
        notes:
          form.notes,
      };

    setSaving(true);

    try {
      let saved:
        CollectionRecord;

      if (
        editorMode ===
        "create"
      ) {
        saved =
          await createCollection(
            input,
          );
      } else if (
        editorMode ===
          "edit" &&
        editingId !== null
      ) {
        saved =
          await updateCollection(
            editingId,
            input,
          );
      } else {
        throw new Error(
          "No collection is currently selected for editing.",
        );
      }

      await refreshCollections();

      const savedForm =
        collectionToForm(
          saved,
        );

      setEditorMode(
        "edit",
      );

      setEditingId(
        saved.id,
      );

      setForm(
        savedForm,
      );

      setOriginalForm(
        savedForm,
      );

      setSaveMessage(
        `${saved.displayName} was saved successfully.`,
      );
    } catch (error) {
      console.error(
        "Failed to save collection:",
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
        ? previewCollectionStableId(
            form.displayName,
          )
        : "Generated after a name is entered";

  return (
    <div className="manager-shell">
      <aside className="manager-sidebar">
        <div className="manager-brand">
          <div className="manager-brand-mark">
            DMK
          </div>

          <div>
            <div className="manager-brand-title">
              Data Manager
            </div>

            <div className="manager-brand-subtitle">
              PRIVATE AUTHORING TOOL
            </div>
          </div>
        </div>

        <div className="manager-nav-section">
          <div className="manager-nav-heading">
            GAME DATA
          </div>

          <button
            type="button"
            className="manager-nav-button manager-nav-button-active"
          >
            Collections
          </button>

          <button
            type="button"
            className="manager-nav-button"
            disabled
          >
            Characters
            <span>
              Soon
            </span>
          </button>

          <button
            type="button"
            className="manager-nav-button"
            disabled
          >
            Tokens
            <span>
              Soon
            </span>
          </button>

          <button
            type="button"
            className="manager-nav-button"
            disabled
          >
            Character Levels
            <span>
              Soon
            </span>
          </button>
        </div>

        <div className="manager-nav-section">
          <div className="manager-nav-heading">
            TOOLS
          </div>

          <button
            type="button"
            className="manager-nav-button"
            disabled
          >
            Validation
            <span>
              Soon
            </span>
          </button>

          <button
            type="button"
            className="manager-nav-button"
            disabled
          >
            Release Tools
            <span>
              Soon
            </span>
          </button>

          <button
            type="button"
            className="manager-nav-button"
            disabled
          >
            Settings
            <span>
              Soon
            </span>
          </button>
        </div>

        <div className="manager-sidebar-footer">
          <strong>
            AUTHORING DATABASE
          </strong>

          <span>
            dmk-editor.db
          </span>

          <span>
            Player progress is
            separate.
          </span>
        </div>
      </aside>

      <main className="manager-workspace">
        <header className="manager-page-header">
          <div>
            <div className="manager-eyebrow">
              GAME DATA
            </div>

            <h1>
              Collections
            </h1>

            <p>
              Create and maintain
              the collections used
              throughout DMK game
              data.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={
              startCreate
            }
          >
            + Add Collection
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
              collections.
            </strong>

            <span>
              {loadError}
            </span>
          </div>
        )}

        <div className="collection-editor-layout">
          <section className="manager-panel collection-list-panel">
            <div className="manager-panel-header">
              <div>
                <h2>
                  Collections
                </h2>

                <p>
                  {
                    collections.length
                  }{" "}
                  record
                  {collections.length ===
                  1
                    ? ""
                    : "s"}
                </p>
              </div>

              <input
                type="search"
                className="manager-search"
                placeholder="Search collections..."
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
                collections...
              </div>
            ) : filteredCollections.length ===
              0 ? (
              <div className="manager-empty-state">
                {collections.length ===
                0
                  ? "No collections have been created yet."
                  : "No collections match your search."}
              </div>
            ) : (
              <div className="manager-table-wrap">
                <table className="manager-table">
                  <thead>
                    <tr>
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
                        Type
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
                    {filteredCollections.map(
                      (
                        collection,
                      ) => (
                        <tr
                          key={
                            collection.id
                          }
                          className={
                            editingId ===
                            collection.id
                              ? "manager-table-row-selected"
                              : ""
                          }
                        >
                          <td>
                            <strong>
                              {
                                collection.displayName
                              }
                            </strong>
                          </td>

                          <td>
                            <code>
                              {
                                collection.id
                              }
                            </code>
                          </td>

                          <td className="number-column">
                            {
                              collection.sortOrder
                            }
                          </td>

                          <td>
                            {collection.isLimitedTime ? (
                              <span className="record-pill record-pill-limited">
                                Limited-Time
                              </span>
                            ) : (
                              <span className="record-pill">
                                Permanent
                              </span>
                            )}
                          </td>

                          <td>
                            {collection.isActive ? (
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
                                  collection,
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
                  Select a
                  collection
                </h2>

                <p>
                  Choose Edit from
                  the collection
                  list, or create a
                  new collection.
                </p>

                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    startCreate
                  }
                >
                  Add Collection
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
                        ? "Add Collection"
                        : form.displayName ||
                          "Edit Collection"}
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
                      placeholder="Example: Mickey and Friends"
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

                    <small>
                      The clean name
                      used throughout
                      the editor and
                      public
                      application.
                    </small>
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
                        ? "Generated automatically when the collection is saved."
                        : "Locked permanently. Renaming the collection will not change this ID."}
                    </small>
                  </label>

                  <label className="form-field">
                    <span>
                      Sort Order
                    </span>

                    <input
                      type="number"
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
                      Lower numbers
                      appear earlier
                      when collections
                      are sorted.
                    </small>
                  </label>

                  <div className="form-checkbox-group">
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
                          Mark this as
                          limited-time
                          game content.
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
                          Active records
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

                  {saveMessage && (
                    <div className="form-message form-message-success">
                      {
                        saveMessage
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
                        : "Save Collection"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

export default App;