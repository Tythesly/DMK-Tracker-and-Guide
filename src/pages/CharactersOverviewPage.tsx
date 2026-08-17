import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getAllCharacters,
  loadCharacterGameData,
} from "../data/gameData";

import {
  loadCharacterPlayerProgress,
  loadPlayerMagic,
} from "../data/playerData";

import type {
  Character,
  CharacterLevel,
  LevelRequirement,
  TokenQuantities,
} from "../types/dmk";

type CharactersOverviewPageProps = {
  onOpenCharacter: (
    characterId: string,
  ) => void;
};

type CharacterSummary = {
  character: Character;
  isUnlocked: boolean;
  currentLevel: number;
  progressLabel: string;
  readinessLabel: string;
  tokenNames: string;
};

function calculateReadiness(
  character: Character,
  isUnlocked: boolean,
  currentLevel: number,
  tokenQuantities: TokenQuantities,
  requirements: LevelRequirement[],
  levels: CharacterLevel[],
  magicQuantity: number,
) {
  if (
    currentLevel >= character.max_level
  ) {
    return {
      progressLabel: "Max Level",
      readinessLabel: "Complete",
    };
  }

  const targetLevel =
    currentLevel === 0 && !isUnlocked
      ? 1
      : currentLevel + 1;

  const targetRequirements =
    requirements.filter(
      (requirement) =>
        requirement.target_level ===
        targetLevel,
    );

  const targetLevelData =
    levels.find(
      (level) =>
        level.target_level ===
        targetLevel,
    ) ?? null;

  const magicRequired =
    targetLevelData?.magic_cost ?? null;

  const readinessDataComplete =
    targetRequirements.length > 0 &&
    targetLevelData !== null &&
    magicRequired !== null;

  const tokensReady =
    targetRequirements.length > 0 &&
    targetRequirements.every(
      (requirement) =>
        (tokenQuantities[
          requirement.token_id
        ] ?? 0) >= requirement.quantity,
    );

  const magicReady =
    magicRequired !== null &&
    magicQuantity >= magicRequired;

  const ready =
    readinessDataComplete &&
    tokensReady &&
    magicReady;

  if (
    currentLevel === 0 &&
    !isUnlocked
  ) {
    return {
      progressLabel: "Not Welcomed",
      readinessLabel:
        !readinessDataComplete
          ? "Readiness unavailable"
          : ready
            ? "Ready to Welcome"
            : "Not Ready to Welcome",
    };
  }

  return {
    progressLabel: `Level ${currentLevel}`,
    readinessLabel:
      !readinessDataComplete
        ? "Readiness unavailable"
        : ready
          ? "Ready to Level Up"
          : "Not Ready to Level Up",
  };
}

