import {
  AppAuthError,
  type AppSessionSnapshot,
  buildAnonymousSnapshot,
  defaultShowStudyNoteTemplatesPreference,
  defaultUserTimeZone,
  getAppAuthError,
  type LoginInput,
  normalizeUserLanguage,
  type RegisterInput,
  type StudyIntensityPreference,
  type StudyObjectivePreference,
  type UpdatePreferencesInput,
  type UserLanguage,
  type UserTimeZonePreference,
  validateShowStudyNoteTemplatesPreference,
  validateStudyIntensityPreference,
  validateStudyObjectivePreference,
  validateUserLanguagePreference,
  validateUserTimeZonePreference,
} from "./session-contract";
import { createServerSessionService } from "./session-server-fns";

export {
  AppAuthError,
  type AppSessionSnapshot,
  type AppSessionUser,
  defaultShowStudyNoteTemplatesPreference,
  defaultUserTimeZone,
  fallbackUserLanguage,
  getAppAuthError,
  type StudyIntensityPreference,
  type StudyIntensityPreferenceOption,
  type StudyObjectivePreference,
  type StudyObjectivePreferenceOption,
  studyIntensityPreferences,
  studyObjectivePreferences,
  type UserLanguage,
  type UserTimeZonePreference,
  userLanguagePreferences,
} from "./session-contract";

type SessionListener = () => void;

type MemoryStoredUserRecord = {
  id: string;
  displayName: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  showStudyNoteTemplates?: boolean;
  userLanguage?: UserLanguage;
  interfaceLanguage?: string;
  studyObjective: StudyObjectivePreference;
  studyIntensity: StudyIntensityPreference;
  userTimeZone?: UserTimeZonePreference;
};

type MemoryStoredSessionRecord = {
  id: string;
  userId: string;
};

export type AppSessionService = {
  getSessionSnapshot: () => Promise<AppSessionSnapshot>;
  register: (input: RegisterInput) => Promise<AppSessionSnapshot>;
  login: (input: LoginInput) => Promise<AppSessionSnapshot>;
  logout: () => Promise<AppSessionSnapshot>;
  updatePreferences: (
    input: UpdatePreferencesInput,
  ) => Promise<AppSessionSnapshot>;
};

export type AppSessionContext = {
  getSnapshot: () => AppSessionSnapshot;
  refresh: () => Promise<AppSessionSnapshot>;
  subscribe: (listener: SessionListener) => () => void;
  register: (input: RegisterInput) => Promise<AppSessionSnapshot>;
  login: (input: LoginInput) => Promise<AppSessionSnapshot>;
  logout: () => Promise<AppSessionSnapshot>;
  updatePreferences: (
    input: UpdatePreferencesInput,
  ) => Promise<AppSessionSnapshot>;
};

type CreateAppSessionContextOptions = {
  initialSnapshot?: AppSessionSnapshot;
  service?: AppSessionService;
};

export type MemorySessionStore = {
  sessions: MemoryStoredSessionRecord[];
  users: MemoryStoredUserRecord[];
};

export type MemorySessionCookie = {
  clear: () => void;
  get: () => string | null;
  set: (value: string) => void;
};

type CreateMemorySessionServiceOptions = {
  cookie?: MemorySessionCookie;
  crypto?: Pick<Crypto, "randomUUID" | "subtle">;
  pilotRegistrationCode?: string;
  store?: MemorySessionStore;
};

const DEFAULT_PILOT_REGISTRATION_CODE = "test-pilot-code";
const NOT_AUTHENTICATED_MESSAGE = "Sign in to update account preferences.";

function getDefaultCrypto() {
  return globalThis.crypto;
}

function createMemoryCookie(): MemorySessionCookie {
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

export function createMemorySessionStore(): MemorySessionStore {
  return {
    sessions: [],
    users: [],
  };
}

function createNotAuthenticatedError(): AppAuthError {
  return new AppAuthError("not_authenticated", NOT_AUTHENTICATED_MESSAGE);
}

function rethrowAppAuthError(error: unknown): never {
  const appAuthError = getAppAuthError(error);

  throw appAuthError ?? error;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildSnapshot(
  user: MemoryStoredUserRecord | null,
): AppSessionSnapshot {
  if (user === null) {
    return buildAnonymousSnapshot();
  }

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      showStudyNoteTemplates:
        user.showStudyNoteTemplates ?? defaultShowStudyNoteTemplatesPreference,
      userLanguage: normalizeUserLanguage(
        user.userLanguage ?? user.interfaceLanguage,
      ),
      studyObjective: user.studyObjective,
      studyIntensity: user.studyIntensity,
      userTimeZone: user.userTimeZone ?? defaultUserTimeZone,
    },
  };
}

