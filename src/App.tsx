import {
  useCallback,
  useEffect,
  useState,
} from "react";

import AppShell, {
  type ShellPage,
} from "./components/AppShell";

import CharacterDetailPage from "./pages/CharacterDetailPage";
import CharactersOverviewPage from "./pages/CharactersOverviewPage";
import SummaryGuidePage from "./pages/SummaryGuidePage";

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

type NavigationMode =
  | "push"
  | "back";

type PendingNavigation = {
  destination: AppPage;
  mode: NavigationMode;
};

type PlaceholderDefinition = {
  title: string;
  subtitle: string;
};

type PlaceholderPageName =
  Exclude<
    ShellPage,
    | "summary"
    | "characters"
  >;

const placeholderPages: Record<
  PlaceholderPageName,
  PlaceholderDefinition
> = {
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

function isSamePage(
  firstPage: AppPage,
  secondPage: AppPage,
) {
  if (
    firstPage.name !==
    secondPage.name
  ) {
    return false;
  }

  if (
    firstPage.name ===
      "character" &&
    secondPage.name ===
      "character"
  ) {
    return (
      firstPage.characterId ===
      secondPage.characterId
    );
  }

  return true;
}

function PlaceholderPage({
  page,
}: {
  page: PlaceholderPageName;
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
    name: "summary",
  });

  const [
    pageHistory,
    setPageHistory,
  ] = useState<AppPage[]>([]);

  const [
    pageSaveStatus,
    setPageSaveStatus,
  ] =
    useState<SaveStatus>(
      "idle",
    );

  const [
    pendingNavigation,
    setPendingNavigation,
  ] =
    useState<PendingNavigation | null>(
      null,
    );

  const activePage: ShellPage =
    page.name === "character"
      ? "characters"
      : page.name;

  const performNavigation =
    useCallback(
      (
        destination: AppPage,
        mode: NavigationMode,
      ) => {
        setPendingNavigation(
          null,
        );

        setPageSaveStatus(
          "idle",
        );

        if (
          mode === "push"
        ) {
          if (
            isSamePage(
              page,
              destination,
            )
          ) {
            return;
          }

          setPageHistory(
            (currentHistory) => [
              ...currentHistory,
              page,
            ],
          );
        } else {
          setPageHistory(
            (currentHistory) => {
              if (
                currentHistory.length ===
                0
              ) {
                return currentHistory;
              }

              return currentHistory.slice(
                0,
                -1,
              );
            },
          );
        }

        setPage(
          destination,
        );
      },
      [page],
    );

  const requestNavigation =
    useCallback(
      (
        destination: AppPage,
        mode: NavigationMode,
      ) => {
        if (
          isSamePage(
            page,
            destination,
          )
        ) {
          return;
        }

        if (
          pageSaveStatus ===
            "pending" ||
          pageSaveStatus ===
            "saving"
        ) {
          setPendingNavigation({
            destination,
            mode,
          });

          return;
        }

        if (
          pageSaveStatus ===
          "error"
        ) {
          return;
        }

        performNavigation(
          destination,
          mode,
        );
      },
      [
        page,
        pageSaveStatus,
        performNavigation,
      ],
    );

  const handleNavigate =
    useCallback(
      (
        destination: ShellPage,
      ) => {
        requestNavigation(
          {
            name: destination,
          },
          "push",
        );
      },
      [requestNavigation],
    );

  const handleOpenCharacter =
    useCallback(
      (
        characterId: string,
      ) => {
        requestNavigation(
          {
            name: "character",
            characterId,
          },
          "push",
        );
      },
      [requestNavigation],
    );

  const handleBack =
    useCallback(() => {
      if (
        pageHistory.length ===
        0
      ) {
        return;
      }

      const destination =
        pageHistory[
          pageHistory.length - 1
        ];

      requestNavigation(
        destination,
        "back",
      );
    }, [
      pageHistory,
      requestNavigation,
    ]);

  useEffect(() => {
    if (
      pendingNavigation ===
      null
    ) {
      return;
    }

    if (
      pageSaveStatus ===
        "saved" ||
      pageSaveStatus ===
        "idle"
    ) {
      performNavigation(
        pendingNavigation.destination,
        pendingNavigation.mode,
      );

      return;
    }

    if (
      pageSaveStatus ===
      "error"
    ) {
      setPendingNavigation(
        null,
      );
    }
  }, [
    pageSaveStatus,
    pendingNavigation,
    performNavigation,
  ]);

  useEffect(() => {
    function handleMouseDown(
      event: MouseEvent,
    ) {
      if (
        event.button !== 3
      ) {
        return;
      }

      event.preventDefault();

      handleBack();
    }

    function preventBackAuxClick(
      event: MouseEvent,
    ) {
      if (
        event.button === 3
      ) {
        event.preventDefault();
      }
    }

    window.addEventListener(
      "mousedown",
      handleMouseDown,
    );

    window.addEventListener(
      "auxclick",
      preventBackAuxClick,
    );

    return () => {
      window.removeEventListener(
        "mousedown",
        handleMouseDown,
      );

      window.removeEventListener(
        "auxclick",
        preventBackAuxClick,
      );
    };
  }, [handleBack]);

  let content;

  if (
    page.name === "character"
  ) {
    content = (
      <CharacterDetailPage
        initialCharacterId={
          page.characterId
        }
        onBack={
          handleBack
        }
        onSaveStatusChange={
          setPageSaveStatus
        }
      />
    );
  } else if (
    page.name === "characters"
  ) {
    content = (
      <CharactersOverviewPage
        onOpenCharacter={
          handleOpenCharacter
        }
      />
    );
  } else if (
    page.name === "summary"
  ) {
    content = (
      <SummaryGuidePage
        onSaveStatusChange={
          setPageSaveStatus
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