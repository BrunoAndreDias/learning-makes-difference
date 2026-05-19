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
  it("keeps Today as a bucket summary above an ordered next-action list", () => {
    const css = readFileSync(
      new URL("./study-guidance.css", import.meta.url),
      "utf8",
    );
    const summaryListStyle = getCssRule(css, ".study-guidance-summary__list");
    const workspaceStyle = getCssRule(css, ".study-guidance-workspace");
    const planListStyle = getCssRule(css, ".study-guidance-plan__list");
    const rowStyle = getCssRule(css, ".study-guidance-row");
    const mobileSummaryListStyle = getMediaRule(
      css,
      "@media (max-width: 640px)",
      ".study-guidance-summary__list",
    );

    expect(workspaceStyle).toContain("max-width: none;");
    expect(workspaceStyle).toContain("margin: 0;");
    expect(summaryListStyle).toContain(
      "grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));",
    );
    expect(planListStyle).toContain("display: grid;");
    expect(planListStyle).toContain("gap: var(--space-4);");
    expect(rowStyle).toContain("grid-template-columns: minmax(0, 1fr) auto;");
    expect(mobileSummaryListStyle).toContain(
      "grid-template-columns: minmax(0, 1fr);",
    );
  });
});
