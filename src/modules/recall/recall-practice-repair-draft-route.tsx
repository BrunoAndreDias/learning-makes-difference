import {
  createFileRoute,
  Navigate,
  useRouteContext,
} from "@tanstack/react-router";

import { ButtonLink } from "../../design-system/button";
import { PageHeader } from "../../design-system/page-header";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import { useAppTranslation } from "../language";
import {
  getRecallRatingTone,
  getRecallRatingTranslationKey,
} from "./learner-copy";
import type { FlashCardSessionResult, RecallQuestion } from "./recall";
import { RecallBreadcrumb } from "./recall-breadcrumb";
import { getQuestionPracticeRepairDraft } from "./recall-practice-repair";
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
};

const draftSuggestionCards = [
  {
    description:
      "Clarify or expand the answer so the next recall target is easier to judge.",
    title: "Edit expected answer",
  },
  {
    description:
      "Break a broad concept into smaller, focused Study Notes you can train one at a time.",
    title: "Split this Study Note",
  },
  {
    description:
      "Add a related concept or contrast from the same source explanation.",
    title: "Create a sibling Study Note",
  },
  {
    description:
      "Use a Metaphor or Acronym only if it solves this recall problem.",
    title: "Add a memory aid",
  },
  {
    description:
      "Return to this Study Note soon after you decide on the smallest useful repair.",
    title: "Recall again soon",
  },
] as const;

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

  const question = result.questions.find(
    (candidate) => candidate.questionResultId === questionResultId,
  );

  if (question === undefined) {
    return null;
  }

  return {
    question,
  };
}

function RecallPracticeRepairDraftRoute() {
  const { questionResultId, sessionResultId } = Route.useParams();
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
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

  const canOpenDraft =
    workspace.question.practiceRepairEntry !== undefined ||
    getQuestionPracticeRepairDraft(workspace.question) !== null;

  if (!canOpenDraft) {
    return <Navigate to="/recall" />;
  }

  return <RecallPracticeRepairDraftPage workspace={workspace} />;
}

function RecallPracticeRepairDraftPage({
  workspace,
}: Readonly<{
  workspace: PracticeRepairDraftWorkspace;
}>) {
  const { t } = useAppTranslation();
  const { question } = workspace;
  const prompt = getRecallQuestionPrompt(question);
  const expectedAnswer = getRecallQuestionExpectedAnswer(question);
  const ratingLabel =
    question.selfRating === null
      ? "Not rated"
      : t(getRecallRatingTranslationKey(question.selfRating));
  const ratingTone = getRecallRatingTone(question.selfRating);

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
              <p>Pick one small action to strengthen this Study Note.</p>
            </div>

            <div className="recall-practice-repair-draft__suggestion-list">
              {draftSuggestionCards.map((card) => (
                <article
                  className="recall-practice-repair-draft__suggestion"
                  key={card.title}
                >
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </article>
              ))}
            </div>
          </aside>
        </div>

        <p className="recall-practice-repair-draft__support">
          Metaphors and acronyms are optional support material, not required.
        </p>
      </article>
    </section>
  );
}
