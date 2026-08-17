import {
  useEffect,
  useState,
} from "react";

import AppShell, {
  type ShellPage,
} from "./components/AppShell";

import CharacterDetailPage from "./pages/CharacterDetailPage";
import CharactersOverviewPage from "./pages/CharactersOverviewPage";

import type {
  SaveStatus,
} from "./types/dmk";

import "./App.css";

type AppPage =
  | {
      name: ShellPage;
    }
  | {
      name: "character";
      characterId: string;
    };

type PlaceholderDefinition = {
  title: string;
  subtitle: string;
};

const placeholderPages: Record<
  Exclude<
    ShellPage,
    "characters"
  >,
  PlaceholderDefinition
> = {
  summary: {
    title: "Summary & Guide",
    subtitle:
      "Overview, totals, and planning tools",
  },
  attractions: {
    title: "Attractions",
    subtitle:
      "Ownership, cost, unlock requirements, and enchantment information",
  },
  questChecklist: {
    title: "Quest Checklist",
    subtitle:
      "Searchable quest records and locally saved completion progress",
  },
  tokenActivities: {
    title: "Token Activities",
    subtitle:
      "Character activities, token sources, and collection planning",
  },
  collections: {
    title: "Collections",
    subtitle:
      "Collection progress and character completion",
  },
  fullGuide: {
    title: "Full Guide",
    subtitle:
      "Detailed planning and progression information",
  },
  settings: {
    title: "Settings",
    subtitle:
      "Application preferences, backups, and update options",
  },
};

function PlaceholderPage({
  page,
}: {
  page: Exclude<
    ShellPage,
    "characters"
  >;
}) {
  const definition =
    placeholderPages[page];

  return (
    <main className="app-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            {definition.title}
          </h1>

          <p className="page-subtitle">
            {definition.subtitle}
          </p>
        </div>
      </header>

      <section className="placeholder-card">
        <h2>
          Screen coming in a later
          UI step
        </h2>

        <p>
          The application shell and
          navigation are already in
          place. This screen will be
          connected to the DMK data
          model as development
          continues.
        </p>
      </section>
    </main>
  );
}

function App() {
  const [
    page,
    setPage,
  ] = useState<AppPage>({
    name: "characters",
  });

  const [
    characterSaveStatus,
    setCharacterSaveStatus,
  ] =
    useState<SaveStatus>(
      "idle",
    );

  const [
    pendingNavigation,
    setPendingNavigation,
  ] =
    useState<ShellPage | null>(
      null,
    );

  const activePage: ShellPage =
    page.name === "character"
      ? "characters"
      : page.name;

  function navigateImmediately(
    destination: ShellPage,
  ) {
    setPendingNavigation(null);

    setCharacterSaveStatus(
      "idle",
    );

    setPage({
      name: destination,
    });
  }

  function handleNavigate(
    destination: ShellPage,
  ) {
    if (
      page.name === "character" &&
      (characterSaveStatus ===
        "pending" ||
        characterSaveStatus ===
          "saving")
    ) {
      setPendingNavigation(
        destination,
      );

      return;
    }

    if (
      page.name === "character" &&
      characterSaveStatus ===
        "error"
    ) {
      return;
    }

    navigateImmediately(
      destination,
    );
  }

  useEffect(() => {
    if (
      page.name !== "character" ||
      pendingNavigation === null
    ) {
      return;
    }

    if (
      characterSaveStatus ===
        "saved" ||
      characterSaveStatus ===
        "idle"
    ) {
      const destination =
        pendingNavigation;

      setPendingNavigation(null);

      setCharacterSaveStatus(
        "idle",
      );

      setPage({
        name: destination,
      });

      return;
    }

    if (
      characterSaveStatus ===
      "error"
    ) {
      setPendingNavigation(
        null,
      );
    }
  }, [
    characterSaveStatus,
    page.name,
    pendingNavigation,
  ]);

  let content;

  if (
    page.name === "character"
  ) {
    content = (
      <CharacterDetailPage
        initialCharacterId={
          page.characterId
        }
        onBack={() =>
          handleNavigate(
            "characters",
          )
        }
        onSaveStatusChange={
          setCharacterSaveStatus
        }
      />
    );
  } else if (
    page.name === "characters"
  ) {
    content = (
      <CharactersOverviewPage
        onOpenCharacter={(
          characterId,
        ) =>
          setPage({
            name: "character",
            characterId,
          })
        }
      />
    );
  } else {
    content = (
      <PlaceholderPage
        page={page.name}
      />
    );
  }

  return (
    <AppShell
      activePage={activePage}
      onNavigate={
        handleNavigate
      }
    >
      {content}
    </AppShell>
  );
}

export default App;