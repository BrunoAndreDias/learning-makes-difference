import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";

import type { AppLabel } from "../features/labels/labels";
import type { FlashCardSessionResult } from "../lib/recall";
import type { AppSessionSnapshot } from "../lib/session";

export const Route = createFileRoute("/_protected/history")({
  component: HistoryPage,
});

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

function HistoryPage() {
  const labelsContext = Route.useRouteContext({
    select: (context) => context.labels,
  });
  const recallContext = Route.useRouteContext({
    select: (context) => context.recall,
  });
  const sessionContext = Route.useRouteContext({
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
  const [availableLabels, setAvailableLabels] = useState<AppLabel[]>([]);
  const [selectedLabelId, setSelectedLabelId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    function syncLabels() {
      if (userId === null) {
        setAvailableLabels([]);
        return;
      }

      setAvailableLabels(labelsContext.getLabelsForUser(userId));
    }

    syncLabels();

    return labelsContext.subscribe(syncLabels);
  }, [labelsContext, userId]);

  const sessionResults =
    userId === null
      ? []
      : recallContext.listSessionResults({
          labelId: selectedLabelId === "" ? undefined : selectedLabelId,
          userId,
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

  const selectedSession =
    selectedSessionId === null
      ? null
      : (sessionResults.find((result) => result.id === selectedSessionId) ??
        null);

  return (
    <section className="recall-page">
      <article className="card stack panel-protected">
        <p className="section-label">History</p>
        <h3>Study history</h3>
        <p>
          Review completed recall work by target label, attempted questions, and
          stored note snapshots from the time of study.
        </p>
        <div className="tag-row">
          <span className="tag">Session results</span>
          <span className="tag">Label filter</span>
          <span className="tag">Snapshot review</span>
        </div>
      </article>

      <div className="placeholder-grid recall-layout">
        <article className="card stack">
          <p className="section-label">Filter history</p>
          <label className="auth-form__field">
            <span>Filter by label</span>
            <select
              className="auth-form__control"
              onChange={(event) => setSelectedLabelId(event.target.value)}
              value={selectedLabelId}
            >
              <option value="">All labels</option>
              {availableLabels.map((label) => (
                <option key={label.id} value={label.id}>
                  {label.name}
                </option>
              ))}
            </select>
          </label>

          {sessionResults.length === 0 ? (
            <p className="muted">
              {selectedLabelId === ""
                ? "No session results yet. Complete at least one attempted recall session to build history."
                : "No sessions match the current label filter."}
            </p>
          ) : (
            <div className="stack">
              {sessionResults.map((result) => {
                const isSelected = result.id === selectedSessionId;

                return (
                  <article
                    className="recall-session-card stack"
                    key={result.id}
                  >
                    <p className="section-label">{result.labelName}</p>
                    <p>{formatCompletedAt(result.completedAt)}</p>
                    <div className="tag-row">
                      <span className="tag">
                        {formatAttemptCount(result.attempts.length)}
                      </span>
                      <span className="tag">
                        {formatQuestionCount(result.notes.length)}
                      </span>
                    </div>
                    <button
                      aria-pressed={isSelected}
                      className="notes-action"
                      onClick={() => setSelectedSessionId(result.id)}
                      type="button"
                    >
                      Review session
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </article>

        <article className="card stack">
          <p className="section-label">Inspect results</p>
          {selectedSession === null ? (
            <p className="muted">
              Pick a stored session to review its questions, answers, and
              ratings.
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

              <SessionReview sessionResult={selectedSession} />
            </>
          )}
        </article>
      </div>
    </section>
  );
}

function SessionReview(props: { sessionResult: FlashCardSessionResult }) {
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
