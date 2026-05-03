import {
  createFileRoute,
  Link,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { AppSessionSnapshot } from "../access/session/session";
import { BreakIntervalOverlay, isBreakIntervalActive } from "../focus";
import { formatRecallModeLabel } from "./learner-copy";
import {
  AppRecallError,
  type AppRecallSnapshot,
  type FlashCardRecallNote,
  type FlashCardRecallRating,
  type RecallSession,
} from "./recall";

const recallSessionSavedMessageKey = "learning-makes-difference:recall-saved";
const ratingOptions = [
  {
    description: "Could not recall it.",
    label: "Forgot",
    rating: "forgot",
  },
  {
    description: "Recalled it with major effort.",
    label: "Hard",
    rating: "hard",
  },
  {
    description: "Recalled the important parts.",
    label: "Good",
    rating: "good",
  },
  {
    description: "Recalled it clearly.",
    label: "Easy",
    rating: "easy",
  },
] as const satisfies readonly {
  description: string;
  label: string;
  rating: FlashCardRecallRating;
}[];

export const Route = createFileRoute("/_protected/recall/session")({
  component: RecallSessionPage,
});

function setRecallSavedMessage() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(recallSessionSavedMessageKey, "true");
}

function formatElapsedTime(startedAt: string, now: number) {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - new Date(startedAt).getTime()) / 1000),
  );
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function RecallSessionPage() {
  const navigate = useNavigate();
  const focusContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.focus,
  });
  const persistentFocusContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentFocus,
  });
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const persistentRecallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentRecall,
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
  useSyncExternalStore(
    focusContext.subscribe,
    focusContext.getSnapshot,
    focusContext.getSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const activeSession =
    userId !== null && recallSnapshot?.userId === userId
      ? recallSnapshot
      : null;
  const activeFocusSession =
    userId === null ? null : focusContext.getActiveSession({ userId });
  const isBreakActive = isBreakIntervalActive(activeFocusSession);
  const currentNote =
    activeSession === null
      ? null
      : (activeSession.notes[activeSession.currentQuestionIndex] ?? null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [pendingRating, setPendingRating] =
    useState<FlashCardRecallRating | null>(null);
  const [isEndDialogOpen, setEndDialogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (activeSession !== null) {
      return;
    }

    void navigate({ replace: true, to: "/recall" });
  }, [activeSession, navigate]);

  useEffect(() => {
    if (activeSession === null) {
      return;
    }

    setPendingRating(null);
  }, [activeSession]);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timerId);
  }, []);

  async function skipBreakInterval() {
    if (userId === null) {
      return;
    }

    if (persistentFocusContext === undefined) {
      focusContext.startNextFocusInterval({ userId });
      return;
    }

    await persistentFocusContext.startNextFocusInterval(userId);
  }

  function handleRecallError(error: unknown) {
    if (error instanceof AppRecallError) {
      setFeedbackMessage(error.message);
      return;
    }

    throw error;
  }

  async function revealNote() {
    if (userId === null || activeSession === null || isBreakActive) {
      return;
    }

    try {
      if (persistentRecallContext === undefined) {
        recallContext.revealFlashCardAnswer({
          sessionId: activeSession.id,
          userId,
        });
      } else {
        await persistentRecallContext.revealFlashCardAnswer(userId, {
          sessionId: activeSession.id,
        });
      }
      setFeedbackMessage(null);
    } catch (error) {
      handleRecallError(error);
    }
  }

  async function skipNote() {
    if (userId === null || activeSession === null || isBreakActive) {
      return;
    }

    try {
      let nextSession: RecallSession | null;

      if (persistentRecallContext === undefined) {
        nextSession = recallContext.skipFlashCardQuestion({
          sessionId: activeSession.id,
          userId,
        });
      } else {
        nextSession = await persistentRecallContext.skipFlashCardQuestion(
          userId,
          {
            sessionId: activeSession.id,
          },
        );
      }

      setFeedbackMessage(null);

      if (nextSession === null) {
        if (activeSession.attempts.length > 0) {
          setRecallSavedMessage();
        }
        await navigate({ to: "/recall" });
      }
    } catch (error) {
      handleRecallError(error);
    }
  }

  async function submitRating() {
    if (
      userId === null ||
      activeSession === null ||
      pendingRating === null ||
      isBreakActive
    ) {
      return;
    }

    try {
      let nextSession: RecallSession | null;

      if (persistentRecallContext === undefined) {
        nextSession = recallContext.rateFlashCardAnswer({
          rating: pendingRating,
          sessionId: activeSession.id,
          userId,
        });
      } else {
        nextSession = await persistentRecallContext.rateFlashCardAnswer(
          userId,
          {
            rating: pendingRating,
            sessionId: activeSession.id,
          },
        );
      }

      setFeedbackMessage(null);
      setPendingRating(null);

      if (nextSession === null) {
        setRecallSavedMessage();
        await navigate({ to: "/recall" });
      }
    } catch (error) {
      handleRecallError(error);
    }
  }

  async function confirmEndSession() {
    if (userId === null || activeSession === null) {
      return;
    }

    try {
      if (persistentRecallContext === undefined) {
        recallContext.endFlashCardSession({
          sessionId: activeSession.id,
          userId,
        });
      } else {
        await persistentRecallContext.endFlashCardSession(userId, {
          sessionId: activeSession.id,
        });
      }

      if (activeSession.attempts.length > 0) {
        setRecallSavedMessage();
      }

      setFeedbackMessage(null);
      setEndDialogOpen(false);
      await navigate({ to: "/recall" });
    } catch (error) {
      handleRecallError(error);
    }
  }

  const progress = useMemo(() => {
    if (activeSession === null) {
      return {
        answeredCount: 0,
        currentPosition: 0,
        progressPercent: 0,
        remainingCount: 0,
        totalCount: 0,
      };
    }

    const totalCount = activeSession.notes.length;
    const answeredCount = activeSession.attempts.length;
    const currentPosition = Math.min(
      activeSession.currentQuestionIndex + 1,
      totalCount,
    );

    return {
      answeredCount,
      currentPosition,
      progressPercent:
        totalCount === 0 ? 0 : Math.round((answeredCount / totalCount) * 100),
      remainingCount: Math.max(totalCount - answeredCount, 0),
      totalCount,
    };
  }, [activeSession]);

  if (activeSession === null || currentNote === null) {
    return null;
  }

  return (
    <section className="recall-shell" aria-label="Recall session">
      <header className="recall-shell__header">
        <div className="recall-shell__bar">
          <div className="recall-shell__context">
            <p className="section-label">Recall / Session</p>
            <h3>Recall session</h3>
            <p className="muted">
              Try to recall each note before revealing it.
            </p>
          </div>
          <button
            className="notes-action recall-shell__end"
            onClick={() => setEndDialogOpen(true)}
            type="button"
          >
            End session
          </button>
        </div>

        <div className="recall-progress">
          <div className="recall-progress__summary">
            <strong>{`${progress.currentPosition} of ${progress.totalCount}`}</strong>
            <span>Notes</span>
            <span>{formatRecallModeLabel(activeSession.mode)}</span>
            <span>{formatElapsedTime(activeSession.createdAt, now)}</span>
          </div>
          <div
            aria-label="Recall progress"
            aria-valuemax={progress.totalCount}
            aria-valuemin={0}
            aria-valuenow={progress.answeredCount}
            className="recall-progress__track"
            role="progressbar"
          >
            <div
              className="recall-progress__fill"
              style={{ width: `${progress.progressPercent}%` }}
            />
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
          <fieldset
            className="recall-card__study-surface"
            disabled={isBreakActive}
          >
            <legend className="sr-only">FlashCard recall</legend>
            <div className="recall-card__top recall-card__top--single">
              <div className="recall-card__face recall-card__face--prompt">
                <h4 className="recall-card__question">{currentNote.title}</h4>
                {!activeSession.isAnswerRevealed ? (
                  <div className="recall-card__hidden-body">
                    <p>Note body hidden</p>
                    <span>Recall the answer, then reveal the Note.</span>
                  </div>
                ) : (
                  <RecallNoteDetails note={currentNote} />
                )}
              </div>
            </div>

            {!activeSession.isAnswerRevealed ? (
              <div className="recall-card__footer">
                <button
                  className="notes-action notes-action-primary recall-card__reveal"
                  onClick={revealNote}
                  type="button"
                >
                  Reveal note
                </button>
                <button
                  className="notes-action"
                  onClick={skipNote}
                  type="button"
                >
                  Skip
                </button>
                <button
                  className="notes-action"
                  onClick={() => setEndDialogOpen(true)}
                  type="button"
                >
                  End session
                </button>
              </div>
            ) : (
              <div className="recall-card__footer recall-card__footer--ratings">
                <fieldset className="recall-rating-row">
                  <legend>Self-rating</legend>
                  {ratingOptions.map((option) => (
                    <button
                      aria-label={option.label}
                      aria-pressed={pendingRating === option.rating}
                      className={`notes-action recall-rating recall-rating--${option.rating}`}
                      data-selected={pendingRating === option.rating}
                      key={option.rating}
                      onClick={() => setPendingRating(option.rating)}
                      type="button"
                    >
                      <span className="recall-rating__label">
                        {option.label}
                      </span>
                      <span className="recall-rating__description">
                        {option.description}
                      </span>
                    </button>
                  ))}
                </fieldset>
                <button
                  className="notes-action notes-action-primary"
                  disabled={pendingRating === null}
                  onClick={submitRating}
                  type="button"
                >
                  Next note
                </button>
              </div>
            )}
          </fieldset>
          {isBreakActive && userId !== null ? (
            <BreakIntervalOverlay onSkipBreak={skipBreakInterval} />
          ) : null}
        </article>

        <SessionOverviewPanel
          answeredCount={progress.answeredCount}
          currentNote={currentNote}
          notes={activeSession.notes}
          remainingCount={progress.remainingCount}
        />
      </div>

      {isEndDialogOpen ? (
        <EndSessionDialog
          hasAttempts={activeSession.attempts.length > 0}
          onCancel={() => setEndDialogOpen(false)}
          onConfirm={confirmEndSession}
        />
      ) : null}
    </section>
  );
}

