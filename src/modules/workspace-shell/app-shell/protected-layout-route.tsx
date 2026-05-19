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
  type ReactNode,
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
import {
  type AppFocusContext,
  AppFocusError,
  type AppPersistentFocusContext,
  endActiveFocusSession,
  FocusDock,
  type FocusSession,
  startDefaultFocusSession,
  useFocusTimerTick,
} from "../../focus";
import { useAppTranslation } from "../../language";
import { NotesWorkspaceProvider } from "../../notes";
import { isPracticeRepairPath } from "../../recall/recall-practice-repair-paths";
import { appRoutePaths, authenticatedLandingPath } from "./route-paths";

type NavigationIconName =
  | "focus"
  | "note"
  | "practice-repair"
  | "recall"
  | "settings"
  | "today";
type WorkspaceFrameName =
  | "focus"
  | "notes"
  | "recall"
  | "recall-results"
  | "settings"
  | "today";

const globalNavigationItems = [
  {
    iconName: "today",
    labelKey: "shell.navigation.today",
    to: authenticatedLandingPath,
  },
  {
    iconName: "note",
    labelKey: "shell.navigation.notes",
    to: appRoutePaths.studyNotes,
  },
  {
    iconName: "recall",
    labelKey: "shell.navigation.recall",
    to: appRoutePaths.recall,
  },
  {
    iconName: "practice-repair",
    labelKey: "shell.navigation.practiceRepair",
    to: appRoutePaths.practiceRepair,
  },
  {
    iconName: "focus",
    labelKey: "shell.navigation.focus",
    to: appRoutePaths.focus,
  },
] as const;

const recallSubNavigationItems = [
  {
    labelKey: "recall.dueToday.title",
    to: appRoutePaths.recallDueToday,
  },
  {
    labelKey: "recall.tabs.results",
    to: appRoutePaths.recallResults,
  },
] as const;

const SIDEBAR_DOCK_UNAVAILABLE_QUERY = "(max-width: 51.99rem)";

function isWorkspacePath(pathname: string, workspacePath: string) {
  return pathname === workspacePath || pathname.startsWith(`${workspacePath}/`);
}

function getWorkspaceTitleKey(pathname: string) {
  if (isRecallWorkspacePath(pathname)) {
    return "shell.workspace.recall";
  }

  if (isPracticeRepairWorkspacePath(pathname)) {
    return "shell.workspace.practiceRepair";
  }

  if (isFocusWorkspacePath(pathname)) {
    return "shell.workspace.focus";
  }

  if (isTodayWorkspacePath(pathname)) {
    return "shell.workspace.today";
  }

  if (isSettingsWorkspacePath(pathname)) {
    return "shell.workspace.settings";
  }

  return "shell.workspace.notes";
}

function getRecallWorkspaceTitleKey(pathname: string) {
  if (pathname === appRoutePaths.recallSelect) {
    return "shell.workspace.recallSetup";
  }

  if (pathname === appRoutePaths.recallSession) {
    return "shell.workspace.recallSession";
  }

  if (isRecallWorkspacePath(pathname)) {
    return "shell.workspace.recall";
  }

  return null;
}

function isStudyNotesWorkspacePath(pathname: string) {
  return isWorkspacePath(pathname, appRoutePaths.studyNotes);
}

function isRecallWorkspacePath(pathname: string) {
  return isWorkspacePath(pathname, appRoutePaths.recall);
}

function isRecallSurfacePath(pathname: string) {
  return (
    pathname === appRoutePaths.recallDueToday ||
    pathname === appRoutePaths.recallResults
  );
}

function isFocusWorkspacePath(pathname: string) {
  return isWorkspacePath(pathname, appRoutePaths.focus);
}

function isPracticeRepairWorkspacePath(pathname: string) {
  return isPracticeRepairPath(pathname);
}

function isSettingsWorkspacePath(pathname: string) {
  return isWorkspacePath(pathname, appRoutePaths.settings);
}

function isTodayWorkspacePath(pathname: string) {
  return isWorkspacePath(pathname, authenticatedLandingPath);
}

