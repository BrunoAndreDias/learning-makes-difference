import {
  createFileRoute,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Button } from "../../design-system/button";
import { PageHeader } from "../../design-system/page-header";
import {
  type AppSessionSnapshot,
  resolveProtectedSessionSnapshot,
} from "../access/session/session";
import { BreakIntervalOverlay, isBreakIntervalActive } from "../focus";
import { useAppTranslation } from "../language";
import {
  type AppStudyNote,
  AppStudyNotesError,
  listStudyNotesForUser,
  type UpdateStudyNoteInput,
} from "../study-notes";
import { appRoutePaths } from "../workspace-shell/app-shell/route-paths";
import {
  formatRecallModeLabel,
  getRecallRatingDescriptionTranslationKey,
  getRecallRatingTranslationKey,
} from "./learner-copy";
import {
  AppRecallError,
  type AppRecallSnapshot,
  type FlashCardRecallNote,
  type FlashCardRecallRating,
  type RecallQuestion,
  type RecallSession,
} from "./recall";
import {
  findAcceptedVariantMatch,
  isMeaningfulAcceptedVariantCandidateText,
} from "./recall-answer-check";
import { RecallAnswerCheckPanel } from "./recall-answer-check-panel";

const recallSessionSavedMessageKey = "learning-makes-difference:recall-saved";
const recallRatingOptions = [
  "forgot",
  "hard",
  "good",
  "easy",
] as const satisfies readonly FlashCardRecallRating[];
type RecallSessionExitTarget =
  | typeof appRoutePaths.recall
  | typeof appRoutePaths.recallResults;

export const Route = createFileRoute("/_protected/recall/session")({
  component: RecallSessionPage,
});

function setRecallSavedMessage() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(recallSessionSavedMessageKey, "true");
}

function getRecallSessionExitTarget(
  session: Pick<RecallSession, "attempts">,
): RecallSessionExitTarget {
  return session.attempts.length > 0
    ? appRoutePaths.recallResults
    : appRoutePaths.recall;
}

function isSuccessfulAcceptedVariantRating(
  rating: FlashCardRecallRating | null,
): boolean {
  return rating === "good" || rating === "easy";
}

