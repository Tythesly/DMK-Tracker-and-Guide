import {
  useCallback,
  useState,
} from "react";

import CollectionsEditorPage from "./pages/CollectionsEditorPage";
import CharactersEditorPage from "./pages/CharactersEditorPage";

import "./App.css";

type ManagerPage =
  | "collections"
  | "characters";

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

  const handleDirtyChange =
    useCallback(
      (
        dirty: boolean,
      ) => {
        setPageDirty(
          dirty,
        );
      },
      [],
    );

  function navigate(
    destination: ManagerPage,
  ) {
    if (
      destination ===
      activePage
    ) {
      return;
    }

    if (
      pageDirty &&
      !window.confirm(
        "You have unsaved changes. Discard them and leave this section?",
      )
    ) {
      return;
    }

    setPageDirty(false);

    setActivePage(
      destination,
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
              navigate(
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
              navigate(
                "characters",
              )
            }
          >
            Characters
          </button>

          <button
            type="button"
            className="manager-nav-button"
            disabled
          >
            Tokens
            <span>
              Soon
            </span>
          </button>

          <button
            type="button"
            className="manager-nav-button"
            disabled
          >
            Character Levels
            <span>
              Soon
            </span>
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
            Player progress is
            separate.
          </span>
        </div>
      </aside>

      <main className="manager-workspace">
        {activePage ===
        "collections" ? (
          <CollectionsEditorPage
            onDirtyChange={
              handleDirtyChange
            }
          />
        ) : (
          <CharactersEditorPage
            onDirtyChange={
              handleDirtyChange
            }
          />
        )}
      </main>
    </div>
  );
}

export default App;