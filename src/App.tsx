import { useEffect, useRef, useState } from "react";
import Database from "@tauri-apps/plugin-sql";
import "./App.css";

type Character = {
  id: string;
  display_name: string;
  max_level: number;
  collection_name: string;
};

type Token = {
  id: string;
  display_name: string;
  token_type: string;
};

type LevelRequirement = {
  target_level: number;
  token_id: string;
  token_name: string;
  quantity: number;
};

type CharacterProgressRow = {
  is_unlocked: number;
  current_level: number;
};

type TokenInventoryRow = {
  token_id: string;
  quantity: number;
};

type TokenQuantities = Record<string, number>;

type SaveStatus =
  | "idle"
  | "pending"
  | "saving"
  | "saved"
  | "error";

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
        const gameDb = Database.get("sqlite:dmk-data.db");
        const playerDb = Database.get("sqlite:dmk-player.db");

        const characterRows = await gameDb.select<Character[]>(
          `
          SELECT
            characters.id,
            characters.display_name,
            characters.max_level,
            collections.display_name AS collection_name
          FROM characters
          INNER JOIN collections
            ON collections.id = characters.collection_id
          WHERE characters.id = $1
          `,
          ["character_mickey_mouse"],
        );

        if (characterRows.length !== 1) {
          throw new Error(
            "Mickey Mouse could not be found in the game database.",
          );
        }

        const tokenRows = await gameDb.select<Token[]>(
          `
          SELECT
            id,
            display_name,
            token_type
          FROM tokens
          WHERE associated_character_id = $1
             OR associated_collection_id = $2
          ORDER BY sort_order, display_name
          `,
          [
            "character_mickey_mouse",
            "collection_mickey_friends",
          ],
        );

        const requirementRows =
          await gameDb.select<LevelRequirement[]>(
            `
            SELECT
              requirements.target_level,
              requirements.token_id,
              tokens.display_name AS token_name,
              requirements.quantity
            FROM character_level_token_requirements AS requirements
            INNER JOIN tokens
              ON tokens.id = requirements.token_id
            WHERE requirements.character_id = $1
            ORDER BY requirements.target_level, tokens.sort_order
            `,
            ["character_mickey_mouse"],
          );

        const progressRows =
          await playerDb.select<CharacterProgressRow[]>(
            `
            SELECT
              is_unlocked,
              current_level
            FROM character_progress
            WHERE character_id = $1
            `,
            ["character_mickey_mouse"],
          );

        const inventoryRows =
          await playerDb.select<TokenInventoryRow[]>(
            `
            SELECT
              token_id,
              quantity
            FROM token_inventory
            WHERE token_id = $1
               OR token_id = $2
               OR token_id = $3
            `,
            [
              "token_mickey_balloon",
              "token_mickey_gloves",
              "token_mickey_ears",
            ],
          );

        const quantities: TokenQuantities = {};

        for (const token of tokenRows) {
          quantities[token.id] = 0;
        }

        for (const inventory of inventoryRows) {
          quantities[inventory.token_id] =
            Number(inventory.quantity);
        }

        if (progressRows.length === 1) {
          setIsUnlocked(progressRows[0].is_unlocked === 1);
          setCurrentLevel(
            Number(progressRows[0].current_level),
          );
        } else {
          setIsUnlocked(false);
          setCurrentLevel(0);
        }

        setTokenQuantities(quantities);
        setCharacter(characterRows[0]);
        setTokens(tokenRows);
        setRequirements(requirementRows);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : String(err),
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
              <option key={level} value={level}>
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