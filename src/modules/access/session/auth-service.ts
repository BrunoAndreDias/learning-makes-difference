import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import argon2 from "argon2";
import { and, eq, gt } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";

import { type authSchema, authSessionsTable, usersTable } from "./auth-schema";
import {
  AppAuthError,
  type AppSessionSnapshot,
  type AppSessionUser,
  buildAnonymousSnapshot,
  defaultUserTimeZone,
  type LoginInput,
  normalizeUserLanguage,
  type RegisterInput,
  type UpdatePreferencesInput,
  validateUserLanguagePreference,
  validateUserTimeZonePreference,
} from "./session-contract";

type AuthDatabase = PgDatabase<PgQueryResultHKT, typeof authSchema>;

type AuthCookieOptions = {
  httpOnly: boolean;
  maxAge?: number;
  path: string;
  sameSite: "lax";
  secure: boolean;
};

type AuthCookieAdapter = {
  clear: (options: AuthCookieOptions) => void;
  get: () => string | null | undefined;
  set: (value: string, options: AuthCookieOptions) => void;
};

type CreateAuthServiceOptions = {
  cookie: AuthCookieAdapter;
  db: AuthDatabase;
  now?: () => Date;
  pilotRegistrationCode: string;
  secureCookies: boolean;
  sessionLifetimeMs?: number;
  sessionSecret: string;
};

type StoredUser = typeof usersTable.$inferSelect;

const DEFAULT_SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 30;
const SESSION_COOKIE_MAX_AGE_SECONDS = DEFAULT_SESSION_LIFETIME_MS / 1000;
const INVALID_CREDENTIALS_MESSAGE = "Email or password is incorrect.";
const NOT_AUTHENTICATED_MESSAGE = "Sign in to update account preferences.";

function createNotAuthenticatedError(): AppAuthError {
  return new AppAuthError("not_authenticated", NOT_AUTHENTICATED_MESSAGE);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildSessionUser(user: StoredUser): AppSessionUser {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    userLanguage: normalizeUserLanguage(user.userLanguage),
    userTimeZone: user.userTimeZone ?? defaultUserTimeZone,
  };
}

function buildSnapshot(user: StoredUser | null): AppSessionSnapshot {
  return user === null
    ? buildAnonymousSnapshot()
    : { user: buildSessionUser(user) };
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
  const normalizedValue = providedCode.trim();

  if (expectedCode.trim().length === 0 || normalizedValue !== expectedCode) {
    throw new AppAuthError(
      "invalid_registration_code",
      "Pilot registration code is invalid.",
    );
  }

  return normalizedValue;
}

function getCookieOptions(
  secureCookies: boolean,
  maxAge = SESSION_COOKIE_MAX_AGE_SECONDS,
): AuthCookieOptions {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax",
    secure: secureCookies,
  };
}

function signSessionId(sessionId: string, sessionSecret: string): string {
  return createHmac("sha256", sessionSecret)
    .update(sessionId)
    .digest("base64url");
}

function createSignedSessionToken(
  sessionId: string,
  sessionSecret: string,
): string {
  return `v1.${sessionId}.${signSessionId(sessionId, sessionSecret)}`;
}

function readSignedSessionId(
  token: string | null | undefined,
  sessionSecret: string,
): string | null {
  if (token === null || token === undefined) {
    return null;
  }

  const [version, sessionId, signature] = token.split(".");

  if (
    version !== "v1" ||
    sessionId === undefined ||
    sessionId.length === 0 ||
    signature === undefined
  ) {
    return null;
  }

  const expectedSignature = signSessionId(sessionId, sessionSecret);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  return sessionId;
}

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}

async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return argon2.verify(passwordHash, password);
}

async function issueSessionForUser({
  cookie,
  db,
  now,
  secureCookies,
  sessionLifetimeMs,
  sessionSecret,
  user,
}: {
  cookie: AuthCookieAdapter;
  db: AuthDatabase;
  now: () => Date;
  secureCookies: boolean;
  sessionLifetimeMs: number;
  sessionSecret: string;
  user: AppSessionUser;
}) {
  const sessionId = randomUUID();
  const createdAt = now();
  const expiresAt = new Date(createdAt.getTime() + sessionLifetimeMs);

  await db.insert(authSessionsTable).values({
    id: sessionId,
    userId: user.id,
    createdAt,
    expiresAt,
  });

  cookie.set(
    createSignedSessionToken(sessionId, sessionSecret),
    getCookieOptions(secureCookies),
  );
}

async function getStoredUserForActiveSession({
  cookie,
  db,
  now,
  secureCookies,
  sessionSecret,
}: {
  cookie: AuthCookieAdapter;
  db: AuthDatabase;
  now: () => Date;
  secureCookies: boolean;
  sessionSecret: string;
}): Promise<StoredUser | null> {
  const sessionId = readSignedSessionId(cookie.get(), sessionSecret);

  if (sessionId === null) {
    cookie.clear(getCookieOptions(secureCookies, 0));
    return null;
  }

  const rows = await db
    .select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      email: usersTable.email,
      passwordHash: usersTable.passwordHash,
      userLanguage: usersTable.userLanguage,
      userTimeZone: usersTable.userTimeZone,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(authSessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, authSessionsTable.userId))
    .where(
      and(
        eq(authSessionsTable.id, sessionId),
        gt(authSessionsTable.expiresAt, now()),
      ),
    )
    .limit(1);

  const storedUser = rows[0] ?? null;

  if (storedUser === null) {
    cookie.clear(getCookieOptions(secureCookies, 0));
    return null;
  }

  return storedUser;
}

