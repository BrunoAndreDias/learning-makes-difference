import { createContext, type ReactNode, useContext } from "react";

import type { AppPersistentFocusContext } from "../../focus";
import type { AppPersistentLabelsContext } from "../../labels/persistent-labels";
import type { AppPersistentRecallContext } from "../../recall";
import type { AppPersistentStudyNotesContext } from "../../study-notes";

export type ProtectedWorkspaceRefreshState = {
  focus: boolean;
  labels: boolean;
  recall: boolean;
  studyNotes: boolean;
};

export type ProtectedWorkspaceRefreshKey = keyof ProtectedWorkspaceRefreshState;

export type ProtectedWorkspaceRefreshSource = {
  refresh: (userId: string | null) => Promise<unknown>;
};

type ProtectedWorkspaceRefreshSources = {
  focus: AppPersistentFocusContext | undefined;
  labels: AppPersistentLabelsContext | undefined;
  recall: AppPersistentRecallContext | undefined;
  studyNotes: AppPersistentStudyNotesContext | undefined;
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

export function ProtectedWorkspaceRefreshProvider({
  children,
  value,
}: Readonly<{
  children: ReactNode;
  value: ProtectedWorkspaceRefreshState;
}>) {
  return (
    <ProtectedWorkspaceRefreshContext.Provider value={value}>
      {children}
    </ProtectedWorkspaceRefreshContext.Provider>
  );
}

export function useProtectedWorkspaceRefreshState(): ProtectedWorkspaceRefreshState {
  return useContext(ProtectedWorkspaceRefreshContext);
}

export function buildPendingProtectedWorkspaceRefreshState(
  sources: ProtectedWorkspaceRefreshSources,
): ProtectedWorkspaceRefreshState {
  return {
    focus: sources.focus !== undefined,
    labels: sources.labels !== undefined,
    recall: sources.recall !== undefined,
    studyNotes: sources.studyNotes !== undefined,
  };
}

export function hasPendingProtectedWorkspaceRefresh(
  state: ProtectedWorkspaceRefreshState,
  keys: readonly ProtectedWorkspaceRefreshKey[],
): boolean {
  return keys.some((key) => state[key]);
}
