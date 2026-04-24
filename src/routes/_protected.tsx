import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
} from "@tanstack/react-router";
import { useId, useState } from "react";

import appLogo from "../../docs/layout/logo.png";
import { hasActiveSession } from "../lib/session";

export const Route = createFileRoute("/_protected")({
  beforeLoad: ({ context, location }) => {
    if (!hasActiveSession(context.session.getSnapshot())) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: AppLayout,
});

const appNavigationItems = [
  {
    description: "Capture focused concepts and draft the note workflow.",
    label: "Notes",
    shortLabel: "NT",
    to: "/notes",
  },
  {
    description: "Shape the label graph and topic organization surfaces.",
    label: "Labels",
    shortLabel: "LB",
    to: "/labels",
  },
  {
    description: "Exercise recall sessions before the real study loop lands.",
    label: "Recall",
    shortLabel: "RC",
    to: "/recall",
  },
  {
    description: "Reserve space for completed and partial study history.",
    label: "History",
    shortLabel: "HS",
    to: "/history",
  },
  {
    description: "Profile and language controls will expand here later.",
    label: "Settings",
    shortLabel: "ST",
    to: "/settings",
  },
] as const;

function getActiveNavigationItem(pathname: string) {
  return (
    appNavigationItems.find((item) => pathname.startsWith(item.to)) ??
    appNavigationItems[0]
  );
}

function AppLayout() {
  const session = Route.useRouteContext({
    select: (context) => context.session.getSnapshot(),
  });
  const location = useLocation();
  const navigationId = useId();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const activeItem = getActiveNavigationItem(location.pathname);
  const sidebarState = isSidebarCollapsed ? "collapsed" : "expanded";
  const sidebarToggleLabel = isSidebarCollapsed
    ? "Expand sidebar"
    : "Collapse sidebar";
  const mobileToggleLabel = isMobileSidebarOpen
    ? "Close navigation menu"
    : "Open navigation menu";

  function handleMobileSidebarClose() {
    setMobileSidebarOpen(false);
  }

  return (
    <section className="authenticated-shell">
      <aside
        aria-label="App sidebar"
        className="app-sidebar shell-panel"
        data-mobile-open={isMobileSidebarOpen}
        data-sidebar-state={sidebarState}
      >
        <div className="app-sidebar__header">
          <Link
            aria-label="Learning Makes Difference home"
            className="brand-lockup app-sidebar__brand"
            onClick={handleMobileSidebarClose}
            to="/notes"
          >
            <img
              alt="Learning Makes Difference"
              className="app-sidebar__logo"
              height="56"
              src={appLogo}
              width="56"
            />
            <span className="app-sidebar__brand-copy">
              <span className="app-sidebar__product">
                Learning Makes Difference
              </span>
              <span className="app-sidebar__context">
                Authenticated workspace
              </span>
            </span>
          </Link>

          <button
            aria-controls={navigationId}
            aria-label={sidebarToggleLabel}
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((value) => !value)}
            type="button"
          >
            {isSidebarCollapsed ? ">" : "<"}
          </button>
        </div>

        <nav
          aria-label="App sections"
          className="app-sidebar__nav"
          id={navigationId}
        >
          <ul className="app-sidebar__list">
            {appNavigationItems.map((item) => (
              <li key={item.to}>
                <Link
                  activeProps={{
                    className: "app-sidebar__link app-sidebar__link-active",
                  }}
                  className="app-sidebar__link"
                  onClick={handleMobileSidebarClose}
                  to={item.to}
                >
                  <span aria-hidden="true" className="app-sidebar__icon">
                    {item.shortLabel}
                  </span>
                  <span className="app-sidebar__label">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="app-sidebar__footer">
          <div className="app-sidebar__avatar" aria-hidden="true">
            {session.user?.displayName.slice(0, 2).toUpperCase() ?? "LM"}
          </div>
          <div className="app-sidebar__profile">
            <strong>{session.user?.displayName ?? "Placeholder user"}</strong>
            <span>Session guard scaffolded; auth flows land next.</span>
          </div>
        </div>
      </aside>

      <div className="app-frame shell-panel">
        <header className="app-frame__header">
          <div className="stack app-frame__title">
            <p className="section-label">Authenticated workspace</p>
            <h2>{activeItem.label}</h2>
            <p className="muted">{activeItem.description}</p>
          </div>

          <div className="app-frame__actions">
            <button
              aria-controls={navigationId}
              aria-expanded={isMobileSidebarOpen}
              aria-label={mobileToggleLabel}
              className="sidebar-mobile-toggle"
              onClick={() => setMobileSidebarOpen((value) => !value)}
              type="button"
            >
              {isMobileSidebarOpen ? "Close menu" : "Open menu"}
            </button>
            <span className="tag">Shell ready for future modules</span>
          </div>
        </header>

        <div className="app-frame__content">
          <Outlet />
        </div>
      </div>
    </section>
  );
}
