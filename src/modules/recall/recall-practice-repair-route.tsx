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
import {
  getRecallRatingTone,
  getRecallRatingTranslationKey,
} from "./learner-copy";
import type { FlashCardSessionResult, RecallQuestion } from "./recall";
import { RecallBreadcrumb } from "./recall-breadcrumb";
import {
  formatPracticeRepairIntentLabel,
  getPracticeRepairEntryId,
  getPracticeRepairEntryLifecycleLabel,
  getPracticeRepairEntryLifecycleState,
  getPracticeRepairEntryLifecycleSummary,
  getPracticeRepairQuestionExpectedAnswer,
  getPracticeRepairQuestionPrompt,
  getPracticeRepairQuestionReferenceText,
  getPracticeRepairQuestionReferenceTitle,
  getPracticeRepairRecordedAnswer,
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

function getPracticeRepairLifecycleTone(
  entry: Pick<PracticeRepairEntry, "lifecycle">,
) {
  const lifecycleLabel = getPracticeRepairEntryLifecycleLabel(entry);

  if (getPracticeRepairEntryLifecycleState(entry) === "active") {
    return "active";
  }

  return lifecycleLabel === "Completed" ? "completed" : "historical";
}

function getPracticeRepairNextStepCopy(
  entry: Pick<PracticeRepairEntry, "lifecycle">,
) {
  const lifecycleLabel = getPracticeRepairEntryLifecycleLabel(entry);

  if (lifecycleLabel === "Completed") {
    return "Use Recall again soon after the repair work is complete to test this Study Note again.";
  }

  if (getPracticeRepairEntryLifecycleState(entry) === "active") {
    return "Make the repair in Study Notes, then come back here to continue the repair loop from the original evidence.";
  }

  return "Use Results for the full historical context, and use Recall when you want to revisit this Study Note again.";
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
  const prompt = getPracticeRepairQuestionPrompt(question);
  const expectedAnswer = getPracticeRepairQuestionExpectedAnswer(question);
  const referenceTitle = getPracticeRepairQuestionReferenceTitle(question);
  const referenceText = getPracticeRepairQuestionReferenceText(question);
  const lifecycleLabel = getPracticeRepairEntryLifecycleLabel(entry);
  const lifecycleSummary = getPracticeRepairEntryLifecycleSummary(entry);
  const lifecycleTone = getPracticeRepairLifecycleTone(entry);
  const nextStepCopy = getPracticeRepairNextStepCopy(entry);
  const ratingLabel =
    question.selfRating === null
      ? "Not rated"
      : t(getRecallRatingTranslationKey(question.selfRating));
  const ratingTone = getRecallRatingTone(question.selfRating);

  return (
    <section
      aria-label="Practice Repair workspace"
      className="recall-workspace"
    >
      <article className="recall-surface recall-practice-repair-workspace">
        <PageHeader
          actions={
            <ButtonLink to="/recall/repair" variant="secondary">
              Practice Repair Queue
            </ButtonLink>
          }
          beforeTitle={<RecallBreadcrumb currentLabel="Practice Repair" />}
          className="recall-surface__header"
          description="Keep the original Needs practice evidence visible while you finish one concrete repair from Recall."
          headingLevel={1}
          title="Practice Repair"
        />

        <div className="recall-practice-repair-workspace__layout">
          <section
            aria-label="Practice Repair evidence"
            className="recall-panel recall-practice-repair-workspace__evidence"
          >
            <header className="recall-practice-repair-workspace__card-header">
              <div className="recall-practice-repair-workspace__card-copy">
                <p className="recall-practice-repair-workspace__eyebrow">
                  Study Note
                </p>
                <h2 className="recall-practice-repair-workspace__study-note-title">
                  {prompt}
                </h2>
                <p className="recall-practice-repair-workspace__study-note-meta">
                  {getStudyNoteMeta(question)}
                </p>
              </div>

              <ButtonLink to="/study-notes" variant="secondary">
                View note
              </ButtonLink>
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
              <div className="recall-practice-repair-workspace__detail-copy">
                {getPracticeRepairRecordedAnswer(question)}
              </div>
            </section>

            <PracticeRepairWorkspaceDetail label="Expected answer">
              {expectedAnswer}
            </PracticeRepairWorkspaceDetail>

            <PracticeRepairWorkspaceDetail label="Reference explanation">
              <>
                <strong>{referenceTitle}</strong>
                <span>{referenceText}</span>
              </>
            </PracticeRepairWorkspaceDetail>

            <section className="recall-practice-repair-workspace__callout">
              <strong>{`Last score: ${ratingLabel}`}</strong>
              <p>
                Needs practice is a signal to adjust and reinforce before the
                next recall.
              </p>
            </section>
          </section>

          <aside
            aria-label="Practice Repair actions"
            className="recall-practice-repair-workspace__sidebar"
          >
            <section className="recall-panel recall-practice-repair-workspace__panel">
              <div className="recall-practice-repair-workspace__panel-copy">
                <h2>Selected repair</h2>
                <p>
                  Practice Repair keeps one concrete fix attached to the
                  original Recall evidence.
                </p>
              </div>

              <PracticeRepairWorkspaceDetail label="Intent">
                {formatPracticeRepairIntentLabel(entry.intent)}
              </PracticeRepairWorkspaceDetail>

              <PracticeRepairWorkspaceDetail label="Correction">
                {entry.correction}
              </PracticeRepairWorkspaceDetail>

              {entry.nextPracticeIdea === undefined ? null : (
                <PracticeRepairWorkspaceDetail label="Next-practice idea">
                  {entry.nextPracticeIdea}
                </PracticeRepairWorkspaceDetail>
              )}
            </section>

            <section className="recall-panel recall-practice-repair-workspace__panel">
              <div className="recall-practice-repair-workspace__panel-copy">
                <h2>Repair state</h2>
                <p>{lifecycleSummary}</p>
              </div>

              <div className="recall-practice-repair-workspace__state-card">
                <p className="recall-practice-repair-workspace__detail-label">
                  Entry state
                </p>
                <div className="recall-practice-repair-workspace__state-row">
                  <span
                    className="recall-practice-repair-workspace__state-badge"
                    data-lifecycle-tone={lifecycleTone}
                  >
                    {lifecycleLabel}
                  </span>
                </div>
                <p className="recall-practice-repair-workspace__state-meta">
                  Origin result: {result.id}
                </p>
              </div>
            </section>

            <section className="recall-panel recall-practice-repair-workspace__panel">
              <div className="recall-practice-repair-workspace__panel-copy">
                <h2>Next step</h2>
                <p>{nextStepCopy}</p>
              </div>

              <div className="recall-practice-repair-workspace__actions">
                <ButtonLink to="/study-notes" variant="secondary">
                  Open Study Notes
                </ButtonLink>
                <ButtonLink to="/recall" variant="primary">
                  Recall again soon
                </ButtonLink>
              </div>

              <p className="recall-practice-repair-workspace__support">
                Results keeps the historical evidence. This workspace keeps the
                active repair in view.
              </p>
            </section>
          </aside>
        </div>
      </article>
    </section>
  );
}
