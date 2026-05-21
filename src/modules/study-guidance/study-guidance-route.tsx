import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { ButtonLink, type ButtonVariant } from "../../design-system/button";
import { PageLayout } from "../../design-system/page-layout";
import { defaultUserTimeZone } from "../access/session/session-contract";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import type { AppLabel } from "../labels/label-management/labels";
import type { FlashCardRecallAttemptsByNote } from "../recall";
import { listStudyNotesForUser } from "../study-notes";
import { appRoutePaths } from "../workspace-shell/app-shell/route-paths";
import "./study-guidance.css";
import {
  deriveStudyGuidance,
  type StudyGuidanceEmptyState,
  type StudyGuidanceRow,
  type StudyGuidanceRowAction,
  type StudyGuidanceSummaryCard,
} from "./study-guidance";

export const Route = createFileRoute("/_protected/today")({
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
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected/today");
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

  // Subscribe to result changes; listSessionResults below applies user scoping.
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
    <PageLayout
      actions={
        <StudyGuidanceHeaderAction
          emptyState={guidance.emptyState}
          nextAction={guidance.rows[0]?.action ?? null}
        />
      }
      className="study-guidance-workspace"
      description="One prioritized next-action plan across Practice Repair, recall schedules, and Study Notes."
      headerClassName="study-guidance-workspace__page-header"
      headingLevel={1}
      title="Study Guidance"
    >
      {guidance.emptyState !== null ? (
        <StudyGuidanceEmptyStatePanel emptyState={guidance.emptyState} />
      ) : (
        <>
          <section
            aria-label="Today summary"
            className="study-guidance-summary"
          >
            <ul className="study-guidance-summary__list">
              {guidance.summaryCards.map((card) => (
                <StudyGuidanceSummaryCardView
                  action={
                    card.id === "completion-blocker"
                      ? (guidance.rows.find(
                          (row) => row.bucketId === "completion-blocker",
                        )?.action ?? null)
                      : null
                  }
                  card={card}
                  key={card.id}
                />
              ))}
            </ul>
          </section>

          {guidance.rows.length === 0 ? (
            <section className="study-guidance-idle" role="status">
              <h2>Nothing urgent today</h2>
              <p>
                No repairs, due recall, or first-recall work is queued right
                now. Use manual selection when you want extra practice.
              </p>
            </section>
          ) : (
            <StudyGuidancePlan rows={guidance.rows} />
          )}
        </>
      )}
    </PageLayout>
  );
}

function StudyGuidancePlan({
  rows,
}: Readonly<{
  rows: readonly StudyGuidanceRow[];
}>) {
  return (
    <section aria-label="Today next actions" className="study-guidance-plan">
      <ol className="study-guidance-plan__list">
        {rows.map((row) => (
          <li key={row.id}>
            <StudyGuidanceRowView row={row} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function StudyGuidanceRowView({
  row,
}: Readonly<{
  row: StudyGuidanceRow;
}>) {
  return (
    <article className="study-guidance-row" data-bucket-id={row.bucketId}>
      <div className="study-guidance-row__content">
        <div className="study-guidance-row__header">
          <p className="study-guidance-row__bucket">{row.bucketLabel}</p>
          <h2>{row.title}</h2>
        </div>

        <ul className="study-guidance-row__metadata">
          {row.metadata.map((metadata) => (
            <li key={metadata}>{metadata}</li>
          ))}
        </ul>

        <p className="study-guidance-row__evidence">{row.evidence}</p>
      </div>

      <div className="study-guidance-row__action">
        <StudyGuidanceActionLink action={row.action} />
      </div>
    </article>
  );
}

function StudyGuidanceHeaderAction({
  emptyState,
  nextAction,
}: Readonly<{
  emptyState: StudyGuidanceEmptyState | null;
  nextAction: StudyGuidanceRowAction | null;
}>) {
  if (emptyState !== null) {
    return (
      <ButtonLink to={appRoutePaths.studyNotes} variant="primary">
        {emptyState.action.label}
      </ButtonLink>
    );
  }

  if (nextAction !== null) {
    return <StudyGuidanceActionLink action={nextAction} variant="primary" />;
  }

  return (
    <ButtonLink to={appRoutePaths.recallSelect} variant="primary">
      Manual selection
    </ButtonLink>
  );
}

function StudyGuidanceSummaryCardView({
  action,
  card,
}: Readonly<{
  action: StudyGuidanceRowAction | null;
  card: StudyGuidanceSummaryCard;
}>) {
  const content = (
    <>
      <p className="study-guidance-card__label">{card.label}</p>
      <p className="study-guidance-card__metric">
        <strong>{card.count}</strong>
        <span>{formatItemCountLabel(card.count)}</span>
      </p>
      <p className="study-guidance-card__detail">{card.detail}</p>
    </>
  );

  if (action?.kind === "study-note-completion" && card.count > 0) {
    return (
      <li data-bucket-id={card.id}>
        <Link
          aria-label={`${action.label}: ${card.detail}`}
          className="study-guidance-card study-guidance-card--link"
          search={{ focus: action.focus, studyNoteId: action.studyNoteId }}
          to={appRoutePaths.studyNotes}
        >
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li className="study-guidance-card" data-bucket-id={card.id}>
      {content}
    </li>
  );
}

function StudyGuidanceEmptyStatePanel({
  emptyState,
}: Readonly<{
  emptyState: StudyGuidanceEmptyState;
}>) {
  return (
    <section className="study-guidance-empty" role="status">
      <h2>{emptyState.title}</h2>
      <p>{emptyState.description}</p>
      <ButtonLink to={appRoutePaths.studyNotes}>
        {emptyState.action.label}
      </ButtonLink>
    </section>
  );
}

function StudyGuidanceActionLink({
  action,
  variant = "standard",
}: Readonly<{
  action: StudyGuidanceRowAction;
  variant?: ButtonVariant;
}>) {
  switch (action.kind) {
    case "practice-repair-draft":
      return (
        <ButtonLink
          params={{
            questionResultId: action.questionResultId,
            sessionResultId: action.sessionResultId,
          }}
          to="/practice-repair/results/$sessionResultId/questions/$questionResultId"
          variant={variant}
        >
          {action.label}
        </ButtonLink>
      );
    case "practice-repair-entry":
      return (
        <ButtonLink
          params={{
            practiceRepairEntryId: action.practiceRepairEntryId,
          }}
          to="/practice-repair/$practiceRepairEntryId"
          variant={variant}
        >
          {action.label}
        </ButtonLink>
      );
    case "recall-due-today":
      return (
        <ButtonLink to={appRoutePaths.recallDueToday} variant={variant}>
          {action.label}
        </ButtonLink>
      );
    case "recall-selection":
      return (
        <ButtonLink
          search={{ studyNoteIds: action.studyNoteIds.join(",") }}
          to={appRoutePaths.recallSelect}
          variant={variant}
        >
          {action.label}
        </ButtonLink>
      );
    case "study-note-completion":
      return (
        <ButtonLink
          search={{ focus: action.focus, studyNoteId: action.studyNoteId }}
          to={appRoutePaths.studyNotes}
          variant={variant}
        >
          {action.label}
        </ButtonLink>
      );
    case "study-notes":
      return (
        <ButtonLink to={appRoutePaths.studyNotes} variant={variant}>
          {action.label}
        </ButtonLink>
      );
  }
}

function formatItemCountLabel(count: number) {
  return `${count} ${count === 1 ? "item" : "items"}`;
}
