import {
  createFileRoute,
  Navigate,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import {
  type KeyboardEvent,
  type ReactNode,
  useState,
  useSyncExternalStore,
} from "react";

import { Button, ButtonLink } from "../../design-system/button";
import { PageHeader } from "../../design-system/page-header";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import { useAppTranslation } from "../language";
import {
  getRecallRatingTone,
  getRecallRatingTranslationKey,
} from "./learner-copy";
import type { AppPersistentRecallContext } from "./persistent-recall";
import { PracticeRepairBreadcrumb } from "./practice-repair-breadcrumb";
import {
  type AppRecallContext,
  AppRecallError,
  type FlashCardSessionResult,
  type RecallQuestion,
} from "./recall";
import {
  getPracticeRepairEntryId,
  getPracticeRepairEntryLifecycleKind,
  getPracticeRepairQuestionExpectedAnswer,
  getPracticeRepairQuestionPrompt,
  getPracticeRepairQuestionReferenceText,
  getPracticeRepairQuestionReferenceTitle,
  getPracticeRepairRecordedAnswer,
  type PracticeRepairEntry,
  type PracticeRepairEntryLifecycleKind,
  type PracticeRepairIntent,
} from "./recall-practice-repair";

export const Route = createFileRoute(
  "/_protected/practice-repair/$practiceRepairEntryId",
)({
  component: RecallPracticeRepairRoute,
});

export type PracticeRepairWorkspace = {
  entry: PracticeRepairEntry;
  question: RecallQuestion;
  result: FlashCardSessionResult;
};

type PracticeRepairWorkspaceActionCard = {
  description: string;
  intent: PracticeRepairIntent;
  title: string;
};

const workspaceActionCards = [
  {
    description:
      "Refine or expand the answer so the recall target is clearer and easier to judge.",
    intent: "tighten-expected-answer",
    title: "Edit expected answer",
  },
  {
    description:
      "Break a broad concept into smaller Study Notes you can train one at a time.",
    intent: "split-study-note",
    title: "Split this Study Note",
  },
  {
    description:
      "Add a related concept or contrast from the same source explanation.",
    intent: "create-sibling-study-note",
    title: "Create a sibling Study Note",
  },
  {
    description:
      "Add a Metaphor or Acronym only when it would make the answer easier to retrieve.",
    intent: "add-memory-aid",
    title: "Add a memory aid",
  },
] as const satisfies readonly PracticeRepairWorkspaceActionCard[];

type PracticeRepairLifecycleAction = "complete" | "dismiss";

type RecallResultsStore = Pick<
  AppRecallContext,
  "getSessionResultsSnapshot" | "subscribe"
>;

function findPracticeRepairWorkspace(input: {
  practiceRepairEntryId: string;
  sessionResults: readonly FlashCardSessionResult[];
}): PracticeRepairWorkspace | null {
  const { practiceRepairEntryId, sessionResults } = input;

  for (const result of sessionResults) {
    for (const question of result.questions) {
      const entry = question.practiceRepairEntry;

      if (
        entry !== undefined &&
        getPracticeRepairEntryId(entry) === practiceRepairEntryId
      ) {
        return {
          entry,
          question,
          result,
        };
      }
    }
  }

  return null;
}

function getStudyNoteMeta(question: Pick<RecallQuestion, "noteSnapshot">) {
  const labels = question.noteSnapshot.labels
    ?.map((label) => label.name.trim())
    .filter((label) => label.length > 0);

  if (labels !== undefined && labels.length > 0) {
    return labels.join(" · ");
  }

  const sourceTitle = question.noteSnapshot.source?.title?.trim();

  if (sourceTitle !== undefined && sourceTitle.length > 0) {
    return sourceTitle;
  }

  return "Results evidence";
}

function findSupersedingPracticeRepairEntryId(input: {
  entry: PracticeRepairEntry;
  sessionResults: readonly FlashCardSessionResult[];
}): string | null {
  const currentEntryId = getPracticeRepairEntryId(input.entry);

  for (const result of input.sessionResults) {
    for (const question of result.questions) {
      const candidateEntry = question.practiceRepairEntry;

      if (
        candidateEntry === undefined ||
        getPracticeRepairEntryLifecycleKind(candidateEntry) !== "active" ||
        candidateEntry.intent !== input.entry.intent ||
        candidateEntry.reference.studyNoteId !==
          input.entry.reference.studyNoteId
      ) {
        continue;
      }

      const candidateEntryId = getPracticeRepairEntryId(candidateEntry);

      if (candidateEntryId !== currentEntryId) {
        return candidateEntryId;
      }
    }
  }

  return null;
}

function getPracticeRepairNextStepCopy(input: {
  hasSupersedingEntry: boolean;
  lifecycleKind: PracticeRepairEntryLifecycleKind;
}) {
  const { hasSupersedingEntry, lifecycleKind } = input;

  switch (lifecycleKind) {
    case "completed":
      return "Use Recall again soon after the repair work is complete to test this Study Note again.";
    case "active":
      return "Make the repair in Study Notes, then mark this Practice Repair complete or dismiss it here when it no longer belongs in the active queue.";
    case "dismissed":
      return "Dismissed repairs stay out of the active queue while Results keeps the original historical evidence.";
    case "follow-up-satisfied":
      return "A later recall attempt closed this repair loop, so this entry stays available as history only.";
    case "study-note-deleted":
      return "Use Results for the historical evidence because this Study Note is no longer available for active repair.";
    case "superseded":
      return hasSupersedingEntry
        ? "A newer active Practice Repair replaced this one. Open the newer entry to continue the current repair."
        : "A newer Practice Repair replaced this one, so this entry stays historical only.";
  }
}

function getPracticeRepairSupportCopy(input: {
  hasSupersedingEntry: boolean;
  lifecycleKind: PracticeRepairEntryLifecycleKind;
}) {
  const { hasSupersedingEntry, lifecycleKind } = input;

  switch (lifecycleKind) {
    case "active":
      return "Results keeps the historical evidence. This workspace keeps the active repair in view.";
    case "completed":
      return "Results keeps the historical evidence. The follow-up closes only after you attempt recall again.";
    case "dismissed":
      return "Dismissed repairs stay out of the active queue but remain available as historical evidence.";
    case "follow-up-satisfied":
      return "Results keeps the historical evidence that led to this repair and the later recall that closed it.";
    case "study-note-deleted":
      return "Results keeps the historical evidence even though the original Study Note no longer exists.";
    case "superseded":
      return hasSupersedingEntry
        ? "Use the newer active Practice Repair for current work. This entry remains available as history."
        : "This superseded entry remains available as history even if the newer active repair is no longer open here.";
  }
}

function getPracticeRepairFeedbackMessage(
  action: PracticeRepairLifecycleAction,
) {
  switch (action) {
    case "complete":
      return "Practice Repair completed";
    case "dismiss":
      return "Practice Repair dismissed";
  }
}

function getPracticeRepairErrorMessage(action: PracticeRepairLifecycleAction) {
  switch (action) {
    case "complete":
      return "Practice Repair could not be completed.";
    case "dismiss":
      return "Practice Repair could not be dismissed.";
  }
}

function getPracticeRepairFollowUpStartErrorMessage() {
  return "Recall again soon could not be started.";
}

async function startPracticeRepairFollowUpRecall(input: {
  persistentRecallContext: AppPersistentRecallContext | undefined;
  recallContext: AppRecallContext;
  studyNoteId: string;
  userId: string;
}) {
  const sessionInput = {
    mode: "FlashCard" as const,
    studyNoteIds: [input.studyNoteId],
  };

  if (input.persistentRecallContext !== undefined) {
    await input.persistentRecallContext.startFlashCardSession(
      input.userId,
      sessionInput,
    );
    return;
  }

  input.recallContext.startFlashCardSession({
    ...sessionInput,
    userId: input.userId,
  });
}

async function mutatePracticeRepairLifecycle(input: {
  action: PracticeRepairLifecycleAction;
  persistentRecallContext: AppPersistentRecallContext | undefined;
  reference: PracticeRepairEntry["reference"];
  recallContext: AppRecallContext;
  userId: string | null;
}) {
  const { persistentRecallContext, reference, recallContext, userId } = input;

  if (userId === null) {
    return;
  }

  if (persistentRecallContext !== undefined) {
    switch (input.action) {
      case "complete":
        await persistentRecallContext.completePracticeRepairEntry(userId, {
          reference,
        });
        return;
      case "dismiss":
        await persistentRecallContext.dismissPracticeRepairEntry(userId, {
          reference,
        });
        return;
    }
  }

  switch (input.action) {
    case "complete":
      recallContext.completePracticeRepairEntry({
        reference,
        userId,
      });
      return;
    case "dismiss":
      recallContext.dismissPracticeRepairEntry({
        reference,
        userId,
      });
      return;
  }
}

function useSessionResultsSubscription(recallResultsStore: RecallResultsStore) {
  useSyncExternalStore(
    recallResultsStore.subscribe,
    recallResultsStore.getSessionResultsSnapshot,
    recallResultsStore.getSessionResultsSnapshot,
  );
}

function PracticeRepairWorkspaceActions({
  isFollowUpRecallPending,
  isMutationPending,
  lifecycleKind,
  onComplete,
  onDismiss,
  onStartFollowUpRecall,
  supersedingPracticeRepairEntryId,
}: Readonly<{
  isFollowUpRecallPending: boolean;
  isMutationPending: boolean;
  lifecycleKind: PracticeRepairEntryLifecycleKind;
  onComplete: () => void;
  onDismiss: () => void;
  onStartFollowUpRecall: () => void;
  supersedingPracticeRepairEntryId: string | null;
}>) {
  switch (lifecycleKind) {
    case "active":
      return (
        <>
          <Button
            disabled={isMutationPending}
            onClick={onComplete}
            type="button"
            variant="primary"
          >
            Mark repair complete
          </Button>
          <Button
            disabled={isMutationPending}
            onClick={onDismiss}
            type="button"
            variant="danger"
          >
            Dismiss repair
          </Button>
        </>
      );
    case "completed":
      return (
        <Button
          disabled={isFollowUpRecallPending}
          onClick={onStartFollowUpRecall}
          type="button"
          variant="primary"
        >
          Recall again soon
        </Button>
      );
    case "dismissed":
    case "follow-up-satisfied":
    case "study-note-deleted":
      return (
        <ButtonLink to="/recall/results" variant="secondary">
          Open Results
        </ButtonLink>
      );
    case "superseded":
      return (
        <>
          {supersedingPracticeRepairEntryId === null ? null : (
            <ButtonLink
              params={{
                practiceRepairEntryId: supersedingPracticeRepairEntryId,
              }}
              to="/practice-repair/$practiceRepairEntryId"
              variant="primary"
            >
              Open newer Practice Repair
            </ButtonLink>
          )}
          <ButtonLink to="/recall/results" variant="secondary">
            Open Results
          </ButtonLink>
        </>
      );
  }
}

function createStudyNotesPracticeRepairSearch(input: {
  practiceRepairAction?: PracticeRepairIntent;
  practiceRepairEntryId: string;
}) {
  const search: {
    practiceRepairAction?: PracticeRepairIntent;
    practiceRepairEntryId: string;
  } = {
    practiceRepairEntryId: input.practiceRepairEntryId,
  };

  if (input.practiceRepairAction !== undefined) {
    search.practiceRepairAction = input.practiceRepairAction;
  }

  return search;
}

function isActionSelectionKey(key: string) {
  return key === "Enter" || key === " ";
}

function PracticeRepairWorkspaceDetail({
  children,
  label,
}: Readonly<{
  children: ReactNode;
  label: string;
}>) {
  return (
    <section className="recall-practice-repair-workspace__detail">
      <p className="recall-practice-repair-workspace__detail-label">{label}</p>
      <div className="recall-practice-repair-workspace__detail-copy">
        {children}
      </div>
    </section>
  );
}

function RecallPracticeRepairRoute() {
  const { practiceRepairEntryId } = Route.useParams();
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const persistentRecallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentRecall,
  });
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const recallResultsStore = persistentRecallContext ?? recallContext;
  const recallResultsContext =
    persistentRecallContext?.readonlyContext ?? recallContext;
  useSessionResultsSubscription(recallResultsStore);
  const userId = sessionSnapshot.user?.id ?? null;
  const sessionResults =
    userId === null ? [] : recallResultsContext.listSessionResults({ userId });
  const workspace = findPracticeRepairWorkspace({
    practiceRepairEntryId,
    sessionResults,
  });

  if (workspace === null) {
    return <Navigate to="/practice-repair" />;
  }

  return (
    <RecallPracticeRepairWorkspacePage
      persistentRecallContext={persistentRecallContext}
      recallContext={recallContext}
      sessionResults={sessionResults}
      userId={userId}
      workspace={workspace}
    />
  );
}

