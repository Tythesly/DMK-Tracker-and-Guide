import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getAllCharacters,
  loadCharacterGameData,
} from "../data/gameData";

import {
  loadCharacterPlayerProgress,
  loadPlayerMagic,
  saveCharacterPlayerProgress,
} from "../data/playerData";

import type {
  Character,
  CharacterLevel,
  LevelRequirement,
  SaveStatus,
  Token,
  TokenQuantities,
} from "../types/dmk";

type CharacterDetailPageProps = {
  initialCharacterId?: string;
  onBack?: () => void;
  onSaveStatusChange?: (
    status: SaveStatus,
  ) => void;
};

function formatDuration(
  seconds: number | null,
) {
  if (seconds === null) {
    return "Not stored";
  }

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
    parts.push(
      `${days} ${
        days === 1
          ? "day"
          : "days"
      }`,
    );
  }

  if (hours > 0) {
    parts.push(
      `${hours} ${
        hours === 1
          ? "hour"
          : "hours"
      }`,
    );
  }

  if (minutes > 0) {
    parts.push(
      `${minutes} ${
        minutes === 1
          ? "minute"
          : "minutes"
      }`,
    );
  }

  return parts.length > 0
    ? parts.join(" ")
    : `${seconds} seconds`;
}

function formatNumber(
  value: number | null,
) {
  if (value === null) {
    return "Not stored";
  }

  return value.toLocaleString(
    "en-US",
  );
}

