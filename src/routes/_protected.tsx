import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import appLogo from "../../docs/layout/logo.svg";
import { listNotesForUser } from "../features/notes/notes";
import {
  NotesWorkspaceProvider,
  useNotesWorkspace,
} from "../features/notes/notes-workspace";
import type { AppSessionSnapshot } from "../features/session/session";

export const Route = createFileRoute("/_protected")({
  component: AppLayout,
});

type NavigationIconName = "note" | "settings";

function getWorkspaceTitle(pathname: string) {
  if (pathname === "/labels" || pathname.startsWith("/labels/")) {
    return "Labels";
  }

  if (pathname === "/recall" || pathname.startsWith("/recall/")) {
    return "Recall";
  }

  if (pathname === "/history" || pathname.startsWith("/history/")) {
    return "History";
  }

  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return "Settings";
  }

  if (pathname === "/notes/recall" || pathname.startsWith("/notes/recall/")) {
    return "Recall";
  }

  return "Notes";
}

function formatSidebarNoteDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function AppLayout() {
  const session = Route.useRouteContext({
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
  const isNotesWorkspaceRoute = location.pathname.startsWith("/notes");
  const sidebarState = isSidebarCollapsed ? "collapsed" : "expanded";
  const sidebarToggleLabel = isSidebarCollapsed
    ? "Expand sidebar"
    : "Collapse sidebar";
  const mobileToggleLabel = isMobileSidebarOpen
    ? "Close navigation menu"
    : "Open navigation menu";
  const userInitials =
    sessionSnapshot.user?.displayName.slice(0, 2).toUpperCase() ?? "LM";

  function closeMobileSidebar(shouldRestoreFocus = false) {
    setShouldRestoreMobileToggleFocus(shouldRestoreFocus);
    setMobileSidebarOpen(false);
  }

  function toggleMobileSidebar() {
    setShouldRestoreMobileToggleFocus(false);
    setMobileSidebarOpen((value) => !value);
  }

  function handleSidebarLinkClick() {
    closeMobileSidebar();
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
    <NotesWorkspaceProvider>
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
            <Link
              aria-label="Learning Makes Difference home"
              className="brand-lockup app-sidebar__brand"
              onClick={handleSidebarLinkClick}
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
              <SidebarCollapseIcon />
            </button>
          </div>

          <div className="app-sidebar__body app-sidebar__body--notes">
            {isNotesWorkspaceRoute ? (
              <NotesSidebarContent
                closeMobileSidebar={closeMobileSidebar}
                isMobileSidebarOpen={isMobileSidebarOpen}
                isSidebarVisible={!isSidebarCollapsed}
              />
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

        <AccountDock
          isLoggingOut={isLoggingOut}
          onLogout={() => void handleLogout()}
          sessionSnapshot={sessionSnapshot}
          userInitials={userInitials}
        />
      </section>
    </NotesWorkspaceProvider>
  );
}

function AccountDock({
  isLoggingOut,
  onLogout,
  sessionSnapshot,
  userInitials,
}: Readonly<{
  isLoggingOut: boolean;
  onLogout: () => void;
  sessionSnapshot: AppSessionSnapshot;
  userInitials: string;
}>) {
  return (
    <footer
      aria-label="Account Dock"
      className="account-dock"
      role="contentinfo"
    >
      <div className="app-sidebar__avatar" aria-hidden="true">
        {userInitials}
      </div>
      <div className="app-sidebar__profile">
        <strong>{sessionSnapshot.user?.displayName ?? "Unknown user"}</strong>
        <span>{sessionSnapshot.user?.email ?? "No email available"}</span>
      </div>
      <Link
        activeProps={{
          className: "account-dock__link account-dock__link-active",
        }}
        className="account-dock__link"
        to="/settings"
      >
        <span aria-hidden="true" className="app-sidebar__icon">
          <NavigationIcon name="settings" />
        </span>
        <span>Settings</span>
      </Link>
      <button
        className="account-dock__logout"
        disabled={isLoggingOut}
        onClick={onLogout}
        type="button"
      >
        {isLoggingOut ? "Logging out..." : "Log out"}
      </button>
    </footer>
  );
}

function NotesSidebarContent({
  isSidebarVisible,
  isMobileSidebarOpen,
  closeMobileSidebar,
}: Readonly<{
  isSidebarVisible: boolean;
  isMobileSidebarOpen: boolean;
  closeMobileSidebar: () => void;
}>) {
  const notesContext = Route.useRouteContext({
    select: (context) => context.notes,
  });
  const session = Route.useRouteContext({
    select: (context) => context.session,
  });
  const {
    activeNoteId,
    recallSelection,
    requestEditorFocus,
    requestNewNote,
    requestSelectNote,
    toggleRecallSelection,
  } = useNotesWorkspace();
  const activeNoteRef = useRef<HTMLButtonElement | null>(null);
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const notesSnapshot = useSyncExternalStore(
    notesContext.subscribe,
    notesContext.getSnapshot,
    notesContext.getSnapshot,
  );
  const notes = listNotesForUser(
    notesSnapshot,
    sessionSnapshot.user?.id ?? null,
  );

  function handleSidebarAction(action: () => void) {
    if (isMobileSidebarOpen) {
      requestEditorFocus();
    }

    action();
    closeMobileSidebar();
  }

  function handleNoteClick(noteId: string) {
    if (recallSelection.isSelectingForRecall) {
      toggleRecallSelection(noteId);
      return;
    }

    handleSidebarAction(() => requestSelectNote(noteId));
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: activeNoteId changes which button owns the ref and must retrigger the scroll.
  useEffect(() => {
    if (!isSidebarVisible) {
      return;
    }

    activeNoteRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [activeNoteId, isSidebarVisible]);

  return (
    <section className="app-sidebar__workspace" aria-label="Notes sidebar">
      <div className="app-sidebar__workspace-header">
        <div>
          <h3>All notes</h3>
        </div>
        <button
          className="notes-action notes-action-primary"
          disabled={activeNoteId === null}
          onClick={() => handleSidebarAction(requestNewNote)}
          type="button"
        >
          New note
        </button>
      </div>

      <nav aria-label="Notes list" className="app-sidebar__workspace-nav">
        {notes.length === 0 ? (
          <p className="muted">No notes yet</p>
        ) : (
          <ul className="app-sidebar__workspace-list">
            {notes.map((note) => {
              const isRecallSelected = recallSelection.selectedNoteIds.includes(
                note.id,
              );

              return (
                <li key={note.id}>
                  <button
                    aria-label={note.title}
                    aria-current={activeNoteId === note.id ? "page" : undefined}
                    aria-pressed={
                      recallSelection.isSelectingForRecall
                        ? isRecallSelected
                        : undefined
                    }
                    className="app-sidebar__workspace-link"
                    data-recall-selected={isRecallSelected ? "true" : undefined}
                    onClick={() => handleNoteClick(note.id)}
                    ref={activeNoteId === note.id ? activeNoteRef : null}
                    type="button"
                  >
                    <span>{note.title}</span>
                    <span
                      aria-hidden="true"
                      className="app-sidebar__workspace-meta"
                    >
                      {formatSidebarNoteDate(note.updatedAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </section>
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
