import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { ButtonLink, type ButtonVariant } from "../../design-system/button";
import { PageLayout } from "../../design-system/page-layout";
import { defaultUserTimeZone } from "../access/session/session-contract";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import type { AppLabel } from "../labels/label-management/labels";
import type { FlashCardRecallAttemptsByNote } from "../recall";
import { listStudyNotesForUser } from "../study-notes";
import { useProtectedWorkspaceRefreshState } from "../workspace-shell/app-shell/protected-route";
import { appRoutePaths } from "../workspace-shell/app-shell/route-paths";
import "./study-guidance.css";
import {
  deriveStudyGuidance,
  type StudyGuidanceEmptyState,
  type StudyGuidanceRow,
  type StudyGuidanceRowAction,
  type StudyGuidanceSummaryCard,
} from "./study-guidance";
import { StudyGuidancePageReadinessState } from "./study-guidance-page-readiness";

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
  const protectedWorkspaceRefreshState = useProtectedWorkspaceRefreshState();
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

  const isReadinessPending =
    protectedWorkspaceRefreshState.labels ||
    protectedWorkspaceRefreshState.recall ||
    protectedWorkspaceRefreshState.studyNotes;

  if (isReadinessPending) {
    return <StudyGuidancePageReadinessState />;
  }

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
      <p className="study-guidance-row__bucket">{row.bucketLabel}</p>

      <div className="study-guidance-row__content">
        <div className="study-guidance-row__header">
          <h2>{row.title}</h2>
          <ul className="study-guidance-row__metadata">
            {row.metadata.map((metadata) => (
              <li key={metadata}>{metadata}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="study-guidance-row__evidence">{row.evidence}</p>

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
      <span className="study-guidance-card__icon" aria-hidden="true">
        <StudyGuidanceBucketIcon bucketId={card.id} />
      </span>
      <span className="study-guidance-card__content">
        <span className="study-guidance-card__label">{card.label}</span>
        <span className="study-guidance-card__metric">
          <strong>{card.count}</strong>
          <span>{formatItemCountLabel(card.count)}</span>
        </span>
        <span className="study-guidance-card__detail">{card.detail}</span>
      </span>
      <span className="study-guidance-card__chevron" aria-hidden="true">
        <ChevronRightIcon />
      </span>
    </>
  );

  if (action?.kind === "study-note-completion" && card.count > 0) {
    return (
      <li data-bucket-id={card.id}>
        <Link
          aria-label={`${action.label}: ${card.detail}`}
          className="study-guidance-card study-guidance-card--link"
          params={{ studyNoteId: action.studyNoteId }}
          search={{ focus: action.focus }}
          to={appRoutePaths.studyNoteEditor}
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
          params={{ studyNoteId: action.studyNoteId }}
          search={{ focus: action.focus }}
          to={appRoutePaths.studyNoteEditor}
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

function StudyGuidanceBucketIcon({
  bucketId,
}: Readonly<{
  bucketId: string;
}>) {
  switch (bucketId) {
    case "practice-repair":
      return <WrenchIcon />;
    case "practice-follow-up":
      return <RecallClockIcon />;
    case "due-today":
      return <CalendarIcon />;
    case "completion-blocker":
      return <QuestionIcon />;
    case "first-recall":
      return <FlagIcon />;
    case "interleaving-ready":
      return <InterleavingIcon />;
    default:
      return <FlagIcon />;
  }
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M14.7 6.3a4.1 4.1 0 0 0 4.7 5.8L11.8 19.7a2.8 2.8 0 0 1-4-4l7.6-7.6a4.1 4.1 0 0 1-.7-1.8Z" />
      <path d="m7 17 1.6 1.6" />
    </svg>
  );
}

function RecallClockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M3.5 12a8.5 8.5 0 1 0 2.7-6.2" />
      <path d="M3.5 5.5v4h4" />
      <path d="M12 7.5V12l3.1 1.8" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M7 3.5v3" />
      <path d="M17 3.5v3" />
      <path d="M4.5 8h15" />
      <rect height="15" rx="2" width="15" x="4.5" y="5.5" />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.2" />
      <path d="M9.8 9.5a2.4 2.4 0 0 1 4.5 1.2c0 1.8-2.3 2.1-2.3 3.7" />
      <path d="M12 17.5h.01" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6.5 20V5.2" />
      <path d="M6.5 6.2c4-2 7.2 2 11.2 0v8.2c-4 2-7.2-2-11.2 0" />
    </svg>
  );
}

function InterleavingIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect height="8" rx="1.8" width="8" x="4" y="4" />
      <rect height="8" rx="1.8" width="8" x="12" y="12" />
    </svg>
  );
}
