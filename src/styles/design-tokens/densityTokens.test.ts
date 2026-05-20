import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { densityTokens } from "./densityTokens.js";

function getRootVariables(css: string) {
  const rootRule = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

  return new Map(
    Array.from(rootRule.matchAll(/(--[\w-]+):\s*([^;]+);/g)).map((match) => [
      match[1] ?? "",
      (match[2] ?? "").replace(/\s+/g, " ").trim(),
    ]),
  );
}

describe("desktop density tokens", () => {
  it("publishes the compact desktop density contract to TypeScript and CSS", () => {
    expect(densityTokens.desktop.page).toEqual({
      contentGap: "20px",
      headerHeight: "56px",
      paddingX: "28px",
      paddingY: "20px",
      sectionGap: "18px",
    });
    expect(densityTokens.desktop.sidebar).toEqual({
      footerCardHeight: "72px",
      navItemGap: "8px",
      navItemHeight: "48px",
      paddingX: "16px",
      paddingY: "18px",
      width: "236px",
    });
    expect(densityTokens.desktop.card.radius).toBe("14px");
    expect(densityTokens.desktop.list.rowHeight).toBe("72px");
    expect(densityTokens.desktop.form.inputHeight).toBe("44px");
    expect(densityTokens.desktop.typography.pageTitle).toEqual({
      fontSize: "32px",
      lineHeight: "38px",
    });

    const css = readFileSync(
      new URL("../../design-system/global.css", import.meta.url),
      "utf8",
    );
    const variables = getRootVariables(css);

    expect(variables.get("--lmd-page-padding-x")).toBe("28px");
    expect(variables.get("--lmd-page-padding-y")).toBe("20px");
    expect(variables.get("--lmd-header-height")).toBe("56px");
    expect(variables.get("--lmd-content-gap")).toBe("20px");
    expect(variables.get("--lmd-section-gap")).toBe("18px");
    expect(variables.get("--lmd-sidebar-width")).toBe("236px");
    expect(variables.get("--lmd-sidebar-nav-item-height")).toBe("48px");
    expect(variables.get("--lmd-card-padding")).toBe("18px");
    expect(variables.get("--lmd-card-padding-compact")).toBe("14px");
    expect(variables.get("--lmd-list-row-height")).toBe("72px");
    expect(variables.get("--lmd-list-row-height-compact")).toBe("64px");
    expect(variables.get("--lmd-input-height")).toBe("44px");
    expect(variables.get("--lmd-textarea-min-height")).toBe("88px");
    expect(variables.get("--lmd-button-height-md")).toBe("42px");
    expect(variables.get("--lmd-chip-height")).toBe("24px");
    expect(variables.get("--lmd-icon-circle-md")).toBe("44px");
    expect(variables.get("--lmd-page-title-size")).toBe("32px");
    expect(variables.get("--lmd-body-line-height")).toBe("21px");
  });

  it("applies density variables to the desktop workspace surfaces", () => {
    const appCss = readFileSync(new URL("../app.css", import.meta.url), "utf8");
    const workspaceShellCss = readFileSync(
      new URL(
        "../../modules/workspace-shell/workspace-shell.css",
        import.meta.url,
      ),
      "utf8",
    );
    const sharedActionsCss = readFileSync(
      new URL("../../design-system/shared-actions.css", import.meta.url),
      "utf8",
    );
    const listCardCss = readFileSync(
      new URL("../../design-system/list-card/list-card.css", import.meta.url),
      "utf8",
    );
    const pageHeaderCss = readFileSync(
      new URL(
        "../../design-system/page-header/page-header.css",
        import.meta.url,
      ),
      "utf8",
    );
    const notesEditorCss = readFileSync(
      new URL(
        "../../modules/notes/notes-workspace/notes-editor-route.css",
        import.meta.url,
      ),
      "utf8",
    );

    expect(appCss).toContain(
      "--workspace-page-inline: var(--lmd-page-padding-x);",
    );
    expect(appCss).toContain(
      "--workspace-page-block-start: var(--lmd-page-padding-y);",
    );
    expect(workspaceShellCss).toContain(
      "--authenticated-sidebar-width: var(--lmd-sidebar-width);",
    );
    expect(workspaceShellCss).toContain(
      "padding: var(--lmd-sidebar-padding-y) var(--lmd-sidebar-padding-x);",
    );
    expect(workspaceShellCss).toContain(
      "min-height: var(--lmd-sidebar-nav-item-height);",
    );
    expect(workspaceShellCss).toContain(
      "grid-template-rows: var(--lmd-header-height) minmax(0, 1fr);",
    );
    expect(sharedActionsCss).toContain(
      "--action-control-height: var(--lmd-button-height-md);",
    );
    expect(listCardCss).toContain(
      "min-height: var(--lmd-list-row-height-compact);",
    );
    expect(pageHeaderCss).toContain("font-size: var(--lmd-page-title-size);");
    expect(notesEditorCss).toContain(
      "grid-template-rows: auto minmax(0, 1fr) auto;",
    );
    expect(notesEditorCss).toContain(
      "min-height: var(--lmd-list-row-height-compact);",
    );
    expect(notesEditorCss).toContain(
      "min-height: var(--lmd-textarea-min-height);",
    );
  });

  it("applies density variables to Recall workspace surfaces", () => {
    const appCss = readFileSync(new URL("../app.css", import.meta.url), "utf8");
    const recallCss = readFileSync(
      new URL("../../modules/recall/recall-workspaces.css", import.meta.url),
      "utf8",
    );

    expect(appCss).toContain(
      "> .recall-workspace:not(.page-layout) {\n  padding: var(--workspace-page-block-start) var(--workspace-page-inline)\n    var(--workspace-page-block-end);",
    );
    expect(recallCss).toContain("gap: var(--lmd-content-gap);");
    expect(recallCss).toContain("padding: var(--lmd-card-padding-compact);");
    expect(recallCss).toContain("min-height: var(--lmd-input-height);");
    expect(recallCss).toContain("min-height: var(--lmd-button-height-md);");
    expect(recallCss).toContain(
      "min-height: var(--lmd-list-row-height-compact);",
    );
  });

  it("applies density variables to Study Notes workspace surfaces", () => {
    const appCss = readFileSync(new URL("../app.css", import.meta.url), "utf8");
    const studyNotesCss = readFileSync(
      new URL("../../modules/study-notes/study-notes.css", import.meta.url),
      "utf8",
    );

    expect(appCss).toContain(
      ".notes-workspace__page-header {\n  padding-inline: var(--notes-workspace-inline-start)\n    var(--notes-workspace-inline-end);\n  padding-block-start: var(--workspace-page-block-start);",
    );
    expect(studyNotesCss).toContain("gap: var(--lmd-content-gap);");
    expect(studyNotesCss).toContain("min-height: var(--lmd-button-height-md);");
    expect(studyNotesCss).toContain("height: var(--lmd-input-height);");
    expect(studyNotesCss).toContain("min-height: var(--lmd-list-row-height);");
    expect(studyNotesCss).toContain("padding: var(--lmd-card-padding);");
  });
});
