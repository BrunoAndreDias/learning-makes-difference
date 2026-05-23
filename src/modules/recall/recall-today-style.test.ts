import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function getCssRules(css: string, selector: string) {
  const rulePattern = /([^{}@]+)\{([^{}]*)\}/g;
  const normalizedSelector = selector.replace(/\s+/g, " ").trim();

  return Array.from(css.matchAll(rulePattern)).flatMap((match) => {
    const selectorList = (match[1] ?? "")
      .split(",")
      .map((candidate) => candidate.replace(/\s+/g, " ").trim());

    if (!selectorList.includes(normalizedSelector)) {
      return [];
    }

    return match[2] ?? "";
  });
}

function getCssRule(css: string, selector: string) {
  return getCssRules(css, selector).join("\n");
}

function normalizeCss(css: string) {
  return css
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+/g, " ")
    .trim();
}

function expectRuleToUse(css: string, selector: string, declaration: string) {
  expect(getCssRule(css, selector), selector).toContain(declaration);
}

describe("Recall Today styles", () => {
  it("uses the centered page wrapper and quiet guided-plan rhythm", () => {
    const css = readFileSync(
      new URL("./recall-workspaces.css", import.meta.url),
      "utf8",
    );
    const wrapperStyle = getCssRule(css, ".recall-today-wrapper");
    const surfaceStyle = getCssRule(
      css,
      ".recall-today-page .recall-today-surface",
    );
    const queueStyle = getCssRule(
      css,
      ".recall-today-page .recall-today-queue",
    );
    const priorityStyle = getCssRule(css, ".recall-today-priority");
    const priorityHeadingStyle = getCssRule(
      css,
      ".recall-today-priority__header h3",
    );
    const descriptionStyle = getCssRule(
      css,
      ".recall-today-page .recall-today-hero .page-header__description",
    );
    const summaryStyle = getCssRule(css, ".recall-today-hero__summary");
    const actionsStyle = getCssRule(
      css,
      ".recall-today-page .recall-today-hero__actions",
    );
    const rowTitleStyle = getCssRule(
      css,
      ".recall-today-page .recall-today-row__main strong",
    );

    expect(wrapperStyle).toContain(
      "width: min(100%, var(--workspace-content-width));",
    );
    expect(surfaceStyle).toContain("display: grid;");
    expect(surfaceStyle).toContain("gap: var(--space-7);");
    expect(surfaceStyle).toContain("width: 100%;");
    expect(queueStyle).toContain("width: 100%;");
    expect(queueStyle).not.toMatch(/width:\s*min\(/);
    expect(priorityStyle).toContain(
      "border-left: 2px solid var(--color-warning-soft-border);",
    );
    expect(priorityHeadingStyle).toContain(
      "font-size: var(--lmd-card-title-size);",
    );
    expect(descriptionStyle).toContain("max-width: none;");
    expect(descriptionStyle).toContain("white-space: nowrap;");
    expect(summaryStyle).toContain("white-space: nowrap;");
    expect(actionsStyle).toContain("flex: 0 0 auto;");
    expect(rowTitleStyle).toContain("font-size: var(--lmd-body-size);");
    expect(css).not.toMatch(/\.recall-today-hero \.page-header__title\s*\{/);
  });

  it("keeps priority row actions quiet until hover or keyboard focus", () => {
    const css = readFileSync(
      new URL("./recall-workspaces.css", import.meta.url),
      "utf8",
    );
    const rowStyle = getCssRule(css, ".recall-today-page .recall-today-row");
    const actionStyle = getCssRule(
      css,
      ".recall-today-row__action.notes-action",
    );
    const rowHoverStyle = getCssRule(
      css,
      ".recall-today-page .recall-today-row:hover .recall-today-row__action",
    );
    const rowFocusWithinStyle = getCssRule(
      css,
      ".recall-today-page .recall-today-row:focus-within .recall-today-row__action",
    );
    const actionFocusStyle = getCssRule(
      css,
      ".recall-today-row__action.notes-action:focus-visible",
    );

    expect(rowStyle).toContain("display: grid;");
    expect(rowStyle).toContain("grid-template-columns: minmax(0, 1fr) auto;");
    expect(actionStyle).toContain("background: transparent;");
    expect(actionStyle).toContain("color: var(--color-content-muted);");
    expect(actionStyle).toContain("opacity: 0;");
    expect(rowHoverStyle).toContain("opacity: 1;");
    expect(rowFocusWithinStyle).toContain("opacity: 1;");
    expect(actionFocusStyle).toContain("box-shadow: var(--focus-ring);");
    expect(actionStyle).not.toContain("var(--color-primary");
  });

  it("keeps priority status tones strong enough for small badges and score dots", () => {
    const css = readFileSync(
      new URL("./recall-workspaces.css", import.meta.url),
      "utf8",
    );
    const surfaceStyle = getCssRule(css, ".recall-today-surface");
    const normalizedSurfaceStyle = normalizeCss(surfaceStyle);

    expect(normalizedSurfaceStyle).toContain(
      "--recall-today-practice-emphasis: var(--color-danger-soft-foreground);",
    );
    expect(normalizedSurfaceStyle).toContain(
      "--recall-today-practice-surface: color-mix(in srgb, var(--color-danger-soft) 84%, var(--color-danger-soft-border));",
    );
    expect(normalizedSurfaceStyle).toContain(
      "--recall-today-new-emphasis: color-mix(in srgb, var(--color-warning-hover) 82%, black);",
    );
    expect(normalizedSurfaceStyle).toContain(
      "--recall-today-new-surface: color-mix(in srgb, var(--color-warning-soft) 84%, var(--color-warning-soft-border));",
    );

    for (const selector of [
      '.recall-today-section[data-tone="practice"] .recall-today-section__title h2',
      '.recall-today-section[data-tone="practice"] .recall-today-section__helper',
      '.recall-today-row[data-tone="practice"] .recall-today-row__reason strong',
      '.recall-today-row[data-tone="practice"] .recall-today-row__next strong',
    ]) {
      expectRuleToUse(
        css,
        selector,
        "color: var(--recall-today-practice-emphasis);",
      );
    }

    for (const selector of [
      '.recall-today-section[data-tone="practice"] .recall-today-section__badge',
      '.recall-today-section[data-tone="practice"] .recall-today-section__count',
      '.recall-today-row[data-tone="practice"] .recall-today-row__reason strong',
    ]) {
      expectRuleToUse(
        css,
        selector,
        "background: var(--recall-today-practice-surface);",
      );
    }

    expectRuleToUse(
      css,
      '.recall-today-rating-dots[data-tone="practice"] span[data-active="true"]',
      "background: var(--recall-today-practice-emphasis);",
    );

    for (const selector of [
      '.recall-today-section[data-tone="new"] .recall-today-section__title h2',
      '.recall-today-section[data-tone="new"] .recall-today-section__helper',
      '.recall-today-row[data-tone="new"] .recall-today-row__reason strong',
      '.recall-today-row[data-tone="new"] .recall-today-row__next strong',
    ]) {
      expectRuleToUse(
        css,
        selector,
        "color: var(--recall-today-new-emphasis);",
      );
    }

    for (const selector of [
      '.recall-today-section[data-tone="new"] .recall-today-section__badge',
      '.recall-today-section[data-tone="new"] .recall-today-section__count',
      '.recall-today-row[data-tone="new"] .recall-today-row__reason strong',
    ]) {
      expectRuleToUse(
        css,
        selector,
        "background: var(--recall-today-new-surface);",
      );
    }

    expectRuleToUse(
      css,
      '.recall-today-rating-dots[data-tone="new"] span[data-active="true"]',
      "background: var(--recall-today-new-emphasis);",
    );

    expect(css).not.toContain("#eea29b");
    expect(css).not.toContain("#ef9a91");
    expect(css).not.toContain("#f19c93");
    expect(css).not.toContain("#d9a642");
  });
});
