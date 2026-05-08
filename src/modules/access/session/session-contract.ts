export type AppSessionUser = {
  email: string;
  id: string;
  displayName: string;
  interfaceLanguage: AppLanguagePreference;
  studyLanguage: AppLanguagePreference;
  userTimeZone?: UserTimeZonePreference;
};

export type AppSessionSnapshot = {
  user: AppSessionUser | null;
};

export const appLanguagePreferences = ["en", "es", "pt-BR"] as const;
export const defaultUserTimeZone = "UTC";
const appAuthErrorCodes = [
  "email_taken",
  "invalid_credentials",
  "invalid_input",
  "invalid_registration_code",
  "not_authenticated",
] as const;

export type AppLanguagePreference = (typeof appLanguagePreferences)[number];
export type UserTimeZonePreference = string;
export type AppAuthErrorCode = (typeof appAuthErrorCodes)[number];

export type RegisterInput = {
  displayName: string;
  email: string;
  password: string;
  pilotRegistrationCode: string;
  userTimeZone?: UserTimeZonePreference;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type UpdatePreferencesInput = {
  displayName: string;
  interfaceLanguage: AppLanguagePreference;
  studyLanguage: AppLanguagePreference;
  userTimeZone: UserTimeZonePreference;
};

export class AppAuthError extends Error {
  readonly code: AppAuthErrorCode;

  constructor(code: AppAuthErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function isAppAuthErrorCode(value: unknown): value is AppAuthErrorCode {
  return (
    typeof value === "string" &&
    appAuthErrorCodes.includes(value as AppAuthErrorCode)
  );
}

function readAuthErrorFields(error: unknown) {
  if (error === null || typeof error !== "object") {
    return null;
  }

  return error as {
    cause?: unknown;
    code?: unknown;
    data?: unknown;
    message?: unknown;
  };
}

export function getAppAuthError(error: unknown): AppAuthError | null {
  if (error instanceof AppAuthError) {
    return error;
  }

  const queue = [error];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const candidate = queue.shift();

    if (seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);

    const fields = readAuthErrorFields(candidate);

    if (fields === null) {
      continue;
    }

    if (isAppAuthErrorCode(fields.code) && typeof fields.message === "string") {
      return new AppAuthError(fields.code, fields.message);
    }

    queue.push(fields.data, fields.cause);
  }

  return null;
}

export function isLanguagePreference(
  value: unknown,
): value is AppLanguagePreference {
  return (
    typeof value === "string" &&
    appLanguagePreferences.includes(value as AppLanguagePreference)
  );
}

export function isUserTimeZonePreference(
  value: unknown,
): value is UserTimeZonePreference {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length === 0
  ) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function buildAnonymousSnapshot(): AppSessionSnapshot {
  return { user: null };
}
