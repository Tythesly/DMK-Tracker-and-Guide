import { useEffect, useState } from "react";

import { getAllCharacters } from "../data/gameData";

import type { Character } from "../types/dmk";

type CharactersOverviewPageProps = {
  onOpenCharacter: (characterId: string) => void;
};

function CharactersOverviewPage({
  onOpenCharacter,
}: CharactersOverviewPageProps) {
  const [characters, setCharacters] =
    useState<Character[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCharacters() {
      try {
        const loadedCharacters =
          await getAllCharacters();

        if (cancelled) {
          return;
        }

        setCharacters(loadedCharacters);
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
        Select a character to view their
        progress, tokens, requirements, and
        readiness.
      </p>

      {characters.length === 0 ? (
        <p>
          No active characters were found.
        </p>
      ) : (
        characters.map((character) => (
          <section key={character.id}>
            <h3>
              {character.display_name}
            </h3>

            <p>
              {character.collection_name}
            </p>

            <button
              type="button"
              onClick={() =>
                onOpenCharacter(
                  character.id,
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