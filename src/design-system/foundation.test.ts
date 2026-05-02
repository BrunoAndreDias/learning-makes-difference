import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { foundationTokens } from "./tokens.js";

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
    expect(notesEditorCss).toContain(
      "grid-column: notes-inspector-start / notes-inspector-end;",
    );
    expect(notesEditorCss).toContain("grid-row: 1 / span 2;");
    expect(notesResponsiveCss).toContain(".notes-editor__layout,");
    expect(notesResponsiveCss).toContain(".notes-editor__inspector");
    expect(notesResponsiveCss).toContain("grid-template-columns: 1fr;");
  });

  it("preserves the top-aligned notes inspector on larger layouts and unstacks it on mobile", () => {
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

    expect(notesEditorCss).toContain("align-content: start;");
    expect(notesEditorCss).toContain(
      "grid-column: notes-inspector-start / notes-inspector-end;",
    );
    expect(notesResponsiveCss).toContain("@media (max-width: 62rem)");
    expect(notesResponsiveCss).toContain(".notes-form__splitter");
    expect(notesResponsiveCss).toContain("display: none;");
    expect(notesResponsiveCss).toContain(".notes-editor__inspector {");
    expect(notesResponsiveCss).toContain("grid-column: auto;");
    expect(notesResponsiveCss).toContain("grid-row: auto;");
  });
});
