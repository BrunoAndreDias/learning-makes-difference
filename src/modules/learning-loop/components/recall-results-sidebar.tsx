import { Link, useRouteContext } from "@tanstack/react-router";
import {
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { AppSessionSnapshot } from "../../access/domain/session";
import type { AppLabel } from "../../labels/domain/labels";
import { formatRecallModeLabel } from "../domain/learner-copy";
import { listNotesForUser } from "../domain/notes";
import { useNotesWorkspace } from "../domain/notes-workspace";
import { listRecallResultLabels } from "../domain/recall-result-labels";
import {
  type RecallSessionSearchResult,
  searchRecallSessionResults,
} from "../domain/recall-session-search";
import {
  formatResultSummaryScoreLabel,
  getResultSummaryNoteCountLabel,
  summarizeSessionResult,
} from "../domain/result-summary";

function formatDateTime(timestamp: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

function formatScoreSummary(result: RecallSessionSearchResult) {
  const summary = summarizeSessionResult(result.sessionResult);
  return formatResultSummaryScoreLabel(summary.ratingTotals);
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
    selectedRecallSearchQuery,
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
  const [currentLabels, setCurrentLabels] = useState<AppLabel[]>([]);
  const selectedLabelFilter =
    selectedRecallLabelId.length === 0 ? undefined : selectedRecallLabelId;
  const allSessionResults =
    userId === null ? [] : recallContext.listSessionResults({ userId });
  const sessionResults =
    userId === null
      ? []
      : recallContext.listSessionResults({
          labelId: selectedLabelFilter,
          userId,
        });
  const availableLabels = listRecallResultLabels({
    currentLabels,
    sessionResults: allSessionResults,
  });
  const hasSearchQuery = selectedRecallSearchQuery.trim().length > 0;
  const searchResults = searchRecallSessionResults({
    labels: availableLabels,
    query: selectedRecallSearchQuery,
    sessionResults,
  });
  const notesAvailableForRecall =
    userId === null ? [] : listNotesForUser(notesSnapshot, userId);
  const hasNotesAvailableForRecall = notesAvailableForRecall.length > 0;
  const startAction = getResultsStartAction(hasNotesAvailableForRecall);
  const noResultsStateKind = getNoResultsStateKind(hasNotesAvailableForRecall);
  let reviewListContent: ReactNode;

  useEffect(() => {
    function syncAvailableLabels() {
      if (userId === null) {
        setCurrentLabels([]);
        return;
      }

      setCurrentLabels(labelsContext.getLabelsForUser(userId));
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

  if (sessionResults.length === 0) {
    reviewListContent = (
      <NoResultsState
        hasActiveFilter={selectedLabelFilter !== undefined}
        state={noResultsStateKind}
      />
    );
  } else if (hasSearchQuery && searchResults.length === 0) {
    reviewListContent = <NoSearchResultsState />;
  } else {
    reviewListContent = (
      <SessionResultsList
        onSelectSession={(sessionId) => {
          selectRecallSession(sessionId);
          closeMobileSidebar();
        }}
        results={searchResults}
        selectedSessionId={selectedRecallSessionId}
      />
    );
  }

  return (
    <section
      className="app-sidebar__workspace app-sidebar__workspace--recall"
      aria-label="Recall sidebar"
    >
      <div className="app-sidebar__workspace-header">
        <h3>Reviews</h3>
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

      <section aria-label="Review list" className="app-sidebar__workspace-nav">
        {reviewListContent}
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
  results: readonly RecallSessionSearchResult[];
  selectedSessionId: string | null;
}) {
  return (
    <ul className="app-sidebar__workspace-list">
      {results.map((result) => {
        const isSelected = result.sessionResult.id === selectedSessionId;

        return (
          <li
            className="app-sidebar__workspace-item"
            key={result.sessionResult.id}
          >
            <button
              aria-current={isSelected ? "page" : undefined}
              aria-label="Open review"
              aria-pressed={isSelected}
              className="app-sidebar__workspace-link app-sidebar__workspace-link--recall"
              onClick={() => onSelectSession(result.sessionResult.id)}
              type="button"
            >
              <span className="recall-results-sidebar__summary">
                <span>{formatDateTime(result.sessionResult.completedAt)}</span>
                <span className="app-sidebar__workspace-meta">
                  {getResultSummaryNoteCountLabel(result.sessionResult.notes)}
                </span>
              </span>
              <span className="recall-results-sidebar__meta">
                <span className="app-sidebar__workspace-meta">
                  {formatScoreSummary(result)}
                </span>
                <span className="app-sidebar__workspace-meta">
                  {`${formatRecallModeLabel(result.sessionResult.mode)} · ${result.matchedNoteTitle}`}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function NoSearchResultsState() {
  return (
    <div className="stack">
      <h4>No matching sessions</h4>
      <p className="muted">
        No completed sessions used a matching note, hook, or label.
      </p>
    </div>
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
