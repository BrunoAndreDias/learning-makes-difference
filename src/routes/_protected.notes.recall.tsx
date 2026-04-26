import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
  AppRecallError,
  type AppRecallSnapshot,
  type FlashCardRecallRating,
} from "../features/recall/recall";
import type { AppSessionSnapshot } from "../features/session/session";

export const Route = createFileRoute("/_protected/notes/recall")({
  component: NotesRecallSessionPage,
});

function NotesRecallSessionPage() {
  const navigate = useNavigate();
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

  return (
    <section className="recall-page">
      <article className="card stack">
        <nav
          aria-label="Workspace breadcrumb"
          className="workspace-breadcrumb"
        >
          <ol>
            <li>
              <Link to="/notes">Notes</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Recall</li>
          </ol>
        </nav>
        <h3>FlashCard session</h3>
        <div className="tag-row">
          <span className="tag">{`${activeSession.notes.length} notes in play`}</span>
          <span className="tag">{`Completed ${activeSession.attempts.length} of ${activeSession.notes.length} questions`}</span>
          <span className="tag">{`Question ${activeSession.currentIndex + 1} of ${activeSession.notes.length}`}</span>
        </div>

        {feedbackMessage !== null ? (
          <p className="auth-form__error" role="alert">
            {feedbackMessage}
          </p>
        ) : null}

        <article className="recall-session-card stack">
          <p className="section-label">Current question</p>
          <h4>{currentNote.title}</h4>
          <p className="muted">
            Attempt recall before revealing the note body.
          </p>

          {activeSession.isAnswerRevealed ? (
            <div className="recall-session-card__answer stack">
              <p className="section-label">Answer</p>
              <p>{currentNote.body}</p>
            </div>
          ) : null}

          <div className="recall-session-card__actions">
            {!activeSession.isAnswerRevealed ? (
              <button
                className="notes-action"
                onClick={handleRevealAnswer}
                type="button"
              >
                Reveal answer
              </button>
            ) : (
              <>
                <button
                  className="notes-action"
                  onClick={() => void handleRateAnswer("missed")}
                  type="button"
                >
                  Missed it
                </button>
                <button
                  className="notes-action"
                  onClick={() => void handleRateAnswer("partial")}
                  type="button"
                >
                  Partly recalled
                </button>
                <button
                  className="notes-action"
                  onClick={() => void handleRateAnswer("nailed")}
                  type="button"
                >
                  Nailed it
                </button>
              </>
            )}
            <button
              className="notes-action"
              onClick={() => void handleEndSession()}
              type="button"
            >
              End session
            </button>
          </div>
        </article>
      </article>
    </section>
  );
}
