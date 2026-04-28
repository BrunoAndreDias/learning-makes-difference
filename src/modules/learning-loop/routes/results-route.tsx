import { Link, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { AppSessionSnapshot } from "../../../features/session/session";
import { listNotesForUser } from "../domain/notes";
import {
  type FlashCardRecallAttemptSummary,
  type FlashCardRecallNote,
  type FlashCardSessionResult,
  summarizeAttempts,
} from "../domain/recall";

function formatAttemptCount(count: number) {
  return `${count} attempted ${count === 1 ? "question" : "questions"}`;
}

function formatQuestionCount(count: number) {
  return `${count} ${count === 1 ? "question" : "questions"} in session`;
}

function formatResultCount(count: number) {
  return `${count} ${count === 1 ? "result" : "results"}`;
}

function formatSummaryCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatScoreSummary(summary: FlashCardRecallAttemptSummary) {
  return `Nailed ${summary.nailed} · Partial ${summary.partial} · Missed ${summary.missed}`;
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

function formatStoredNoteSnapshotSummary(note: FlashCardRecallNote) {
  return [
    formatSummaryCount(note.acronyms.length, "acronym"),
    formatSummaryCount(note.metaphors.length, "metaphor"),
    formatSummaryCount(note.labelIds.length, "label"),
  ].join(" · ");
}

function formatRatingLabel(rating: "missed" | "nailed" | "partial") {
  switch (rating) {
    case "missed":
      return "Missed it";
    case "partial":
      return "Partly recalled";
    case "nailed":
      return "Nailed it";
  }
}

function formatDateTime(timestamp: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

export function RecallResultsPage() {
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
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const sessionResults =
    userId === null ? [] : recallContext.listSessionResults({ userId });
  const notesAvailableForRecall =
    userId === null ? [] : listNotesForUser(notesSnapshot, userId);
  const hasNotesAvailableForRecall = notesAvailableForRecall.length > 0;
  const startAction = getResultsStartAction(hasNotesAvailableForRecall);
  const noResultsStateKind = getNoResultsStateKind(hasNotesAvailableForRecall);

  useEffect(() => {
    if (sessionResults.length === 0) {
      setSelectedSessionId(null);
      return;
    }

    const hasSelectedSession = sessionResults.some((result) => {
      return result.id === selectedSessionId;
    });

    if (!hasSelectedSession) {
      setSelectedSessionId(sessionResults[0].id);
    }
  }, [selectedSessionId, sessionResults]);

  const selectedSession = getSelectedSessionResult(
    sessionResults,
    selectedSessionId,
  );

  return (
    <section aria-label="Recall results workspace" className="recall-workspace">
      <article className="recall-surface">
        <header className="recall-surface__header">
          <div className="notes-editor__title-stack">
            <p className="section-label">Recall</p>
            <h3>Results</h3>
            <p className="muted notes-editor__meta">
              Review completed recall work with the latest SessionResult open by
              default.
            </p>
          </div>
        </header>

        <div className="recall-results-layout">
          <section aria-label="Session results list" className="recall-panel">
            <div className="notes-list__header">
              <div className="stack">
                <p className="section-label">Start</p>
                <Link
                  aria-label={startAction.label}
                  className="notes-action notes-action-primary notes-recall-entry-action"
                  to={startAction.to}
                >
                  {startAction.label}
                </Link>
              </div>
              <span className="tag">
                {formatResultCount(sessionResults.length)}
              </span>
            </div>

            {sessionResults.length === 0 ? (
              <NoResultsState state={noResultsStateKind} />
            ) : (
              <SessionResultsList
                onSelectSession={setSelectedSessionId}
                results={sessionResults}
                selectedSessionId={selectedSessionId}
              />
            )}
          </section>

          <section
            aria-label="Selected session result"
            className="recall-panel"
          >
            <p className="section-label">Selected Result</p>
            <SelectedSessionResult sessionResult={selectedSession} />
          </section>
        </div>
      </article>
    </section>
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
    <div className="stack">
      {results.map((result) => {
        const isSelected = result.id === selectedSessionId;
        const summary = summarizeAttempts(result.attempts);

        return (
          <article className="recall-session-card stack" key={result.id}>
            <p className="section-label">SessionResult</p>
            <p>{formatDateTime(result.completedAt)}</p>
            <div className="tag-row">
              <span className="tag">
                {formatAttemptCount(result.attempts.length)}
              </span>
            </div>
            <p className="muted">{formatScoreSummary(summary)}</p>
            <button
              aria-pressed={isSelected}
              className="notes-action"
              onClick={() => onSelectSession(result.id)}
              type="button"
            >
              Review session
            </button>
          </article>
        );
      })}
    </div>
  );
}

function SelectedSessionResult({
  sessionResult,
}: {
  sessionResult: FlashCardSessionResult | null;
}) {
  if (sessionResult === null) {
    return (
      <p className="muted">
        Complete a recall session to review stored note snapshots and question
        ratings.
      </p>
    );
  }

  const summary = summarizeAttempts(sessionResult.attempts);

  return (
    <div className="stack">
      <header className="stack">
        <p className="section-label">SessionResult</p>
        <h4>{sessionResult.labelName}</h4>
      </header>

      <section
        aria-labelledby="selected-session-details-heading"
        className="stack"
      >
        <h4 id="selected-session-details-heading">Session details</h4>
        <p>Mode: {sessionResult.mode}</p>
        <p>Started: {formatDateTime(sessionResult.createdAt)}</p>
        <p>Completed: {formatDateTime(sessionResult.completedAt)}</p>
        <div className="tag-row">
          <span className="tag">
            {formatAttemptCount(sessionResult.attempts.length)}
          </span>
          <span className="tag">
            {formatQuestionCount(sessionResult.notes.length)}
          </span>
        </div>
      </section>

      <section
        aria-labelledby="selected-score-summary-heading"
        className="stack"
      >
        <h4 id="selected-score-summary-heading">Score summary</h4>
        <p>{formatScoreSummary(summary)}</p>
      </section>

      <section
        aria-labelledby="selected-question-review-heading"
        className="stack"
      >
        <h4 id="selected-question-review-heading">Question review</h4>
        <ResultsSessionReview sessionResult={sessionResult} />
      </section>

      <section
        aria-labelledby="selected-stored-note-snapshots-heading"
        className="stack"
      >
        <h4 id="selected-stored-note-snapshots-heading">
          Stored note snapshots
        </h4>
        <StoredNoteSnapshotSummary notes={sessionResult.notes} />
      </section>
    </div>
  );
}

function NoResultsState({ state }: { state: NoResultsStateKind }) {
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

function getSelectedSessionResult(
  sessionResults: readonly FlashCardSessionResult[],
  selectedSessionId: string | null,
) {
  if (selectedSessionId === null) {
    return null;
  }

  return (
    sessionResults.find((result) => result.id === selectedSessionId) ?? null
  );
}

function ResultsSessionReview({
  sessionResult,
}: {
  sessionResult: FlashCardSessionResult;
}) {
  const attemptsByNoteId = new Map(
    sessionResult.attempts.map((attempt) => [attempt.noteId, attempt]),
  );

  return (
    <div className="stack">
      {sessionResult.notes.map((note, index) => {
        const attempt = attemptsByNoteId.get(note.id);

        return (
          <article className="recall-session-card stack" key={note.id}>
            <p className="section-label">{`Question ${index + 1}`}</p>
            <h4>{note.title}</h4>
            <p>{note.body}</p>
            <p>
              {attempt === undefined
                ? "Rating: Not attempted"
                : `Rating: ${formatRatingLabel(attempt.rating)}`}
            </p>
          </article>
        );
      })}
    </div>
  );
}

function StoredNoteSnapshotSummary({
  notes,
}: {
  notes: readonly FlashCardRecallNote[];
}) {
  return (
    <div className="stack">
      {notes.map((note) => {
        return (
          <article className="recall-session-card stack" key={note.id}>
            <h5>{note.title}</h5>
            <p>{note.body}</p>
            <p className="muted">{formatStoredNoteSnapshotSummary(note)}</p>
          </article>
        );
      })}
    </div>
  );
}