function createAcceptedVariantSaveInput(
  studyNote: AppStudyNote,
  typedAnswer: string,
): UpdateStudyNoteInput {
  return {
    acceptedVariants: [
      ...studyNote.acceptedVariants.map((variant) => ({ ...variant })),
      {
        id: globalThis.crypto.randomUUID(),
        text: typedAnswer.trim(),
      },
    ],
    acronyms: studyNote.acronyms.map((acronym) => ({ ...acronym })),
    expectedAnswer: studyNote.expectedAnswer,
    keyIdeas: studyNote.keyIdeas.map((keyIdea) => ({
      ...keyIdea,
      acceptedPhrases: [...keyIdea.acceptedPhrases],
      prohibitedPhrases: [...keyIdea.prohibitedPhrases],
    })),
    labelIds: [...studyNote.labelIds],
    metaphors: studyNote.metaphors.map((metaphor) => ({ ...metaphor })),
    prompt: studyNote.prompt,
    prohibitedPhrases: studyNote.prohibitedPhrases.map((phrase) => ({
      ...phrase,
    })),
    sourceBody: studyNote.source.body,
    sourceTitle: studyNote.source.title,
  };
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
  const studyNotesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.studyNotes,
  });
  const persistentStudyNotesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentStudyNotes,
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
  const studyNotesStore = persistentStudyNotesContext ?? studyNotesContext;
  const studyNotesSnapshot = useSyncExternalStore(
    studyNotesStore.subscribe,
    studyNotesStore.getSnapshot,
    studyNotesStore.getSnapshot,
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
  const activeQuestionKey =
    activeSession === null
      ? null
      : `${activeSession.id}:${activeSession.currentQuestionIndex}`;
  const storedDraftAnswer = activeSession?.draftAnswer ?? "";
  const currentQuestion =
    activeSession === null
      ? null
      : (activeSession.questions[activeSession.currentQuestionIndex] ?? null);
  const currentNote =
    activeSession === null
      ? null
      : (activeSession.notes[activeSession.currentQuestionIndex] ?? null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [pendingRating, setPendingRating] =
    useState<FlashCardRecallRating | null>(null);
  const [isAnswerInputVisible, setAnswerInputVisible] = useState(false);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [isEndDialogOpen, setEndDialogOpen] = useState(false);
  const [acceptedVariantFeedbackMessage, setAcceptedVariantFeedbackMessage] =
    useState<string | null>(null);
  const [isAcceptedVariantPromptDismissed, setAcceptedVariantPromptDismissed] =
    useState(false);
  const [isSavingAcceptedVariant, setSavingAcceptedVariant] = useState(false);
  const sessionExitTargetRef = useRef<RecallSessionExitTarget | null>(null);

  useEffect(() => {
    if (activeSession !== null) {
      return;
    }

    void navigate({
      replace: true,
      to: sessionExitTargetRef.current ?? appRoutePaths.recall,
    });
  }, [activeSession, navigate]);

  useEffect(() => {
    if (activeSession === null) {
      return;
    }

    setPendingRating(null);
  }, [activeSession]);

  useEffect(() => {
    if (activeQuestionKey === null) {
      return;
    }

    setAnswerInputVisible(false);
    setAcceptedVariantFeedbackMessage(null);
    setAcceptedVariantPromptDismissed(false);
    setDraftAnswer(storedDraftAnswer);
    setSavingAcceptedVariant(false);
  }, [activeQuestionKey, storedDraftAnswer]);

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

  function handleStudyNoteError(error: unknown) {
    if (error instanceof AppStudyNotesError) {
      setFeedbackMessage(error.message);
      return;
    }

    throw error;
  }

  function saveDraftAnswer() {
    if (userId === null || activeSession === null) {
      return;
    }

    const currentDraftAnswer = activeSession.draftAnswer ?? "";

    if (currentDraftAnswer === draftAnswer) {
      return;
    }

    if (persistentRecallContext === undefined) {
      recallContext.updateFlashCardAttemptText({
        sessionId: activeSession.id,
        text: draftAnswer,
        userId,
      });
      return;
    }

    return persistentRecallContext.updateFlashCardAttemptText(userId, {
      sessionId: activeSession.id,
      text: draftAnswer,
    });
  }

  async function revealNote() {
    if (userId === null || activeSession === null || isBreakActive) {
      return;
    }

    try {
      const draftSave = saveDraftAnswer();

      if (draftSave !== undefined) {
        await draftSave;
      }

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
      const exitTarget = getRecallSessionExitTarget(activeSession);
      sessionExitTargetRef.current = exitTarget;
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
        await navigate({ to: exitTarget });
        return;
      }

      sessionExitTargetRef.current = null;
    } catch (error) {
      sessionExitTargetRef.current = null;
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
      sessionExitTargetRef.current = appRoutePaths.recallResults;
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
        await navigate({ to: appRoutePaths.recallResults });
        return;
      }

      sessionExitTargetRef.current = null;
    } catch (error) {
      sessionExitTargetRef.current = null;
      handleRecallError(error);
    }
  }

  async function confirmEndSession() {
    if (userId === null || activeSession === null) {
      return;
    }

    try {
      const exitTarget = getRecallSessionExitTarget(activeSession);
      sessionExitTargetRef.current = exitTarget;
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
      await navigate({ to: exitTarget });
    } catch (error) {
      sessionExitTargetRef.current = null;
      handleRecallError(error);
    }
  }

  async function saveAcceptedVariant() {
    if (userId === null || currentStudyNote === null) {
      return;
    }

    if (!canOfferAcceptedVariantSave) {
      return;
    }

    try {
      setSavingAcceptedVariant(true);
      const updateInput = createAcceptedVariantSaveInput(
        currentStudyNote,
        typedAnswerForAcceptedVariant,
      );

      if (persistentStudyNotesContext === undefined) {
        studyNotesContext.updateStudyNote(
          userId,
          currentStudyNote.id,
          updateInput,
        );
      } else {
        await persistentStudyNotesContext.updateStudyNote(
          userId,
          currentStudyNote.id,
          updateInput,
        );
      }

      setAcceptedVariantFeedbackMessage(
        t("recall.session.acceptedVariant.saved"),
      );
      setAcceptedVariantPromptDismissed(true);
      setFeedbackMessage(null);
    } catch (error) {
      handleStudyNoteError(error);
    } finally {
      setSavingAcceptedVariant(false);
    }
  }

  const progress = useMemo(() => {
    if (activeSession === null) {
      return {
        currentPosition: 0,
        progressPercent: 0,
        totalCount: 0,
      };
    }

    const totalCount = activeSession.notes.length;
    const currentPosition = Math.min(
      activeSession.currentQuestionIndex + 1,
      totalCount,
    );

    return {
      currentPosition,
      progressPercent:
        totalCount === 0 ? 0 : Math.round((currentPosition / totalCount) * 100),
      totalCount,
    };
  }, [activeSession]);

  const studyNotes = listStudyNotesForUser(studyNotesSnapshot, userId);
  const currentStudyNote =
    currentNote === null
      ? null
      : (studyNotes.find((studyNote) => studyNote.id === currentNote.id) ??
        null);
  const typedAnswerForAcceptedVariant = currentQuestion?.typedAnswer ?? "";
  const matchingAcceptedVariant =
    currentStudyNote === null
      ? undefined
      : findAcceptedVariantMatch({
          acceptedVariants: currentStudyNote.acceptedVariants,
          typedAnswer: typedAnswerForAcceptedVariant,
        });
  const canOfferAcceptedVariantSave =
    activeSession?.isAnswerRevealed === true &&
    currentStudyNote !== null &&
    isSuccessfulAcceptedVariantRating(pendingRating) &&
    !isAcceptedVariantPromptDismissed &&
    !isSavingAcceptedVariant &&
    isMeaningfulAcceptedVariantCandidateText(typedAnswerForAcceptedVariant) &&
    matchingAcceptedVariant === undefined;

  if (activeSession === null || currentNote === null) {
    return null;
  }

  return (
    <section className="recall-shell" aria-label={t("recall.session.title")}>
      <PageHeader
        actions={
          <div className="recall-session-status">
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
              <p className="recall-progress-card__randomized">
                <InfoIcon />
                <span>{t("recall.session.overview.randomized")}</span>
              </p>
            </div>
          </div>
        }
        actionsClassName="recall-shell__progress"
        className="recall-shell__header"
        copyClassName="recall-shell__context"
        headingLevel={3}
        title={t("recall.session.title")}
      />

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
                  <Button
                    aria-expanded={isAnswerInputVisible}
                    className="recall-card__answer-toggle"
                    onClick={() =>
                      setAnswerInputVisible((isVisible) => !isVisible)
                    }
                    type="button"
                  >
                    <WriteAnswerIcon />
                    <span>
                      {isAnswerInputVisible
                        ? t("recall.session.answer.hideInput")
                        : t("recall.session.answer.writeInput")}
                    </span>
                  </Button>
                  {isAnswerInputVisible ? (
                    <label className="recall-card__answer-field">
                      <span>{t("recall.session.answer.yourAnswer")}</span>
                      <textarea
                        onChange={(event) => setDraftAnswer(event.target.value)}
                        placeholder={t(
                          "recall.session.answer.inputPlaceholder",
                        )}
                        rows={4}
                        value={draftAnswer}
                      />
                    </label>
                  ) : null}
                  <Button
                    className="recall-card__reveal"
                    onClick={revealNote}
                    type="button"
                    variant="primary"
                  >
                    <RevealIcon />
                    <span>{t("recall.session.reveal")}</span>
                  </Button>
                </div>
              ) : (
                <div className="recall-card__revealed-state">
                  <h4 className="recall-card__question">{currentNote.title}</h4>
                  <RecallNoteDetails
                    note={currentNote}
                    question={currentQuestion}
                  />
                  {acceptedVariantFeedbackMessage !== null ? (
                    <p
                      className="recall-card__accepted-variant-feedback"
                      role="status"
                    >
                      {acceptedVariantFeedbackMessage}
                    </p>
                  ) : null}
                  {canOfferAcceptedVariantSave ? (
                    <section
                      aria-label={t(
                        "recall.session.acceptedVariant.confirmTitle",
                      )}
                      className="recall-card__accepted-variant-confirmation"
                    >
                      <p className="recall-card__accepted-variant-title">
                        {t("recall.session.acceptedVariant.confirmTitle")}
                      </p>
                      <p className="recall-card__accepted-variant-body">
                        {t("recall.session.acceptedVariant.confirmBody")}
                      </p>
                      <p className="recall-card__accepted-variant-answer">
                        {typedAnswerForAcceptedVariant.trim()}
                      </p>
                      <div className="recall-card__accepted-variant-actions">
                        <Button
                          disabled={isSavingAcceptedVariant}
                          onClick={saveAcceptedVariant}
                          type="button"
                          variant="primary"
                        >
                          {t("recall.session.acceptedVariant.save")}
                        </Button>
                        <Button
                          disabled={isSavingAcceptedVariant}
                          onClick={() =>
                            setAcceptedVariantPromptDismissed(true)
                          }
                          type="button"
                        >
                          {t("recall.session.acceptedVariant.dismiss")}
                        </Button>
                      </div>
                    </section>
                  ) : null}
                  <div className="recall-card__footer recall-card__footer--ratings">
                    <fieldset className="recall-rating-row">
                      <legend>{t("recall.session.selfRating")}</legend>
                      {recallRatingOptions.map((rating) => (
                        <Button
                          aria-label={t(getRecallRatingTranslationKey(rating))}
                          aria-pressed={pendingRating === rating}
                          className={`recall-rating recall-rating--${rating}`}
                          data-selected={pendingRating === rating}
                          key={rating}
                          onClick={() => setPendingRating(rating)}
                          type="button"
                        >
                          <span className="recall-rating__label">
                            {t(getRecallRatingTranslationKey(rating))}
                          </span>
                          <span className="recall-rating__description">
                            {t(
                              getRecallRatingDescriptionTranslationKey(rating),
                            )}
                          </span>
                        </Button>
                      ))}
                    </fieldset>
                    <Button
                      disabled={pendingRating === null}
                      onClick={submitRating}
                      type="button"
                      variant="primary"
                    >
                      {t("recall.session.next")}
                    </Button>
                  </div>
                </div>
              )}
            </fieldset>
            {isBreakActive && userId !== null ? (
              <BreakIntervalOverlay onSkipBreak={skipBreakInterval} />
            ) : null}
          </article>

          <div className="recall-session-main__actions">
            <Button
              className="recall-session-main__action"
              disabled={isBreakActive}
              onClick={skipNote}
              type="button"
            >
              <SkipIcon />
              <span>{t("recall.session.skip")}</span>
            </Button>
            <Button
              className="recall-session-main__action"
              disabled={isBreakActive}
              onClick={() => setEndDialogOpen(true)}
              type="button"
            >
              <EndSessionIcon />
              <span>{t("recall.session.dialog.end")}</span>
            </Button>
          </div>
        </div>
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

