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

    const layoutStyle = getCssRule(css, ".study-notes-layout");
    const mediumLayoutStyle = getMediaRule(
      css,
      "@media (max-width: 78rem)",
      ".study-notes-layout",
    );

    expect(layoutStyle).toContain("grid-template-columns:");
    expect(layoutStyle).toContain("minmax(19rem, 22.25rem)");
    expect(layoutStyle).not.toContain("minmax(14.5rem, 18rem)");
    expect(css).not.toContain(".study-notes-guidance-panel");
    expect(mediumLayoutStyle).toContain("minmax(16rem, 19rem)");
    expect(mediumLayoutStyle).not.toContain("minmax(13.5rem, 16rem)");
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
    expect(panelStyle).toContain("overflow: hidden;");
    expect(footerStyle).toContain("place-items: center;");
    expect(footerStyle).toContain("background: var(--color-shell-panel);");
    expect(listStyle).toContain("overflow: hidden;");
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

    expect(desktopEditorStyle).toContain("align-self: stretch;");
    expect(desktopEditorStyle).toContain("height: 100%;");
    expect(desktopEditorStyle).toContain("min-height: 0;");
    expect(desktopEditorStyle).toContain(
      "padding-bottom: calc(var(--lmd-card-padding) + var(--space-6));",
    );
    expect(desktopEditorStyle).toContain("overflow-y: auto;");
  });
});
