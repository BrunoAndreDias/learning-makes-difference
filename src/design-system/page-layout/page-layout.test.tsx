// @vitest-environment jsdom

import { readFileSync } from "node:fs";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageLayout } from "./page-layout";

describe("PageLayout", () => {
  it("renders shared page chrome with optional chrome above and below the header", () => {
    render(
      <PageLayout
        actions={<button type="button">Open next repair</button>}
        afterHeader={<p role="status">Saved</p>}
        aria-label="Practice Repair Queue"
        beforeHeader={<nav aria-label="Page tabs">Tabs</nav>}
        description="Resume the newest repair work."
        headingLevel={1}
        title="Practice Repair Queue"
      >
        <section aria-label="Repair candidates">Candidates</section>
      </PageLayout>,
    );

    const page = screen.getByRole("region", { name: "Practice Repair Queue" });
    expect(
      within(page)
        .getByRole("heading", {
          level: 1,
          name: "Practice Repair Queue",
        })
        .classList.contains("page-header__title"),
    ).toBe(true);
    expect(
      within(page)
        .getByText("Resume the newest repair work.")
        .classList.contains("page-header__description"),
    ).toBe(true);
    expect(
      within(page).getByRole("navigation", { name: "Page tabs" }),
    ).toBeInstanceOf(HTMLElement);
    expect(
      within(page).getByRole("button", { name: "Open next repair" }),
    ).toBeInstanceOf(HTMLButtonElement);
    expect(within(page).getByRole("status").textContent).toContain("Saved");
    expect(
      within(page).getByRole("region", { name: "Repair candidates" }),
    ).toBeInstanceOf(HTMLElement);
  });

  it("centralizes page body spacing and palette", () => {
    const css = readFileSync(
      `${process.cwd()}/src/design-system/page-layout/page-layout.css`,
      "utf8",
    );
    const pageLayoutRule = css.match(/\.page-layout\s\{[^}]+\}/)?.[0];
    const bodyRule = css.match(/\.page-layout__body\s\{[^}]+\}/)?.[0];

    expect(pageLayoutRule).toContain("gap: var(--lmd-content-gap);");
    expect(pageLayoutRule).toContain("background: var(--color-shell-panel);");
    expect(pageLayoutRule).toContain("color: var(--color-content-default);");
    expect(pageLayoutRule).toContain("font-family: var(--font-body);");
    expect(bodyRule).toContain("gap: var(--lmd-content-gap);");
    expect(bodyRule).toContain("min-height: 0;");
  });
});
