import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  confirm,
} from "@tauri-apps/plugin-dialog";

import {
  loadCharacterLevels,
  saveCharacterLevel,
} from "../data/characterLevelData";

import {
  loadCharacters,
  loadTokens,
} from "../data/editorData";

import type {
  CharacterLevelInput,
  CharacterLevelRecord,
  CharacterRecord,
  TokenRecord,
  TokenRarity,
} from "../types/editor";

import "./CharacterLevelsEditorPage.css";

type CharacterLevelsEditorPageProps = {
  onDirtyChange: (
    dirty: boolean,
  ) => void;
};

type RequirementFormRow = {
  tokenId: string;
  quantity: string;
};

type LevelFormState = {
  magicCost: string;

  days: string;
  hours: string;
  minutes: string;
  seconds: string;

  requirements:
    RequirementFormRow[];
};

const emptyLevelForm: LevelFormState =
  {
    magicCost: "",

    days: "",
    hours: "",
    minutes: "",
    seconds: "",

    requirements: [],
  };

function formsMatch(
  first: LevelFormState,
  second: LevelFormState,
) {
  return (
    JSON.stringify(first) ===
    JSON.stringify(second)
  );
}

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

function formatRarity(
  rarity:
    TokenRarity | null,
) {
  if (!rarity) {
    return "";
  }

  return (
    rarity.charAt(0).toUpperCase() +
    rarity.slice(1)
  );
}

function formatNumber(
  value: number | null,
) {
  if (value === null) {
    return "—";
  }

  return value.toLocaleString();
}

function formatDuration(
  totalSeconds:
    number | null,
) {
  if (
    totalSeconds ===
    null
  ) {
    return "—";
  }

  if (
    totalSeconds === 0
  ) {
    return "0 seconds";
  }

  let remaining =
    totalSeconds;

  const days =
    Math.floor(
      remaining /
        86400,
    );

  remaining %=
    86400;

  const hours =
    Math.floor(
      remaining /
        3600,
    );

  remaining %=
    3600;

  const minutes =
    Math.floor(
      remaining /
        60,
    );

  const seconds =
    remaining % 60;

  const parts:
    string[] = [];

  if (days) {
    parts.push(
      `${days}d`,
    );
  }

  if (hours) {
    parts.push(
      `${hours}h`,
    );
  }

  if (minutes) {
    parts.push(
      `${minutes}m`,
    );
  }

  if (seconds) {
    parts.push(
      `${seconds}s`,
    );
  }

  return parts.join(" ");
}

function durationToForm(
  totalSeconds:
    number | null,
) {
  if (
    totalSeconds ===
    null
  ) {
    return {
      days: "",
      hours: "",
      minutes: "",
      seconds: "",
    };
  }

  let remaining =
    totalSeconds;

  const days =
    Math.floor(
      remaining /
        86400,
    );

  remaining %=
    86400;

  const hours =
    Math.floor(
      remaining /
        3600,
    );

  remaining %=
    3600;

  const minutes =
    Math.floor(
      remaining /
        60,
    );

  const seconds =
    remaining % 60;

  return {
    days:
      String(days),

    hours:
      String(hours),

    minutes:
      String(minutes),

    seconds:
      String(seconds),
  };
}

function levelToForm(
  level:
    CharacterLevelRecord | undefined,
): LevelFormState {
  if (!level) {
    return {
      ...emptyLevelForm,
      requirements: [],
    };
  }

  const duration =
    durationToForm(
      level.levelTimeSeconds,
    );

  return {
    magicCost:
      level.magicCost ===
      null
        ? ""
        : String(
            level.magicCost,
          ),

    ...duration,

    requirements:
      level.requirements.map(
        (
          requirement,
        ) => ({
          tokenId:
            requirement.tokenId,

          quantity:
            String(
              requirement.quantity,
            ),
        }),
      ),
  };
}

