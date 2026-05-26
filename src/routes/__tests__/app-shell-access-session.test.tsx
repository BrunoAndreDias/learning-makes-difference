// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDeterministicRecallTestContexts,
  createRouteTestSessionContext,
  createRouteTestSessionStore,
  createSessionCookieJar,
  listNotesForUser,
  openAccountMenu,
  renderRoute,
  TEST_PILOT_REGISTRATION_CODE,
} from "./app-shell-test-support";

type LearningLoopTestContexts = ReturnType<
  typeof createDeterministicRecallTestContexts
>;

function setBrowserLanguages(languages: readonly string[]) {
  Object.defineProperty(window.navigator, "languages", {
    configurable: true,
    value: languages,
  });
}

function createPersistentStudyData(
  {
    focusContext,
    labelsContext,
    notesContext,
    recallContext,
  }: LearningLoopTestContexts,
  userId: string,
) {
  const label = labelsContext.createLabel({
    name: "Organic Chemistry",
    userId,
  });
  const note = notesContext.createNote(userId, {
    acronyms: [{ description: "SN1 stays exactly as written" }],
    body: "Cyclohexane chair flips stay in English.",
    labelIds: [label.id],
    metaphors: [{ description: "A conformer is like a folding chair" }],
    title: "Chair conformations",
  });

  vi.setSystemTime(new Date("2026-05-06T09:00:00.000Z"));
  const recallSession = recallContext.startFlashCardSession({
    noteIds: [note.id],
    userId,
  });
  recallContext.revealFlashCardAnswer({
    sessionId: recallSession.id,
    userId,
  });
  recallContext.rateFlashCardAnswer({
    rating: "good",
    sessionId: recallSession.id,
    userId,
  });

  vi.setSystemTime(new Date("2026-05-06T10:00:00.000Z"));
  focusContext.startFocusSession({
    focusIntervalMinutes: 25,
    userId,
  });
  focusContext.captureNoteStudyActivity({
    labels: labelsContext.getLabelsForUser(userId),
    note,
    userId,
  });
  vi.setSystemTime(new Date("2026-05-06T10:25:00.000Z"));
  focusContext.endFocusSession({ userId });
}

function readPersistentStudyData(
  {
    focusContext,
    labelsContext,
    notesContext,
    recallContext,
  }: LearningLoopTestContexts,
  userId: string,
) {
  return {
    focusRecords: focusContext.getFocusRecords({ userId }),
    labels: labelsContext.getLabelsForUser(userId),
    notes: listNotesForUser(notesContext.getSnapshot(), userId),
    sessionResults: recallContext.listSessionResults({ userId }),
  };
}

afterEach(() => {
  setBrowserLanguages(["en"]);
});

