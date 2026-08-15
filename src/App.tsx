import { useEffect, useState } from "react";
import Database from "@tauri-apps/plugin-sql";
import "./App.css";

type VerificationResult = {
  status: "checking" | "ok" | "error";
  message: string;
};

type CountRow = {
  count: number;
};

type CharacterRow = {
  display_name: string;
  max_level: number;
};

function App() {
  const [result, setResult] = useState<VerificationResult>({
    status: "checking",
    message: "Checking Mickey Mouse development data...",
  });

  useEffect(() => {
    let cancelled = false;

    async function verifyMickeyData() {
      try {
        const db = Database.get("sqlite:dmk-data.db");

        const character = await db.select<CharacterRow[]>(
          `
          SELECT display_name, max_level
          FROM characters
          WHERE id = 'character_mickey_mouse'
          `,
        );

        const tokens = await db.select<CountRow[]>(
          `
          SELECT COUNT(*) AS count
          FROM tokens
          WHERE associated_character_id = 'character_mickey_mouse'
             OR associated_collection_id = 'collection_mickey_friends'
          `,
        );

        const levels = await db.select<CountRow[]>(
          `
          SELECT COUNT(*) AS count
          FROM character_levels
          WHERE character_id = 'character_mickey_mouse'
          `,
        );

        const requirements = await db.select<CountRow[]>(
          `
          SELECT COUNT(*) AS count
          FROM character_level_token_requirements
          WHERE character_id = 'character_mickey_mouse'
          `,
        );

        const characterFound =
          character.length === 1 &&
          character[0].display_name === "Mickey Mouse" &&
          character[0].max_level === 10;

        const tokenCount = Number(tokens[0]?.count ?? 0);
        const levelCount = Number(levels[0]?.count ?? 0);
        const requirementCount = Number(requirements[0]?.count ?? 0);

        const passed =
          characterFound &&
          tokenCount === 3 &&
          levelCount === 10 &&
          requirementCount === 27;

        if (!cancelled) {
          if (passed) {
            setResult({
              status: "ok",
              message:
                `Mickey Mouse verified successfully.\n\n` +
                `Character: Mickey Mouse\n` +
                `Maximum Level: 10\n` +
                `Tokens: ${tokenCount}\n` +
                `Character Levels: ${levelCount}\n` +
                `Token Requirements: ${requirementCount}`,
            });
          } else {
            setResult({
              status: "error",
              message:
                `Mickey data did not match expectations.\n\n` +
                `Character Found: ${characterFound}\n` +
                `Tokens: ${tokenCount} (expected 3)\n` +
                `Character Levels: ${levelCount} (expected 10)\n` +
                `Token Requirements: ${requirementCount} (expected 27)`,
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          setResult({
            status: "error",
            message:
              error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    verifyMickeyData();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="container">
      <h1>DMK Game Data Verification</h1>

      <h2>
        {result.status === "checking" && "Checking..."}
        {result.status === "ok" && "✓ Passed"}
        {result.status === "error" && "✗ Failed"}
      </h2>

      <pre
        style={{
          whiteSpace: "pre-wrap",
          textAlign: "left",
          display: "inline-block",
        }}
      >
        {result.message}
      </pre>
    </main>
  );
}

export default App;