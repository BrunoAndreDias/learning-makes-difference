import {
  createFileRoute,
  Navigate,
  useRouteContext,
} from "@tanstack/react-router";

import { ButtonLink } from "../../design-system/button";
import { PageHeader } from "../../design-system/page-header";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import { useAppTranslation } from "../language";
import { getRecallRatingTranslationKey } from "./learner-copy";
import type { FlashCardSessionResult, RecallQuestion } from "./recall";
import { RecallBreadcrumb } from "./recall-breadcrumb";
import {
  formatPracticeRepairIntentLabel,
  getPracticeRepairEntryId,
  type PracticeRepairEntry,
} from "./recall-practice-repair";

export const Route = createFileRoute(
  "/_protected/recall/repair/$practiceRepairEntryId",
)({
  component: RecallPracticeRepairRoute,
});

type PracticeRepairWorkspace = {
  entry: PracticeRepairEntry;
  question: RecallQuestion;
  result: FlashCardSessionResult;
};

function getQuestionPrompt(question: RecallQuestion) {
  const prompt =
    question.noteSnapshot.prompt?.trim() ?? question.noteSnapshot.title;

  return prompt.length > 0 ? prompt : question.noteSnapshot.body;
}

function getQuestionExpectedAnswer(question: RecallQuestion) {
  return question.noteSnapshot.expectedAnswer ?? question.noteSnapshot.body;
}

function getQuestionReferenceText(question: RecallQuestion) {
  return question.noteSnapshot.source?.body ?? question.noteSnapshot.body;
}

function getQuestionReferenceTitle(question: RecallQuestion) {
  const sourceTitle = question.noteSnapshot.source?.title?.trim();

  if (sourceTitle !== undefined && sourceTitle.length > 0) {
    return sourceTitle;
  }

  return question.noteSnapshot.title;
}

function getRecordedAnswer(question: RecallQuestion) {
  const typedAnswer = question.typedAnswer?.trim() ?? "";

  return typedAnswer.length > 0 ? typedAnswer : "No answer recorded.";
}

function findPracticeRepairWorkspace(input: {
  practiceRepairEntryId: string;
  sessionResults: readonly FlashCardSessionResult[];
}): PracticeRepairWorkspace | null {
  for (const result of input.sessionResults) {
    for (const question of result.questions) {
      const entry = question.practiceRepairEntry;

      if (
        entry !== undefined &&
        getPracticeRepairEntryId(entry) === input.practiceRepairEntryId
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

function RecallPracticeRepairRoute() {
  const { practiceRepairEntryId } = Route.useParams();
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const userId = sessionSnapshot.user?.id ?? null;
  const sessionResults =
    userId === null ? [] : recallContext.listSessionResults({ userId });
  const workspace = findPracticeRepairWorkspace({
    practiceRepairEntryId,
    sessionResults,
  });

  if (workspace === null) {
    return <Navigate to="/recall" />;
  }

  return <RecallPracticeRepairWorkspacePage workspace={workspace} />;
}

function RecallPracticeRepairWorkspacePage({
  workspace,
}: Readonly<{
  workspace: PracticeRepairWorkspace;
}>) {
  const { t } = useAppTranslation();
  const prompt = getQuestionPrompt(workspace.question);
  const expectedAnswer = getQuestionExpectedAnswer(workspace.question);
  const referenceTitle = getQuestionReferenceTitle(workspace.question);
  const referenceText = getQuestionReferenceText(workspace.question);
  const rating =
    workspace.question.selfRating === null
      ? "Not rated"
      : t(getRecallRatingTranslationKey(workspace.question.selfRating));

  return (
    <section
      aria-label="Practice Repair workspace"
      className="recall-workspace"
    >
      <article className="recall-surface">
        <PageHeader
          actions={
            <ButtonLink to="/recall/results" variant="secondary">
              Open Results
            </ButtonLink>
          }
          beforeTitle={<RecallBreadcrumb currentLabel="Practice Repair" />}
          className="recall-surface__header"
          description="Resume a confirmed Practice Repair from its canonical Recall route."
          headingLevel={1}
          title="Practice Repair"
        />

        <section aria-label="Practice Repair summary" className="recall-panel">
          <h4>Confirmed repair</h4>
          <p>
            <strong>Intent</strong>
          </p>
          <p>{formatPracticeRepairIntentLabel(workspace.entry.intent)}</p>
          <p>
            <strong>Correction</strong>
          </p>
          <p>{workspace.entry.correction}</p>
          {workspace.entry.nextPracticeIdea === undefined ? null : (
            <>
              <p>
                <strong>Next-practice idea</strong>
              </p>
              <p>{workspace.entry.nextPracticeIdea}</p>
            </>
          )}
        </section>

        <section
          aria-label="Practice Repair origin evidence"
          className="recall-panel"
        >
          <h4>Origin evidence</h4>
          <p>
            <strong>Study Note</strong>
          </p>
          <p>{prompt}</p>
          <p>
            <strong>Rating</strong>
          </p>
          <p>{rating}</p>
          <p>
            <strong>Your answer</strong>
          </p>
          <p>{getRecordedAnswer(workspace.question)}</p>
          <p>
            <strong>Expected answer</strong>
          </p>
          <p>{expectedAnswer}</p>
          <p>
            <strong>Reference explanation</strong>
          </p>
          <p>{referenceTitle}</p>
          <p>{referenceText}</p>
          <p>
            <strong>Session Result</strong>
          </p>
          <p>{workspace.result.id}</p>
        </section>
      </article>
    </section>
  );
}
