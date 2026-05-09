import {
  createFileRoute,
  Link,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  type AppSessionSnapshot,
  resolveProtectedSessionSnapshot,
} from "../access/session/session";
import { BreakIntervalOverlay, isBreakIntervalActive } from "../focus";
import { useAppTranslation } from "../language";
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
  const totalMinutes = Math.floor(elapsedSeconds / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

function RecallSessionPage() {
  const { t } = useAppTranslation();
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
  const routedSessionSnapshot = useRouteContext({
    from: "/_protected",
    select: (context) => context.sessionSnapshot,
  });
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    sessionContext.subscribe,
    sessionContext.getSnapshot,
    sessionContext.getSnapshot,
  );
  const effectiveSessionSnapshot = resolveProtectedSessionSnapshot({
    routedSessionSnapshot,
    sessionSnapshot,
  });
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
  const userId = effectiveSessionSnapshot.user?.id ?? null;
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
        totalCount === 0 ? 0 : Math.round((currentPosition / totalCount) * 100),
      remainingCount: Math.max(totalCount - answeredCount, 0),
      totalCount,
    };
  }, [activeSession]);

  if (activeSession === null || currentNote === null) {
    return null;
  }

  return (
    <section className="recall-shell" aria-label={t("recall.session.title")}>
      <header className="recall-shell__header">
        <div className="recall-shell__context">
          <nav
            aria-label={t("recall.breadcrumb")}
            className="recall-breadcrumb"
          >
            <Link to="/recall">{t("shell.workspace.recall")}</Link> /{" "}
            {t("recall.session.breadcrumbLabel")}
          </nav>
          <h3>{t("recall.session.title")}</h3>
        </div>

        <div className="recall-progress-card">
          <div className="recall-progress-card__count">
            <strong>{`${progress.currentPosition} of ${progress.totalCount}`}</strong>
            <span>{t("recall.session.notes")}</span>
          </div>
          <div
            aria-label={t("recall.session.progress")}
            aria-valuemax={progress.totalCount}
            aria-valuemin={0}
            aria-valuenow={progress.currentPosition}
            className="recall-progress-card__track"
            role="progressbar"
          >
            <div
              className="recall-progress-card__fill"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>
          <p className="recall-progress-card__mode">
            <FlashCardModeIcon />
            <span>{formatRecallModeLabel(activeSession.mode)}</span>
          </p>
          <p className="recall-progress-card__time">
            <ClockLineIcon />
            <span>{formatElapsedTime(activeSession.createdAt, now)}</span>
            <small>{t("recall.session.elapsed")}</small>
          </p>
        </div>
      </header>

      {feedbackMessage !== null ? (
        <p className="recall-shell__error" role="alert">
          {feedbackMessage}
        </p>
      ) : null}

      <div className="recall-session-layout">
        <div className="recall-session-main">
          <article
            className="recall-card"
            data-revealed={activeSession.isAnswerRevealed}
          >
            <fieldset
              className="recall-card__study-surface"
              disabled={isBreakActive}
            >
              <legend className="sr-only">
                {t("recall.session.flashCard")}
              </legend>
              {!activeSession.isAnswerRevealed ? (
                <div className="recall-card__hidden-state">
                  <span aria-hidden="true" className="recall-card__prompt-icon">
                    <QuestionPromptIcon />
                  </span>
                  <h4 className="recall-card__question">{currentNote.title}</h4>
                  <span className="recall-card__divider" />
                  <p className="recall-card__hint">
                    <SparkIcon />
                    <span>{t("recall.session.hint")}</span>
                  </p>
                  <button
                    className="notes-action notes-action-primary recall-card__reveal"
                    onClick={revealNote}
                    type="button"
                  >
                    <RevealIcon />
                    <span>{t("recall.session.reveal")}</span>
                  </button>
                </div>
              ) : (
                <div className="recall-card__revealed-state">
                  <h4 className="recall-card__question">{currentNote.title}</h4>
                  <RecallNoteDetails note={currentNote} />
                  <div className="recall-card__footer recall-card__footer--ratings">
                    <fieldset className="recall-rating-row">
                      <legend>{t("recall.session.selfRating")}</legend>
                      {ratingOptions.map((option) => (
                        <button
                          aria-label={t(`recall.rating.${option.rating}`)}
                          aria-pressed={pendingRating === option.rating}
                          className={`notes-action recall-rating recall-rating--${option.rating}`}
                          data-selected={pendingRating === option.rating}
                          key={option.rating}
                          onClick={() => setPendingRating(option.rating)}
                          type="button"
                        >
                          <span className="recall-rating__label">
                            {t(`recall.rating.${option.rating}`)}
                          </span>
                          <span className="recall-rating__description">
                            {t(
                              `recall.session.rating.${option.rating}.description`,
                            )}
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
                      {t("recall.session.next")}
                    </button>
                  </div>
                </div>
              )}
            </fieldset>
            {isBreakActive && userId !== null ? (
              <BreakIntervalOverlay onSkipBreak={skipBreakInterval} />
            ) : null}
          </article>

          <div className="recall-session-main__actions">
            <button
              className="notes-action recall-session-main__action"
              disabled={isBreakActive}
              onClick={skipNote}
              type="button"
            >
              <SkipIcon />
              <span>{t("recall.session.skip")}</span>
            </button>
            <button
              className="notes-action recall-session-main__action"
              disabled={isBreakActive}
              onClick={() => setEndDialogOpen(true)}
              type="button"
            >
              <EndSessionIcon />
              <span>{t("recall.session.dialog.end")}</span>
            </button>
          </div>
        </div>

        <SessionOverviewPanel
          answeredCount={progress.answeredCount}
          remainingCount={progress.remainingCount}
          selectedCount={progress.totalCount}
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
  const { t } = useAppTranslation();

  return (
    <div className="recall-note-details">
      <p className="recall-card__body">{note.body}</p>
      {note.metaphors.length > 0 || note.acronyms.length > 0 ? (
        <div className="recall-memory-aids">
          {note.metaphors.length > 0 ? (
            <section aria-label={t("recall.session.answer.metaphors")}>
              <h5>{t("recall.session.answer.metaphors")}</h5>
              <ul>
                {note.metaphors.map((metaphor) => (
                  <li key={metaphor.description}>{metaphor.description}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {note.acronyms.length > 0 ? (
            <section aria-label={t("recall.session.answer.acronyms")}>
              <h5>{t("recall.session.answer.acronyms")}</h5>
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
  remainingCount,
  selectedCount,
}: {
  answeredCount: number;
  remainingCount: number;
  selectedCount: number;
}) {
  const { t } = useAppTranslation();

  return (
    <aside
      aria-label={t("recall.session.overview")}
      className="recall-session-overview"
    >
      <h4>{t("recall.session.overview")}</h4>
      <div className="recall-session-overview__metrics">
        <SessionOverviewMetric
          icon={<SelectedNotesIcon />}
          label={t("recall.session.overview.selected")}
          tone="selected"
          value={selectedCount}
        />
        <SessionOverviewMetric
          icon={<AnsweredIcon />}
          label={t("recall.session.overview.answered")}
          tone="answered"
          value={answeredCount}
        />
        <SessionOverviewMetric
          icon={<RemainingIcon />}
          label={t("recall.session.overview.remaining")}
          tone="remaining"
          value={remainingCount}
        />
      </div>
      <p className="recall-session-overview__hint">
        <InfoIcon />
        <span>{t("recall.session.overview.randomized")}</span>
      </p>
    </aside>
  );
}

type SessionOverviewMetricTone = "answered" | "remaining" | "selected";

function SessionOverviewMetric({
  icon,
  label,
  tone,
  value,
}: {
  icon: ReactNode;
  label: string;
  tone: SessionOverviewMetricTone;
  value: number;
}) {
  const { t } = useAppTranslation();

  return (
    <div className="recall-overview-metric">
      <span
        aria-hidden="true"
        className="recall-overview-metric__icon"
        data-tone={tone}
      >
        {icon}
      </span>
      <div className="recall-overview-metric__content">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
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
  const { t } = useAppTranslation();

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
          {hasAttempts
            ? t("recall.session.dialog.endTitle")
            : t("recall.session.dialog.discardTitle")}
        </h4>
        <p className="muted">
          {hasAttempts
            ? t("recall.session.dialog.endBody")
            : t("recall.session.dialog.discardBody")}
        </p>
        <div className="recall-dialog__actions">
          <button className="notes-action" onClick={onCancel} type="button">
            {t("recall.session.dialog.cancel")}
          </button>
          <button
            className="notes-action notes-action-primary"
            onClick={onConfirm}
            type="button"
          >
            {hasAttempts
              ? t("recall.session.dialog.end")
              : t("recall.session.dialog.discard")}
          </button>
        </div>
      </section>
    </div>
  );
}

function FlashCardModeIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      viewBox="0 0 24 24"
      width="14"
    >
      <rect
        height="12"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.8"
        width="16"
        x="4"
        y="6"
      />
      <path
        d="M8 10.5h8M8 13.5h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ClockLineIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="15"
      viewBox="0 0 24 24"
      width="15"
    >
      <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7.8v4.7l2.9 2.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function QuestionPromptIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <rect
        height="15"
        rx="2.6"
        stroke="currentColor"
        strokeWidth="1.8"
        width="15"
        x="4.5"
        y="4.5"
      />
      <path
        d="M10.8 10.1a1.9 1.9 0 1 1 2.8 1.7c-.9.5-1.3.9-1.3 1.6v.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12.3" cy="16.8" fill="currentColor" r="1.1" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="15"
      viewBox="0 0 24 24"
      width="15"
    >
      <path
        d="m12 3 1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3Zm6.2 10.8.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1ZM5.4 13.8l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function RevealIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      viewBox="0 0 24 24"
      width="14"
    >
      <path
        d="m7.2 7 4.8 5-4.8 5M12 7l4.8 5-4.8 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function EndSessionIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      viewBox="0 0 24 24"
      width="14"
    >
      <rect
        height="10.5"
        rx="1.8"
        stroke="currentColor"
        strokeWidth="1.8"
        width="10.5"
        x="6.75"
        y="6.75"
      />
    </svg>
  );
}

function SelectedNotesIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <rect
        height="15"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.8"
        width="13"
        x="6.5"
        y="4.5"
      />
      <path
        d="M9.3 9.2h6M9.3 12h6M9.3 14.8h4.2M8.5 7.3H6.2a1.7 1.7 0 0 0-1.7 1.7v8.8a1.7 1.7 0 0 0 1.7 1.7h8.8a1.7 1.7 0 0 0 1.7-1.7v-2.3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function AnsweredIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m8.3 12.2 2.4 2.5 5-5.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function RemainingIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8.2v4.3l2.7 1.9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="15"
      viewBox="0 0 24 24"
      width="15"
    >
      <circle cx="12" cy="12" r="8.7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 10.2v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="7.8" fill="currentColor" r="1.1" />
    </svg>
  );
}
