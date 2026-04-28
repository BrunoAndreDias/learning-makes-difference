import { Link, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { AppSessionSnapshot } from "../../../features/session/session";
import {
  type FlashCardSessionResult,
  summarizeAttempts,
} from "../domain/recall";

function formatAttemptCount(count: number) {
  return `${count} attempted ${count === 1 ? "question" : "questions"}`;
}

function formatQuestionCount(count: number) {
  return `${count} ${count === 1 ? "question" : "questions"} in session`;
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

function formatCompletedAt(timestamp: string) {
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
  const userId = sessionSnapshot.user?.id ?? null;
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const sessionResults =
    userId === null
      ? []
      : [...recallContext.listSessionResults({ userId })].sort((left, right) => {
          return (
            new Date(right.completedAt).getTime() -
            new Date(left.completedAt).getTime()
          );
        });

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
                  aria-label="Start Recall"
                  className="notes-action notes-action-primary notes-recall-entry-action"
                  to="/recall/select"
                >
                  Start Recall
                </Link>
              </div>
              <span className="tag">{`${sessionResults.length} ${sessionResults.length === 1 ? "result" : "results"}`}</span>
            </div>

            {sessionResults.length === 0 ? (
              <NoResultsState />
            ) : (
              <SessionResultsList
                onSelectSession={setSelectedSessionId}
                results={sessionResults}
                selectedSessionId={selectedSessionId}
              />
            )}
          </section>

          <section aria-label="Selected session result" className="recall-panel">
            <p className="section-label">Selected Result</p>
            {selectedSession === null ? (
              <p className="muted">
                Complete a recall session to review stored note snapshots and
                question ratings.
              </p>
            ) : (
              <>
                <h4>{selectedSession.labelName}</h4>
                <p>{formatCompletedAt(selectedSession.completedAt)}</p>
                <div className="tag-row">
                  <span className="tag">
                    {formatAttemptCount(selectedSession.attempts.length)}
                  </span>
                  <span className="tag">
                    {formatQuestionCount(selectedSession.notes.length)}
                  </span>
                </div>

                <ResultsSessionReview sessionResult={selectedSession} />
              </>
            )}
          </section>
        </div>
      </article>
    </section>
  );
}

function SessionResultsList(props: {
  onSelectSession: (sessionId: string) => void;
  results: readonly FlashCardSessionResult[];
  selectedSessionId: string | null;
}) {
  return (
    <div className="stack">
      {props.results.map((result) => {
        const isSelected = result.id === props.selectedSessionId;
        const summary = summarizeAttempts(result.attempts);

        return (
          <article className="recall-session-card stack" key={result.id}>
            <p className="section-label">SessionResult</p>
            <p>{formatCompletedAt(result.completedAt)}</p>
            <div className="tag-row">
              <span className="tag">
                {formatAttemptCount(result.attempts.length)}
              </span>
            </div>
            <p className="muted">
              Nailed {summary.nailed} · Partial {summary.partial} · Missed{" "}
              {summary.missed}
            </p>
            <button
              aria-pressed={isSelected}
              className="notes-action"
              onClick={() => props.onSelectSession(result.id)}
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

function NoResultsState() {
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

function ResultsSessionReview(props: {
  sessionResult: FlashCardSessionResult;
}) {
  const attemptsByNoteId = new Map(
    props.sessionResult.attempts.map((attempt) => [attempt.noteId, attempt]),
  );

  return (
    <div className="stack">
      {props.sessionResult.notes.map((note, index) => {
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
