import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function getCssRules(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rulePattern = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g");

  return Array.from(css.matchAll(rulePattern), (match) => match[1] ?? "");
}

function expectSelectorToUsePageTypeAndColor(css: string, selector: string) {
  const combinedRules = getCssRules(css, selector).join("\n");

  expect(combinedRules).toContain("font-family: var(--font-body);");
  expect(combinedRules).toContain("color: var(--color-content-default);");
}

describe("page style normalization", () => {
  it("keeps route page roots on the shared body font and content palette", () => {
    const accessCss = readFileSync(
      new URL("../modules/access/access.css", import.meta.url),
      "utf8",
    );
    const focusCss = readFileSync(
      new URL("../modules/focus/focus-route.css", import.meta.url),
      "utf8",
    );
    const labelsCss = readFileSync(
      new URL("../modules/labels/labels.css", import.meta.url),
      "utf8",
    );
    const notesToolbarCss = readFileSync(
      new URL(
        "../modules/notes/notes-workspace/notes-toolbar.css",
        import.meta.url,
      ),
      "utf8",
    );
    const recallSessionCss = readFileSync(
      new URL("../modules/recall/recall-session-route.css", import.meta.url),
      "utf8",
    );
    const recallWorkspacesCss = readFileSync(
      new URL("../modules/recall/recall-workspaces.css", import.meta.url),
      "utf8",
    );
    const workspaceShellCss = readFileSync(
      new URL(
        "../modules/workspace-shell/workspace-shell.css",
        import.meta.url,
      ),
      "utf8",
    );

    expectSelectorToUsePageTypeAndColor(accessCss, ".auth-shell");
    expectSelectorToUsePageTypeAndColor(accessCss, ".settings-layout");
    expectSelectorToUsePageTypeAndColor(focusCss, ".focus-workspace");
    expectSelectorToUsePageTypeAndColor(labelsCss, ".labels-page");
    expectSelectorToUsePageTypeAndColor(notesToolbarCss, ".notes-workspace");
    expectSelectorToUsePageTypeAndColor(recallSessionCss, ".recall-shell");
    expectSelectorToUsePageTypeAndColor(recallWorkspacesCss, ".recall-surface");
    expectSelectorToUsePageTypeAndColor(
      recallWorkspacesCss,
      ".recall-workspace",
    );
    expectSelectorToUsePageTypeAndColor(
      workspaceShellCss,
      ".authenticated-shell",
    );
  });
});
