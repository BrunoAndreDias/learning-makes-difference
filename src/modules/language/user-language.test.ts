import { describe, expect, it } from "vitest";

import {
  detectAnonymousUserLanguage,
  fallbackUserLanguage,
  supportedUserLanguages,
} from "./user-language";

describe("anonymous User Language detection", () => {
  it("defines the v1 supported User Languages", () => {
    expect(supportedUserLanguages).toEqual(["en", "pt-PT", "es"]);
    expect(fallbackUserLanguage).toBe("en");
  });

  it("maps supported browser languages and falls back to English", () => {
    expect(detectAnonymousUserLanguage(["pt-PT"])).toBe("pt-PT");
    expect(detectAnonymousUserLanguage(["pt"])).toBe("pt-PT");
    expect(detectAnonymousUserLanguage(["es-MX"])).toBe("es");
    expect(detectAnonymousUserLanguage(["fr-FR"])).toBe("en");
    expect(detectAnonymousUserLanguage([])).toBe("en");
  });
});
