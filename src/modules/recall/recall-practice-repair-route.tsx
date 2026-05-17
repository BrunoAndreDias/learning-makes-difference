import {
  createFileRoute,
  Navigate,
  useRouteContext,
} from "@tanstack/react-router";
import { type ReactNode, useState, useSyncExternalStore } from "react";

import { Button, ButtonLink } from "../../design-system/button";
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
  getPracticeRepairEntryLifecycleKind,
  getPracticeRepairEntryLifecycleLabel,
  getPracticeRepairEntryLifecycleSummary,
  getPracticeRepairQuestionExpectedAnswer,
  getPracticeRepairQuestionPrompt,
  getPracticeRepairQuestionReferenceText,
  getPracticeRepairQuestionReferenceTitle,
  getPracticeRepairRecordedAnswer,
  type PracticeRepairEntry,
  type PracticeRepairEntryLifecycleKind,
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
  lifecycleKind: PracticeRepairEntryLifecycleKind,
) {
  switch (lifecycleKind) {
    case "active":
      return "active";
    case "completed":
      return "completed";
    case "dismissed":
    case "follow-up-satisfied":
    case "study-note-deleted":
    case "superseded":
      return "historical";
  }
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

async function mutatePracticeRepairLifecycle(input: {
  action: "complete" | "dismiss";
  persistentRecallContext: AppPersistentRecallContext | undefined;
  reference: PracticeRepairEntry["reference"];
  recallContext: AppRecallContext;
  userId: string | null;
}) {
  const { persistentRecallContext, reference, recallContext, userId } = input;

  if (userId === null) {
    return;
  }

  if (input.action === "complete") {
    if (persistentRecallContext === undefined) {
      recallContext.completePracticeRepairEntry({
        reference,
        userId,
      });
      return;
    }

    await persistentRecallContext.completePracticeRepairEntry(userId, {
      reference,
    });

    return;
  }

  if (persistentRecallContext === undefined) {
    recallContext.dismissPracticeRepairEntry({
      reference,
      userId,
    });
    return;
  }

  await persistentRecallContext.dismissPracticeRepairEntry(userId, {
    reference,
  });
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
  useSyncExternalStore(
    recallResultsStore.subscribe,
    recallResultsStore.getSessionResultsSnapshot,
    recallResultsStore.getSessionResultsSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const sessionResults =
    userId === null ? [] : recallResultsContext.listSessionResults({ userId });
  const workspace = findPracticeRepairWorkspace({
    practiceRepairEntryId,
    sessionResults,
  });

  if (workspace === null) {
    return <Navigate to="/recall" />;
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

function RecallPracticeRepairWorkspacePage({
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
  const { t } = useAppTranslation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "complete" | "dismiss" | null
  >(null);
  const { entry, question, result } = workspace;
  const prompt = getPracticeRepairQuestionPrompt(question);
  const expectedAnswer = getPracticeRepairQuestionExpectedAnswer(question);
  const referenceTitle = getPracticeRepairQuestionReferenceTitle(question);
  const referenceText = getPracticeRepairQuestionReferenceText(question);
  const lifecycleKind = getPracticeRepairEntryLifecycleKind(entry);
  const lifecycleLabel = getPracticeRepairEntryLifecycleLabel(entry);
  const lifecycleSummary = getPracticeRepairEntryLifecycleSummary(entry);
  const lifecycleTone = getPracticeRepairLifecycleTone(lifecycleKind);
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
  const canOpenStudyNotes = lifecycleKind !== "study-note-deleted";
  const isMutationPending = pendingAction !== null;

  async function handleLifecycleMutation(action: "complete" | "dismiss") {
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
      setFeedbackMessage(
        action === "complete"
          ? "Practice Repair completed"
          : "Practice Repair dismissed",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof AppRecallError
          ? error.message
          : action === "complete"
            ? "Practice Repair could not be completed."
            : "Practice Repair could not be dismissed.",
      );
    } finally {
      setPendingAction(null);
    }
  }

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

              {canOpenStudyNotes ? (
                <ButtonLink to="/study-notes" variant="secondary">
                  View note
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
              <div className="recall-practice-repair-workspace__detail-copy">
                {getPracticeRepairRecordedAnswer(question)}
              </div>
            </section>

            <PracticeRepairWorkspaceDetail label="Expected answer">
              {expectedAnswer}
            </PracticeRepairWorkspaceDetail>

            <PracticeRepairWorkspaceDetail label="Reference explanation">
              <strong>{referenceTitle}</strong>
              <span>{referenceText}</span>
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
                {lifecycleKind === "active" ? (
                  <>
                    {canOpenStudyNotes ? (
                      <ButtonLink to="/study-notes" variant="secondary">
                        Open Study Notes
                      </ButtonLink>
                    ) : null}
                    <Button
                      disabled={isMutationPending}
                      onClick={() => void handleLifecycleMutation("complete")}
                      type="button"
                      variant="primary"
                    >
                      Mark repair complete
                    </Button>
                    <Button
                      disabled={isMutationPending}
                      onClick={() => void handleLifecycleMutation("dismiss")}
                      type="button"
                      variant="danger"
                    >
                      Dismiss repair
                    </Button>
                  </>
                ) : null}

                {lifecycleKind === "completed" ? (
                  <>
                    {canOpenStudyNotes ? (
                      <ButtonLink to="/study-notes" variant="secondary">
                        Open Study Notes
                      </ButtonLink>
                    ) : null}
                    <ButtonLink to="/recall" variant="primary">
                      Recall again soon
                    </ButtonLink>
                  </>
                ) : null}

                {lifecycleKind === "dismissed" ||
                lifecycleKind === "follow-up-satisfied" ? (
                  <ButtonLink to="/recall/results" variant="secondary">
                    Open Results
                  </ButtonLink>
                ) : null}

                {lifecycleKind === "study-note-deleted" ? (
                  <ButtonLink to="/recall/results" variant="secondary">
                    Open Results
                  </ButtonLink>
                ) : null}

                {lifecycleKind === "superseded" ? (
                  <>
                    {supersedingPracticeRepairEntryId === null ? null : (
                      <ButtonLink
                        params={{
                          practiceRepairEntryId:
                            supersedingPracticeRepairEntryId,
                        }}
                        to="/recall/repair/$practiceRepairEntryId"
                        variant="primary"
                      >
                        Open newer Practice Repair
                      </ButtonLink>
                    )}
                    <ButtonLink to="/recall/results" variant="secondary">
                      Open Results
                    </ButtonLink>
                  </>
                ) : null}
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
