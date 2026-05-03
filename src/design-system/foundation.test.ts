import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { foundationTokens } from "./tokens.js";

function getCssRule(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`).exec(css);

  return match?.[1] ?? "";
}

describe("foundationTokens", () => {
  it("captures the issue 14 design-system contract from docs/layout", () => {
    expect(foundationTokens.brand.logoSource).toBe("docs/layout/logo.svg");
    expect(foundationTokens.brand.layoutReferences).toEqual([
      "docs/layout/no_collapse.png",
      "docs/layout/collapsed_menu_withou_focus_mode.png",
    ]);
    expect(foundationTokens.color.shell.canvas).toBe("#f7f4ea");
    expect(foundationTokens.color.brand.primary).toBe("#2563eb");
    expect(foundationTokens.typography.body.sizeRem).toBe(1);
    expect(foundationTokens.typography.body.lineHeight).toBe(1.5);
    expect(foundationTokens.focus.outlineWidthPx).toBe(3);
    expect(foundationTokens.focus.outlineOffsetPx).toBe(3);
    expect(foundationTokens.spacing[4]).toBe("1rem");
    expect(foundationTokens.radius.lg).toBe("1rem");
    expect(foundationTokens.breakpoints.lg).toBe("72rem");
  });

  it("publishes CSS variables and accessible defaults for the app shell", () => {
    const css = readFileSync(new URL("./global.css", import.meta.url), "utf8");

    expect(css).toContain("--color-shell-canvas: #f7f4ea;");
    expect(css).toContain("--color-brand-primary: #2563eb;");
    expect(css).toContain("--focus-ring: 0 0 0 3px rgba(37, 99, 235, 0.35);");
    expect(css).toContain("font-size: 16px;");
    expect(css).toContain("line-height: 1.5;");
    expect(css).toContain(":focus-visible");
    expect(css).toContain(".app-shell");
    expect(css).toContain(".surface-card");
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
    expect(workspaceShellCss).toContain("padding-block: 0.875rem;");
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
      "padding-inline: var(--notes-workspace-inline);",
    );
    expect(notesHeaderRule).toContain(
      "padding-block-start: var(--workspace-page-block-start);",
    );
    expect(appCss).toContain(
      "--notes-workspace-inline: var(--workspace-collapsed-header-offset);",
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

    expect(notesEditorCss).toContain(".notes-editor__layout");
    expect(notesEditorCss).toContain("align-content: start;");
    expect(notesEditorCss).toContain(
      '.app-frame[data-workspace="notes"] .notes-list-panel',
    );
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
    expect(recallWorkspaceCss).toContain("border-left-width: 0.1875rem;");
    expect(recallWorkspaceCss).toContain("border-radius: 0.45rem;");
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
