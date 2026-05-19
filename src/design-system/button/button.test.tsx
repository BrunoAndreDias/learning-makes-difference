// @vitest-environment jsdom

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button, ButtonLink } from "./index";

function renderButtonLink() {
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
  });
  const indexRoute = createRoute({
    component: () => (
      <ButtonLink to="/" variant="primary">
        Open notes
      </ButtonLink>
    ),
    getParentRoute: () => rootRoute,
    path: "/",
  });
  const routeTree = rootRoute.addChildren([indexRoute]);
  const router = createRouter({
    history: createMemoryHistory({
      initialEntries: ["/"],
    }),
    routeTree,
  });

  return render(<RouterProvider router={router} />);
}

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

  it("renders compact controls through the shared size class", () => {
    render(
      <Button size="compact" type="button">
        New
      </Button>,
    );

    expect(
      screen
        .getByRole("button", { name: "New" })
        .classList.contains("notes-action-compact"),
    ).toBe(true);
  });

  it("renders action-styled links through the button module seam", async () => {
    renderButtonLink();

    const link = await screen.findByRole("link", { name: "Open notes" });

    expect(link.classList.contains("notes-action")).toBe(true);
    expect(link.classList.contains("notes-action-primary")).toBe(true);
  });
});
