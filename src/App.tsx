import { useState } from "react";

import CharacterDetailPage from "./pages/CharacterDetailPage";
import CharactersOverviewPage from "./pages/CharactersOverviewPage";

import "./App.css";

type AppPage =
  | {
      name: "characters";
    }
  | {
      name: "character";
      characterId: string;
    };

function App() {
  const [page, setPage] =
    useState<AppPage>({
      name: "characters",
    });

  if (page.name === "character") {
    return (
      <CharacterDetailPage
        initialCharacterId={
          page.characterId
        }
        onBack={() =>
          setPage({
            name: "characters",
          })
        }
      />
    );
  }

  return (
    <CharactersOverviewPage
      onOpenCharacter={(characterId) =>
        setPage({
          name: "character",
          characterId,
        })
      }
    />
  );
}

export default App;