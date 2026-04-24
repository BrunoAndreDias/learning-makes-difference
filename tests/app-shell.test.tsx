// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { routeTree } from "../src/routeTree.gen";

function renderRoute(initialPath: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [initialPath],
    }),
    defaultPreload: "intent",
    scrollRestoration: true,
  });

  return render(<RouterProvider router={router} />);
}

beforeAll(() => {
  window.scrollTo = vi.fn();
});

describe("authenticated app shell", () => {
  it("renders the shell landmarks, supports sidebar states, and navigates across protected placeholders", async () => {
    renderRoute("/settings");

    const sidebar = await screen.findByRole("complementary", {
      name: "App sidebar",
    });
    const navigation = within(sidebar).getByRole("navigation", {
      name: "App sections",
    });

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      within(sidebar).getByRole("img", { name: "Learning Makes Difference" }),
    ).toBeInTheDocument();

    const notesLink = within(navigation).getByRole("link", {
      name: "Notes",
    });
    const labelsLink = within(navigation).getByRole("link", {
      name: "Labels",
    });
    const recallLink = within(navigation).getByRole("link", {
      name: "Recall",
    });
    const historyLink = within(navigation).getByRole("link", {
      name: "History",
    });
    const settingsLink = within(navigation).getByRole("link", {
      name: "Settings",
    });

    expect(notesLink).toHaveAttribute("href", "/notes");
    expect(labelsLink).toHaveAttribute("href", "/labels");
    expect(recallLink).toHaveAttribute("href", "/recall");
    expect(historyLink).toHaveAttribute("href", "/history");
    expect(settingsLink).toHaveAttribute("aria-current", "page");
    expect(sidebar).toHaveAttribute("data-sidebar-state", "expanded");

    fireEvent.click(labelsLink);

    expect(
      await screen.findByRole("heading", { name: "Labels placeholder" }),
    ).toBeInTheDocument();
    expect(labelsLink).toHaveAttribute("aria-current", "page");

    fireEvent.click(recallLink);

    expect(
      await screen.findByRole("heading", { name: "Recall placeholder" }),
    ).toBeInTheDocument();
    expect(recallLink).toHaveAttribute("aria-current", "page");

    fireEvent.click(
      within(sidebar).getByRole("button", { name: "Collapse sidebar" }),
    );

    expect(sidebar).toHaveAttribute("data-sidebar-state", "collapsed");
    expect(
      within(sidebar).getByRole("button", { name: "Expand sidebar" }),
    ).toBeInTheDocument();

    const mobileToggle = screen.getByRole("button", {
      name: "Open navigation menu",
    });

    expect(mobileToggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(mobileToggle);

    expect(mobileToggle).toHaveAttribute("aria-expanded", "true");
    expect(sidebar).toHaveAttribute("data-mobile-open", "true");

    fireEvent.click(
      screen.getByRole("button", { name: "Close navigation menu" }),
    );

    expect(mobileToggle).toHaveAttribute("aria-expanded", "false");
    expect(sidebar).toHaveAttribute("data-mobile-open", "false");
  });
});