describe("authenticated app shell", () => {
  it("shows the Settings page readiness state while protected workspace data is preparing", async () => {
    const emptyStudyNotes = [] as const;
    let resolveRefresh: ((value: readonly []) => void) | undefined;
    const refresh = vi.fn(
      () =>
        new Promise<readonly []>((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    renderRoute("/settings", {
      persistentStudyNotesContext: {
        createStudyNote: vi.fn(),
        createStudyNoteFromSource: vi.fn(),
        deleteStudyNote: vi.fn(),
        getSnapshot: () => emptyStudyNotes,
        removeLabelAssignments: vi.fn(),
        refresh,
        subscribe: () => () => undefined,
        updateStudyNote: vi.fn(),
      },
      session: {
        user: {
          displayName: "Casey Settings Ready",
          email: "casey.settings.ready@example.com",
          id: "user-settings-readiness",
          userLanguage: "en",
          userTimeZone: "America/New_York",
        },
      },
    });

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledWith("user-settings-readiness");
    });
    expect(
      screen.getByRole("region", { name: "Preparing Settings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Preparing Settings" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("form", { name: "Account preferences form" }),
    ).toBeNull();
    expect(
      screen.getByRole("complementary", { name: "Study Notes workspace" }),
    ).toBeInTheDocument();
    expect(
      document.querySelectorAll(".settings-main-grid .settings-panel"),
    ).toHaveLength(2);
    expect(
      document.querySelectorAll(".settings-readiness__field"),
    ).toHaveLength(5);
    expect(
      document.querySelectorAll(".settings-readiness__summary-row"),
    ).toHaveLength(6);

    await act(async () => {
      resolveRefresh?.(emptyStudyNotes);
    });

    expect(
      await screen.findByRole("form", { name: "Account preferences form" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Preparing Settings" }),
    ).toBeNull();
  });

  it("registers a new account into the intended protected route and logs out cleanly", async () => {
    const sessionContext = createRouteTestSessionContext();
    const { router } = renderRoute("/settings", { sessionContext });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("link", { name: "Sign up" })[0]);
    expect(
      await screen.findByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Casey Learner" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "casey@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Pilot registration code"), {
      target: { value: TEST_PILOT_REGISTRATION_CODE },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Sign up form" }));

    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Casey Learner")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/settings");

    openAccountMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("registers a new account into Today when no redirect is provided", async () => {
    const sessionContext = createRouteTestSessionContext();
    const { router } = renderRoute("/register", { sessionContext });

    expect(
      await screen.findByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Casey Default" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "casey.default@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Pilot registration code"), {
      target: { value: TEST_PILOT_REGISTRATION_CODE },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Sign up form" }));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Study Guidance",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/today");
  });

  it("logs a returning user into Today when no redirect is provided", async () => {
    const sessionContext = createRouteTestSessionContext();

    await sessionContext.register({
      displayName: "Jordan Default",
      email: "jordan.default@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
    });
    await sessionContext.logout();

    const { router } = renderRoute("/login", { sessionContext });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "jordan.default@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Sign in form" }));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Study Guidance",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/today");
  });

  it("captures the browser-detected User Time Zone during registration", async () => {
    setBrowserLanguages(["es-MX", "en"]);
    const actualDateTimeFormat = Intl.DateTimeFormat;
    const register = vi.fn(async () => ({
      user: {
        displayName: "Casey Learner",
        email: "casey@example.com",
        id: "user-casey",
        userLanguage: "es" as const,
        userTimeZone: "Europe/Lisbon",
      },
    }));

    const dateTimeFormatSpy = vi
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(((
        locales?: Intl.LocalesArgument,
        options?: Intl.DateTimeFormatOptions,
      ) => {
        if (locales === undefined && options === undefined) {
          return {
            resolvedOptions: () => ({ timeZone: "Europe/Lisbon" }),
          } as Intl.DateTimeFormat;
        }

        return actualDateTimeFormat(locales, options);
      }) as typeof Intl.DateTimeFormat);

    try {
      renderRoute("/register", {
        sessionContext: {
          getSnapshot: () => ({ user: null }),
          refresh: () => Promise.resolve({ user: null }),
          subscribe: () => () => undefined,
          login: () => Promise.resolve({ user: null }),
          logout: () => Promise.resolve({ user: null }),
          register,
          updatePreferences: () => Promise.resolve({ user: null }),
        },
      });

      expect(
        await screen.findByRole("heading", { name: "Crea tu cuenta" }),
      ).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Nombre visible"), {
        target: { value: "Casey Learner" },
      });
      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "casey@example.com" },
      });
      fireEvent.change(screen.getByLabelText("Codigo de registro piloto"), {
        target: { value: TEST_PILOT_REGISTRATION_CODE },
      });
      fireEvent.change(screen.getByLabelText("Contrasena"), {
        target: { value: "correct horse battery staple" },
      });
      fireEvent.submit(
        screen.getByRole("form", { name: "Formulario de registro" }),
      );

      await waitFor(() => {
        expect(register).toHaveBeenCalledWith(
          expect.objectContaining({
            userLanguage: "es",
            userTimeZone: "Europe/Lisbon",
          }),
        );
      });
    } finally {
      dateTimeFormatSpy.mockRestore();
    }
  });

  it("changes User Language without mutating Persistent Study Data", async () => {
    const sessionContext = createRouteTestSessionContext();
    const contexts = createDeterministicRecallTestContexts();

    await sessionContext.register({
      displayName: "Casey Language",
      email: "casey.language@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
      userLanguage: "en",
    });
    const userId = sessionContext.getSnapshot().user?.id;

    if (userId === undefined) {
      throw new Error("Expected registered test user.");
    }

    vi.useFakeTimers();
    try {
      createPersistentStudyData(contexts, userId);
    } finally {
      vi.useRealTimers();
    }

    const persistentStudyDataBefore = readPersistentStudyData(contexts, userId);

    renderRoute("/settings", {
      ...contexts,
      sessionContext,
    });

    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Language"), {
      target: { value: "es" },
    });
    fireEvent.submit(
      screen.getByRole("form", { name: "Account preferences form" }),
    );

    await waitFor(() => {
      expect(sessionContext.getSnapshot().user?.userLanguage).toBe("es");
    });

    expect(readPersistentStudyData(contexts, userId)).toEqual(
      persistentStudyDataBefore,
    );
  });

  it("restores a protected route after refresh until sign-out clears the session", async () => {
    const store = createRouteTestSessionStore();
    const cookie = createSessionCookieJar();
    const sessionContext = createRouteTestSessionContext({
      cookie,
      store,
    });

    await sessionContext.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
      userTimeZone: "Europe/Lisbon",
    });

    const refreshedSessionContext = createRouteTestSessionContext({
      cookie,
      store,
    });
    const refreshedRoute = renderRoute("/settings", {
      sessionContext: refreshedSessionContext,
    });

    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Casey Learner")).toBeInTheDocument();
    expect(refreshedRoute.router.state.location.pathname).toBe("/settings");

    openAccountMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();

    cleanup();

    const loggedOutSessionContext = createRouteTestSessionContext({
      cookie,
      store,
    });
    const loggedOutRoute = renderRoute("/settings", {
      sessionContext: loggedOutSessionContext,
    });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(loggedOutRoute.router.state.location.pathname).toBe("/login");
    expect(loggedOutRoute.router.state.location.search.redirect).toBe(
      "/settings",
    );
  });

  it("uses the route-hydrated session while the client session store catches up", async () => {
    const anonymousSession = { user: null };
    const hydratedSession = {
      user: {
        displayName: "Hydrated Casey",
        email: "casey@example.com",
        id: "user-hydrated-casey",
        userLanguage: "en" as const,
      },
    };

    renderRoute("/settings", {
      sessionContext: {
        getSnapshot: () => anonymousSession,
        refresh: () => Promise.resolve(hydratedSession),
        subscribe: () => () => undefined,
        login: () => Promise.resolve(hydratedSession),
        logout: () => Promise.resolve({ user: null }),
        register: () => Promise.resolve(hydratedSession),
        updatePreferences: () => Promise.resolve(hydratedSession),
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hydrated Casey")).toBeInTheDocument();
    expect(screen.queryByText("Unknown user")).not.toBeInTheDocument();
  });

  it("loads Study Notes with the route-hydrated user instead of clearing them as anonymous", async () => {
    const anonymousSession = { user: null };
    const hydratedSession = {
      user: {
        displayName: "Hydrated Casey",
        email: "casey@example.com",
        id: "user-hydrated-casey",
        userLanguage: "en" as const,
      },
    };
    const emptyStudyNotes = [] as const;
    const refresh = vi.fn(async () => []);

    renderRoute("/study-notes", {
      persistentStudyNotesContext: {
        createStudyNote: vi.fn(),
        createStudyNoteFromSource: vi.fn(),
        deleteStudyNote: vi.fn(),
        getSnapshot: () => emptyStudyNotes,
        removeLabelAssignments: vi.fn(),
        refresh,
        subscribe: () => () => undefined,
        updateStudyNote: vi.fn(),
      },
      sessionContext: {
        getSnapshot: () => anonymousSession,
        refresh: () => Promise.resolve(hydratedSession),
        subscribe: () => () => undefined,
        login: () => Promise.resolve(hydratedSession),
        logout: () => Promise.resolve({ user: null }),
        register: () => Promise.resolve(hydratedSession),
        updatePreferences: () => Promise.resolve(hydratedSession),
      },
    });

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledWith("user-hydrated-casey");
    });
    expect(refresh).not.toHaveBeenCalledWith(null);
  });

  it("logs a returning user into the requested protected route", async () => {
    setBrowserLanguages(["es-MX", "en"]);
    const sessionContext = createRouteTestSessionContext();

    await sessionContext.register({
      displayName: "Jordan Review",
      email: "jordan@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
    });
    await sessionContext.logout();

    const { router } = renderRoute("/login?redirect=%2Frecall", {
      sessionContext,
    });

    expect(
      await screen.findByRole("heading", { name: "Te damos la bienvenida" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "jordan@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Contrasena"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.submit(
      screen.getByRole("form", { name: "Formulario de inicio de sesion" }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/recall");
    });
    expect(screen.getByText("Skip to main content")).toBeInTheDocument();
    expect(screen.getByText("Jordan Review")).toBeInTheDocument();
  });

  it("shows serialized authentication errors from the login service", async () => {
    renderRoute("/login", {
      sessionContext: {
        getSnapshot: () => ({ user: null }),
        refresh: () => Promise.resolve({ user: null }),
        subscribe: () => () => undefined,
        login: () =>
          Promise.reject({
            code: "invalid_credentials",
            message: "Email or password is incorrect.",
          }),
        logout: () => Promise.resolve({ user: null }),
        register: () => Promise.resolve({ user: null }),
        updatePreferences: () => Promise.resolve({ user: null }),
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "casey@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong password" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Sign in form" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email or password is incorrect.",
    );
    expect(
      screen.queryByText("Authentication failed. Try again."),
    ).not.toBeInTheDocument();
  });

  it("updates account preferences from settings and restores them for the same account", async () => {
    const sessionContext = createRouteTestSessionContext();

    await sessionContext.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
    });

    renderRoute("/settings", { sessionContext });

    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Casey Rivers" },
    });
    fireEvent.change(screen.getByLabelText("Language"), {
      target: { value: "pt-PT" },
    });
    fireEvent.change(screen.getByLabelText("Study Objective"), {
      target: { value: "specific_exam" },
    });
    fireEvent.change(screen.getByLabelText("Study Intensity"), {
      target: { value: "regular" },
    });
    fireEvent.change(screen.getByLabelText("User Time Zone"), {
      target: { value: "America/New_York" },
    });
    fireEvent.click(screen.getByLabelText("Study Note prompt templates"));
    fireEvent.submit(
      screen.getByRole("form", { name: "Account preferences form" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Preferencias guardadas.",
    );
    expect(screen.getAllByText("Casey Rivers")).not.toHaveLength(0);
    expect(screen.getByLabelText("Idioma")).toHaveValue("pt-PT");
    fireEvent.change(screen.getByLabelText("Idioma"), {
      target: { value: "en" },
    });
    fireEvent.submit(
      screen.getByRole("form", {
        name: "Formulario de preferencias da conta",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Preferences saved.",
    );
    expect(screen.getByLabelText("Language")).toHaveValue("en");
    expect(screen.getByLabelText("Study Objective")).toHaveValue(
      "specific_exam",
    );
    expect(screen.getByLabelText("Study Intensity")).toHaveValue("regular");
    expect(screen.getByLabelText("User Time Zone")).toHaveValue(
      "America/New_York",
    );
    expect(
      screen.getByLabelText("Study Note prompt templates"),
    ).not.toBeChecked();
    expect(
      within(screen.getByLabelText("Current account settings")).getByText(
        "Specific exam",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Current account settings")).getByText(
        "Regular",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Current account settings")).getByText(
        "America/New_York",
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Study Objective"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Study Intensity"), {
      target: { value: "" },
    });
    fireEvent.submit(
      screen.getByRole("form", { name: "Account preferences form" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Preferences saved.",
    );
    expect(screen.getByLabelText("Study Objective")).toHaveValue("");
    expect(screen.getByLabelText("Study Intensity")).toHaveValue("");
    expect(
      within(screen.getByLabelText("Current account settings")).getAllByText(
        "Not set",
      ),
    ).toHaveLength(2);

    fireEvent.change(screen.getByLabelText("Study Objective"), {
      target: { value: "professional_learning" },
    });
    fireEvent.change(screen.getByLabelText("Study Intensity"), {
      target: { value: "intensive" },
    });
    fireEvent.submit(
      screen.getByRole("form", { name: "Account preferences form" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Preferences saved.",
    );
    expect(screen.getByLabelText("Study Objective")).toHaveValue(
      "professional_learning",
    );
    expect(screen.getByLabelText("Study Intensity")).toHaveValue("intensive");

    openAccountMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();

    cleanup();

    const { router } = renderRoute("/login?redirect=%2Fsettings", {
      sessionContext,
    });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "casey@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Sign in form" }));

    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/settings");
    expect(screen.getByLabelText("Display name")).toHaveValue("Casey Rivers");
    expect(screen.getByLabelText("Language")).toHaveValue("en");
    expect(screen.getByLabelText("Study Objective")).toHaveValue(
      "professional_learning",
    );
    expect(screen.getByLabelText("Study Intensity")).toHaveValue("intensive");
    expect(screen.getByLabelText("User Time Zone")).toHaveValue(
      "America/New_York",
    );
    expect(
      screen.getByLabelText("Study Note prompt templates"),
    ).not.toBeChecked();
  });

  it("renders one translated Language selector and updates app chrome after save", async () => {
    const sessionContext = createRouteTestSessionContext();

    await sessionContext.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
      userLanguage: "en",
    });

    renderRoute("/settings", { sessionContext });

    expect(
      await screen.findByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();

    const languageSelector = screen.getByLabelText("Language");
    expect(languageSelector).toHaveValue("en");
    expect(
      within(languageSelector).getByRole("option", { name: "English" }),
    ).toBeInTheDocument();
    expect(
      within(languageSelector).getByRole("option", {
        name: "Portuguese (Portugal)",
      }),
    ).toBeInTheDocument();
    expect(
      within(languageSelector).getByRole("option", { name: "Spanish" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Interface language"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Study language")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("User Language")).not.toBeInTheDocument();

    fireEvent.change(languageSelector, {
      target: { value: "es" },
    });
    fireEvent.submit(
      screen.getByRole("form", { name: "Account preferences form" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Preferencias guardadas.",
    );
    expect(
      await screen.findByRole("heading", { name: "Configuracion" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Notas" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Etiquetas" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Idioma")).toHaveValue("es");
  });
});
