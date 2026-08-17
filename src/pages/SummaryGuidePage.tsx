import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getAllCharacters,
} from "../data/gameData";

import {
  loadAllCharacterProgress,
  loadPlayerGems,
  loadPlayerMagic,
  savePlayerGems,
  savePlayerMagic,
  type LoadedPlayerCharacterProgress,
} from "../data/playerData";

import type {
  Character,
  SaveStatus,
} from "../types/dmk";

import "./SummaryGuidePage.css";

type SummaryGuidePageProps = {
  onSaveStatusChange?: (
    status: SaveStatus,
  ) => void;
};

type LoadStatus =
  | "loading"
  | "ready"
  | "error";

function formatNumber(
  value: number,
) {
  return Math.max(
    0,
    Math.floor(value),
  ).toLocaleString("en-US");
}

function parseNumberInput(
  value: string,
) {
  const digits =
    value.replace(
      /[^0-9]/g,
      "",
    );

  if (
    digits.length === 0
  ) {
    return 0;
  }

  const parsed =
    Number(digits);

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return 0;
  }

  return Math.min(
    Math.floor(parsed),
    Number.MAX_SAFE_INTEGER,
  );
}

function getSaveStatusText(
  status: SaveStatus,
) {
  switch (status) {
    case "pending":
      return "Changes pending";

    case "saving":
      return "Saving...";

    case "saved":
      return "Saved";

    case "error":
      return "Save failed";

    default:
      return "Ready";
  }
}

