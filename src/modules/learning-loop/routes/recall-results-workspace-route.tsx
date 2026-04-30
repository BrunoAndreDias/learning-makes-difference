import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { AppSessionSnapshot } from "../../access/domain/session";
import { useNotesWorkspace } from "../domain/notes-workspace";
import {
  type FlashCardRecallNote,
  type FlashCardSessionResult,
  type RecallQuestion,
  summarizeAttempts,
} from "../domain/recall";

type SessionResultsSnapshot = {
  newestSessionId: string | null;
  resultCount: number;
};

export const Route = createFileRoute("/_protected/recall/")({
  component: RecallResultsWorkspacePage,
});

function formatAttemptCount(count: number) {
  return `${count} attempted ${count === 1 ? "question" : "questions"}`;
}

function formatQuestionCount(count: number) {
  return `${count} ${count === 1 ? "question" : "questions"} in session`;
}

function formatSummaryCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatScoreSummary(summary: ReturnType<typeof summarizeAttempts>) {
  return `Nailed ${summary.nailed} · Partial ${summary.partial} · Missed ${summary.missed}`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
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

function getRatingTone(rating: "missed" | "nailed" | "partial" | null) {
  switch (rating) {
    case "missed":
      return "missed";
    case "partial":
      return "partial";
    case "nailed":
      return "nailed";
    case null:
      return "unattempted";
  }
}

function formatDateTime(timestamp: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

export function RecallResultsWorkspacePage() {
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const sessionContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.session,
  });
  const {
    selectedRecallLabelId,
    selectedRecallSessionId,
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
  const userId = sessionSnapshot.user?.id ?? null;
  const selectedLabelFilter =
    selectedRecallLabelId.length === 0 ? undefined : selectedRecallLabelId;
  const sessionResults =
    userId === null
      ? []
      : recallContext.listSessionResults({
          labelId: selectedLabelFilter,
          userId,
        });
  const previousSessionResultsRef = useRef<SessionResultsSnapshot>({
    newestSessionId: null,
    resultCount: 0,
  });

  useEffect(() => {
    const currentSessionResults = getSessionResultsSnapshot(sessionResults);

    if (sessionResults.length === 0) {
      selectRecallSession(null);
      previousSessionResultsRef.current = currentSessionResults;
      return;
    }

    if (
      shouldSelectNewestSessionResult({
        currentSessionResults,
        previousSessionResults: previousSessionResultsRef.current,
        selectedSessionId: selectedRecallSessionId,
        sessionResults,
      })
    ) {
      selectRecallSession(currentSessionResults.newestSessionId);
    }

    previousSessionResultsRef.current = currentSessionResults;
  }, [selectRecallSession, selectedRecallSessionId, sessionResults]);

  const selectedSession = getSelectedSessionResult(
    sessionResults,
    selectedRecallSessionId,
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

        <div className="recall-results-layout recall-results-layout--details-only">
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

function SelectedSessionResult({
  sessionResult,
}: {
  sessionResult: FlashCardSessionResult | null;
}) {
  if (sessionResult === null) {
    return (
      <div className="recall-results-empty">
        <p className="section-label">Nothing selected</p>
        <h4>No session result selected</h4>
        <p className="muted">
          Complete a recall session to review stored note snapshots and question
          ratings.
        </p>
      </div>
    );
  }

  const summary = summarizeAttempts(sessionResult.attempts);
  const attemptedCount = sessionResult.attempts.length;
  const questionCount = sessionResult.questions.length;
  const completionRate =
    questionCount === 0 ? 0 : attemptedCount / questionCount;

  return (
    <div className="recall-results-detail">
      <div className="recall-results-primary-grid">
        <div className="recall-results-summary">
          <header className="recall-results-hero">
            <div className="notes-editor__title-stack">
              <p className="section-label">SessionResult</p>
              <h4>Session overview</h4>
              <p className="muted">
                Completed {formatDateTime(sessionResult.completedAt)}
              </p>
            </div>
            <div className="recall-results-score">
              <strong>{formatPercent(completionRate)}</strong>
              <span>answered</span>
            </div>
          </header>

          <section
            aria-labelledby="selected-session-details-heading"
            className="recall-results-section"
          >
            <h4 id="selected-session-details-heading">Session details</h4>
            <div className="recall-results-metrics">
              <div className="recall-results-metric">
                <span className="section-label">Mode</span>
                <strong>{sessionResult.mode}</strong>
                <p className="sr-only">Mode: {sessionResult.mode}</p>
              </div>
              <div className="recall-results-metric">
                <span className="section-label">Started</span>
                <strong>{formatDateTime(sessionResult.createdAt)}</strong>
                <p className="sr-only">
                  Started: {formatDateTime(sessionResult.createdAt)}
                </p>
              </div>
              <div className="recall-results-metric">
                <span className="section-label">Completed</span>
                <strong>{formatDateTime(sessionResult.completedAt)}</strong>
                <p className="sr-only">
                  Completed: {formatDateTime(sessionResult.completedAt)}
                </p>
              </div>
            </div>
            <div className="recall-results-chips">
              <span className="tag">{formatAttemptCount(attemptedCount)}</span>
              <span className="tag">{formatQuestionCount(questionCount)}</span>
            </div>
          </section>

          <section
            aria-labelledby="selected-score-summary-heading"
            className="recall-results-section"
          >
            <h4 id="selected-score-summary-heading">Score summary</h4>
            <div className="recall-rating-summary">
              <RatingSummaryItem
                count={summary.nailed}
                label="Nailed"
                tone="nailed"
              />
              <RatingSummaryItem
                count={summary.partial}
                label="Partial"
                tone="partial"
              />
              <RatingSummaryItem
                count={summary.missed}
                label="Missed"
                tone="missed"
              />
            </div>
            <p className="recall-results-score-copy">
              {formatScoreSummary(summary)}
            </p>
          </section>
        </div>

        <section
          aria-labelledby="selected-question-review-heading"
          className="recall-results-section recall-results-section--review"
        >
          <h4 id="selected-question-review-heading">Question review</h4>
          <ResultsSessionReview sessionResult={sessionResult} />
        </section>
      </div>

      <section
        aria-labelledby="selected-stored-note-snapshots-heading"
        className="recall-results-section recall-results-section--snapshots"
      >
        <div className="notes-editor__title-stack">
          <p className="section-label">Selected notes</p>
          <h4 id="selected-stored-note-snapshots-heading">
            Stored note snapshots
          </h4>
          <p className="muted">
            Snapshot content stays pinned to what was reviewed in this session.
          </p>
        </div>
        <StoredNoteSnapshotSummary notes={sessionResult.notes} />
      </section>
    </div>
  );
}

function RatingSummaryItem({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: "missed" | "nailed" | "partial";
}) {
  return (
    <div className="recall-rating-summary__item" data-tone={tone}>
      <strong>{count}</strong>
      <span>{label}</span>
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

function getSessionResultsSnapshot(
  sessionResults: readonly FlashCardSessionResult[],
): SessionResultsSnapshot {
  return {
    newestSessionId: sessionResults[0]?.id ?? null,
    resultCount: sessionResults.length,
  };
}

function shouldSelectNewestSessionResult({
  currentSessionResults,
  previousSessionResults,
  selectedSessionId,
  sessionResults,
}: {
  currentSessionResults: SessionResultsSnapshot;
  previousSessionResults: SessionResultsSnapshot;
  selectedSessionId: string | null;
  sessionResults: readonly FlashCardSessionResult[];
}) {
  const selectedSessionStillExists = sessionResults.some((result) => {
    return result.id === selectedSessionId;
  });

  if (!selectedSessionStillExists) {
    return true;
  }

  if (
    previousSessionResults.resultCount === 0 &&
    currentSessionResults.newestSessionId !== selectedSessionId
  ) {
    return true;
  }

  return hasAddedNewNewestSessionResult(
    previousSessionResults,
    currentSessionResults,
  );
}

function hasAddedNewNewestSessionResult(
  previousSessionResults: SessionResultsSnapshot,
  currentSessionResults: SessionResultsSnapshot,
) {
  return (
    previousSessionResults.newestSessionId !== null &&
    currentSessionResults.newestSessionId !== null &&
    currentSessionResults.newestSessionId !==
      previousSessionResults.newestSessionId &&
    currentSessionResults.resultCount > previousSessionResults.resultCount
  );
}

function ResultsSessionReview({
  sessionResult,
}: {
  sessionResult: FlashCardSessionResult;
}) {
  return (
    <div className="recall-question-review-list">
      {sessionResult.questions.map((question, index) => {
        const ratingTone = getRatingTone(question.selfRating);

        return (
          <article
            className="recall-session-card recall-question-card"
            data-tone={ratingTone}
            key={question.noteId}
          >
            <div className="recall-question-card__header">
              <p className="section-label">{`Question ${index + 1}`}</p>
              <span className="recall-rating-pill" data-tone={ratingTone}>
                {formatQuestionRating(question)}
              </span>
            </div>
            <h5>{question.noteSnapshot.title}</h5>
            <p>{question.noteSnapshot.body}</p>
            <p className="recall-question-card__rating">
              Rating: {formatQuestionRating(question)}
            </p>
          </article>
        );
      })}
    </div>
  );
}

function formatQuestionRating(question: RecallQuestion) {
  return question.selfRating === null
    ? "Not attempted"
    : formatRatingLabel(question.selfRating);
}

function StoredNoteSnapshotSummary({
  notes,
}: {
  notes: readonly FlashCardRecallNote[];
}) {
  return (
    <div className="recall-snapshot-grid">
      {notes.map((note) => {
        return (
          <article
            className="recall-session-card recall-snapshot-card"
            key={note.id}
          >
            <h5>{note.title}</h5>
            <p>{note.body}</p>
            <p className="muted">{formatStoredNoteSnapshotSummary(note)}</p>
          </article>
        );
      })}
    </div>
  );
}
