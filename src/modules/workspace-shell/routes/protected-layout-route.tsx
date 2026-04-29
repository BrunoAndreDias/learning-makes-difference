import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useRouteContext,
  useRouter,
} from "@tanstack/react-router";
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import appLogo from "../../../../docs/layout/logo.svg";
import type { AppSessionSnapshot } from "../../../features/session/session";
import {
  LearningLoopWorkspaceProvider,
  NotesWorkspaceSidebar,
  RecallResultsSidebar,
} from "../../learning-loop";

type NavigationIconName = "label" | "note" | "recall" | "settings";

function getWorkspaceTitle(pathname: string) {
  if (pathname === "/labels" || pathname.startsWith("/labels/")) {
    return "Labels";
  }

  if (pathname === "/recall" || pathname.startsWith("/recall/")) {
    return "Recall";
  }

  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return "Settings";
  }

  return "Notes";
}

function isNotesWorkspacePath(pathname: string) {
  return pathname === "/notes" || pathname.startsWith("/notes/");
}

function isRecallResultsWorkspacePath(pathname: string) {
  return pathname === "/recall";
}

export function AppLayout() {
  const session = useRouteContext({
    from: "/_protected",
    select: (context) => context.session,
  });
  const location = useLocation();
  const navigate = useNavigate();
  const router = useRouter();
  const navigationId = useId();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [shouldRestoreMobileToggleFocus, setShouldRestoreMobileToggleFocus] =
    useState(false);
  const [isLoggingOut, setLoggingOut] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const collapsedSidebarToggleRef = useRef<HTMLButtonElement | null>(null);
  const mobileToggleRef = useRef<HTMLButtonElement | null>(null);
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const workspaceTitle = getWorkspaceTitle(location.pathname);
  const isNotesWorkspaceRoute = isNotesWorkspacePath(location.pathname);
  const isRecallResultsWorkspaceRoute = isRecallResultsWorkspacePath(
    location.pathname,
  );
  const sidebarState = isSidebarCollapsed ? "collapsed" : "expanded";
  const sidebarToggleLabel = isSidebarCollapsed
    ? "Expand sidebar"
    : "Collapse sidebar";
  const mobileToggleLabel = isMobileSidebarOpen
    ? "Close navigation menu"
    : "Open navigation menu";

  function closeMobileSidebar(shouldRestoreFocus = false) {
    setShouldRestoreMobileToggleFocus(shouldRestoreFocus);
    setMobileSidebarOpen(false);
  }

  function toggleMobileSidebar() {
    setShouldRestoreMobileToggleFocus(false);
    setMobileSidebarOpen((value) => !value);
  }

  function handleMobileSidebarAction() {
    if (isMobileSidebarOpen) {
      closeMobileSidebar(true);
      return;
    }

    setSidebarCollapsed(false);

    toggleMobileSidebar();
  }

  async function handleLogout() {
    setLoggingOut(true);

    try {
      session.logout();
      await router.invalidate();
      await navigate({
        to: "/login",
      });
    } finally {
      setLoggingOut(false);
    }
  }

  useEffect(() => {
    if (isSidebarCollapsed) {
      collapsedSidebarToggleRef.current?.focus();
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (isMobileSidebarOpen) {
      sidebarRef.current?.focus();
      return;
    }

    if (shouldRestoreMobileToggleFocus) {
      mobileToggleRef.current?.focus();
      setShouldRestoreMobileToggleFocus(false);
    }
  }, [isMobileSidebarOpen, shouldRestoreMobileToggleFocus]);

  return (
    <LearningLoopWorkspaceProvider>
      <section
        className="authenticated-shell"
        data-sidebar-state={sidebarState}
      >
        <aside
          aria-label="Notes workspace"
          className="app-sidebar shell-panel"
          data-mobile-open={isMobileSidebarOpen}
          data-sidebar-state={sidebarState}
          hidden={isSidebarCollapsed}
          id={navigationId}
          ref={sidebarRef}
          tabIndex={-1}
        >
          <div className="app-sidebar__header">
            <AccountMenu
              isLoggingOut={isLoggingOut}
              onLogout={() => void handleLogout()}
              sessionSnapshot={sessionSnapshot}
            />

            <button
              aria-controls={navigationId}
              aria-label={sidebarToggleLabel}
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed((value) => !value)}
              type="button"
            >
              <SidebarCollapseIcon />
            </button>
          </div>

          <GlobalNavigation onNavigate={() => closeMobileSidebar(true)} />

          <div className="app-sidebar__body app-sidebar__body--notes">
            {isNotesWorkspaceRoute ? (
              <NotesWorkspaceSidebar
                closeMobileSidebar={closeMobileSidebar}
                isMobileSidebarOpen={isMobileSidebarOpen}
                isSidebarVisible={!isSidebarCollapsed}
              />
            ) : null}
            {isRecallResultsWorkspaceRoute ? (
              <RecallResultsSidebar closeMobileSidebar={closeMobileSidebar} />
            ) : null}
          </div>
        </aside>

        <div
          className="app-frame"
          data-workspace={isNotesWorkspaceRoute ? "notes" : undefined}
        >
          <header className="app-frame__mobile-header">
            <div className="app-frame__titlebar">
              {isSidebarCollapsed ? (
                <button
                  aria-controls={navigationId}
                  aria-label="Expand sidebar"
                  className="sidebar-header-toggle"
                  onClick={() => setSidebarCollapsed(false)}
                  ref={collapsedSidebarToggleRef}
                  type="button"
                >
                  <SidebarReopenIcon />
                </button>
              ) : null}
              <h2>{workspaceTitle}</h2>
            </div>
            <div className="app-frame__actions">
              <button
                aria-controls={navigationId}
                aria-expanded={isMobileSidebarOpen}
                aria-label={mobileToggleLabel}
                className="sidebar-mobile-toggle"
                onClick={handleMobileSidebarAction}
                ref={mobileToggleRef}
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
    </LearningLoopWorkspaceProvider>
  );
}

