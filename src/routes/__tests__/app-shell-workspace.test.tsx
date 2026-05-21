// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createAppStudyNotesContext } from "../../modules/study-notes";
import {
  createAppFocusContext,
  openAccountMenu,
  renderRoute,
} from "./app-shell-test-support";

const sidebarFocusRowActiveSessionScenarios = [
  {
    currentTime: "2026-05-19T10:00:00.000Z",
    headerActionName: "End focus",
    state: "Focus",
  },
  {
    currentTime: "2026-05-19T10:25:12.000Z",
    headerActionName: "Keep focusing",
    state: "Transition",
  },
  {
    currentTime: "2026-05-19T10:25:31.000Z",
    headerActionName: "Skip break",
    state: "Break",
  },
  {
    currentTime: "2026-05-19T10:30:30.000Z",
    headerActionName: "Start next focus",
    state: "AwaitingNextFocus",
  },
] as const;

const appShellDirectoryPath = join(
  process.cwd(),
  "src/modules/workspace-shell/app-shell",
);
const focusNavRowPrototypeNotesPath = join(
  appShellDirectoryPath,
  "focus-nav-row-prototype-notes.md",
);
const protectedLayoutRoutePath = join(
  appShellDirectoryPath,
  "protected-layout-route.tsx",
);
const retiredFocusNavRowPrototypeMarkers = [
  "?variant=",
  "variant=A",
  "variant=B",
  "variant=C",
] as const;

type SidebarFocusRowActiveSessionScenario =
  (typeof sidebarFocusRowActiveSessionScenarios)[number];

function setBrowserLanguages(languages: readonly string[]) {
  Object.defineProperty(window.navigator, "languages", {
    configurable: true,
    value: languages,
  });
}

function getStudyNotesWorkspaceSidebar() {
  return screen.getByRole("complementary", {
    name: "Study Notes workspace",
  });
}

function getAppSections(sidebar = getStudyNotesWorkspaceSidebar()) {
  return within(sidebar).getByRole("navigation", {
    name: "App sections",
  });
}

function getWorkspaceHeader() {
  const workspaceHeader = document.querySelector(
    ".app-frame__workspace-header",
  );
  expect(workspaceHeader).toBeInstanceOf(HTMLElement);

  return workspaceHeader as HTMLElement;
}

function getHeaderFocusDock(name = "Focus now") {
  return within(getWorkspaceHeader()).getByRole("region", { name });
}
const defaultViewportWidth = window.innerWidth;
const defaultMatchMedia = window.matchMedia;
const rootRemPixels = 16;

function queryMatchesViewportWidth(query: string, width: number) {
  const maxWidthRemMatch = query.match(/^\(max-width:\s*([0-9.]+)rem\)$/);
  if (maxWidthRemMatch !== null) {
    return width <= Number(maxWidthRemMatch[1]) * rootRemPixels;
  }

  const maxWidthPxMatch = query.match(/^\(max-width:\s*([0-9.]+)px\)$/);
  if (maxWidthPxMatch !== null) {
    return width <= Number(maxWidthPxMatch[1]);
  }

  return false;
}

function createMediaQueryList(query: string, width: number): MediaQueryList {
  return {
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: queryMatchesViewportWidth(query, width),
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  };
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
    writable: true,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => createMediaQueryList(query, width),
    writable: true,
  });
  fireEvent(window, new Event("resize"));
}

function restoreViewport() {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: defaultViewportWidth,
    writable: true,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: defaultMatchMedia,
    writable: true,
  });
  fireEvent(window, new Event("resize"));
}

function createFocusContextForSidebarState(
  scenario: SidebarFocusRowActiveSessionScenario,
  userId: string,
) {
  let currentTime = "2026-05-19T10:00:00.000Z";

  const focusContext = createAppFocusContext({
    keyPrefix: `test-focus-nav-state-${scenario.state.toLowerCase()}-${Math.random().toString(36).slice(2)}`,
    now: () => new Date(currentTime),
    storage: window.localStorage,
  });

  focusContext.startFocusSession({
    breakIntervalMinutes: 5,
    focusIntervalMinutes: 25,
    plannedFocusIntervalCount: null,
    userId,
  });
  currentTime = scenario.currentTime;

  return focusContext;
}