async function hashPassword(
  cryptoProvider: Pick<Crypto, "subtle">,
  password: string,
  salt: string,
): Promise<string> {
  const encodedValue = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await cryptoProvider.subtle.digest("SHA-256", encodedValue);

  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

function validateDisplayName(displayName: string): string {
  const trimmedValue = displayName.trim();

  if (trimmedValue.length < 2) {
    throw new AppAuthError(
      "invalid_input",
      "Display name must be at least 2 characters long.",
    );
  }

  return trimmedValue;
}

function validatePassword(password: string): string {
  const trimmedValue = password.trim();

  if (trimmedValue.length < 8) {
    throw new AppAuthError(
      "invalid_input",
      "Password must be at least 8 characters long.",
    );
  }

  return password;
}

function validateEmail(email: string): string {
  const normalizedEmail = normalizeEmail(email);

  if (
    normalizedEmail.length < 3 ||
    !normalizedEmail.includes("@") ||
    !normalizedEmail.includes(".")
  ) {
    throw new AppAuthError("invalid_input", "Enter a valid email address.");
  }

  return normalizedEmail;
}

function validatePilotRegistrationCode(
  providedCode: string,
  expectedCode: string,
): string {
  const normalizedCode = providedCode.trim();

  if (expectedCode.trim().length === 0 || normalizedCode !== expectedCode) {
    throw new AppAuthError(
      "invalid_registration_code",
      "Pilot registration code is invalid.",
    );
  }

  return normalizedCode;
}

function readSessionUser(
  cookie: MemorySessionCookie,
  store: MemorySessionStore,
): MemoryStoredUserRecord | null {
  const sessionId = cookie.get();

  if (sessionId === null) {
    return null;
  }

  const activeSession =
    store.sessions.find((session) => session.id === sessionId) ?? null;

  if (activeSession === null) {
    cookie.clear();
    return null;
  }

  return store.users.find((user) => user.id === activeSession.userId) ?? null;
}

function issueSessionForUser(
  cookie: MemorySessionCookie,
  cryptoProvider: Pick<Crypto, "randomUUID">,
  store: MemorySessionStore,
  user: MemoryStoredUserRecord,
) {
  const sessionId = cryptoProvider.randomUUID();

  store.sessions.push({
    id: sessionId,
    userId: user.id,
  });
  cookie.set(sessionId);
}

export function hasActiveSession(session: AppSessionSnapshot): boolean {
  return session.user !== null;
}

export function resolveProtectedSessionSnapshot({
  routedSessionSnapshot,
  sessionSnapshot,
}: Readonly<{
  routedSessionSnapshot?: AppSessionSnapshot;
  sessionSnapshot: AppSessionSnapshot;
}>): AppSessionSnapshot {
  if (
    hasActiveSession(sessionSnapshot) ||
    routedSessionSnapshot === undefined
  ) {
    return sessionSnapshot;
  }

  return routedSessionSnapshot;
}

export function createGuestSessionContext(): AppSessionContext {
  const snapshot = buildAnonymousSnapshot();

  return {
    getSnapshot: () => snapshot,
    refresh: async () => snapshot,
    subscribe: () => () => undefined,
    register: async () => {
      throw createNotAuthenticatedError();
    },
    login: async () => {
      throw createNotAuthenticatedError();
    },
    logout: async () => snapshot,
    updatePreferences: async () => {
      throw createNotAuthenticatedError();
    },
  };
}

export function createMemorySessionService(
  options: CreateMemorySessionServiceOptions = {},
): AppSessionService {
  const cookie = options.cookie ?? createMemoryCookie();
  const cryptoProvider = options.crypto ?? getDefaultCrypto();
  const pilotRegistrationCode =
    options.pilotRegistrationCode ?? DEFAULT_PILOT_REGISTRATION_CODE;
  const store = options.store ?? createMemorySessionStore();

  return {
    getSessionSnapshot: async () =>
      buildSnapshot(readSessionUser(cookie, store)),
    login: async ({ email, password }) => {
      const safeEmail = validateEmail(email);
      const safePassword = validatePassword(password);
      const user =
        store.users.find(
          (candidate) => normalizeEmail(candidate.email) === safeEmail,
        ) ?? null;

      if (user === null) {
        throw new AppAuthError(
          "invalid_credentials",
          "Email or password is incorrect.",
        );
      }

      const attemptedHash = await hashPassword(
        cryptoProvider,
        safePassword,
        user.passwordSalt,
      );

      if (attemptedHash !== user.passwordHash) {
        throw new AppAuthError(
          "invalid_credentials",
          "Email or password is incorrect.",
        );
      }

      issueSessionForUser(cookie, cryptoProvider, store, user);

      return buildSnapshot(user);
    },
    logout: async () => {
      const sessionId = cookie.get();

      if (sessionId !== null) {
        store.sessions = store.sessions.filter(
          (session) => session.id !== sessionId,
        );
      }

      cookie.clear();

      return buildAnonymousSnapshot();
    },
    register: async ({
      displayName,
      email,
      password,
      pilotRegistrationCode: providedRegistrationCode,
      userLanguage,
      userTimeZone,
    }) => {
      const safeDisplayName = validateDisplayName(displayName);
      const safeEmail = validateEmail(email);
      const safePassword = validatePassword(password);
      validatePilotRegistrationCode(
        providedRegistrationCode,
        pilotRegistrationCode,
      );
      const safeUserTimeZone = validateUserTimeZonePreference(userTimeZone);
      const safeUserLanguage = normalizeUserLanguage(userLanguage);

      if (
        store.users.some((user) => normalizeEmail(user.email) === safeEmail)
      ) {
        throw new AppAuthError(
          "email_taken",
          "An account with that email already exists.",
        );
      }

      const passwordSalt = cryptoProvider.randomUUID();
      const nextUser: MemoryStoredUserRecord = {
        id: cryptoProvider.randomUUID(),
        displayName: safeDisplayName,
        email: safeEmail,
        passwordSalt,
        passwordHash: await hashPassword(
          cryptoProvider,
          safePassword,
          passwordSalt,
        ),
        showStudyNoteTemplates: defaultShowStudyNoteTemplatesPreference,
        userLanguage: safeUserLanguage,
        studyObjective: null,
        studyIntensity: null,
        userTimeZone: safeUserTimeZone,
      };

      store.users.push(nextUser);
      issueSessionForUser(cookie, cryptoProvider, store, nextUser);

      return buildSnapshot(nextUser);
    },
    updatePreferences: async ({
      displayName,
      showStudyNoteTemplates,
      userLanguage,
      studyObjective,
      studyIntensity,
      userTimeZone,
    }) => {
      const activeUser = readSessionUser(cookie, store);

      if (activeUser === null) {
        throw createNotAuthenticatedError();
      }

      const safeDisplayName = validateDisplayName(displayName);
      const safeShowStudyNoteTemplates =
        validateShowStudyNoteTemplatesPreference(showStudyNoteTemplates);
      const safeUserLanguage = validateUserLanguagePreference(userLanguage);
      const safeStudyObjective =
        validateStudyObjectivePreference(studyObjective);
      const safeStudyIntensity =
        validateStudyIntensityPreference(studyIntensity);
      const safeUserTimeZone = validateUserTimeZonePreference(userTimeZone);
      const userIndex = store.users.findIndex(
        (user) => user.id === activeUser.id,
      );

      if (userIndex === -1) {
        throw createNotAuthenticatedError();
      }

      const nextUser: MemoryStoredUserRecord = {
        ...store.users[userIndex],
        displayName: safeDisplayName,
        showStudyNoteTemplates: safeShowStudyNoteTemplates,
        userLanguage: safeUserLanguage,
        studyObjective: safeStudyObjective,
        studyIntensity: safeStudyIntensity,
        userTimeZone: safeUserTimeZone,
      };

      store.users[userIndex] = nextUser;

      return buildSnapshot(nextUser);
    },
  };
}

export function createAppSessionContext(
  options: CreateAppSessionContextOptions = {},
): AppSessionContext {
  const service = options.service ?? createServerSessionService();
  const listeners = new Set<SessionListener>();
  let snapshot = options.initialSnapshot ?? buildAnonymousSnapshot();

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function commitSnapshot(nextSnapshot: AppSessionSnapshot) {
    snapshot = nextSnapshot;
    notifyListeners();
  }

  return {
    getSnapshot: () => snapshot,
    refresh: async () => {
      let nextSnapshot: AppSessionSnapshot;

      try {
        nextSnapshot = await service.getSessionSnapshot();
      } catch {
        nextSnapshot = buildAnonymousSnapshot();
      }

      commitSnapshot(nextSnapshot);
      return snapshot;
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    register: async (input) => {
      try {
        const nextSnapshot = await service.register(input);
        commitSnapshot(nextSnapshot);
        return snapshot;
      } catch (error) {
        rethrowAppAuthError(error);
      }
    },
    login: async (input) => {
      try {
        const nextSnapshot = await service.login(input);
        commitSnapshot(nextSnapshot);
        return snapshot;
      } catch (error) {
        rethrowAppAuthError(error);
      }
    },
    logout: async () => {
      const nextSnapshot = await service.logout();
      commitSnapshot(nextSnapshot);
      return snapshot;
    },
    updatePreferences: async (input) => {
      try {
        const nextSnapshot = await service.updatePreferences(input);
        commitSnapshot(nextSnapshot);
        return snapshot;
      } catch (error) {
        rethrowAppAuthError(error);
      }
    },
  };
}
