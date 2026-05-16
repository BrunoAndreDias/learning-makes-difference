import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { foundationTokens } from "./tokens.js";

function getCssRule(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`).exec(css);

  return match?.[1] ?? "";
}

function getRootVariables(css: string) {
  const rootRule = getCssRule(css, ":root");

  return new Map(
    Array.from(rootRule.matchAll(/(--[\w-]+):\s*([^;]+);/g)).map((match) => [
      match[1] ?? "",
      (match[2] ?? "").replace(/\s+/g, " ").trim(),
    ]),
  );
}

function resolveVariable(
  variables: ReadonlyMap<string, string>,
  name: string,
  seen = new Set<string>(),
): string {
  if (seen.has(name)) {
    throw new Error(`Circular CSS variable alias for ${name}`);
  }

  const value = variables.get(name);

  if (value === undefined) {
    throw new Error(`Missing CSS variable ${name}`);
  }

  const alias = /^var\((--[\w-]+)\)$/.exec(value)?.[1];

  if (alias === undefined) {
    return value;
  }

  return resolveVariable(variables, alias, new Set([...seen, name]));
}

function hexToRgb(hex: string) {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);

  if (match === null) {
    throw new Error(`Expected a 6-digit hex color, received ${hex}`);
  }

  return {
    b: Number.parseInt(match[3] ?? "", 16),
    g: Number.parseInt(match[2] ?? "", 16),
    r: Number.parseInt(match[1] ?? "", 16),
  };
}

function toLinearChannel(channel: number) {
  const normalizedChannel = channel / 255;

  if (normalizedChannel <= 0.03928) {
    return normalizedChannel / 12.92;
  }

  return ((normalizedChannel + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance(color: ReturnType<typeof hexToRgb>) {
  return (
    0.2126 * toLinearChannel(color.r) +
    0.7152 * toLinearChannel(color.g) +
    0.0722 * toLinearChannel(color.b)
  );
}

function getContrastRatio(foreground: string, background: string) {
  const foregroundLuminance = getRelativeLuminance(hexToRgb(foreground));
  const backgroundLuminance = getRelativeLuminance(hexToRgb(background));
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function expectContrastAtLeast(
  variables: ReadonlyMap<string, string>,
  foreground: string,
  background: string,
  minimumRatio: number,
) {
  const foregroundValue = resolveVariable(variables, foreground);
  const backgroundValue = resolveVariable(variables, background);

  expect(
    getContrastRatio(foregroundValue, backgroundValue),
    `${foreground} (${foregroundValue}) on ${background} (${backgroundValue})`,
  ).toBeGreaterThanOrEqual(minimumRatio);
}

describe("foundationTokens", () => {
  it("captures the Calm Codex light design-system contract", () => {
    expect(foundationTokens.brand.logoSource).toBe("docs/layout/logo.svg");
    expect(foundationTokens.brand.layoutReferences).toEqual([
      "docs/layout/no_collapse.png",
      "docs/layout/collapsed_menu_withou_focus_mode.png",
    ]);
    expect(foundationTokens.color.shell.canvas).toBe("#f8fafc");
    expect(foundationTokens.color.shell.panel).toBe("#ffffff");
    expect(foundationTokens.color.shell.inset).toBe("#f1f5f9");
    expect(foundationTokens.color.content.strong).toBe("#0f172a");
    expect(foundationTokens.color.content.muted).toBe("#475569");
    expect(foundationTokens.color.content.border).toBe("#cbd5e1");
    expect(foundationTokens.color.content.borderSoft).toBe("#e2e8f0");
    expect(foundationTokens.color.brand.primary).toBe("#2563eb");
    expect(foundationTokens.color.primary.value).toBe("#2563eb");
    expect(foundationTokens.color.secondary.value).toBe("#0f766e");
    expect(foundationTokens.color.accent.value).toBe("#f59e0b");
    expect(foundationTokens.color.accent.strong).toBe("#b45309");
    expect(foundationTokens.color.creative.value).toBe("#7c3aed");
    expect(foundationTokens.color.semantic.danger.value).toBe("#dc2626");
    expect(foundationTokens.typography.body.sizeRem).toBe(1);
    expect(foundationTokens.typography.body.lineHeight).toBe(1.5);
    expect(foundationTokens.focus.outlineWidthPx).toBe(2);
    expect(foundationTokens.focus.outlineOffsetPx).toBe(2);
    expect(foundationTokens.focus.outlineColor).toBe("#0369a1");
    expect(foundationTokens.focus.ringColor).toBe("#38bdf8");
    expect(foundationTokens.spacing[4]).toBe("1rem");
    expect(foundationTokens.radius.lg).toBe("1rem");
    expect(foundationTokens.breakpoints.lg).toBe("72rem");
  });

  it("publishes CSS variables and accessible defaults for the app shell", () => {
    const css = readFileSync(new URL("./global.css", import.meta.url), "utf8");

    expect(css).toContain("--color-neutral-canvas: #f8fafc;");
    expect(css).toContain("--color-neutral-surface: #ffffff;");
    expect(css).toContain("--color-neutral-panel: #f1f5f9;");
    expect(css).toContain("--color-neutral-border: #cbd5e1;");
    expect(css).toContain("--color-neutral-border-soft: #e2e8f0;");
    expect(css).toContain("--color-neutral-ink: #0f172a;");
    expect(css).toContain("--color-neutral-muted: #475569;");
    expect(css).toContain("--color-primary: #2563eb;");
    expect(css).toContain("--color-secondary: #0f766e;");
    expect(css).toContain("--color-accent: #f59e0b;");
    expect(css).toContain("--color-creative: #7c3aed;");
    expect(css).toContain("--color-danger: #dc2626;");
    expect(css).toContain("--color-focus-outline: #0369a1;");
    expect(css).toContain("--color-focus-glow: #38bdf8;");
    expect(css).toContain("--focus-ring: 0 0 0 3px");
    expect(css).toContain("var(--color-focus-glow)");
    expect(css).toContain("font-size: 16px;");
    expect(css).toContain("line-height: 1.5;");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("outline: 2px solid var(--color-focus-outline);");
    expect(css).toContain(".app-shell");
    expect(css).toContain(".surface-card");
  });

  it("keeps compatibility color variables aliased to the Calm Codex palette", () => {
    const css = readFileSync(new URL("./global.css", import.meta.url), "utf8");
    const variables = getRootVariables(css);

    expect(variables.get("--color-brand-primary")).toBe("var(--color-primary)");
    expect(variables.get("--color-brand-primary-hover")).toBe(
      "var(--color-primary-hover)",
    );
    expect(variables.get("--color-brand-primary-soft")).toBe(
      "var(--color-primary-soft)",
    );
    expect(variables.get("--color-shell-canvas")).toBe(
      "var(--color-neutral-canvas)",
    );
    expect(variables.get("--color-shell-panel")).toBe(
      "var(--color-neutral-surface)",
    );
    expect(variables.get("--color-shell-inset")).toBe(
      "var(--color-neutral-panel)",
    );
    expect(variables.get("--color-content-strong")).toBe(
      "var(--color-neutral-ink)",
    );
    expect(variables.get("--color-content-default")).toBe(
      "var(--color-neutral-muted)",
    );
    expect(variables.get("--color-content-muted")).toBe(
      "var(--color-neutral-muted)",
    );
    expect(variables.get("--color-content-border")).toBe(
      "var(--color-neutral-border)",
    );
    expect(variables.get("--color-content-border-soft")).toBe(
      "var(--color-neutral-border-soft)",
    );
    expect(variables.get("--color-accent-success")).toBe(
      "var(--color-success)",
    );
    expect(variables.get("--color-accent-warning")).toBe(
      "var(--color-warning)",
    );
  });

  it("keeps Calm Codex foreground and soft category pairs at WCAG AA contrast", () => {
    const css = readFileSync(new URL("./global.css", import.meta.url), "utf8");
    const variables = getRootVariables(css);

    expectContrastAtLeast(
      variables,
      "--color-content-strong",
      "--color-shell-canvas",
      4.5,
    );
    expectContrastAtLeast(
      variables,
      "--color-content-muted",
      "--color-shell-canvas",
      4.5,
    );
    expectContrastAtLeast(
      variables,
      "--color-primary",
      "--color-primary-foreground",
      4.5,
    );
    expectContrastAtLeast(
      variables,
      "--color-secondary",
      "--color-secondary-foreground",
      4.5,
    );
    expectContrastAtLeast(
      variables,
      "--color-creative",
      "--color-creative-foreground",
      4.5,
    );

    for (const semanticPair of [
      ["--color-success", "--color-success-foreground"],
      ["--color-warning", "--color-warning-foreground"],
      ["--color-danger", "--color-danger-foreground"],
      ["--color-danger-soft-foreground", "--color-danger-soft"],
    ] as const) {
      expectContrastAtLeast(variables, semanticPair[0], semanticPair[1], 4.5);
    }

    expectContrastAtLeast(
      variables,
      "--color-accent-foreground",
      "--color-accent",
      4.5,
    );

    for (const softPair of [
      ["--color-primary-soft-foreground", "--color-primary-soft"],
      ["--color-secondary-soft-foreground", "--color-secondary-soft"],
      ["--color-accent-soft-foreground", "--color-accent-soft"],
      ["--color-creative-soft-foreground", "--color-creative-soft"],
      ["--color-success-soft-foreground", "--color-success-soft"],
      ["--color-warning-soft-foreground", "--color-warning-soft"],
    ] as const) {
      expectContrastAtLeast(variables, softPair[0], softPair[1], 4.5);
    }
  });

  it("keeps the app sidebar account row pinned above the flexible notes body", () => {
    const css = readFileSync(
      new URL(
        "../modules/workspace-shell/workspace-shell.css",
        import.meta.url,
      ),
      "utf8",
    );

    expect(css).toContain("grid-template-rows: auto auto minmax(0, 1fr);");
    expect(css).toContain("align-content: start;");
  });

  it("keeps the authenticated shell connected instead of framed as cards", () => {
    const css = readFileSync(
      new URL(
        "../modules/workspace-shell/workspace-shell.css",
        import.meta.url,
      ),
      "utf8",
    );

    expect(css).toContain("padding: 0;");
    expect(css).toContain("gap: 0;");
    expect(css).toContain("border-right: 1px solid");
    expect(css).toContain("border-radius: 0;");
    expect(css).toContain("box-shadow: none;");
    expect(css).toContain("min-height: 100vh;");
  });

  it("keeps the promoted notes workspace from reserving the old catalog column", () => {
    const css = readFileSync(
      new URL(
        "../modules/notes/notes-workspace/notes-responsive.css",
        import.meta.url,
      ),
      "utf8",
    );

    expect(css).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(css).not.toContain("minmax(15.5rem, 17.5rem)");
  });

  it("keeps the promoted notes title row aligned with the toolbar controls", () => {
    const workspaceShellCss = readFileSync(
      new URL(
        "../modules/workspace-shell/workspace-shell.css",
        import.meta.url,
      ),
      "utf8",
    );
    const notesResponsiveCss = readFileSync(
      new URL(
        "../modules/notes/notes-workspace/notes-responsive.css",
        import.meta.url,
      ),
      "utf8",
    );

    expect(workspaceShellCss).toContain("align-items: flex-start;");
    expect(workspaceShellCss).toContain(
      "padding-block: var(--lmd-list-row-padding-y);",
    );
    expect(workspaceShellCss).toContain("transform: translateY(0.1875rem);");
    expect(notesResponsiveCss).toContain("align-items: start;");
  });

  it("aligns the Notes page header copy with the in-page card column", () => {
    const appCss = readFileSync(new URL("../styles/app.css", import.meta.url), {
      encoding: "utf8",
    });
    const notesHeaderRule = getCssRule(
      appCss,
      ".app-shell:has(.authenticated-shell) .notes-workspace__page-header",
    );

    expect(notesHeaderRule).toContain(
      "padding-inline: var(--notes-workspace-inline-start)\n" +
        "    var(--notes-workspace-inline-end);",
    );
    expect(notesHeaderRule).toContain(
      "padding-block-start: var(--workspace-page-block-start);",
    );
    expect(appCss).toContain(
      "--notes-workspace-inline-start: var(--notes-workspace-inline);",
    );
    expect(appCss).toContain(
      "--notes-workspace-inline-end: var(--notes-workspace-inline);",
    );
  });

  it("keeps the notes inspector aligned with the editor header while mobile stays stacked", () => {
    const notesEditorCss = readFileSync(
      new URL(
        "../modules/notes/notes-workspace/notes-editor-route.css",
        import.meta.url,
      ),
      "utf8",
    );
    const notesResponsiveCss = readFileSync(
      new URL(
        "../modules/notes/notes-workspace/notes-responsive.css",
        import.meta.url,
      ),
      "utf8",
    );
    const desktopNotesLayoutRule = getCssRule(
      notesEditorCss,
      '.app-frame[data-workspace="notes"] .notes-layout',
    );

    expect(notesEditorCss).toContain(".notes-editor__layout");
    expect(notesEditorCss).toContain("align-content: start;");
    expect(notesEditorCss).toContain(
      "padding: 0 var(--notes-workspace-inline-end) var(--lmd-page-padding-y)\n" +
        "    var(--notes-workspace-inline-start);",
    );
    expect(notesEditorCss).toContain(
      '.app-frame[data-workspace="notes"] .notes-list-panel',
    );
    expect(desktopNotesLayoutRule).toContain("height: 100%;");
    expect(desktopNotesLayoutRule).toContain("max-height: 100%;");
    expect(notesEditorCss).toContain("height: 100%;");
    expect(notesEditorCss).toContain("max-height: 100%;");
    expect(notesResponsiveCss).toContain(".notes-editor__layout,");
    expect(notesResponsiveCss).toContain(".notes-editor__inspector");
    expect(notesResponsiveCss).toContain("grid-template-columns: 1fr;");
    expect(notesResponsiveCss).toContain(".notes-form__splitter");
    expect(notesResponsiveCss).toContain("display: none;");
    expect(notesResponsiveCss).toContain("grid-column: auto;");
    expect(notesResponsiveCss).toContain("grid-row: auto;");
  });

  it("keeps Recall Results fixed-height with internal result scrolling", () => {
    const workspaceShellCss = readFileSync(
      new URL(
        "../modules/workspace-shell/workspace-shell.css",
        import.meta.url,
      ),
      "utf8",
    );
    const recallWorkspaceCss = readFileSync(
      new URL("../modules/recall/recall-workspaces.css", import.meta.url),
      "utf8",
    );
    const recallResponsiveCss = readFileSync(
      new URL("../modules/recall/recall-responsive.css", import.meta.url),
      "utf8",
    );
    const listCardCss = readFileSync(
      new URL("./list-card/list-card.css", import.meta.url),
      "utf8",
    );

    expect(workspaceShellCss).toContain(
      '.app-frame[data-workspace="recall-results"] {',
    );
    expect(workspaceShellCss).toContain("height: calc(100dvh - 2rem);");
    expect(workspaceShellCss).toContain(
      '.app-frame[data-workspace="recall-results"] .app-frame__content',
    );
    expect(recallWorkspaceCss).toContain(
      '.app-frame[data-workspace="recall-results"] .recall-results-surface',
    );
    expect(recallWorkspaceCss).toContain(
      "grid-template-rows: auto minmax(0, 1fr);",
    );
    expect(recallWorkspaceCss).toContain(
      '.app-frame[data-workspace="recall-results"] .recall-results-master',
    );
    expect(recallWorkspaceCss).toContain(
      "grid-template-rows: auto auto auto minmax(0, 1fr);",
    );
    expect(recallWorkspaceCss).toContain(
      '.app-frame[data-workspace="recall-results"] .recall-results-list',
    );
    expect(recallWorkspaceCss).toContain(".recall-results-list-frame");
    expect(
      getCssRule(recallWorkspaceCss, ".recall-results-list-frame"),
    ).not.toContain("border:");
    expect(
      getCssRule(recallWorkspaceCss, ".recall-results-list-frame"),
    ).not.toContain("border-radius:");
    expect(
      getCssRule(recallWorkspaceCss, ".recall-results-list-frame"),
    ).not.toContain("background:");
    expect(recallWorkspaceCss).toContain("align-content: start;");
    expect(recallWorkspaceCss).toContain("gap: 0.5rem;");
    expect(recallWorkspaceCss).not.toContain(".recall-result-row {");
    expect(listCardCss).toContain(".list-card {");
    expect(getCssRule(listCardCss, ".list-card")).toContain(
      "grid-template-columns: minmax(0, 1fr) auto;",
    );
    expect(getCssRule(listCardCss, ".list-card__description")).toContain(
      "overflow-wrap: anywhere;",
    );
    expect(getCssRule(listCardCss, ".list-card__chip")).toContain(
      "align-self: start;",
    );
    expect(
      getCssRule(listCardCss, '.list-card[data-selected="true"]'),
    ).toContain("box-shadow: inset 0 0 0 1px");
    expect(recallWorkspaceCss).toContain(".recall-results-count");
    expect(recallWorkspaceCss).not.toContain(
      ".recall-results-list li + li .recall-result-row",
    );
    expect(recallWorkspaceCss).toContain("max-height: none;");
    expect(recallWorkspaceCss).toContain("overflow-y: auto;");
    expect(recallResponsiveCss).toContain(
      "grid-template-rows: minmax(0, 0.95fr) minmax(0, 1.05fr);",
    );
  });
});
