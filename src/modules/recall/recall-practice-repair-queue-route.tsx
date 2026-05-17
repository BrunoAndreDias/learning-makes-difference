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
  getPracticeRepairQuestionPrompt,
  getPracticeRepairQuestionReferenceTitle,
  listPracticeRepairQueueItems,
} from "./recall-practice-repair";

export const Route = createFileRoute("/_protected/recall/repair")({
  component: RecallPracticeRepairQueueRoute,
});

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
  const queueItems = listPracticeRepairQueueItems({
    results: sessionResults,
  });
  const activeQueue = queueItems.filter((item) => item.kind === "active");
  const candidateQueue = queueItems.filter((item) => item.kind === "candidate");

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
          description="Resume active Practice Repair work first, then confirm the newest repair candidates from weak Recall results."
          headingLevel={1}
          title="Practice Repair Queue"
        />

        {queueItems.length === 0 ? (
          <section className="recall-panel recall-empty-state" role="status">
            <h4>No active Practice Repair entries.</h4>
            <p className="muted">
              Confirmed repairs and new repair candidates show up here when
              Recall surfaces work you can act on.
            </p>
          </section>
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
                            <h5>{getPracticeRepairQuestionPrompt(question)}</h5>
                            <p>{entry.correction}</p>
                            <p className="muted">
                              Reference explanation:{" "}
                              {getPracticeRepairQuestionReferenceTitle(
                                question,
                              )}
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

            {candidateQueue.length === 0 ? null : (
              <section className="recall-practice-repair-queue__section">
                <div className="recall-practice-repair-queue__header">
                  <h4>Repair candidates</h4>
                  <p className="muted">
                    Confirm one concrete repair when Recall shows new
                    needs-practice evidence.
                  </p>
                </div>

                <ol
                  aria-label="Practice Repair candidates"
                  className="recall-practice-repair-queue__list"
                >
                  {candidateQueue.map(({ draft, question, result }) => {
                    const rating =
                      question.selfRating === null
                        ? "Not rated"
                        : t(getRecallRatingTranslationKey(question.selfRating));
                    const questionResultId = question.questionResultId;
                    const candidateKey =
                      questionResultId ??
                      `${result.id}-${question.noteId ?? getPracticeRepairQuestionPrompt(question)}`;

                    if (questionResultId === undefined) {
                      return null;
                    }

                    return (
                      <li key={candidateKey}>
                        <article className="recall-panel recall-practice-repair-queue__item">
                          <div className="recall-practice-repair-queue__content">
                            <div className="recall-practice-repair-queue__meta">
                              <p className="recall-practice-repair-queue__eyebrow">
                                Needs practice candidate
                              </p>
                              <p className="recall-practice-repair-queue__rating">
                                {rating}
                              </p>
                            </div>
                            <h5>{getPracticeRepairQuestionPrompt(question)}</h5>
                            <p>{draft.summary}</p>
                            <p className="muted">
                              Reference explanation:{" "}
                              {getPracticeRepairQuestionReferenceTitle(
                                question,
                              )}
                            </p>
                          </div>

                          <ButtonLink
                            size="compact"
                            to="/recall/results/$sessionResultId/questions/$questionResultId/repair"
                            params={{
                              questionResultId,
                              sessionResultId: result.id,
                            }}
                            variant="secondary"
                          >
                            Open Practice Repair draft
                          </ButtonLink>
                        </article>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </section>
        )}
      </article>
    </section>
  );
}