function getWorkspaceFrameName(
  pathname: string,
): WorkspaceFrameName | undefined {
  if (isStudyNotesWorkspacePath(pathname)) {
    return "notes";
  }

  if (pathname === appRoutePaths.recall || isRecallSurfacePath(pathname)) {
    return "recall-results";
  }

  if (isRecallWorkspacePath(pathname)) {
    return "recall";
  }

  if (isPracticeRepairWorkspacePath(pathname)) {
    return "recall";
  }

  if (isFocusWorkspacePath(pathname)) {
    return "focus";
  }

  if (isTodayWorkspacePath(pathname)) {
    return "today";
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
  const isStudyNotesWorkspaceRoute = isStudyNotesWorkspacePath(
    location.pathname,
  );
  const isRecallWorkspaceRoute = isRecallWorkspacePath(location.pathname);
  const isFocusWorkspaceRoute = isFocusWorkspacePath(location.pathname);
  const isPracticeRepairWorkspaceRoute = isPracticeRepairWorkspacePath(
    location.pathname,
  );
  const isTodayWorkspaceRoute = isTodayWorkspacePath(location.pathname);
  const isSettingsWorkspaceRoute = isSettingsWorkspacePath(location.pathname);
  const sidebarState = isSidebarCollapsed ? "collapsed" : "expanded";
  const sidebarToggleLabel = isSidebarCollapsed
    ? t("shell.navigation.expandSidebar")
    : t("shell.navigation.collapseSidebar");
  const isSidebarDockUnavailable = useMediaQuery(
    SIDEBAR_DOCK_UNAVAILABLE_QUERY,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const activeFocusSession =
    userId === null ? null : focus.getActiveSession({ userId });
  const shouldRenderFocusDock = !isFocusWorkspaceRoute;
  const showHeaderFocusDock =
    shouldRenderFocusDock && (isSidebarCollapsed || isSidebarDockUnavailable);

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
        to: appRoutePaths.login,
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
            <Link className="app-sidebar__brand" to={authenticatedLandingPath}>
              <img
                alt=""
                aria-hidden="true"
                className="app-sidebar__logo"
                height="56"
                src={appLogo}
                width="56"
              />
              <span className="app-sidebar__brand-copy">
                <strong>Learning</strong>
                <strong>Makes Difference</strong>
              </span>
            </Link>

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

          <GlobalNavigation
            currentPathname={location.pathname}
            focus={focus}
            onNavigate={closeMobileSidebar}
            persistentFocus={persistentFocus}
            showFocusAction={!isSidebarDockUnavailable}
            userId={userId}
          />

          <div className="app-sidebar__footer">
            <div className="app-sidebar__streak">
              <span aria-hidden="true" className="app-sidebar__streak-icon">
                <StreakIcon />
              </span>
              <span>
                <strong>12 day streak</strong>
                <span>Keep it going!</span>
              </span>
              <span aria-hidden="true" className="app-sidebar__streak-arrow">
                <ChevronRightIcon />
              </span>
            </div>
            <AccountMenu
              isLoggingOut={isLoggingOut}
              onLogout={() => void handleLogout()}
              sessionSnapshot={sessionSnapshot}
            />
          </div>
        </aside>

        <div className="app-frame" data-workspace={workspaceFrameName}>
          <WorkspaceHeader
            activeFocusSession={activeFocusSession}
            collapsedSidebarToggleRef={collapsedSidebarToggleRef}
            focus={focus}
            persistentFocus={persistentFocus}
            isStudyNotesWorkspaceRoute={isStudyNotesWorkspaceRoute}
            isRecallWorkspaceRoute={isRecallWorkspaceRoute}
            isFocusWorkspaceRoute={isFocusWorkspaceRoute}
            isPracticeRepairWorkspaceRoute={isPracticeRepairWorkspaceRoute}
            isTodayWorkspaceRoute={isTodayWorkspaceRoute}
            isSettingsWorkspaceRoute={isSettingsWorkspaceRoute}
            isSidebarCollapsed={isSidebarCollapsed}
            isMobileSidebarOpen={isMobileSidebarOpen}
            mobileSidebarToggleRef={mobileSidebarToggleRef}
            navigationId={navigationId}
            onOpenMobileSidebar={openMobileSidebar}
            onExpandSidebar={() => setSidebarCollapsed(false)}
            recallWorkspaceTitle={recallWorkspaceTitle}
            showHeaderFocusDock={showHeaderFocusDock}
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
  isStudyNotesWorkspaceRoute,
  isRecallWorkspaceRoute,
  isFocusWorkspaceRoute,
  isPracticeRepairWorkspaceRoute,
  isTodayWorkspaceRoute,
  isSettingsWorkspaceRoute,
  isSidebarCollapsed,
  isMobileSidebarOpen,
  mobileSidebarToggleRef,
  navigationId,
  onOpenMobileSidebar,
  onExpandSidebar,
  recallWorkspaceTitle,
  showHeaderFocusDock,
  userId,
  workspaceTitle,
}: {
  activeFocusSession: FocusSession | null;
  collapsedSidebarToggleRef: RefObject<HTMLButtonElement | null>;
  focus: AppFocusContext;
  persistentFocus: AppPersistentFocusContext | undefined;
  isStudyNotesWorkspaceRoute: boolean;
  isRecallWorkspaceRoute: boolean;
  isFocusWorkspaceRoute: boolean;
  isPracticeRepairWorkspaceRoute: boolean;
  isTodayWorkspaceRoute: boolean;
  isSettingsWorkspaceRoute: boolean;
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  mobileSidebarToggleRef: RefObject<HTMLButtonElement | null>;
  navigationId: string;
  onOpenMobileSidebar: () => void;
  onExpandSidebar: () => void;
  recallWorkspaceTitle: string | null;
  showHeaderFocusDock: boolean;
  userId: string | null;
  workspaceTitle: string;
}) {
  const { t } = useAppTranslation();
  const workspaceDate = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date());
  const hasVisuallyHiddenWorkspaceTitle =
    isRecallWorkspaceRoute ||
    isPracticeRepairWorkspaceRoute ||
    isFocusWorkspaceRoute ||
    isTodayWorkspaceRoute ||
    isSettingsWorkspaceRoute;
  const headerFocusDock = showHeaderFocusDock ? (
    <FocusDock
      activeFocusSession={activeFocusSession}
      focus={focus}
      persistentFocus={persistentFocus}
      userId={userId}
      variant="pill"
    />
  ) : null;
  let titlebarContent: ReactNode;
  let workspaceActions: ReactNode | null;

  if (isStudyNotesWorkspaceRoute) {
    titlebarContent = (
      <nav aria-label="Breadcrumb" className="app-frame__breadcrumb">
        <Link to={appRoutePaths.studyNotes}>Study Notes</Link>
        <span aria-hidden="true">/</span>
        <span>Edit Note</span>
      </nav>
    );
    workspaceActions = (
      <WorkspaceMetaActions
        focusDock={headerFocusDock}
        workspaceDate={workspaceDate}
      />
    );
  } else if (isFocusWorkspaceRoute) {
    titlebarContent = (
      <h2 className="app-frame__workspace-title sr-only">{workspaceTitle}</h2>
    );
    workspaceActions = <WorkspaceDate workspaceDate={workspaceDate} />;
  } else {
    titlebarContent = (
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
    );
    workspaceActions = headerFocusDock;
  }

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
        {titlebarContent}
      </div>
      {workspaceActions === null ? null : (
        <div className="app-frame__actions">{workspaceActions}</div>
      )}
    </header>
  );
}

