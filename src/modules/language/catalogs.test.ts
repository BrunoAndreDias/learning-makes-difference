import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { userLanguageCatalogs } from "./catalogs";
import { supportedUserLanguages } from "./user-language";

const sourceRoot = join(process.cwd(), "src");
const ignoredTranslationKeySourceFiles = new Set([
  join(sourceRoot, "modules", "language", "catalogs.ts"),
  join(sourceRoot, "modules", "language", "catalogs.test.ts"),
]);
const translationCallPattern = /\bt\(\s*"([^"]+)"/g;

function isTypeScriptSourceFile(path: string): boolean {
  return path.endsWith(".ts") || path.endsWith(".tsx");
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return listSourceFiles(path);
    }

    return entry.isFile() && isTypeScriptSourceFile(path) ? [path] : [];
  });
}

function readTranslationKeys(source: string): string[] {
  return Array.from(
    source.matchAll(translationCallPattern),
    (match) => match[1],
  );
}

function collectAppTranslationKeys(): Set<string> {
  const appTranslationKeys = new Set<string>();

  for (const sourceFile of listSourceFiles(sourceRoot)) {
    if (ignoredTranslationKeySourceFiles.has(sourceFile)) {
      continue;
    }

    for (const key of readTranslationKeys(readFileSync(sourceFile, "utf8"))) {
      appTranslationKeys.add(key);
    }
  }

  return appTranslationKeys;
}

function getMissingTranslationKeys(
  appTranslationKeys: ReadonlySet<string>,
  catalogKeys: ReadonlySet<string>,
): string[] {
  return [...appTranslationKeys].filter((key) => !catalogKeys.has(key)).sort();
}

describe("User Language translation catalogs", () => {
  it("cover every app chrome translation key used by source routes and modules", () => {
    const appTranslationKeys = collectAppTranslationKeys();
    expect(appTranslationKeys.size).toBeGreaterThan(0);

    for (const language of supportedUserLanguages) {
      const catalogKeys = new Set(Object.keys(userLanguageCatalogs[language]));
      const missingKeys = getMissingTranslationKeys(
        appTranslationKeys,
        catalogKeys,
      );

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
