import { useEffect, useState } from "react";

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
  onOpenCharacter: (characterId: string) => void;
};

type CharacterSummary = {
  character: Character;
  isUnlocked: boolean;
  currentLevel: number;
  progressLabel: string;
  readinessLabel: string;
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
  if (currentLevel >= character.max_level) {
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
        level.target_level === targetLevel,
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

  if (currentLevel === 0 && !isUnlocked) {
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

function CharactersOverviewPage({
  onOpenCharacter,
}: CharactersOverviewPageProps) {
  const [summaries, setSummaries] =
    useState<CharacterSummary[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

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

  if (loading) {
    return (
      <main className="container">
        <h1>
          DMK Complete Tracker & Guide
        </h1>

        <p>
          Loading character progress...
        </p>
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
          Unable to load characters
        </h2>

        <p>{loadError}</p>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>
        DMK Complete Tracker & Guide
      </h1>

      <h2>Characters</h2>

      <p>
        View your character progress and
        open a character for detailed token,
        level-up, and readiness information.
      </p>

      {summaries.length === 0 ? (
        <p>
          No active characters were found.
        </p>
      ) : (
        summaries.map((summary) => (
          <section
            key={summary.character.id}
          >
            <h3>
              {
                summary.character
                  .display_name
              }
            </h3>

            <p>
              {
                summary.character
                  .collection_name
              }
            </p>

            <p>
              <strong>
                Progress:
              </strong>{" "}
              {summary.progressLabel}
            </p>

            <p>
              <strong>
                Status:
              </strong>{" "}
              {summary.readinessLabel}
            </p>

            <button
              type="button"
              onClick={() =>
                onOpenCharacter(
                  summary.character.id,
                )
              }
            >
              View Character
            </button>
          </section>
        ))
      )}
    </main>
  );
}

export default CharactersOverviewPage;