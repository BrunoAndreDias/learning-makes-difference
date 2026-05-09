import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { userLanguageCatalogs } from "./catalogs";
import { supportedUserLanguages } from "./user-language";

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return listSourceFiles(path);
    }

    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}

describe("User Language translation catalogs", () => {
  it("cover every app chrome translation key used by source routes and modules", () => {
    const sourceRoot = join(process.cwd(), "src");
    const appTranslationKeys = new Set<string>();
    const translationCall = /\bt\(\s*"([^"]+)"/g;

    for (const sourceFile of listSourceFiles(sourceRoot)) {
      if (
        sourceFile.endsWith("catalogs.ts") ||
        sourceFile.endsWith("catalogs.test.ts")
      ) {
        continue;
      }

      const source = readFileSync(sourceFile, "utf8");
      let match = translationCall.exec(source);

      while (match !== null) {
        appTranslationKeys.add(match[1]);
        match = translationCall.exec(source);
      }
    }

    expect(appTranslationKeys.size).toBeGreaterThan(0);

    for (const language of supportedUserLanguages) {
      const catalogKeys = new Set(Object.keys(userLanguageCatalogs[language]));
      const missingKeys = [...appTranslationKeys]
        .filter((key) => !catalogKeys.has(key))
        .sort();

      expect(missingKeys, `${language} missing app chrome keys`).toEqual([]);
    }
  });

  it("keep each supported User Language catalog on the same key set", () => {
    const englishKeys = Object.keys(userLanguageCatalogs.en).sort();

    for (const language of supportedUserLanguages) {
      expect(
        Object.keys(userLanguageCatalogs[language]).sort(),
        `${language} catalog keys`,
      ).toEqual(englishKeys);
    }
  });
});