export function RecallPracticeRepairWorkspacePage({
  persistentRecallContext,
  recallContext,
  sessionResults,
  userId,
  workspace,
}: Readonly<{
  persistentRecallContext: AppPersistentRecallContext | undefined;
  recallContext: AppRecallContext;
  sessionResults: readonly FlashCardSessionResult[];
  userId: string | null;
  workspace: PracticeRepairWorkspace;
}>) {
  const navigate = useNavigate();
  const { t } = useAppTranslation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isFollowUpRecallPending, setIsFollowUpRecallPending] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<PracticeRepairLifecycleAction | null>(null);
  const { entry, question } = workspace;
  const practiceRepairEntryId = getPracticeRepairEntryId(entry);
  const prompt = getPracticeRepairQuestionPrompt(question);
  const expectedAnswer = getPracticeRepairQuestionExpectedAnswer(question);
  const referenceTitle = getPracticeRepairQuestionReferenceTitle(question);
  const referenceText = getPracticeRepairQuestionReferenceText(question);
  const lifecycleKind = getPracticeRepairEntryLifecycleKind(entry);
  const cardTitle = lifecycleKind === "active" ? referenceTitle : prompt;
  const supersedingPracticeRepairEntryId =
    lifecycleKind === "superseded"
      ? findSupersedingPracticeRepairEntryId({
          entry,
          sessionResults,
        })
      : null;
  const hasSupersedingEntry = supersedingPracticeRepairEntryId !== null;
  const nextStepCopy = getPracticeRepairNextStepCopy({
    hasSupersedingEntry,
    lifecycleKind,
  });
  const supportCopy = getPracticeRepairSupportCopy({
    hasSupersedingEntry,
    lifecycleKind,
  });
  const ratingLabel =
    question.selfRating === null
      ? "Not rated"
      : t(getRecallRatingTranslationKey(question.selfRating));
  const ratingTone = getRecallRatingTone(question.selfRating);
  const recordedAnswer = getPracticeRepairRecordedAnswer(question);
  const hasRecordedAnswer = (question.typedAnswer?.trim() ?? "").length > 0;
  const canOpenStudyNotes = lifecycleKind !== "study-note-deleted";
  const isMutationPending = pendingAction !== null;
  const showSuggestedRepairs = lifecycleKind === "active";

  async function handleLifecycleMutation(
    action: PracticeRepairLifecycleAction,
  ) {
    setErrorMessage(null);
    setFeedbackMessage(null);
    setPendingAction(action);

    try {
      await mutatePracticeRepairLifecycle({
        action,
        persistentRecallContext,
        recallContext,
        reference: entry.reference,
        userId,
      });
      setFeedbackMessage(getPracticeRepairFeedbackMessage(action));
    } catch (error) {
      setErrorMessage(
        error instanceof AppRecallError
          ? error.message
          : getPracticeRepairErrorMessage(action),
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleStartFollowUpRecall() {
    if (userId === null) {
      return;
    }

    setErrorMessage(null);
    setFeedbackMessage(null);
    setIsFollowUpRecallPending(true);

    try {
      await startPracticeRepairFollowUpRecall({
        persistentRecallContext,
        recallContext,
        studyNoteId: entry.reference.studyNoteId,
        userId,
      });
      await navigate({ to: "/recall/session" });
    } catch (error) {
      setErrorMessage(
        error instanceof AppRecallError
          ? error.message
          : getPracticeRepairFollowUpStartErrorMessage(),
      );
    } finally {
      setIsFollowUpRecallPending(false);
    }
  }

  function openStudyNotesPracticeRepair(
    practiceRepairAction?: PracticeRepairIntent,
  ) {
    void navigate({
      search: createStudyNotesPracticeRepairSearch({
        practiceRepairAction,
        practiceRepairEntryId,
      }),
      to: "/study-notes",
    });
  }

  return (
    <section
      aria-label="Practice Repair workspace"
      className="recall-workspace"
    >
      <article className="recall-surface recall-practice-repair-workspace">
        <PageHeader
          actions={
            <ButtonLink to="/practice-repair" variant="secondary">
              Practice Repair Queue
            </ButtonLink>
          }
          beforeTitle={
            <PracticeRepairBreadcrumb currentLabel="Practice Repair" />
          }
          className="recall-surface__header"
          description="Keep the original Needs practice evidence visible while you finish one concrete repair from Recall."
          headingLevel={1}
          title="Practice Repair"
        />

        <div className="recall-practice-repair-workspace__layout">
          <div className="recall-practice-repair-workspace__main">
            <section
              aria-label="Practice Repair evidence"
              className={
                lifecycleKind === "active"
                  ? "recall-panel recall-practice-repair-workspace__evidence recall-practice-repair-workspace__evidence--compact"
                  : "recall-panel recall-practice-repair-workspace__evidence"
              }
            >
              <header className="recall-practice-repair-workspace__card-header">
                {lifecycleKind === "active" ? (
                  <span
                    aria-hidden="true"
                    className="recall-practice-repair-workspace__note-icon"
                  >
                    <StudyNoteDocumentIcon />
                  </span>
                ) : null}

                <div className="recall-practice-repair-workspace__card-copy">
                  {lifecycleKind === "active" ? null : (
                    <p className="recall-practice-repair-workspace__eyebrow">
                      Study Note
                    </p>
                  )}
                  <h2 className="recall-practice-repair-workspace__study-note-title">
                    {cardTitle}
                  </h2>
                  <p className="recall-practice-repair-workspace__study-note-meta">
                    {getStudyNoteMeta(question)}
                  </p>
                </div>

                {canOpenStudyNotes ? (
                  <ButtonLink
                    className={
                      lifecycleKind === "active"
                        ? "recall-practice-repair-workspace__view-note"
                        : undefined
                    }
                    search={createStudyNotesPracticeRepairSearch({
                      practiceRepairEntryId,
                    })}
                    to="/study-notes"
                    variant="secondary"
                  >
                    {lifecycleKind === "active" ? (
                      <>
                        <span>View note</span>
                        <ExternalLinkIcon />
                      </>
                    ) : (
                      "View note"
                    )}
                  </ButtonLink>
                ) : null}
              </header>

              <PracticeRepairWorkspaceDetail label="Prompt (what you were asked)">
                {prompt}
              </PracticeRepairWorkspaceDetail>

              <section className="recall-practice-repair-workspace__detail">
                <div className="recall-practice-repair-workspace__detail-header">
                  <p className="recall-practice-repair-workspace__detail-label">
                    Your answer
                  </p>
                  <span
                    className="recall-selected-result__row-pill recall-practice-repair-workspace__rating"
                    data-rating-tone={ratingTone}
                  >
                    {ratingLabel}
                  </span>
                </div>
                <div
                  className="recall-practice-repair-workspace__detail-copy"
                  data-empty-answer={hasRecordedAnswer ? undefined : "true"}
                >
                  {recordedAnswer}
                </div>
              </section>

              <PracticeRepairWorkspaceDetail label="Expected answer">
                {expectedAnswer}
              </PracticeRepairWorkspaceDetail>

              {lifecycleKind === "active" ? null : (
                <PracticeRepairWorkspaceDetail label="Reference explanation">
                  <strong>{referenceTitle}</strong>
                  <span>{referenceText}</span>
                </PracticeRepairWorkspaceDetail>
              )}

              <section className="recall-practice-repair-workspace__callout">
                {lifecycleKind === "active" ? (
                  <WarningIcon className="recall-practice-repair-workspace__callout-icon" />
                ) : null}
                <div className="recall-practice-repair-workspace__callout-copy">
                  <strong>
                    {lifecycleKind === "active"
                      ? `Your last score: ${ratingLabel}`
                      : `Last score: ${ratingLabel}`}
                  </strong>
                  {lifecycleKind === "active" ? (
                    <p>
                      It's okay--weak recall is a signal to adjust and
                      reinforce.
                    </p>
                  ) : (
                    <p>
                      Needs practice is a signal to adjust and reinforce before
                      the next recall.
                    </p>
                  )}
                </div>
              </section>

              {lifecycleKind === "active" ? (
                <div className="recall-practice-repair-workspace__actions recall-practice-repair-workspace__quick-actions">
                  <ButtonLink
                    className="recall-practice-repair-workspace__action-button"
                    search={createStudyNotesPracticeRepairSearch({
                      practiceRepairAction: entry.intent,
                      practiceRepairEntryId,
                    })}
                    to="/study-notes"
                    variant="secondary"
                  >
                    <PencilIcon />
                    <span>Edit note</span>
                  </ButtonLink>
                  <Button
                    className="recall-practice-repair-workspace__action-button"
                    disabled={isFollowUpRecallPending}
                    onClick={() => void handleStartFollowUpRecall()}
                    type="button"
                    variant="primary"
                  >
                    <RefreshIcon />
                    <span>Recall again</span>
                  </Button>
                </div>
              ) : null}
            </section>

            {lifecycleKind === "active" ? (
              <p className="recall-practice-repair-workspace__footer-note">
                <InfoIcon />
                <span>
                  Metaphors and acronyms are optional support material, not
                  required.
                </span>
              </p>
            ) : null}
          </div>

          <aside
            aria-label="Practice Repair actions"
            className="recall-practice-repair-workspace__sidebar"
          >
            <section className="recall-panel recall-practice-repair-workspace__panel">
              <div className="recall-practice-repair-workspace__panel-copy">
                <h2>
                  {showSuggestedRepairs ? "Suggested repairs" : "Next step"}
                </h2>
                <p>
                  {showSuggestedRepairs
                    ? "Open the Study Notes action you want to make next. The highlighted card is the repair saved on this entry."
                    : nextStepCopy}
                </p>
              </div>

              {showSuggestedRepairs ? (
                <div className="recall-practice-repair-workspace__repair-list">
                  {workspaceActionCards.map((card) => (
                    <PracticeRepairWorkspaceActionButton
                      card={card}
                      isSelected={entry.intent === card.intent}
                      key={card.intent}
                      onSelect={openStudyNotesPracticeRepair}
                    />
                  ))}
                </div>
              ) : null}

              {feedbackMessage === null ? null : (
                <p className="recall-feedback" role="status">
                  {feedbackMessage}
                </p>
              )}

              {errorMessage === null ? null : (
                <p
                  className="recall-practice-repair-workspace__error"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}

              <div className="recall-practice-repair-workspace__actions">
                <PracticeRepairWorkspaceActions
                  isFollowUpRecallPending={isFollowUpRecallPending}
                  isMutationPending={isMutationPending}
                  lifecycleKind={lifecycleKind}
                  onComplete={() => void handleLifecycleMutation("complete")}
                  onDismiss={() => void handleLifecycleMutation("dismiss")}
                  onStartFollowUpRecall={() => void handleStartFollowUpRecall()}
                  supersedingPracticeRepairEntryId={
                    supersedingPracticeRepairEntryId
                  }
                />
              </div>

              <p className="recall-practice-repair-workspace__support">
                {supportCopy}
              </p>
            </section>
          </aside>
        </div>
      </article>
    </section>
  );
}

function PracticeRepairWorkspaceActionButton({
  card,
  isSelected,
  onSelect,
}: Readonly<{
  card: PracticeRepairWorkspaceActionCard;
  isSelected: boolean;
  onSelect: (intent: PracticeRepairIntent) => void;
}>) {
  const titleId = `practice-repair-workspace-card-title-${card.intent}`;
  const descriptionId = `practice-repair-workspace-card-description-${card.intent}`;

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!isActionSelectionKey(event.key)) {
      return;
    }

    event.preventDefault();
    onSelect(card.intent);
  }

  return (
    <article
      className="recall-practice-repair-workspace__repair-card"
      data-selected={isSelected ? "true" : "false"}
    >
      <button
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className="recall-practice-repair-workspace__repair-button"
        onClick={() => onSelect(card.intent)}
        onKeyDown={handleKeyDown}
        type="button"
      >
        <span className="recall-practice-repair-workspace__repair-copy">
          {isSelected ? (
            <span className="recall-practice-repair-workspace__repair-tag">
              Current repair
            </span>
          ) : null}
          <span
            className="recall-practice-repair-workspace__repair-title"
            id={titleId}
          >
            {card.title}
          </span>
          <span
            className="recall-practice-repair-workspace__repair-description"
            id={descriptionId}
          >
            {card.description}
          </span>
        </span>

        <span
          aria-hidden="true"
          className="recall-practice-repair-workspace__repair-chevron"
        >
          <SuggestionChevronIcon />
        </span>
      </button>
    </article>
  );
}

export function SuggestionChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="18"
      viewBox="0 0 18 18"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 4.5 11.5 9 7 13.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function StudyNoteDocumentIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M6 3h9l3 3v15H6V3Z" />
      <path d="M14 3v4h4" />
      <path d="M9 11h6" />
      <path d="M9 15h5" />
    </svg>
  );
}

export function ExternalLinkIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M14 5h5v5" />
      <path d="m10 14 9-9" />
      <path d="M19 14v5H5V5h5" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="m5 19 4.5-1 9-9a2.1 2.1 0 0 0-3-3l-9 9L5 19Z" />
      <path d="m14 7 3 3" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M20 12a8 8 0 0 1-13.3 6" />
      <path d="M4 12a8 8 0 0 1 13.3-6" />
      <path d="M17 2v4h-4" />
      <path d="M7 22v-4h4" />
    </svg>
  );
}

export function WarningIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v7" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function InfoIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </svg>
  );
}
