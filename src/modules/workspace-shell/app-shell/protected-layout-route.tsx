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
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import appLogo from "../../../../docs/layout/logo.svg";
import { Button } from "../../../design-system/button";
import type { AppSessionSnapshot } from "../../access/session/session";
import { useResolvedProtectedSession } from "../../access/session/use-resolved-protected-session";
import { FocusSessionStartControl } from "../../focus";
import { useAppTranslation } from "../../language";
import { NotesWorkspaceProvider } from "../../notes";

type NavigationIconName = "focus" | "label" | "note" | "recall" | "settings";
type WorkspaceFrameName =
  | "focus"
  | "labels"
  | "notes"
  | "recall"
  | "recall-results"
  | "settings";

const globalNavigationItems = [
  {
    iconName: "note",
    labelKey: "shell.navigation.notes",
    to: "/study-notes",
  },
  {
    iconName: "recall",
    labelKey: "shell.navigation.recall",
    to: "/recall",
  },
  {
    iconName: "label",
    labelKey: "shell.navigation.labels",
    to: "/labels",
  },
  {
    iconName: "focus",
    labelKey: "shell.navigation.focus",
    to: "/focus",
  },
] as const;

function isWorkspacePath(pathname: string, workspacePath: string) {
  return pathname === workspacePath || pathname.startsWith(`${workspacePath}/`);
}

function getWorkspaceTitleKey(pathname: string) {
  if (isLabelsWorkspacePath(pathname)) {
    return "shell.workspace.labels";
  }

  if (isRecallWorkspacePath(pathname)) {
    return "shell.workspace.recall";
  }

  if (isFocusWorkspacePath(pathname)) {
    return "shell.workspace.focus";
  }

  if (isSettingsWorkspacePath(pathname)) {
    return "shell.workspace.settings";
  }

  return "shell.workspace.notes";
}

function getRecallWorkspaceTitleKey(pathname: string) {
  if (pathname === "/recall/select") {
    return "shell.workspace.recallSetup";
  }

  if (pathname === "/recall/session") {
    return "shell.workspace.recallSession";
  }

  if (isRecallWorkspacePath(pathname)) {
    return "shell.workspace.recall";
  }

  return null;
}

function isNotesWorkspacePath(pathname: string) {
  return isWorkspacePath(pathname, "/study-notes");
}

function isRecallWorkspacePath(pathname: string) {
  return isWorkspacePath(pathname, "/recall");
}

function isLabelsWorkspacePath(pathname: string) {
  return isWorkspacePath(pathname, "/labels");
}

function isFocusWorkspacePath(pathname: string) {
  return isWorkspacePath(pathname, "/focus");
}

function isSettingsWorkspacePath(pathname: string) {
  return isWorkspacePath(pathname, "/settings");
}

function getWorkspaceFrameName(
  pathname: string,
): WorkspaceFrameName | undefined {
  if (isNotesWorkspacePath(pathname)) {
    return "notes";
  }

  if (pathname === "/recall") {
    return "recall-results";
  }

  if (isRecallWorkspacePath(pathname)) {
    return "recall";
  }

  if (isLabelsWorkspacePath(pathname)) {
    return "labels";
  }

  if (isFocusWorkspacePath(pathname)) {
    return "focus";
  }

  if (isSettingsWorkspacePath(pathname)) {
    return "settings";
  }

  return undefined;
}

