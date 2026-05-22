import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function getCssRule(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`).exec(css);

  return match?.[1] ?? "";
}

function getLastCssRule(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [
    ...css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g")),
  ];

  return matches.at(-1)?.[1] ?? "";
}

function getMediaRule(css: string, mediaQuery: string, selector: string) {
  const escapedMediaQuery = mediaQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `${escapedMediaQuery}\\s*\\{[\\s\\S]*?${escapedSelector}\\s*\\{([^}]*)\\}`,
  ).exec(css);

  return match?.[1] ?? "";
}

describe("Study Notes styles", () => {
  it("uses a two-column desktop layout without the guidance sidebar", () => {
    const css = readFileSync(
      new URL("./study-notes.css", import.meta.url),
      "utf8",
    );

    const workspaceStyle = getCssRule(css, ".study-notes-workspace");
    const layoutStyle = getCssRule(css, ".study-notes-layout");
    const mediumLayoutStyle = getMediaRule(
      css,
      "@media (max-width: 78rem)",
      ".study-notes-layout",
    );

    expect(workspaceStyle).toContain("margin: 0;");
    expect(workspaceStyle).toContain("max-width: none;");
    expect(layoutStyle).toContain("grid-template-columns:");
    expect(layoutStyle).toContain("minmax(18rem, 19.5rem)");
    expect(layoutStyle).not.toContain("minmax(14.5rem, 18rem)");
    expect(css).not.toContain(".study-notes-guidance-panel");
    expect(mediumLayoutStyle).toContain("minmax(16.5rem, 18.5rem)");
    expect(mediumLayoutStyle).not.toContain("minmax(13.5rem, 16rem)");
    expect(css).toMatch(
      /\.study-notes-workspace \.page-layout__hero,\s*\.study-notes-workspace \.page-layout__body\s*\{[^}]*width: min\(100%, 92rem\);/m,
    );
    expect(css).toMatch(
      /@media \(min-width: 106rem\)\s*\{[\s\S]*?\.study-notes-workspace \.page-layout__hero,\s*\.study-notes-workspace \.page-layout__body\s*\{[^}]*width: min\(100%, 100rem\);/m,
    );
  });

  it("bounds the Study Notes catalog so expanded rows scroll inside the list", () => {
    const css = readFileSync(
      new URL("./study-notes.css", import.meta.url),
      "utf8",
    );

    const workspaceStyle = getCssRule(css, ".study-notes-workspace");
    const layoutStyle = getCssRule(css, ".study-notes-layout");
    const panelStyle = getCssRule(
      css,
      ".study-notes-workspace .notes-list-panel",
    );
    const footerStyle = getCssRule(css, ".study-notes-catalog-footer");
    const listStyle = getCssRule(css, ".study-notes-workspace .notes-list");
    const listItemsStyle = getLastCssRule(
      css,
      ".study-notes-workspace .notes-list__items",
    );
    const expandedListStyle = getCssRule(
      css,
      '.study-notes-workspace\n  .notes-list-panel[data-list-expanded="true"]\n  .notes-list__items',
    );

    expect(workspaceStyle).toContain(
      "grid-template-rows: auto minmax(0, 1fr);",
    );
    expect(layoutStyle).toContain("align-items: stretch;");
    expect(layoutStyle).toContain("overflow: hidden;");
    expect(panelStyle).toContain(
      "grid-template-rows: auto auto minmax(0, 1fr);",
    );
    expect(panelStyle).toContain("align-content: stretch;");
    expect(panelStyle).toContain("height: 100%;");
    expect(panelStyle).toContain("max-height: 100%;");
    expect(panelStyle).toContain("overflow: hidden;");
    expect(footerStyle).toContain("place-items: center;");
    expect(footerStyle).toContain("background: var(--color-shell-panel);");
    expect(listStyle).toContain("height: 100%;");
    expect(listStyle).toContain("align-self: stretch;");
    expect(listStyle).toContain("grid-template-rows: minmax(0, 1fr);");
    expect(listStyle).toContain("max-height: 100%;");
    expect(listStyle).toContain("padding: 0;");
    expect(listStyle).toContain("overflow: hidden;");
    expect(listItemsStyle).toContain("align-self: stretch;");
    expect(listItemsStyle).toContain("height: 100%;");
    expect(expandedListStyle).toContain("overflow-y: auto;");
  });

  it("lets the collapsed Study Notes list scroll instead of clipping a final row", () => {
    const css = readFileSync(
      new URL("./study-notes.css", import.meta.url),
      "utf8",
    );

    const listItemsStyle = getLastCssRule(
      css,
      ".study-notes-workspace .notes-list__items",
    );

    expect(listItemsStyle).toContain("overflow-y: auto;");
    expect(listItemsStyle).toContain("overscroll-behavior: contain;");
  });

  it("keeps the Study Note editor scrollable inside the bounded workspace", () => {
    const css = readFileSync(
      new URL("./study-notes.css", import.meta.url),
      "utf8",
    );

    const desktopEditorStyle = getCssRule(
      css,
      '.app-frame[data-workspace="notes"] .study-notes-editor',
    );
    const studySurfaceStyle = getCssRule(
      css,
      ".study-notes-editor .notes-editor__study-surface",
    );
    const fieldsStyle = getCssRule(css, ".study-notes-editor__fields");
    const fieldChildrenStyle = getCssRule(
      css,
      ".study-notes-editor__fields > *",
    );
    const fieldsSpacerStyle = getCssRule(
      css,
      ".study-notes-editor__fields::after",
    );
    const infoSectionStyle = getCssRule(
      css,
      ".study-notes-editor__info-section",
    );
    const summaryCardStyle = getCssRule(css, ".study-notes-summary-card");
    const recallInsightsStyle = getCssRule(css, ".study-notes-recall-insights");

    expect(desktopEditorStyle).toContain("align-self: stretch;");
    expect(desktopEditorStyle).toContain("height: 100%;");
    expect(desktopEditorStyle).toContain("min-height: 0;");
    expect(desktopEditorStyle).toContain(
      "padding-bottom: calc(var(--space-5) + var(--space-6));",
    );
    expect(desktopEditorStyle).toContain("overflow-y: auto;");
    expect(studySurfaceStyle).toContain("min-height: 100%;");
    expect(fieldsStyle).toContain("min-height: 100%;");
    expect(fieldChildrenStyle).toContain("flex-shrink: 0;");
    expect(fieldsSpacerStyle).toContain("flex: 0 0 var(--space-3);");
    expect(infoSectionStyle).toContain("border: 0;");
    expect(infoSectionStyle).toContain("border-left: 0.2rem solid");
    expect(infoSectionStyle).not.toContain("--study-notes-section-accent");
    expect(summaryCardStyle).toContain("border: 0;");
    expect(summaryCardStyle).not.toContain("--insight-");
    expect(recallInsightsStyle).toContain("margin-top: auto;");
    expect(recallInsightsStyle).toContain("margin-bottom: var(--space-3);");
  });
});
