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
  type StudyGuidancePracticeRepair,
  type StudyGuidanceTopic,
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
  // The raw snapshot only drives re-renders; listSessionResults keeps repair data user-scoped.
  useSyncExternalStore(
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
  const sessionResults =
    userId === null ? [] : recallContext.listSessionResults({ userId });

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
          <p className="study-guidance-workspace__eyebrow">
            Insights <span aria-hidden="true">/</span> Study Guidance
          </p>
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
        <ul className="study-guidance-summary__list">
          {guidance.stats.map((stat) => (
            <li
              className="study-guidance-stat"
              data-signal-id={stat.id}
              key={stat.id}
            >
              <span aria-hidden="true" className="study-guidance-stat__icon" />
              <div className="study-guidance-stat__copy">
                <p className="study-guidance-stat__label">{stat.label}</p>
                <p className="study-guidance-stat__metric">
                  <strong className="study-guidance-stat__count">
                    {stat.count}
                  </strong>
                  <span className="study-guidance-stat__notes">
                    {formatStudyGuidanceCountLabel(stat.count)}
                  </span>
                </p>
                <p className="study-guidance-stat__detail">{stat.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="study-guidance-content">
        <section
          aria-label="Study Guidance recommendations"
          className="study-guidance-content__main"
        >
          {guidance.practiceRepair === null ? null : (
            <StudyGuidancePracticeRepairPanel
              practiceRepair={guidance.practiceRepair}
            />
          )}

          <section className="study-guidance-callout">
            <span aria-hidden="true" className="study-guidance-callout__icon" />
            <div className="study-guidance-callout__copy">
              <h2>Passive activity does not count as learning evidence.</h2>
              <p>
                Rereading, highlighting, watching videos, and time spent are
                supportive activities.
              </p>
              <p>
                They only become useful when they help you create or improve
                Study Notes and generate recall evidence.
              </p>
            </div>
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
                  <header className="study-guidance-topic__header">
                    <div className="study-guidance-topic__title-row">
                      <span
                        aria-hidden="true"
                        className="study-guidance-topic__icon"
                      />
                      <div>
                        <p className="study-guidance-topic__kicker">Label</p>
                        <h2>{topic.title}</h2>
                        <p>
                          {formatStudyGuidanceCountLabel(topic.studyNoteCount)}
                        </p>
                      </div>
                    </div>
                    <div className="study-guidance-topic__primary-action">
                      <StudyGuidanceTopicPrimaryAction topic={topic} />
                    </div>
                  </header>
                  <div className="study-guidance-topic__body">
                    <dl className="study-guidance-topic__stats">
                      {getStudyGuidanceTopicStats(topic).map((stat) => (
                        <div key={stat.id}>
                          <dt>{stat.label}</dt>
                          <dd>{formatStudyGuidanceCountLabel(stat.count)}</dd>
                        </div>
                      ))}
                    </dl>
                    <ButtonLink
                      aria-label={createStudyGuidanceTopicNotesLabel(
                        topic.title,
                      )}
                      size="compact"
                      search={{ labelId: topic.id }}
                      to="/study-notes"
                      variant="secondary"
                    >
                      View notes
                    </ButtonLink>
                  </div>
                  {topic.recommendation === null ? null : (
                    <div className="study-guidance-topic__recommendation">
                      <span
                        aria-hidden="true"
                        className="study-guidance-topic__recommendation-icon"
                      />
                      <p>{topic.recommendation.summary}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <aside
          aria-label="How this guidance works"
          className="study-guidance-sidebar"
        >
          <section className="study-guidance-sidebar__panel">
            <h2>How this guidance works</h2>
            <ul className="study-guidance-sidebar__list">
              <li>
                <span
                  aria-hidden="true"
                  className="study-guidance-sidebar__icon"
                />
                <div className="study-guidance-sidebar__copy">
                  <strong>Based on your notes</strong>
                  <span>We use only your Study Notes and recall attempts.</span>
                </div>
              </li>
              <li>
                <span
                  aria-hidden="true"
                  className="study-guidance-sidebar__icon"
                />
                <div className="study-guidance-sidebar__copy">
                  <strong>Factual signals only</strong>
                  <span>
                    We look at last score, Recall Today, Needs practice, not
                    recalled yet, next recall, and Interleaved Recall readiness.
                  </span>
                </div>
              </li>
              <li>
                <span
                  aria-hidden="true"
                  className="study-guidance-sidebar__icon"
                />
                <div className="study-guidance-sidebar__copy">
                  <strong>Actionable, not passive</strong>
                  <span>
                    Guidance focuses on what to practice, not passive review.
                  </span>
                </div>
              </li>
              <li>
                <span
                  aria-hidden="true"
                  className="study-guidance-sidebar__icon"
                />
                <div className="study-guidance-sidebar__copy">
                  <strong>Interleaved Recall when ready</strong>
                  <span>
                    Notes are suggested for Interleaved Recall only after
                    repeated Good or Easy recalls.
                  </span>
                </div>
              </li>
            </ul>
            <p className="study-guidance-sidebar__evidence-note">
              Use this guidance to decide what to practice next. Evidence comes
              from recall.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}

function StudyGuidancePracticeRepairPanel({
  practiceRepair,
}: Readonly<{
  practiceRepair: StudyGuidancePracticeRepair;
}>) {
  return (
    <section className="study-guidance-practice-repair">
      <div className="study-guidance-practice-repair__copy">
        <h2>Practice Repair</h2>
        <p>{practiceRepair.summary}</p>
      </div>
      <dl className="study-guidance-practice-repair__facts">
        {practiceRepair.hasActiveEntries ? (
          <div>
            <dt>Active entries</dt>
            <dd>
              {formatStudyGuidanceCountLabel(
                practiceRepair.activeEntryCount,
                "active entry",
                "active entries",
              )}
            </dd>
          </div>
        ) : null}
        {practiceRepair.hasCandidates ? (
          <div>
            <dt>New candidates</dt>
            <dd>
              {formatStudyGuidanceCountLabel(
                practiceRepair.candidateCount,
                "new candidate",
                "new candidates",
              )}
            </dd>
          </div>
        ) : null}
      </dl>
      <ButtonLink to="/recall/repair">Open Practice Repair</ButtonLink>
    </section>
  );
}

function createStudyGuidanceTopicNotesLabel(title: string) {
  return title.endsWith("Study Notes")
    ? `View ${title}`
    : `View ${title} Study Notes`;
}

function StudyGuidanceTopicPrimaryAction({
  topic,
}: Readonly<{
  topic: StudyGuidanceTopic;
}>) {
  switch (topic.action.kind) {
    case "practice-repair":
      return <ButtonLink to="/recall/repair">{topic.action.label}</ButtonLink>;
    case "recall-selection":
      return (
        <ButtonLink
          search={{ studyNoteIds: topic.action.studyNoteIds.join(",") }}
          to="/recall/select"
        >
          {topic.action.label}
        </ButtonLink>
      );
    case "recall-today":
      return <ButtonLink to="/recall">{topic.action.label}</ButtonLink>;
    case "study-notes":
      return (
        <ButtonLink search={{ labelId: topic.id }} to="/study-notes">
          {topic.action.label}
        </ButtonLink>
      );
  }
}

function formatStudyGuidanceCountLabel(
  count: number,
  singular = "note",
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}