function GlobalNavigation({
  onNavigate,
}: Readonly<{
  onNavigate: () => void;
}>) {
  return (
    <nav aria-label="App sections" className="app-sidebar__nav">
      <ul className="app-sidebar__list">
        <li>
          <Link
            activeProps={{
              className: "app-sidebar__link app-sidebar__link-active",
            }}
            className="app-sidebar__link"
            onClick={onNavigate}
            to="/notes"
          >
            <span aria-hidden="true" className="app-sidebar__icon">
              <NavigationIcon name="note" />
            </span>
            <span className="app-sidebar__label">Notes</span>
          </Link>
        </li>
        <li>
          <Link
            activeProps={{
              className: "app-sidebar__link app-sidebar__link-active",
            }}
            className="app-sidebar__link"
            onClick={onNavigate}
            to="/labels"
          >
            <span aria-hidden="true" className="app-sidebar__icon">
              <NavigationIcon name="label" />
            </span>
            <span className="app-sidebar__label">Labels</span>
          </Link>
        </li>
        <li>
          <Link
            activeProps={{
              className: "app-sidebar__link app-sidebar__link-active",
            }}
            className="app-sidebar__link"
            onClick={onNavigate}
            to="/recall"
          >
            <span aria-hidden="true" className="app-sidebar__icon">
              <NavigationIcon name="recall" />
            </span>
            <span className="app-sidebar__label">Recall</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function AccountMenu({
  isLoggingOut,
  onLogout,
  sessionSnapshot,
}: Readonly<{
  isLoggingOut: boolean;
  onLogout: () => void;
  sessionSnapshot: AppSessionSnapshot;
}>) {
  const accountMenuId = useId();
  const [isAccountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const displayName = sessionSnapshot.user?.displayName ?? "Unknown user";
  const email = sessionSnapshot.user?.email ?? "No email available";

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    function handleDocumentMouseDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (accountMenuRef.current?.contains(target)) {
        return;
      }

      setAccountMenuOpen(false);
    }

    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [isAccountMenuOpen]);

  function closeAccountMenu() {
    setAccountMenuOpen(false);
  }

  function handleAccountMenuKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAccountMenu();
    }
  }

  return (
    <div className="account-menu" ref={accountMenuRef}>
      <button
        aria-label={`${displayName} ${email} account menu`}
        aria-controls={accountMenuId}
        aria-expanded={isAccountMenuOpen}
        aria-haspopup="menu"
        className="account-menu__trigger"
        onClick={() => setAccountMenuOpen((value) => !value)}
        onKeyDown={handleAccountMenuKeyDown}
        type="button"
      >
        <img
          alt=""
          aria-hidden="true"
          className="account-menu__logo"
          height="56"
          src={appLogo}
          width="56"
        />
        <span className="app-sidebar__profile">
          <strong>{displayName}</strong>
          <span className="sr-only">{email}</span>
        </span>
        <AccountMenuChevronIcon />
      </button>
      {isAccountMenuOpen ? (
        <div
          aria-label="Account options"
          className="account-menu__popover"
          id={accountMenuId}
          onKeyDown={handleAccountMenuKeyDown}
          role="menu"
        >
          <Link
            activeProps={{
              className: "account-menu__item account-menu__item-active",
            }}
            className="account-menu__item"
            onClick={closeAccountMenu}
            role="menuitem"
            to="/settings"
          >
            <span aria-hidden="true" className="app-sidebar__icon">
              <NavigationIcon name="settings" />
            </span>
            <span>Settings</span>
          </Link>
          <button
            className="account-menu__item"
            disabled={isLoggingOut}
            onClick={onLogout}
            role="menuitem"
            type="button"
          >
            {isLoggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AccountMenuChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      className="account-menu__chevron"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

function SidebarReopenIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function SidebarCollapseIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="m11 6-6 6 6 6" />
      <path d="m19 6-6 6 6 6" />
    </svg>
  );
}

function NavigationIcon({
  name,
}: Readonly<{
  name: NavigationIconName;
}>) {
  switch (name) {
    case "recall":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 5v6h6" />
          <path d="M5.5 15a7 7 0 1 0 .9-7.9L4 11" />
          <path d="M12 8v4l3 2" />
        </svg>
      );
    case "label":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 5h9l7 7-7 7H4V5Z" />
          <path d="M9 12h.01" />
        </svg>
      );
    case "settings":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="m19 12 .8-2.1-1.9-3.3-2.3.4-1.6-.9L13.2 4H9.4l-.8 2.1-1.6.9-2.3-.4-1.9 3.3.8 2.1-.8 2.1 1.9 3.3 2.3-.4 1.6.9.8 2.1h3.8l.8-2.1 1.6-.9 2.3.4 1.9-3.3L19 12Z" />
        </svg>
      );
    case "note":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M6 3h9l3 3v15H6V3Z" />
          <path d="M14 3v4h4" />
          <path d="M9 11h6" />
          <path d="M9 15h6" />
        </svg>
      );
  }
}