afterEach(restoreViewport);
describe("authenticated app shell", () => {
  it("uses the stored User Language for authenticated shell chrome instead of browser detection", async () => {
    setBrowserLanguages(["pt-PT", "en"]);

    renderRoute("/settings", {
      session: {
        user: {
          displayName: "Casey Learner",
          email: "casey@example.com",
          id: "user-casey",
          userLanguage: "es",
        },
      },
    });

    const sidebar = await screen.findByRole("complementary", {
      name: "Espacio de trabajo de notas de estudio",
    });
    const appSections = within(sidebar).getByRole("navigation", {
      name: "Secciones de la aplicacion",
    });

    expect(
      within(appSections).getByRole("link", { name: "Notas" }),
    ).toBeInTheDocument();
    expect(
      within(appSections).getByRole("link", { name: "Repaso" }),
    ).toBeInTheDocument();
    expect(
      within(appSections).queryByRole("link", { name: "Etiquetas" }),
    ).not.toBeInTheDocument();
    expect(
      within(appSections).getByRole("link", { name: "Concentracion" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Configuracion" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abrir menu de navegacion" }),
    ).toBeInTheDocument();
    const focusDock = getHeaderFocusDock("Concentracion ahora");
    expect(
      within(focusDock).getByRole("button", {
        name: "Iniciar concentracion",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Casey Learner casey@example.com menu de cuenta",
      }),
    );

    const accountMenu = screen.getByRole("menu", {
      name: "Opciones de cuenta",
    });

    expect(
      within(accountMenu).getByRole("menuitem", { name: "Configuracion" }),
    ).toHaveAttribute("href", "/settings");
    expect(
      within(accountMenu).getByRole("menuitem", { name: "Cerrar sesion" }),
    ).toBeInTheDocument();
  });

  it("translates representative authenticated shell chrome in Portuguese", async () => {
    renderRoute("/focus", {
      session: {
        user: {
          displayName: "Casey Learner",
          email: "casey@example.com",
          id: "user-casey",
          userLanguage: "pt-PT",
        },
      },
    });

    const sidebar = await screen.findByRole("complementary", {
      name: "Area de trabalho de notas de estudo",
    });
    const appSections = within(sidebar).getByRole("navigation", {
      name: "Seccoes da aplicacao",
    });

    expect(
      within(appSections).getByRole("link", { name: "Notas" }),
    ).toBeInTheDocument();
    expect(
      within(appSections).getByRole("link", { name: "Recordar" }),
    ).toBeInTheDocument();
    expect(
      within(appSections).queryByRole("link", { name: "Etiquetas" }),
    ).not.toBeInTheDocument();
    expect(
      within(appSections).getByRole("link", { name: "Foco" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("heading", { level: 2, name: "Foco" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abrir menu de navegacao" }),
    ).toBeInTheDocument();
  });

  it("keeps the collapsed workspace header as an overlaid menu toggle", () => {
    const appCss = readFileSync(join(process.cwd(), "src/styles/app.css"), {
      encoding: "utf8",
    });
    const shellCss = readFileSync(
      join(process.cwd(), "src/modules/workspace-shell/workspace-shell.css"),
      {
        encoding: "utf8",
      },
    );

    expect(appCss).toContain("--workspace-collapsed-header-offset");
    expect(appCss).toContain(
      '.authenticated-shell[data-sidebar-state="collapsed"]\n  .app-frame__workspace-header',
    );
    expect(appCss).toMatch(
      /\.app-shell:has\(\.authenticated-shell\)\s+\.notes-workspace__page-header\s*{[^}]*padding-inline:\s*var\(--notes-workspace-inline-start\)\s+var\(--notes-workspace-inline-end\)/s,
    );
    expect(appCss).not.toMatch(
      /\.app-shell:has\(\.authenticated-shell\)\s+\.notes-workspace__page-header\s*{[^}]*padding-inline:\s*var\(--notes-workspace-inline-end\)\s+var\(--notes-workspace-inline-start\)/s,
    );
    expect(appCss).not.toContain(
      '.authenticated-shell[data-sidebar-state="collapsed"]\n  .app-frame[data-workspace="notes"]\n  .app-frame__workspace-header {\n  position: sticky',
    );
    expect(shellCss).not.toMatch(
      /\.authenticated-shell\[data-sidebar-state="collapsed"\]\s+\.app-frame\[data-workspace="notes"\]\s+\.app-frame__workspace-header\s*\{[^}]*position:\s*sticky;/s,
    );
  });

  it("keeps desktop workspace headers on the shared dense shell height", () => {
    const shellCss = readFileSync(
      join(process.cwd(), "src/modules/workspace-shell/workspace-shell.css"),
      {
        encoding: "utf8",
      },
    );
    const baseHeaderRule = shellCss.match(
      /\.app-frame__workspace-header \{[^}]*\}/,
    )?.[0];
    const appFrameRule = Array.from(
      shellCss.matchAll(/\.app-frame \{[^}]*\}/g),
      (match) => match[0],
    ).find((rule) => rule.includes("grid-template-rows"));

    expect(appFrameRule).toBeDefined();
    expect(appFrameRule).toContain(
      "grid-template-rows: var(--lmd-header-height) minmax(0, 1fr);",
    );
    expect(appFrameRule).toContain("align-content: start;");
    expect(baseHeaderRule).toContain("position: sticky;");
    expect(baseHeaderRule).toMatch(
      /(^|\n)\s*height: var\(--lmd-header-height\);/m,
    );
    expect(baseHeaderRule).toContain(
      "padding: var(--lmd-list-row-padding-y) var(--lmd-page-padding-x);",
    );
  });

  it("removes expanded-sidebar Focus Dock styling while keeping header pill styles", () => {
    const shellCss = readFileSync(
      join(process.cwd(), "src/modules/workspace-shell/workspace-shell.css"),
      {
        encoding: "utf8",
      },
    );

    expect(shellCss).not.toContain(".focus-dock--sidebar");
    expect(shellCss).toContain(".focus-dock--pill");
  });

  it("keeps Recall and Settings workspace headers in flow with shell actions", () => {
    const shellCss = readFileSync(
      join(process.cwd(), "src/modules/workspace-shell/workspace-shell.css"),
      {
        encoding: "utf8",
      },
    );

    expect(shellCss).toMatch(
      /\.app-frame\[data-workspace="recall"\] \.app-frame__workspace-header,\n\.app-frame\[data-workspace="recall-results"\] \.app-frame__workspace-header,\n\.app-frame\[data-workspace="settings"\] \.app-frame__workspace-header \{[^}]*position: sticky;[^}]*pointer-events: auto;/s,
    );
    expect(shellCss).not.toMatch(
      /\.app-frame\[data-workspace="recall"\] \.app-frame__workspace-header,\n\.app-frame\[data-workspace="recall-results"\] \.app-frame__workspace-header,\n\.app-frame\[data-workspace="settings"\] \.app-frame__workspace-header \{[^}]*position: absolute;/s,
    );
  });

  it("keeps the shared workspace header visible on desktop Recall surfaces", () => {
    const shellCss = readFileSync(
      join(process.cwd(), "src/modules/workspace-shell/workspace-shell.css"),
      {
        encoding: "utf8",
      },
    );

    expect(shellCss).not.toMatch(
      /\.authenticated-shell\[data-sidebar-state="expanded"\]\s+\.app-frame\[data-workspace="recall-results"\]\s+>\s+\.app-frame__workspace-header\s*\{[^}]*display:\s*none;/s,
    );
  });

  it("removes Focus nav row prototype artifacts from the app shell", () => {
    const protectedLayoutRouteSource = readFileSync(protectedLayoutRoutePath, {
      encoding: "utf8",
    });

    expect(existsSync(focusNavRowPrototypeNotesPath)).toBe(false);
    for (const marker of retiredFocusNavRowPrototypeMarkers) {
      expect(protectedLayoutRouteSource).not.toContain(marker);
    }
  });

  it("renders a Study Notes workspace shell with an account menu instead of product navigation", async () => {
    renderRoute("/settings");

    const sidebar = await screen.findByRole("complementary", {
      name: "Study Notes workspace",
    });
    const accountMenuButton = within(sidebar).getByRole("button", {
      name: /Placeholder user placeholder@example\.com account menu/,
    });

    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(accountMenuButton).toBeVisible();
    expect(within(sidebar).queryByText("Learning Makes Difference")).toBeNull();

    const appSections = getAppSections(sidebar);
    expect(
      within(appSections).getByRole("link", { name: "Study Notes" }),
    ).toBeInTheDocument();
    expect(
      within(appSections).queryByRole("link", { name: "Labels" }),
    ).not.toBeInTheDocument();
    expect(
      within(appSections).getByRole("link", { name: "Recall" }),
    ).toBeInTheDocument();
    expect(
      within(appSections).queryByRole("link", { name: "Settings" }),
    ).not.toBeInTheDocument();

    openAccountMenu();
    const accountMenu = screen.getByRole("menu", {
      name: "Account options",
    });
    const settingsLink = within(accountMenu).getByRole("menuitem", {
      name: "Settings",
    });
    const logoutButton = within(accountMenu).getByRole("menuitem", {
      name: "Log out",
    });

    expect(settingsLink).toHaveAttribute("href", "/settings");
    expect(settingsLink).toHaveAttribute("aria-current", "page");
    expect(logoutButton).toBeVisible();
    expect(sidebar).toHaveAttribute("data-sidebar-state", "expanded");
    expect(
      screen.getAllByRole("button", { name: "Collapse sidebar" }),
    ).toHaveLength(1);

    fireEvent.click(
      within(sidebar).getByRole("button", { name: "Collapse sidebar" }),
    );

    expect(sidebar).toHaveAttribute("data-sidebar-state", "collapsed");
    expect(sidebar).not.toBeVisible();
    expect(
      within(sidebar).queryByRole("button", { name: "Expand sidebar" }),
    ).not.toBeInTheDocument();

    const headerSidebarToggle = screen.getByRole("button", {
      name: "Expand sidebar",
    });
    const shellHeading = screen.getByRole("heading", {
      level: 2,
      name: "Settings",
    });

    expect(headerSidebarToggle).toHaveAttribute("aria-controls", sidebar.id);
    expect(headerSidebarToggle).toHaveTextContent("");
    expect(
      headerSidebarToggle.compareDocumentPosition(shellHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(headerSidebarToggle);

    expect(sidebar).toHaveAttribute("data-sidebar-state", "expanded");
    expect(sidebar).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Expand sidebar" }),
    ).not.toBeInTheDocument();
    expect(
      within(sidebar).getByRole("button", { name: "Collapse sidebar" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Open navigation menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("removes Study Notes header chrome when the sidebar is collapsed", async () => {
    renderRoute("/study-notes");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();

    const sidebar = getStudyNotesWorkspaceSidebar();

    fireEvent.click(
      within(sidebar).getByRole("button", { name: "Collapse sidebar" }),
    );

    const workspaceHeader = getWorkspaceHeader();

    expect(sidebar).toHaveAttribute("data-sidebar-state", "collapsed");
    expect(
      within(workspaceHeader).getByRole("button", { name: "Expand sidebar" }),
    ).toBeInTheDocument();
    expect(
      within(workspaceHeader).queryByRole("button", { name: "Start focus" }),
    ).not.toBeInTheDocument();
    expect(within(workspaceHeader).queryByText("Edit Note")).toBeNull();
  });

  it("uses the header Focus Dock to start a default FocusSession without navigating away", async () => {
    const userId = "user-focus-nav-idle";
    const focusContext = createAppFocusContext({
      keyPrefix: `test-focus-nav-idle-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const { router } = renderRoute("/settings", {
      focusContext,
      session: {
        user: {
          displayName: "Casey Focus Nav Idle",
          email: "casey.focus.nav.idle@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 2, name: "Settings" }),
    ).toBeInTheDocument();

    const appSections = getAppSections();
    const focusLink = within(appSections).getByRole("link", { name: "Focus" });
    const focusDock = getHeaderFocusDock();
    const startButton = within(focusDock).getByRole("button", {
      name: "Start focus",
    });

    expect(focusLink).toHaveAttribute("href", "/focus");
    expect(within(appSections).queryByRole("button")).toBeNull();

    fireEvent.click(startButton);

    expect(router.state.location.pathname).toBe("/settings");
    expect(
      within(focusDock).getByRole("button", { name: /End focus/ }),
    ).toBeInTheDocument();
    expect(focusContext.getActiveSession({ userId })).toMatchObject({
      breakIntervalMinutes: 5,
      currentInterval: "Focus",
      focusIntervalMinutes: 25,
      method: "Pomodoro",
      plannedFocusIntervalCount: null,
    });
  });

  it("uses the header Focus Dock to end an active FocusSession without navigating away", async () => {
    const userId = "user-focus-nav-active";
    const focusContext = createAppFocusContext({
      keyPrefix: `test-focus-nav-active-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    focusContext.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      plannedFocusIntervalCount: null,
      userId,
    });
    const { router } = renderRoute("/settings", {
      focusContext,
      session: {
        user: {
          displayName: "Casey Focus Nav Active",
          email: "casey.focus.nav.active@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 2, name: "Settings" }),
    ).toBeInTheDocument();

    const appSections = getAppSections();
    const focusDock = getHeaderFocusDock();

    expect(within(focusDock).getByText("25:00")).toBeInTheDocument();
    expect(within(appSections).queryByText("25:00")).toBeNull();
    expect(within(appSections).queryByRole("button")).toBeNull();

    fireEvent.click(
      within(focusDock).getByRole("button", { name: /End focus/ }),
    );

    expect(router.state.location.pathname).toBe("/settings");
    expect(
      within(focusDock).getByRole("button", { name: "Start focus" }),
    ).toBeInTheDocument();
    expect(focusContext.getActiveSession({ userId })).toBeNull();
  });

  it.each(
    sidebarFocusRowActiveSessionScenarios,
  )("keeps sidebar Focus navigation free of FocusSession controls in $state", async (scenario) => {
    const userId = `user-focus-nav-simple-${scenario.state.toLowerCase()}`;
    const focusContext = createFocusContextForSidebarState(scenario, userId);
    renderRoute("/settings", {
      focusContext,
      session: {
        user: {
          displayName: `Casey Focus ${scenario.state}`,
          email: `casey.focus.${scenario.state.toLowerCase()}@example.com`,
          id: userId,
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 2, name: "Settings" }),
    ).toBeInTheDocument();

    const appSections = getAppSections();
    const appSectionQueries = within(appSections);
    const focusDock = getHeaderFocusDock();

    expect(
      appSectionQueries.getByRole("link", { name: "Focus" }),
    ).toBeInTheDocument();
    expect(appSectionQueries.queryByRole("button")).toBeNull();
    expect(
      within(focusDock).getByRole("button", {
        name: new RegExp(`^${scenario.headerActionName}`),
      }),
    ).toBeInTheDocument();
  });

  it("keeps the active FocusSession timer in the workspace header and out of sidebar navigation", async () => {
    const userId = "user-focus-nav-active-timer";
    const focusContext = createAppFocusContext({
      keyPrefix: `test-focus-nav-active-timer-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    focusContext.startFocusSession({
      breakIntervalMinutes: 5,
      focusIntervalMinutes: 25,
      plannedFocusIntervalCount: null,
      userId,
    });
    renderRoute("/settings", {
      focusContext,
      session: {
        user: {
          displayName: "Casey Focus Nav Timer",
          email: "casey.focus.nav.timer@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 2, name: "Settings" }),
    ).toBeInTheDocument();

    const appSections = getAppSections();
    const focusDock = getHeaderFocusDock();

    expect(within(focusDock).getByText("25:00")).toBeInTheDocument();
    expect(within(appSections).queryByText("25:00")).toBeNull();
  });

  it("keeps the header Focus Dock available when the sidebar is unavailable", async () => {
    setViewportWidth(800);

    const userId = "user-focus-mobile-fallback";
    const focusContext = createAppFocusContext({
      keyPrefix: `test-focus-mobile-fallback-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const { router } = renderRoute("/study-notes", {
      focusContext,
      session: {
        user: {
          displayName: "Casey Focus Mobile",
          email: "casey.focus.mobile@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext: createAppStudyNotesContext({
        keyPrefix: `test-study-notes-mobile-fallback-${Math.random().toString(36).slice(2)}`,
        storage: window.localStorage,
      }),
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();

    const focusDock = screen.getByRole("region", { name: "Focus now" });
    expect(
      within(focusDock).getByRole("button", { name: "Start focus" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start focus session" }),
    ).toBeNull();

    fireEvent.click(
      within(focusDock).getByRole("button", { name: "Start focus" }),
    );

    expect(router.state.location.pathname).toBe("/study-notes");
    expect(
      within(focusDock).getByRole("button", { name: /End focus/ }),
    ).toBeInTheDocument();
    expect(focusContext.getActiveSession({ userId })).toMatchObject({
      breakIntervalMinutes: 5,
      currentInterval: "Focus",
      focusIntervalMinutes: 25,
      method: "Pomodoro",
      plannedFocusIntervalCount: null,
    });
  });

  it("renders global workspace navigation and updates the active link when navigating", async () => {
    const { router } = renderRoute("/study-notes");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();

    const appSections = getAppSections();
    const todayLink = within(appSections).getByRole("link", {
      name: "Today",
    });
    const notesLink = within(appSections).getByRole("link", {
      name: "Study Notes",
    });
    const recallLink = within(appSections).getByRole("link", {
      name: "Recall",
    });
    const practiceRepairLink = within(appSections).getByRole("link", {
      name: "Practice Repair",
    });
    const focusLink = within(appSections).getByRole("link", { name: "Focus" });

    expect(within(appSections).getAllByRole("link")).toEqual([
      todayLink,
      notesLink,
      recallLink,
      practiceRepairLink,
      focusLink,
    ]);
    expect(
      within(appSections).queryByRole("link", { name: "Recall history" }),
    ).not.toBeInTheDocument();
    expect(
      within(appSections).queryByRole("link", { name: "Insights" }),
    ).not.toBeInTheDocument();
    expect(todayLink).toHaveAttribute("href", "/today");
    expect(
      within(appSections).queryByRole("link", { name: "Recall results" }),
    ).not.toBeInTheDocument();
    expect(notesLink).toHaveAttribute("href", "/study-notes");
    expect(recallLink).toHaveAttribute("href", "/recall");
    expect(practiceRepairLink).toHaveAttribute("href", "/practice-repair");
    expect(notesLink).toHaveAttribute("aria-current", "page");

    fireEvent.click(recallLink);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Recall Today",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(recallLink).toHaveAttribute("aria-current", "page");
    expect(notesLink).not.toHaveAttribute("aria-current");
    const recallItem = recallLink.closest("li");

    expect(recallItem).toBeInstanceOf(HTMLLIElement);
    expect(
      within(recallItem as HTMLLIElement).getByRole("link", {
        name: "Recall Today",
      }),
    ).toHaveAttribute("href", "/recall");
    expect(
      within(recallItem as HTMLLIElement).getByRole("link", {
        name: "Recall Today",
      }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(recallItem as HTMLLIElement).getByRole("link", {
        name: "Scheduled",
      }),
    ).toHaveAttribute("href", "/recall/due-today");
    expect(
      within(recallItem as HTMLLIElement).getByRole("link", {
        name: "Results",
      }),
    ).toHaveAttribute("href", "/recall/results");
    expect(
      within(appSections).queryByRole("link", { name: "Recall setup" }),
    ).not.toBeInTheDocument();
    expect(
      within(appSections).queryByRole("link", { name: "Recall session" }),
    ).not.toBeInTheDocument();
  });

  it("keeps Recall subroutes nested under Recall and marks the active subsection", async () => {
    renderRoute("/recall/results");

    await screen.findByRole("complementary", {
      name: "Study Notes workspace",
    });

    const appSections = getAppSections();
    const recallLink = within(appSections).getByRole("link", {
      name: "Recall",
    });
    const recallItem = recallLink.closest("li");

    expect(recallItem).toBeInstanceOf(HTMLLIElement);
    expect(recallLink).toHaveAttribute("aria-current", "page");
    expect(
      within(recallItem as HTMLLIElement).getByRole("link", {
        name: "Recall Today",
      }),
    ).not.toHaveAttribute("aria-current");
    expect(
      within(recallItem as HTMLLIElement).getByRole("link", {
        name: "Scheduled",
      }),
    ).not.toHaveAttribute("aria-current");
    expect(
      within(recallItem as HTMLLIElement).getByRole("link", {
        name: "Results",
      }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("adds Focus to primary navigation and opens the Focus section", async () => {
    const { router } = renderRoute("/study-notes");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();

    const appSections = getAppSections();
    const focusLink = within(appSections).getByRole("link", { name: "Focus" });

    expect(focusLink).toHaveAttribute("href", "/focus");

    fireEvent.click(focusLink);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Focus" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/focus");
    expect(focusLink).toHaveAttribute("aria-current", "page");
  });

  it("supports skip navigation with a header navigation opener", async () => {
    renderRoute("/study-notes");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();

    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    const main = screen.getByRole("main");

    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(main).toHaveAttribute("id", "main-content");

    expect(
      screen.getByRole("button", { name: "Open navigation menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("uses the in-page Study Notes list with a header navigation opener", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      getOwnedLabelIdsForUser: () => [],
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });

    studyNotesContext.createStudyNote("user-jordan", {
      sourceBody: "Repeated review strengthens long-term retention.",
      sourceTitle: "Spaced repetition",
    });
    studyNotesContext.createStudyNote("user-jordan", {
      sourceBody: "Retrieval cues make later recall easier.",
      sourceTitle: "Retrieval practice",
    });

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-jordan",
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();

    const sidebar = getStudyNotesWorkspaceSidebar();
    const studyNotesCatalog = screen.getByRole("complementary", {
      name: "Study Notes catalog",
    });
    const studyNotesList = within(studyNotesCatalog).getByRole("navigation", {
      name: "Study Notes list",
    });

    expect(sidebar).toHaveAttribute("data-mobile-open", "false");
    expect(
      screen.getByRole("button", { name: "New Study Note" }),
    ).toBeInTheDocument();
    expect(
      within(sidebar).queryByRole("navigation", { name: "Study Notes list" }),
    ).not.toBeInTheDocument();
    expect(getAppSections(sidebar)).toBeInTheDocument();
    expect(
      within(sidebar).getByRole("button", { name: /account menu/i }),
    ).toBeInTheDocument();

    const retrievalPracticeButton = within(studyNotesList).getByRole("button", {
      name: "Retrieval practice",
    });

    retrievalPracticeButton.focus();
    expect(retrievalPracticeButton).toHaveFocus();

    fireEvent.click(retrievalPracticeButton);

    expect(sidebar).toHaveAttribute("data-mobile-open", "false");
    expect(screen.getByLabelText("Prompt")).toHaveValue("Retrieval practice");
    expect(
      screen.getByRole("button", { name: "Open navigation menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("opens and closes the mobile navigation menu from the header", async () => {
    renderRoute("/study-notes");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();

    const sidebar = screen.getByRole("complementary", {
      name: "Study Notes workspace",
    });
    const mobileToggle = screen.getByRole("button", {
      name: "Open navigation menu",
    });

    expect(mobileToggle).toHaveAttribute("aria-controls", sidebar.id);
    expect(mobileToggle).toHaveAttribute("aria-expanded", "false");
    expect(sidebar).toHaveAttribute("data-mobile-open", "false");

    fireEvent.click(mobileToggle);

    expect(mobileToggle).toHaveAttribute("aria-expanded", "true");
    expect(sidebar).toHaveAttribute("data-mobile-open", "true");

    fireEvent.click(
      within(sidebar).getByRole("button", { name: "Close navigation menu" }),
    );

    expect(sidebar).toHaveAttribute("data-mobile-open", "false");
    expect(mobileToggle).toHaveAttribute("aria-expanded", "false");
    expect(mobileToggle).toHaveFocus();
  });
});
