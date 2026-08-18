import {
  useCallback,
  useRef,
  useState,
} from "react";

import {
  confirm,
} from "@tauri-apps/plugin-dialog";

import AttractionsEditorPage from "./pages/AttractionsEditorPage";
import CharacterLevelsEditorPage from "./pages/CharacterLevelsEditorPage";
import CharactersEditorPage from "./pages/CharactersEditorPage";
import CollectionsEditorPage from "./pages/CollectionsEditorPage";
import MasterImportPage from "./pages/MasterImportPage";
import TokensEditorPage from "./pages/TokensEditorPage";

import "./App.css";

type ManagerPage =
  | "collections"
  | "characters"
  | "tokens"
  | "character-levels"
  | "attractions"
  | "master-import";

function App() {
  const [
    activePage,
    setActivePage,
  ] =
    useState<ManagerPage>(
      "collections",
    );

  const [
    pageDirty,
    setPageDirty,
  ] = useState(false);

  const pageDirtyRef =
    useRef(false);

  const handleDirtyChange =
    useCallback(
      (
        dirty: boolean,
      ) => {
        pageDirtyRef.current =
          dirty;

        setPageDirty(
          dirty,
        );
      },
      [],
    );

  async function navigate(
    destination: ManagerPage,
  ) {
    if (
      destination ===
      activePage
    ) {
      return;
    }

    if (
      pageDirtyRef.current ||
      pageDirty
    ) {
      const discardChanges =
        await confirm(
          "You have unsaved changes. Discard them and leave this section?",
          {
            title:
              "DMK Data Manager",
            kind: "warning",
            okLabel:
              "Discard Changes",
            cancelLabel:
              "Keep Editing",
          },
        );

      if (!discardChanges) {
        return;
      }
    }

    pageDirtyRef.current =
      false;

    setPageDirty(false);

    setActivePage(
      destination,
    );
  }

  function renderActivePage() {
    if (
      activePage ===
      "collections"
    ) {
      return (
        <CollectionsEditorPage
          onDirtyChange={
            handleDirtyChange
          }
        />
      );
    }

    if (
      activePage ===
      "characters"
    ) {
      return (
        <CharactersEditorPage
          onDirtyChange={
            handleDirtyChange
          }
        />
      );
    }

    if (
      activePage ===
      "tokens"
    ) {
      return (
        <TokensEditorPage
          onDirtyChange={
            handleDirtyChange
          }
        />
      );
    }

    if (
      activePage ===
      "character-levels"
    ) {
      return (
        <CharacterLevelsEditorPage
          onDirtyChange={
            handleDirtyChange
          }
        />
      );
    }

    if (
      activePage ===
      "attractions"
    ) {
      return (
        <AttractionsEditorPage
          onDirtyChange={
            handleDirtyChange
          }
        />
      );
    }

    return (
      <MasterImportPage />
    );
  }

  return (
    <div className="manager-shell">
      <aside className="manager-sidebar">
        <div className="manager-brand">
          <div className="manager-brand-mark">
            DMK
          </div>

          <div>
            <div className="manager-brand-title">
              Data Manager
            </div>

            <div className="manager-brand-subtitle">
              PRIVATE AUTHORING TOOL
            </div>
          </div>
        </div>

        <div className="manager-nav-section">
          <div className="manager-nav-heading">
            GAME DATA
          </div>

          <button
            type="button"
            className={
              activePage ===
              "collections"
                ? "manager-nav-button manager-nav-button-active"
                : "manager-nav-button"
            }
            onClick={() =>
              void navigate(
                "collections",
              )
            }
          >
            Collections
          </button>

          <button
            type="button"
            className={
              activePage ===
              "characters"
                ? "manager-nav-button manager-nav-button-active"
                : "manager-nav-button"
            }
            onClick={() =>
              void navigate(
                "characters",
              )
            }
          >
            Characters
          </button>

          <button
            type="button"
            className={
              activePage ===
              "tokens"
                ? "manager-nav-button manager-nav-button-active"
                : "manager-nav-button"
            }
            onClick={() =>
              void navigate(
                "tokens",
              )
            }
          >
            Tokens & Rarity
          </button>

          <button
            type="button"
            className={
              activePage ===
              "character-levels"
                ? "manager-nav-button manager-nav-button-active"
                : "manager-nav-button"
            }
            onClick={() =>
              void navigate(
                "character-levels",
              )
            }
          >
            Character Levels
          </button>

          <button
            type="button"
            className={
              activePage ===
              "attractions"
                ? "manager-nav-button manager-nav-button-active"
                : "manager-nav-button"
            }
            onClick={() =>
              void navigate(
                "attractions",
              )
            }
          >
            Attractions
          </button>
        </div>

        <div className="manager-nav-section">
          <div className="manager-nav-heading">
            TOOLS
          </div>

          <button
            type="button"
            className="manager-nav-button"
            disabled
          >
            Validation

            <span>
              Soon
            </span>
          </button>

          <button
            type="button"
            className={
              activePage ===
              "master-import"
                ? "manager-nav-button manager-nav-button-active"
                : "manager-nav-button"
            }
            onClick={() =>
              void navigate(
                "master-import",
              )
            }
          >
            Master Import
          </button>

          <button
            type="button"
            className="manager-nav-button"
            disabled
          >
            Release Tools

            <span>
              Soon
            </span>
          </button>

          <button
            type="button"
            className="manager-nav-button"
            disabled
          >
            Settings

            <span>
              Soon
            </span>
          </button>
        </div>

        <div className="manager-sidebar-footer">
          <strong>
            AUTHORING DATABASE
          </strong>

          <span>
            dmk-editor.db
          </span>

          <span>
            Player progress is separate.
          </span>
        </div>
      </aside>

      <main className="manager-workspace">
        {renderActivePage()}
      </main>
    </div>
  );
}

export default App;