function RecallNoteDetails({
  note,
  question,
}: {
  note: FlashCardRecallNote;
  question: RecallQuestion | null;
}) {
  const { t } = useAppTranslation();
  const answerCheck = question?.answerCheck;

  return (
    <div className="recall-note-details">
      <div className="recall-answer-check-grid">
        <section aria-label={t("recall.session.answer.expectedAnswer")}>
          <h5>{t("recall.session.answer.expectedAnswer")}</h5>
          <p className="recall-card__body">
            {note.expectedAnswer ?? note.body}
          </p>
        </section>
        {answerCheck !== undefined ? (
          <RecallAnswerCheckPanel answerCheck={answerCheck} />
        ) : null}
      </div>
      {note.source !== undefined ? (
        <section aria-label={t("recall.session.answer.sourceContext")}>
          <h5>{t("recall.session.answer.sourceContext")}</h5>
          <p className="recall-card__body">
            <strong>{note.source.displayName ?? note.source.title}</strong>
          </p>
          <p className="recall-card__body">{note.source.body}</p>
        </section>
      ) : null}
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
          <Button onClick={onCancel} type="button">
            {t("recall.session.dialog.cancel")}
          </Button>
          <Button onClick={onConfirm} type="button" variant="primary">
            {hasAttempts
              ? t("recall.session.dialog.end")
              : t("recall.session.dialog.discard")}
          </Button>
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

function WriteAnswerIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="15"
      viewBox="0 0 24 24"
      width="15"
    >
      <path
        d="M4.5 18.7h15M6.2 15.8l.7-3.3 7.7-7.7a2 2 0 0 1 2.8 0l1.8 1.8a2 2 0 0 1 0 2.8l-7.7 7.7-3.3.7a1.7 1.7 0 0 1-2-2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
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
