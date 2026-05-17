import {
  createFileRoute,
  Navigate,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useState } from "react";

import { Button, ButtonLink } from "../../design-system/button";
import { FloatingTextarea } from "../../design-system/floating-textarea";
import { PageHeader } from "../../design-system/page-header";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import { useAppTranslation } from "../language";
import {
  getRecallRatingTone,
  getRecallRatingTranslationKey,
} from "./learner-copy";
import type { AppPersistentRecallContext } from "./persistent-recall";
import {
  type AppRecallContext,
  AppRecallError,
  type FlashCardSessionResult,
  type RecallQuestion,
} from "./recall";
import { RecallBreadcrumb } from "./recall-breadcrumb";
import {
  formatPracticeRepairIntentLabel,
  getPracticeRepairEntryId,
  getQuestionPracticeRepairDraft,
  type PracticeRepairDraft,
  type PracticeRepairEntryConfirmation,
  type PracticeRepairIntent,
} from "./recall-practice-repair";
import {
  getRecallQuestionExpectedAnswer,
  getRecallQuestionPrompt,
  getRecallQuestionRecordedAnswer,
} from "./recall-question-evidence";

export const Route = createFileRoute(
  "/_protected/recall/results/$sessionResultId/questions/$questionResultId/repair",
)({
  component: RecallPracticeRepairDraftRoute,
});

type PracticeRepairDraftWorkspace = {
  question: RecallQuestion;
  questionIndex: number;
  result: FlashCardSessionResult;
};

const draftSuggestionCards = [
  {
    description:
      "Clarify or expand the answer so the next recall target is easier to judge.",
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
  {
    description:
      "Return to this Study Note soon after you decide on the smallest useful repair.",
    intent: undefined,
    title: "Recall again soon",
  },
] as const satisfies readonly {
  description: string;
  intent?: PracticeRepairIntent;
  title: string;
}[];

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
    result,
  };
}

function getPracticeRepairDraftReference(
  workspace: PracticeRepairDraftWorkspace,
): PracticeRepairEntryConfirmation["reference"] {
  return {
    questionIndex: workspace.questionIndex,
    questionResultId: workspace.question.questionResultId,
    sessionResultId: workspace.result.id,
    studyNoteId: workspace.question.noteId,
  };
}

async function confirmDraftPracticeRepairEntry(input: {
  correction: string;
  intent: PracticeRepairIntent;
  persistentRecallContext: AppPersistentRecallContext | undefined;
  recallContext: AppRecallContext;
  reference: PracticeRepairEntryConfirmation["reference"];
  userId: string;
}): Promise<FlashCardSessionResult> {
  if (input.persistentRecallContext !== undefined) {
    return input.persistentRecallContext.confirmPracticeRepairEntry(
      input.userId,
      {
        correction: input.correction,
        intent: input.intent,
        reference: input.reference,
      },
    );
  }

  return input.recallContext.confirmPracticeRepairEntry({
    correction: input.correction,
    intent: input.intent,
    reference: input.reference,
    userId: input.userId,
  });
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
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const userId = sessionSnapshot.user?.id ?? null;
  const sessionResults =
    userId === null ? [] : recallContext.listSessionResults({ userId });
  const workspace = findPracticeRepairDraftWorkspace({
    questionResultId,
    sessionResultId,
    sessionResults,
  });

  if (workspace === null) {
    return <Navigate to="/recall" />;
  }

  if (workspace.question.practiceRepairEntry !== undefined) {
    return (
      <Navigate
        params={{
          practiceRepairEntryId: getPracticeRepairEntryId(
            workspace.question.practiceRepairEntry,
          ),
        }}
        to="/recall/repair/$practiceRepairEntryId"
      />
    );
  }

  const practiceRepairDraft = getQuestionPracticeRepairDraft(
    workspace.question,
  );

  if (practiceRepairDraft === null) {
    return <Navigate to="/recall" />;
  }

  return (
    <RecallPracticeRepairDraftPage
      persistentRecallContext={persistentRecallContext}
      practiceRepairDraft={practiceRepairDraft}
      userId={userId}
      workspace={workspace}
    />
  );
}