function getInitials(
  displayName: string,
) {
  const words =
    displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${words[0][0]}${
    words[
      words.length - 1
    ][0]
  }`.toUpperCase();
}

function normalizeTokenRarity(
  rarity: string | null,
) {
  const normalized =
    rarity
      ?.trim()
      .toLowerCase() ??
    "unknown";

  switch (normalized) {
    case "common":
    case "uncommon":
    case "rare":
    case "epic":
    case "legendary":
      return normalized;

    default:
      return "unknown";
  }
}

function formatTokenRarity(
  rarity: string | null,
) {
  const normalized =
    normalizeTokenRarity(
      rarity,
    );

  if (
    normalized === "unknown"
  ) {
    return "Unknown Rarity";
  }

  return (
    normalized
      .charAt(0)
      .toUpperCase() +
    normalized.slice(1)
  );
}

function getTokenRarityClass(
  rarity: string | null,
) {
  return `token-rarity-badge token-rarity-${normalizeTokenRarity(
    rarity,
  )}`;
}

function CharacterDetailPage({
  initialCharacterId,
  onBack,
  onSaveStatusChange,
}: CharacterDetailPageProps) {
  const [
    characters,
    setCharacters,
  ] = useState<Character[]>(
    [],
  );

  const [
    selectedCharacterId,
    setSelectedCharacterId,
  ] = useState("");

  const [
    character,
    setCharacter,
  ] =
    useState<Character | null>(
      null,
    );

  const [
    tokens,
    setTokens,
  ] = useState<Token[]>([]);

  const [
    requirements,
    setRequirements,
  ] = useState<
    LevelRequirement[]
  >([]);

  const [
    levels,
    setLevels,
  ] = useState<
    CharacterLevel[]
  >([]);

  const [
    isUnlocked,
    setIsUnlocked,
  ] = useState(false);

  const [
    currentLevel,
    setCurrentLevel,
  ] = useState(0);

  const [
    tokenQuantities,
    setTokenQuantities,
  ] =
    useState<TokenQuantities>(
      {},
    );

  const [
    magicQuantity,
    setMagicQuantity,
  ] = useState(0);

  const [
    loadingCharacters,
    setLoadingCharacters,
  ] = useState(true);

  const [
    loadingCharacter,
    setLoadingCharacter,
  ] = useState(false);

  const [
    saveStatus,
    setSaveStatus,
  ] =
    useState<SaveStatus>(
      "idle",
    );

  const [
    loadError,
    setLoadError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    saveError,
    setSaveError,
  ] =
    useState<string | null>(
      null,
    );

  const editVersionRef =
    useRef(0);

  useEffect(() => {
    onSaveStatusChange?.(
      saveStatus,
    );
  }, [
    onSaveStatusChange,
    saveStatus,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadCharacterList() {
      try {
        const loadedCharacters =
          await getAllCharacters();

        if (cancelled) {
          return;
        }

        if (
          loadedCharacters.length ===
          0
        ) {
          throw new Error(
            "No active characters were found in the game database.",
          );
        }

        setCharacters(
          loadedCharacters,
        );

        const requestedCharacterExists =
          initialCharacterId !==
            undefined &&
          loadedCharacters.some(
            (
              availableCharacter,
            ) =>
              availableCharacter.id ===
              initialCharacterId,
          );

        setSelectedCharacterId(
          requestedCharacterExists
            ? initialCharacterId
            : loadedCharacters[0]
                .id,
        );
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error
              ? err.message
              : String(err),
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingCharacters(
            false,
          );
        }
      }
    }

    loadCharacterList();

    return () => {
      cancelled = true;
    };
  }, [initialCharacterId]);

  useEffect(() => {
    if (
      !selectedCharacterId
    ) {
      return;
    }

    let cancelled = false;

    async function loadSelectedCharacter() {
      editVersionRef.current +=
        1;

      setLoadingCharacter(
        true,
      );

      setLoadError(null);
      setSaveError(null);
      setSaveStatus("idle");

      setCharacter(null);
      setTokens([]);
      setRequirements([]);
      setLevels([]);
      setTokenQuantities({});

      try {
        const {
          character:
            loadedCharacter,
          tokens:
            loadedTokens,
          requirements:
            loadedRequirements,
          levels:
            loadedLevels,
        } =
          await loadCharacterGameData(
            selectedCharacterId,
          );

        const [
          playerProgress,
          loadedMagicQuantity,
        ] = await Promise.all([
          loadCharacterPlayerProgress(
            selectedCharacterId,
            loadedTokens,
          ),
          loadPlayerMagic(),
        ]);

        if (cancelled) {
          return;
        }

        setCharacter(
          loadedCharacter,
        );

        setTokens(
          loadedTokens,
        );

        setRequirements(
          loadedRequirements,
        );

        setLevels(
          loadedLevels,
        );

        setIsUnlocked(
          playerProgress
            .isUnlocked,
        );

        setCurrentLevel(
          playerProgress
            .currentLevel,
        );

        setTokenQuantities(
          playerProgress
            .tokenQuantities,
        );

        setMagicQuantity(
          loadedMagicQuantity,
        );
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error
              ? err.message
              : String(err),
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingCharacter(
            false,
          );
        }
      }
    }

    loadSelectedCharacter();

    return () => {
      cancelled = true;
    };
  }, [
    selectedCharacterId,
  ]);

  function markEdited() {
    editVersionRef.current +=
      1;

    setSaveError(null);

    setSaveStatus(
      "pending",
    );
  }

  function handleUnlockedChange(
    checked: boolean,
  ) {
    setIsUnlocked(checked);

    if (!checked) {
      setCurrentLevel(0);
    } else if (
      currentLevel === 0
    ) {
      setCurrentLevel(1);
    }

    markEdited();
  }

  function handleLevelChange(
    level: number,
  ) {
    setCurrentLevel(level);

    if (level > 0) {
      setIsUnlocked(true);
    } else {
      setIsUnlocked(false);
    }

    markEdited();
  }

  function handleTokenChange(
    tokenId: string,
    value: string,
  ) {
    const parsedValue =
      Number.parseInt(
        value,
        10,
      );

    const safeValue =
      Number.isNaN(
        parsedValue,
      ) ||
      parsedValue < 0
        ? 0
        : parsedValue;

    setTokenQuantities(
      (current) => ({
        ...current,
        [tokenId]:
          safeValue,
      }),
    );

    markEdited();
  }

  useEffect(() => {
    if (
      loadingCharacter ||
      !character ||
      saveStatus !==
        "pending"
    ) {
      return;
    }

    const versionToSave =
      editVersionRef.current;

    const timeout =
      window.setTimeout(
        async () => {
          setSaveStatus(
            "saving",
          );

          setSaveError(null);

          try {
            await saveCharacterPlayerProgress(
              character.id,
              isUnlocked,
              currentLevel,
              tokens,
              tokenQuantities,
            );

            if (
              editVersionRef.current ===
              versionToSave
            ) {
              setSaveStatus(
                "saved",
              );
            } else {
              setSaveStatus(
                "pending",
              );
            }
          } catch (err) {
            if (
              editVersionRef.current ===
              versionToSave
            ) {
              setSaveStatus(
                "error",
              );

              setSaveError(
                err instanceof Error
                  ? err.message
                  : String(err),
              );
            } else {
              setSaveStatus(
                "pending",
              );
            }
          }
        },
        700,
      );

    return () => {
      window.clearTimeout(
        timeout,
      );
    };
  }, [
    character,
    currentLevel,
    isUnlocked,
    loadingCharacter,
    saveStatus,
    tokenQuantities,
    tokens,
  ]);

  if (loadingCharacters) {
    return (
      <main className="app-page">
        <header className="page-header">
          <div>
            <h1 className="page-title">
              Character Details
            </h1>

            <p className="page-subtitle">
              Loading
              characters...
            </p>
          </div>
        </header>

        <section className="page-state-card">
          Loading character
          data...
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="app-page">
        <header className="page-header">
          <div>
            <h1 className="page-title">
              Character Details
            </h1>

            <p className="page-subtitle">
              Unable to load
              tracker data
            </p>
          </div>
        </header>

        <section className="page-state-card page-state-error">
          <strong>
            Unable to load
            character
          </strong>

          <p>
            {loadError}
          </p>

          {onBack && (
            <button
              type="button"
              className="secondary-button"
              onClick={onBack}
            >
              Back to Characters
            </button>
          )}
        </section>
      </main>
    );
  }

  if (
    loadingCharacter ||
    !character
  ) {
    return (
      <main className="app-page">
        <header className="page-header">
          <div>
            <h1 className="page-title">
              Character Details
            </h1>

            <p className="page-subtitle">
              Loading selected
              character...
            </p>
          </div>
        </header>

        <section className="page-state-card">
          Loading selected
          character...
        </section>
      </main>
    );
  }

  const isMaximumLevel =
    currentLevel >=
    character.max_level;

  const isWelcomeState =
    currentLevel === 0 &&
    !isUnlocked;

  const targetLevel =
    isMaximumLevel
      ? null
      : isWelcomeState
        ? 1
        : currentLevel + 1;

  const activeRequirements =
    targetLevel === null
      ? []
      : requirements.filter(
          (requirement) =>
            requirement.target_level ===
            targetLevel,
        );

  const activeLevelData =
    targetLevel === null
      ? null
      : levels.find(
          (level) =>
            level.target_level ===
            targetLevel,
        ) ?? null;

  const activeMagicRequired =
    activeLevelData
      ?.magic_cost ?? null;

  const activeTokensReady =
    activeRequirements.length >
      0 &&
    activeRequirements.every(
      (requirement) =>
        (tokenQuantities[
          requirement.token_id
        ] ?? 0) >=
        requirement.quantity,
    );

  const activeMagicReady =
    activeMagicRequired !==
      null &&
    magicQuantity >=
      activeMagicRequired;

  const readinessDataComplete =
    activeRequirements.length >
      0 &&
    activeLevelData !==
      null &&
    activeMagicRequired !==
      null;

  const ready =
    readinessDataComplete &&
    activeTokensReady &&
    activeMagicReady;

  const characterSelectionDisabled =
    loadingCharacter ||
    saveStatus ===
      "pending" ||
    saveStatus ===
      "saving";

  const requirementTitle =
    isMaximumLevel
      ? "Character Complete"
      : isWelcomeState
        ? "Welcome Requirements"
        : `Requirements for Level ${targetLevel}`;

  const requirementSubtitle =
    isMaximumLevel
      ? `${character.display_name} has reached maximum level.`
      : isWelcomeState
        ? `Requirements needed to welcome ${character.display_name}.`
        : `Requirements needed to advance ${character.display_name} to Level ${targetLevel}.`;

  const readinessLabel =
    isMaximumLevel
      ? "Complete"
      : !readinessDataComplete
        ? "Readiness unavailable"
        : ready
          ? isWelcomeState
            ? "Ready to Welcome"
            : "Ready to Level Up"
          : isWelcomeState
            ? "Not Ready to Welcome"
            : "Not Ready to Level Up";

  const readinessClass =
    isMaximumLevel || ready
      ? "requirement-status requirement-status-ready"
      : !readinessDataComplete
        ? "requirement-status requirement-status-warning"
        : "requirement-status requirement-status-not-ready";

  const saveStatusLabel =
    saveStatus === "pending"
      ? "Waiting to save"
      : saveStatus ===
          "saving"
        ? "Saving"
        : saveStatus ===
            "saved"
          ? "Saved"
          : saveStatus ===
              "error"
            ? "Save error"
            : "Saved locally";

  const saveStatusClass =
    saveStatus === "error"
      ? "save-status-badge save-status-error"
      : saveStatus ===
            "pending" ||
          saveStatus ===
            "saving"
        ? "save-status-badge save-status-working"
        : "save-status-badge save-status-ok";

  return (
    <main className="app-page character-detail-page">
      <header className="character-detail-header">
        <div className="character-detail-header-main">
          {onBack && (
            <button
              type="button"
              className="detail-back-button"
              onClick={onBack}
            >
              ← Back to
              Characters
            </button>
          )}

          <div className="character-detail-identity">
            <div className="character-detail-avatar">
              {getInitials(
                character.display_name,
              )}
            </div>

            <div>
              <h1 className="page-title">
                {
                  character.display_name
                }
              </h1>

              <p className="page-subtitle">
                {
                  character.collection_name
                }
              </p>
            </div>
          </div>
        </div>

        <div className="character-detail-header-controls">
          <label className="character-selector-field">
            <span>
              Character
            </span>

            <select
              value={
                selectedCharacterId
              }
              disabled={
                characterSelectionDisabled
              }
              onChange={(
                event,
              ) =>
                setSelectedCharacterId(
                  event
                    .currentTarget
                    .value,
                )
              }
            >
              {characters.map(
                (
                  availableCharacter,
                ) => (
                  <option
                    key={
                      availableCharacter.id
                    }
                    value={
                      availableCharacter.id
                    }
                  >
                    {
                      availableCharacter.display_name
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <span
            className={
              saveStatusClass
            }
          >
            {saveStatusLabel}
          </span>
        </div>
      </header>

      <section className="detail-card">
        <div className="detail-card-header">
          <div>
            <h2>
              Character
              Progress
            </h2>

            <p>
              Track whether
              the character
              has been
              welcomed and
              their current
              level.
            </p>
          </div>
        </div>

        <div className="progress-setting-list">
          <div className="progress-setting-row">
            <div>
              <div className="setting-label">
                Welcomed
              </div>

              <div className="setting-help">
                Mark this
                character as
                part of your
                kingdom.
              </div>
            </div>

            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={
                  isUnlocked
                }
                onChange={(
                  event,
                ) =>
                  handleUnlockedChange(
                    event
                      .currentTarget
                      .checked,
                  )
                }
              />

              <span>
                {isUnlocked
                  ? "Yes"
                  : "No"}
              </span>
            </label>
          </div>

          <div className="progress-setting-row">
            <div>
              <div className="setting-label">
                Character Level
              </div>

              <div className="setting-help">
                Current saved
                character
                level.
              </div>
            </div>

            <select
              className="detail-select"
              value={
                currentLevel
              }
              onChange={(
                event,
              ) =>
                handleLevelChange(
                  Number(
                    event
                      .currentTarget
                      .value,
                  ),
                )
              }
            >
              <option
                value={0}
              >
                Not Welcomed
              </option>

              {Array.from(
                {
                  length:
                    character.max_level,
                },
                (
                  _,
                  index,
                ) =>
                  index + 1,
              ).map(
                (level) => (
                  <option
                    key={
                      level
                    }
                    value={
                      level
                    }
                  >
                    Level{" "}
                    {level}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </section>

      <section className="detail-card token-inventory-card">
        <div className="detail-card-header">
          <div>
            <h2>
              Token Inventory
            </h2>

            <p>
              Enter the number
              of each token you
              currently have.
              Shared tokens
              remain shared
              between
              characters.
            </p>
          </div>
        </div>

        {tokens.length === 0 ? (
          <div className="detail-empty-state">
            No tokens are
            stored for this
            character.
          </div>
        ) : (
          <div className="token-inventory-grid">
            {tokens.map(
              (token) => {
                const owned =
                  tokenQuantities[
                    token.id
                  ] ?? 0;

                const activeRequirement =
                  activeRequirements.find(
                    (
                      requirement,
                    ) =>
                      requirement.token_id ===
                      token.id,
                  );

                const required =
                  activeRequirement
                    ?.quantity ??
                  null;

                const remaining =
                  required ===
                  null
                    ? null
                    : Math.max(
                        required -
                          owned,
                        0,
                      );

                return (
                  <div
                    key={
                      token.id
                    }
                    className="token-inventory-item"
                  >
                    <div className="token-inventory-heading">
                      <div className="token-placeholder-icon">
                        {getInitials(
                          token.display_name,
                        )}
                      </div>

                      <div>
                        <div className="token-name-line">
                          <div className="token-name">
                            {
                              token.display_name
                            }
                          </div>

                          <span
                            className={getTokenRarityClass(
                              token.rarity,
                            )}
                          >
                            {formatTokenRarity(
                              token.rarity,
                            )}
                          </span>
                        </div>

                        <div className="token-requirement-hint">
                          {required ===
                          null
                            ? "Not required for current step"
                            : `Need ${required.toLocaleString(
                                "en-US",
                              )} for current step`}
                        </div>
                      </div>
                    </div>

                    <div className="token-inventory-controls">
                      <label
                        htmlFor={`token-${token.id}`}
                      >
                        Owned
                      </label>

                      <input
                        id={`token-${token.id}`}
                        type="number"
                        min="0"
                        step="1"
                        value={
                          owned
                        }
                        onChange={(
                          event,
                        ) =>
                          handleTokenChange(
                            token.id,
                            event
                              .currentTarget
                              .value,
                          )
                        }
                      />

                      {remaining !==
                        null && (
                        <span
                          className={
                            remaining ===
                            0
                              ? "token-remaining token-remaining-complete"
                              : "token-remaining"
                          }
                        >
                          {remaining ===
                          0
                            ? "Requirement met"
                            : `${remaining.toLocaleString(
                                "en-US",
                              )} remaining`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </section>

      <section className="detail-card requirement-card">
        <div className="requirement-card-header">
          <div>
            <h2>
              {requirementTitle}
            </h2>

            <p>
              {
                requirementSubtitle
              }
            </p>
          </div>

          <span
            className={
              readinessClass
            }
          >
            {readinessLabel}
          </span>
        </div>

        {isMaximumLevel ? (
          <div className="character-complete-panel">
            <div className="character-complete-icon">
              ✓
            </div>

            <div>
              <strong>
                Maximum level
                reached
              </strong>

              <p>
                {
                  character.display_name
                }{" "}
                is already at
                Level{" "}
                {
                  character.max_level
                }.
              </p>
            </div>
          </div>
        ) : (
          <div className="requirement-summary-grid">
            <div className="requirement-summary-section">
              <h3>
                Token
                Requirements
              </h3>

              {activeRequirements.length ===
              0 ? (
                <div className="detail-empty-state">
                  No token
                  requirements
                  are stored for
                  this step.
                </div>
              ) : (
                <div className="requirement-list">
                  {activeRequirements.map(
                    (
                      requirement,
                    ) => {
                      const owned =
                        tokenQuantities[
                          requirement
                            .token_id
                        ] ??
                        0;

                      const remaining =
                        Math.max(
                          requirement.quantity -
                            owned,
                          0,
                        );

                      const requirementToken =
                        tokens.find(
                          (
                            token,
                          ) =>
                            token.id ===
                            requirement.token_id,
                        );

                      return (
                        <div
                          key={
                            requirement.token_id
                          }
                          className="requirement-row"
                        >
                          <div>
                            <div className="requirement-name-line">
                              <div className="requirement-name">
                                {
                                  requirement.token_name
                                }
                              </div>

                              <span
                                className={getTokenRarityClass(
                                  requirementToken
                                    ?.rarity ??
                                    null,
                                )}
                              >
                                {formatTokenRarity(
                                  requirementToken
                                    ?.rarity ??
                                    null,
                                )}
                              </span>
                            </div>

                            <div className="requirement-count">
                              {owned.toLocaleString(
                                "en-US",
                              )}{" "}
                              /{" "}
                              {requirement.quantity.toLocaleString(
                                "en-US",
                              )}
                            </div>
                          </div>

                          <span
                            className={
                              remaining ===
                              0
                                ? "requirement-result requirement-result-complete"
                                : "requirement-result"
                            }
                          >
                            {remaining ===
                            0
                              ? "Ready"
                              : `${remaining.toLocaleString(
                                  "en-US",
                                )} remaining`}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </div>

            <div className="requirement-summary-section">
              <h3>
                Cost &amp; Time
              </h3>

              <div className="requirement-metric-list">
                <div className="requirement-metric">
                  <div>
                    <span className="requirement-metric-label">
                      {isWelcomeState
                        ? "Welcome Cost"
                        : "Level-Up Cost"}
                    </span>

                    <strong>
                      {activeMagicRequired ===
                      null
                        ? "Not stored"
                        : `${formatNumber(
                            activeMagicRequired,
                          )} Magic`}
                    </strong>
                  </div>

                  {activeMagicRequired !==
                    null && (
                    <span
                      className={
                        activeMagicReady
                          ? "requirement-result requirement-result-complete"
                          : "requirement-result"
                      }
                    >
                      {activeMagicReady
                        ? "Enough Magic"
                        : `${formatNumber(
                            Math.max(
                              activeMagicRequired -
                                magicQuantity,
                              0,
                            ),
                          )} remaining`}
                    </span>
                  )}
                </div>

                <div className="requirement-metric">
                  <div>
                    <span className="requirement-metric-label">
                      Your Magic
                    </span>

                    <strong>
                      {formatNumber(
                        magicQuantity,
                      )}
                    </strong>
                  </div>
                </div>

                <div className="requirement-metric">
                  <div>
                    <span className="requirement-metric-label">
                      {isWelcomeState
                        ? "Welcome Time"
                        : "Level-Up Time"}
                    </span>

                    <strong>
                      {formatDuration(
                        activeLevelData
                          ?.level_time_seconds ??
                          null,
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isMaximumLevel &&
          !readinessDataComplete && (
            <div className="readiness-warning">
              Readiness cannot
              be calculated
              because required
              game data for
              this step is
              incomplete.
            </div>
          )}
      </section>

      {saveError && (
        <div className="detail-error-banner">
          <strong>
            Unable to save
            progress:
          </strong>{" "}
          {saveError}
        </div>
      )}
    </main>
  );
}

export default CharacterDetailPage;