// @vitest-environment jsdom

import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AppPersistentStudyNotesContext } from "../../modules/study-notes";
import { renderRoute } from "./app-shell-test-support";

function createPendingPersistentStudyNotesContext(): AppPersistentStudyNotesContext {
  const snapshot = [] as const;

  return {
    createStudyNote: vi.fn(async () => {
      throw new Error("not used");
    }),
    createStudyNoteFromSource: vi.fn(async () => {
      throw new Error("not used");
    }),
    deleteStudyNote: vi.fn(async () => {
      throw new Error("not used");
    }),
    getSnapshot: () => snapshot,
    refresh: vi.fn(
      () =>
        new Promise<readonly []>(() => {
          return undefined;
        }),
    ),
    removeLabelAssignments: vi.fn(),
    subscribe: () => () => undefined,
    updateStudyNote: vi.fn(async () => {
      throw new Error("not used");
    }),
  };
}

const authenticatedReadinessRoutes = [
  {
    label: "Preparing Study Guidance",
    name: "Today",
    path: "/today",
  },
  {
    label: "Preparing Study Notes",
    name: "Study Notes",
    path: "/study-notes",
  },
  {
    label: "Preparing Recall Today",
    name: "Recall",
    path: "/recall",
  },
  {
    label: "Preparing Practice Repair queue",
    name: "Practice Repair",
    path: "/practice-repair",
  },
  {
    label: "Preparing Focus",
    name: "Focus",
    path: "/focus",
  },
  {
    label: "Preparing Settings",
    name: "Settings",
    path: "/settings",
  },
] as const;

const publicRoutes = [
  {
    heading: "Welcome back",
    path: "/",
  },
  {
    heading: "Welcome back",
    path: "/login",
  },
  {
    heading: "Create your account",
    path: "/register",
  },
  {
    heading: "Reset your password",
    path: "/forgot-password",
  },
] as const;

describe("authenticated route readiness coverage", () => {
  it.each(
    authenticatedReadinessRoutes,
  )("keeps the authenticated shell visible while the $name route is preparing", async ({
    label,
    path,
  }) => {
    const persistentStudyNotesContext =
      createPendingPersistentStudyNotesContext();

    renderRoute(path, {
      persistentStudyNotesContext,
      session: {
        user: {
          displayName: "Readiness Coverage",
          email: "readiness.coverage@example.com",
          id: "user-readiness-coverage",
          userLanguage: "en",
          userTimeZone: "America/New_York",
        },
      },
    });

    await waitFor(() => {
      expect(persistentStudyNotesContext.refresh).toHaveBeenCalledWith(
        "user-readiness-coverage",
      );
    });

    const shell = screen.getByRole("complementary", {
      name: "Study Notes workspace",
    });
    expect(shell).toBeInTheDocument();
    expect(
      within(shell).getByRole("navigation", { name: "App sections" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open navigation menu" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: label })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("status", { name: label })).toBeInTheDocument();
  });

  it.each(
    publicRoutes,
  )("does not force protected page readiness coverage onto $path", async ({
    heading,
    path,
  }) => {
    const persistentStudyNotesContext =
      createPendingPersistentStudyNotesContext();

    renderRoute(path, {
      persistentStudyNotesContext,
      session: { user: null },
    });

    expect(await screen.findByRole("heading", { name: heading })).toHaveClass(
      "page-header__title",
    );
    expect(persistentStudyNotesContext.refresh).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("complementary", { name: "Study Notes workspace" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /Preparing/ }),
    ).not.toBeInTheDocument();
  });
});