function RecallPracticeRepairDraftPage({
  persistentRecallContext,
  practiceRepairDraft,
  userId,
  workspace,
}: Readonly<{
  persistentRecallContext: AppPersistentRecallContext | undefined;
  practiceRepairDraft: PracticeRepairDraft;
  userId: string | null;
  workspace: PracticeRepairDraftWorkspace;
}>) {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const { question } = workspace;
  const prompt = getRecallQuestionPrompt(question);
  const expectedAnswer = getRecallQuestionExpectedAnswer(question);
  const ratingLabel =
    question.selfRating === null
      ? "Not rated"
      : t(getRecallRatingTranslationKey(question.selfRating));
  const ratingTone = getRecallRatingTone(question.selfRating);
  const [selectedIntent, setSelectedIntent] =
    useState<PracticeRepairIntent | null>(null);
  const [correction, setCorrection] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedRepairDescription =
    selectedIntent === null
      ? "Select one action above, then describe the concrete repair you plan to make."
      : `Selected repair: ${formatPracticeRepairIntentLabel(selectedIntent)}.`;

  async function confirmPracticeRepair() {
    if (userId === null || selectedIntent === null) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await confirmDraftPracticeRepairEntry({
        correction,
        intent: selectedIntent,
        persistentRecallContext,
        recallContext,
        reference: getPracticeRepairDraftReference(workspace),
        userId,
      });
      const practiceRepairEntry =
        result.questions[workspace.questionIndex]?.practiceRepairEntry;

      if (practiceRepairEntry === undefined) {
        throw new Error(
          "Expected Practice Repair confirmation to create an entry.",
        );
      }

      await navigate({
        params: {
          practiceRepairEntryId: getPracticeRepairEntryId(practiceRepairEntry),
        },
        to: "/recall/repair/$practiceRepairEntryId",
      });
    } catch (error) {
      if (error instanceof AppRecallError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-label="Practice Repair draft" className="recall-workspace">
      <article className="recall-surface recall-practice-repair-draft">
        <PageHeader
          actions={
            <ButtonLink to="/recall/results" variant="secondary">
              Open Results
            </ButtonLink>
          }
          beforeTitle={<RecallBreadcrumb currentLabel="Practice Repair" />}
          className="recall-surface__header"
          description="This recall needs practice. Review the original evidence before choosing a repair."
          headingLevel={1}
          title="Practice Repair"
        />

        <div className="recall-practice-repair-draft__layout">
          <section
            aria-label="Practice Repair evidence"
            className="recall-panel recall-practice-repair-draft__evidence"
          >
            <header className="recall-practice-repair-draft__card-header">
              <div className="recall-practice-repair-draft__card-copy">
                <p className="recall-practice-repair-draft__eyebrow">
                  Study Note
                </p>
                <h2 className="recall-practice-repair-draft__study-note-title">
                  {prompt}
                </h2>
                <p className="recall-practice-repair-draft__study-note-meta">
                  {getStudyNoteMeta(question)}
                </p>
              </div>

              <ButtonLink to="/study-notes" variant="secondary">
                View note
              </ButtonLink>
            </header>

            <section className="recall-practice-repair-draft__detail">
              <p className="recall-practice-repair-draft__detail-label">
                Prompt (what you were asked)
              </p>
              <p className="recall-practice-repair-draft__detail-copy">
                {prompt}
              </p>
            </section>

            <section className="recall-practice-repair-draft__detail">
              <div className="recall-practice-repair-draft__detail-header">
                <p className="recall-practice-repair-draft__detail-label">
                  Your answer
                </p>
                <span
                  className="recall-selected-result__row-pill recall-practice-repair-draft__rating"
                  data-rating-tone={ratingTone}
                >
                  {ratingLabel}
                </span>
              </div>
              <p className="recall-practice-repair-draft__detail-copy">
                {getRecallQuestionRecordedAnswer(question)}
              </p>
            </section>

            <section className="recall-practice-repair-draft__detail">
              <p className="recall-practice-repair-draft__detail-label">
                Expected answer
              </p>
              <p className="recall-practice-repair-draft__detail-copy">
                {expectedAnswer}
              </p>
            </section>

            <section className="recall-practice-repair-draft__callout">
              <strong>{`Last score: ${ratingLabel}`}</strong>
              <p>
                Needs practice is a signal to adjust and reinforce before the
                next recall.
              </p>
            </section>
          </section>

          <aside
            aria-label="Suggested repairs"
            className="recall-panel recall-practice-repair-draft__suggestions"
          >
            <div className="recall-practice-repair-draft__suggestions-copy">
              <h2>Suggested repairs</h2>
              <p>{practiceRepairDraft.summary}</p>
            </div>

            <div className="recall-practice-repair-draft__suggestion-list">
              {draftSuggestionCards.map((card) => (
                <article
                  className="recall-practice-repair-draft__suggestion"
                  data-selected={
                    card.intent !== undefined && card.intent === selectedIntent
                  }
                  key={card.title}
                >
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  {card.intent === undefined ? (
                    <p className="muted">
                      Available after you confirm a repair and come back for the
                      follow-up attempt.
                    </p>
                  ) : (
                    <Button
                      onClick={() => {
                        setSelectedIntent(card.intent);
                        setErrorMessage(null);
                      }}
                      size="compact"
                      type="button"
                      variant={
                        card.intent === selectedIntent ? "primary" : "secondary"
                      }
                    >
                      {card.title}
                    </Button>
                  )}
                </article>
              ))}
            </div>

            <section className="recall-practice-repair-draft__confirmation">
              <div className="recall-practice-repair-draft__confirmation-copy">
                <h2>Choose one repair to confirm</h2>
                <p>{selectedRepairDescription}</p>
              </div>

              <div className="recall-practice-repair-draft__detail">
                <p className="recall-practice-repair-draft__detail-label">
                  Correction
                </p>
                <FloatingTextarea
                  label="Correction"
                  onChange={(event) => setCorrection(event.target.value)}
                  value={correction}
                />
              </div>

              {errorMessage === null ? null : (
                <p
                  className="recall-practice-repair-draft__confirmation-error"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}

              <Button
                disabled={
                  userId === null ||
                  selectedIntent === null ||
                  correction.trim().length === 0 ||
                  isSubmitting
                }
                onClick={() => void confirmPracticeRepair()}
                type="button"
                variant="primary"
              >
                Confirm Practice Repair
              </Button>
            </section>
          </aside>
        </div>

        <p className="recall-practice-repair-draft__support">
          Metaphors and acronyms are optional support material, not required.
        </p>
      </article>
    </section>
  );
}
