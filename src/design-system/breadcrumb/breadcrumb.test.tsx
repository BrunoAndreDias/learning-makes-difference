// @vitest-environment jsdom

import { readFileSync } from "node:fs";

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Breadcrumb } from "./breadcrumb";

function renderRouterBreadcrumb() {
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
  });
  const studyNotesRoute = createRoute({
    component: () => <p>Study Notes list</p>,
    getParentRoute: () => rootRoute,
    path: "/study-notes",
  });
  const newStudyNoteRoute = createRoute({
    component: () => (
      <Breadcrumb
        items={[
          { label: "Study Notes", to: "/study-notes" },
          { current: true, label: "New note" },
        ]}
      />
    ),
    getParentRoute: () => rootRoute,
    path: "/study-notes/new",
  });
  const routeTree = rootRoute.addChildren([studyNotesRoute, newStudyNoteRoute]);
  const router = createRouter({
    history: createMemoryHistory({
      initialEntries: ["/study-notes/new"],
    }),
    routeTree,
  });

  return {
    router,
    ...render(<RouterProvider router={router} />),
  };
}

describe("Breadcrumb", () => {
  it("renders router-backed prior items as links and the current page as non-clickable text", async () => {
    const { router } = renderRouterBreadcrumb();

    const breadcrumb = await screen.findByRole("navigation", {
      name: "Breadcrumb",
    });
    const studyNotesLink = within(breadcrumb).getByRole("link", {
      name: "Study Notes",
    });

    expect(studyNotesLink.getAttribute("href")).toBe("/study-notes");
    expect(
      within(breadcrumb).queryByRole("link", { name: "New note" }),
    ).toBeNull();
    expect(
      within(breadcrumb).getByText("New note").getAttribute("aria-current"),
    ).toBe("page");

    await studyNotesLink.click();

    expect(router.state.location.pathname).toBe("/study-notes");
  });

  it("keeps plain href links available for non-router destinations", () => {
    render(
      <Breadcrumb
        items={[
          { href: "/study-notes", label: "Study Notes" },
          { current: true, label: "New note" },
        ]}
      />,
    );

    const breadcrumb = screen.getByRole("navigation", {
      name: "Breadcrumb",
    });
    expect(
      within(breadcrumb)
        .getByRole("link", { name: "Study Notes" })
        .getAttribute("href"),
    ).toBe("/study-notes");
    expect(
      within(breadcrumb).queryByRole("link", { name: "New note" }),
    ).toBeNull();
    expect(
      within(breadcrumb).getByText("New note").getAttribute("aria-current"),
    ).toBe("page");
  });

  it("keeps separator and current page styling centralized", () => {
    const css = readFileSync(
      `${process.cwd()}/src/design-system/breadcrumb/breadcrumb.css`,
      "utf8",
    );
    const hoverRule = css.match(/\.breadcrumb-link:hover\s\{[^}]+\}/)?.[0];
    const currentRule = css.match(/\.breadcrumb-current\s\{[^}]+\}/)?.[0];

    expect(hoverRule).toContain("text-decoration: underline;");
    expect(hoverRule).toContain("color: #3f4943;");
    expect(currentRule).toContain("color: #1f2a23;");
    expect(currentRule).toContain("font-weight: 600;");
  });
});
