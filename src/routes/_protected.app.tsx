import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { useId, useState } from "react";

import appLogo from "../../docs/layout/logo.png";

export const Route = createFileRoute("/_protected/app")({
  component: AppLayout,
});

const appNavigationItems = [
  {
    description:
      "Placeholder launch surface for notes, labels, and recall work.",
    label: "Dashboard",
    shortLabel: "DB",
    to: "/app/dashboard",
  },
  {
    description:
      "Profile and language controls will expand here in later issues.",
    label: "Settings",
    shortLabel: "ST",
    to: "/app/settings",
  },
] as const;

function AppLayout() {
  const location = useLocation();
  const navigationId = useId();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const activeItem =
    appNavigationItems.find((item) => location.pathname.startsWith(item.to)) ??
    appNavigationItems[0];

  return (
    <section
      className="authenticated-shell"
      data-mobile-nav-open={isMobileSidebarOpen ? "true" : "false"}
    >
      <aside
        aria-label="App sidebar"
        className="app-sidebar shell-panel"
        data-mobile-open={isMobileSidebarOpen ? "true" : "false"}
        data-sidebar-state={isSidebarCollapsed ? "collapsed" : "expanded"}
      >
        <div className="app-sidebar__header">
          <Link
            aria-label="Learning Makes Difference home"
            className="brand-lockup app-sidebar__brand"
            onClick={() => setMobileSidebarOpen(false)}
            to="/app/dashboard"
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
            aria-label={
              isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
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
                  aria-label={item.label}
                  className="app-sidebar__link"
                  onClick={() => setMobileSidebarOpen(false)}
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
            LM
          </div>
          <div className="app-sidebar__profile">
            <strong>Placeholder user</strong>
            <span>Auth wiring arrives in a follow-up issue.</span>
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
              aria-expanded={isMobileSidebarOpen ? "true" : "false"}
              aria-label={
                isMobileSidebarOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
              }
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
