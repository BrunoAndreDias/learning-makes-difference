import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useRouteContext,
  useRouter,
} from "@tanstack/react-router";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import appLogo from "../../../../docs/layout/logo.svg";
import type { AppSessionSnapshot } from "../../access/domain/session";
import {
  LearningLoopWorkspaceProvider,
  NotesWorkspaceSidebar,
  RecallResultsSidebar,
} from "../../learning-loop";
import {
  type AppFocusContext,
  AppFocusError,
  type FocusSession,
} from "../../learning-loop/domain/focus";

type NavigationIconName = "label" | "note" | "recall" | "settings";

const DEFAULT_FOCUS_MINUTES = "25";
const DEFAULT_BREAK_MINUTES = "5";
const EMPTY_PLANNED_FOCUS_INTERVALS = "";

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
  const focus = useRouteContext({
    from: "/_protected",
    select: (context) => context.focus,
  });
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
  useSyncExternalStore(focus.subscribe, focus.getSnapshot, focus.getSnapshot);
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
  const userId = sessionSnapshot.user?.id ?? null;
  const activeFocusSession =
    userId === null ? null : focus.getActiveSession({ userId });

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
              <FocusSessionStartControl
                activeFocusSession={activeFocusSession}
                focus={focus}
                userId={userId}
              />
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

function FocusSessionStartControl({
  activeFocusSession,
  focus,
  userId,
}: Readonly<{
  activeFocusSession: FocusSession | null;
  focus: AppFocusContext;
  userId: string | null;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES);
  const [plannedFocusIntervals, setPlannedFocusIntervals] = useState(
    EMPTY_PLANNED_FOCUS_INTERVALS,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorId = useId();

  useEffect(() => {
    if (activeFocusSession === null) {
      return;
    }

    setIsOpen(false);
    setErrorMessage(null);
  }, [activeFocusSession]);

  if (activeFocusSession !== null) {
    const actionLabel = getFocusActionLabel(activeFocusSession);

    return (
      <fieldset className="app-focus-session-status tag-row">
        <legend className="sr-only">Active focus session</legend>
        <button
          className="notes-action notes-action-primary"
          disabled
          type="button"
        >
          Focus active
        </button>
        <span role="status">{getFocusStatusMessage(activeFocusSession)}</span>
        {userId === null ? null : (
          <button
            className="notes-action"
            onClick={() => {
              focus.endFocusSession({
                userId,
              });
            }}
            type="button"
          >
            End focus
          </button>
        )}
        {actionLabel === null || userId === null ? null : (
          <button
            className="notes-action"
            onClick={() => {
              focus.startNextFocusInterval({
                userId,
              });
            }}
            type="button"
          >
            {actionLabel}
          </button>
        )}
      </fieldset>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (userId === null) {
      return;
    }

    try {
      focus.startFocusSession({
        breakIntervalMinutes: Number(breakMinutes),
        focusIntervalMinutes: Number(focusMinutes),
        plannedFocusIntervalCount: parseOptionalNumber(plannedFocusIntervals),
        userId,
      });
      setErrorMessage(null);
      setPlannedFocusIntervals(EMPTY_PLANNED_FOCUS_INTERVALS);
    } catch (error) {
      if (error instanceof AppFocusError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  function updateFocusMinutes(value: string) {
    setFocusMinutes(value);
    setErrorMessage(null);
  }

  function updateBreakMinutes(value: string) {
    setBreakMinutes(value);
    setErrorMessage(null);
  }

  function updatePlannedFocusIntervals(value: string) {
    setPlannedFocusIntervals(value);
    setErrorMessage(null);
  }

  if (!isOpen) {
    return (
      <button
        className="notes-action notes-action-primary"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Start Focus
      </button>
    );
  }

  return (
    <form
      aria-describedby={errorMessage === null ? undefined : errorId}
      aria-label="Focus session start"
      className="tag-row"
      onSubmit={handleSubmit}
    >
      <label>
        <span className="sr-only">Focus minutes</span>
        <input
          inputMode="numeric"
          onChange={(event) => updateFocusMinutes(event.target.value)}
          type="number"
          value={focusMinutes}
        />
      </label>
      <label>
        <span className="sr-only">Break minutes</span>
        <input
          inputMode="numeric"
          onChange={(event) => updateBreakMinutes(event.target.value)}
          type="number"
          value={breakMinutes}
        />
      </label>
      <label>
        <span className="sr-only">Planned focus intervals</span>
        <input
          inputMode="numeric"
          onChange={(event) => updatePlannedFocusIntervals(event.target.value)}
          placeholder="Optional rounds"
          type="number"
          value={plannedFocusIntervals}
        />
      </label>
      <button className="notes-action notes-action-primary" type="submit">
        Start Focus
      </button>
      <button
        className="notes-action"
        onClick={() => {
          setIsOpen(false);
          setErrorMessage(null);
        }}
        type="button"
      >
        Cancel
      </button>
      {errorMessage === null ? null : (
        <span id={errorId} role="status">
          {errorMessage}
        </span>
      )}
    </form>
  );
}

function getFocusActionLabel(session: FocusSession) {
  switch (session.intervalState) {
    case "Transition":
      return "Continue focus";
    case "Break":
      return "Skip break";
    case "AwaitingNextFocus":
      return "Start next focus";
    case "Focus":
      return null;
  }
}

function getFocusStatusMessage(session: FocusSession) {
  switch (session.intervalState) {
    case "Transition":
      return `Transition window: ${session.remainingSeconds ?? 0}s left`;
    case "Break":
      return `Break: ${session.remainingSeconds ?? 0}s left`;
    case "AwaitingNextFocus":
      return session.isStale ? "Focus session stale" : "Ready for next focus";
    case "Focus":
      return `Focus: ${session.remainingSeconds ?? 0}s left`;
  }
}

function parseOptionalNumber(value: string) {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  return Number(trimmedValue);
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
