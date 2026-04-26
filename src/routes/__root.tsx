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

import type { AppLabelsContext } from "../features/labels/labels";
import type { AppNotesContext } from "../features/notes/notes";
import type { AppRecallContext } from "../lib/recall";
import { type AppSessionContext, hasActiveSession } from "../lib/session";
import appCss from "../styles/app.css?url";

const authRoutePaths = new Set(["/forgot-password", "/login", "/register"]);
const redirectableProtectedPaths = [
  "/history",
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
    links: [{ rel: "stylesheet", href: appCss }],
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
              <div>
                <p className="eyebrow">Learning Makes Difference</p>
                <h1 className="site-title">TanStack Start Skeleton</h1>
              </div>

              <nav aria-label="Primary">
                <ul className="nav-list">
                  <li>
                    <Link
                      to="/"
                      activeProps={{ className: "nav-link nav-link-active" }}
                      className="nav-link"
                    >
                      Home
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/login"
                      activeProps={{ className: "nav-link nav-link-active" }}
                      className="nav-link"
                    >
                      Login
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/notes"
                      activeProps={{ className: "nav-link nav-link-active" }}
                      className="nav-link"
                    >
                      App
                    </Link>
                  </li>
                </ul>
              </nav>
            </header>
          )}

          <main id="main-content">{children}</main>
        </div>

        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
