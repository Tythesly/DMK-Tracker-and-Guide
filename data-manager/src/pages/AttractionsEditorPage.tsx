import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import {
  confirm,
} from "@tauri-apps/plugin-dialog";

import {
  createAttraction,
  getNextAttractionSortOrder,
  loadAttractionEnchantmentDefaults,
  loadAttractionGroups,
  loadAttractions,
  previewAttractionStableId,
  syncCollectionAttractionGroups,
  updateAttraction,
} from "../data/attractionData";

import {
  loadCharacters,
  loadCollections,
} from "../data/editorData";

import type {
  AttractionEnchantmentDefaultRecord,
  AttractionGroupRecord,
  AttractionInput,
  AttractionRecord,
} from "../types/attractionEditor";

import type {
  CharacterRecord,
  CollectionRecord,
} from "../types/editor";

import "./AttractionsEditorPage.css";

type AttractionsEditorPageProps = {
  onDirtyChange?: (
    dirty: boolean,
  ) => void;
};

type EditorMode =
  | "new"
  | "edit"
  | null;

type AttractionFormState = {
  groupId: string;
  displayName: string;
  sortOrder: string;
  obtainMagicCost: string;
  obtainElixirCost: string;
  obtainGemCost: string;
  obtainSourceText: string;
  requirementType: string;
  unlockQuestSourceName: string;
  requiredCharacterId: string;
  requiredCharacterLevel: string;
  buildQuestSourceName: string;
  otherRequirementText: string;
  enchantable: boolean;
  relicCollectionId: string;
  isActive: boolean;
  notes: string;
};

const EMPTY_FORM: AttractionFormState = {
  groupId: "",
  displayName: "",
  sortOrder: "0",
  obtainMagicCost: "",
  obtainElixirCost: "",
  obtainGemCost: "",
  obtainSourceText: "",
  requirementType: "None",
  unlockQuestSourceName: "",
  requiredCharacterId: "",
  requiredCharacterLevel: "",
  buildQuestSourceName: "",
  otherRequirementText: "",
  enchantable: false,
  relicCollectionId: "",
  isActive: true,
  notes: "",
};

function formatNumber(
  value: number,
) {
  return value.toLocaleString(
    "en-US",
  );
}

function formatDuration(
  seconds: number,
) {
  if (seconds === 0) {
    return "Instant";
  }

  const days = Math.floor(
    seconds / 86400,
  );

  const hours = Math.floor(
    (seconds % 86400) /
      3600,
  );

  const minutes = Math.floor(
    (seconds % 3600) /
      60,
  );

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  return parts.length > 0
    ? parts.join(" ")
    : `${seconds}s`;
}

function titleCase(
  value: string,
) {
  return value
    .split(/\s+/)
    .map((part) =>
      part.length === 0
        ? part
        : `${part[0].toUpperCase()}${part.slice(1)}`,
    )
    .join(" ");
}

function optionalInteger(
  value: string,
  label: string,
) {
  const trimmed =
    value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(
    trimmed.replace(/,/g, ""),
  );

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    throw new Error(
      `${label} must be a whole number of 0 or greater, or left blank.`,
    );
  }

  return parsed;
}

function requiredWholeNumber(
  value: string,
  label: string,
) {
  const parsed = Number(
    value.trim(),
  );

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    throw new Error(
      `${label} must be a whole number of 0 or greater.`,
    );
  }

  return parsed;
}