function SummaryGuidePage({
  onSaveStatusChange,
}: SummaryGuidePageProps) {
  const [
    characters,
    setCharacters,
  ] = useState<Character[]>(
    [],
  );

  const [
    characterProgress,
    setCharacterProgress,
  ] = useState<
    LoadedPlayerCharacterProgress[]
  >([]);

  const [
    magic,
    setMagic,
  ] = useState(0);

  const [
    gems,
    setGems,
  ] = useState(0);

  const [
    loadStatus,
    setLoadStatus,
  ] =
    useState<LoadStatus>(
      "loading",
    );

  const [
    loadError,
    setLoadError,
  ] = useState<string | null>(
    null,
  );

  const [
    resourcesLoaded,
    setResourcesLoaded,
  ] = useState(false);

  const [
    resourcesDirty,
    setResourcesDirty,
  ] = useState(false);

  const [
    saveStatus,
    setSaveStatus,
  ] =
    useState<SaveStatus>(
      "idle",
    );

  const saveVersionRef =
    useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setLoadStatus(
        "loading",
      );

      setLoadError(null);

      try {
        const [
          loadedCharacters,
          loadedProgress,
          loadedMagic,
          loadedGems,
        ] =
          await Promise.all([
            getAllCharacters(),
            loadAllCharacterProgress(),
            loadPlayerMagic(),
            loadPlayerGems(),
          ]);

        if (cancelled) {
          return;
        }

        setCharacters(
          loadedCharacters,
        );

        setCharacterProgress(
          loadedProgress,
        );

        setMagic(
          loadedMagic,
        );

        setGems(
          loadedGems,
        );

        setResourcesLoaded(
          true,
        );

        setLoadStatus(
          "ready",
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Failed to load Summary & Guide data:",
          error,
        );

        setLoadError(
          "The Summary & Guide data could not be loaded.",
        );

        setLoadStatus(
          "error",
        );
      }
    }

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onSaveStatusChange?.(
      saveStatus,
    );
  }, [
    onSaveStatusChange,
    saveStatus,
  ]);

  useEffect(() => {
    if (
      !resourcesLoaded ||
      !resourcesDirty
    ) {
      return;
    }

    const saveVersion =
      saveVersionRef.current;

    const timeoutId =
      window.setTimeout(
        () => {
          void (async () => {
            setSaveStatus(
              "saving",
            );

            try {
              await Promise.all([
                savePlayerMagic(
                  magic,
                ),
                savePlayerGems(
                  gems,
                ),
              ]);

              if (
                saveVersionRef.current ===
                saveVersion
              ) {
                setResourcesDirty(
                  false,
                );

                setSaveStatus(
                  "saved",
                );
              } else {
                setSaveStatus(
                  "pending",
                );
              }
            } catch (error) {
              console.error(
                "Failed to save player resources:",
                error,
              );

              if (
                saveVersionRef.current ===
                saveVersion
              ) {
                setSaveStatus(
                  "error",
                );
              }
            }
          })();
        },
        700,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    gems,
    magic,
    resourcesDirty,
    resourcesLoaded,
  ]);

  const summary =
    useMemo(() => {
      const progressById =
        new Map(
          characterProgress.map(
            (progress) => [
              progress.characterId,
              progress,
            ],
          ),
        );

      const totalCharacters =
        characters.length;

      let welcomedCharacters =
        0;

      let levelTenCharacters =
        0;

      for (
        const character of
        characters
      ) {
        const progress =
          progressById.get(
            character.id,
          );

        if (
          progress?.isUnlocked
        ) {
          welcomedCharacters +=
            1;
        }

        if (
          (
            progress?.currentLevel ??
            0
          ) >= 10
        ) {
          levelTenCharacters +=
            1;
        }
      }

      const notWelcomedCharacters =
        Math.max(
          0,
          totalCharacters -
            welcomedCharacters,
        );

      const welcomePercent =
        totalCharacters > 0
          ? Math.round(
              (
                welcomedCharacters /
                totalCharacters
              ) * 100,
            )
          : 0;

      return {
        totalCharacters,
        welcomedCharacters,
        notWelcomedCharacters,
        levelTenCharacters,
        welcomePercent,
      };
    }, [
      characters,
      characterProgress,
    ]);

  function markResourcesChanged() {
    saveVersionRef.current +=
      1;

    setResourcesDirty(
      true,
    );

    setSaveStatus(
      "pending",
    );
  }

  function handleMagicChange(
    value: string,
  ) {
    setMagic(
      parseNumberInput(
        value,
      ),
    );

    markResourcesChanged();
  }

  function handleGemsChange(
    value: string,
  ) {
    setGems(
      parseNumberInput(
        value,
      ),
    );

    markResourcesChanged();
  }

  return (
    <main className="app-page summary-guide-page">
      <header className="page-header summary-guide-header">
        <div>
          <h1 className="page-title">
            Summary &amp; Guide
          </h1>

          <p className="page-subtitle">
            Your kingdom at a
            glance, player-wide
            resources, and
            progression planning
          </p>
        </div>

        <div
          className={`summary-save-status summary-save-status-${saveStatus}`}
          aria-live="polite"
        >
          {getSaveStatusText(
            saveStatus,
          )}
        </div>
      </header>

      {loadStatus ===
        "loading" && (
        <section className="summary-loading-card">
          Loading kingdom
          summary...
        </section>
      )}

      {loadStatus ===
        "error" && (
        <section className="summary-error-card">
          <strong>
            Unable to load
            Summary &amp; Guide
          </strong>

          <span>
            {loadError}
          </span>
        </section>
      )}

      {loadStatus ===
        "ready" && (
        <>
          <section className="summary-section">
            <div className="summary-section-heading">
              <div>
                <h2>
                  Kingdom Progress
                </h2>

                <p>
                  Current character
                  progress from your
                  locally saved
                  player data.
                </p>
              </div>
            </div>

            <div className="summary-stat-grid">
              <article className="summary-stat-card">
                <span className="summary-stat-label">
                  Total Characters
                </span>

                <strong className="summary-stat-value">
                  {
                    summary.totalCharacters
                  }
                </strong>

                <span className="summary-stat-detail">
                  Available in the
                  current game data
                </span>
              </article>

              <article className="summary-stat-card">
                <span className="summary-stat-label">
                  Welcomed
                </span>

                <strong className="summary-stat-value">
                  {
                    summary.welcomedCharacters
                  }
                  <span>
                    {" "}
                    /{" "}
                    {
                      summary.totalCharacters
                    }
                  </span>
                </strong>

                <span className="summary-stat-detail">
                  {
                    summary.welcomePercent
                  }
                  % of characters
                  welcomed
                </span>
              </article>

              <article className="summary-stat-card">
                <span className="summary-stat-label">
                  Level 10
                </span>

                <strong className="summary-stat-value">
                  {
                    summary.levelTenCharacters
                  }
                </strong>

                <span className="summary-stat-detail">
                  Characters at
                  Level 10
                </span>
              </article>

              <article className="summary-stat-card">
                <span className="summary-stat-label">
                  Not Yet Welcomed
                </span>

                <strong className="summary-stat-value">
                  {
                    summary.notWelcomedCharacters
                  }
                </strong>

                <span className="summary-stat-detail">
                  Characters still
                  waiting to join
                  the kingdom
                </span>
              </article>
            </div>
          </section>

          <section className="summary-section">
            <div className="summary-section-heading">
              <div>
                <h2>
                  Player Resources
                </h2>

                <p>
                  Player-wide
                  resources are
                  shared across the
                  entire
                  application and
                  saved locally.
                </p>
              </div>
            </div>

            <div className="summary-resource-grid">
              <article className="summary-resource-card">
                <div className="summary-resource-header">
                  <div className="summary-resource-icon">
                    M
                  </div>

                  <div>
                    <h3>
                      Magic
                    </h3>

                    <p>
                      Current
                      player-wide
                      Magic balance
                    </p>
                  </div>
                </div>

                <label className="summary-resource-field">
                  <span>
                    Magic Balance
                  </span>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(
                      magic,
                    )}
                    onChange={(
                      event,
                    ) =>
                      handleMagicChange(
                        event.target
                          .value,
                      )
                    }
                    aria-label="Magic balance"
                  />
                </label>
              </article>

              <article className="summary-resource-card">
                <div className="summary-resource-header">
                  <div className="summary-resource-icon">
                    G
                  </div>

                  <div>
                    <h3>
                      Gems
                    </h3>

                    <p>
                      Current
                      player-wide
                      Gem balance
                    </p>
                  </div>
                </div>

                <label className="summary-resource-field">
                  <span>
                    Gem Balance
                  </span>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(
                      gems,
                    )}
                    onChange={(
                      event,
                    ) =>
                      handleGemsChange(
                        event.target
                          .value,
                      )
                    }
                    aria-label="Gem balance"
                  />
                </label>
              </article>
            </div>

            <div className="summary-resource-note">
              These values stay on
              this device in your
              local player
              database. They are
              separate from DMK
              game-data updates.
            </div>
          </section>

          <section className="summary-section summary-guide-preview">
            <div className="summary-section-heading">
              <div>
                <h2>
                  Guide &amp;
                  Planning
                </h2>

                <p>
                  Additional
                  kingdom totals,
                  recommendations,
                  and planning
                  tools will be
                  added here as the
                  application grows.
                </p>
              </div>
            </div>

            <div className="summary-coming-soon-card">
              <strong>
                More planning
                tools are coming.
              </strong>

              <span>
                This area will
                eventually bring
                together character,
                token, attraction,
                quest, and
                collection data
                into the
                application-wide
                guide.
              </span>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default SummaryGuidePage;