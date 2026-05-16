// @vitest-environment jsdom

import { readFileSync } from "node:fs";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders shared page title, description, pretitle content, and actions", () => {
    render(
      <PageHeader
        actions={<button type="button">New Study Note</button>}
        beforeTitle={<nav aria-label="Breadcrumb">Recall / Select</nav>}
        description="Practice targets with reference explanations underneath."
        headingLevel={1}
        title="Study Notes"
      />,
    );

    const header = screen.getByRole("banner");
    expect(
      within(header)
        .getByRole("heading", {
          level: 1,
          name: "Study Notes",
        })
        .classList.contains("page-header__title"),
    ).toBe(true);
    expect(
      within(header)
        .getByText("Practice targets with reference explanations underneath.")
        .classList.contains("page-header__description"),
    ).toBe(true);
    expect(
      within(header).getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeInstanceOf(HTMLElement);
    expect(
      within(header).getByRole("button", { name: "New Study Note" }),
    ).toBeInstanceOf(HTMLButtonElement);
  });

  it("keeps route header typography centralized", () => {
    const css = readFileSync(
      `${process.cwd()}/src/design-system/page-header/page-header.css`,
      "utf8",
    );
    const titleRule = css.match(/\.page-header__title\s\{[^}]+\}/)?.[0];
    const descriptionRule = css.match(
      /\.page-header__description\s\{[^}]+\}/,
    )?.[0];

    expect(titleRule).toContain("color: var(--color-content-strong);");
    expect(titleRule).toContain("font-family: var(--font-body);");
    expect(titleRule).toContain("font-weight: 700;");
    expect(titleRule).toContain("letter-spacing: 0;");
    expect(descriptionRule).toContain("color: var(--color-content-muted);");
    expect(descriptionRule).toContain("font-family: var(--font-body);");
    expect(descriptionRule).toContain("font-size: var(--lmd-body-size);");
    expect(descriptionRule).toContain(
      "line-height: var(--lmd-body-line-height);",
    );
  });
});
