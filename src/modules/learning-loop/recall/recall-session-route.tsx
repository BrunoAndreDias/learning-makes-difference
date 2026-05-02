import {
  createFileRoute,
  Link,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { AppSessionSnapshot } from "../../access/session/session";
import { BreakIntervalOverlay } from "../focus/break-interval-overlay";
import { isBreakIntervalActive } from "../focus/focus";
import { formatRecallModeLabel } from "../shared/learner-copy";
import {
  AppRecallError,
  type AppRecallSnapshot,
  type FlashCardRecallNote,
  type FlashCardRecallRating,
  summarizeAttempts,
} from "./recall";

type RecallSessionRouteOptions = {
  breadcrumbCurrent: string;
  breadcrumbLabel: string;
  breadcrumbTo: "/notes" | "/recall";
  returnTo: "/notes" | "/recall";
};

type RecallQuestionSnapshotState = {
  isAnswerRevealed: boolean;
  selfRating: FlashCardRecallRating | null;
};

type RecallSessionFocusTarget = "missed-rating" | "prompt" | "reveal" | null;

export const Route = createFileRoute("/_protected/recall/session")({
  component: RecallSessionPage,
});

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
  const focusContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.focus,
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
  const activeFocusSession =
    userId === null ? null : focusContext.getActiveSession({ userId });
  const isBreakActive = isBreakIntervalActive(activeFocusSession);
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
  const promptButtonRef = useRef<HTMLButtonElement | null>(null);
  const revealButtonRef = useRef<HTMLButtonElement | null>(null);
  const missedRatingButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousCurrentNoteIdRef = useRef<string | null>(null);
  const previousRevealStateRef = useRef(false);

  useEffect(() => {
    if (activeSession !== null) {
      return;
    }

    void navigate({ replace: true, to: props.returnTo });
  }, [activeSession, navigate, props.returnTo]);

  useEffect(() => {
    if (currentNote === null) {
      return;
    }

    const focusTarget = getRecallSessionFocusTarget({
      isAnswerRevealed: activeSession?.isAnswerRevealed ?? false,
      noteId: currentNote.id,
      previousIsAnswerRevealed: previousRevealStateRef.current,
      previousNoteId: previousCurrentNoteIdRef.current,
    });

    switch (focusTarget) {
      case "missed-rating":
        missedRatingButtonRef.current?.focus();
        break;
      case "prompt":
        promptButtonRef.current?.focus();
        break;
      case "reveal":
        revealButtonRef.current?.focus();
        break;
      case null:
        break;
    }

    previousCurrentNoteIdRef.current = currentNote.id;
    previousRevealStateRef.current = activeSession?.isAnswerRevealed ?? false;
  }, [activeSession?.isAnswerRevealed, currentNote]);

  function handleRecallError(error: unknown) {
    if (error instanceof AppRecallError) {
      setFeedbackMessage(error.message);
      return;
    }

    throw error;
  }

  function handleRevealAnswer() {
    if (userId === null || activeSession === null || isBreakActive) {
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
    if (userId === null || activeSession === null || isBreakActive) {
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

  function handleAttemptTextChange(text: string) {
    if (userId === null || activeSession === null || isBreakActive) {
      return;
    }

    try {
      recallContext.updateFlashCardAttemptText({
        sessionId: activeSession.id,
        text,
        userId,
      });
      setFeedbackMessage(null);
    } catch (error) {
      handleRecallError(error);
    }
  }

  function skipBreakInterval() {
    if (userId === null) {
      return;
    }

    focusContext.startNextFocusInterval({
      userId,
    });
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
  const progressValueText = getRecallProgressValueText({
    completedCount,
    positionLabel,
    ratingTotals,
    totalCount,
  });
  const selectedSnapshotNote =
    selectedSnapshotNoteId === null
      ? null
      : (activeSession.notes.find(
          (note) => note.id === selectedSnapshotNoteId,
        ) ?? null);
  const selectedSnapshotQuestion =
    selectedSnapshotNoteId === null
      ? null
      : (activeSession.questions.find(
          (question) => question.noteId === selectedSnapshotNoteId,
        ) ?? null);

  return (
    <section className="recall-shell" aria-label="Recall session">
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
            <p className="sr-only">
              {formatRecallModeLabel(activeSession.mode)} session
            </p>
            <p className="recall-shell__label">Selected notes</p>
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
            aria-label="Recall progress"
            aria-valuemax={totalCount}
            aria-valuemin={0}
            aria-valuenow={completedCount}
            aria-valuetext={progressValueText}
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
          <fieldset
            className="recall-card__study-surface"
            disabled={isBreakActive}
          >
            <legend className="sr-only">Recall study surface</legend>
            <div className="recall-card__top">
              <div className="recall-card__face recall-card__face--prompt">
                <button
                  aria-label={`Show note snapshot for ${currentNote.title}`}
                  className="recall-card__question"
                  onClick={() => setSelectedSnapshotNoteId(currentNote.id)}
                  ref={promptButtonRef}
                  type="button"
                >
                  {currentNote.title}
                </button>
                {!activeSession.isAnswerRevealed ? (
                  <p className="muted recall-card__hint">
                    Recall the answer, then reveal it to compare.
                  </p>
                ) : null}
                {!activeSession.isAnswerRevealed ? (
                  <label className="recall-card__attempt-field">
                    <span>What do you remember?</span>
                    <textarea
                      name="typed-recall-attempt"
                      onChange={(event) =>
                        handleAttemptTextChange(event.target.value)
                      }
                      placeholder="Type your answer or leave this blank."
                      rows={5}
                      value={activeSession.draftAnswer ?? ""}
                    />
                  </label>
                ) : null}
              </div>

              <div className="recall-card__actions">
                {!activeSession.isAnswerRevealed ? (
                  <button
                    className="notes-action notes-action-primary recall-card__reveal"
                    onClick={handleRevealAnswer}
                    ref={revealButtonRef}
                    type="button"
                  >
                    Reveal answer
                  </button>
                ) : (
                  <fieldset className="recall-rating-row">
                    <legend className="sr-only">Rate your recall</legend>
                    <button
                      aria-label="Missed it"
                      className="notes-action recall-rating recall-rating--missed"
                      onClick={() => void handleRateAnswer("missed")}
                      ref={missedRatingButtonRef}
                      type="button"
                    >
                      <span className="recall-rating__label">Missed it</span>
                      <span className="recall-rating__description">
                        Could not recall it.
                      </span>
                    </button>
                    <button
                      aria-label="Partly recalled"
                      className="notes-action recall-rating recall-rating--partial"
                      onClick={() => void handleRateAnswer("partial")}
                      type="button"
                    >
                      <span className="recall-rating__label">
                        Partly recalled
                      </span>
                      <span className="recall-rating__description">
                        Some gaps remained.
                      </span>
                    </button>
                    <button
                      aria-label="Nailed it"
                      className="notes-action recall-rating recall-rating--nailed"
                      onClick={() => void handleRateAnswer("nailed")}
                      type="button"
                    >
                      <span className="recall-rating__label">Nailed it</span>
                      <span className="recall-rating__description">
                        Recalled it clearly.
                      </span>
                    </button>
                  </fieldset>
                )}
              </div>
            </div>

            {activeSession.isAnswerRevealed ? (
              <RecallNoteDetails note={currentNote} />
            ) : null}
          </fieldset>
          {isBreakActive && userId !== null ? (
            <BreakIntervalOverlay onSkipBreak={skipBreakInterval} />
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
              const questionButtonLabel = getRecallQuestionButtonLabel({
                attempt,
                index,
                isCurrent,
                isSelected,
                noteTitle: note.title,
                totalCount,
              });

              return (
                <li key={note.id}>
                  <button
                    aria-current={isCurrent ? "step" : undefined}
                    aria-label={questionButtonLabel}
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
                    <span className="recall-question-list__states">
                      {isCurrent ? (
                        <span className="recall-question-list__state">
                          Current
                        </span>
                      ) : null}
                      {isSelected ? (
                        <span className="recall-question-list__state">
                          Snapshot open
                        </span>
                      ) : null}
                    </span>
                    {attempt !== undefined ? (
                      <span
                        className="recall-question-list__rating"
                        data-rating={attempt.rating}
                      >
                        {formatRecallAttemptRating(attempt.rating)}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>

          <NoteSnapshotPanel
            note={selectedSnapshotNote}
            question={selectedSnapshotQuestion}
          />
        </aside>
      </div>
    </section>
  );
}

function RecallNoteDetails({ note }: { note: FlashCardRecallNote }) {
  return (
    <>
      <p className="recall-card__body">{note.body}</p>
      {note.metaphors.length > 0 ? (
        <section aria-label="Metaphors">
          <h3>Metaphors</h3>
          <ul>
            {note.metaphors.map((metaphor) => (
              <li key={`${metaphor.title}-${metaphor.explanation}`}>
                <strong>{metaphor.title}</strong>
                <p>{metaphor.explanation}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {note.acronyms.length > 0 ? (
        <section aria-label="Acronyms">
          <h3>Acronyms</h3>
          <ul>
            {note.acronyms.map((acronym) => (
              <li key={`${acronym.shortForm}-${acronym.expansion}`}>
                <strong>{acronym.shortForm}</strong>
                <p>{acronym.expansion}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function NoteSnapshotPanel({
  note,
  question,
}: {
  note: FlashCardRecallNote | null;
  question: RecallQuestionSnapshotState | null;
}) {
  if (note === null || question === null) {
    return (
      <section
        aria-live="polite"
        className="recall-note-snapshot recall-note-snapshot--empty"
        role="status"
      >
        <p>Select a question to see its note snapshot.</p>
      </section>
    );
  }

  if (!question.isAnswerRevealed && question.selfRating === null) {
    return (
      <section
        aria-live="polite"
        className="recall-note-snapshot recall-note-snapshot--empty"
        role="status"
      >
        <p>Reveal the answer to review the note snapshot.</p>
      </section>
    );
  }

  return (
    <section aria-label="Note snapshot" className="recall-note-snapshot">
      <p className="recall-note-snapshot__label">Note snapshot</p>
      <h3>{note.title}</h3>
      <RecallNoteDetails note={note} />
    </section>
  );
}

function getRecallSessionFocusTarget({
  isAnswerRevealed,
  noteId,
  previousIsAnswerRevealed,
  previousNoteId,
}: {
  isAnswerRevealed: boolean;
  noteId: string;
  previousIsAnswerRevealed: boolean;
  previousNoteId: string | null;
}): RecallSessionFocusTarget {
  if (!previousIsAnswerRevealed && isAnswerRevealed) {
    return "missed-rating";
  }

  if (previousNoteId !== noteId) {
    return "prompt";
  }

  if (!isAnswerRevealed) {
    return "reveal";
  }

  return null;
}

function getRecallProgressValueText({
  completedCount,
  positionLabel,
  ratingTotals,
  totalCount,
}: {
  completedCount: number;
  positionLabel: string;
  ratingTotals: ReturnType<typeof summarizeAttempts>;
  totalCount: number;
}) {
  const segments = [
    positionLabel,
    `Completed ${completedCount} of ${totalCount} questions`,
  ];

  if (completedCount > 0) {
    segments.push(
      `${ratingTotals.nailed} nailed, ${ratingTotals.partial} partial, ${ratingTotals.missed} missed`,
    );
  }

  return `${segments.join(". ")}.`;
}

function formatRecallAttemptRating(rating: FlashCardRecallRating) {
  switch (rating) {
    case "missed":
      return "Missed";
    case "partial":
      return "Partial";
    case "nailed":
      return "Nailed";
  }
}

function getRecallQuestionButtonLabel({
  attempt,
  index,
  isCurrent,
  isSelected,
  noteTitle,
  totalCount,
}: {
  attempt:
    | {
        noteId: string;
        rating: FlashCardRecallRating;
        text?: string | null;
      }
    | undefined;
  index: number;
  isCurrent: boolean;
  isSelected: boolean;
  noteTitle: string;
  totalCount: number;
}) {
  const segments = [`Question ${index + 1} of ${totalCount}`, noteTitle];

  if (isCurrent) {
    segments.push("Current prompt");
  }

  if (isSelected) {
    segments.push("Snapshot open");
  }

  if (attempt !== undefined) {
    segments.push(`Rating ${formatRecallAttemptRating(attempt.rating)}`);
  }

  return `${segments.join(". ")}.`;
}
