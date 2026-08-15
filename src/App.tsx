import { useEffect, useState } from "react";
import Database from "@tauri-apps/plugin-sql";
import "./App.css";

type TableRow = {
  name: string;
};

type MetadataRow = {
  value: string;
};

type DatabaseCheck = {
  status: "checking" | "ok" | "error";
  foundTables: string[];
  schemaVersion: string | null;
  error: string | null;
};

const gameTables = [
  "metadata",
  "collections",
  "characters",
  "tokens",
  "character_levels",
  "character_level_token_requirements",
  "aliases",
];

const playerTables = [
  "metadata",
  "character_progress",
  "token_inventory",
];

const initialCheck: DatabaseCheck = {
  status: "checking",
  foundTables: [],
  schemaVersion: null,
  error: null,
};

async function checkDatabase(
  databasePath: string,
  expectedTables: string[],
): Promise<DatabaseCheck> {
  try {
    const db = Database.get(databasePath);

    const tableRows = await db.select<TableRow[]>(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `,
    );

    const foundTables = tableRows
      .map((row) => row.name)
      .filter((name) => name !== "_sqlx_migrations");

    const metadataRows = await db.select<MetadataRow[]>(
      `
        SELECT value
        FROM metadata
        WHERE key = 'schema_version'
        LIMIT 1
      `,
    );

    const missingTables = expectedTables.filter(
      (table) => !foundTables.includes(table),
    );

    if (missingTables.length > 0) {
      return {
        status: "error",
        foundTables,
        schemaVersion: metadataRows[0]?.value ?? null,
        error: `Missing tables: ${missingTables.join(", ")}`,
      };
    }

    return {
      status: "ok",
      foundTables,
      schemaVersion: metadataRows[0]?.value ?? null,
      error: null,
    };
  } catch (error) {
    return {
      status: "error",
      foundTables: [],
      schemaVersion: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function DatabaseResult({
  title,
  fileName,
  expectedTables,
  result,
}: {
  title: string;
  fileName: string;
  expectedTables: string[];
  result: DatabaseCheck;
}) {
  return (
    <section>
      <h2>{title}</h2>

      <p>
        <strong>Database:</strong> {fileName}
      </p>

      <p>
        <strong>Status:</strong>{" "}
        {result.status === "checking" && "Checking..."}
        {result.status === "ok" && "✓ Passed"}
        {result.status === "error" && "✗ Failed"}
      </p>

      {result.schemaVersion && (
        <p>
          <strong>Schema Version:</strong> {result.schemaVersion}
        </p>
      )}

      <h3>Required Tables</h3>

      <ul>
        {expectedTables.map((table) => {
          const found = result.foundTables.includes(table);

          return (
            <li key={table}>
              {result.status === "checking" ? "…" : found ? "✓" : "✗"} {table}
            </li>
          );
        })}
      </ul>

      {result.error && (
        <p>
          <strong>Error:</strong> {result.error}
        </p>
      )}
    </section>
  );
}

function App() {
  const [gameDatabase, setGameDatabase] =
    useState<DatabaseCheck>(initialCheck);

  const [playerDatabase, setPlayerDatabase] =
    useState<DatabaseCheck>(initialCheck);

  useEffect(() => {
    let cancelled = false;

    async function verifyDatabases() {
      const gameResult = await checkDatabase(
        "sqlite:dmk-data.db",
        gameTables,
      );

      if (!cancelled) {
        setGameDatabase(gameResult);
      }

      const playerResult = await checkDatabase(
        "sqlite:dmk-player.db",
        playerTables,
      );

      if (!cancelled) {
        setPlayerDatabase(playerResult);
      }
    }

    verifyDatabases();

    return () => {
      cancelled = true;
    };
  }, []);

  const allPassed =
    gameDatabase.status === "ok" &&
    playerDatabase.status === "ok";

  return (
    <main className="container">
      <h1>DMK Database Verification</h1>

      <p>
        Verifying the initial local game-data and player-progress databases.
      </p>

      <DatabaseResult
        title="Game Data"
        fileName="dmk-data.db"
        expectedTables={gameTables}
        result={gameDatabase}
      />

      <DatabaseResult
        title="Player Progress"
        fileName="dmk-player.db"
        expectedTables={playerTables}
        result={playerDatabase}
      />

      {allPassed && (
        <h2>✓ Database foundation verified successfully.</h2>
      )}
    </main>
  );
}

export default App;