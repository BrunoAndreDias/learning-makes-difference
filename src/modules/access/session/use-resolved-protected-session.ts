import { useRouteContext } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import {
  type AppSessionContext,
  type AppSessionSnapshot,
  resolveProtectedSessionSnapshot,
} from "./session";

type ProtectedSessionRouteId =
  | "/_protected"
  | "/_protected/focus"
  | "/_protected/labels"
  | "/_protected/notes"
  | "/_protected/recall"
  | "/_protected/settings";

export function useResolvedProtectedSession(routeId: ProtectedSessionRouteId): {
  session: AppSessionContext;
  sessionSnapshot: AppSessionSnapshot;
} {
  const session = useRouteContext({
    from: routeId,
    select: (context) => context.session,
  });
  const routedSessionSnapshot = useRouteContext({
    from: routeId,
    select: (context) => context.sessionSnapshot,
  });
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );

  return {
    session,
    sessionSnapshot: resolveProtectedSessionSnapshot({
      routedSessionSnapshot,
      sessionSnapshot,
    }),
  };
}
