import { useEffect, useRef, useState } from "react";

import {
  getAllCharacters,
  loadCharacterGameData,
} from "./data/gameData";

import {
  loadCharacterPlayerProgress,
  saveCharacterPlayerProgress,
} from "./data/playerData";

import type {
  Character,
  CharacterLevel,
  LevelRequirement,
  SaveStatus,
  Token,
  TokenQuantities,
} from "./types/dmk";

import "./App.css";

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return "Not stored";
  }

  if (seconds === 0) {
    return "Instant";
  }

  const days = Math.floor(seconds / 86400);

  const hours = Math.floor(
    (seconds % 86400) / 3600,
  );

  const minutes = Math.floor(
    (seconds % 3600) / 60,
  );

  const parts: string[] = [];

  if (days > 0) {
    parts.push(
      `${days} ${days === 1 ? "day" : "days"}`,
    );
  }

  if (hours > 0) {
    parts.push(
      `${hours} ${
        hours === 1 ? "hour" : "hours"
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

function formatNumber(value: number | null) {
  if (value === null) {
    return "Not stored";
  }

  return value.toLocaleString();
}

function App() {
  const [characters, setCharacters] =
    useState<Character[]>([]);

  const [
    selectedCharacterId,
    setSelectedCharacterId,
  ] = useState("");

  const [character, setCharacter] =
    useState<Character | null>(null);

  const [tokens, setTokens] =
    useState<Token[]>([]);

  const [requirements, setRequirements] =
    useState<LevelRequirement[]>([]);

  const [levels, setLevels] =
    useState<CharacterLevel[]>([]);

  const [isUnlocked, setIsUnlocked] =
    useState(false);

  const [currentLevel, setCurrentLevel] =
    useState(0);

  const [tokenQuantities, setTokenQuantities] =
    useState<TokenQuantities>({});

  const [
    loadingCharacters,
    setLoadingCharacters,
  ] = useState(true);

  const [
    loadingCharacter,
    setLoadingCharacter,
  ] = useState(false);

  const [saveStatus, setSaveStatus] =
    useState<SaveStatus>("idle");

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [saveError, setSaveError] =
    useState<string | null>(null);

  const editVersionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function loadCharacterList() {
      try {
        const loadedCharacters =
          await getAllCharacters();

        if (cancelled) {
          return;
        }

        if (loadedCharacters.length === 0) {
          throw new Error(
            "No active characters were found in the game database.",
          );
        }

        setCharacters(loadedCharacters);

        setSelectedCharacterId(
          loadedCharacters[0].id,
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
          setLoadingCharacters(false);
        }
      }
    }

    loadCharacterList();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedCharacterId) {
      return;
    }

    let cancelled = false;

    async function loadSelectedCharacter() {
      editVersionRef.current += 1;

      setLoadingCharacter(true);
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
          character: loadedCharacter,
          tokens: loadedTokens,
          requirements: loadedRequirements,
          levels: loadedLevels,
        } = await loadCharacterGameData(
          selectedCharacterId,
        );

        const playerProgress =
          await loadCharacterPlayerProgress(
            selectedCharacterId,
            loadedTokens,
          );

        if (cancelled) {
          return;
        }

        setCharacter(loadedCharacter);
        setTokens(loadedTokens);
        setRequirements(loadedRequirements);
        setLevels(loadedLevels);

        setIsUnlocked(
          playerProgress.isUnlocked,
        );

        setCurrentLevel(
          playerProgress.currentLevel,
        );

        setTokenQuantities(
          playerProgress.tokenQuantities,
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
          setLoadingCharacter(false);
        }
      }
    }

    loadSelectedCharacter();

    return () => {
      cancelled = true;
    };
  }, [selectedCharacterId]);

  function markEdited() {
    editVersionRef.current += 1;
    setSaveError(null);
    setSaveStatus("pending");
  }

  function handleUnlockedChange(
    checked: boolean,
  ) {
    setIsUnlocked(checked);

    if (!checked) {
      setCurrentLevel(0);
    } else if (currentLevel === 0) {
      setCurrentLevel(1);
    }

    markEdited();
  }

  function handleLevelChange(level: number) {
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
      Number.parseInt(value, 10);

    const safeValue =
      Number.isNaN(parsedValue) ||
      parsedValue < 0
        ? 0
        : parsedValue;

    setTokenQuantities((current) => ({
      ...current,
      [tokenId]: safeValue,
    }));

    markEdited();
  }

  useEffect(() => {
    if (
      loadingCharacter ||
      !character ||
      saveStatus !== "pending"
    ) {
      return;
    }

    const versionToSave =
      editVersionRef.current;

    const timeout =
      window.setTimeout(async () => {
        setSaveStatus("saving");
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
            setSaveStatus("saved");
          } else {
            setSaveStatus("pending");
          }
        } catch (err) {
          if (
            editVersionRef.current ===
            versionToSave
          ) {
            setSaveStatus("error");

            setSaveError(
              err instanceof Error
                ? err.message
                : String(err),
            );
          } else {
            setSaveStatus("pending");
          }
        }
      }, 700);

    return () => {
      window.clearTimeout(timeout);
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
      <main className="container">
        <h1>
          DMK Complete Tracker & Guide
        </h1>

        <p>Loading characters...</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="container">
        <h1>
          DMK Complete Tracker & Guide
        </h1>

        <h2>
          Unable to load tracker data
        </h2>

        <p>{loadError}</p>
      </main>
    );
  }

  if (
    loadingCharacter ||
    !character
  ) {
    return (
      <main className="container">
        <h1>
          DMK Complete Tracker & Guide
        </h1>

        <p>
          Loading selected character...
        </p>
      </main>
    );
  }

  const nextLevel =
    currentLevel < character.max_level
      ? currentLevel + 1
      : null;

  const nextLevelRequirements =
    nextLevel === null
      ? []
      : requirements.filter(
          (requirement) =>
            requirement.target_level ===
            nextLevel,
        );

  const welcomeRequirements =
    requirements.filter(
      (requirement) =>
        requirement.target_level === 1,
    );

  const welcomeLevel =
    levels.find(
      (level) => level.target_level === 1,
    ) ?? null;

  const characterSelectionDisabled =
    loadingCharacter ||
    saveStatus === "pending" ||
    saveStatus === "saving";

  return (
    <main className="container">
      <h1>
        DMK Complete Tracker & Guide
      </h1>

      <section>
        <p>
          <label htmlFor="character-select">
            <strong>Character:</strong>{" "}
          </label>

          <select
            id="character-select"
            value={selectedCharacterId}
            disabled={
              characterSelectionDisabled
            }
            onChange={(event) =>
              setSelectedCharacterId(
                event.currentTarget.value,
              )
            }
          >
            {characters.map(
              (availableCharacter) => (
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
                  }{" "}
                  —{" "}
                  {
                    availableCharacter.collection_name
                  }
                </option>
              ),
            )}
          </select>
        </p>

        <h2>
          {character.display_name}
        </h2>

        <p>
          <strong>Collection:</strong>{" "}
          {character.collection_name}
        </p>

        <p>
          <strong>Maximum Level:</strong>{" "}
          {character.max_level}
        </p>

        <h3>Player Progress</h3>

        <p>
          <label>
            <input
              type="checkbox"
              checked={isUnlocked}
              onChange={(event) =>
                handleUnlockedChange(
                  event.currentTarget.checked,
                )
              }
            />{" "}
            Unlocked
          </label>
        </p>

        <p>
          <label htmlFor="current-level">
            <strong>
              Current Level:
            </strong>{" "}
          </label>

          <select
            id="current-level"
            value={currentLevel}
            onChange={(event) =>
              handleLevelChange(
                Number(
                  event.currentTarget.value,
                ),
              )
            }
          >
            <option value={0}>
              Not Welcomed
            </option>

            {Array.from(
              {
                length:
                  character.max_level,
              },
              (_, index) => index + 1,
            ).map((level) => (
              <option
                key={level}
                value={level}
              >
                Level {level}
              </option>
            ))}
          </select>
        </p>

        <h3>
          Current Token Inventory
        </h3>

        {tokens.map((token) => (
          <p key={token.id}>
            <label
              htmlFor={`token-${token.id}`}
            >
              {token.display_name}:{" "}
            </label>

            <input
              id={`token-${token.id}`}
              type="number"
              min="0"
              step="1"
              value={
                tokenQuantities[
                  token.id
                ] ?? 0
              }
              onChange={(event) =>
                handleTokenChange(
                  token.id,
                  event.currentTarget.value,
                )
              }
            />
          </p>
        ))}

        {currentLevel >=
        character.max_level ? (
          <h3>
            ✓ {character.display_name} is
            at maximum level.
          </h3>
        ) : currentLevel === 0 &&
          !isUnlocked ? (
          <>
            <h3>Welcome Requirements</h3>

            {welcomeRequirements.length ===
            0 ? (
              <p>
                No token requirements are
                stored for welcoming this
                character.
              </p>
            ) : (
              <ul>
                {welcomeRequirements.map(
                  (requirement) => {
                    const owned =
                      tokenQuantities[
                        requirement.token_id
                      ] ?? 0;

                    const remaining =
                      Math.max(
                        requirement.quantity -
                          owned,
                        0,
                      );

                    return (
                      <li
                        key={
                          requirement.token_id
                        }
                      >
                        {
                          requirement.token_name
                        }
                        : {owned} /{" "}
                        {
                          requirement.quantity
                        }
                        {" — "}
                        {remaining} remaining
                      </li>
                    );
                  },
                )}
              </ul>
            )}

            <p>
              <strong>Magic:</strong>{" "}
              {formatNumber(
                welcomeLevel?.magic_cost ??
                  null,
              )}
            </p>

            <p>
              <strong>
                Welcome Time:
              </strong>{" "}
              {formatDuration(
                welcomeLevel?.level_time_seconds ??
                  null,
              )}
            </p>
          </>
        ) : (
          <>
            <h3>
              Requirements for Level{" "}
              {nextLevel}
            </h3>

            {nextLevelRequirements.length ===
            0 ? (
              <p>
                No token requirements are
                stored for this level.
              </p>
            ) : (
              <ul>
                {nextLevelRequirements.map(
                  (requirement) => {
                    const owned =
                      tokenQuantities[
                        requirement.token_id
                      ] ?? 0;

                    const remaining =
                      Math.max(
                        requirement.quantity -
                          owned,
                        0,
                      );

                    return (
                      <li
                        key={
                          requirement.token_id
                        }
                      >
                        {
                          requirement.token_name
                        }
                        : {owned} /{" "}
                        {
                          requirement.quantity
                        }
                        {" — "}
                        {remaining} remaining
                      </li>
                    );
                  },
                )}
              </ul>
            )}
          </>
        )}

        <p>
          {saveStatus === "idle" &&
            "Progress is stored locally."}

          {saveStatus === "pending" &&
            "Waiting to save..."}

          {saveStatus === "saving" &&
            "Saving..."}

          {saveStatus === "saved" &&
            "✓ Saved"}

          {saveStatus === "error" &&
            "Unable to save progress."}
        </p>

        {saveError && (
          <p>
            <strong>
              Save error:
            </strong>{" "}
            {saveError}
          </p>
        )}
      </section>
    </main>
  );
}

export default App;