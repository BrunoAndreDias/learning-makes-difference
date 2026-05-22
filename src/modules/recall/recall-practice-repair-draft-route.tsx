import {
  createFileRoute,
  Navigate,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { type KeyboardEvent, useState, useSyncExternalStore } from "react";

import { Button, ButtonLink } from "../../design-system/button";
import { PageLayout } from "../../design-system/page-layout";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import { useAppTranslation } from "../language";
import { listStudyNotesForUser } from "../study-notes";
import { appRoutePaths } from "../workspace-shell/app-shell/route-paths";
import {
  getRecallRatingTone,
  getRecallRatingTranslationKey,
} from "./learner-copy";
import {
  AppRecallError,
  type FlashCardSessionResult,
  type RecallQuestion,
} from "./recall";
import {
  createPracticeRepairEntryId,
  getPracticeRepairQuestionExpectedAnswer,
  getPracticeRepairQuestionPrompt,
  getPracticeRepairQuestionReferenceTitle,
  getPracticeRepairRecordedAnswer,
  getQuestionPracticeRepairDraft,
  type PracticeRepairDraft,
  type PracticeRepairIntent,
  type PracticeRepairQuestionReference,
} from "./recall-practice-repair";
import {
  ExternalLinkIcon,
  InfoIcon,
  PencilIcon,
  type PracticeRepairWorkspace,
  RecallPracticeRepairWorkspacePage,
  RefreshIcon,
  StudyNoteDocumentIcon,
  SuggestionChevronIcon,
  WarningIcon,
} from "./recall-practice-repair-route";

type RecallResultsStore = {
  getSessionResultsSnapshot: () => readonly FlashCardSessionResult[];
  subscribe: (listener: () => void) => () => void;
};

export const Route = createFileRoute(
  "/_protected/practice-repair/results/$sessionResultId/questions/$questionResultId",
)({
  component: RecallPracticeRepairDraftRoute,
});

type PracticeRepairDraftWorkspace = {
  question: RecallQuestion;
  questionIndex: number;
  questionResultId: string;
  result: FlashCardSessionResult;
  sessionResultId: string;
};

type DraftPracticeRepairIntentCard = {
  description: string;
  intent: PracticeRepairIntent;
  title: string;
};

const draftIntentCards = [
  {
    description:
      "Refine or expand the answer so the next recall target is clearer and easier to judge.",
    intent: "tighten-expected-answer",
    title: "Edit expected answer",
  },
  {
    description:
      "Break a broad concept into smaller, focused Study Notes you can train one at a time.",
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
      "Use a Metaphor or Acronym only if it solves this recall problem.",
    intent: "add-memory-aid",
    title: "Add a memory aid",
  },
] as const satisfies readonly DraftPracticeRepairIntentCard[];

function createPracticeRepairDraftReference(
  workspace: PracticeRepairDraftWorkspace,
): PracticeRepairQuestionReference {
  return {
    questionIndex: workspace.questionIndex,
    questionResultId: workspace.questionResultId,
    sessionResultId: workspace.sessionResultId,
    studyNoteId: workspace.question.noteId,
  };
}

function createStudyNotesPracticeRepairSearch(input: {
  practiceRepairAction: PracticeRepairIntent;
  practiceRepairEntryId: string;
}) {
  return {
    practiceRepairAction: input.practiceRepairAction,
    practiceRepairEntryId: input.practiceRepairEntryId,
  };
}

function getDraftPracticeRepairEntryId(
  workspace: PracticeRepairDraftWorkspace,
) {
  const reference = createPracticeRepairDraftReference(workspace);

  return createPracticeRepairEntryId({
    ...reference,
    questionResultId:
      workspace.question.questionResultId ?? reference.questionResultId,
  });
}

function getDraftCorrection(intent: PracticeRepairIntent): string {
  switch (intent) {
    case "tighten-prompt":
      return "Tighten the prompt using the weak recall evidence.";
    case "tighten-expected-answer":
      return "Tighten the expected answer using the weak recall evidence.";
    case "split-study-note":
      return "Split the Study Note so each recall target stays focused.";
    case "create-sibling-study-note":
      return "Create a sibling Study Note for the related idea from the same source.";
    case "add-memory-aid":
      return "Add a memory aid only if it makes this answer easier to retrieve.";
  }
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

function isIntentSelectionKey(key: string) {
  return key === "Enter" || key === " ";
}

function findPracticeRepairDraftWorkspace(input: {
  questionResultId: string;
  sessionResultId: string;
  sessionResults: readonly FlashCardSessionResult[];
}): PracticeRepairDraftWorkspace | null {
  const { questionResultId, sessionResultId, sessionResults } = input;
  const result = sessionResults.find(
    (candidate) => candidate.id === sessionResultId,
  );

  if (result === undefined) {
    return null;
  }

  const questionIndex = result.questions.findIndex(
    (candidate) => candidate.questionResultId === questionResultId,
  );
  const question =
    questionIndex < 0 ? undefined : result.questions[questionIndex];

  if (question === undefined) {
    return null;
  }

  return {
    question,
    questionIndex,
    questionResultId,
    result,
    sessionResultId,
  };
}

function RecallPracticeRepairDraftRoute() {
  const { questionResultId, sessionResultId } = Route.useParams();
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const persistentRecallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentRecall,
  });
  const studyNotesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.studyNotes,
  });
  const persistentStudyNotesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentStudyNotes,
  });
  const recallResultsContext =
    persistentRecallContext?.readonlyContext ?? recallContext;
  const recallResultsStore: RecallResultsStore =
    persistentRecallContext ?? recallContext;
  const studyNotesStore = persistentStudyNotesContext ?? studyNotesContext;
  useSyncExternalStore(
    recallResultsStore.subscribe,
    recallResultsStore.getSessionResultsSnapshot,
    recallResultsStore.getSessionResultsSnapshot,
  );
  useSyncExternalStore(
    studyNotesStore.subscribe,
    studyNotesStore.getSnapshot,
    studyNotesStore.getSnapshot,
  );
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const userId = sessionSnapshot.user?.id ?? null;
  const sessionResults =
    userId === null ? [] : recallResultsContext.listSessionResults({ userId });
  const studyNotes =
    userId === null
      ? []
      : listStudyNotesForUser(studyNotesStore.getSnapshot(), userId);
  const workspace = findPracticeRepairDraftWorkspace({
    questionResultId,
    sessionResultId,
    sessionResults,
  });

  if (workspace === null) {
    return <Navigate to="/practice-repair" />;
  }

  const confirmedPracticeRepairEntry = workspace.question.practiceRepairEntry;

  if (confirmedPracticeRepairEntry !== undefined) {
    return (
      <RecallPracticeRepairWorkspacePage
        persistentRecallContext={persistentRecallContext}
        persistentStudyNotesContext={persistentStudyNotesContext}
        recallContext={recallContext}
        sessionResults={sessionResults}
        studyNote={
          studyNotes.find(
            (studyNote) =>
              studyNote.id ===
              confirmedPracticeRepairEntry.reference.studyNoteId,
          ) ?? null
        }
        studyNotesContext={studyNotesContext}
        userId={userId}
        workspace={
          {
            entry: confirmedPracticeRepairEntry,
            question: workspace.question,
            result: workspace.result,
          } satisfies PracticeRepairWorkspace
        }
      />
    );
  }

  const practiceRepairDraft = getQuestionPracticeRepairDraft(
    workspace.question,
  );

  if (practiceRepairDraft === null) {
    return <Navigate to="/practice-repair" />;
  }

  return (
    <RecallPracticeRepairDraftPage
      practiceRepairDraft={practiceRepairDraft}
      workspace={workspace}
    />
  );
}

