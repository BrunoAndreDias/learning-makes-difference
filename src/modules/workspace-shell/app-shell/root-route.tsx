/// <reference types="vite/client" />

import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Navigate,
  redirect,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { type ReactNode, useSyncExternalStore } from "react";
import appLogo from "../../../../docs/layout/logo.svg";
import appCss from "../../../styles/app.css?url";
import {
  type AppSessionContext,
  hasActiveSession,
} from "../../access/session/session";
import type { AppFocusContext } from "../../focus";
import type { AppLabelsContext } from "../../labels/label-management/labels";
import type { AppNotesContext } from "../../notes";
import type { AppRecallContext } from "../../recall";
import { shouldShowRouterDevtools } from "./router-devtools-gate";

const authRoutePaths = new Set(["/forgot-password", "/login", "/register"]);
const redirectableProtectedPaths = [
  "/labels",
  "/notes",
  "/recall",
  "/settings",
];

function isProtectedPath(pathname: string): boolean {
  return redirectableProtectedPaths.some(
    (protectedPath) =>
      pathname === protectedPath || pathname.startsWith(`${protectedPath}/`),
  );
}

export const Route = createRootRouteWithContext<{
  focus: AppFocusContext;
  labels: AppLabelsContext;
  notes: AppNotesContext;
  recall: AppRecallContext;
  session: AppSessionContext;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title: "Learning Makes Difference",
      },
      {
        name: "description",
        content:
          "SSR-capable TanStack Start foundation for Learning Makes Difference.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: appLogo },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  beforeLoad: ({ context, location }) => {
    if (hasActiveSession(context.session.getSnapshot())) {
      return;
    }

    if (authRoutePaths.has(location.pathname)) {
      return;
    }

    throw redirect({
      to: "/login",
      search: isProtectedPath(location.pathname)
        ? { redirect: location.href }
        : undefined,
    });
  },
  notFoundComponent: NotFoundRedirect,
  shellComponent: RootDocument,
});

function NotFoundRedirect() {
  const session = Route.useRouteContext({
    select: (context) => context.session,
  });
  const sessionSnapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const redirectTo = hasActiveSession(sessionSnapshot) ? "/notes" : "/login";

  return <Navigate to={redirectTo} />;
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const isAuthRoute = useRouterState({
    select: (state) =>
      state.matches.some((match) => match.routeId.startsWith("/_auth")),
  });
  const showRouterDevtools = shouldShowRouterDevtools({
    isDevelopment: import.meta.env.DEV,
  });

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className={isAuthRoute ? "app-shell" : "app-shell shell"}>
          <a className="skip-link" href="#main-content">
            Skip to main content
          </a>
          {isAuthRoute ? null : (
            <header className="topbar">
              <Link className="topbar__brand" to="/">
                <span aria-hidden="true" className="topbar__mark">
                  L
                </span>
                <span className="topbar__wordmark">
                  Learning <em>Makes</em> Difference
                </span>
              </Link>

              <nav aria-label="Primary">
                <ul className="nav-list">
                  <li>
                    <Link
                      to="/"
                      activeProps={{ className: "nav-link nav-link-active" }}
                      activeOptions={{ exact: true }}
                      className="nav-link"
                    >
                      Home
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/notes"
                      activeProps={{ className: "nav-link nav-link-active" }}
                      className="nav-link"
                    >
                      Workspace
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/login"
                      activeProps={{ className: "nav-link nav-link-active" }}
                      className="nav-link nav-link--ghost"
                    >
                      Sign in
                    </Link>
                  </li>
                </ul>
              </nav>
            </header>
          )}

          <main id="main-content">{children}</main>
        </div>

        {showRouterDevtools ? (
          <TanStackRouterDevtools position="bottom-right" />
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}
