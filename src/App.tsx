import { useEffect, useRef, useState } from "react";
import Database from "@tauri-apps/plugin-sql";

import { loadCharacterGameData } from "./data/gameData";

import type {
  Character,
  CharacterProgressRow,
  LevelRequirement,
  SaveStatus,
  Token,
  TokenInventoryRow,
  TokenQuantities,
} from "./types/dmk";

import "./App.css";

const TEST_CHARACTER_ID = "character_mickey_mouse";

function App() {
  const [character, setCharacter] = useState<Character | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [requirements, setRequirements] = useState<LevelRequirement[]>([]);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [tokenQuantities, setTokenQuantities] =
    useState<TokenQuantities>({});

  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] =
    useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const editVersionRef = useRef(0);

  useEffect(() => {
    async function loadData() {
      try {
        const playerDb = Database.get("sqlite:dmk-player.db");

        const {
          character: loadedCharacter,
          tokens: loadedTokens,
          requirements: loadedRequirements,
        } = await loadCharacterGameData(TEST_CHARACTER_ID);

        const progressRows =
          await playerDb.select<CharacterProgressRow[]>(
            `
            SELECT
              is_unlocked,
              current_level
            FROM character_progress
            WHERE character_id = $1
            `,
            [TEST_CHARACTER_ID],
          );

        const inventoryRows =
          await playerDb.select<TokenInventoryRow[]>(
            `
            SELECT
              token_id,
              quantity
            FROM token_inventory
            `,
          );

        const quantities: TokenQuantities = {};

        for (const token of loadedTokens) {
          quantities[token.id] = 0;
        }

        for (const inventory of inventoryRows) {
          if (inventory.token_id in quantities) {
            quantities[inventory.token_id] =
              Number(inventory.quantity);
          }
        }

        if (progressRows.length === 1) {
          setIsUnlocked(
            progressRows[0].is_unlocked === 1,
          );

          setCurrentLevel(
            Number(progressRows[0].current_level),
          );
        } else {
          setIsUnlocked(false);
          setCurrentLevel(0);
        }

        setCharacter(loadedCharacter);
        setTokens(loadedTokens);
        setRequirements(loadedRequirements);
        setTokenQuantities(quantities);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : String(err),
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  function markEdited() {
    editVersionRef.current += 1;
    setSaveStatus("pending");
  }

  function handleUnlockedChange(checked: boolean) {
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
    const parsedValue = Number.parseInt(value, 10);

    const safeValue =
      Number.isNaN(parsedValue) || parsedValue < 0
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
      loading ||
      !character ||
      saveStatus !== "pending"
    ) {
      return;
    }

    const versionToSave = editVersionRef.current;

    const timeout = window.setTimeout(async () => {
      setSaveStatus("saving");

      try {
        const playerDb = Database.get(
          "sqlite:dmk-player.db",
        );

        const updatedAt = new Date().toISOString();

        await playerDb.execute(
          `
          INSERT INTO character_progress (
            character_id,
            is_unlocked,
            current_level,
            updated_at
          )
          VALUES ($1, $2, $3, $4)

          ON CONFLICT(character_id) DO UPDATE SET
            is_unlocked = excluded.is_unlocked,
            current_level = excluded.current_level,
            updated_at = excluded.updated_at
          `,
          [
            character.id,
            isUnlocked ? 1 : 0,
            currentLevel,
            updatedAt,
          ],
        );

        for (const token of tokens) {
          const quantity =
            tokenQuantities[token.id] ?? 0;

          await playerDb.execute(
            `
            INSERT INTO token_inventory (
              token_id,
              quantity,
              updated_at
            )
            VALUES ($1, $2, $3)

            ON CONFLICT(token_id) DO UPDATE SET
              quantity = excluded.quantity,
              updated_at = excluded.updated_at
            `,
            [
              token.id,
              quantity,
              updatedAt,
            ],
          );
        }

        if (
          editVersionRef.current === versionToSave
        ) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("pending");
        }
      } catch (err) {
        if (
          editVersionRef.current === versionToSave
        ) {
          setSaveStatus("error");

          setError(
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
    loading,
    saveStatus,
    tokenQuantities,
    tokens,
  ]);

  if (loading) {
    return (
      <main className="container">
        <h1>DMK Complete Tracker & Guide</h1>
        <p>Loading character and player data...</p>
      </main>
    );
  }

  if (error || !character) {
    return (
      <main className="container">
        <h1>DMK Complete Tracker & Guide</h1>

        <h2>Unable to load tracker data</h2>

        <p>
          {error ?? "Character data was unavailable."}
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
            requirement.target_level === nextLevel,
        );

  return (
    <main className="container">
      <h1>DMK Complete Tracker & Guide</h1>

      <section>
        <h2>{character.display_name}</h2>

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
            <strong>Current Level:</strong>{" "}
          </label>

          <select
            id="current-level"
            value={currentLevel}
            onChange={(event) =>
              handleLevelChange(
                Number(event.currentTarget.value),
              )
            }
          >
            <option value={0}>Not Welcomed</option>

            {Array.from(
              { length: character.max_level },
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

        <h3>Current Token Inventory</h3>

        {tokens.map((token) => (
          <p key={token.id}>
            <label htmlFor={`token-${token.id}`}>
              {token.display_name}:{" "}
            </label>

            <input
              id={`token-${token.id}`}
              type="number"
              min="0"
              step="1"
              value={
                tokenQuantities[token.id] ?? 0
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

        {currentLevel >= character.max_level ? (
          <h3>
            ✓ {character.display_name} is at maximum
            level.
          </h3>
        ) : currentLevel === 0 ? (
          <>
            <h3>Welcome Status</h3>

            <p>
              {character.display_name} has not been
              welcomed yet.
            </p>
          </>
        ) : (
          <>
            <h3>
              Requirements for Level {nextLevel}
            </h3>

            {nextLevelRequirements.length === 0 ? (
              <p>
                No token requirements are stored for
                this level.
              </p>
            ) : (
              <ul>
                {nextLevelRequirements.map(
                  (requirement) => {
                    const owned =
                      tokenQuantities[
                        requirement.token_id
                      ] ?? 0;

                    const remaining = Math.max(
                      requirement.quantity - owned,
                      0,
                    );

                    return (
                      <li key={requirement.token_id}>
                        {requirement.token_name}:{" "}
                        {owned} /{" "}
                        {requirement.quantity}
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
      </section>
    </main>
  );
}

export default App;