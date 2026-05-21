import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { type ReactNode, useSyncExternalStore } from "react";

import { ButtonLink } from "../../design-system/button";
import { PageLayout } from "../../design-system/page-layout";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import { useAppTranslation } from "../language";
import { getStudyNoteReadiness, listStudyNotesForUser } from "../study-notes";
import { appRoutePaths } from "../workspace-shell/app-shell/route-paths";
import { getRecallRatingTranslationKey } from "./learner-copy";
import {
  formatPracticeRepairIntentLabel,
  getPracticeRepairEntryId,
  getPracticeRepairQuestionPrompt,
  getPracticeRepairQuestionReferenceTitle,
  listPracticeRepairQueueItems,
  type PracticeRepairQueueListItem,
  type PracticeRepairQueueQuestionLike,
} from "./recall-practice-repair";

export const Route = createFileRoute("/_protected/practice-repair")({
  component: RecallPracticeRepairQueueRoute,
});

type PracticeRepairEmptyStateAction =
  | "review-results"
  | "start-custom-recall"
  | "create-first-study-note";
type ActivePracticeRepairQueueItem = Extract<
  PracticeRepairQueueListItem,
  { kind: "active" }
>;
type CandidatePracticeRepairQueueItem = Extract<
  PracticeRepairQueueListItem,
  { kind: "candidate" }
>;

function getPracticeRepairEmptyStateAction(input: {
  hasResults: boolean;
  recallableStudyNoteCount: number;
}): PracticeRepairEmptyStateAction {
  if (input.hasResults) {
    return "review-results";
  }

  if (input.recallableStudyNoteCount > 0) {
    return "start-custom-recall";
  }

  return "create-first-study-note";
}

function getPracticeRepairEmptyStateDescription(
  action: PracticeRepairEmptyStateAction,
) {
  switch (action) {
    case "review-results":
      return "Results already has weak recall evidence. Review the latest results to start Practice Repair from the original questions.";
    case "start-custom-recall":
      return "No stored results exist yet. Start custom recall to generate the weak evidence that can become Practice Repair work.";
    case "create-first-study-note":
      return "Practice Repair starts after recall evidence exists. Create your first recallable Study Note first.";
  }
}

function getPracticeRepairQueueRating(
  question: Pick<PracticeRepairQueueQuestionLike, "selfRating">,
  translate: (key: string) => string,
) {
  if (question.selfRating === null) {
    return "Not rated";
  }

  return translate(getRecallRatingTranslationKey(question.selfRating));
}

function PracticeRepairQueueHeaderAction({
  emptyStateAction,
  nextActiveEntry,
  nextCandidateEntry,
}: Readonly<{
  emptyStateAction: PracticeRepairEmptyStateAction;
  nextActiveEntry: ActivePracticeRepairQueueItem | undefined;
  nextCandidateEntry: CandidatePracticeRepairQueueItem | undefined;
}>) {
  if (nextActiveEntry !== undefined) {
    return (
      <ButtonLink
        params={{
          practiceRepairEntryId: getPracticeRepairEntryId(
            nextActiveEntry.entry,
          ),
        }}
        to="/practice-repair/$practiceRepairEntryId"
        variant="primary"
      >
        Open next repair
      </ButtonLink>
    );
  }

  if (nextCandidateEntry !== undefined) {
    return (
      <ButtonLink
        params={{
          questionResultId: nextCandidateEntry.question.questionResultId,
          sessionResultId: nextCandidateEntry.result.id,
        }}
        to="/practice-repair/results/$sessionResultId/questions/$questionResultId"
        variant="primary"
      >
        Open next repair
      </ButtonLink>
    );
  }

  switch (emptyStateAction) {
    case "review-results":
      return (
        <ButtonLink to={appRoutePaths.recallResults} variant="primary">
          Review results
        </ButtonLink>
      );
    case "start-custom-recall":
      return (
        <ButtonLink to={appRoutePaths.recallSelect} variant="primary">
          Start custom recall
        </ButtonLink>
      );
    case "create-first-study-note":
      return (
        <ButtonLink to={appRoutePaths.studyNotes} variant="primary">
          Create first Study Note
        </ButtonLink>
      );
  }
}

function PracticeRepairQueueCard({
  action,
  body,
  eyebrow,
  question,
  rating,
  supportingSummary,
}: Readonly<{
  action: ReactNode;
  body: string;
  eyebrow: string;
  question: PracticeRepairQueueQuestionLike;
  rating: string;
  supportingSummary?: string;
}>) {
  return (
    <article className="recall-panel recall-practice-repair-queue__item">
      <div className="recall-practice-repair-queue__content">
        <div className="recall-practice-repair-queue__meta">
          <p className="recall-practice-repair-queue__eyebrow">{eyebrow}</p>
          <p className="recall-practice-repair-queue__rating">{rating}</p>
        </div>
        <h5>{getPracticeRepairQuestionPrompt(question)}</h5>
        <p>{body}</p>
        {supportingSummary === undefined ? null : (
          <p className="muted">{supportingSummary}</p>
        )}
        <p className="muted">
          Reference explanation:{" "}
          {getPracticeRepairQuestionReferenceTitle(question)}
        </p>
      </div>

      {action}
    </article>
  );
}

