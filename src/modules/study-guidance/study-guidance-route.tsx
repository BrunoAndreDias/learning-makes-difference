import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { ButtonLink } from "../../design-system/button";
import { PageHeader } from "../../design-system/page-header";
import { defaultUserTimeZone } from "../access/session/session-contract";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import type { AppLabel } from "../labels/label-management/labels";
import type { FlashCardRecallAttemptsByNote } from "../recall";
import { listStudyNotesForUser } from "../study-notes";
import "./study-guidance.css";
import {
  deriveStudyGuidance,
  getStudyGuidanceTopicStats,
} from "./study-guidance";

export const Route = createFileRoute("/_protected/insights")({
  component: StudyGuidanceWorkspace,
});

function StudyGuidanceWorkspace() {
  const labelsContext = Route.useRouteContext({
    select: (context) => context.labels,
  });
  const recallContext = Route.useRouteContext({
    select: (context) => context.recall,
  });
  const studyNotesContext = Route.useRouteContext({
    select: (context) => context.studyNotes,
  });
  const persistentStudyNotes = Route.useRouteContext({
    select: (context) => context.persistentStudyNotes,
  });
  const { sessionSnapshot } = useResolvedProtectedSession(
    "/_protected/insights",
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const userTimeZone =
    sessionSnapshot.user?.userTimeZone ?? defaultUserTimeZone;
  const [labels, setLabels] = useState<AppLabel[]>([]);
  const studyNotesStore = persistentStudyNotes ?? studyNotesContext;
  const studyNotesSnapshot = useSyncExternalStore(
    studyNotesStore.subscribe,
    studyNotesStore.getSnapshot,
    studyNotesStore.getSnapshot,
  );
  const sessionResults = useSyncExternalStore(
    recallContext.subscribe,
    recallContext.getSessionResultsSnapshot,
    recallContext.getSessionResultsSnapshot,
  );
  const recallSchedules = useSyncExternalStore(
    recallContext.subscribe,
    recallContext.getRecallSchedulesSnapshot,
    recallContext.getRecallSchedulesSnapshot,
  );
  const attemptsByNote: readonly FlashCardRecallAttemptsByNote[] =
    userId === null ? [] : recallContext.listAttemptsByNote({ userId });
  const studyNotes = useMemo(
    () => listStudyNotesForUser(studyNotesSnapshot, userId),
    [studyNotesSnapshot, userId],
  );

  useEffect(() => {
    function syncLabels() {
      if (userId === null) {
        setLabels([]);
        return;
      }

      setLabels(labelsContext.getLabelsForUser(userId));
    }

    syncLabels();

    return labelsContext.subscribe(syncLabels);
  }, [labelsContext, userId]);

  const guidance = useMemo(
    () =>
      deriveStudyGuidance({
        attemptsByNote,
        labels,
        now: new Date().toISOString(),
        recallSchedules,
        sessionResults,
        studyNotes,
        userTimeZone,
      }),
    [
      attemptsByNote,
      labels,
      recallSchedules,
      sessionResults,
      studyNotes,
      userTimeZone,
    ],
  );

  return (
    <section className="study-guidance-workspace">
      <PageHeader
        actions={
          <ButtonLink size="compact" to="/recall/select" variant="secondary">
            Manual selection
          </ButtonLink>
        }
        beforeTitle={
          <p className="study-guidance-workspace__eyebrow">Insights</p>
        }
        className="study-guidance-workspace__page-header"
        description="Recommendations based on your Study Notes and recall evidence."
        headingLevel={1}
        title="Study Guidance"
      />

      <section
        aria-label="Study Guidance summary"
        className="study-guidance-summary"
      >
        {guidance.stats.map((stat) => (
          <article className="study-guidance-stat" key={stat.id}>
            <p className="study-guidance-stat__label">{stat.label}</p>
            <strong className="study-guidance-stat__count">{stat.count}</strong>
            <p className="study-guidance-stat__notes">
              {formatCountLabel(stat.count)}
            </p>
            <p className="study-guidance-stat__detail">{stat.detail}</p>
          </article>
        ))}
      </section>

      <div className="study-guidance-content">
        <div className="study-guidance-content__main">
          <section className="study-guidance-callout">
            <h2>Passive activity does not count as learning evidence.</h2>
            <p>
              Rereading, highlighting, watching videos, and time spent are
              supportive activities.
            </p>
            <p>
              They only become useful when they help you create or improve Study
              Notes and generate recall evidence.
            </p>
          </section>

          {guidance.topics.length === 0 ? (
            <section className="study-guidance-empty">
              <h2>No Study Guidance yet</h2>
              <p>
                Create recallable Study Notes, then complete RecallSessions to
                surface factual guidance here.
              </p>
            </section>
          ) : (
            <div className="study-guidance-topics">
              {guidance.topics.map((topic) => (
                <article className="study-guidance-topic" key={topic.id}>
                  <div className="study-guidance-topic__header">
                    <div>
                      <h2>{topic.title}</h2>
                      <p>{formatCountLabel(topic.studyNoteCount)}</p>
                    </div>
                    <ButtonLink
                      size="compact"
                      to="/study-notes"
                      variant="secondary"
                    >
                      View notes
                    </ButtonLink>
                  </div>
                  <dl className="study-guidance-topic__stats">
                    {getStudyGuidanceTopicStats(topic).map((stat) => (
                      <div key={stat.id}>
                        <dt>{stat.label}</dt>
                        <dd>{formatCountLabel(stat.count)}</dd>
                      </div>
                    ))}
                  </dl>
                  {topic.recommendation === null ? null : (
                    <p className="study-guidance-topic__recommendation">
                      {topic.recommendation.summary}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="study-guidance-sidebar">
          <section className="study-guidance-sidebar__panel">
            <h2>How this guidance works</h2>
            <ul className="study-guidance-sidebar__list">
              <li>
                <strong>Based on your notes</strong>
                <span>We use only your Study Notes and recall attempts.</span>
              </li>
              <li>
                <strong>Factual signals only</strong>
                <span>
                  We look at last score, Recall Today, Needs practice, not
                  recalled yet, next recall, and Interleaved Recall readiness.
                </span>
              </li>
              <li>
                <strong>Actionable, not passive</strong>
                <span>
                  Guidance focuses on what to practice, not passive review.
                </span>
              </li>
              <li>
                <strong>AI is optional support</strong>
                <span>
                  The Core Learning Loop works from Study Notes and recall
                  evidence alone.
                </span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </section>
  );
}

function formatCountLabel(count: number) {
  return count === 1 ? "1 note" : `${count} notes`;
}
