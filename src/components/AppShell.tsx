import type { ReactNode } from "react";

export type ShellPage =
  | "summary"
  | "characters"
  | "attractions"
  | "questChecklist"
  | "tokenActivities"
  | "collections"
  | "fullGuide"
  | "settings";

type AppShellProps = {
  activePage: ShellPage;
  children: ReactNode;
  onNavigate: (page: ShellPage) => void;
  navigationLocked?: boolean;
};

type NavigationItem = {
  id: ShellPage;
  label: string;
  icon: string;
};

const navigationItems: NavigationItem[] = [
  {
    id: "summary",
    label: "Summary & Guide",
    icon: "▦",
  },
  {
    id: "characters",
    label: "Characters",
    icon: "●",
  },
  {
    id: "attractions",
    label: "Attractions",
    icon: "▲",
  },
  {
    id: "questChecklist",
    label: "Quest Checklist",
    icon: "✓",
  },
  {
    id: "tokenActivities",
    label: "Token Activities",
    icon: "◎",
  },
  {
    id: "collections",
    label: "Collections",
    icon: "■",
  },
  {
    id: "fullGuide",
    label: "Full Guide",
    icon: "▥",
  },
  {
    id: "settings",
    label: "Settings",
    icon: "⚙︎",
  },
];

function AppShell({
  activePage,
  children,
  onNavigate,
  navigationLocked = false,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">
            DMK
          </div>

          <div>
            <div className="sidebar-brand-title">
              Complete Tracker
              <br />
              &amp; Guide
            </div>

            <div className="sidebar-brand-subtitle">
              APPLICATION CONCEPT
            </div>
          </div>
        </div>

        <nav
          className="sidebar-navigation"
          aria-label="Application navigation"
        >
          {navigationItems.map((item) => {
            const active =
              item.id === activePage;

            return (
              <button
                key={item.id}
                type="button"
                className={
                  active
                    ? "sidebar-nav-button sidebar-nav-button-active"
                    : "sidebar-nav-button"
                }
                disabled={navigationLocked}
                onClick={() =>
                  onNavigate(item.id)
                }
              >
                <span
                  className="sidebar-nav-icon"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>

                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-title">
            LOCAL-FIRST
          </div>

          <div>No account • No cloud save</div>
          <div>Progress stays on this device</div>
        </div>
      </aside>

      <div className="app-workspace">
        {children}
      </div>
    </div>
  );
}

export default AppShell;