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
    ).toBeInTheDocument();
    expect(
      screen.getByText("Entre na sua conta para continuar"),
    ).toBeInTheDocument();
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
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre visible")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Codigo de registro piloto"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Formulario de registro" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrarte" }),
    ).toBeInTheDocument();
  });

  it("falls back to English for unsupported browser languages on forgot-password", async () => {
    setBrowserLanguages(["fr-FR"]);

    renderRoute("/forgot-password", { session: { user: null } });

    expect(
      await screen.findByRole("heading", { name: "Reset your password" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Password reset is coming soon. For now, please contact support.",
      ),
    ).toBeInTheDocument();
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

  it("redirects authenticated visits to the root path into the Study Notes workspace", async () => {
    const { router } = renderRoute("/");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/study-notes");
  });

  it("redirects anonymous visits to unknown paths into login", async () => {
    const { router } = renderRoute("/qweqwe", { session: { user: null } });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search.redirect).toBeUndefined();
  });

  it("redirects authenticated visits to unknown paths into the Study Notes workspace", async () => {
    const { router } = renderRoute("/qweqwe");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/study-notes");
  });

  it("redirects the removed /recall/results route to the canonical Recall workspace", async () => {
    const { router } = renderRoute("/recall/results");

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Recall starts with Study Notes",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(
      screen.queryByRole("heading", { level: 3, name: "Practice" }),
    ).not.toBeInTheDocument();
  });

  it("redirects unauthenticated protected navigation into the public login area", async () => {
    const { router } = renderRoute("/settings", { session: { user: null } });

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search.redirect).toBe("/settings");
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