function formFromRecord(
  attraction: AttractionRecord,
): AttractionFormState {
  return {
    groupId:
      attraction.groupId,
    displayName:
      attraction.displayName,
    sortOrder:
      String(
        attraction.sortOrder,
      ),
    obtainMagicCost:
      attraction.obtainMagicCost ===
      null
        ? ""
        : String(
            attraction.obtainMagicCost,
          ),
    obtainElixirCost:
      attraction.obtainElixirCost ===
      null
        ? ""
        : String(
            attraction.obtainElixirCost,
          ),
    obtainGemCost:
      attraction.obtainGemCost ===
      null
        ? ""
        : String(
            attraction.obtainGemCost,
          ),
    obtainSourceText:
      attraction.obtainSourceText,
    requirementType:
      attraction.requirementType ??
      "None",
    unlockQuestSourceName:
      attraction.unlockQuestSourceName,
    requiredCharacterId:
      attraction.requiredCharacterId ??
      "",
    requiredCharacterLevel:
      attraction.requiredCharacterLevel ===
      null
        ? ""
        : String(
            attraction.requiredCharacterLevel,
          ),
    buildQuestSourceName:
      attraction.buildQuestSourceName,
    otherRequirementText:
      attraction.otherRequirementText,
    enchantable:
      attraction.maxEnchantmentLevel ===
      5,
    relicCollectionId:
      attraction.relicCollectionId ??
      "",
    isActive:
      attraction.isActive,
    notes: attraction.notes,
  };
}

function formFingerprint(
  form: AttractionFormState,
) {
  return JSON.stringify(form);
}

function attractionAcquisitionLabel(
  attraction: AttractionRecord,
) {
  const parts: string[] = [];

  if (
    attraction.obtainMagicCost !==
    null
  ) {
    parts.push(
      `${formatNumber(
        attraction.obtainMagicCost,
      )} Magic`,
    );
  }

  if (
    attraction.obtainElixirCost !==
    null
  ) {
    parts.push(
      `${formatNumber(
        attraction.obtainElixirCost,
      )} Elixir`,
    );
  }

  if (
    attraction.obtainGemCost !==
    null
  ) {
    parts.push(
      `${formatNumber(
        attraction.obtainGemCost,
      )} Gems`,
    );
  }

  if (
    parts.length === 0 &&
    attraction.obtainSourceText
  ) {
    return attraction.obtainSourceText;
  }

  return parts.length > 0
    ? parts.join(" · ")
    : "Not stored";
}