export function AppLayout() {
  const { t } = useAppTranslation();
  const focus = useRouteContext({
    from: "/_protected",
    select: (context) => context.focus,
  });
  const persistentFocus = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentFocus,
  });
  const { session, sessionSnapshot } =
    useResolvedProtectedSession("/_protected");
  const location = useLocation();
  const navigate = useNavigate();
  const router = useRouter();
  const navigationId = useId();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isLoggingOut, setLoggingOut] = useState(false);
  const currentLocationKey = `${location.pathname}?${JSON.stringify(location.search)}`;
  const collapsedSidebarToggleRef = useRef<HTMLButtonElement | null>(null);
  const mobileSidebarToggleRef = useRef<HTMLButtonElement | null>(null);
  const mobileSidebarCloseRef = useRef<HTMLButtonElement | null>(null);
  const previousLocationRef = useRef(currentLocationKey);
  useSyncExternalStore(focus.subscribe, focus.getSnapshot, focus.getSnapshot);
  const workspaceTitle = t(getWorkspaceTitleKey(location.pathname));
  const recallWorkspaceTitleKey = getRecallWorkspaceTitleKey(location.pathname);
  const recallWorkspaceTitle =
    recallWorkspaceTitleKey === null ? null : t(recallWorkspaceTitleKey);
  const workspaceFrameName = getWorkspaceFrameName(location.pathname);
  const isNotesWorkspaceRoute = isNotesWorkspacePath(location.pathname);
  const isRecallWorkspaceRoute = isRecallWorkspacePath(location.pathname);
  const isLabelsWorkspaceRoute = isLabelsWorkspacePath(location.pathname);
  const isFocusWorkspaceRoute = isFocusWorkspacePath(location.pathname);
  const isSettingsWorkspaceRoute = isSettingsWorkspacePath(location.pathname);
  const sidebarState = isSidebarCollapsed ? "collapsed" : "expanded";
  const sidebarToggleLabel = isSidebarCollapsed
    ? t("shell.navigation.expandSidebar")
    : t("shell.navigation.collapseSidebar");
  const userId = sessionSnapshot.user?.id ?? null;
  const activeFocusSession =
    userId === null ? null : focus.getActiveSession({ userId });

  function closeMobileSidebar(options?: { returnFocusToToggle?: boolean }) {
    setMobileSidebarOpen(false);

    if (options?.returnFocusToToggle) {
      mobileSidebarToggleRef.current?.focus();
    }
  }

  function openMobileSidebar() {
    setMobileSidebarOpen(true);
  }

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await session.logout();
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
    if (previousLocationRef.current === currentLocationKey) {
      return;
    }

    previousLocationRef.current = currentLocationKey;
    setMobileSidebarOpen(false);
  }, [currentLocationKey]);

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      return;
    }

    mobileSidebarCloseRef.current?.focus();

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      setMobileSidebarOpen(false);
      mobileSidebarToggleRef.current?.focus();
    }

    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [isMobileSidebarOpen]);

  return (
    <NotesWorkspaceProvider>
      <section
        className="authenticated-shell"
        data-sidebar-state={sidebarState}
      >
        <aside
          aria-label={t("shell.workspace.notesWorkspace")}
          className="app-sidebar shell-panel"
          data-mobile-open={isMobileSidebarOpen ? "true" : "false"}
          data-sidebar-state={sidebarState}
          hidden={isSidebarCollapsed}
          id={navigationId}
          tabIndex={-1}
        >
          <div className="app-sidebar__header">
            <AccountMenu
              isLoggingOut={isLoggingOut}
              onLogout={() => void handleLogout()}
              sessionSnapshot={sessionSnapshot}
            />

            <Button
              aria-controls={navigationId}
              aria-label={sidebarToggleLabel}
              className="sidebar-toggle"
              iconOnly
              onClick={() => setSidebarCollapsed((value) => !value)}
              type="button"
            >
              <SidebarCollapseIcon />
            </Button>
            <Button
              aria-controls={navigationId}
              aria-label={t("shell.navigation.closeMenu")}
              className="mobile-sidebar-close"
              iconOnly
              onClick={() =>
                closeMobileSidebar({
                  returnFocusToToggle: true,
                })
              }
              ref={mobileSidebarCloseRef}
              type="button"
            >
              <SidebarCloseIcon />
            </Button>
          </div>

          <GlobalNavigation onNavigate={closeMobileSidebar} />
        </aside>

        <div className="app-frame" data-workspace={workspaceFrameName}>
          <WorkspaceHeader
            activeFocusSession={activeFocusSession}
            collapsedSidebarToggleRef={collapsedSidebarToggleRef}
            focus={focus}
            persistentFocus={persistentFocus}
            isNotesWorkspaceRoute={isNotesWorkspaceRoute}
            isRecallWorkspaceRoute={isRecallWorkspaceRoute}
            isLabelsWorkspaceRoute={isLabelsWorkspaceRoute}
            isFocusWorkspaceRoute={isFocusWorkspaceRoute}
            isSettingsWorkspaceRoute={isSettingsWorkspaceRoute}
            isSidebarCollapsed={isSidebarCollapsed}
            isMobileSidebarOpen={isMobileSidebarOpen}
            mobileSidebarToggleRef={mobileSidebarToggleRef}
            navigationId={navigationId}
            onOpenMobileSidebar={openMobileSidebar}
            onExpandSidebar={() => setSidebarCollapsed(false)}
            recallWorkspaceTitle={recallWorkspaceTitle}
            userId={userId}
            workspaceTitle={workspaceTitle}
          />

          <div className="app-frame__content">
            <Outlet />
          </div>
        </div>
      </section>
    </NotesWorkspaceProvider>
  );
}

