export type AppSessionUser = {
  email: string;
  id: string;
  displayName: string;
  interfaceLanguage: AppLanguagePreference;
  studyLanguage: AppLanguagePreference;
};

export type AppSessionSnapshot = {
  user: AppSessionUser | null;
};

export const appLanguagePreferences = ["en", "es", "pt-BR"] as const;

export type AppLanguagePreference = (typeof appLanguagePreferences)[number];

type SessionListener = () => void;

type RegisterInput = {
  displayName: string;
  email: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type UpdatePreferencesInput = {
  displayName: string;
  interfaceLanguage: AppLanguagePreference;
  studyLanguage: AppLanguagePreference;
};

type StoredUserRecord = {
  id: string;
  displayName: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  interfaceLanguage: AppLanguagePreference;
  studyLanguage: AppLanguagePreference;
};

type SessionStorageAdapter = Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
>;

type SessionCrypto = Pick<Crypto, "randomUUID" | "subtle">;

type CreateAppSessionContextOptions = {
  crypto?: SessionCrypto;
  keyPrefix?: string;
  storage?: SessionStorageAdapter;
};

export class AppAuthError extends Error {
  readonly code:
    | "email_taken"
    | "invalid_credentials"
    | "invalid_input"
    | "not_authenticated";

  constructor(
    code:
      | "email_taken"
      | "invalid_credentials"
      | "invalid_input"
      | "not_authenticated",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

export type AppSessionContext = {
  getSnapshot: () => AppSessionSnapshot;
  subscribe: (listener: SessionListener) => () => void;
  register: (input: RegisterInput) => Promise<AppSessionSnapshot>;
  login: (input: LoginInput) => Promise<AppSessionSnapshot>;
  logout: () => AppSessionSnapshot;
  updatePreferences: (
    input: UpdatePreferencesInput,
  ) => Promise<AppSessionSnapshot>;
};

const DEFAULT_STORAGE_KEY_PREFIX = "learning-makes-difference-auth";
const NOT_AUTHENTICATED_MESSAGE = "Sign in to update account preferences.";

function getDefaultStorage(): SessionStorageAdapter | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

function getDefaultCrypto(): SessionCrypto {
  return globalThis.crypto;
}

function getUsersStorageKey(prefix: string): string {
  return `${prefix}:users`;
}

function getSessionStorageKey(prefix: string): string {
  return `${prefix}:session-user-id`;
}

function createNotAuthenticatedError(): AppAuthError {
  return new AppAuthError("not_authenticated", NOT_AUTHENTICATED_MESSAGE);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseStoredUsers(value: string | null): StoredUserRecord[] {
  if (value === null) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter((user): user is StoredUserRecord => {
      return (
        typeof user === "object" &&
        user !== null &&
        typeof user.id === "string" &&
        typeof user.displayName === "string" &&
        typeof user.email === "string" &&
        typeof user.passwordHash === "string" &&
        typeof user.passwordSalt === "string" &&
        isLanguagePreference(user.interfaceLanguage) &&
        isLanguagePreference(user.studyLanguage)
      );
    });
  } catch {
    return [];
  }
}

function isLanguagePreference(value: unknown): value is AppLanguagePreference {
  return (
    typeof value === "string" &&
    appLanguagePreferences.includes(value as AppLanguagePreference)
  );
}

function buildSnapshot(user: StoredUserRecord | null): AppSessionSnapshot {
  if (user === null) {
    return { user: null };
  }

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      interfaceLanguage: user.interfaceLanguage,
      studyLanguage: user.studyLanguage,
    },
  };
}

async function hashPassword(
  cryptoProvider: SessionCrypto,
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

function validateLanguagePreference(
  value: string,
  fieldLabel: string,
): AppLanguagePreference {
  if (!isLanguagePreference(value)) {
    throw new AppAuthError(
      "invalid_input",
      `${fieldLabel} must be one of the supported language options.`,
    );
  }

  return value;
}

export function hasActiveSession(session: AppSessionSnapshot): boolean {
  return session.user !== null;
}

export function createGuestSessionContext(): AppSessionContext {
  const snapshot: AppSessionSnapshot = {
    user: null,
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    register: async () => {
      throw createNotAuthenticatedError();
    },
    login: async () => {
      throw createNotAuthenticatedError();
    },
    logout: () => snapshot,
    updatePreferences: async () => {
      throw createNotAuthenticatedError();
    },
  };
}

export function createAppSessionContext(
  options: CreateAppSessionContextOptions = {},
): AppSessionContext {
  const storage = options.storage ?? getDefaultStorage();
  const cryptoProvider = options.crypto ?? getDefaultCrypto();
  const keyPrefix = options.keyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX;
  const listeners = new Set<SessionListener>();
  let snapshot: AppSessionSnapshot = { user: null };

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function readUsers(): StoredUserRecord[] {
    return parseStoredUsers(
      storage?.getItem(getUsersStorageKey(keyPrefix)) ?? null,
    );
  }

  function writeUsers(users: StoredUserRecord[]) {
    storage?.setItem(getUsersStorageKey(keyPrefix), JSON.stringify(users));
  }

  function readSessionUser(users: StoredUserRecord[]): StoredUserRecord | null {
    const sessionUserId =
      storage?.getItem(getSessionStorageKey(keyPrefix)) ?? null;

    if (sessionUserId === null) {
      return null;
    }

    return users.find((user) => user.id === sessionUserId) ?? null;
  }

  function writeSessionUser(user: StoredUserRecord | null) {
    if (user === null) {
      storage?.removeItem(getSessionStorageKey(keyPrefix));
      return;
    }

    storage?.setItem(getSessionStorageKey(keyPrefix), user.id);
  }

  function syncSnapshotFromStorage() {
    const users = readUsers();
    snapshot = buildSnapshot(readSessionUser(users));
  }

  syncSnapshotFromStorage();

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    register: async ({ displayName, email, password }) => {
      const safeDisplayName = validateDisplayName(displayName);
      const safeEmail = validateEmail(email);
      const safePassword = validatePassword(password);
      const users = readUsers();

      if (users.some((user) => normalizeEmail(user.email) === safeEmail)) {
        throw new AppAuthError(
          "email_taken",
          "An account with that email already exists.",
        );
      }

      const passwordSalt = cryptoProvider.randomUUID();
      const nextUser: StoredUserRecord = {
        id: cryptoProvider.randomUUID(),
        displayName: safeDisplayName,
        email: safeEmail,
        passwordSalt,
        passwordHash: await hashPassword(
          cryptoProvider,
          safePassword,
          passwordSalt,
        ),
        interfaceLanguage: "en",
        studyLanguage: "en",
      };

      users.push(nextUser);
      writeUsers(users);
      writeSessionUser(nextUser);
      snapshot = buildSnapshot(nextUser);
      notifyListeners();

      return snapshot;
    },
    login: async ({ email, password }) => {
      const safeEmail = validateEmail(email);
      const safePassword = validatePassword(password);
      const users = readUsers();
      const user = users.find(
        (candidate) => normalizeEmail(candidate.email) === safeEmail,
      );

      if (user === undefined) {
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

      writeSessionUser(user);
      snapshot = buildSnapshot(user);
      notifyListeners();

      return snapshot;
    },
    logout: () => {
      writeSessionUser(null);
      snapshot = { user: null };
      notifyListeners();

      return snapshot;
    },
    updatePreferences: async ({
      displayName,
      interfaceLanguage,
      studyLanguage,
    }) => {
      const activeUserId = snapshot.user?.id;

      if (activeUserId === undefined) {
        throw createNotAuthenticatedError();
      }

      const safeDisplayName = validateDisplayName(displayName);
      const safeInterfaceLanguage = validateLanguagePreference(
        interfaceLanguage,
        "Interface language",
      );
      const safeStudyLanguage = validateLanguagePreference(
        studyLanguage,
        "Study language",
      );
      const users = readUsers();
      const userIndex = users.findIndex((user) => user.id === activeUserId);

      if (userIndex === -1) {
        throw createNotAuthenticatedError();
      }

      const nextUser: StoredUserRecord = {
        ...users[userIndex],
        displayName: safeDisplayName,
        interfaceLanguage: safeInterfaceLanguage,
        studyLanguage: safeStudyLanguage,
      };

      users[userIndex] = nextUser;
      writeUsers(users);
      writeSessionUser(nextUser);
      snapshot = buildSnapshot(nextUser);
      notifyListeners();

      return snapshot;
    },
  };
}
