import { Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";

import type { AppSessionSnapshot } from "../../../features/session/session";
import {
  AppRecallError,
  type AppRecallSnapshot,
  type FlashCardRecallNote,
  type FlashCardRecallRating,
  summarizeAttempts,
} from "../domain/recall";

type RecallSessionRouteOptions = {
  breadcrumbCurrent: string;
  breadcrumbLabel: string;
  breadcrumbTo: "/notes" | "/recall";
  returnTo: "/notes" | "/recall";
};

export function RecallSessionPage() {
  return (
    <FlashCardRecallSessionPage
      breadcrumbCurrent="Session"
      breadcrumbLabel="Recall"
      breadcrumbTo="/recall"
      returnTo="/recall"
    />
  );
}

export function FlashCardRecallSessionPage(props: RecallSessionRouteOptions) {
  const navigate = useNavigate();
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
  const recallSnapshot = useSyncExternalStore<AppRecallSnapshot>(
    recallContext.subscribe,
    recallContext.getSnapshot,
    recallContext.getSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const activeSession =
    userId !== null && recallSnapshot?.userId === userId
      ? recallSnapshot
      : null;
  const currentNote =
    activeSession !== null
      ? (activeSession.notes[activeSession.currentIndex] ?? null)
      : null;
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [selectedSnapshotNoteId, setSelectedSnapshotNoteId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (activeSession !== null) {
      return;
    }

    void navigate({ replace: true, to: props.returnTo });
  }, [activeSession, navigate, props.returnTo]);

  function handleRecallError(error: unknown) {
    if (error instanceof AppRecallError) {
      setFeedbackMessage(error.message);
      return;
    }

    throw error;
  }

  function handleRevealAnswer() {
    if (userId === null || activeSession === null) {
      return;
    }

    try {
      recallContext.revealFlashCardAnswer({
        sessionId: activeSession.id,
        userId,
      });
      setFeedbackMessage(null);
    } catch (error) {
      handleRecallError(error);
    }
  }

  async function handleRateAnswer(rating: FlashCardRecallRating) {
    if (userId === null || activeSession === null) {
      return;
    }

    try {
      const nextSession = recallContext.rateFlashCardAnswer({
        rating,
        sessionId: activeSession.id,
        userId,
      });

      setFeedbackMessage(null);

      if (nextSession === null) {
        await navigate({ to: props.returnTo });
      }
    } catch (error) {
      handleRecallError(error);
    }
  }

  async function handleEndSession() {
    if (userId === null || activeSession === null) {
      return;
    }

    try {
      recallContext.endFlashCardSession({
        sessionId: activeSession.id,
        userId,
      });
      setFeedbackMessage(null);
      await navigate({ to: props.returnTo });
    } catch (error) {
      handleRecallError(error);
    }
  }

  if (activeSession === null || currentNote === null) {
    return null;
  }

  const totalCount = activeSession.notes.length;
  const completedCount = activeSession.attempts.length;
  const positionLabel = `Question ${activeSession.currentIndex + 1} of ${totalCount}`;
  const completedLabel = `Completed ${completedCount} of ${totalCount} questions`;
  const progressPercent =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const ratingTotals = summarizeAttempts(activeSession.attempts);
  const selectedSnapshotNote =
    selectedSnapshotNoteId === null
      ? null
      : (activeSession.notes.find(
          (note) => note.id === selectedSnapshotNoteId,
        ) ?? null);

  return (
    <section className="recall-shell" aria-label="FlashCard recall session">
      <header className="recall-shell__header">
        <div className="recall-shell__bar">
          <div className="recall-shell__context">
            <nav
              aria-label="Workspace breadcrumb"
              className="workspace-breadcrumb recall-shell__breadcrumb"
            >
              <ol>
                <li>
                  <Link to={props.breadcrumbTo}>{props.breadcrumbLabel}</Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">{props.breadcrumbCurrent}</li>
              </ol>
            </nav>
            <h2 className="sr-only">FlashCard session</h2>
            <p className="recall-shell__label">{activeSession.labelName}</p>
          </div>
          <button
            className="notes-action recall-shell__end"
            onClick={() => void handleEndSession()}
            type="button"
          >
            End session
          </button>
        </div>

        <div className="recall-progress">
          <div
            aria-valuemax={totalCount}
            aria-valuemin={0}
            aria-valuenow={completedCount}
            className="recall-progress__track"
            role="progressbar"
          >
            <div
              className="recall-progress__fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="recall-progress__meta">
            <span className="recall-progress__position">{positionLabel}</span>
            <span aria-hidden="true" className="recall-progress__divider">
              ·
            </span>
            <span>{completedLabel}</span>
            {completedCount > 0 ? (
              <>
                <span aria-hidden="true" className="recall-progress__divider">
                  ·
                </span>
                <span className="recall-progress__tally">
                  <span className="recall-tally recall-tally--nailed">
                    {ratingTotals.nailed} nailed
                  </span>
                  <span className="recall-tally recall-tally--partial">
                    {ratingTotals.partial} partial
                  </span>
                  <span className="recall-tally recall-tally--missed">
                    {ratingTotals.missed} missed
                  </span>
                </span>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {feedbackMessage !== null ? (
        <p className="recall-shell__error" role="alert">
          {feedbackMessage}
        </p>
      ) : null}

      <div className="recall-session-layout">
        <article
          className="recall-card"
          data-revealed={activeSession.isAnswerRevealed}
        >
          <div className="recall-card__top">
            <div className="recall-card__face recall-card__face--prompt">
              <button
                aria-label={`Show note snapshot for ${currentNote.title}`}
                className="recall-card__question"
                onClick={() => setSelectedSnapshotNoteId(currentNote.id)}
                type="button"
              >
                {currentNote.title}
              </button>
              {!activeSession.isAnswerRevealed ? (
                <p className="muted recall-card__hint">
                  Recall the answer, then reveal it to compare.
                </p>
              ) : null}
            </div>

            {!activeSession.isAnswerRevealed ? (
              <div className="recall-card__actions">
                <button
                  className="notes-action notes-action-primary recall-card__reveal"
                  onClick={handleRevealAnswer}
                  type="button"
                >
                  Reveal answer
                </button>
              </div>
            ) : null}
          </div>

          {activeSession.isAnswerRevealed ? (
            <p className="recall-card__body">{currentNote.body}</p>
          ) : null}

          {activeSession.isAnswerRevealed ? (
            <footer className="recall-card__footer">
              <fieldset className="recall-rating-row">
                <legend className="sr-only">Rate your recall</legend>
                <button
                  className="notes-action recall-rating recall-rating--missed"
                  onClick={() => void handleRateAnswer("missed")}
                  type="button"
                >
                  Missed it
                </button>
                <button
                  className="notes-action recall-rating recall-rating--partial"
                  onClick={() => void handleRateAnswer("partial")}
                  type="button"
                >
                  Partly recalled
                </button>
                <button
                  className="notes-action recall-rating recall-rating--nailed"
                  onClick={() => void handleRateAnswer("nailed")}
                  type="button"
                >
                  Nailed it
                </button>
              </fieldset>
            </footer>
          ) : null}
        </article>

        <aside
          aria-label="Session questions and note snapshot"
          className="recall-session-side"
        >
          <ol aria-label="Session questions" className="recall-question-list">
            {activeSession.notes.map((note, index) => {
              const attempt = activeSession.attempts.find(
                (entry) => entry.noteId === note.id,
              );
              const isCurrent = note.id === currentNote.id;
              const isSelected = note.id === selectedSnapshotNote?.id;

              return (
                <li key={note.id}>
                  <button
                    aria-current={isCurrent ? "step" : undefined}
                    aria-pressed={isSelected}
                    className="recall-question-list__button"
                    data-current={isCurrent}
                    data-selected={isSelected}
                    onClick={() => setSelectedSnapshotNoteId(note.id)}
                    type="button"
                  >
                    <span className="recall-question-list__index">
                      {index + 1}
                    </span>
                    <span className="recall-question-list__title">
                      {note.title}
                    </span>
                    {attempt !== undefined ? (
                      <span
                        className="recall-question-list__rating"
                        data-rating={attempt.rating}
                      >
                        {attempt.rating}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>

          <NoteSnapshotPanel note={selectedSnapshotNote} />
        </aside>
      </div>
    </section>
  );
}

function NoteSnapshotPanel({ note }: { note: FlashCardRecallNote | null }) {
  if (note === null) {
    return (
      <section className="recall-note-snapshot recall-note-snapshot--empty">
        <p>Select a question to see its note snapshot.</p>
      </section>
    );
  }

  return (
    <section aria-label="Note snapshot" className="recall-note-snapshot">
      <p className="recall-note-snapshot__label">Note snapshot</p>
      <h3>{note.title}</h3>
      <p>{note.body}</p>
    </section>
  );
}
