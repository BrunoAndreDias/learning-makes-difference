import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = new URL("../", import.meta.url);

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return listSourceFiles(path);
    }

    return path;
  });
}

describe("module boundaries", () => {
  it("keeps study subdomains out of the former learning-loop container", () => {
    const sourcePath = sourceRoot.pathname;
    const sourceFiles = listSourceFiles(sourcePath).filter((path) =>
      /\.(css|ts|tsx)$/.test(path),
    );

    const formerContainerPath = ["modules", "learning-loop"].join("/");

    expect(existsSync(join(sourcePath, formerContainerPath))).toBe(false);
    expect(existsSync(join(sourcePath, "modules/shared"))).toBe(false);

    const filesWithLearningLoopImports = sourceFiles.filter((path) =>
      readFileSync(path, "utf8").includes(formerContainerPath),
    );

    expect(filesWithLearningLoopImports).toEqual([]);
  });
});
