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
import { type ReactNode, useEffect, useSyncExternalStore } from "react";
import appLogo from "../../../../docs/layout/logo.svg";
import appCss from "../../../styles/app.css?url";
import {
  type AppSessionContext,
  type AppSessionSnapshot,
  hasActiveSession,
} from "../../access/session/session";
import type { AppFocusContext, AppPersistentFocusContext } from "../../focus";
import type { AppLabelsContext } from "../../labels/label-management/labels";
import type { AppPersistentLabelsContext } from "../../labels/persistent-labels";
import { AppLanguageProvider, useAppTranslation } from "../../language";
import type { AppNotesContext, AppPersistentNotesContext } from "../../notes";
import type {
  AppPersistentRecallContext,
  AppRecallContext,
} from "../../recall";
import { isRemovedRecallPracticeRepairPath } from "../../recall/recall-practice-repair-paths";
import type {
  AppPersistentStudyNotesContext,
  AppStudyNotesContext,
} from "../../study-notes";
import { appRoutePaths, authenticatedLandingPath } from "./route-paths";
import { shouldShowRouterDevtools } from "./router-devtools-gate";

const authRoutePaths = new Set<string>([
  appRoutePaths.forgotPassword,
  appRoutePaths.login,
  appRoutePaths.register,
]);
const redirectableProtectedPaths = [
  appRoutePaths.practiceRepair,
  appRoutePaths.recall,
  appRoutePaths.settings,
  appRoutePaths.studyNotes,
  authenticatedLandingPath,
];

export function resolveRootRouteSessionSnapshot({
  routedSessionSnapshot,
  session,
}: Readonly<{
  routedSessionSnapshot?: AppSessionSnapshot;
  session: AppSessionContext;
}>): AppSessionSnapshot | Promise<AppSessionSnapshot> {
  if (
    routedSessionSnapshot !== undefined &&
    hasActiveSession(routedSessionSnapshot)
  ) {
    return routedSessionSnapshot;
  }

  const cachedSessionSnapshot = session.getSnapshot();

  return hasActiveSession(cachedSessionSnapshot)
    ? cachedSessionSnapshot
    : session.refresh();
}

function isProtectedPath(pathname: string): boolean {
  if (isRemovedRecallPracticeRepairPath(pathname)) {
    return false;
  }

  return redirectableProtectedPaths.some(
    (protectedPath) =>
      pathname === protectedPath || pathname.startsWith(`${protectedPath}/`),
  );
}

export const Route = createRootRouteWithContext<{
  focus: AppFocusContext;
  labels: AppLabelsContext;
  notes: AppNotesContext;
  persistentFocus?: AppPersistentFocusContext;
  persistentLabels?: AppPersistentLabelsContext;
  persistentNotes?: AppPersistentNotesContext;
  persistentRecall?: AppPersistentRecallContext;
  persistentStudyNotes?: AppPersistentStudyNotesContext;
  recall: AppRecallContext;
  session: AppSessionContext;
  sessionSnapshot?: AppSessionSnapshot;
  studyNotes: AppStudyNotesContext;
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
  beforeLoad: async ({ context, location }) => {
    const sessionSnapshot = await resolveRootRouteSessionSnapshot({
      routedSessionSnapshot: context.sessionSnapshot,
      session: context.session,
    });

    if (hasActiveSession(sessionSnapshot)) {
      return { sessionSnapshot };
    }

    if (authRoutePaths.has(location.pathname)) {
      return { sessionSnapshot };
    }

    throw redirect({
      to: appRoutePaths.login,
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
  const redirectTo = hasActiveSession(sessionSnapshot)
    ? authenticatedLandingPath
    : appRoutePaths.login;

  return <Navigate to={redirectTo} />;
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const sessionSnapshot = Route.useRouteContext({
    select: (context) => context.sessionSnapshot,
  });
  const session = Route.useRouteContext({
    select: (context) => context.session,
  });

  useEffect(() => {
    if (sessionSnapshot === undefined) {
      return;
    }

    session.hydrate?.(sessionSnapshot);
  }, [session, sessionSnapshot]);

  const clientUserLanguage = useSyncExternalStore(
    session.subscribe,
    () => session.getSnapshot().user?.userLanguage,
    () => session.getSnapshot().user?.userLanguage,
  );
  const userLanguage =
    clientUserLanguage ?? sessionSnapshot?.user?.userLanguage;

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AppLanguageProvider language={userLanguage}>
          <RootDocumentBody>{children}</RootDocumentBody>
        </AppLanguageProvider>
        <Scripts />
      </body>
    </html>
  );
}

function RootDocumentBody({ children }: Readonly<{ children: ReactNode }>) {
  const isAuthRoute = useRouterState({
    select: (state) =>
      state.matches.some((match) => match.routeId.startsWith("/_auth")),
  });
  const showRouterDevtools = shouldShowRouterDevtools({
    isDevelopment: import.meta.env.DEV,
  });

  const { t } = useAppTranslation();

  return (
    <>
      <div className={isAuthRoute ? "app-shell" : "app-shell shell"}>
        <a className="skip-link" href="#main-content">
          {t("common.skipToMain")}
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

            <nav aria-label={t("shell.topbar.primary")}>
              <ul className="nav-list">
                <li>
                  <Link
                    to="/"
                    activeProps={{ className: "nav-link nav-link-active" }}
                    activeOptions={{ exact: true }}
                    className="nav-link"
                  >
                    {t("shell.topbar.home")}
                  </Link>
                </li>
                <li>
                  <Link
                    to={authenticatedLandingPath}
                    activeProps={{ className: "nav-link nav-link-active" }}
                    className="nav-link"
                  >
                    {t("shell.topbar.workspace")}
                  </Link>
                </li>
                <li>
                  <Link
                    to={appRoutePaths.login}
                    activeProps={{ className: "nav-link nav-link-active" }}
                    className="nav-link nav-link--ghost"
                  >
                    {t("shell.topbar.signIn")}
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
    </>
  );
}
