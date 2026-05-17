import { createFileRoute, useRouteContext } from "@tanstack/react-router";

import { ButtonLink } from "../../design-system/button";
import { PageHeader } from "../../design-system/page-header";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import { useAppTranslation } from "../language";
import { getRecallRatingTranslationKey } from "./learner-copy";
import { RecallBreadcrumb } from "./recall-breadcrumb";
import {
  formatPracticeRepairIntentLabel,
  getPracticeRepairEntryId,
  listActivePracticeRepairQueueItems,
  type PracticeRepairQueueQuestionLike,
} from "./recall-practice-repair";

export const Route = createFileRoute("/_protected/recall/repair")({
  component: RecallPracticeRepairQueueRoute,
});

function getQuestionPrompt(question: PracticeRepairQueueQuestionLike) {
  const prompt =
    question.noteSnapshot.prompt?.trim() ?? question.noteSnapshot.title;

  return prompt.length > 0 ? prompt : question.noteSnapshot.body;
}

function getQuestionReferenceTitle(question: PracticeRepairQueueQuestionLike) {
  const sourceTitle = question.noteSnapshot.source?.title?.trim();

  if (sourceTitle !== undefined && sourceTitle.length > 0) {
    return sourceTitle;
  }

  return question.noteSnapshot.title;
}

function RecallPracticeRepairQueueRoute() {
  const { t } = useAppTranslation();
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const userId = sessionSnapshot.user?.id ?? null;
  const sessionResults =
    userId === null ? [] : recallContext.listSessionResults({ userId });
  const activeQueue = listActivePracticeRepairQueueItems({
    results: sessionResults,
  });

  return (
    <section aria-label="Practice Repair Queue" className="recall-workspace">
      <article className="recall-surface">
        <PageHeader
          actions={
            <ButtonLink to="/recall" variant="secondary">
              Recall Today
            </ButtonLink>
          }
          beforeTitle={
            <RecallBreadcrumb currentLabel="Practice Repair Queue" />
          }
          className="recall-surface__header"
          description="Resume active Practice Repair work already confirmed from Recall results."
          headingLevel={1}
          title="Practice Repair Queue"
        />

        {activeQueue.length === 0 ? (
          <section className="recall-panel recall-empty-state" role="status">
            <h4>No active Practice Repair entries.</h4>
            <p className="muted">
              Confirmed repairs show up here until you complete or dismiss them.
            </p>
          </section>
        ) : (
          <section className="recall-practice-repair-queue">
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
                const rating =
                  question.selfRating === null
                    ? "Not rated"
                    : t(getRecallRatingTranslationKey(question.selfRating));

                return (
                  <li key={getPracticeRepairEntryId(entry)}>
                    <article className="recall-panel recall-practice-repair-queue__item">
                      <div className="recall-practice-repair-queue__content">
                        <div className="recall-practice-repair-queue__meta">
                          <p className="recall-practice-repair-queue__eyebrow">
                            {formatPracticeRepairIntentLabel(entry.intent)}
                          </p>
                          <p className="recall-practice-repair-queue__rating">
                            {rating}
                          </p>
                        </div>
                        <h5>{getQuestionPrompt(question)}</h5>
                        <p>{entry.correction}</p>
                        <p className="muted">
                          Reference explanation:{" "}
                          {getQuestionReferenceTitle(question)}
                        </p>
                      </div>

                      <ButtonLink
                        size="compact"
                        to="/recall/repair/$practiceRepairEntryId"
                        params={{
                          practiceRepairEntryId:
                            getPracticeRepairEntryId(entry),
                        }}
                        variant="secondary"
                      >
                        Resume Practice Repair
                      </ButtonLink>
                    </article>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </article>
    </section>
  );
}
