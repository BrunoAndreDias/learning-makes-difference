// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders design-system action classes by variant", () => {
    render(
      <Button type="button" variant="primary">
        Save
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Save" });

    expect(button.classList.contains("notes-action")).toBe(true);
    expect(button.classList.contains("notes-action-primary")).toBe(true);
  });

  it("renders icon-only buttons on the shared icon action class", () => {
    render(
      <Button aria-label="Open menu" iconOnly type="button">
        <span aria-hidden="true">Menu</span>
      </Button>,
    );

    expect(
      screen
        .getByRole("button", { name: "Open menu" })
        .classList.contains("notes-icon-button"),
    ).toBe(true);
  });
});
