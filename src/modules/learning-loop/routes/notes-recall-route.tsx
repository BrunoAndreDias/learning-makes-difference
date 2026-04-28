import { Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { AppSessionSnapshot } from "../../../features/session/session";
import {
  AppRecallError,
  type AppRecallSnapshot,
  type FlashCardRecallRating,
  summarizeAttempts,
} from "../domain/recall";

export function NotesRecallSessionPage() {
  const navigate = useNavigate();
  const recallContext = useRouteContext({
    from: "/_protected/notes/recall",
    select: (context) => context.recall,
  });
  const sessionContext = useRouteContext({
    from: "/_protected/notes/recall",
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

  useEffect(() => {
    if (activeSession !== null) {
      return;
    }

    void navigate({ replace: true, to: "/notes" });
  }, [activeSession, navigate]);

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
        await navigate({ to: "/notes" });
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
      await navigate({ to: "/notes" });
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

  return (
    <section className="recall-shell" aria-label="FlashCard recall session">
      <header className="recall-shell__header">
        <nav
          aria-label="Workspace breadcrumb"
          className="workspace-breadcrumb recall-shell__breadcrumb"
        >
          <ol>
            <li>
              <Link to="/notes">Notes</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Recall</li>
          </ol>
        </nav>

        <div className="recall-shell__title-row">
          <div className="recall-shell__title-stack">
            <p className="eyebrow">{activeSession.labelName}</p>
            <h2>FlashCard session</h2>
            <p className="muted recall-shell__subtitle">
              Recall the note from memory before revealing the answer. Rate
              honestly — your ratings shape future practice.
            </p>
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

      <article
        className="recall-card"
        data-revealed={activeSession.isAnswerRevealed}
      >
        <div className="recall-card__top">
          <div className="recall-card__face recall-card__face--prompt">
            <p className="section-label">Prompt</p>
            <h3 className="recall-card__title">{currentNote.title}</h3>
            {!activeSession.isAnswerRevealed ? (
              <p className="muted recall-card__hint">
                Hold the answer in mind, then reveal it to compare.
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
          <div className="recall-card__face recall-card__face--answer">
            <p className="section-label">Answer</p>
            <p className="recall-card__body">{currentNote.body}</p>
          </div>
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
    </section>
  );
}
