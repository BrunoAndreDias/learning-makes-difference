import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";

import { useResolvedProtectedSession } from "../../access/session/use-resolved-protected-session";
import type { AppPersistentFocusContext } from "../../focus";
import type { AppPersistentLabelsContext } from "../../labels/persistent-labels";
import type { AppPersistentRecallContext } from "../../recall";
import type { AppPersistentStudyNotesContext } from "../../study-notes";
import { AppLayout } from "./protected-layout-route";

type ProtectedWorkspaceRefreshState = {
  focus: boolean;
  labels: boolean;
  recall: boolean;
  studyNotes: boolean;
};

const defaultProtectedWorkspaceRefreshState: ProtectedWorkspaceRefreshState = {
  focus: false,
  labels: false,
  recall: false,
  studyNotes: false,
};

const ProtectedWorkspaceRefreshContext =
  createContext<ProtectedWorkspaceRefreshState>(
    defaultProtectedWorkspaceRefreshState,
  );

export const Route = createFileRoute("/_protected")({
  component: ProtectedRouteShell,
});

export function useProtectedWorkspaceRefreshState() {
  return useContext(ProtectedWorkspaceRefreshContext);
}

function buildPendingRefreshState(input: {
  persistentFocus: AppPersistentFocusContext | undefined;
  persistentLabels: AppPersistentLabelsContext | undefined;
  persistentRecall: AppPersistentRecallContext | undefined;
  persistentStudyNotes: AppPersistentStudyNotesContext | undefined;
}): ProtectedWorkspaceRefreshState {
  return {
    focus: input.persistentFocus !== undefined,
    labels: input.persistentLabels !== undefined,
    recall: input.persistentRecall !== undefined,
    studyNotes: input.persistentStudyNotes !== undefined,
  };
}

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
      buildPendingRefreshState({
        persistentFocus,
        persistentLabels,
        persistentRecall,
        persistentStudyNotes,
      }),
    );

  useEffect(() => {
    let cancelled = false;
    const nextRefreshState = buildPendingRefreshState({
      persistentFocus,
      persistentLabels,
      persistentRecall,
      persistentStudyNotes,
    });

    setRefreshState(nextRefreshState);

    function markSettled(
      key: keyof ProtectedWorkspaceRefreshState,
      context:
        | AppPersistentFocusContext
        | AppPersistentLabelsContext
        | AppPersistentRecallContext
        | AppPersistentStudyNotesContext
        | undefined,
    ) {
      if (context === undefined) {
        return;
      }

      void context
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

    markSettled("focus", persistentFocus);
    markSettled("labels", persistentLabels);
    markSettled("recall", persistentRecall);
    markSettled("studyNotes", persistentStudyNotes);

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
    <ProtectedWorkspaceRefreshContext.Provider value={refreshState}>
      <AppLayout />
    </ProtectedWorkspaceRefreshContext.Provider>
  );
}