function CharacterLevelsEditorPage({
  onDirtyChange,
}: CharacterLevelsEditorPageProps) {
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
    selectedCharacterId,
    setSelectedCharacterId,
  ] = useState("");

  const [
    levels,
    setLevels,
  ] = useState<
    CharacterLevelRecord[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadingLevels,
    setLoadingLevels,
  ] = useState(false);

  const [
    loadError,
    setLoadError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    editorTargetLevel,
    setEditorTargetLevel,
  ] =
    useState<number | null>(
      null,
    );

  const [
    form,
    setForm,
  ] =
    useState<LevelFormState>(
      emptyLevelForm,
    );

  const [
    originalForm,
    setOriginalForm,
  ] =
    useState<LevelFormState>(
      emptyLevelForm,
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
    editorTargetLevel !==
      null &&
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

  const selectedCharacter =
    useMemo(
      () =>
        characters.find(
          (
            character,
          ) =>
            character.id ===
            selectedCharacterId,
        ) ?? null,
      [
        characters,
        selectedCharacterId,
      ],
    );

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
          (
            counts.get(
              key,
            ) ?? 0
          ) + 1,
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
    character:
      CharacterRecord,
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

  const relevantTokens =
    useMemo(() => {
      if (
        !selectedCharacter
      ) {
        return [];
      }

      const selectedIds =
        new Set(
          form.requirements.map(
            (
              requirement,
            ) =>
              requirement.tokenId,
          ),
        );

      return tokens.filter(
        (token) => {
          if (
            selectedIds.has(
              token.id,
            )
          ) {
            return true;
          }

          if (!token.isActive) {
            return false;
          }

          if (
            token.associatedCharacterId ===
            selectedCharacter.id
          ) {
            return true;
          }

          if (
            token.associatedCharacterId ===
              null &&
            token.associatedCollectionId ===
              selectedCharacter.collectionId
          ) {
            return true;
          }

          return false;
        },
      );
    }, [
      tokens,
      selectedCharacter,
      form.requirements,
    ]);

  const levelRows =
    useMemo(
      () =>
        Array.from(
          {
            length: 10,
          },
          (
            _,
            index,
          ) => {
            const targetLevel =
              index + 1;

            return {
              targetLevel,

              record:
                levels.find(
                  (level) =>
                    level.targetLevel ===
                    targetLevel,
                ),
            };
          },
        ),
      [levels],
    );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);

      try {
        const [
          loadedCharacters,
          loadedTokens,
        ] =
          await Promise.all([
            loadCharacters(),
            loadTokens(),
          ]);

        if (cancelled) {
          return;
        }

        setCharacters(
          loadedCharacters,
        );

        setTokens(
          loadedTokens,
        );

        if (
          loadedCharacters.length >
          0
        ) {
          setSelectedCharacterId(
            loadedCharacters[0].id,
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to load Character Levels editor data:",
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

  useEffect(() => {
    if (
      !selectedCharacterId
    ) {
      setLevels([]);
      return;
    }

    let cancelled = false;

    async function loadLevels() {
      setLoadingLevels(true);
      setLoadError(null);

      try {
        const loaded =
          await loadCharacterLevels(
            selectedCharacterId,
          );

        if (!cancelled) {
          setLevels(
            loaded,
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to load character levels:",
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
          setLoadingLevels(false);
        }
      }
    }

    void loadLevels();

    return () => {
      cancelled = true;
    };
  }, [selectedCharacterId]);

  async function confirmDiscard() {
    if (!isDirty) {
      return true;
    }

    return confirm(
      "You have unsaved Character Level changes. Discard them?",
      {
        title: "Unsaved Changes",
        kind: "warning",
        okLabel: "Discard Changes",
        cancelLabel: "Keep Editing",
      },
    );
  }

  function closeEditor() {
    setEditorTargetLevel(
      null,
    );

    setForm({
      ...emptyLevelForm,
      requirements: [],
    });

    setOriginalForm({
      ...emptyLevelForm,
      requirements: [],
    });

    setFormError(null);
  }

  async function cancelEditor() {
    if (!(await confirmDiscard())) {
      return;
    }

    closeEditor();
  }

  async function startEdit(
    targetLevel: number,
  ) {
    if (!(await confirmDiscard())) {
      return;
    }

    const level =
      levels.find(
        (record) =>
          record.targetLevel ===
          targetLevel,
      );

    const editForm =
      levelToForm(
        level,
      );

    setEditorTargetLevel(
      targetLevel,
    );

    setForm(
      editForm,
    );

    setOriginalForm(
      editForm,
    );

    setFormError(null);
  }

  function updateForm<
    Key extends
      keyof LevelFormState,
  >(
    key: Key,
    value:
      LevelFormState[Key],
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
    if (
      characterId ===
      selectedCharacterId
    ) {
      return;
    }

    if (!(await confirmDiscard())) {
      return;
    }

    closeEditor();

    setSelectedCharacterId(
      characterId,
    );
  }

  function addRequirement() {
    const alreadySelected =
      new Set(
        form.requirements.map(
          (
            requirement,
          ) =>
            requirement.tokenId,
        ),
      );

    const available =
      relevantTokens.find(
        (token) =>
          !alreadySelected.has(
            token.id,
          ),
      );

    if (!available) {
      setFormError(
        "There are no additional available tokens for this character.",
      );

      return;
    }

    updateForm(
      "requirements",
      [
        ...form.requirements,

        {
          tokenId:
            available.id,

          quantity: "1",
        },
      ],
    );
  }

  function updateRequirement(
    index: number,
    key:
      keyof RequirementFormRow,
    value: string,
  ) {
    const updated =
      form.requirements.map(
        (
          requirement,
          requirementIndex,
        ) =>
          requirementIndex ===
          index
            ? {
                ...requirement,
                [key]: value,
              }
            : requirement,
      );

    updateForm(
      "requirements",
      updated,
    );
  }

  function removeRequirement(
    index: number,
  ) {
    updateForm(
      "requirements",
      form.requirements.filter(
        (
          _,
          requirementIndex,
        ) =>
          requirementIndex !==
          index,
      ),
    );
  }

  function parseOptionalWholeNumber(
    value: string,
    label: string,
  ) {
    if (
      value.trim() === ""
    ) {
      return null;
    }

    const parsed =
      Number(value);

    if (
      !Number.isInteger(
        parsed,
      ) ||
      parsed < 0
    ) {
      throw new Error(
        `${label} must be a whole number of 0 or greater.`,
      );
    }

    return parsed;
  }

  function getDurationSeconds() {
    const values = [
      form.days,
      form.hours,
      form.minutes,
      form.seconds,
    ];

    if (
      values.every(
        (value) =>
          value.trim() ===
          "",
      )
    ) {
      return null;
    }

    const days =
      parseOptionalWholeNumber(
        form.days,
        "Days",
      ) ?? 0;

    const hours =
      parseOptionalWholeNumber(
        form.hours,
        "Hours",
      ) ?? 0;

    const minutes =
      parseOptionalWholeNumber(
        form.minutes,
        "Minutes",
      ) ?? 0;

    const seconds =
      parseOptionalWholeNumber(
        form.seconds,
        "Seconds",
      ) ?? 0;

    if (hours > 23) {
      throw new Error(
        "Hours must be between 0 and 23. Use Days for longer durations.",
      );
    }

    if (minutes > 59) {
      throw new Error(
        "Minutes must be between 0 and 59.",
      );
    }

    if (seconds > 59) {
      throw new Error(
        "Seconds must be between 0 and 59.",
      );
    }

    return (
      days * 86400 +
      hours * 3600 +
      minutes * 60 +
      seconds
    );
  }

  async function refreshLevels() {
    if (
      !selectedCharacterId
    ) {
      return;
    }

    const loaded =
      await loadCharacterLevels(
        selectedCharacterId,
      );

    setLevels(
      loaded,
    );
  }

  async function handleSave() {
    if (
      !selectedCharacter ||
      editorTargetLevel ===
        null
    ) {
      return;
    }

    setFormError(null);

    try {
      const magicCost =
        parseOptionalWholeNumber(
          form.magicCost,
          "Magic Cost",
        );

      const levelTimeSeconds =
        getDurationSeconds();

      const seenTokenIds =
        new Set<string>();

      const requirements =
        form.requirements.map(
          (
            requirement,
          ) => {
            if (
              !requirement.tokenId
            ) {
              throw new Error(
                "Every token requirement must select a token.",
              );
            }

            if (
              seenTokenIds.has(
                requirement.tokenId,
              )
            ) {
              throw new Error(
                "The same token cannot be required more than once for a level.",
              );
            }

            seenTokenIds.add(
              requirement.tokenId,
            );

            const quantity =
              Number(
                requirement.quantity,
              );

            if (
              !Number.isInteger(
                quantity,
              ) ||
              quantity <= 0
            ) {
              throw new Error(
                "Token quantities must be whole numbers greater than 0.",
              );
            }

            return {
              tokenId:
                requirement.tokenId,

              quantity,
            };
          },
        );

      const input:
        CharacterLevelInput =
        {
          characterId:
            selectedCharacter.id,

          targetLevel:
            editorTargetLevel,

          magicCost,

          levelTimeSeconds,

          requirements,
        };

      setSaving(true);

      await saveCharacterLevel(
        input,
      );

      await refreshLevels();

      closeEditor();
    } catch (error) {
      console.error(
        "Failed to save Character Level:",
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

  function tokenOptionLabel(
    token: TokenRecord,
  ) {
    const rarity =
      formatRarity(
        token.rarity,
      );

    const details = [
      normalizeTokenType(
        token.tokenType,
      ),
      rarity,
    ].filter(Boolean);

    return `${token.displayName} — ${details.join(" · ")}`;
  }

  return (
    <>
      <header className="manager-page-header">
        <div>
          <div className="manager-eyebrow">
            GAME DATA
          </div>

          <h1>
            Character Levels
          </h1>

          <p>
            Maintain Welcome and
            level-up costs, times,
            and token requirements.
          </p>
        </div>
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
            Character Levels.
          </strong>

          <span>
            {loadError}
          </span>
        </div>
      )}

      <section className="manager-panel levels-character-picker">
        <label className="form-field">
          <span>
            Character
          </span>

          <select
            value={
              selectedCharacterId
            }
            disabled={
              loading ||
              characters.length ===
                0
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
            {characters.length ===
            0 ? (
              <option value="">
                No characters
                available
              </option>
            ) : (
              characters.map(
                (
                  character,
                ) => (
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
              )
            )}
          </select>
        </label>

        {selectedCharacter && (
          <div className="levels-character-summary">
            <strong>
              {
                selectedCharacter.displayName
              }
            </strong>

            <span>
              {
                selectedCharacter.collectionName
              }
            </span>

            <span>
              Levels 1–10
            </span>
          </div>
        )}
      </section>

      <div className="levels-editor-layout">
        <section className="manager-panel">
          <div className="manager-panel-header">
            <div>
              <h2>
                Level Requirements
              </h2>

              <p>
                Level 1 is Welcome;
                Levels 2–10 are
                level-ups.
              </p>
            </div>
          </div>

          {loading ||
          loadingLevels ? (
            <div className="manager-empty-state">
              Loading Character
              Levels...
            </div>
          ) : !selectedCharacter ? (
            <div className="manager-empty-state">
              Create a Character
              before entering Level
              data.
            </div>
          ) : (
            <div className="manager-table-wrap">
              <table className="manager-table levels-table">
                <thead>
                  <tr>
                    <th>
                      Level
                    </th>

                    <th>
                      Phase
                    </th>

                    <th>
                      Magic
                    </th>

                    <th>
                      Time
                    </th>

                    <th>
                      Token Requirements
                    </th>

                    <th className="action-column">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {levelRows.map(
                    ({
                      targetLevel,
                      record,
                    }) => (
                      <tr
                        key={
                          targetLevel
                        }
                        className={
                          editorTargetLevel ===
                          targetLevel
                            ? "manager-table-row-selected"
                            : ""
                        }
                      >
                        <td>
                          <strong>
                            Level{" "}
                            {
                              targetLevel
                            }
                          </strong>
                        </td>

                        <td>
                          <span
                            className={
                              targetLevel ===
                              1
                                ? "level-phase-pill level-phase-welcome"
                                : "level-phase-pill"
                            }
                          >
                            {targetLevel ===
                            1
                              ? "Welcome"
                              : "Level Up"}
                          </span>
                        </td>

                        <td>
                          {record
                            ? formatNumber(
                                record.magicCost,
                              )
                            : "—"}
                        </td>

                        <td>
                          {record
                            ? formatDuration(
                                record.levelTimeSeconds,
                              )
                            : "—"}
                        </td>

                        <td className="levels-requirements-cell">
                          {!record ||
                          record
                            .requirements
                            .length ===
                            0 ? (
                            "—"
                          ) : (
                            record.requirements.map(
                              (
                                requirement,
                              ) => (
                                <span
                                  key={
                                    requirement.tokenId
                                  }
                                  className="level-requirement-summary"
                                >
                                  {
                                    requirement.tokenName
                                  }{" "}
                                  ×{" "}
                                  {
                                    requirement.quantity
                                  }
                                </span>
                              ),
                            )
                          )}
                        </td>

                        <td className="action-column">
                          <button
                            type="button"
                            className="table-edit-button"
                            onClick={() =>
                              void startEdit(
                                targetLevel,
                              )
                            }
                          >
                            {record
                              ? "Edit"
                              : "Add"}
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

        <aside className="manager-panel level-form-panel">
          {editorTargetLevel ===
          null ? (
            <div className="editor-welcome-state">
              <div className="editor-welcome-icon">
                +
              </div>

              <h2>
                Select a level
              </h2>

              <p>
                Choose Add or Edit
                beside one of the
                character's levels.
              </p>
            </div>
          ) : (
            <>
              <div className="manager-panel-header form-panel-header">
                <div>
                  <div className="manager-eyebrow">
                    {levels.some(
                      (
                        level,
                      ) =>
                        level.targetLevel ===
                        editorTargetLevel,
                    )
                      ? "EDIT LEVEL"
                      : "NEW LEVEL"}
                  </div>

                  <h2>
                    Level{" "}
                    {
                      editorTargetLevel
                    }
                    {editorTargetLevel ===
                    1
                      ? " — Welcome"
                      : ""}
                  </h2>
                </div>

                {isDirty && (
                  <span className="unsaved-pill">
                    Unsaved
                  </span>
                )}
              </div>

              <div className="level-form">
                <label className="form-field">
                  <span>
                    Magic Cost
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Unknown / not entered"
                    value={
                      form.magicCost
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "magicCost",
                        event
                          .currentTarget
                          .value,
                      )
                    }
                  />

                  <small>
                    Leave blank if
                    the cost is not
                    yet known.
                  </small>
                </label>

                <div className="level-form-section">
                  <div className="level-form-section-title">
                    {editorTargetLevel ===
                    1
                      ? "Welcome Time"
                      : "Level-Up Time"}
                  </div>

                  <div className="duration-grid">
                    <label className="form-field">
                      <span>
                        Days
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          form.days
                        }
                        onChange={(
                          event,
                        ) =>
                          updateForm(
                            "days",
                            event
                              .currentTarget
                              .value,
                          )
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>
                        Hours
                      </span>

                      <input
                        type="number"
                        min="0"
                        max="23"
                        step="1"
                        value={
                          form.hours
                        }
                        onChange={(
                          event,
                        ) =>
                          updateForm(
                            "hours",
                            event
                              .currentTarget
                              .value,
                          )
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>
                        Minutes
                      </span>

                      <input
                        type="number"
                        min="0"
                        max="59"
                        step="1"
                        value={
                          form.minutes
                        }
                        onChange={(
                          event,
                        ) =>
                          updateForm(
                            "minutes",
                            event
                              .currentTarget
                              .value,
                          )
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>
                        Seconds
                      </span>

                      <input
                        type="number"
                        min="0"
                        max="59"
                        step="1"
                        value={
                          form.seconds
                        }
                        onChange={(
                          event,
                        ) =>
                          updateForm(
                            "seconds",
                            event
                              .currentTarget
                              .value,
                          )
                        }
                      />
                    </label>
                  </div>

                  <small className="level-form-help">
                    Leave every time
                    field blank if
                    the time is not
                    known.
                  </small>
                </div>

                <div className="level-form-section">
                  <div className="requirements-header">
                    <div>
                      <div className="level-form-section-title">
                        Required Tokens
                      </div>

                      <small>
                        Shared and
                        character-specific
                        tokens for{" "}
                        {
                          selectedCharacter
                            ?.displayName
                        }.
                      </small>
                    </div>

                    <button
                      type="button"
                      className="secondary-button requirement-add-button"
                      onClick={
                        addRequirement
                      }
                    >
                      + Add Token
                    </button>
                  </div>

                  {form
                    .requirements
                    .length ===
                  0 ? (
                    <div className="requirements-empty">
                      No token
                      requirements
                      entered.
                    </div>
                  ) : (
                    <div className="requirements-list">
                      {form.requirements.map(
                        (
                          requirement,
                          index,
                        ) => {
                          const otherSelected =
                            new Set(
                              form.requirements
                                .filter(
                                  (
                                    _,
                                    requirementIndex,
                                  ) =>
                                    requirementIndex !==
                                    index,
                                )
                                .map(
                                  (
                                    item,
                                  ) =>
                                    item.tokenId,
                                ),
                            );

                          return (
                            <div
                              key={
                                index
                              }
                              className="requirement-row"
                            >
                              <label className="form-field requirement-token-field">
                                <span>
                                  Token
                                </span>

                                <select
                                  value={
                                    requirement.tokenId
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateRequirement(
                                      index,
                                      "tokenId",
                                      event
                                        .currentTarget
                                        .value,
                                    )
                                  }
                                >
                                  {relevantTokens.map(
                                    (
                                      token,
                                    ) => (
                                      <option
                                        key={
                                          token.id
                                        }
                                        value={
                                          token.id
                                        }
                                        disabled={
                                          otherSelected.has(
                                            token.id,
                                          )
                                        }
                                      >
                                        {tokenOptionLabel(
                                          token,
                                        )}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </label>

                              <label className="form-field requirement-quantity-field">
                                <span>
                                  Quantity
                                </span>

                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={
                                    requirement.quantity
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateRequirement(
                                      index,
                                      "quantity",
                                      event
                                        .currentTarget
                                        .value,
                                    )
                                  }
                                />
                              </label>

                              <button
                                type="button"
                                className="requirement-remove-button"
                                title="Remove token requirement"
                                aria-label="Remove token requirement"
                                onClick={() =>
                                  removeRequirement(
                                    index,
                                  )
                                }
                              >
                                ×
                              </button>
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}
                </div>

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
                      : "Save Level"}
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

export default CharacterLevelsEditorPage;