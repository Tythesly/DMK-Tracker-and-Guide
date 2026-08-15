import { useEffect, useState } from "react";
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

function App() {
  const [character, setCharacter] = useState<Character | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [requirements, setRequirements] = useState<LevelRequirement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCharacterData() {
      try {
        const db = Database.get("sqlite:dmk-data.db");

        const characterRows = await db.select<Character[]>(
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
          throw new Error("Mickey Mouse could not be found in the game database.");
        }

        const tokenRows = await db.select<Token[]>(
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

        const requirementRows = await db.select<LevelRequirement[]>(
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

        setCharacter(characterRows[0]);
        setTokens(tokenRows);
        setRequirements(requirementRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    loadCharacterData();
  }, []);

  if (error) {
    return (
      <main className="container">
        <h1>DMK Complete Tracker & Guide</h1>
        <h2>Unable to load character data</h2>
        <p>{error}</p>
      </main>
    );
  }

  if (!character) {
    return (
      <main className="container">
        <h1>DMK Complete Tracker & Guide</h1>
        <p>Loading character data...</p>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>DMK Complete Tracker & Guide</h1>

      <section>
        <h2>{character.display_name}</h2>

        <p>
          <strong>Collection:</strong> {character.collection_name}
        </p>

        <p>
          <strong>Maximum Level:</strong> {character.max_level}
        </p>

        <h3>Tokens</h3>

        <ul>
          {tokens.map((token) => (
            <li key={token.id}>
              {token.display_name} ({token.token_type})
            </li>
          ))}
        </ul>

        <h3>Level Requirements</h3>

        {Array.from(
          { length: character.max_level - 1 },
          (_, index) => index + 2,
        ).map((level) => {
          const levelRequirements = requirements.filter(
            (requirement) => requirement.target_level === level,
          );

          return (
            <div key={level}>
              <h4>Level {level}</h4>

              <ul>
                {levelRequirements.map((requirement) => (
                  <li key={requirement.token_id}>
                    {requirement.token_name}: {requirement.quantity}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </main>
  );
}

export default App;