function WorkspaceHeader({
  activeFocusSession,
  collapsedSidebarToggleRef,
  focus,
  persistentFocus,
  isNotesWorkspaceRoute,
  isRecallWorkspaceRoute,
  isLabelsWorkspaceRoute,
  isFocusWorkspaceRoute,
  isSettingsWorkspaceRoute,
  isSidebarCollapsed,
  isMobileSidebarOpen,
  mobileSidebarToggleRef,
  navigationId,
  onOpenMobileSidebar,
  onExpandSidebar,
  recallWorkspaceTitle,
  userId,
  workspaceTitle,
}: {
  activeFocusSession: Parameters<
    typeof FocusSessionStartControl
  >[0]["activeFocusSession"];
  collapsedSidebarToggleRef: RefObject<HTMLButtonElement | null>;
  focus: Parameters<typeof FocusSessionStartControl>[0]["focus"];
  persistentFocus: Parameters<
    typeof FocusSessionStartControl
  >[0]["persistentFocus"];
  isNotesWorkspaceRoute: boolean;
  isRecallWorkspaceRoute: boolean;
  isLabelsWorkspaceRoute: boolean;
  isFocusWorkspaceRoute: boolean;
  isSettingsWorkspaceRoute: boolean;
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  mobileSidebarToggleRef: RefObject<HTMLButtonElement | null>;
  navigationId: string;
  onOpenMobileSidebar: () => void;
  onExpandSidebar: () => void;
  recallWorkspaceTitle: string | null;
  userId: string | null;
  workspaceTitle: string;
}) {
  const { t } = useAppTranslation();
  const hasVisuallyHiddenWorkspaceTitle =
    isRecallWorkspaceRoute ||
    isLabelsWorkspaceRoute ||
    isFocusWorkspaceRoute ||
    isSettingsWorkspaceRoute;

  return (
    <header className="app-frame__workspace-header">
      <div className="app-frame__titlebar">
        <Button
          aria-controls={navigationId}
          aria-expanded={isMobileSidebarOpen}
          aria-label={t("shell.navigation.openMenu")}
          className="mobile-sidebar-toggle"
          iconOnly
          onClick={onOpenMobileSidebar}
          ref={mobileSidebarToggleRef}
          type="button"
        >
          <SidebarMenuIcon />
        </Button>
        {isSidebarCollapsed ? (
          <Button
            aria-controls={navigationId}
            aria-label={t("shell.navigation.expandSidebar")}
            className="sidebar-header-toggle"
            iconOnly
            onClick={onExpandSidebar}
            ref={collapsedSidebarToggleRef}
            type="button"
          >
            <SidebarReopenIcon />
          </Button>
        ) : null}
        {isNotesWorkspaceRoute ? null : (
          <h2
            className={
              hasVisuallyHiddenWorkspaceTitle
                ? "app-frame__workspace-title sr-only"
                : "app-frame__workspace-title"
            }
          >
            {isRecallWorkspaceRoute
              ? (recallWorkspaceTitle ?? workspaceTitle)
              : workspaceTitle}
          </h2>
        )}
      </div>
      <div className="app-frame__actions">
        {isNotesWorkspaceRoute || isLabelsWorkspaceRoute ? null : (
          <FocusSessionStartControl
            activeFocusSession={activeFocusSession}
            focus={focus}
            persistentFocus={persistentFocus}
            userId={userId}
          />
        )}
      </div>
    </header>
  );
}

function GlobalNavigation({
  onNavigate,
}: Readonly<{
  onNavigate: () => void;
}>) {
  const { t } = useAppTranslation();

  return (
    <nav
      aria-label={t("shell.navigation.appSections")}
      className="app-sidebar__nav"
    >
      <ul className="app-sidebar__list">
        {globalNavigationItems.map((navigationItem) => (
          <li key={navigationItem.to}>
            <Link
              activeProps={{
                className: "app-sidebar__link app-sidebar__link-active",
              }}
              className="app-sidebar__link"
              onClick={onNavigate}
              to={navigationItem.to}
            >
              <span aria-hidden="true" className="app-sidebar__icon">
                <NavigationIcon name={navigationItem.iconName} />
              </span>
              <span className="app-sidebar__label">
                {t(navigationItem.labelKey)}
              </span>
            </Link>
          </li>
        ))}
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
  const { t } = useAppTranslation();
  const accountMenuId = useId();
  const [isAccountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const displayName =
    sessionSnapshot.user?.displayName ?? t("shell.account.unknownUser");
  const email = sessionSnapshot.user?.email ?? t("shell.account.noEmail");

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
        aria-label={`${displayName} ${email} ${t("shell.account.menuLabel")}`}
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
          aria-label={t("shell.account.options")}
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
            <span>{t("shell.account.settings")}</span>
          </Link>
          <button
            className="account-menu__item"
            disabled={isLoggingOut}
            onClick={onLogout}
            role="menuitem"
            type="button"
          >
            {isLoggingOut
              ? t("shell.actions.loggingOut")
              : t("shell.actions.logout")}
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

function SidebarMenuIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function SidebarCloseIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
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
    case "focus":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 2v3" />
          <path d="M12 19v3" />
          <path d="M2 12h3" />
          <path d="M19 12h3" />
        </svg>
      );
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
