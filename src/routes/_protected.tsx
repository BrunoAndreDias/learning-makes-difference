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

const appNavigationItems = [
  {
    description: "Capture focused concepts and draft the note workflow.",
    icon: "note",
    label: "Notes",
    shortLabel: "NT",
    to: "/notes",
  },
  {
    description: "Shape the label graph and topic organization surfaces.",
    icon: "label",
    label: "Labels",
    shortLabel: "LB",
    to: "/labels",
  },
  {
    description: "Exercise recall sessions before the real study loop lands.",
    icon: "recall",
    label: "Recall",
    shortLabel: "RC",
    to: "/recall",
  },
  {
    description: "Reserve space for completed and partial study history.",
    icon: "history",
    label: "History",
    shortLabel: "HS",
    to: "/history",
  },
  {
    description: "Profile and language controls will expand here later.",
    icon: "settings",
    label: "Settings",
    shortLabel: "ST",
    to: "/settings",
  },
] as const;

function getActiveNavigationItem(pathname: string) {
  return (
    appNavigationItems.find((item) => {
      return pathname === item.to || pathname.startsWith(`${item.to}/`);
    }) ?? appNavigationItems[0]
  );
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
  const activeNavigationLinkRef = useRef<HTMLAnchorElement | null>(null);
  const collapsedSidebarToggleRef = useRef<HTMLButtonElement | null>(null);
  const mobileToggleRef = useRef<HTMLButtonElement | null>(null);
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const activeItem = getActiveNavigationItem(location.pathname);
  const isNotesWorkspace = activeItem.to === "/notes";
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
      activeNavigationLinkRef.current?.focus();
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
          aria-label="App sidebar"
          className="app-sidebar shell-panel"
          data-mobile-open={isMobileSidebarOpen}
          data-sidebar-state={sidebarState}
          hidden={isSidebarCollapsed}
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

          {isNotesWorkspace ? (
            <NotesSidebarContent onCloseSidebar={handleSidebarLinkClick} />
          ) : null}

          <nav
            aria-label="App sections"
            className="app-sidebar__nav"
            id={navigationId}
          >
            <ul className="app-sidebar__list">
              {appNavigationItems.map((item) => {
                const isActiveNavigationLink = activeItem.to === item.to;

                return (
                  <li key={item.to}>
                    <Link
                      activeProps={{
                        className: "app-sidebar__link app-sidebar__link-active",
                      }}
                      className="app-sidebar__link"
                      onClick={handleSidebarLinkClick}
                      ref={
                        isActiveNavigationLink ? activeNavigationLinkRef : null
                      }
                      to={item.to}
                    >
                      <span aria-hidden="true" className="app-sidebar__icon">
                        <NavigationIcon name={item.icon} />
                      </span>
                      <span className="app-sidebar__label">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="app-sidebar__footer">
            <div className="app-sidebar__avatar" aria-hidden="true">
              {userInitials}
            </div>
            <div className="app-sidebar__profile">
              <strong>
                {sessionSnapshot.user?.displayName ?? "Unknown user"}
              </strong>
              <span>{sessionSnapshot.user?.email ?? "No email available"}</span>
            </div>
            <button
              className="app-sidebar__logout"
              disabled={isLoggingOut}
              onClick={() => void handleLogout()}
              type="button"
            >
              {isLoggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        </aside>

        <div
          className="app-frame"
          data-workspace={isNotesWorkspace ? "notes" : undefined}
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
              <h2>{activeItem.label}</h2>
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
    </NotesWorkspaceProvider>
  );
}

function NotesSidebarContent({
  onCloseSidebar,
}: Readonly<{
  onCloseSidebar: () => void;
}>) {
  const notesContext = Route.useRouteContext({
    select: (context) => context.notes,
  });
  const session = Route.useRouteContext({
    select: (context) => context.session,
  });
  const { activeNoteId, requestNewNote, requestSelectNote } =
    useNotesWorkspace();
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

  return (
    <section className="app-sidebar__workspace" aria-label="Notes sidebar">
      <div className="app-sidebar__workspace-header">
        <div>
          <p className="eyebrow">Notes workspace</p>
          <h3>All notes</h3>
        </div>
        <button
          className="notes-action notes-action-primary"
          onClick={() => {
            requestNewNote();
            onCloseSidebar();
          }}
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
            {notes.map((note) => (
              <li key={note.id}>
                <button
                  aria-current={activeNoteId === note.id ? "page" : undefined}
                  className="app-sidebar__workspace-link"
                  onClick={() => {
                    requestSelectNote(note.id);
                    onCloseSidebar();
                  }}
                  type="button"
                >
                  <span>{note.title}</span>
                  <span className="app-sidebar__workspace-meta">
                    {formatSidebarNoteDate(note.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
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
}: Readonly<{ name: (typeof appNavigationItems)[number]["icon"] }>) {
  switch (name) {
    case "label":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 12V5h7l9 9-7 7-9-9Z" />
          <path d="M8 8h.01" />
        </svg>
      );
    case "recall":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 5a7 7 0 1 1-6.4 4.2" />
          <path d="M5 5v4h4" />
          <path d="M12 9v4l3 2" />
        </svg>
      );
    case "history":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 8v5l3 2" />
          <path d="M5 5v4h4" />
          <path d="M5.6 9A7 7 0 1 1 5 12" />
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
