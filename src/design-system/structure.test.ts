import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

const allowedRootFiles = [
  "README.md",
  "foundation.test.ts",
  "global.css",
  "page-normalization.test.ts",
  "shared-actions.css",
  "structure.test.ts",
  "tokens.ts",
] as const;

describe("design-system structure", () => {
  it("keeps UI modules aggregated in their own folders", () => {
    const designSystemRoot = new URL("./", import.meta.url);
    const entries = readdirSync(designSystemRoot, { withFileTypes: true });
    const rootFiles = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();

    expect(rootFiles).toEqual([...allowedRootFiles].sort());

    for (const entry of entries.filter((candidate) =>
      candidate.isDirectory(),
    )) {
      const moduleEntries = readdirSync(
        new URL(`./${entry.name}/`, designSystemRoot),
        { withFileTypes: true },
      );

      expect(
        moduleEntries.some(
          (moduleEntry) =>
            moduleEntry.isFile() &&
            (moduleEntry.name === "index.ts" ||
              moduleEntry.name === "index.tsx"),
        ),
      ).toBe(true);
    }
  });
});
