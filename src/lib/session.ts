export type AppSessionUser = {
  email: string;
  id: string;
  displayName: string;
};

export type AppSessionSnapshot = {
  user: AppSessionUser | null;
};

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

type StoredUserRecord = {
  id: string;
  displayName: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
};

type SessionStorageAdapter = Pick<Storage, "getItem" | "removeItem" | "setItem">;

type SessionCrypto = Pick<Crypto, "randomUUID" | "subtle">;

type CreateAppSessionContextOptions = {
  crypto?: SessionCrypto;
  initialSnapshot?: AppSessionSnapshot;
  keyPrefix?: string;
  storage?: SessionStorageAdapter;
};

export class AppAuthError extends Error {
  code: "email_taken" | "invalid_credentials" | "invalid_input";

  constructor(
    code: "email_taken" | "invalid_credentials" | "invalid_input",
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
};

const DEFAULT_STORAGE_KEY_PREFIX = "learning-makes-difference-auth";

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
        typeof user.passwordSalt === "string"
      );
    });
  } catch {
    return [];
  }
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

export function hasActiveSession(session: AppSessionSnapshot): boolean {
  return session.user !== null;
}

export function createGuestSessionContext(): AppSessionContext {
  return createAppSessionContext({
    initialSnapshot: {
      user: null,
    },
  });
}

export function createAppSessionContext(
  options: CreateAppSessionContextOptions = {},
): AppSessionContext {
  const storage = options.storage ?? getDefaultStorage();
  const cryptoProvider = options.crypto ?? getDefaultCrypto();
  const keyPrefix = options.keyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX;
  const listeners = new Set<SessionListener>();
  let snapshot = options.initialSnapshot ?? { user: null };

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function readUsers(): StoredUserRecord[] {
    return parseStoredUsers(storage?.getItem(getUsersStorageKey(keyPrefix)) ?? null);
  }

  function writeUsers(users: StoredUserRecord[]) {
    storage?.setItem(getUsersStorageKey(keyPrefix), JSON.stringify(users));
  }

  function readSessionUser(users: StoredUserRecord[]): StoredUserRecord | null {
    const sessionUserId = storage?.getItem(getSessionStorageKey(keyPrefix)) ?? null;

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
        passwordHash: await hashPassword(cryptoProvider, safePassword, passwordSalt),
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
      const user = users.find((candidate) => normalizeEmail(candidate.email) === safeEmail);

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
  };
}
