import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function getCssRule(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`).exec(css);

  return match?.[1] ?? "";
}

function getMediaRule(css: string, mediaQuery: string, selector: string) {
  const escapedMediaQuery = mediaQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `${escapedMediaQuery}\\s*\\{[\\s\\S]*?${escapedSelector}\\s*\\{([^}]*)\\}`,
  ).exec(css);

  return match?.[1] ?? "";
}

describe("Study Guidance styling", () => {
  it("keeps the reference layout as a summary strip, recommendation column, and explanatory side panel", () => {
    const css = readFileSync(
      new URL("./study-guidance.css", import.meta.url),
      "utf8",
    );
    const summaryListStyle = getCssRule(css, ".study-guidance-summary__list");
    const statStyle = getCssRule(css, ".study-guidance-stat");
    const contentStyle = getCssRule(css, ".study-guidance-content");
    const sidebarStyle = getCssRule(css, ".study-guidance-sidebar");
    const mobileSummaryListStyle = getMediaRule(
      css,
      "@media (max-width: 640px)",
      ".study-guidance-summary__list",
    );

    expect(summaryListStyle).toContain(
      "grid-template-columns: repeat(4, minmax(0, 1fr));",
    );
    expect(summaryListStyle).toContain(
      "border: 1px solid var(--color-content-border-soft);",
    );
    expect(summaryListStyle).toContain("box-shadow: var(--shadow-card);");
    expect(statStyle).toContain("grid-template-columns: auto minmax(0, 1fr);");
    expect(contentStyle).toContain(
      "grid-template-columns: minmax(0, 2fr) minmax(17rem, 0.75fr);",
    );
    expect(sidebarStyle).toContain("position: sticky;");
    expect(mobileSummaryListStyle).toContain(
      "grid-template-columns: minmax(0, 1fr);",
    );
  });
});
