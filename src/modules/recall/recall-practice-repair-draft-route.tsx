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

import { ButtonLink } from "../../design-system/button";
import { PageLayout } from "../../design-system/page-layout";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import { useAppTranslation } from "../language";
import { listStudyNotesForUser } from "../study-notes";
import { appRoutePaths } from "../workspace-shell/app-shell/route-paths";
import { getRecallRatingTranslationKey } from "./learner-copy";
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
  type PracticeRepairIntent,
  type PracticeRepairQuestionReference,
} from "./recall-practice-repair";
import {
  ExternalLinkIcon,
  type PracticeRepairWorkspace,
  RecallPracticeRepairWorkspacePage,
  StudyNoteDocumentIcon,
  SuggestionChevronIcon,
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
  mode: DraftPracticeRepairMode;
  title: string;
};

type DraftPracticeRepairMode =
  | "create-sibling"
  | "edit-answer"
  | "memory-aid"
  | "split-note";

const draftIntentCards = [
  {
    description:
      "Refine or expand the answer so the recall target is clearer and easier to judge.",
    intent: "tighten-expected-answer",
    mode: "edit-answer",
    title: "Edit expected answer",
  },
  {
    description:
      "Break a broad concept into smaller Study Notes you can practice one at a time.",
    intent: "split-study-note",
    mode: "split-note",
    title: "Split this Study Note",
  },
  {
    description:
      "Add a related concept or contrast from the same source explanation.",
    intent: "create-sibling-study-note",
    mode: "create-sibling",
    title: "Create a sibling Study Note",
  },
  {
    description: "Add a metaphor or acronym only when it helps recall.",
    intent: "add-memory-aid",
    mode: "memory-aid",
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
        selectedMode="edit-answer"
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

  return <RecallPracticeRepairDraftPage workspace={workspace} />;
}

function RecallPracticeRepairDraftPage({
  workspace,
}: Readonly<{
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
  const recordedAnswer = getPracticeRepairRecordedAnswer(question);
  const hasRecordedAnswer = (question.typedAnswer?.trim() ?? "").length > 0;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] =
    useState<PracticeRepairIntent | null>(null);

  async function startPracticeRepair(card: DraftPracticeRepairIntentCard) {
    if (userId === null) {
      return;
    }

    setErrorMessage(null);
    setPendingIntent(card.intent);

    try {
      const reference = createPracticeRepairDraftReference(workspace);
      const confirmation = {
        correction: getDraftCorrection(card.intent),
        intent: card.intent,
        reference,
      };
      const practiceRepairEntryId = getDraftPracticeRepairEntryId(workspace);

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
          practiceRepairEntryId,
        },
        search: {
          mode: card.mode,
        },
        to: "/practice-repair/$practiceRepairEntryId",
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
      description="Keep the original Needs practice evidence visible while you finish one concrete repair from Recall."
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
                <span>View full note</span>
                <ExternalLinkIcon />
              </ButtonLink>
            </header>

            <PracticeRepairDraftDetail label="Prompt">
              {prompt}
            </PracticeRepairDraftDetail>

            <section className="recall-practice-repair-workspace__detail">
              <div className="recall-practice-repair-workspace__detail-header">
                <p className="recall-practice-repair-workspace__detail-label">
                  Your answer
                </p>
              </div>
              <div
                className="recall-practice-repair-workspace__detail-copy"
                data-empty-answer={hasRecordedAnswer ? undefined : "true"}
              >
                {recordedAnswer}
              </div>
            </section>

            <PracticeRepairDraftDetail label="Expected answer">
              {expectedAnswer}
            </PracticeRepairDraftDetail>

            <section className="recall-practice-repair-workspace__detail">
              <p className="recall-practice-repair-workspace__detail-label">
                Last score
              </p>
              <div className="recall-practice-repair-workspace__detail-copy">
                <strong className="recall-practice-repair-workspace__score-value">
                  {ratingLabel}
                </strong>
                <span>Weak recall is a signal to adjust and reinforce.</span>
              </div>
            </section>
          </section>
        </div>

        <aside
          aria-label="Practice Repair actions"
          className="recall-practice-repair-workspace__sidebar"
        >
          <section className="recall-panel recall-practice-repair-workspace__panel">
            <div className="recall-practice-repair-workspace__panel-copy">
              <h2>Repair options</h2>
              <p>
                Choose one exact improvement to make now. Do one thing well, not
                many.
              </p>
            </div>

            <div className="recall-practice-repair-workspace__repair-list">
              {draftIntentCards.map((card) => (
                <PracticeRepairDraftActionButton
                  card={card}
                  isDisabled={pendingIntent !== null}
                  isSelected={card.mode === "edit-answer"}
                  key={card.intent}
                  onSelect={(selectedCard) =>
                    void startPracticeRepair(selectedCard)
                  }
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
          </section>
        </aside>
      </div>
    </PageLayout>
  );
}

function PracticeRepairDraftDetail({
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

function PracticeRepairDraftActionButton({
  card,
  isDisabled,
  isSelected,
  onSelect,
}: Readonly<{
  card: DraftPracticeRepairIntentCard;
  isDisabled: boolean;
  isSelected: boolean;
  onSelect: (card: DraftPracticeRepairIntentCard) => void;
}>) {
  const titleId = `practice-repair-draft-card-title-${card.mode}`;
  const descriptionId = `practice-repair-draft-card-description-${card.mode}`;

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!isIntentSelectionKey(event.key)) {
      return;
    }

    event.preventDefault();
    onSelect(card);
  }

  return (
    <article
      className="recall-practice-repair-workspace__repair-card"
      data-selected={isSelected ? "true" : "false"}
    >
      <button
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-pressed={isSelected}
        className="recall-practice-repair-workspace__repair-button"
        disabled={isDisabled}
        onClick={() => onSelect(card)}
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