function RecallNoteDetails({ note }: { note: FlashCardRecallNote }) {
  return (
    <div className="recall-note-details">
      <p className="recall-card__body">{note.body}</p>
      {note.metaphors.length > 0 || note.acronyms.length > 0 ? (
        <div className="recall-memory-aids">
          {note.metaphors.length > 0 ? (
            <section aria-label="Metaphors">
              <h5>Metaphors</h5>
              <ul>
                {note.metaphors.map((metaphor) => (
                  <li key={metaphor.description}>{metaphor.description}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {note.acronyms.length > 0 ? (
            <section aria-label="Acronyms">
              <h5>Acronyms</h5>
              <ul>
                {note.acronyms.map((acronym) => (
                  <li key={acronym.description}>{acronym.description}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SessionOverviewPanel({
  answeredCount,
  currentNote,
  notes,
  remainingCount,
}: {
  answeredCount: number;
  currentNote: FlashCardRecallNote;
  notes: readonly FlashCardRecallNote[];
  remainingCount: number;
}) {
  return (
    <aside
      aria-label="Session overview"
      className="recall-session-side recall-session-overview"
    >
      <div className="recall-overview-metrics">
        <div>
          <span className="section-label">Selected Notes</span>
          <strong>{notes.length}</strong>
        </div>
        <div>
          <span className="section-label">Answered</span>
          <strong>{answeredCount}</strong>
        </div>
        <div>
          <span className="section-label">Remaining</span>
          <strong>{remainingCount}</strong>
        </div>
      </div>
      <section>
        <p className="section-label">Randomized order</p>
        <ol className="recall-question-list">
          {notes.map((note, index) => (
            <li key={note.id}>
              <span
                className="recall-question-list__button"
                data-current={note.id === currentNote.id}
              >
                <span className="recall-question-list__index">{index + 1}</span>
                <span className="recall-question-list__title">
                  {note.title}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <Link className="notes-action" to="/recall">
        Results
      </Link>
    </aside>
  );
}

function EndSessionDialog({
  hasAttempts,
  onCancel,
  onConfirm,
}: {
  hasAttempts: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      aria-labelledby="recall-end-dialog-title"
      className="recall-dialog-backdrop"
      role="presentation"
    >
      <section
        aria-labelledby="recall-end-dialog-title"
        aria-modal="true"
        className="recall-dialog"
        role="dialog"
      >
        <h4 id="recall-end-dialog-title">
          {hasAttempts ? "End recall session?" : "Discard recall session?"}
        </h4>
        <p className="muted">
          {hasAttempts
            ? "Attempted Questions will be saved to Results."
            : "No attempted Questions will be saved."}
        </p>
        <div className="recall-dialog__actions">
          <button className="notes-action" onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="notes-action notes-action-primary"
            onClick={onConfirm}
            type="button"
          >
            {hasAttempts ? "End session" : "Discard session"}
          </button>
        </div>
      </section>
    </div>
  );
}
