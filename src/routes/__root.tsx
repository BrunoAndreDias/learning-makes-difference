/// <reference types="vite/client" />

import {
  createRootRoute,
  HeadContent,
  Link,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";

import appCss from "../styles/app.css?url";

export const Route = createRootRoute({
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
  shellComponent: RootDocument,
});

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="app-shell shell">
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

          <main>{children}</main>
        </div>

        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
