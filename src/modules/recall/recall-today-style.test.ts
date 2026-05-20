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
  it("uses shared page spacing and PageHeader typography for Recall Today cards", () => {
    const css = readFileSync(
      new URL("./recall-workspaces.css", import.meta.url),
      "utf8",
    );
    const surfaceStyle = getCssRule(css, ".recall-today-surface");
    const summaryStyle = getCssRule(css, ".recall-today-summary");
    const layoutStyle = getCssRule(css, ".recall-today-layout");
    const queueStyle = getCssRule(css, ".recall-today-queue");
    const sectionStyle = getCssRule(css, ".recall-today-section");
    const sectionTitleStyle = getCssRule(
      css,
      ".recall-today-section__title h2",
    );
    const rowTitleStyle = getCssRule(css, ".recall-today-row__main h3");
    const howTitleStyle = getCssRule(css, ".recall-today-how h2");

    expect(surfaceStyle).toContain("display: grid;");
    expect(surfaceStyle).toContain("gap: var(--lmd-content-gap);");
    expect(summaryStyle).toContain("gap: var(--lmd-list-row-gap);");
    expect(summaryStyle).toContain("padding: var(--lmd-card-padding-compact);");
    expect(layoutStyle).toContain("gap: var(--lmd-content-gap);");
    expect(queueStyle).toContain("gap: var(--lmd-section-gap);");
    expect(sectionStyle).toContain("gap: var(--lmd-card-gap);");
    expect(sectionStyle).toContain("padding: var(--lmd-card-padding-compact);");
    expect(sectionTitleStyle).toContain(
      "font-size: var(--lmd-card-title-size);",
    );
    expect(rowTitleStyle).toContain("font-size: var(--lmd-body-size);");
    expect(howTitleStyle).toContain("font-size: var(--lmd-card-title-size);");
    expect(css).not.toMatch(/\.recall-today-hero \.page-header__title\s*\{/);
    expect(css).not.toMatch(
      /\.recall-today-hero \.page-header__description\s*\{/,
    );
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
