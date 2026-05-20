// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppSessionContext } from "../../modules/access/session/session";
import { renderRoute } from "./app-shell-test-support";

function setBrowserLanguages(languages: readonly string[]) {
  Object.defineProperty(window.navigator, "languages", {
    configurable: true,
    value: languages,
  });
}

afterEach(() => {
  setBrowserLanguages(["en"]);
});

describe("authenticated app shell", () => {
  it("translates the anonymous login page from Portuguese browser language", async () => {
    setBrowserLanguages(["pt-PT", "en"]);

    renderRoute("/login", { session: { user: null } });

    expect(
      await screen.findByRole("heading", { name: "Bem-vindo de volta" }),
    ).toHaveClass("page-header__title");
    expect(screen.getByText("Entre na sua conta para continuar")).toHaveClass(
      "page-header__description",
    );
    expect(
      screen.getByRole("form", { name: "Formulario de inicio de sessao" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("translates the anonymous registration page from Spanish browser language", async () => {
    setBrowserLanguages(["es-MX", "en"]);

    renderRoute("/register", { session: { user: null } });

    expect(
      await screen.findByRole("heading", { name: "Crea tu cuenta" }),
    ).toHaveClass("page-header__title");
    expect(screen.getByLabelText("Nombre visible")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Codigo de registro piloto"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Formulario de registro" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Registrate para empezar a estudiar")).toHaveClass(
      "page-header__description",
    );
    expect(
      screen.getByRole("button", { name: "Registrarte" }),
    ).toBeInTheDocument();
  });

  it("falls back to English for unsupported browser languages on forgot-password", async () => {
    setBrowserLanguages(["fr-FR"]);

    renderRoute("/forgot-password", { session: { user: null } });

    expect(
      await screen.findByRole("heading", { name: "Reset your password" }),
    ).toHaveClass("page-header__title");
    expect(
      screen.getByText(
        "Password reset is coming soon. For now, please contact support.",
      ),
    ).toHaveClass("page-header__description");
    expect(
      screen.getByRole("link", { name: "Back to sign in" }),
    ).toBeInTheDocument();
  });

  it("redirects anonymous visits to the root path into login", async () => {
    const { router } = renderRoute("/", { session: { user: null } });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("redirects authenticated visits to the root path into the Today workspace", async () => {
    const { router } = renderRoute("/");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Study Guidance",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/today");
  });

  it("redirects anonymous visits to unknown paths into login", async () => {
    const { router } = renderRoute("/qweqwe", { session: { user: null } });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search.redirect).toBeUndefined();
  });

  it("redirects authenticated visits to unknown paths into the Today workspace", async () => {
    const { router } = renderRoute("/qweqwe");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Study Guidance",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/today");
  });

  it("keeps /recall/results as a dedicated Recall sub-route", async () => {
    const { router } = renderRoute("/recall/results");

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Recall starts with Study Notes",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall/results");
    expect(
      screen.queryByRole("heading", { level: 3, name: "Practice" }),
    ).not.toBeInTheDocument();
  });

  it("keeps /practice-repair as a top-level authenticated route", async () => {
    const { router } = renderRoute("/practice-repair");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Practice Repair Queue",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/practice-repair");
  });

  it.each([
    "/today",
    "/practice-repair",
    "/practice-repair/missing-entry",
    "/practice-repair/results/result-1/questions/question-1",
    "/settings",
  ] as const)("redirects unauthenticated %s navigation into the public login area", async (pathname) => {
    const { router } = renderRoute(pathname, { session: { user: null } });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search.redirect).toBe(pathname);
  });

  it.each([
    "/recall/repair",
    "/recall/repair/missing-entry",
    "/recall/results/result-1/questions/question-1/repair",
  ] as const)("treats removed %s routes as generic login navigation instead of protected redirect targets", async (pathname) => {
    const { router } = renderRoute(pathname, { session: { user: null } });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search.redirect).toBeUndefined();
  });

  it("treats /insights as a removed route instead of preserving it as a protected redirect target", async () => {
    const { router } = renderRoute("/insights", { session: { user: null } });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search.redirect).toBeUndefined();
  });

  it("redirects to login when persisted session restoration fails", async () => {
    const sessionContext = createAppSessionContext({
      initialSnapshot: {
        user: {
          displayName: "Stale Casey",
          email: "casey@example.com",
          id: "user-stale-casey",
          userLanguage: "en",
        },
      },
      service: {
        getSessionSnapshot: vi.fn(async () => {
          throw new Error("Failed query: select from auth_sessions");
        }),
        login: vi.fn(async () => ({ user: null })),
        logout: vi.fn(async () => ({ user: null })),
        register: vi.fn(async () => ({ user: null })),
        updatePreferences: vi.fn(async () => ({ user: null })),
      },
    });
    const { router } = renderRoute("/study-notes", { sessionContext });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search.redirect).toBe("/study-notes");
  });
});
