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

export type RegisterInput = {
  displayName: string;
  email: string;
  password: string;
  pilotRegistrationCode: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type UpdatePreferencesInput = {
  displayName: string;
  interfaceLanguage: AppLanguagePreference;
  studyLanguage: AppLanguagePreference;
};

export class AppAuthError extends Error {
  readonly code:
    | "email_taken"
    | "invalid_credentials"
    | "invalid_input"
    | "invalid_registration_code"
    | "not_authenticated";

  constructor(
    code:
      | "email_taken"
      | "invalid_credentials"
      | "invalid_input"
      | "invalid_registration_code"
      | "not_authenticated",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

export function isLanguagePreference(
  value: unknown,
): value is AppLanguagePreference {
  return (
    typeof value === "string" &&
    appLanguagePreferences.includes(value as AppLanguagePreference)
  );
}

export function buildAnonymousSnapshot(): AppSessionSnapshot {
  return { user: null };
}