function RecallPracticeRepairDraftPage({
  practiceRepairDraft,
  workspace,
}: Readonly<{
  practiceRepairDraft: PracticeRepairDraft;
  workspace: PracticeRepairDraftWorkspace;
}>) {
  const navigate = useNavigate();
  const { t } = useAppTranslation();
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const persistentRecallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentRecall,
  });
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const userId = sessionSnapshot.user?.id ?? null;
  const { question } = workspace;
  const prompt = getPracticeRepairQuestionPrompt(question);
  const expectedAnswer = getPracticeRepairQuestionExpectedAnswer(question);
  const referenceTitle = getPracticeRepairQuestionReferenceTitle(question);
  const ratingLabel =
    question.selfRating === null
      ? "Not rated"
      : t(getRecallRatingTranslationKey(question.selfRating));
  const ratingTone = getRecallRatingTone(question.selfRating);
  const recordedAnswer = getPracticeRepairRecordedAnswer(question);
  const hasRecordedAnswer = (question.typedAnswer?.trim() ?? "").length > 0;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] =
    useState<PracticeRepairIntent | null>(null);
  const [isRecallPending, setIsRecallPending] = useState(false);

  async function startPracticeRepair(intent: PracticeRepairIntent) {
    if (userId === null) {
      return;
    }

    setErrorMessage(null);
    setPendingIntent(intent);

    try {
      const reference = createPracticeRepairDraftReference(workspace);
      const confirmation = {
        correction: getDraftCorrection(intent),
        intent,
        reference,
      };

      if (persistentRecallContext === undefined) {
        recallContext.confirmPracticeRepairEntry({
          ...confirmation,
          userId,
        });
      } else {
        await persistentRecallContext.confirmPracticeRepairEntry(
          userId,
          confirmation,
        );
      }

      await navigate({
        params: {
          studyNoteId: question.noteId,
        },
        search: createStudyNotesPracticeRepairSearch({
          practiceRepairAction: intent,
          practiceRepairEntryId: getDraftPracticeRepairEntryId(workspace),
        }),
        to: appRoutePaths.studyNoteEditor,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof AppRecallError
          ? error.message
          : "Practice Repair could not be started.",
      );
    } finally {
      setPendingIntent(null);
    }
  }

  async function handleStartRecallAgain() {
    if (userId === null || question.noteId === undefined) {
      return;
    }

    setErrorMessage(null);
    setIsRecallPending(true);

    try {
      const sessionInput = {
        mode: "FlashCard" as const,
        studyNoteIds: [question.noteId],
      };

      if (persistentRecallContext === undefined) {
        recallContext.startFlashCardSession({
          ...sessionInput,
          userId,
        });
      } else {
        await persistentRecallContext.startFlashCardSession(
          userId,
          sessionInput,
        );
      }

      await navigate({ to: "/recall/session" });
    } catch (error) {
      setErrorMessage(
        error instanceof AppRecallError
          ? error.message
          : "Recall again could not be started.",
      );
    } finally {
      setIsRecallPending(false);
    }
  }

  return (
    <PageLayout
      actions={
        <ButtonLink to="/practice-repair" variant="secondary">
          Practice Repair Queue
        </ButtonLink>
      }
      aria-label="Practice Repair workspace"
      as="section"
      className="recall-workspace recall-surface recall-practice-repair-workspace"
      description="Keep the original Needs practice evidence visible while you choose the smallest repair."
      headerClassName="recall-surface__header"
      headingLevel={1}
      title="Practice Repair"
    >
      <div className="recall-practice-repair-workspace__layout">
        <div className="recall-practice-repair-workspace__main">
          <section
            aria-label="Practice Repair evidence"
            className="recall-panel recall-practice-repair-workspace__evidence recall-practice-repair-workspace__evidence--compact"
          >
            <header className="recall-practice-repair-workspace__card-header">
              <span
                aria-hidden="true"
                className="recall-practice-repair-workspace__note-icon"
              >
                <StudyNoteDocumentIcon />
              </span>

              <div className="recall-practice-repair-workspace__card-copy">
                <h2 className="recall-practice-repair-workspace__study-note-title">
                  {referenceTitle}
                </h2>
                <p className="recall-practice-repair-workspace__study-note-meta">
                  {getStudyNoteMeta(question)}
                </p>
              </div>

              <ButtonLink
                className="recall-practice-repair-workspace__view-note"
                params={{
                  studyNoteId: question.noteId,
                }}
                to={appRoutePaths.studyNoteEditor}
                variant="secondary"
              >
                <span>View note</span>
                <ExternalLinkIcon />
              </ButtonLink>
            </header>

            <section className="recall-practice-repair-workspace__detail">
              <p className="recall-practice-repair-workspace__detail-label">
                Prompt (what you were asked)
              </p>
              <div className="recall-practice-repair-workspace__detail-copy">
                {prompt}
              </div>
            </section>

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

            <section className="recall-practice-repair-workspace__detail">
              <p className="recall-practice-repair-workspace__detail-label">
                Expected answer
              </p>
              <div className="recall-practice-repair-workspace__detail-copy">
                {expectedAnswer}
              </div>
            </section>

            <section className="recall-practice-repair-workspace__callout">
              <WarningIcon className="recall-practice-repair-workspace__callout-icon" />
              <div className="recall-practice-repair-workspace__callout-copy">
                <strong>{`Your last score: ${ratingLabel}`}</strong>
                <p>
                  It's okay--weak recall is a signal to adjust and reinforce.
                </p>
              </div>
            </section>

            <div className="recall-practice-repair-workspace__actions recall-practice-repair-workspace__quick-actions">
              <Button
                className="recall-practice-repair-workspace__action-button"
                disabled={pendingIntent !== null}
                onClick={() =>
                  void startPracticeRepair("tighten-expected-answer")
                }
                type="button"
                variant="secondary"
              >
                <PencilIcon />
                <span>Edit note</span>
              </Button>
              <Button
                className="recall-practice-repair-workspace__action-button"
                disabled={isRecallPending}
                onClick={() => void handleStartRecallAgain()}
                type="button"
                variant="primary"
              >
                <RefreshIcon />
                <span>Recall again</span>
              </Button>
            </div>
          </section>

          <p className="recall-practice-repair-workspace__footer-note">
            <InfoIcon />
            <span>
              Metaphors and acronyms are optional support material, not
              required.
            </span>
          </p>
        </div>

        <aside
          aria-label="Practice Repair actions"
          className="recall-practice-repair-workspace__sidebar"
        >
          <section className="recall-panel recall-practice-repair-workspace__panel">
            <div className="recall-practice-repair-workspace__panel-copy">
              <h2>Suggested repairs</h2>
              <p>{practiceRepairDraft.summary}</p>
            </div>

            <div className="recall-practice-repair-workspace__repair-list">
              {draftIntentCards.map((card) => (
                <PracticeRepairDraftActionButton
                  card={card}
                  isDisabled={pendingIntent !== null}
                  key={card.intent}
                  onSelect={(intent) => void startPracticeRepair(intent)}
                />
              ))}
            </div>

            {errorMessage === null ? null : (
              <p
                className="recall-practice-repair-workspace__error"
                role="alert"
              >
                {errorMessage}
              </p>
            )}

            <p className="recall-practice-repair-workspace__support">
              Opening a repair starts it with that action and keeps this
              evidence attached.
            </p>
          </section>
        </aside>
      </div>
    </PageLayout>
  );
}

function PracticeRepairDraftActionButton({
  card,
  isDisabled,
  onSelect,
}: Readonly<{
  card: DraftPracticeRepairIntentCard;
  isDisabled: boolean;
  onSelect: (intent: PracticeRepairIntent) => void;
}>) {
  const titleId = `practice-repair-draft-card-title-${card.intent}`;
  const descriptionId = `practice-repair-draft-card-description-${card.intent}`;

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!isIntentSelectionKey(event.key)) {
      return;
    }

    event.preventDefault();
    onSelect(card.intent);
  }

  return (
    <article className="recall-practice-repair-workspace__repair-card">
      <button
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className="recall-practice-repair-workspace__repair-button"
        disabled={isDisabled}
        onClick={() => onSelect(card.intent)}
        onKeyDown={handleKeyDown}
        type="button"
      >
        <span className="recall-practice-repair-workspace__repair-copy">
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