function AttractionsEditorPage({
  onDirtyChange,
}: AttractionsEditorPageProps) {
  const [
    groups,
    setGroups,
  ] = useState<
    AttractionGroupRecord[]
  >([]);

  const [
    attractions,
    setAttractions,
  ] = useState<
    AttractionRecord[]
  >([]);

  const [
    defaults,
    setDefaults,
  ] = useState<
    AttractionEnchantmentDefaultRecord[]
  >([]);

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
  ] = useState<string | null>(
    null,
  );

  const [
    saveError,
    setSaveError,
  ] = useState<string | null>(
    null,
  );

  const [
    saveMessage,
    setSaveMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    mode,
    setMode,
  ] = useState<EditorMode>(
    null,
  );

  const [
    editingId,
    setEditingId,
  ] = useState<string | null>(
    null,
  );

  const [
    form,
    setForm,
  ] = useState<AttractionFormState>(
    EMPTY_FORM,
  );

  const [
    initialFingerprint,
    setInitialFingerprint,
  ] = useState(
    formFingerprint(
      EMPTY_FORM,
    ),
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    groupFilter,
    setGroupFilter,
  ] = useState("");

  const dirty =
    mode !== null &&
    formFingerprint(form) !==
      initialFingerprint;

  useLayoutEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  async function refreshData() {
    await syncCollectionAttractionGroups();

    const [
      loadedGroups,
      loadedAttractions,
      loadedDefaults,
      loadedCollections,
      loadedCharacters,
    ] = await Promise.all([
      loadAttractionGroups(),
      loadAttractions(),
      loadAttractionEnchantmentDefaults(),
      loadCollections(),
      loadCharacters(),
    ]);

    setGroups(
      loadedGroups,
    );
    setAttractions(
      loadedAttractions,
    );
    setDefaults(
      loadedDefaults,
    );
    setCollections(
      loadedCollections,
    );
    setCharacters(
      loadedCharacters,
    );

    return {
      groups: loadedGroups,
      attractions:
        loadedAttractions,
    };
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);

      try {
        const result =
          await refreshData();

        if (cancelled) {
          return;
        }

        if (
          result.groups.length === 0
        ) {
          setLoadError(
            "No Attraction Groups are available. Add a Collection first.",
          );
        }
      } catch (error) {
        if (!cancelled) {
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

  const filteredAttractions =
    useMemo(() => {
      const normalizedSearch =
        search.trim().toLowerCase();

      return attractions.filter(
        (attraction) => {
          if (
            groupFilter &&
            attraction.groupId !==
              groupFilter
          ) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          return attraction.displayName
            .toLowerCase()
            .includes(
              normalizedSearch,
            );
        },
      );
    }, [
      attractions,
      groupFilter,
      search,
    ]);

  const selectedGroup =
    groups.find(
      (group) =>
        group.id === form.groupId,
    ) ?? null;

  const stableIdPreview =
    mode === "edit" &&
    editingId
      ? editingId
      : previewAttractionStableId(
          form.displayName,
        );

  const sortedCollections =
    useMemo(
      () =>
        [...collections].sort(
          (a, b) =>
            a.sortOrder -
              b.sortOrder ||
            a.displayName.localeCompare(
              b.displayName,
            ),
        ),
      [collections],
    );

  const sortedCharacters =
    useMemo(
      () =>
        [...characters].sort(
          (a, b) =>
            a.collectionName.localeCompare(
              b.collectionName,
            ) ||
            a.sortOrder -
              b.sortOrder ||
            a.displayName.localeCompare(
              b.displayName,
            ),
        ),
      [characters],
    );

  async function canDiscardChanges() {
    if (!dirty) {
      return true;
    }

    return confirm(
      "You have unsaved Attraction changes. Discard them?",
      {
        title: "Unsaved Changes",
        kind: "warning",
        okLabel: "Discard Changes",
        cancelLabel: "Keep Editing",
      },
    );
  }

  async function beginNew() {
    if (!(await canDiscardChanges())) {
      return;
    }

    setSaveError(null);
    setSaveMessage(null);

    const firstGroup =
      groups[0] ?? null;

    if (!firstGroup) {
      setSaveError(
        "No Attraction Group is available.",
      );
      return;
    }

    try {
      const sortOrder =
        await getNextAttractionSortOrder(
          firstGroup.id,
        );

      const nextForm: AttractionFormState = {
        ...EMPTY_FORM,
        groupId: firstGroup.id,
        sortOrder:
          String(sortOrder),
      };

      setMode("new");
      setEditingId(null);
      setForm(nextForm);
      setInitialFingerprint(
        formFingerprint(
          nextForm,
        ),
      );
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  async function beginEdit(
    attraction: AttractionRecord,
  ) {
    if (!(await canDiscardChanges())) {
      return;
    }

    const nextForm =
      formFromRecord(
        attraction,
      );

    setSaveError(null);
    setSaveMessage(null);
    setMode("edit");
    setEditingId(
      attraction.id,
    );
    setForm(nextForm);
    setInitialFingerprint(
      formFingerprint(
        nextForm,
      ),
    );
  }

  async function closeEditor() {
    if (!(await canDiscardChanges())) {
      return;
    }

    setMode(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setInitialFingerprint(
      formFingerprint(
        EMPTY_FORM,
      ),
    );
    setSaveError(null);
  }

  async function changeGroup(
    groupId: string,
  ) {
    const group =
      groups.find(
        (candidate) =>
          candidate.id === groupId,
      ) ?? null;

    try {
      const sortOrder =
        await getNextAttractionSortOrder(
          groupId,
        );

      setForm((current) => {
        const shouldUseGroupRelics =
          current.enchantable &&
          group?.collectionId;

        return {
          ...current,
          groupId,
          sortOrder:
            String(sortOrder),
          relicCollectionId:
            shouldUseGroupRelics
              ? group.collectionId ?? ""
              : current.relicCollectionId,
        };
      });
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  function changeEnchantable(
    enchantable: boolean,
  ) {
    setForm((current) => ({
      ...current,
      enchantable,
      relicCollectionId:
        enchantable
          ? current.relicCollectionId ||
            selectedGroup?.collectionId ||
            ""
          : "",
    }));
  }

  function buildInput(): AttractionInput {
    if (!form.groupId) {
      throw new Error(
        "Attraction Group is required.",
      );
    }

    if (!form.displayName.trim()) {
      throw new Error(
        "Display Name is required.",
      );
    }

    const requiredCharacterLevel =
      form.requiredCharacterLevel.trim()
        ? requiredWholeNumber(
            form.requiredCharacterLevel,
            "Required Character Level",
          )
        : null;

    if (
      requiredCharacterLevel !==
        null &&
      (requiredCharacterLevel < 1 ||
        requiredCharacterLevel > 10)
    ) {
      throw new Error(
        "Required Character Level must be between 1 and 10.",
      );
    }

    if (
      requiredCharacterLevel !==
        null &&
      !form.requiredCharacterId
    ) {
      throw new Error(
        "Select a Required Character before setting a Required Character Level.",
      );
    }

    return {
      groupId: form.groupId,
      displayName:
        form.displayName.trim(),
      sortOrder:
        requiredWholeNumber(
          form.sortOrder,
          "Sort Order",
        ),
      maxEnchantmentLevel:
        form.enchantable
          ? 5
          : 0,
      relicCollectionId:
        form.enchantable &&
        form.relicCollectionId
          ? form.relicCollectionId
          : null,
      obtainSourceText:
        form.obtainSourceText.trim(),
      obtainMagicCost:
        optionalInteger(
          form.obtainMagicCost,
          "Magic Cost",
        ),
      obtainElixirCost:
        optionalInteger(
          form.obtainElixirCost,
          "Elixir Cost",
        ),
      obtainGemCost:
        optionalInteger(
          form.obtainGemCost,
          "Gem Cost",
        ),
      requirementType:
        form.requirementType ||
        "None",
      unlockQuestSourceName:
        form.unlockQuestSourceName.trim(),
      requiredCharacterId:
        form.requiredCharacterId ||
        null,
      requiredCharacterLevel,
      buildQuestSourceName:
        form.buildQuestSourceName.trim(),
      otherRequirementText:
        form.otherRequirementText.trim(),
      isActive: form.isActive,
      notes: form.notes.trim(),
    };
  }

  async function save() {
    setSaveError(null);
    setSaveMessage(null);
    setSaving(true);

    try {
      const input =
        buildInput();

      if (
        mode === "edit" &&
        editingId
      ) {
        await updateAttraction(
          editingId,
          input,
        );
      } else {
        await createAttraction(
          input,
        );
      }

      await refreshData();

      setMode(null);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setInitialFingerprint(
        formFingerprint(
          EMPTY_FORM,
        ),
      );
      setSaveMessage(
        mode === "edit"
          ? "Attraction updated."
          : "Attraction added.",
      );
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : String(error),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <header className="manager-page-header">
          <div>
            <div className="manager-eyebrow">
              GAME DATA
            </div>
            <h1>Attractions</h1>
            <p>
              Loading Attraction authoring data...
            </p>
          </div>
        </header>

        <section className="manager-panel manager-empty-state">
          Loading Attractions...
        </section>
      </>
    );
  }

  return (
    <>
      <header className="manager-page-header">
        <div>
          <div className="manager-eyebrow">
            GAME DATA
          </div>
          <h1>Attractions</h1>
          <p>
            Maintain attraction-specific data. Enchantment Levels 1–5 use the shared standard requirements automatically.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={
            groups.length === 0 ||
            saving
          }
          onClick={() =>
            void beginNew()
          }
        >
          + Add Attraction
        </button>
      </header>

      {loadError && (
        <div className="manager-error-banner">
          <strong>
            Unable to load Attractions
          </strong>
          <span>{loadError}</span>
        </div>
      )}

      {saveMessage && (
        <div className="attraction-success-banner">
          {saveMessage}
        </div>
      )}

      <section className="database-status-bar">
        <div>
          <strong>
            Attraction authoring database
          </strong>
          <span>
            {attractions.length.toLocaleString(
              "en-US",
            )}{" "}
            attractions · {groups.length.toLocaleString(
              "en-US",
            )}{" "}
            available groups
          </span>
        </div>

        <div className="database-status-pill">
          Schema Ready
        </div>
      </section>

      <div className="attraction-editor-layout">
        <section className="manager-panel attraction-list-panel">
          <div className="manager-panel-header attraction-list-header">
            <div>
              <h2>
                Attraction Records
              </h2>
              <p>
                Search uses Attraction Display Name only.
              </p>
            </div>

            <div className="attraction-list-filters">
              <select
                value={groupFilter}
                onChange={(event) =>
                  setGroupFilter(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  All Groups
                </option>
                {groups.map(
                  (group) => (
                    <option
                      key={group.id}
                      value={group.id}
                    >
                      {group.displayName}
                    </option>
                  ),
                )}
              </select>

              <input
                className="manager-search"
                type="search"
                placeholder="Search attractions..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
              />
            </div>
          </div>

          {filteredAttractions.length ===
          0 ? (
            <div className="manager-empty-state">
              {attractions.length === 0
                ? "No Attractions have been added yet."
                : "No Attractions match the current filters."}
            </div>
          ) : (
            <div className="manager-table-wrap">
              <table className="manager-table attraction-table">
                <thead>
                  <tr>
                    <th>Attraction</th>
                    <th>Group</th>
                    <th>Obtain</th>
                    <th>Enchant</th>
                    <th>Status</th>
                    <th className="action-column">
                      Edit
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAttractions.map(
                    (attraction) => (
                      <tr
                        key={attraction.id}
                        className={
                          editingId ===
                          attraction.id
                            ? "manager-table-row-selected"
                            : undefined
                        }
                      >
                        <td>
                          <strong>
                            {attraction.displayName}
                          </strong>
                          <div className="attraction-table-subtext">
                            #{attraction.sortOrder}
                          </div>
                        </td>

                        <td>
                          {attraction.groupName}
                        </td>

                        <td className="attraction-table-acquisition">
                          {attractionAcquisitionLabel(
                            attraction,
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              attraction.maxEnchantmentLevel ===
                              5
                                ? "record-pill record-pill-active"
                                : "record-pill"
                            }
                          >
                            {attraction.maxEnchantmentLevel ===
                            5
                              ? "Levels 1–5"
                              : "No"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              attraction.isActive
                                ? "record-pill record-pill-active"
                                : "record-pill record-pill-inactive"
                            }
                          >
                            {attraction.isActive
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        <td className="action-column">
                          <button
                            type="button"
                            className="table-edit-button"
                            onClick={() =>
                              void beginEdit(
                                attraction,
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

        <aside className="manager-panel attraction-form-panel">
          {mode === null ? (
            <div className="editor-welcome-state attraction-welcome-state">
              <div className="editor-welcome-icon">
                +
              </div>
              <h2>
                Attraction Editor
              </h2>
              <p>
                Add a new Attraction or choose Edit from the table.
              </p>
              <button
                type="button"
                className="primary-button"
                disabled={
                  groups.length === 0
                }
                onClick={() =>
                  void beginNew()
                }
              >
                Add Attraction
              </button>
            </div>
          ) : (
            <>
              <div className="manager-panel-header form-panel-header">
                <div>
                  <h2>
                    {mode === "new"
                      ? "Add Attraction"
                      : "Edit Attraction"}
                  </h2>
                  <p>
                    Attraction-specific source and authoring data.
                  </p>
                </div>

                {dirty && (
                  <span className="unsaved-pill">
                    Unsaved
                  </span>
                )}
              </div>

              <div
                className="attraction-form"
                onChangeCapture={() => {
                  if (mode !== null) {
                    onDirtyChange?.(true);
                  }
                }}
              >
                <section className="attraction-form-section">
                  <div className="attraction-form-section-title">
                    Identity
                  </div>

                  <label className="form-field">
                    <span>
                      Display Name
                    </span>
                    <input
                      value={form.displayName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          displayName:
                            event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="form-field">
                    <span>
                      Stable ID
                    </span>
                    <input
                      readOnly
                      value={stableIdPreview}
                    />
                    <small>
                      Generated from the Display Name and immutable after save.
                    </small>
                  </label>

                  <label className="form-field">
                    <span>
                      Collection / Group
                    </span>
                    <select
                      value={form.groupId}
                      onChange={(event) =>
                        void changeGroup(
                          event.target.value,
                        )
                      }
                    >
                      {groups.map(
                        (group) => (
                          <option
                            key={group.id}
                            value={group.id}
                          >
                            {group.displayName}
                            {group.collectionId
                              ? " — Collection"
                              : " — Special Group"}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className="form-field">
                    <span>
                      Sort Order
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.sortOrder}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          sortOrder:
                            event.target.value,
                        }))
                      }
                    />
                    <small>
                      Order within the selected Attraction Group. Moving a record shifts the surrounding records automatically.
                    </small>
                  </label>
                </section>

                <section className="attraction-form-section">
                  <div className="attraction-form-section-title">
                    Acquisition
                  </div>

                  <div className="attraction-form-grid attraction-form-grid-three">
                    <label className="form-field">
                      <span>Magic</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Unknown"
                        value={form.obtainMagicCost}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            obtainMagicCost:
                              event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>Elixir</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Unknown"
                        value={form.obtainElixirCost}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            obtainElixirCost:
                              event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>Gems</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Unknown"
                        value={form.obtainGemCost}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            obtainGemCost:
                              event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <label className="form-field">
                    <span>
                      Other Obtain Source
                    </span>
                    <textarea
                      rows={2}
                      placeholder="Event reward, bundle, chest, special source, etc."
                      value={form.obtainSourceText}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          obtainSourceText:
                            event.target.value,
                        }))
                      }
                    />
                  </label>
                </section>

                <section className="attraction-form-section">
                  <div className="attraction-form-section-title">
                    Requirements
                  </div>

                  <label className="form-field">
                    <span>
                      Requirement Type
                    </span>
                    <select
                      value={form.requirementType}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          requirementType:
                            event.target.value,
                        }))
                      }
                    >
                      <option value="None">
                        None
                      </option>
                      <option value="Quest">
                        Quest
                      </option>
                      <option value="Character Level">
                        Character Level
                      </option>
                      <option value="Quest + Character Level">
                        Quest + Character Level
                      </option>
                      <option value="Other">
                        Other
                      </option>
                    </select>
                  </label>

                  <label className="form-field">
                    <span>
                      Unlock Quest — Source Name
                    </span>
                    <input
                      value={form.unlockQuestSourceName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          unlockQuestSourceName:
                            event.target.value,
                        }))
                      }
                    />
                    <small>
                      Temporary source-name reference. We will link this to the Quest model when Quests are built.
                    </small>
                  </label>

                  <div className="attraction-form-grid attraction-form-grid-character">
                    <label className="form-field">
                      <span>
                        Required Character
                      </span>
                      <select
                        value={form.requiredCharacterId}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            requiredCharacterId:
                              event.target.value,
                            requiredCharacterLevel:
                              event.target.value
                                ? current.requiredCharacterLevel
                                : "",
                          }))
                        }
                      >
                        <option value="">
                          None / Unknown
                        </option>
                        {sortedCharacters.map(
                          (character) => (
                            <option
                              key={character.id}
                              value={character.id}
                            >
                              {character.displayName} — {character.collectionName}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    <label className="form-field attraction-character-level-field">
                      <span>Level</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="1"
                        disabled={!form.requiredCharacterId}
                        value={form.requiredCharacterLevel}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            requiredCharacterLevel:
                              event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <label className="form-field">
                    <span>
                      Build Quest — Source Name
                    </span>
                    <input
                      value={form.buildQuestSourceName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          buildQuestSourceName:
                            event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="form-field">
                    <span>
                      Other Requirement
                    </span>
                    <textarea
                      rows={2}
                      value={form.otherRequirementText}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          otherRequirementText:
                            event.target.value,
                        }))
                      }
                    />
                  </label>
                </section>

                <section className="attraction-form-section">
                  <div className="attraction-form-section-title">
                    Enchantment
                  </div>

                  <label className="form-checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.enchantable}
                      onChange={(event) =>
                        changeEnchantable(
                          event.target.checked,
                        )
                      }
                    />
                    <span>
                      <strong>
                        Enchantable
                      </strong>
                      <small>
                        Uses the shared standard requirements for Levels 1–5 automatically.
                      </small>
                    </span>
                  </label>

                  {form.enchantable && (
                    <>
                      <label className="form-field">
                        <span>
                          Relic Collection
                        </span>
                        <select
                          value={form.relicCollectionId}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              relicCollectionId:
                                event.target.value,
                            }))
                          }
                        >
                          <option value="">
                            Unknown / Not Assigned
                          </option>
                          {sortedCollections.map(
                            (collection) => (
                              <option
                                key={collection.id}
                                value={collection.id}
                              >
                                {collection.displayName}
                              </option>
                            ),
                          )}
                        </select>
                      </label>

                      <div className="attraction-defaults-card">
                        <div className="attraction-defaults-heading">
                          <div>
                            <strong>
                              Standard Levels 1–5
                            </strong>
                            <span>
                              Read-only global defaults
                            </span>
                          </div>
                          <span className="record-pill record-pill-active">
                            Automatic
                          </span>
                        </div>

                        <div className="attraction-defaults-table-wrap">
                          <table className="attraction-defaults-table">
                            <thead>
                              <tr>
                                <th>Lvl</th>
                                <th>Blueprint</th>
                                <th>Relics</th>
                                <th>Magic</th>
                                <th>Time</th>
                              </tr>
                            </thead>
                            <tbody>
                              {defaults.map(
                                (level) => (
                                  <tr
                                    key={level.targetLevel}
                                  >
                                    <td>
                                      {level.targetLevel}
                                    </td>
                                    <td>
                                      {titleCase(
                                        level.blueprintRarity,
                                      )}{" "}
                                      × {formatNumber(
                                        level.blueprintQuantity,
                                      )}
                                    </td>
                                    <td>
                                      {formatNumber(
                                        level.relicQuantity,
                                      )}
                                    </td>
                                    <td>
                                      {formatNumber(
                                        level.magicCost,
                                      )}
                                    </td>
                                    <td>
                                      {formatDuration(
                                        level.levelTimeSeconds,
                                      )}
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>

                        <p>
                          Attraction-specific level records are reserved for real exceptions detected by the Master importer; they are not manually entered here.
                        </p>
                      </div>
                    </>
                  )}
                </section>

                <section className="attraction-form-section">
                  <div className="attraction-form-section-title">
                    Record Status
                  </div>

                  <label className="form-checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          isActive:
                            event.target.checked,
                        }))
                      }
                    />
                    <span>
                      <strong>Active</strong>
                      <small>
                        Keep old records by marking them inactive instead of deleting them.
                      </small>
                    </span>
                  </label>

                  <label className="form-field">
                    <span>Notes</span>
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          notes:
                            event.target.value,
                        }))
                      }
                    />
                  </label>
                </section>

                {saveError && (
                  <div className="form-message form-message-error">
                    {saveError}
                  </div>
                )}

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={saving}
                    onClick={() =>
                      void closeEditor()
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={saving}
                    onClick={() =>
                      void save()
                    }
                  >
                    {saving
                      ? "Saving..."
                      : "Save Attraction"}
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

export default AttractionsEditorPage;