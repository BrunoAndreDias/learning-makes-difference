// @vitest-environment jsdom

import { readFileSync } from "node:fs";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ListCard } from "./list-card";

describe("ListCard", () => {
  it("renders one title, multi-line description content, and a top-right chip", () => {
    render(
      <ListCard
        chip="Due"
        description={
          <>
            <span>Not recalled yet</span>
            <span>Due for Recall</span>
          </>
        }
        title="Cell respiration"
      />,
    );

    const card = screen.getByRole("button", { name: /Cell respiration/i });

    expect(card.classList.contains("list-card")).toBe(true);
    expect(
      within(card)
        .getByText("Cell respiration")
        .classList.contains("list-card__title"),
    ).toBe(true);
    expect(within(card).getByText("Not recalled yet")).toBeInstanceOf(
      HTMLElement,
    );
    expect(within(card).getByText("Due for Recall")).toBeInstanceOf(
      HTMLElement,
    );
    expect(
      within(card).getByText("Due").classList.contains("list-card__chip"),
    ).toBe(true);
  });

  it("marks selected cards without changing their accessible role", () => {
    render(
      <ListCard
        aria-pressed="true"
        chip="FlashCard"
        description="9:00 AM"
        selected
        title="May 7, 2026"
      />,
    );

    const card = screen.getByRole("button", { name: /May 7, 2026/i });

    expect(card.getAttribute("data-selected")).toBe("true");
    expect(card.getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps descriptions able to wrap across many lines", () => {
    const css = readFileSync(
      `${process.cwd()}/src/design-system/list-card.css`,
      "utf8",
    );
    const descriptionRule = css.match(
      /\.list-card__description\s\{[^}]+\}/,
    )?.[0];

    expect(descriptionRule).toContain("display: grid;");
    expect(descriptionRule).toContain("line-height: 1.35;");
    expect(descriptionRule).toContain("overflow-wrap: anywhere;");
    expect(descriptionRule).not.toContain("white-space: nowrap;");
    expect(descriptionRule).not.toContain("line-clamp");
  });
});
