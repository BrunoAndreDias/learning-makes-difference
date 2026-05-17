import {
  createFileRoute,
  Navigate,
  useRouteContext,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

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
import {
  getRecallQuestionExpectedAnswer as getQuestionExpectedAnswer,
  getRecallQuestionPrompt as getQuestionPrompt,
  getRecallQuestionReferenceText as getQuestionReferenceText,
  getRecallQuestionReferenceTitle as getQuestionReferenceTitle,
  getRecallQuestionRecordedAnswer as getRecordedAnswer,
} from "./recall-question-evidence";

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

function PracticeRepairDetail({
  children,
  label,
}: Readonly<{
  children: ReactNode;
  label: string;
}>) {
  return (
    <>
      <p>
        <strong>{label}</strong>
      </p>
      <p>{children}</p>
    </>
  );
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
  const { entry, question, result } = workspace;
  const prompt = getQuestionPrompt(question);
  const expectedAnswer = getQuestionExpectedAnswer(question);
  const referenceTitle = getQuestionReferenceTitle(question);
  const referenceText = getQuestionReferenceText(question);
  const rating =
    question.selfRating === null
      ? "Not rated"
      : t(getRecallRatingTranslationKey(question.selfRating));

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
          <PracticeRepairDetail label="Intent">
            {formatPracticeRepairIntentLabel(entry.intent)}
          </PracticeRepairDetail>
          <PracticeRepairDetail label="Correction">
            {entry.correction}
          </PracticeRepairDetail>
          {entry.nextPracticeIdea === undefined ? null : (
            <PracticeRepairDetail label="Next-practice idea">
              {entry.nextPracticeIdea}
            </PracticeRepairDetail>
          )}
        </section>

        <section
          aria-label="Practice Repair origin evidence"
          className="recall-panel"
        >
          <h4>Origin evidence</h4>
          <PracticeRepairDetail label="Study Note">
            {prompt}
          </PracticeRepairDetail>
          <PracticeRepairDetail label="Rating">{rating}</PracticeRepairDetail>
          <PracticeRepairDetail label="Your answer">
            {getRecordedAnswer(question)}
          </PracticeRepairDetail>
          <PracticeRepairDetail label="Expected answer">
            {expectedAnswer}
          </PracticeRepairDetail>
          <PracticeRepairDetail label="Reference explanation">
            {referenceTitle}
          </PracticeRepairDetail>
          <p>{referenceText}</p>
          <PracticeRepairDetail label="Session Result">
            {result.id}
          </PracticeRepairDetail>
        </section>
      </article>
    </section>
  );
}
