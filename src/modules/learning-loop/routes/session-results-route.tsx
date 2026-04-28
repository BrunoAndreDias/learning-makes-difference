import { Link, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";

import type { AppLabel } from "../../../features/labels/labels";
import type { AppSessionSnapshot } from "../../../features/session/session";
import {
  type FlashCardRecallAttemptsByNote,
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

export function SessionResultsPage() {
  const labelsContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.labels,
  });
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
  const [availableLabels, setAvailableLabels] = useState<AppLabel[]>([]);
  const [selectedLabelId, setSelectedLabelId] = useState("");
  const [resultsView, setResultsView] = useState<"note" | "session">(
    "session",
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const selectedLabelFilter = selectedLabelId === "" ? undefined : selectedLabelId;

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
          labelId: selectedLabelFilter,
          userId,
        });
  const noteResults =
    userId === null
      ? []
      : recallContext.listAttemptsByNote({
          labelId: selectedLabelFilter,
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

  useEffect(() => {
    if (noteResults.length === 0) {
      setSelectedNoteId(null);
      return;
    }

    const hasSelectedNote = noteResults.some((result) => {
      return result.noteId === selectedNoteId;
    });

    if (!hasSelectedNote) {
      setSelectedNoteId(noteResults[0].noteId);
    }
  }, [selectedNoteId, noteResults]);

  const selectedSession = getSelectedSessionResult(
    sessionResults,
    selectedSessionId,
  );
  const selectedNote = getSelectedNoteResult(noteResults, selectedNoteId);

  return (
    <section className="recall-page">
      <article className="card stack panel-protected">
        <p className="section-label">Results</p>
        <h3>Results</h3>
        <p>
          Review completed recall work by target label, attempted questions,
          and stored note snapshots from the time of study.
        </p>
        <div className="tag-row">
          <span className="tag">Results</span>
          <span className="tag">Label filter</span>
          <span className="tag">Snapshot review</span>
        </div>
      </article>

      <div className="placeholder-grid recall-layout">
        <article className="card stack">
          <p className="section-label">Filter results</p>
          <fieldset className="tag-row">
            <legend className="section-label">Results view</legend>
            <button
              aria-pressed={resultsView === "session"}
              className="notes-action"
              onClick={() => setResultsView("session")}
              type="button"
            >
              By session
            </button>
            <button
              aria-pressed={resultsView === "note"}
              className="notes-action"
              onClick={() => setResultsView("note")}
              type="button"
            >
              By note
            </button>
          </fieldset>
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

          {resultsView === "session" && sessionResults.length === 0 ? (
            selectedLabelFilter === undefined ? (
              <NoResultsState />
            ) : (
              <p className="muted">
                No sessions match the current label filter.
              </p>
            )
          ) : resultsView === "session" ? (
            <div className="stack">
              {sessionResults.map((result) => {
                const isSelected = result.id === selectedSessionId;
                const summary = summarizeAttempts(result.attempts);

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
                    <p className="muted">
                      Nailed {summary.nailed} · Partial {summary.partial} ·
                      Missed {summary.missed}
                    </p>
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
          ) : noteResults.length === 0 ? (
            selectedLabelFilter === undefined ? (
              <NoResultsState />
            ) : (
              <p className="muted">No notes match the current label filter.</p>
            )
          ) : (
            <div className="stack">
              {noteResults.map((result) => {
                const isSelected = result.noteId === selectedNoteId;
                const title = result.currentTitle ?? result.snapshotTitle;
                const deletedSuffix =
                  result.currentTitle === null ? " (deleted)" : "";

                return (
                  <article
                    className="recall-session-card stack"
                    key={result.noteId}
                  >
                    <p className="section-label">Note performance</p>
                    <h4>
                      {title}
                      {result.currentTitle === null ? (
                        <span className="muted"> (deleted)</span>
                      ) : null}
                    </h4>
                    <div className="tag-row">
                      <span className="tag">
                        {formatAttemptCount(result.totalAttempts)}
                      </span>
                    </div>
                    <p className="muted">
                      Nailed {result.nailed} · Partial {result.partial} · Missed{" "}
                      {result.missed}
                    </p>
                    <button
                      aria-label={`Review note ${title}${deletedSuffix}`}
                      aria-pressed={isSelected}
                      className="notes-action"
                      onClick={() => setSelectedNoteId(result.noteId)}
                      type="button"
                    >
                      Review note
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </article>

        <section aria-label="Inspect results" className="card stack">
          <p className="section-label">Inspect results</p>
          {resultsView === "session" && selectedSession === null ? (
            <p className="muted">
              Pick a stored session to review its questions, answers, and
              ratings.
            </p>
          ) : resultsView === "session" && selectedSession !== null ? (
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
          ) : selectedNote === null ? (
            <p className="muted">
              Pick a stored note to review its sessions, snapshots, and ratings.
            </p>
          ) : (
            <>
              <h4>
                {selectedNote.currentTitle ?? selectedNote.snapshotTitle}
                {selectedNote.currentTitle === null ? (
                  <span className="muted"> (deleted)</span>
                ) : null}
              </h4>
              <div className="tag-row">
                <span className="tag">
                  {formatAttemptCount(selectedNote.totalAttempts)}
                </span>
              </div>

              <NoteAttemptHistory noteResult={selectedNote} />
            </>
          )}
        </section>
      </div>
    </section>
  );
}

function NoResultsState() {
  return (
    <div className="stack">
      <h4>No results yet</h4>
      <p className="muted">
        Complete a recall session to build reviewable results.
      </p>
      <Link className="notes-action" to="/recall">
        Go to Recall
      </Link>
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

function getSelectedNoteResult(
  noteResults: readonly FlashCardRecallAttemptsByNote[],
  selectedNoteId: string | null,
) {
  if (selectedNoteId === null) {
    return null;
  }

  return (
    noteResults.find((result) => result.noteId === selectedNoteId) ?? null
  );
}

function NoteAttemptHistory(props: {
  noteResult: FlashCardRecallAttemptsByNote;
}) {
  return (
    <div className="stack">
      {props.noteResult.attempts.map((attempt) => {
        return (
          <article
            className="recall-session-card stack"
            key={`${attempt.sessionId}-${attempt.completedAt}-${attempt.snapshotTitle}`}
          >
            <p className="section-label">
              {formatCompletedAt(attempt.completedAt)}
            </p>
            <h4>{attempt.snapshotTitle}</h4>
            <p>{attempt.bodySnapshot}</p>
            <p>{`Rating: ${formatRatingLabel(attempt.rating)}`}</p>
          </article>
        );
      })}
    </div>
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
