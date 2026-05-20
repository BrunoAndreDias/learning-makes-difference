import { readdirSync, readFileSync } from "node:fs";

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

function collectCssFiles(root: URL): URL[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(
      `${entry.name}${entry.isDirectory() ? "/" : ""}`,
      root,
    );

    if (entry.isDirectory()) {
      return collectCssFiles(child);
    }

    return entry.isFile() && entry.name.endsWith(".css") ? [child] : [];
  });
}

function findRawColorLiterals(file: URL) {
  const rawColorPattern = /#[\da-fA-F]{3,8}|rgba?\(|hsla?\(/;
  const css = readFileSync(file, "utf8");

  return css.split("\n").flatMap((line, index) => {
    if (!rawColorPattern.test(line)) {
      return [];
    }

    return [`${file.pathname}:${index + 1}: ${line.trim()}`];
  });
}

function expectSelectorToUsePageTypeAndColor(css: string, selector: string) {
  const combinedRules = getCssRules(css, selector).join("\n");

  expect(combinedRules).toContain("font-family: var(--font-body);");
  expect(combinedRules).toContain("color: var(--color-content-default);");
}

describe("page style normalization", () => {
  it("keeps application styles on shared color tokens", () => {
    const appCssFiles = [
      new URL("../design-system/shared-actions.css", import.meta.url),
      new URL("../styles/app.css", import.meta.url),
      ...collectCssFiles(new URL("../modules/", import.meta.url)),
    ];

    const rawColorLiterals = appCssFiles.flatMap(findRawColorLiterals);

    expect(rawColorLiterals).toEqual([]);
  });

  it("keeps route page roots on the shared body font and content palette", () => {
    const accessCss = readFileSync(
      new URL("../modules/access/access.css", import.meta.url),
      "utf8",
    );
    const notesToolbarCss = readFileSync(
      new URL(
        "../modules/notes/notes-workspace/notes-toolbar.css",
        import.meta.url,
      ),
      "utf8",
    );
    const pageLayoutCss = readFileSync(
      new URL("./page-layout/page-layout.css", import.meta.url),
      "utf8",
    );
    const recallSessionCss = readFileSync(
      new URL("../modules/recall/recall-session-route.css", import.meta.url),
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
    expectSelectorToUsePageTypeAndColor(notesToolbarCss, ".notes-workspace");
    expectSelectorToUsePageTypeAndColor(pageLayoutCss, ".page-layout");
    expectSelectorToUsePageTypeAndColor(recallSessionCss, ".recall-shell");
    expectSelectorToUsePageTypeAndColor(
      workspaceShellCss,
      ".authenticated-shell",
    );
  });

  it("keeps the app shell and Focus route on the LMD green study palette without changing shell density", () => {
    const globalCss = readFileSync(
      new URL("./global.css", import.meta.url),
      "utf8",
    );
    const focusCss = readFileSync(
      new URL("../modules/focus/focus-route.css", import.meta.url),
      "utf8",
    );
    const workspaceShellCss = readFileSync(
      new URL(
        "../modules/workspace-shell/workspace-shell.css",
        import.meta.url,
      ),
      "utf8",
    );

    const focusRootStyle = getCssRules(focusCss, ".focus-workspace").join("\n");
    const focusShellWorkspaceHeaderStyle = getCssRules(
      workspaceShellCss,
      '.app-frame[data-workspace="focus"] .app-frame__workspace-header',
    ).join("\n");
    const focusShellActionsStyle = getCssRules(
      workspaceShellCss,
      '.app-frame[data-workspace="focus"] .app-frame__actions',
    ).join("\n");
    const sharedShellActionsStyle = getCssRules(
      workspaceShellCss,
      ".app-frame__actions",
    ).join("\n");
    const focusCardStyle = getCssRules(focusCss, ".focus-card").join("\n");
    const focusSessionPlanNextStyle = getCssRules(
      focusCss,
      ".focus-session-plan__next",
    ).join("\n");
    const secondMetricStyle = getCssRules(
      focusCss,
      ".focus-weekly-analytics div:nth-child(2)",
    ).join("\n");
    const thirdMetricStyle = getCssRules(
      focusCss,
      ".focus-weekly-analytics div:nth-child(3)",
    ).join("\n");
    const sixthMetricStyle = getCssRules(
      focusCss,
      ".focus-weekly-analytics div:nth-child(6)",
    ).join("\n");

    expect(globalCss).toContain("--color-learning-pine: #1f6b45;");
    expect(globalCss).toContain("--color-learning-pine-mist: #e9f2ec;");
    expect(globalCss).toContain("--color-learning-factual-teal: #287c73;");
    expect(globalCss).toContain("--color-learning-honey-amber: #d99126;");
    expect(globalCss).toContain("--color-learning-terracotta: #c95646;");
    expect(globalCss).toContain("--color-primary: #1f6b45;");
    expect(globalCss).toContain("--color-primary-soft: #e9f2ec;");
    expect(globalCss).toContain("--color-neutral-ink: #17231e;");
    expect(workspaceShellCss).not.toContain(
      '.authenticated-shell:has(.app-frame[data-workspace="focus"])',
    );
    expect(focusRootStyle).toContain(
      "--focus-accent: var(--color-learning-pine);",
    );
    expect(focusRootStyle).toContain(
      "--focus-accent-hover: var(--color-learning-pine-hover);",
    );
    expect(focusRootStyle).toContain(
      "--focus-accent-soft: var(--color-learning-pine-mist);",
    );
    expect(focusRootStyle).toContain(
      "--focus-accent-border: var(--color-learning-border-stone);",
    );
    expect(focusRootStyle).toContain(
      "--focus-success-accent: var(--color-learning-leaf-success);",
    );
    expect(focusRootStyle).toContain(
      "--focus-creative-accent: var(--color-learning-factual-teal);",
    );
    expect(focusRootStyle).toContain(
      "--focus-warm-accent: var(--color-learning-honey-amber);",
    );
    expect(focusShellWorkspaceHeaderStyle).toContain(
      "height: var(--lmd-header-height);",
    );
    expect(focusShellWorkspaceHeaderStyle).toContain(
      "min-height: var(--lmd-header-height);",
    );
    expect(focusShellWorkspaceHeaderStyle).toContain("border-bottom: 0;");
    expect(focusShellActionsStyle).toContain("pointer-events: auto;");
    expect(sharedShellActionsStyle).toContain("margin-left: auto;");
    expect(focusCardStyle).toContain("border: 1px solid var(--focus-line);");
    expect(focusCardStyle).toContain("background: var(--focus-panel);");
    expect(focusCardStyle).toContain("box-shadow: var(--shadow-card);");
    expect(focusSessionPlanNextStyle).toContain(
      "background: var(--focus-green-soft);",
    );
    expect(focusSessionPlanNextStyle).toContain(
      "color: var(--focus-green-strong);",
    );
    expect(secondMetricStyle).toContain(
      "--focus-metric-accent: var(--focus-success-accent);",
    );
    expect(thirdMetricStyle).toContain(
      "--focus-metric-accent: var(--focus-creative-accent);",
    );
    expect(sixthMetricStyle).toContain(
      "--focus-metric-accent: var(--focus-warm-accent);",
    );
  });

  it("keeps workspace page header copy consistent by role", () => {
    const appCss = readFileSync(new URL("../styles/app.css", import.meta.url), {
      encoding: "utf8",
    });
    const pageHeaderCss = readFileSync(
      new URL("./page-header/page-header.css", import.meta.url),
      {
        encoding: "utf8",
      },
    );
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
    const pageHeaderTitleStyle = getCssRules(
      pageHeaderCss,
      ".page-header__title",
    ).join("\n");
    const pageHeaderDescriptionStyle = getCssRules(
      pageHeaderCss,
      ".page-header__description",
    ).join("\n");

    for (const breadcrumbRule of [breadcrumbStyle, recallBreadcrumbStyle]) {
      expect(breadcrumbRule).toContain("color: var(--color-content-muted);");
      expect(breadcrumbRule).toContain("font-family: var(--font-body);");
      expect(breadcrumbRule).toContain("letter-spacing: 0.08em;");
      expect(breadcrumbRule).toContain("text-transform: uppercase;");
    }
    expect(recallBreadcrumbSpanStyle).toContain("color: inherit;");

    expect(pageHeaderTitleStyle).toContain(
      "color: var(--color-content-strong);",
    );
    expect(pageHeaderTitleStyle).toContain("font-family: var(--font-body);");
    expect(pageHeaderTitleStyle).toContain("font-weight: 700;");
    expect(pageHeaderTitleStyle).toContain("letter-spacing: 0;");
    expect(pageHeaderDescriptionStyle).toContain(
      "color: var(--color-content-muted);",
    );
    expect(pageHeaderDescriptionStyle).toContain(
      "font-family: var(--font-body);",
    );
    expect(pageHeaderDescriptionStyle).toContain(
      "font-size: var(--lmd-body-size);",
    );
    expect(pageHeaderDescriptionStyle).toContain(
      "line-height: var(--lmd-body-line-height);",
    );
  });

  it("keeps Study Notes on the shared page header typography contract", () => {
    const studyNotesCss = readFileSync(
      new URL("../modules/study-notes/study-notes.css", import.meta.url),
      "utf8",
    );

    expect(studyNotesCss).not.toMatch(
      /\.study-notes-hero\s+\.page-header__title\s*\{/,
    );
    expect(studyNotesCss).not.toMatch(
      /\.study-notes-hero\s+\.page-header__description\s*\{[^}]*font-size:/,
    );
    expect(studyNotesCss).not.toMatch(
      /\.study-notes-hero\s+\.page-header__description\s*\{[^}]*font-family:/,
    );
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
    const recallWorkspaceStyle = getCssRules(
      recallWorkspacesCss,
      ".recall-workspace",
    ).join("\n");
    const recallShellStyle = getCssRules(
      recallSessionCss,
      ".recall-shell",
    ).join("\n");
    const forgotRatingStyle = getCssRules(
      recallSessionCss,
      ".recall-rating--forgot",
    ).join("\n");
    const hardRatingStyle = getCssRules(
      recallSessionCss,
      ".recall-rating--hard",
    ).join("\n");
    const goodRatingStyle = getCssRules(
      recallSessionCss,
      ".recall-rating--good",
    ).join("\n");
    const easyRatingStyle = getCssRules(
      recallSessionCss,
      ".recall-rating--easy",
    ).join("\n");

    for (const pillStyle of [flashCardPillStyle, aiGradedPillStyle]) {
      expect(pillStyle).toContain("border-color: var(--recall-chip-border);");
      expect(pillStyle).toContain("background: var(--recall-chip-surface);");
      expect(pillStyle).toContain("color: var(--recall-chip-text);");
    }

    for (const recallRootStyle of [recallWorkspaceStyle, recallShellStyle]) {
      expect(recallRootStyle).toContain(
        "--recall-accent-border: var(--color-primary-soft-border);",
      );
      expect(recallRootStyle).toContain(
        "--recall-accent-surface: var(--color-primary-soft);",
      );
      expect(recallRootStyle).toContain(
        "--recall-soft-border: var(--color-content-border-soft);",
      );
      expect(recallRootStyle).toContain(
        "--recall-soft-surface: var(--color-shell-inset);",
      );
    }

    expect(selectedAiGradedTypeStyle).toContain(
      "border-color: var(--recall-accent-border);",
    );
    expect(selectedAiGradedTypeStyle).toContain(
      "background: var(--recall-accent-surface);",
    );
    expect(forgotRatingStyle).toContain(
      "background: var(--color-danger-soft);",
    );
    expect(hardRatingStyle).toContain("background: var(--color-warning-soft);");
    expect(goodRatingStyle).toContain(
      "background: var(--color-secondary-soft);",
    );
    expect(easyRatingStyle).toContain("background: var(--color-success-soft);");
  });

  it("keeps Recall page headers on the shared compact PageHeader layout", () => {
    const recallWorkspacesCss = readFileSync(
      new URL("../modules/recall/recall-workspaces.css", import.meta.url),
      "utf8",
    );
    const recallSurfaceHeaderStyle = getCssRules(
      recallWorkspacesCss,
      ".recall-surface__header",
    ).join("\n");
    const recallSurfaceHeaderCopyStyle = getCssRules(
      recallWorkspacesCss,
      ".recall-surface__header .page-header__copy",
    ).join("\n");
    const recallSelectHeaderCopyStyle = getCssRules(
      recallWorkspacesCss,
      ".recall-select__header .page-header__copy",
    ).join("\n");

    expect(recallSurfaceHeaderStyle).toContain("align-items: flex-start;");
    expect(recallSurfaceHeaderStyle).not.toContain("display: grid;");
    expect(recallSurfaceHeaderCopyStyle).toContain("gap: 0.35rem;");
    expect(recallSelectHeaderCopyStyle).toContain("gap: 0.45rem;");
  });

  it("keeps workspace header actions on the shared button contract", () => {
    const sharedActionsCss = readFileSync(
      new URL("../design-system/shared-actions.css", import.meta.url),
      "utf8",
    );
    const workspaceShellCss = readFileSync(
      new URL(
        "../modules/workspace-shell/workspace-shell.css",
        import.meta.url,
      ),
      "utf8",
    );
    const appFrameActionsStyle = getCssRules(
      workspaceShellCss,
      ".app-frame__actions",
    ).join("\n");
    const headerActionStyle = getCssRules(
      workspaceShellCss,
      ".app-frame__actions .notes-action",
    ).join("\n");
    const sidebarHeaderToggleStyle = getCssRules(
      workspaceShellCss,
      ".sidebar-header-toggle",
    ).join("\n");
    const mobileSidebarToggleStyle = getCssRules(
      workspaceShellCss,
      ".mobile-sidebar-toggle",
    ).join("\n");
    const notesActionStyle = getCssRules(
      sharedActionsCss,
      ".notes-action",
    ).join("\n");

    expect(sharedActionsCss).toContain(
      "--action-control-height: var(--lmd-button-height-md);",
    );
    expect(sharedActionsCss).toContain(
      "--workspace-header-action-width: 10.75rem;",
    );
    expect(notesActionStyle).toContain(
      "min-height: var(--action-control-height);",
    );
    expect(notesActionStyle).toContain(
      "font-size: var(--action-control-font-size);",
    );
    expect(notesActionStyle).toContain("letter-spacing: 0;");
    expect(appFrameActionsStyle).toContain(
      "flex: 0 0 var(--workspace-header-action-width);",
    );
    expect(appFrameActionsStyle).toContain(
      "min-height: var(--action-control-height);",
    );
    expect(headerActionStyle).toContain("width: 100%;");
    expect(sidebarHeaderToggleStyle).toContain(
      "width: var(--action-icon-size);",
    );
    expect(sidebarHeaderToggleStyle).toContain(
      "border-radius: var(--action-control-radius);",
    );
    expect(mobileSidebarToggleStyle).toContain(
      "min-width: var(--action-icon-size);",
    );
    expect(mobileSidebarToggleStyle).toContain(
      "border-radius: var(--action-control-radius);",
    );
  });

  it("keeps authenticated workspace page insets on the shared page layout shell", () => {
    const appCss = readFileSync(new URL("../styles/app.css", import.meta.url), {
      encoding: "utf8",
    });
    const focusCss = readFileSync(
      new URL("../modules/focus/focus-route.css", import.meta.url),
      "utf8",
    );
    const studyNotesCss = readFileSync(
      new URL("../modules/study-notes/study-notes.css", import.meta.url),
      "utf8",
    );
    const studyGuidanceCss = readFileSync(
      new URL("../modules/study-guidance/study-guidance.css", import.meta.url),
      "utf8",
    );
    const recallWorkspacesCss = readFileSync(
      new URL("../modules/recall/recall-workspaces.css", import.meta.url),
      "utf8",
    );
    const sharedPageInsetStyle = getCssRules(
      appCss,
      ".app-shell:has(.authenticated-shell) .app-frame__content > .page-layout",
    ).join("\n");
    const collapsedPageInsetStyle = getCssRules(
      appCss,
      '.authenticated-shell[data-sidebar-state="collapsed"] .app-frame__content > .page-layout',
    ).join("\n");
    const focusRootStyle = getCssRules(focusCss, ".focus-workspace").join("\n");
    const studyNotesRootStyle = getCssRules(
      studyNotesCss,
      ".study-notes-workspace",
    ).join("\n");
    const studyGuidanceRootStyle = getCssRules(
      studyGuidanceCss,
      ".study-guidance-workspace",
    ).join("\n");
    const recallSurfaceStyle = getCssRules(
      recallWorkspacesCss,
      ".recall-surface",
    ).join("\n");

    expect(sharedPageInsetStyle).toContain(
      "padding: var(--workspace-page-block-start) var(--workspace-page-inline)",
    );
    expect(sharedPageInsetStyle).toContain("var(--workspace-page-block-end);");
    expect(collapsedPageInsetStyle).toContain(
      "padding-inline-start: var(--workspace-collapsed-header-offset);",
    );

    for (const routeRootStyle of [
      focusRootStyle,
      studyNotesRootStyle,
      studyGuidanceRootStyle,
      recallSurfaceStyle,
    ]) {
      expect(routeRootStyle).not.toContain("padding: var(--lmd-page-padding");
    }
  });
});
