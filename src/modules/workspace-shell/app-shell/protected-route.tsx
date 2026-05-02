import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";

import type { AppSessionSnapshot } from "../../access/session/session";
import { AppLayout } from "./protected-layout-route";

export const Route = createFileRoute("/_protected")({
  component: ProtectedRouteShell,
});

function ProtectedRouteShell() {
  const persistentFocus = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentFocus,
  });
  const session = useRouteContext({
    from: "/_protected",
    select: (context) => context.session,
  });
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const [isReady, setIsReady] = useState(persistentFocus === undefined);

  useEffect(() => {
    let cancelled = false;

    if (persistentFocus === undefined) {
      setIsReady(true);
      return () => {
        cancelled = true;
      };
    }

    setIsReady(false);
    void persistentFocus
      .refresh(userId)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [persistentFocus, userId]);

  if (!isReady) {
    return null;
  }

  return <AppLayout />;
}
