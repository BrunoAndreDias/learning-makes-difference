import { Link, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { AppSessionSnapshot } from "../../access/domain/session";
import type { AppLabel } from "../../labels/domain/labels";
import { listNotesForUser } from "../domain/notes";
import { useNotesWorkspace } from "../domain/notes-workspace";
import type { FlashCardSessionResult } from "../domain/recall";

function formatAttemptCount(count: number) {
  return `${count} attempted ${count === 1 ? "question" : "questions"}`;
}

function formatDateTime(timestamp: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

type ResultsStartAction = {
  label: "Go to Notes" | "Start Recall";
  to: "/notes" | "/recall/select";
};

type NoResultsStateKind = "needs-notes" | "needs-results";

function getResultsStartAction(
  hasNotesAvailableForRecall: boolean,
): ResultsStartAction {
  if (hasNotesAvailableForRecall) {
    return {
      label: "Start Recall",
      to: "/recall/select",
    };
  }

  return {
    label: "Go to Notes",
    to: "/notes",
  };
}

function getNoResultsStateKind(
  hasNotesAvailableForRecall: boolean,
): NoResultsStateKind {
  return hasNotesAvailableForRecall ? "needs-results" : "needs-notes";
}

export function RecallResultsSidebar({
  closeMobileSidebar,
}: Readonly<{
  closeMobileSidebar: () => void;
}>) {
  const labelsContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.labels,
  });
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const notesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.notes,
  });
  const sessionContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.session,
  });
  const {
    selectedRecallLabelId,
    selectedRecallSessionId,
    selectRecallLabel,
    selectRecallSession,
  } = useNotesWorkspace();
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    sessionContext.subscribe,
    sessionContext.getSnapshot,
    sessionContext.getSnapshot,
  );
  useSyncExternalStore(
    recallContext.subscribe,
    recallContext.getSessionResultsSnapshot,
    recallContext.getSessionResultsSnapshot,
  );
  const notesSnapshot = useSyncExternalStore(
    notesContext.subscribe,
    notesContext.getSnapshot,
    notesContext.getSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const [availableLabels, setAvailableLabels] = useState<AppLabel[]>([]);
  const selectedLabelFilter =
    selectedRecallLabelId.length === 0 ? undefined : selectedRecallLabelId;
  const sessionResults =
    userId === null
      ? []
      : recallContext.listSessionResults({
          labelId: selectedLabelFilter,
          userId,
        });
  const notesAvailableForRecall =
    userId === null ? [] : listNotesForUser(notesSnapshot, userId);
  const hasNotesAvailableForRecall = notesAvailableForRecall.length > 0;
  const startAction = getResultsStartAction(hasNotesAvailableForRecall);
  const noResultsStateKind = getNoResultsStateKind(hasNotesAvailableForRecall);

  useEffect(() => {
    function syncAvailableLabels() {
      if (userId === null) {
        setAvailableLabels([]);
        return;
      }

      setAvailableLabels(labelsContext.getLabelsForUser(userId));
    }

    syncAvailableLabels();

    return labelsContext.subscribe(syncAvailableLabels);
  }, [labelsContext, userId]);

  useEffect(() => {
    if (
      selectedRecallLabelId.length > 0 &&
      !availableLabels.some((label) => label.id === selectedRecallLabelId)
    ) {
      selectRecallLabel("");
    }
  }, [availableLabels, selectRecallLabel, selectedRecallLabelId]);

  return (
    <section
      className="app-sidebar__workspace app-sidebar__workspace--recall"
      aria-label="Recall sidebar"
    >
      <div className="app-sidebar__workspace-header">
        <h3>Recall results</h3>
        <Link
          aria-label={startAction.label}
          className="notes-action notes-action-primary app-sidebar__primary-action"
          onClick={() => closeMobileSidebar()}
          to={startAction.to}
        >
          {startAction.label}
        </Link>
      </div>

      <div className="app-sidebar__workspace-controls">
        {availableLabels.length > 0 ? (
          <LabelFilter
            labels={availableLabels}
            selectedLabelId={selectedRecallLabelId}
            onChange={selectRecallLabel}
          />
        ) : null}
      </div>

      <section
        aria-label="Session results list"
        className="app-sidebar__workspace-nav"
      >
        {sessionResults.length === 0 ? (
          <NoResultsState
            hasActiveFilter={selectedLabelFilter !== undefined}
            state={noResultsStateKind}
          />
        ) : (
          <SessionResultsList
            onSelectSession={(sessionId) => {
              selectRecallSession(sessionId);
              closeMobileSidebar();
            }}
            results={sessionResults}
            selectedSessionId={selectedRecallSessionId}
          />
        )}
      </section>
    </section>
  );
}

function LabelFilter({
  labels,
  onChange,
  selectedLabelId,
}: {
  labels: readonly AppLabel[];
  onChange: (labelId: string) => void;
  selectedLabelId: string;
}) {
  return (
    <label
      className="app-sidebar__filter"
      htmlFor="recall-results-label-filter"
    >
      <span className="section-label">Label filter</span>
      <select
        aria-label="Filter results by label"
        id="recall-results-label-filter"
        onChange={(event) => onChange(event.target.value)}
        value={selectedLabelId}
      >
        <option value="">All labels</option>
        {labels.map((label) => (
          <option key={label.id} value={label.id}>
            {label.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SessionResultsList({
  onSelectSession,
  results,
  selectedSessionId,
}: {
  onSelectSession: (sessionId: string) => void;
  results: readonly FlashCardSessionResult[];
  selectedSessionId: string | null;
}) {
  return (
    <ul className="app-sidebar__workspace-list">
      {results.map((result) => {
        const isSelected = result.id === selectedSessionId;

        return (
          <li className="app-sidebar__workspace-item" key={result.id}>
            <button
              aria-current={isSelected ? "page" : undefined}
              aria-label="Review session"
              aria-pressed={isSelected}
              className="app-sidebar__workspace-link app-sidebar__workspace-link--recall"
              onClick={() => onSelectSession(result.id)}
              type="button"
            >
              <span>{formatDateTime(result.completedAt)}</span>
              <span className="app-sidebar__workspace-meta">
                {formatAttemptCount(result.attempts.length)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function NoResultsState({
  hasActiveFilter,
  state,
}: {
  hasActiveFilter: boolean;
  state: NoResultsStateKind;
}) {
  if (hasActiveFilter) {
    return (
      <div className="stack">
        <h4>No matching results</h4>
        <p className="muted">No results match this label yet.</p>
      </div>
    );
  }

  if (state === "needs-notes") {
    return (
      <div className="stack">
        <h4>No recallable notes yet</h4>
        <p className="muted">
          Create notes first, then come back to start recall and build results.
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <h4>No results yet</h4>
      <p className="muted">
        Complete a recall session to build reviewable results.
      </p>
    </div>
  );
}
