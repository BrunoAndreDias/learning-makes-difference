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
    const rowTitleStyle = getCssRule(css, ".study-guidance-row__header h2");
    const emptyTitleStyle =
      Array.from(
        css.matchAll(
          /\.study-guidance-empty h2,\s*\.study-guidance-idle h2\s*\{([^}]*)\}/g,
        ),
      ).at(-1)?.[1] ?? "";
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
    expect(rowTitleStyle).toContain("font-size: var(--lmd-card-title-size);");
    expect(rowTitleStyle).toContain(
      "line-height: var(--lmd-card-title-line-height);",
    );
    expect(emptyTitleStyle).toContain(
      "font-size: var(--lmd-section-title-size);",
    );
    expect(mobileSummaryListStyle).toContain(
      "grid-template-columns: minmax(0, 1fr);",
    );
    expect(css).not.toContain("study-guidance-workspace__eyebrow");
  });
});
