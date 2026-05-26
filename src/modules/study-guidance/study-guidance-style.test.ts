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
    const planStyle = getCssRule(css, ".study-guidance-plan");
    const planListStyle = getCssRule(css, ".study-guidance-plan__list");
    const rowStyle = getCssRule(css, ".study-guidance-row");
    const planHeadingStyle = getCssRule(css, ".study-guidance-plan::before");
    const rowActionStyle = getCssRule(
      css,
      ".study-guidance-workspace .study-guidance-row__action .notes-action",
    );
    const readinessDescriptionStyle = getCssRule(
      css,
      ".study-guidance-readiness__description",
    );
    const readinessRowStyle =
      css.match(
        /(?:^|\n)\.study-guidance-readiness__row\s*\{([^}]*)\}/m,
      )?.[1] ?? "";
    const rowTitleStyle = getCssRule(css, ".study-guidance-row__header h2");
    const emptyTitleStyle =
      Array.from(
        css.matchAll(
          /\.study-guidance-empty h2,\s*\.study-guidance-idle h2\s*\{([^}]*)\}/g,
        ),
      ).at(-1)?.[1] ?? "";
    const mobileSummaryListStyle = getMediaRule(
      css,
      "@media (max-width: 42rem)",
      ".study-guidance-summary__list",
    );
    const smallLaptopSummaryListStyle = getMediaRule(
      css,
      "@media (max-width: 78rem)",
      ".study-guidance-summary__list",
    );
    const smallLaptopRowStyle = getMediaRule(
      css,
      "@media (max-width: 78rem)",
      ".study-guidance-row",
    );
    const smallLaptopPlanStyle = getMediaRule(
      css,
      "@media (max-width: 78rem)",
      ".study-guidance-plan",
    );
    const compactRowStyle = getMediaRule(
      css,
      "@media (max-width: 58rem)",
      ".study-guidance-row",
    );
    const compactReadinessRowStyle = getMediaRule(
      css,
      "@media (max-width: 58rem)",
      ".study-guidance-readiness__row",
    );

    expect(workspaceStyle).toContain("max-width: none;");
    expect(workspaceStyle).toContain("margin: 0;");
    expect(summaryListStyle).toContain(
      "grid-template-columns: repeat(3, minmax(0, 1fr));",
    );
    expect(smallLaptopSummaryListStyle).toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr));",
    );
    expect(planStyle).toContain("--study-guidance-row-bucket-column: 11.5rem;");
    expect(planStyle).toContain("--study-guidance-row-action-column: 13.5rem;");
    expect(planListStyle).toContain("display: grid;");
    expect(planListStyle).toContain("gap: 0;");
    expect(planListStyle).toContain(
      "border: 1px solid var(--color-content-border-soft);",
    );
    expect(planHeadingStyle).toContain('content: "Prioritized next actions";');
    expect(rowStyle).toContain("grid-template-columns:");
    expect(rowStyle).toContain("var(--study-guidance-row-bucket-column)");
    expect(rowStyle).toContain("var(--study-guidance-row-action-column)");
    expect(readinessDescriptionStyle).toContain("width: min(100%, 42rem);");
    expect(readinessRowStyle).toContain(
      "var(--study-guidance-row-bucket-column)",
    );
    expect(readinessRowStyle).toContain(
      "var(--study-guidance-row-action-column)",
    );
    expect(rowActionStyle).toContain("width: 100%;");
    expect(rowTitleStyle).toContain("font-size: var(--lmd-card-title-size);");
    expect(rowTitleStyle).toContain(
      "line-height: var(--lmd-card-title-line-height);",
    );
    expect(compactRowStyle).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(compactReadinessRowStyle).toContain(
      "grid-template-columns: minmax(0, 1fr);",
    );
    expect(smallLaptopRowStyle).toContain(
      "var(--study-guidance-row-bucket-column)",
    );
    expect(smallLaptopPlanStyle).toContain(
      "--study-guidance-row-bucket-column: 10.5rem;",
    );
    expect(smallLaptopPlanStyle).toContain(
      "--study-guidance-row-action-column: 12rem;",
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