function getCharacterInitials(
  displayName: string,
) {
  const words = displayName
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
    words[words.length - 1][0]
  }`.toUpperCase();
}

function CharactersOverviewPage({
  onOpenCharacter,
}: CharactersOverviewPageProps) {
  const [summaries, setSummaries] =
    useState<CharacterSummary[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [searchText, setSearchText] =
    useState("");

  const [
    collectionFilter,
    setCollectionFilter,
  ] = useState("all");

  const [
    levelFilter,
    setLevelFilter,
  ] = useState("any");

  useEffect(() => {
    let cancelled = false;

    async function loadCharacters() {
      try {
        const [
          loadedCharacters,
          magicQuantity,
        ] = await Promise.all([
          getAllCharacters(),
          loadPlayerMagic(),
        ]);

        const loadedSummaries =
          await Promise.all(
            loadedCharacters.map(
              async (character) => {
                const {
                  tokens,
                  requirements,
                  levels,
                } =
                  await loadCharacterGameData(
                    character.id,
                  );

                const playerProgress =
                  await loadCharacterPlayerProgress(
                    character.id,
                    tokens,
                  );

                const {
                  progressLabel,
                  readinessLabel,
                } = calculateReadiness(
                  character,
                  playerProgress.isUnlocked,
                  playerProgress.currentLevel,
                  playerProgress.tokenQuantities,
                  requirements,
                  levels,
                  magicQuantity,
                );

                return {
                  character,
                  isUnlocked:
                    playerProgress.isUnlocked,
                  currentLevel:
                    playerProgress.currentLevel,
                  progressLabel,
                  readinessLabel,
                  tokenNames: tokens
                    .map(
                      (token) =>
                        token.display_name,
                    )
                    .join(" • "),
                };
              },
            ),
          );

        if (cancelled) {
          return;
        }

        setSummaries(loadedSummaries);
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
          setLoading(false);
        }
      }
    }

    loadCharacters();

    return () => {
      cancelled = true;
    };
  }, []);

  const collectionNames =
    useMemo(() => {
      return Array.from(
        new Set(
          summaries.map(
            (summary) =>
              summary.character
                .collection_name,
          ),
        ),
      ).sort((left, right) =>
        left.localeCompare(right),
      );
    }, [summaries]);

  const maximumCharacterLevel =
    useMemo(() => {
      if (summaries.length === 0) {
        return 10;
      }

      return Math.max(
        ...summaries.map(
          (summary) =>
            summary.character.max_level,
        ),
      );
    }, [summaries]);

  const filteredSummaries =
    useMemo(() => {
      const normalizedSearch =
        searchText
          .trim()
          .toLowerCase();

      return summaries.filter(
        (summary) => {
          const matchesSearch =
            normalizedSearch.length === 0 ||
            summary.character.display_name
              .toLowerCase()
              .includes(
                normalizedSearch,
              );

          const matchesCollection =
            collectionFilter === "all" ||
            summary.character
              .collection_name ===
              collectionFilter;

          let matchesLevel = true;

          if (
            levelFilter ===
            "not-welcomed"
          ) {
            matchesLevel =
              !summary.isUnlocked &&
              summary.currentLevel === 0;
          } else if (
            levelFilter === "max"
          ) {
            matchesLevel =
              summary.currentLevel >=
              summary.character.max_level;
          } else if (
            levelFilter.startsWith(
              "level-",
            )
          ) {
            const selectedLevel =
              Number.parseInt(
                levelFilter.replace(
                  "level-",
                  "",
                ),
                10,
              );

            matchesLevel =
              summary.currentLevel ===
              selectedLevel;
          }

          return (
            matchesSearch &&
            matchesCollection &&
            matchesLevel
          );
        },
      );
    }, [
      collectionFilter,
      levelFilter,
      searchText,
      summaries,
    ]);

  if (loading) {
    return (
      <main className="app-page">
        <header className="page-header">
          <div>
            <h1 className="page-title">
              Characters
            </h1>

            <p className="page-subtitle">
              Loading character progress...
            </p>
          </div>
        </header>

        <section className="page-state-card">
          Loading characters...
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
              Characters
            </h1>

            <p className="page-subtitle">
              Unable to load character data
            </p>
          </div>
        </header>

        <section className="page-state-card page-state-error">
          <strong>
            Unable to load characters
          </strong>

          <p>{loadError}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            Characters
          </h1>

          <p className="page-subtitle">
            Browse your character roster and
            locally saved progression
          </p>
        </div>

        <div className="page-header-badges">
          <span className="header-badge">
            {summaries.length.toLocaleString(
              "en-US",
            )}{" "}
            {summaries.length === 1
              ? "character"
              : "characters"}
          </span>

          <span className="header-badge">
            Local game data
          </span>
        </div>
      </header>

      <section
        className="character-filter-bar"
        aria-label="Character filters"
      >
        <label className="filter-search">
          <span className="sr-only">
            Search characters
          </span>

          <input
            type="search"
            value={searchText}
            placeholder="Search characters..."
            onChange={(event) =>
              setSearchText(
                event.currentTarget.value,
              )
            }
          />
        </label>

        <label>
          <span className="sr-only">
            Collection
          </span>

          <select
            value={collectionFilter}
            onChange={(event) => {
              setCollectionFilter(
                event.currentTarget.value,
              );

              setSearchText("");
            }}
          >
            <option value="all">
              Collection: All
            </option>

            {collectionNames.map(
              (collectionName) => (
                <option
                  key={collectionName}
                  value={collectionName}
                >
                  {collectionName}
                </option>
              ),
            )}
          </select>
        </label>

        <label>
          <span className="sr-only">
            Character Level
          </span>

          <select
            value={levelFilter}
            onChange={(event) => {
              setLevelFilter(
                event.currentTarget.value,
              );

              setSearchText("");
            }}
          >
            <option value="any">
              Character Level: Any
            </option>

            <option value="not-welcomed">
              Not Welcomed
            </option>

            {Array.from(
              {
                length:
                  maximumCharacterLevel,
              },
              (_, index) => index + 1,
            ).map((level) => (
              <option
                key={level}
                value={`level-${level}`}
              >
                Level {level}
              </option>
            ))}

            <option value="max">
              Max Level
            </option>
          </select>
        </label>
      </section>

      <section className="data-table-card">
        <div className="data-table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Character</th>
                <th>Collection</th>
                <th>Character Level</th>
                <th>Obtained</th>
                <th>Token Data</th>
              </tr>
            </thead>

            <tbody>
              {filteredSummaries.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="empty-table-cell"
                  >
                    No characters match the
                    selected filters.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map(
                  (summary) => (
                    <tr
                      key={
                        summary.character.id
                      }
                    >
                      <td>
                        <div className="character-cell">
                          <div className="character-avatar-placeholder">
                            {getCharacterInitials(
                              summary.character
                                .display_name,
                            )}
                          </div>

                          <button
                            type="button"
                            className="character-name-button"
                            onClick={() =>
                              onOpenCharacter(
                                summary.character
                                  .id,
                              )
                            }
                          >
                            {
                              summary.character
                                .display_name
                            }
                          </button>
                        </div>
                      </td>

                      <td>
                        {
                          summary.character
                            .collection_name
                        }
                      </td>

                      <td>
                        <span className="status-pill">
                          {
                            summary.progressLabel
                          }
                        </span>

                        <div className="readiness-label">
                          {
                            summary.readinessLabel
                          }
                        </div>
                      </td>

                      <td>
                        {summary.isUnlocked
                          ? "Yes"
                          : "No"}
                      </td>

                      <td className="token-data-cell">
                        {summary.tokenNames ||
                          "—"}
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="page-footnote">
        Player progress remains stored locally
        on this device.
      </p>
    </main>
  );
}

export default CharactersOverviewPage;