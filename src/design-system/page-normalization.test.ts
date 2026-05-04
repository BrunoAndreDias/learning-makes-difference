import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function getCssRules(css: string, selector: string) {
  const rulePattern = /([^{}@]+)\{([^{}]*)\}/g;
  const normalizedSelector = selector.replace(/\s+/g, " ").trim();

  return Array.from(css.matchAll(rulePattern)).flatMap((match) => {
    const selectorList = (match[1] ?? "")
      .split(",")
      .map((candidate) => candidate.replace(/\s+/g, " ").trim());

    if (!selectorList.includes(normalizedSelector)) {
      return [];
    }

    return match[2] ?? "";
  });
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

  it("keeps workspace page header copy consistent by role", () => {
    const appCss = readFileSync(new URL("../styles/app.css", import.meta.url), {
      encoding: "utf8",
    });
    const breadcrumbStyle = getCssRules(appCss, ".workspace-breadcrumb").join(
      "\n",
    );
    const recallBreadcrumbStyle = getCssRules(
      appCss,
      ".recall-breadcrumb",
    ).join("\n");
    const recallBreadcrumbSpanStyle = getCssRules(
      appCss,
      ".recall-breadcrumb span",
    ).join("\n");
    const notesTitleStyle = getCssRules(
      appCss,
      ".notes-workspace__identity h1",
    ).join("\n");
    const recallTitleStyle = getCssRules(
      appCss,
      ".recall-surface__header h3",
    ).join("\n");
    const notesDescriptionStyle = getCssRules(
      appCss,
      ".notes-workspace__identity p",
    ).join("\n");
    const recallDescriptionStyle = getCssRules(
      appCss,
      ".recall-surface__header .notes-editor__meta",
    ).join("\n");

    for (const breadcrumbRule of [breadcrumbStyle, recallBreadcrumbStyle]) {
      expect(breadcrumbRule).toContain("color: var(--color-content-muted);");
      expect(breadcrumbRule).toContain("font-family: var(--font-body);");
      expect(breadcrumbRule).toContain("letter-spacing: 0.08em;");
      expect(breadcrumbRule).toContain("text-transform: uppercase;");
    }
    expect(recallBreadcrumbSpanStyle).toContain("color: inherit;");

    for (const titleRule of [notesTitleStyle, recallTitleStyle]) {
      expect(titleRule).toContain("color: var(--color-content-strong);");
      expect(titleRule).toContain("font-family: var(--font-body);");
      expect(titleRule).toContain("font-weight: 700;");
      expect(titleRule).toContain("letter-spacing: 0;");
    }

    for (const descriptionRule of [
      notesDescriptionStyle,
      recallDescriptionStyle,
    ]) {
      expect(descriptionRule).toContain("color: var(--color-content-muted);");
      expect(descriptionRule).toContain("font-family: var(--font-body);");
      expect(descriptionRule).toContain("font-size: 0.95rem;");
      expect(descriptionRule).toContain("line-height: 1.45;");
    }
  });

  it("keeps Recall state accents aligned with the shared page palette", () => {
    const recallSessionCss = readFileSync(
      new URL("../modules/recall/recall-session-route.css", import.meta.url),
      "utf8",
    );
    const recallWorkspacesCss = readFileSync(
      new URL("../modules/recall/recall-workspaces.css", import.meta.url),
      "utf8",
    );

    const flashCardPillStyle = getCssRules(
      recallWorkspacesCss,
      '.recall-mode-pill[data-mode-tone="flash-card"]',
    ).join("\n");
    const aiGradedPillStyle = getCssRules(
      recallWorkspacesCss,
      '.recall-mode-pill[data-mode-tone="ai-graded"]',
    ).join("\n");
    const selectedAiGradedTypeStyle = getCssRules(
      recallWorkspacesCss,
      '.recall-select-type-option[data-selected="true"][data-mode="AiGraded"]',
    ).join("\n");
    const forgotRatingStyle = getCssRules(
      recallSessionCss,
      ".recall-rating--forgot",
    ).join("\n");

    for (const pillStyle of [flashCardPillStyle, aiGradedPillStyle]) {
      expect(pillStyle).toContain("border-color: var(--recall-chip-border);");
      expect(pillStyle).toContain("background: var(--recall-chip-surface);");
      expect(pillStyle).toContain("color: var(--recall-chip-text);");
    }

    expect(selectedAiGradedTypeStyle).toContain(
      "border-color: var(--recall-accent-border);",
    );
    expect(selectedAiGradedTypeStyle).toContain(
      "background: var(--recall-accent-surface);",
    );
    expect(forgotRatingStyle).toContain(
      "background: var(--recall-soft-surface);",
    );
  });
});
