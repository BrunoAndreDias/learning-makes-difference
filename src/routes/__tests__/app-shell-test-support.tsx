// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, expect, vi } from "vitest";
import {
  type AppSessionContext,
  type AppSessionSnapshot,
  createAppSessionContext,
  createMemorySessionService,
  createMemorySessionStore,
  type MemorySessionCookie,
  type MemorySessionStore,
} from "../../modules/access/session/session";
import {
  type AppFocusContext,
  type AppPersistentFocusContext,
  createAppFocusContext,
} from "../../modules/focus";
import {
  type AppLabelsContext,
  createAppLabelsContext,
} from "../../modules/labels/label-management/labels";
import type { AppPersistentLabelsContext } from "../../modules/labels/persistent-labels";
import {
  type AppNotesContext,
  type AppPersistentNotesContext,
  createAppNotesContext,
  listNotesForUser,
} from "../../modules/notes";
import type { AppPersistentRecallContext } from "../../modules/recall";
import {
  type AppRecallContext,
  createAppRecallContext,
  type FlashCardRecallRating,
} from "../../modules/recall";
import {
  type AppPersistentStudyNotesContext,
  type AppStudyNotesContext,
  createAppStudyNotesContext,
} from "../../modules/study-notes";
import { routeTree } from "../../routeTree.gen";

export const TEST_PILOT_REGISTRATION_CODE = "test-pilot-code";