function WorkspaceMetaActions({
  focusDock,
  workspaceDate,
}: Readonly<{
  focusDock: ReactNode;
  workspaceDate: string;
}>) {
  return (
    <div className="app-frame__meta-actions">
      {focusDock}
      <WorkspaceDate workspaceDate={workspaceDate} />
      <Button
        aria-label="Help"
        className="app-frame__help"
        iconOnly
        type="button"
      >
        <HelpCircleIcon />
      </Button>
    </div>
  );
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => getMatchesMediaQuery(query));

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    const handleChange = () => {
      setMatches(mediaQueryList.matches);
    };

    handleChange();

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleChange);

      return () => {
        mediaQueryList.removeEventListener("change", handleChange);
      };
    }

    mediaQueryList.addListener(handleChange);

    return () => {
      mediaQueryList.removeListener(handleChange);
    };
  }, [query]);

  return matches;
}

function getMatchesMediaQuery(query: string) {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }

  return window.matchMedia(query).matches;
}

function WorkspaceDate({
  workspaceDate,
}: Readonly<{
  workspaceDate: string;
}>) {
  return (
    <span className="app-frame__date">
      <CalendarHeaderIcon />
      <span>{workspaceDate}</span>
    </span>
  );
}

function GlobalNavigation({
  currentPathname,
  focus,
  onNavigate,
  persistentFocus,
  showFocusAction,
  userId,
}: Readonly<{
  currentPathname: string;
  focus: AppFocusContext;
  onNavigate: () => void;
  persistentFocus: AppPersistentFocusContext | undefined;
  showFocusAction: boolean;
  userId: string | null;
}>) {
  const { t } = useAppTranslation();
  const isRecallRouteActive = isRecallWorkspacePath(currentPathname);
  const isFocusRouteActive = isFocusWorkspacePath(currentPathname);

  return (
    <nav
      aria-label={t("shell.navigation.appSections")}
      className="app-sidebar__nav"
    >
      <ul className="app-sidebar__list">
        {globalNavigationItems.map((navigationItem) => {
          return (
            <li key={navigationItem.to}>
              {navigationItem.to === appRoutePaths.focus ? (
                <FocusNavigationRow
                  focus={focus}
                  isRouteActive={isFocusRouteActive}
                  label={t(navigationItem.labelKey)}
                  onNavigate={onNavigate}
                  persistentFocus={persistentFocus}
                  showAction={showFocusAction}
                  userId={userId}
                />
              ) : (
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
              )}
              {navigationItem.to === appRoutePaths.recall &&
              isRecallRouteActive ? (
                <ul className="app-sidebar__sublist">
                  {recallSubNavigationItems.map((subNavigationItem) => (
                    <li key={subNavigationItem.to}>
                      <Link
                        activeOptions={{ exact: true }}
                        activeProps={{
                          className:
                            "app-sidebar__sublink app-sidebar__sublink-active",
                        }}
                        className="app-sidebar__sublink"
                        onClick={onNavigate}
                        to={subNavigationItem.to}
                      >
                        {t(subNavigationItem.labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function FocusNavigationRow({
  focus,
  isRouteActive,
  label,
  onNavigate,
  persistentFocus,
  showAction,
  userId,
}: Readonly<{
  focus: AppFocusContext;
  isRouteActive: boolean;
  label: string;
  onNavigate: () => void;
  persistentFocus: AppPersistentFocusContext | undefined;
  showAction: boolean;
  userId: string | null;
}>) {
  const { t } = useAppTranslation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorId = useId();
  const currentActiveFocusSession =
    userId === null ? null : focus.getActiveSession({ userId });
  useFocusTimerTick(currentActiveFocusSession);
  const isSessionActive = currentActiveFocusSession !== null;
  const isActionDisabled = userId === null;
  const errorDescriptionId = errorMessage === null ? undefined : errorId;
  const focusActionInput = { focus, persistentFocus, userId };
  const focusNavClassName = [
    "app-sidebar__focus-nav",
    isRouteActive ? "app-sidebar__focus-nav--route-active" : "",
    isSessionActive ? "app-sidebar__focus-nav--session-active" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const timerLabel =
    currentActiveFocusSession === null
      ? null
      : formatFocusNavTimerLabel(currentActiveFocusSession);
  const actionLabel = isSessionActive
    ? t("focus.action.end")
    : t("focus.action.start");

  useEffect(() => {
    if (currentActiveFocusSession === null) {
      return;
    }

    setErrorMessage(null);
  }, [currentActiveFocusSession]);

  async function runAction() {
    if (userId === null) {
      return;
    }

    try {
      if (currentActiveFocusSession === null) {
        await startDefaultFocusSession(focusActionInput);
      } else {
        await endActiveFocusSession(focusActionInput);
      }

      setErrorMessage(null);
    } catch (error) {
      if (error instanceof AppFocusError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  if (!showAction) {
    return (
      <Link
        activeProps={{
          className: "app-sidebar__link app-sidebar__link-active",
        }}
        className="app-sidebar__link"
        onClick={onNavigate}
        to={appRoutePaths.focus}
      >
        <span aria-hidden="true" className="app-sidebar__icon">
          <NavigationIcon name="focus" />
        </span>
        <span className="app-sidebar__label">{label}</span>
      </Link>
    );
  }

  return (
    <div
      className={focusNavClassName}
      data-focus-active={isSessionActive ? "true" : "false"}
    >
      <Link
        activeProps={{
          className:
            "app-sidebar__link app-sidebar__focus-link app-sidebar__focus-link-active",
        }}
        aria-label={label}
        className="app-sidebar__link app-sidebar__focus-link"
        onClick={onNavigate}
        to={appRoutePaths.focus}
      >
        <span aria-hidden="true" className="app-sidebar__icon">
          <NavigationIcon name="focus" />
        </span>
        <span className="app-sidebar__label">{label}</span>
        {timerLabel === null ? null : (
          <span aria-hidden="true" className="app-sidebar__focus-timer">
            {timerLabel}
          </span>
        )}
      </Link>
      <div className="app-sidebar__focus-action-slot">
        <Button
          aria-describedby={errorDescriptionId}
          className="app-sidebar__focus-action"
          disabled={isActionDisabled}
          onClick={() => void runAction()}
          size="compact"
          type="button"
          variant={isSessionActive ? "standard" : "secondary"}
        >
          {actionLabel}
        </Button>
      </div>
      {errorMessage === null ? null : (
        <span className="app-sidebar__focus-error" id={errorId} role="status">
          {errorMessage}
        </span>
      )}
    </div>
  );
}

function formatFocusNavTimerLabel(session: FocusSession) {
  const remainingSeconds = session.remainingSeconds ?? 0;
  const normalizedSeconds = remainingSeconds <= 0 ? 0 : remainingSeconds;
  const minutes = Math.floor(normalizedSeconds / 60);
  const seconds = normalizedSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
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
  const initials = getAccountInitials(displayName);

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
        <span aria-hidden="true" className="account-menu__avatar">
          {initials}
        </span>
        <span className="app-sidebar__profile">
          <strong>{displayName}</strong>
          <span className="sr-only">{email}</span>
          <span aria-hidden="true" className="account-menu__tier">
            Premium
          </span>
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
            to={appRoutePaths.settings}
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

function getAccountInitials(displayName: string) {
  const words = displayName
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return "AS";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
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

function CalendarHeaderIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M7 3v4" />
      <path d="M17 3v4" />
      <path d="M4 8h16" />
      <path d="M5 5h14v15H5V5Z" />
    </svg>
  );
}

function HelpCircleIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" />
      <path d="M9.75 9.5a2.4 2.4 0 0 1 4.5 1.2c0 1.8-2.25 2-2.25 3.8" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function StreakIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M12 21a7 7 0 0 0 7-7c0-4.5-3.3-6.8-5.2-9.7-.3 2.7-1.6 4.4-3.3 5.8-.2-1.3-.9-2.5-2-3.3C8.4 9.9 5 11.7 5 15a7 7 0 0 0 7 6Z" />
      <path d="M12 18a3 3 0 0 0 3-3c0-1.7-1.1-2.6-2-3.7-.2 1-.8 1.8-1.7 2.4-.2-.7-.6-1.2-1.2-1.6-.1 1.8-1.1 2.5-1.1 3.9a3 3 0 0 0 3 2Z" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="m9 6 6 6-6 6" />
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
    case "today":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M5 19V7" />
          <path d="M11 19V11" />
          <path d="M17 19V4" />
          <path d="M3 19h18" />
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
    case "practice-repair":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M5 19 19 5" />
          <path d="M14 5h5v5" />
          <path d="m5 10 4-4" />
          <path d="m14 15 5 5" />
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
