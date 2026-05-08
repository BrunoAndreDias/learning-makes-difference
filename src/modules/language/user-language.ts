export const supportedUserLanguages = ["en", "pt-PT", "es"] as const;
export type UserLanguage = (typeof supportedUserLanguages)[number];

export const fallbackUserLanguage: UserLanguage = "en";

export function detectAnonymousUserLanguage(
  browserLanguages: readonly string[],
): UserLanguage {
  for (const browserLanguage of browserLanguages) {
    const normalizedLanguage = browserLanguage.trim().toLowerCase();

    if (normalizedLanguage === "pt" || normalizedLanguage === "pt-pt") {
      return "pt-PT";
    }

    if (normalizedLanguage === "es" || normalizedLanguage.startsWith("es-")) {
      return "es";
    }

    if (normalizedLanguage === "en" || normalizedLanguage.startsWith("en-")) {
      return "en";
    }
  }

  return fallbackUserLanguage;
}