export function renderRoute(
  initialPath: string,
  options: {
    focusContext?: AppFocusContext;
    labelsContext?: AppLabelsContext;
    notesContext?: AppNotesContext;
    persistentFocusContext?: AppPersistentFocusContext;
    persistentLabelsContext?: AppPersistentLabelsContext;
    persistentNotesContext?: AppPersistentNotesContext;
    persistentRecallContext?: AppPersistentRecallContext;
    persistentStudyNotesContext?: AppPersistentStudyNotesContext;
    recallContext?: AppRecallContext;
    session?: AppSessionSnapshot;
    sessionContext?: AppSessionContext;
    studyNotesContext?: AppStudyNotesContext;
  } = {},
) {
  const staticSnapshot = options.session ?? {
    user: {
      displayName: "Placeholder user",
      email: "placeholder@example.com",
      id: "user-placeholder",
      userLanguage: "en",
    },
  };
  const sessionContext = options.sessionContext ?? {
    getSnapshot: () => staticSnapshot,
    refresh: () => Promise.resolve(staticSnapshot),
    subscribe: () => () => undefined,
    login: () =>
      Promise.reject(new Error("Static test session cannot log in.")),
    logout: () => Promise.resolve({ user: null }),
    register: () =>
      Promise.reject(new Error("Static test session cannot register.")),
    updatePreferences: () =>
      Promise.reject(
        new Error("Static test session cannot update preferences."),
      ),
  };
  const labelsContext =
    options.labelsContext ??
    createAppLabelsContext({
      keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
  const notesContext =
    options.notesContext ??
    createAppNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labelsContext.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
  const focusContext =
    options.focusContext ??
    options.persistentFocusContext?.readonlyContext ??
    createAppFocusContext({
      getLabelsForUser: (userId) => labelsContext.getLabelsForUser(userId),
      keyPrefix: `test-focus-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
  const recallContext =
    options.recallContext ??
    options.persistentRecallContext?.readonlyContext ??
    createAppRecallContext({
      getLabelsForUser: (userId) => labelsContext.getLabelsForUser(userId),
      keyPrefix: `test-recall-${Math.random().toString(36).slice(2)}`,
      notes: notesContext,
      onStudyActivity: focusContext.captureRecallSessionStudyActivity,
      storage: window.localStorage,
    });
  const studyNotesContext =
    options.studyNotesContext ??
    createAppStudyNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labelsContext.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [initialPath],
    }),
    context: {
      focus: focusContext,
      labels: labelsContext,
      notes: notesContext,
      persistentFocus: options.persistentFocusContext,
      persistentLabels: options.persistentLabelsContext,
      persistentNotes: options.persistentNotesContext,
      persistentRecall: options.persistentRecallContext,
      persistentStudyNotes: options.persistentStudyNotesContext,
      recall: recallContext,
      session: sessionContext,
      studyNotes: studyNotesContext,
    },
    defaultPreload: "intent",
    scrollRestoration: true,
  });

  return {
    router,
    ...render(<RouterProvider router={router} />),
  };
}

export function createRouteHydratedSessionContext(
  routedSessionSnapshot: AppSessionSnapshot,
): AppSessionContext {
  const anonymousSnapshot: AppSessionSnapshot = { user: null };

  return {
    getSnapshot: () => anonymousSnapshot,
    refresh: () => Promise.resolve(routedSessionSnapshot),
    subscribe: () => () => undefined,
    login: () =>
      Promise.reject(new Error("Test session context cannot log in.")),
    logout: () => Promise.resolve(anonymousSnapshot),
    register: () =>
      Promise.reject(new Error("Test session context cannot register.")),
    updatePreferences: () =>
      Promise.reject(
        new Error("Test session context cannot update preferences."),
      ),
  };
}

export function createSessionCookieJar(): MemorySessionCookie {
  let value: string | null = null;

  return {
    clear() {
      value = null;
    },
    get() {
      return value;
    },
    set(nextValue: string) {
      value = nextValue;
    },
  };
}

export function createRouteTestSessionContext(
  options: { cookie?: MemorySessionCookie; store?: MemorySessionStore } = {},
) {
  return createAppSessionContext({
    service: createMemorySessionService({
      cookie: options.cookie,
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
      store: options.store ?? createMemorySessionStore(),
    }),
  });
}

export function createRouteTestSessionStore() {
  return createMemorySessionStore();
}

export function createLearningLoopTestContexts(
  recallOptions: Partial<
    Pick<
      Parameters<typeof createAppRecallContext>[0],
      "crypto" | "shuffleNotes"
    >
  > = {},
) {
  const labelsContext = createAppLabelsContext({
    keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
    storage: window.localStorage,
  });
  const notesContext = createAppNotesContext({
    getOwnedLabelIdsForUser: (userId) =>
      labelsContext.getLabelsForUser(userId).map((label) => label.id),
    keyPrefix: `test-notes-${Math.random().toString(36).slice(2)}`,
    storage: window.localStorage,
  });
  const focusContext = createAppFocusContext({
    getLabelsForUser: (userId) => labelsContext.getLabelsForUser(userId),
    keyPrefix: `test-focus-${Math.random().toString(36).slice(2)}`,
    storage: window.localStorage,
  });
  const recallContext = createAppRecallContext({
    getLabelsForUser: (userId) => labelsContext.getLabelsForUser(userId),
    keyPrefix: `test-recall-${Math.random().toString(36).slice(2)}`,
    notes: notesContext,
    onStudyActivity: focusContext.captureRecallSessionStudyActivity,
    storage: window.localStorage,
    ...recallOptions,
  });

  return {
    focusContext,
    labelsContext,
    notesContext,
    recallContext,
  };
}

export type AppShellRouter = ReturnType<typeof renderRoute>["router"];
export type RenderRouteOptions = NonNullable<Parameters<typeof renderRoute>[1]>;

export function createDeterministicRecallTestContexts() {
  return createLearningLoopTestContexts({
    shuffleNotes: (sessionNotes) => [...sessionNotes],
  });
}

export function createRecallNote(
  notesContext: AppNotesContext,
  userId: string,
  input: {
    body: string;
    labelIds?: string[];
    title: string;
  },
) {
  return notesContext.createNote(userId, {
    acronyms: [],
    body: input.body,
    labelIds: input.labelIds ?? [],
    metaphors: [],
    title: input.title,
  });
}

export function createCompletedRecallSession(
  recallContext: AppRecallContext,
  input: {
    noteId: string;
    rating: FlashCardRecallRating;
    timestamp: string;
    userId: string;
  },
) {
  vi.setSystemTime(new Date(input.timestamp));
  const session = recallContext.startFlashCardSession({
    noteIds: [input.noteId],
    userId: input.userId,
  });

  recallContext.revealFlashCardAnswer({
    sessionId: session.id,
    userId: input.userId,
  });
  recallContext.rateFlashCardAnswer({
    rating: input.rating,
    sessionId: session.id,
    userId: input.userId,
  });
}

function completeRecallSessionAt({
  noteId,
  rating,
  recallContext,
  timestamp,
  userId,
}: {
  noteId: string;
  rating: FlashCardRecallRating;
  recallContext: AppRecallContext;
  timestamp: string;
  userId: string;
}) {
  createCompletedRecallSession(recallContext, {
    noteId,
    rating,
    timestamp,
    userId,
  });
}

function rateFlashCardAnswers({
  ratings,
  recallContext,
  sessionId,
  userId,
}: {
  ratings: readonly FlashCardRecallRating[];
  recallContext: AppRecallContext;
  sessionId: string;
  userId: string;
}) {
  for (const rating of ratings) {
    recallContext.revealFlashCardAnswer({
      sessionId,
      userId,
    });
    recallContext.rateFlashCardAnswer({
      rating,
      sessionId,
      userId,
    });
  }
}

async function renderRecallSelection(contexts: RenderRouteOptions) {
  const routeRender = renderRoute("/recall/select", contexts);

  expect(
    await screen.findByRole("heading", { level: 3, name: "Recall setup" }),
  ).toBeInTheDocument();

  return routeRender;
}

function selectRecallableNote(title: string, _body: string) {
  fireEvent.click(
    within(screen.getByLabelText("Recallable notes")).getByRole("button", {
      name: `Select ${title}`,
    }),
  );
}

async function startSelectedRecallSession() {
  fireEvent.click(screen.getByRole("button", { name: "Start recall" }));

  expect(
    await screen.findByRole("heading", { name: "Recall session" }),
  ).toBeInTheDocument();
}

async function expectReturnedToRecall(router: AppShellRouter) {
  expect(
    await screen.findByRole("heading", { level: 3, name: "Practice" }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/recall");
}

async function openRecallResultsSection() {
  fireEvent.click(screen.getByRole("link", { name: "Results" }));

  expect(
    await screen.findByRole("heading", { level: 3, name: "Results" }),
  ).toBeInTheDocument();
}

export function openAccountMenu() {
  fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
}

function getSelectedSessionResultRegion() {
  return screen.getByRole("region", {
    name: "Selected review",
  });
}

let documentVisibilityState: DocumentVisibilityState = "visible";

beforeAll(() => {
  window.scrollTo = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => documentVisibilityState,
  });
});

afterEach(() => {
  cleanup();
  documentVisibilityState = "visible";
  vi.useRealTimers();
});

export type { AppSessionSnapshot };
export {
  createAppFocusContext,
  createAppLabelsContext,
  createAppNotesContext,
  createAppRecallContext,
  listNotesForUser,
};