function PracticeRepairQueueEmptyState({
  action,
}: Readonly<{
  action: PracticeRepairEmptyStateAction;
}>) {
  return (
    <section className="recall-panel recall-empty-state" role="status">
      <h4>No active Practice Repair entries.</h4>
      <p className="muted">{getPracticeRepairEmptyStateDescription(action)}</p>
    </section>
  );
}

function RecallPracticeRepairQueueRoute() {
  const { t } = useAppTranslation();
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
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const studyNotesStore = persistentStudyNotesContext ?? studyNotesContext;
  const studyNotesSnapshot = useSyncExternalStore(
    studyNotesStore.subscribe,
    studyNotesStore.getSnapshot,
    studyNotesStore.getSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const sessionResults =
    userId === null ? [] : recallContext.listSessionResults({ userId });
  const studyNotes =
    userId === null ? [] : listStudyNotesForUser(studyNotesSnapshot, userId);
  const queueItems = listPracticeRepairQueueItems({
    results: sessionResults,
  });
  const activeQueue = queueItems.filter((item) => item.kind === "active");
  const candidateQueue = queueItems.filter((item) => item.kind === "candidate");
  const recallableStudyNoteCount = studyNotes.filter(
    (studyNote) => getStudyNoteReadiness(studyNote).recallable,
  ).length;
  const emptyStateAction = getPracticeRepairEmptyStateAction({
    hasResults: sessionResults.length > 0,
    recallableStudyNoteCount,
  });
  const nextActiveEntry = activeQueue[0];
  const nextCandidateEntry = candidateQueue[0];

  return (
    <PageLayout
      actions={
        <PracticeRepairQueueHeaderAction
          emptyStateAction={emptyStateAction}
          nextActiveEntry={nextActiveEntry}
          nextCandidateEntry={nextCandidateEntry}
        />
      }
      aria-label="Practice Repair Queue"
      as="section"
      bodyClassName="recall-practice-repair-queue__body"
      className="recall-workspace recall-surface"
      description="Resume active Practice Repair work first, then open the newest repair candidates from weak Results evidence."
      headerClassName="recall-surface__header"
      headingLevel={1}
      title="Practice Repair Queue"
    >
      {queueItems.length === 0 ? (
        <PracticeRepairQueueEmptyState action={emptyStateAction} />
      ) : (
        <section className="recall-practice-repair-queue">
          {activeQueue.length === 0 ? null : (
            <section className="recall-practice-repair-queue__section">
              <div className="recall-practice-repair-queue__header">
                <h4>Active Practice Repair</h4>
                <p className="muted">
                  Resume confirmed repairs before starting new repair work.
                </p>
              </div>

              <ol
                aria-label="Active Practice Repair entries"
                className="recall-practice-repair-queue__list"
              >
                {activeQueue.map(({ entry, question }) => {
                  const rating = getPracticeRepairQueueRating(question, t);
                  const practiceRepairEntryId = getPracticeRepairEntryId(entry);

                  return (
                    <li key={practiceRepairEntryId}>
                      <PracticeRepairQueueCard
                        action={
                          <ButtonLink
                            size="compact"
                            params={{
                              practiceRepairEntryId,
                            }}
                            to="/practice-repair/$practiceRepairEntryId"
                            variant="secondary"
                          >
                            Resume Practice Repair
                          </ButtonLink>
                        }
                        body={entry.correction}
                        eyebrow={formatPracticeRepairIntentLabel(entry.intent)}
                        question={question}
                        rating={rating}
                      />
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {candidateQueue.length === 0 ? null : (
            <section className="recall-practice-repair-queue__section">
              <div className="recall-practice-repair-queue__header">
                <h4>Repair candidates</h4>
                <p className="muted">
                  Open one candidate when Recall shows new needs-practice
                  evidence.
                </p>
              </div>

              <ol
                aria-label="Practice Repair candidates"
                className="recall-practice-repair-queue__list"
              >
                {candidateQueue.map((item) => {
                  const { draft, question, result } = item;
                  const rating = getPracticeRepairQueueRating(question, t);

                  return (
                    <li key={question.questionResultId}>
                      <PracticeRepairQueueCard
                        action={
                          <ButtonLink
                            size="compact"
                            to="/practice-repair/results/$sessionResultId/questions/$questionResultId"
                            params={{
                              questionResultId: question.questionResultId,
                              sessionResultId: result.id,
                            }}
                            variant="secondary"
                          >
                            Open Practice Repair
                          </ButtonLink>
                        }
                        body={draft.summary}
                        eyebrow="Needs practice candidate"
                        question={question}
                        rating={rating}
                        supportingSummary={
                          item.recentWeakAttemptsSummary ?? undefined
                        }
                      />
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </section>
      )}
    </PageLayout>
  );
}
