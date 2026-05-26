import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useResolvedProtectedSession } from "../../access/session/use-resolved-protected-session";
import { AppLayout } from "./protected-layout-route";
import {
  buildPendingProtectedWorkspaceRefreshState,
  type ProtectedWorkspaceRefreshKey,
  ProtectedWorkspaceRefreshProvider,
  type ProtectedWorkspaceRefreshSource,
  type ProtectedWorkspaceRefreshState,
} from "./protected-workspace-refresh";

export const Route = createFileRoute("/_protected")({
  component: ProtectedRouteShell,
});

function ProtectedRouteShell() {
  const persistentFocus = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentFocus,
  });
  const persistentLabels = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentLabels,
  });
  const persistentRecall = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentRecall,
  });
  const persistentStudyNotes = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentStudyNotes,
  });
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const userId = sessionSnapshot.user?.id ?? null;
  const [refreshState, setRefreshState] =
    useState<ProtectedWorkspaceRefreshState>(() =>
      buildPendingProtectedWorkspaceRefreshState({
        focus: persistentFocus,
        labels: persistentLabels,
        recall: persistentRecall,
        studyNotes: persistentStudyNotes,
      }),
    );

  useEffect(() => {
    let cancelled = false;
    const refreshSources = {
      focus: persistentFocus,
      labels: persistentLabels,
      recall: persistentRecall,
      studyNotes: persistentStudyNotes,
    };
    const nextRefreshState =
      buildPendingProtectedWorkspaceRefreshState(refreshSources);

    setRefreshState(nextRefreshState);

    function markRefreshSettled(
      key: ProtectedWorkspaceRefreshKey,
      refreshSource: ProtectedWorkspaceRefreshSource | undefined,
    ) {
      if (refreshSource === undefined) {
        return;
      }

      void refreshSource
        .refresh(userId)
        .catch(() => undefined)
        .finally(() => {
          if (cancelled) {
            return;
          }

          setRefreshState((currentState) => ({
            ...currentState,
            [key]: false,
          }));
        });
    }

    markRefreshSettled("focus", refreshSources.focus);
    markRefreshSettled("labels", refreshSources.labels);
    markRefreshSettled("recall", refreshSources.recall);
    markRefreshSettled("studyNotes", refreshSources.studyNotes);

    return () => {
      cancelled = true;
    };
  }, [
    persistentFocus,
    persistentLabels,
    persistentRecall,
    persistentStudyNotes,
    userId,
  ]);

  return (
    <ProtectedWorkspaceRefreshProvider value={refreshState}>
      <AppLayout />
    </ProtectedWorkspaceRefreshProvider>
  );
}
