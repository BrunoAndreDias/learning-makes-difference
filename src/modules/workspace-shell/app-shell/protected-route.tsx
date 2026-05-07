import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";

import type { AppSessionSnapshot } from "../../access/session/session";
import { hasActiveSession } from "../../access/session/session";
import { AppLayout } from "./protected-layout-route";

export const Route = createFileRoute("/_protected")({
  component: ProtectedRouteShell,
});

function ProtectedRouteShell() {
  const persistentFocus = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentFocus,
  });
  const persistentRecall = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentRecall,
  });
  const session = useRouteContext({
    from: "/_protected",
    select: (context) => context.session,
  });
  const routedSessionSnapshot = useRouteContext({
    from: "/_protected",
    select: (context) => context.sessionSnapshot,
  });
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const effectiveSessionSnapshot =
    hasActiveSession(sessionSnapshot) || routedSessionSnapshot === undefined
      ? sessionSnapshot
      : routedSessionSnapshot;
  const userId = effectiveSessionSnapshot.user?.id ?? null;
  const [isReady, setIsReady] = useState(
    persistentFocus === undefined && persistentRecall === undefined,
  );

  useEffect(() => {
    let cancelled = false;

    if (persistentFocus === undefined && persistentRecall === undefined) {
      setIsReady(true);
      return () => {
        cancelled = true;
      };
    }

    setIsReady(false);
    void Promise.all([
      persistentFocus?.refresh(userId),
      persistentRecall?.refresh(userId),
    ])
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [persistentFocus, persistentRecall, userId]);

  if (!isReady) {
    return null;
  }

  return <AppLayout />;
}