export function createAuthService({
  cookie,
  db,
  now = () => new Date(),
  pilotRegistrationCode,
  secureCookies,
  sessionLifetimeMs = DEFAULT_SESSION_LIFETIME_MS,
  sessionSecret,
}: CreateAuthServiceOptions) {
  return {
    async getSessionSnapshot(): Promise<AppSessionSnapshot> {
      const storedUser = await getStoredUserForActiveSession({
        cookie,
        db,
        now,
        secureCookies,
        sessionSecret,
      });

      return buildSnapshot(storedUser);
    },
    async login({ email, password }: LoginInput): Promise<AppSessionSnapshot> {
      const safeEmail = validateEmail(email);
      const safePassword = validatePassword(password);
      const users = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, safeEmail))
        .limit(1);
      const user = users[0] ?? null;

      if (user === null) {
        throw new AppAuthError(
          "invalid_credentials",
          INVALID_CREDENTIALS_MESSAGE,
        );
      }

      const isValidPassword = await verifyPassword(
        user.passwordHash,
        safePassword,
      );

      if (!isValidPassword) {
        throw new AppAuthError(
          "invalid_credentials",
          INVALID_CREDENTIALS_MESSAGE,
        );
      }

      const sessionUser = buildSessionUser(user);

      await issueSessionForUser({
        cookie,
        db,
        now,
        secureCookies,
        sessionLifetimeMs,
        sessionSecret,
        user: sessionUser,
      });

      return { user: sessionUser };
    },
    async logout(): Promise<AppSessionSnapshot> {
      const sessionId = readSignedSessionId(cookie.get(), sessionSecret);

      if (sessionId !== null) {
        await db
          .delete(authSessionsTable)
          .where(eq(authSessionsTable.id, sessionId));
      }

      cookie.clear(getCookieOptions(secureCookies, 0));

      return buildAnonymousSnapshot();
    },
    async register({
      displayName,
      email,
      password,
      pilotRegistrationCode: providedRegistrationCode,
      userLanguage,
      userTimeZone,
    }: RegisterInput): Promise<AppSessionSnapshot> {
      const safeDisplayName = validateDisplayName(displayName);
      const safeEmail = validateEmail(email);
      const safePassword = validatePassword(password);
      validatePilotRegistrationCode(
        providedRegistrationCode,
        pilotRegistrationCode,
      );
      const safeUserTimeZone = validateUserTimeZonePreference(userTimeZone);
      const safeUserLanguage = normalizeUserLanguage(userLanguage);

      const existingUsers = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, safeEmail))
        .limit(1);

      if (existingUsers.length > 0) {
        throw new AppAuthError(
          "email_taken",
          "An account with that email already exists.",
        );
      }

      const timestamp = now();
      const userId = randomUUID();
      const passwordHash = await hashPassword(safePassword);

      await db.insert(usersTable).values({
        id: userId,
        displayName: safeDisplayName,
        email: safeEmail,
        passwordHash,
        userLanguage: safeUserLanguage,
        userTimeZone: safeUserTimeZone,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const sessionUser: AppSessionUser = {
        id: userId,
        displayName: safeDisplayName,
        email: safeEmail,
        userLanguage: safeUserLanguage,
        userTimeZone: safeUserTimeZone,
      };

      await issueSessionForUser({
        cookie,
        db,
        now,
        secureCookies,
        sessionLifetimeMs,
        sessionSecret,
        user: sessionUser,
      });

      return { user: sessionUser };
    },
    async updatePreferences({
      displayName,
      userLanguage,
      userTimeZone,
    }: UpdatePreferencesInput): Promise<AppSessionSnapshot> {
      const storedUser = await getStoredUserForActiveSession({
        cookie,
        db,
        now,
        secureCookies,
        sessionSecret,
      });

      if (storedUser === null) {
        throw createNotAuthenticatedError();
      }

      const safeDisplayName = validateDisplayName(displayName);
      const safeUserLanguage = validateUserLanguagePreference(userLanguage);
      const safeUserTimeZone = validateUserTimeZonePreference(userTimeZone);
      const updatedAt = now();

      await db
        .update(usersTable)
        .set({
          displayName: safeDisplayName,
          userLanguage: safeUserLanguage,
          userTimeZone: safeUserTimeZone,
          updatedAt,
        })
        .where(eq(usersTable.id, storedUser.id));

      return {
        user: {
          id: storedUser.id,
          displayName: safeDisplayName,
          email: storedUser.email,
          userLanguage: safeUserLanguage,
          userTimeZone: safeUserTimeZone,
        },
      };
    },
  };
}
