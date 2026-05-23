import { useNavigate, useRouteContext } from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Button, ButtonLink } from "../../design-system/button";
import { PageHeader } from "../../design-system/page-header";
import { PageLayout } from "../../design-system/page-layout";
import { formatCount } from "../../lib/format-count";
import { defaultUserTimeZone } from "../access/session/session-contract";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import type { AppLabel } from "../labels/label-management/labels";
import { useAppTranslation } from "../language";
import { listNotesForUser } from "../notes";
import { listStudyNotesForUser } from "../study-notes";
import { toStudyNoteRecallHistories } from "../study-notes/learning-state";
import { appRoutePaths } from "../workspace-shell/app-shell/route-paths";
import {
  getRecallModeTranslationKey,
  getRecallRatingTone,
  getRecallRatingTranslationKey,
} from "./learner-copy";
import { getLocalDateKey } from "./local-date";
import type {
  FlashCardSessionResult,
  RecallMode,
  RecallQuestion,
  RecallSelfRating,
} from "./recall";
import { RecallAnswerCheckPanel } from "./recall-answer-check-panel";
import {
  formatPracticeRepairIntentLabel,
  getPracticeRepairEntryId,
  getQuestionPracticeRepairDraft,
  isActionablePracticeFollowUp,
  type PracticeRepairDraft,
  type PracticeRepairEntry,
} from "./recall-practice-repair";
import {
  getRecallResultNoteTitle as getNoteResultTitle,
  getRecallQuestionExpectedAnswer as getQuestionExpectedAnswer,
  getRecallQuestionPrompt as getQuestionPrompt,
  getRecallQuestionReferenceTitle as getQuestionReferenceTitle,
  getRecallQuestionReferenceText,
} from "./recall-question-evidence";
import { listRecallResultLabels } from "./recall-result-labels";
import { projectSessionReview } from "./recall-session-review";
import { searchRecallSessionResults } from "./recall-session-search";
import {
  type DueForRecallQueueItem as DueTodayQueueItem,
  planRecallWork,
  type PlannedRecallWorkItem as RecallTodayQueueItem,
  type RecallWorkReason as RecallTodayReason,
  type RecallWorkPlan,
} from "./recall-work-planning";

const recallSessionSavedMessageKey = "learning-makes-difference:recall-saved";
const recallModes = ["FlashCard", "AiAssisted", "AiGraded"] as const;
const resultDateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
type RecallTypeFilter = "all" | RecallMode;
type ExpandedQuestionKey = string | null;
type ExpandedQuestionKeyChange = (questionKey: ExpandedQuestionKey) => void;

function formatResultDateTime(timestamp: string) {
  const resultDate = new Date(timestamp);

  if (Number.isNaN(resultDate.getTime())) {
    return "Unknown date and time";
  }

  return resultDateTimeFormatter.format(resultDate);
}

function formatResultScore(score: number | null) {
  return score === null ? "No score" : `${Math.round(score)}%`;
}

function getScoreTone(score: number | null) {
  if (score === null) {
    return "muted";
  }

  if (score >= 90) {
    return "easy";
  }

  if (score >= 75) {
    return "good";
  }

  if (score >= 50) {
    return "hard";
  }

  return "forgot";
}

function getSelectedResultIdForResults(
  results: readonly FlashCardSessionResult[],
  selectedResultId: string | null,
) {
  if (results.length === 0) {
    return null;
  }

  if (
    selectedResultId !== null &&
    results.some((result) => result.id === selectedResultId)
  ) {
    return selectedResultId;
  }

  return results[0]?.id ?? null;
}

function matchesLabel(result: FlashCardSessionResult, labelId: string) {
  return result.notes.some((note) => note.labelIds.includes(labelId));
}

function filterSessionResults(input: {
  labelId: string;
  labels: readonly AppLabel[];
  query: string;
  recallType: RecallTypeFilter;
  sessionResults: readonly FlashCardSessionResult[];
}) {
  let filteredResults = input.sessionResults;

  if (input.labelId.length > 0) {
    filteredResults = filteredResults.filter((result) =>
      matchesLabel(result, input.labelId),
    );
  }

  if (input.recallType !== "all") {
    filteredResults = filteredResults.filter(
      (result) => result.mode === input.recallType,
    );
  }

  if (input.query.trim().length === 0) {
    return [...filteredResults];
  }

  return searchRecallSessionResults({
    labels: input.labels,
    query: input.query,
    sessionResults: filteredResults,
  }).map((result) => result.sessionResult);
}

function getInitialSavedMessage() {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.sessionStorage.getItem(recallSessionSavedMessageKey) !== "true") {
    return null;
  }

  window.sessionStorage.removeItem(recallSessionSavedMessageKey);
  return "Recall session saved to results";
}

function getQuestionKey(question: RecallQuestion, index: number) {
  return question.questionResultId ?? `${question.noteId}-${index}`;
}

function getQuestionDetailId(index: number) {
  return `recall-result-question-detail-${index}`;
}

function useRecallWorkspaceState() {
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const persistentRecallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentRecall,
  });
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const labelsContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.labels,
  });
  const notesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.notes,
  });
  const studyNotesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.studyNotes,
  });
  const persistentStudyNotesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentStudyNotes,
  });
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
  const notesSnapshot = useSyncExternalStore(
    notesContext.subscribe,
    notesContext.getSnapshot,
    notesContext.getSnapshot,
  );
  const studyNotesStore = persistentStudyNotesContext ?? studyNotesContext;
  const studyNotesSnapshot = useSyncExternalStore(
    studyNotesStore.subscribe,
    studyNotesStore.getSnapshot,
    studyNotesStore.getSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const notes = listNotesForUser(notesSnapshot, userId);
  const studyNotes = listStudyNotesForUser(studyNotesSnapshot, userId);
  const userTimeZone =
    sessionSnapshot.user?.userTimeZone ?? defaultUserTimeZone;
  const currentLabels =
    userId === null ? [] : labelsContext.getLabelsForUser(userId);
  const currentLabelsById = new Map(
    currentLabels.map((label) => [label.id, label] as const),
  );
  const sessionResults =
    userId === null ? [] : recallContext.listSessionResults({ userId });

  return {
    currentLabels,
    currentLabelsById,
    notes,
    persistentRecallContext,
    recallContext,
    recallSchedules,
    sessionResults,
    studyNotes,
    userId,
    userTimeZone,
  };
}

type RecallWorkspaceState = ReturnType<typeof useRecallWorkspaceState>;
type AppTranslate = ReturnType<typeof useAppTranslation>["t"];

type WorkspaceRecallQueueInput = {
  now: string;
  recallContext: RecallWorkspaceState["recallContext"];
  recallSchedules: RecallWorkspaceState["recallSchedules"];
  sessionResults: RecallWorkspaceState["sessionResults"];
  studyNotes: RecallWorkspaceState["studyNotes"];
  userId: RecallWorkspaceState["userId"];
  userTimeZone: RecallWorkspaceState["userTimeZone"];
};

type WorkspaceFlashCardRecallQueueItem = {
  readonly studyNote: {
    readonly id: string;
  };
};

type StartWorkspaceFlashCardRecallInput = {
  persistentRecallContext: RecallWorkspaceState["persistentRecallContext"];
  queue: readonly WorkspaceFlashCardRecallQueueItem[];
  recallContext: RecallWorkspaceState["recallContext"];
  userId: RecallWorkspaceState["userId"];
};

function buildWorkspaceRecallWorkPlan({
  now,
  recallContext,
  recallSchedules,
  sessionResults,
  studyNotes,
  userId,
  userTimeZone,
}: WorkspaceRecallQueueInput): RecallWorkPlan {
  if (userId === null) {
    return {
      dueForRecallQueue: [],
      plannedItems: [],
      recallTodayQueue: [],
    };
  }

  return planRecallWork({
    histories: toStudyNoteRecallHistories(
      recallContext.listAttemptsByNote({ userId }),
    ),
    now,
    recallSchedules,
    sessionResults,
    studyNotes,
    userTimeZone,
  });
}

async function startWorkspaceFlashCardRecall({
  persistentRecallContext,
  queue,
  recallContext,
  userId,
}: StartWorkspaceFlashCardRecallInput): Promise<boolean> {
  if (userId === null || queue.length === 0) {
    return false;
  }

  const studyNoteIds = queue.map((item) => item.studyNote.id);
  const sessionInput = {
    mode: "FlashCard" as const,
    studyNoteIds,
  };

  if (persistentRecallContext === undefined) {
    recallContext.startFlashCardSession({
      ...sessionInput,
      userId,
    });
  } else {
    await persistentRecallContext.startFlashCardSession(userId, sessionInput);
  }

  return true;
}

export function RecallTodayWorkspacePage() {
  const navigate = useNavigate();
  const {
    currentLabelsById,
    persistentRecallContext,
    recallContext,
    recallSchedules,
    sessionResults,
    studyNotes,
    userId,
    userTimeZone,
  } = useRecallWorkspaceState();
  const now = new Date().toISOString();
  const recallTodayQueue = buildWorkspaceRecallWorkPlan({
    now,
    recallContext,
    recallSchedules,
    sessionResults,
    studyNotes,
    userId,
    userTimeZone,
  }).recallTodayQueue;

  async function startRecallToday() {
    const startedRecall = await startWorkspaceFlashCardRecall({
      persistentRecallContext,
      queue: recallTodayQueue,
      recallContext,
      userId,
    });

    if (!startedRecall) {
      return;
    }

    await navigate({ to: appRoutePaths.recallSession });
  }

  return (
    <RecallTodayPage
      labelsById={currentLabelsById}
      onStartRecallToday={startRecallToday}
      queue={recallTodayQueue}
    />
  );
}

export function RecallDueTodayWorkspacePage() {
  const navigate = useNavigate();
  const {
    currentLabelsById,
    notes,
    persistentRecallContext,
    recallContext,
    recallSchedules,
    sessionResults,
    studyNotes,
    userId,
    userTimeZone,
  } = useRecallWorkspaceState();
  const now = new Date().toISOString();
  const dueTodayQueue = buildWorkspaceRecallWorkPlan({
    now,
    recallContext,
    recallSchedules,
    sessionResults,
    studyNotes,
    userId,
    userTimeZone,
  }).dueForRecallQueue;
  const hasNoRecallContent =
    notes.length === 0 &&
    studyNotes.length === 0 &&
    sessionResults.length === 0;

  async function startDueTodayRecall() {
    const startedRecall = await startWorkspaceFlashCardRecall({
      persistentRecallContext,
      queue: dueTodayQueue,
      recallContext,
      userId,
    });

    if (!startedRecall) {
      return;
    }

    await navigate({ to: appRoutePaths.recallSession });
  }

  if (hasNoRecallContent) {
    return <NoNotesRecallState />;
  }

  return (
    <RecallDueTodayPage
      labelsById={currentLabelsById}
      now={now}
      onStartDueToday={startDueTodayRecall}
      queue={dueTodayQueue}
      userTimeZone={userTimeZone}
    />
  );
}

export function RecallResultsWorkspacePage() {
  const { t } = useAppTranslation();
  const { currentLabels, notes, sessionResults, studyNotes } =
    useRecallWorkspaceState();
  const availableLabels = listRecallResultLabels({
    currentLabels,
    sessionResults,
  });
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedLabelId, setSelectedLabelId] = useState("");
  const [selectedRecallType, setSelectedRecallType] =
    useState<RecallTypeFilter>("all");
  const [expandedQuestionKey, setExpandedQuestionKey] =
    useState<ExpandedQuestionKey>(null);
  const [savedMessage, setSavedMessage] = useState(getInitialSavedMessage);
  const filteredResults = useMemo(
    () =>
      filterSessionResults({
        labelId: selectedLabelId,
        labels: availableLabels,
        query,
        recallType: selectedRecallType,
        sessionResults,
      }),
    [
      availableLabels,
      query,
      selectedLabelId,
      selectedRecallType,
      sessionResults,
    ],
  );

  useEffect(() => {
    const nextSelectedResultId = getSelectedResultIdForResults(
      filteredResults,
      selectedResultId,
    );
    const shouldClearExpandedQuestion =
      filteredResults.length === 0 || nextSelectedResultId !== selectedResultId;

    if (shouldClearExpandedQuestion) {
      setExpandedQuestionKey(null);
    }

    if (nextSelectedResultId !== selectedResultId) {
      setSelectedResultId(nextSelectedResultId);
    }
  }, [filteredResults, selectedResultId]);

  useEffect(() => {
    if (
      selectedLabelId.length > 0 &&
      !availableLabels.some((label) => label.id === selectedLabelId)
    ) {
      setSelectedLabelId("");
    }
  }, [availableLabels, selectedLabelId]);

  const hasNoRecallContent =
    notes.length === 0 &&
    studyNotes.length === 0 &&
    sessionResults.length === 0;

  if (hasNoRecallContent) {
    return <NoNotesRecallState />;
  }

  const selectedResult =
    filteredResults.find((result) => result.id === selectedResultId) ?? null;

  return (
    <PageLayout
      actions={<RecallSelectionPrimaryAction />}
      afterHeader={
        savedMessage !== null ? (
          <p className="recall-feedback" role="status">
            {savedMessage === "Recall session saved to results"
              ? t("recall.result.saved")
              : savedMessage}
            <button
              aria-label={t("recall.result.saved.dismiss")}
              className="recall-feedback__dismiss"
              onClick={() => setSavedMessage(null)}
              type="button"
            >
              {t("recall.action.dismiss")}
            </button>
          </p>
        ) : null
      }
      aria-label={t("shell.workspace.recall")}
      as="section"
      className="recall-workspace recall-surface recall-results-surface"
      description={t("recall.results.description")}
      headerClassName="recall-surface__header"
      headingLevel={1}
      heroClassName="recall-results-top"
      title={t("recall.tabs.results")}
    >
      <div className="recall-results-workspace">
        <ResultsMasterPanel
          labels={availableLabels}
          onLabelChange={setSelectedLabelId}
          onQueryChange={setQuery}
          onRecallTypeChange={setSelectedRecallType}
          onSelectResult={(resultId) => {
            setExpandedQuestionKey(null);
            setSelectedResultId(resultId);
          }}
          query={query}
          results={filteredResults}
          selectedLabelId={selectedLabelId}
          selectedRecallType={selectedRecallType}
          selectedResultId={selectedResultId}
          totalResults={sessionResults.length}
        />
        <ResultsDetailPanel
          expandedQuestionKey={expandedQuestionKey}
          hasAnyResults={sessionResults.length > 0}
          onExpandedQuestionKeyChange={setExpandedQuestionKey}
          result={selectedResult}
        />
      </div>
    </PageLayout>
  );
}

type QueueTone = "due" | "new" | "practice";
type DueTodayStatus = "due-today" | "overdue";

const recallTodaySectionTones: readonly QueueTone[] = [
  "practice",
  "new",
  "due",
];

type RecallTodayPageProps = {
  labelsById: ReadonlyMap<string, AppLabel>;
  onStartRecallToday: () => void;
  queue: readonly RecallTodayQueueItem[];
};

type RecallTodayQueueSection = {
  items: readonly RecallTodayQueueItem[];
  tone: QueueTone;
};

type DueTodayPageProps = {
  labelsById: ReadonlyMap<string, AppLabel>;
  now: string;
  onStartDueToday: () => void;
  queue: readonly DueTodayQueueItem[];
  userTimeZone: string;
};

function getLastScoreText(
  lastRating: RecallSelfRating | null,
  t: AppTranslate,
) {
  if (lastRating === null) {
    return t("recall.today.lastScore.notAttempted");
  }

  return t(getRecallRatingTranslationKey(lastRating));
}

function getRecallRatingDotCount(rating: RecallSelfRating | null) {
  switch (rating) {
    case "forgot":
      return 1;
    case "hard":
      return 2;
    case "good":
      return 3;
    case "easy":
      return 4;
    case null:
      return 0;
  }
}

function getStudyNoteMetaLine(
  item: Pick<DueTodayQueueItem, "studyNote">,
  labelsById: ReadonlyMap<string, AppLabel>,
) {
  const labelNames = item.studyNote.labelIds
    .map((labelId) => labelsById.get(labelId)?.name)
    .filter((labelName): labelName is string => labelName !== undefined);
  const sourceTitle = item.studyNote.source.title.trim();

  if (labelNames.length > 0 && sourceTitle.length > 0) {
    return `${labelNames.slice(0, 1).join(", ")} · ${sourceTitle}`;
  }

  if (labelNames.length > 0) {
    return labelNames.slice(0, 2).join(", ");
  }

  return sourceTitle;
}

function getRecallTodayReasonText(reason: RecallTodayReason, t: AppTranslate) {
  switch (reason) {
    case "practice-follow-up":
      return t("recall.today.reason.practiceFollowUp");
    case "needs-practice":
      return t("recall.today.reason.needsPractice");
    case "not-recalled":
      return t("recall.today.reason.notRecalled");
    case "due-for-recall":
      return t("recall.today.reason.dueForRecall");
  }
}

function getRecallTodayQueueTone(item: RecallTodayQueueItem): QueueTone {
  switch (item.primaryReason) {
    case "practice-follow-up":
    case "needs-practice":
      return "practice";
    case "not-recalled":
      return "new";
    case "due-for-recall":
      return "due";
  }
}

function _getRecallTodaySectionTitleText(tone: QueueTone, t: AppTranslate) {
  switch (tone) {
    case "practice":
      return t("recall.today.section.focusFirst");
    case "new":
      return t("recall.today.section.newlyRecallable");
    case "due":
      return t("recall.today.section.scheduledToday");
  }
}

function _getRecallTodaySectionHelperText(tone: QueueTone, t: AppTranslate) {
  switch (tone) {
    case "practice":
      return `${t("recall.today.reason.practiceFollowUp")} · ${t("recall.today.reason.needsPractice")}`;
    case "new":
      return t("recall.today.reason.notRecalled");
    case "due":
      return t("recall.today.reason.dueForRecall");
  }
}

function getRecallTodaySupportingReasonText(
  item: RecallTodayQueueItem,
  t: AppTranslate,
) {
  const supportingReason = item.reasons.find(
    (reason) => reason !== item.primaryReason,
  );

  if (supportingReason === undefined) {
    return null;
  }

  if (
    item.primaryReason === "practice-follow-up" &&
    supportingReason === "needs-practice"
  ) {
    return t("recall.today.reason.supportingNeedsPractice");
  }

  return getRecallTodayReasonText(supportingReason, t);
}

function getRecallTodayMetaLine(input: {
  item: RecallTodayQueueItem;
  labelsById: ReadonlyMap<string, AppLabel>;
  t: AppTranslate;
}) {
  const metaLine = getStudyNoteMetaLine(input.item, input.labelsById);
  const supportingReason = getRecallTodaySupportingReasonText(
    input.item,
    input.t,
  );

  if (metaLine.length > 0 && supportingReason !== null) {
    return `${metaLine} · ${supportingReason}`;
  }

  return supportingReason ?? metaLine;
}

function RecallTodayPage({
  labelsById,
  onStartRecallToday,
  queue,
}: RecallTodayPageProps) {
  const { t } = useAppTranslation();
  const queueSections = buildRecallTodayQueueSections(queue);
  const practiceSectionItems =
    queueSections.find((section) => section.tone === "practice")?.items ?? [];
  const dueSectionItems =
    queueSections.find((section) => section.tone === "due")?.items ?? [];
  const newSectionItems =
    queueSections.find((section) => section.tone === "new")?.items ?? [];

  return (
    <section
      aria-label={t("shell.workspace.recall")}
      className="page-layout recall-workspace recall-today-page"
    >
      <div className="recall-today-wrapper">
        <article className="recall-surface recall-today-surface">
          <PageHeader
            actions={
              <fieldset className="recall-today-actions">
                <legend className="sr-only">{t("recall.today.actions")}</legend>
                <RecallTodayPrimaryAction
                  onStartRecallToday={onStartRecallToday}
                  queue={queue}
                />
                <ButtonLink to={appRoutePaths.recallSelect} variant="secondary">
                  <ListIcon />
                  {t("recall.today.manualSelection")}
                </ButtonLink>
              </fieldset>
            }
            actionsClassName="recall-today-hero__actions"
            className="recall-surface__header recall-today-hero"
            description={t("recall.today.description")}
            headingLevel={1}
            title={t("recall.today.title")}
          >
            <p className="recall-today-hero__summary">
              {formatCount(queue.length, "note")} ready{" "}
              <span aria-hidden="true">·</span> recommended order prepared
            </p>
          </PageHeader>

          {queue.length === 0 ? (
            <div className="recall-today-queue">
              <div className="recall-results-empty" role="status">
                <h4>{t("recall.today.emptyTitle")}</h4>
                <p className="muted">{t("recall.today.emptyBody")}</p>
              </div>
            </div>
          ) : (
            <RecallTodayQueue
              dueCount={dueSectionItems.length}
              labelsById={labelsById}
              newCount={newSectionItems.length}
              priorityCount={practiceSectionItems.length}
              priorityItems={practiceSectionItems.slice(0, 3)}
            />
          )}
        </article>
      </div>
    </section>
  );
}

function buildRecallTodayQueueSections(
  queue: readonly RecallTodayQueueItem[],
): readonly RecallTodayQueueSection[] {
  const queueByTone: Record<QueueTone, RecallTodayQueueItem[]> = {
    due: [],
    new: [],
    practice: [],
  };

  for (const item of queue) {
    queueByTone[getRecallTodayQueueTone(item)].push(item);
  }

  return recallTodaySectionTones.map((tone) => ({
    items: queueByTone[tone],
    tone,
  }));
}

function _getRecallTodaySectionCount(
  queueSections: readonly RecallTodayQueueSection[],
  tone: QueueTone,
) {
  return (
    queueSections.find((section) => section.tone === tone)?.items.length ?? 0
  );
}

function formatSummaryUnitLabel(count: number) {
  return formatCount(count, "note").replace(/^\d+\s/, "");
}

function RecallTodayQueue({
  dueCount,
  labelsById,
  newCount,
  priorityCount,
  priorityItems,
}: Readonly<{
  dueCount: number;
  labelsById: ReadonlyMap<string, AppLabel>;
  newCount: number;
  priorityCount: number;
  priorityItems: readonly RecallTodayQueueItem[];
}>) {
  const { t } = useAppTranslation();
  const continuationRows = [
    {
      helper: "Scheduled reviews due today",
      label: "Due reviews",
      to: appRoutePaths.recallDueToday,
      value: dueCount,
    },
    {
      helper: "New notes ready after the priority items",
      label: "Newly recallable",
      to: appRoutePaths.recallSelect,
      value: newCount,
    },
    {
      helper: "Not needed right now",
      label: "Upcoming",
      to: appRoutePaths.recallSelect,
      value: 0,
    },
  ] as const;

  return (
    <section
      aria-label={t("recall.today.queue")}
      className="recall-today-queue"
    >
      <h2 className="recall-today-plan-title">Today's plan</h2>
      <section className="recall-today-priority" data-tone="practice">
        <header className="recall-today-priority__header">
          <h3>
            Start here <span aria-hidden="true">·</span>{" "}
            <span>Needs practice</span> <span aria-hidden="true">·</span>{" "}
            <span>{priorityCount}</span>
          </h3>
          <p>Review these before adding new material.</p>
        </header>

        <ul className="recall-today-priority__rows">
          {priorityItems.map((item) => (
            <RecallTodayQueueRow
              item={item}
              key={item.studyNote.id}
              labelsById={labelsById}
            />
          ))}
        </ul>
      </section>

      <div className="recall-today-continuation">
        <span className="recall-today-continuation__label">
          Continue after that
        </span>
        <div className="recall-today-continuation__rule" />
      </div>

      <div className="recall-today-collapsed-list">
        {continuationRows.map((row) => (
          <ButtonLink
            className="recall-today-collapsed-row"
            key={row.label}
            to={row.to}
            variant="standard"
          >
            <span className="recall-today-collapsed-row__copy">
              <strong>
                {row.label} <span aria-hidden="true">·</span> {row.value}
              </strong>
              <span>{row.helper}</span>
            </span>
            <ChevronRightIcon />
          </ButtonLink>
        ))}
      </div>
    </section>
  );
}

function RecallTodayQueueRow({
  item,
  labelsById,
}: Readonly<{
  item: RecallTodayQueueItem;
  labelsById: ReadonlyMap<string, AppLabel>;
}>) {
  const { t } = useAppTranslation();
  const metaLine = getRecallTodayMetaLine({
    item,
    labelsById,
    t,
  });

  return (
    <li className="recall-today-row">
      <div className="recall-today-row__main">
        <strong>{item.studyNote.prompt}</strong>
        {metaLine.length > 0 ? <p>{metaLine}</p> : null}
      </div>
      <ButtonLink
        className="recall-today-row__action"
        search={{ studyNoteIds: item.studyNote.id }}
        size="compact"
        to={appRoutePaths.recallSelect}
        variant="standard"
      >
        Recall this
      </ButtonLink>
    </li>
  );
}

function getDueTodayStatus(input: {
  item: DueTodayQueueItem;
  now: string;
  userTimeZone: string;
}): DueTodayStatus {
  const nextRecallDateKey = getLocalDateKey({
    timestamp: input.item.schedule.nextRecallAt,
    userTimeZone: input.userTimeZone,
  });
  const todayDateKey = getLocalDateKey({
    timestamp: input.now,
    userTimeZone: input.userTimeZone,
  });

  if (
    nextRecallDateKey !== null &&
    todayDateKey !== null &&
    nextRecallDateKey < todayDateKey
  ) {
    return "overdue";
  }

  return "due-today";
}

function formatDueTodayScheduledDate(input: {
  timestamp: string;
  userTimeZone: string;
}) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: input.userTimeZone,
  }).format(new Date(input.timestamp));
}

function RecallDueTodayPage({
  labelsById,
  now,
  onStartDueToday,
  queue,
  userTimeZone,
}: DueTodayPageProps) {
  const { t } = useAppTranslation();

  return (
    <section
      aria-label={t("shell.workspace.recall")}
      className="recall-workspace"
    >
      <article className="recall-surface recall-today-surface">
        <div className="recall-today-top">
          <PageHeader
            actions={
              <RecallDueTodayPrimaryAction
                dueTodayQueue={queue}
                onStartDueToday={onStartDueToday}
              />
            }
            actionsClassName="recall-today-hero__actions"
            className="recall-surface__header recall-today-hero"
            description={t("recall.dueToday.description")}
            headingLevel={1}
            title={t("recall.dueToday.title")}
          />
        </div>

        <RecallDueTodaySummary
          now={now}
          queue={queue}
          userTimeZone={userTimeZone}
        />

        <div className="recall-today-layout">
          <div className="recall-today-queue">
            {queue.length === 0 ? (
              <div className="recall-results-empty" role="status">
                <h4>{t("recall.dueToday.emptyTitle")}</h4>
                <p className="muted">{t("recall.dueToday.emptyBody")}</p>
              </div>
            ) : (
              <RecallDueTodayQueue
                labelsById={labelsById}
                now={now}
                queue={queue}
                userTimeZone={userTimeZone}
              />
            )}
          </div>

          <RecallDueTodayHowPanel />
        </div>
      </article>
    </section>
  );
}

function RecallDueTodayPrimaryAction({
  dueTodayQueue,
  onStartDueToday,
}: Readonly<{
  dueTodayQueue: readonly DueTodayQueueItem[];
  onStartDueToday: () => void;
}>) {
  const { t } = useAppTranslation();

  if (dueTodayQueue.length > 0) {
    return (
      <Button
        className="recall-page-primary-action"
        onClick={onStartDueToday}
        type="button"
        variant="primary"
      >
        <PlayIcon />
        {t("recall.dueToday.start")}
      </Button>
    );
  }

  return <RecallSelectionPrimaryAction />;
}

function RecallSelectionPrimaryAction() {
  const { t } = useAppTranslation();

  return (
    <ButtonLink
      className="recall-page-primary-action"
      to={appRoutePaths.recallSelect}
      variant="primary"
    >
      <ListIcon />
      {t("recall.dueToday.manualSelection")}
    </ButtonLink>
  );
}

function RecallTodayPrimaryAction({
  onStartRecallToday,
  queue,
}: Readonly<{
  onStartRecallToday: () => void;
  queue: readonly RecallTodayQueueItem[];
}>) {
  if (queue.length === 0) {
    return null;
  }

  return (
    <Button
      className="recall-page-primary-action"
      onClick={onStartRecallToday}
      type="button"
      variant="primary"
    >
      <PlayIcon />
      Recall {formatCount(queue.length, "note")}
    </Button>
  );
}

function RecallDueTodaySummary({
  now,
  queue,
  userTimeZone,
}: {
  now: string;
  queue: readonly DueTodayQueueItem[];
  userTimeZone: string;
}) {
  const { t } = useAppTranslation();
  const overdueCount = queue.filter(
    (item) =>
      getDueTodayStatus({
        item,
        now,
        userTimeZone,
      }) === "overdue",
  ).length;
  const dueTodayCount = queue.length - overdueCount;
  const summaryItems = [
    {
      count: queue.length,
      icon: <CalendarQueueIcon />,
      label: t("recall.dueToday.metric.total"),
      tone: "total",
    },
    {
      count: dueTodayCount,
      icon: <CheckIcon />,
      label: t("recall.dueToday.metric.dueToday"),
      tone: "due",
    },
    {
      count: overdueCount,
      icon: <WarningIcon />,
      label: t("recall.dueToday.metric.overdue"),
      tone: "practice",
    },
  ] as const;

  return (
    <ul
      aria-label={t("recall.dueToday.summary")}
      className="recall-today-summary"
    >
      {summaryItems.map((item) => (
        <li
          className="recall-today-summary__item"
          data-tone={item.tone}
          key={item.label}
        >
          <span aria-hidden="true" className="recall-today-summary__icon">
            {item.icon}
          </span>
          <span className="recall-today-summary__copy">
            <span>{item.label}</span>
            <strong>{item.count}</strong>
            <span>{formatSummaryUnitLabel(item.count)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function RecallDueTodayQueue({
  labelsById,
  now,
  queue,
  userTimeZone,
}: {
  labelsById: ReadonlyMap<string, AppLabel>;
  now: string;
  queue: readonly DueTodayQueueItem[];
  userTimeZone: string;
}) {
  const { t } = useAppTranslation();

  return (
    <section
      aria-label={t("recall.dueToday.queue")}
      className="recall-today-section"
      data-tone="due"
    >
      <header className="recall-today-section__header">
        <div className="recall-today-section__title">
          <span className="recall-today-section__badge">{queue.length}</span>
          <h2>{t("recall.dueToday.queueTitle")}</h2>
          <span className="recall-today-section__count">{queue.length}</span>
        </div>
        <div className="recall-today-section__helper">
          <span>{t("recall.dueToday.helper")}</span>
          <InfoIcon />
        </div>
      </header>

      <ul className="recall-today-section__rows">
        {queue.map((item) => (
          <RecallDueTodayQueueRow
            item={item}
            key={item.studyNote.id}
            labelsById={labelsById}
            now={now}
            userTimeZone={userTimeZone}
          />
        ))}
      </ul>
    </section>
  );
}

function RecallDueTodayQueueRow({
  item,
  labelsById,
  now,
  userTimeZone,
}: {
  item: DueTodayQueueItem;
  labelsById: ReadonlyMap<string, AppLabel>;
  now: string;
  userTimeZone: string;
}) {
  const { t } = useAppTranslation();
  const status = getDueTodayStatus({
    item,
    now,
    userTimeZone,
  });
  const tone: QueueTone = status === "overdue" ? "practice" : "due";
  const dotCount = getRecallRatingDotCount(item.lastRating);
  const metaLine = getStudyNoteMetaLine(item, labelsById);
  const lastScoreText = getLastScoreText(item.lastRating, t);
  const statusText =
    status === "overdue"
      ? t("recall.dueToday.status.overdue")
      : t("recall.dueToday.status.dueToday");
  const scheduledDateText = formatDueTodayScheduledDate({
    timestamp: item.schedule.nextRecallAt,
    userTimeZone,
  });

  return (
    <li className="recall-today-row" data-tone={tone}>
      <span aria-hidden="true" className="recall-today-row__note-icon">
        <NoteIcon />
      </span>
      <div className="recall-today-row__main">
        <h3>{item.studyNote.prompt}</h3>
        {metaLine.length > 0 ? <p>{metaLine}</p> : null}
      </div>
      <div className="recall-today-row__score">
        <span>{t("recall.dueToday.lastScore")}</span>
        <strong>{lastScoreText}</strong>
        <RatingDots activeCount={dotCount} tone={tone} />
      </div>
      <div className="recall-today-row__reason">
        <span>{t("recall.dueToday.status.label")}</span>
        <strong>{statusText}</strong>
      </div>
      <div className="recall-today-row__next">
        <span>{t("recall.dueToday.scheduled")}</span>
        <strong>{scheduledDateText}</strong>
      </div>
    </li>
  );
}

const ratingDotKeys = ["dot-1", "dot-2", "dot-3", "dot-4"] as const;

function RatingDots({
  activeCount,
  tone,
}: {
  activeCount: number;
  tone: QueueTone;
}) {
  return (
    <span
      aria-hidden="true"
      className="recall-today-rating-dots"
      data-tone={tone}
    >
      {ratingDotKeys.map((dotKey, index) => (
        <span data-active={index < activeCount} key={dotKey} />
      ))}
    </span>
  );
}

function RecallDueTodayHowPanel() {
  const { t } = useAppTranslation();
  const steps = [
    {
      bodyKey: "recall.dueToday.how.hidden.body",
      icon: <HiddenAnswerIcon />,
      titleKey: "recall.dueToday.how.hidden.title",
    },
    {
      bodyKey: "recall.dueToday.how.rate.body",
      icon: <RatingScaleIcon />,
      titleKey: "recall.dueToday.how.rate.title",
    },
    {
      bodyKey: "recall.dueToday.how.schedule.body",
      icon: <CalendarQueueIcon />,
      titleKey: "recall.dueToday.how.schedule.title",
    },
  ] as const;

  return (
    <aside
      aria-label={t("recall.dueToday.how.title")}
      className="recall-today-how"
    >
      <div aria-hidden="true" className="recall-today-how__lock">
        <LockIcon />
      </div>
      <h2>{t("recall.dueToday.how.title")}</h2>
      <div className="recall-today-how__steps">
        {steps.map((step) => (
          <section className="recall-today-how__step" key={step.titleKey}>
            <span aria-hidden="true" className="recall-today-how__step-icon">
              {step.icon}
            </span>
            <div>
              <h3>{t(step.titleKey)}</h3>
              <p>{t(step.bodyKey)}</p>
            </div>
          </section>
        ))}
      </div>
      <p className="recall-today-how__tip">
        <LightbulbIcon />
        <span>{t("recall.dueToday.how.tip")}</span>
      </p>
    </aside>
  );
}

function NoNotesRecallState() {
  const { t } = useAppTranslation();

  return (
    <section
      aria-label={t("shell.workspace.recall")}
      className="recall-workspace"
    >
      <article className="recall-surface recall-empty-surface">
        <h3>{t("recall.empty.title")}</h3>
        <p className="muted">{t("recall.empty.body")}</p>
        <ButtonLink to="/study-notes" variant="primary">
          {t("recall.action.openNotes")}
        </ButtonLink>
      </article>
    </section>
  );
}

function ResultsMasterPanel({
  labels,
  onLabelChange,
  onQueryChange,
  onRecallTypeChange,
  onSelectResult,
  query,
  results,
  selectedLabelId,
  selectedRecallType,
  selectedResultId,
  totalResults,
}: {
  labels: readonly AppLabel[];
  onLabelChange: (labelId: string) => void;
  onQueryChange: (query: string) => void;
  onRecallTypeChange: (recallType: RecallTypeFilter) => void;
  onSelectResult: (resultId: string) => void;
  query: string;
  results: readonly FlashCardSessionResult[];
  selectedLabelId: string;
  selectedRecallType: RecallTypeFilter;
  selectedResultId: string | null;
  totalResults: number;
}) {
  const { t } = useAppTranslation();
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isFilterMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        filterRef.current !== null &&
        event.target instanceof Node &&
        !filterRef.current.contains(event.target)
      ) {
        setIsFilterMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isFilterMenuOpen]);

  return (
    <section
      aria-label={t("recall.results")}
      className="recall-panel recall-results-master"
    >
      <h4>{t("recall.result.pastSessions")}</h4>

      <div className="recall-results-toolbar">
        <label
          className="recall-field recall-search-field"
          htmlFor="recall-results-search"
        >
          <span className="sr-only">{t("recall.result.search")}</span>
          <SearchIcon />
          <input
            id="recall-results-search"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("recall.result.searchPlaceholder")}
            type="search"
            value={query}
          />
        </label>

        <div className="recall-results-filter" ref={filterRef}>
          <button
            aria-expanded={isFilterMenuOpen}
            className="recall-results-filter__button"
            onClick={() => setIsFilterMenuOpen((isOpen) => !isOpen)}
            type="button"
          >
            <FilterIcon />
            {t("recall.result.filter")}
          </button>
          <div className="recall-results-filters" hidden={!isFilterMenuOpen}>
            <label className="recall-field" htmlFor="recall-results-label">
              <span>{t("recall.filters.label")}</span>
              <select
                id="recall-results-label"
                onChange={(event) => onLabelChange(event.target.value)}
                value={selectedLabelId}
              >
                <option value="">{t("recall.filters.allLabels")}</option>
                {labels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="recall-field" htmlFor="recall-results-type">
              <span>{t("recall.filters.type")}</span>
              <select
                id="recall-results-type"
                onChange={(event) =>
                  onRecallTypeChange(event.target.value as RecallTypeFilter)
                }
                value={selectedRecallType}
              >
                <option value="all">{t("recall.filters.allModes")}</option>
                {recallModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {t(getRecallModeTranslationKey(mode))}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <ResultsMasterPanelContent
        onSelectResult={onSelectResult}
        results={results}
        selectedResultId={selectedResultId}
        totalResults={totalResults}
      />
    </section>
  );
}

function ResultsMasterPanelContent({
  onSelectResult,
  results,
  selectedResultId,
  totalResults,
}: {
  onSelectResult: (resultId: string) => void;
  results: readonly FlashCardSessionResult[];
  selectedResultId: string | null;
  totalResults: number;
}) {
  const { t } = useAppTranslation();

  if (totalResults === 0) {
    return (
      <div className="recall-results-empty" role="status">
        <h4>{t("recall.result.resultsEmptyTitle")}</h4>
        <p className="muted">{t("recall.result.resultsEmptyBody")}</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="recall-results-empty" role="status">
        <h4>{t("recall.result.resultsMatchingEmptyTitle")}</h4>
        <p className="muted">{t("recall.result.resultsMatchingEmptyBody")}</p>
      </div>
    );
  }

  return (
    <div className="recall-results-list-frame">
      <ol
        aria-label={t("recall.result.pastSessions")}
        className="recall-results-list"
        tabIndex={0}
      >
        {results.map((result) => {
          const isSelected = result.id === selectedResultId;

          return (
            <li key={result.id}>
              <button
                aria-pressed={isSelected}
                className="recall-result-row"
                data-selected={isSelected ? "true" : undefined}
                onClick={() => onSelectResult(result.id)}
                type="button"
              >
                <span className="recall-result-row__when">
                  {formatResultDateTime(result.completedAt)}
                </span>
                <span className="recall-result-row__questions">
                  {formatCount(result.questions.length, "question")}
                </span>
                <span
                  className="recall-result-card__score recall-result-row__score"
                  data-score-tone={getScoreTone(result.score ?? null)}
                >
                  {formatResultScore(result.score ?? null)}
                </span>
                <span className="recall-result-row__mode">
                  {t(getRecallModeTranslationKey(result.mode))}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="recall-results-count">
        {results.length === 1
          ? t("recall.result.sessionsShown", { count: results.length })
          : t("recall.result.sessionsShown_plural", { count: results.length })}
      </p>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height="17"
      viewBox="0 0 24 24"
      width="17"
    >
      <path d="M8 5.6v12.8a1 1 0 0 0 1.55.84l9.6-6.4a1 1 0 0 0 0-1.68l-9.6-6.4A1 1 0 0 0 8 5.6Z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="m9 18 6-6-6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CalendarQueueIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path
        d="M7 3v3M17 3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m8.5 14 2 2 4.5-4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path d="M12 4 3.5 19h17L12 4Z" fill="currentColor" opacity="0.2" />
      <path
        d="M12 8.5v4.7M12 16.8h.01M12 4 3.5 19h17L12 4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path
        d="m6 12.5 4 4L18 8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="15"
      viewBox="0 0 24 24"
      width="15"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 10.5v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="7.5" fill="currentColor" r="1" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="19"
      viewBox="0 0 24 24"
      width="19"
    >
      <path
        d="M7 3.5h7l3 3v14H7v-17Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path d="M14 3.5v4h4" stroke="currentColor" strokeLinejoin="round" />
      <path
        d="M9.5 11.5h5M9.5 15h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function HiddenAnswerIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="22"
      viewBox="0 0 24 24"
      width="22"
    >
      <path
        d="M3 12s3-5 9-5 9 5 9 5a12.2 12.2 0 0 1-3.2 3.4M14.1 14.2A3 3 0 0 1 9.8 9.9M4 4l16 16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function RatingScaleIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="24"
      viewBox="0 0 54 18"
      width="54"
    >
      <circle cx="8" cy="9" fill="currentColor" opacity="0.36" r="4" />
      <circle cx="21" cy="9" fill="currentColor" opacity="0.5" r="4" />
      <circle cx="34" cy="9" fill="currentColor" opacity="0.72" r="4" />
      <circle cx="47" cy="9" fill="currentColor" r="4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="28"
      viewBox="0 0 24 24"
      width="28"
    >
      <rect
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
        width="13"
        x="5.5"
        y="10"
      />
      <path
        d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="30"
      viewBox="0 0 24 24"
      width="30"
    >
      <path
        d="M9 18h6M10 21h4M8 14.5a6 6 0 1 1 8 0c-.9.7-1.2 1.4-1.2 2.5H9.2c0-1.1-.3-1.8-1.2-2.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="17"
      viewBox="0 0 24 24"
      width="17"
    >
      <path
        d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ResultsDetailPanel({
  expandedQuestionKey,
  hasAnyResults,
  onExpandedQuestionKeyChange,
  result,
}: {
  expandedQuestionKey: ExpandedQuestionKey;
  hasAnyResults: boolean;
  onExpandedQuestionKeyChange: ExpandedQuestionKeyChange;
  result: FlashCardSessionResult | null;
}) {
  const { t } = useAppTranslation();

  return (
    <section
      aria-label={t("recall.result.selected")}
      className="recall-panel recall-results-detail-panel"
      tabIndex={0}
    >
      <div className="recall-results-detail-scroll-content">
        {result === null ? (
          <div className="recall-results-empty" role="status">
            <h4>
              {hasAnyResults
                ? t("recall.result.noResultSelected")
                : t("recall.result.resultsEmptyTitle")}
            </h4>
            <p className="muted">{t("recall.result.resultsEmptyBody")}</p>
          </div>
        ) : (
          <SelectedResultDetail
            expandedQuestionKey={expandedQuestionKey}
            onExpandedQuestionKeyChange={onExpandedQuestionKeyChange}
            result={result}
          />
        )}
      </div>
    </section>
  );
}

function SelectedResultDetail({
  expandedQuestionKey,
  onExpandedQuestionKeyChange,
  result,
}: {
  expandedQuestionKey: ExpandedQuestionKey;
  onExpandedQuestionKeyChange: ExpandedQuestionKeyChange;
  result: FlashCardSessionResult;
}) {
  const { t } = useAppTranslation();
  const review = projectSessionReview(result);
  const questionsAttempted = review.attemptedQuestions.length;
  const selfRatingDistribution =
    review.selfRatingDistribution?.label ??
    "Easy 0 · Good 0 · Hard 0 · Forgot 0";

  return (
    <div className="recall-results-detail recall-selected-result">
      <header className="recall-selected-result__heading">
        <h4>{t("recall.result.sessionReview")}</h4>
      </header>

      <div className="recall-selected-result__meta">
        <p>
          <span>{formatResultDateTime(result.completedAt)}</span>
          <span aria-hidden="true">·</span>
          <span>{t(getRecallModeTranslationKey(result.mode))}</span>
          <span aria-hidden="true">·</span>
          <span>{formatCount(questionsAttempted, "question")} attempted</span>
          <span aria-hidden="true">·</span>
          <span>{formatResultScore(result.score ?? null)} self-rated</span>
          <span aria-hidden="true">·</span>
          <span>{review.summary.durationLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{selfRatingDistribution}</span>
        </p>
      </div>

      <p className="sr-only">
        <span>{review.summary.noteCountLabel}</span>
        <span aria-hidden="true">•</span>
        <span>{review.summary.questionCoverageLabel}</span>
      </p>

      <section
        aria-labelledby="recall-result-questions-answers"
        className="recall-selected-result__section"
      >
        <h4 id="recall-result-questions-answers">
          {t("recall.result.questions")}
        </h4>
        {review.attemptedQuestions.length === 0 ? (
          <p className="muted">{t("recall.result.noAttemptedQuestions")}</p>
        ) : (
          <ol className="recall-selected-result__list">
            {review.attemptedQuestions.map((question, index) => {
              const questionKey = getQuestionKey(question, index);

              return (
                <QuestionReviewRow
                  expandedQuestionKey={expandedQuestionKey}
                  index={index}
                  key={questionKey}
                  onExpandedQuestionKeyChange={onExpandedQuestionKeyChange}
                  question={question}
                  questionKey={questionKey}
                  resultId={result.id}
                />
              );
            })}
          </ol>
        )}
      </section>

      <QueuedButNotAskedSection notes={review.notReachedNotes} />
    </div>
  );
}

function QueuedButNotAskedSection({
  notes,
}: {
  notes: ReturnType<typeof projectSessionReview>["notReachedNotes"];
}) {
  return (
    <section
      aria-labelledby="recall-result-queued-notes"
      className="recall-selected-result__section recall-selected-result__section--queued"
    >
      <details className="recall-selected-result__queued">
        <summary id="recall-result-queued-notes">
          <span>Queued but not asked · {notes.length}</span>
          <ChevronDownIcon />
        </summary>
        {notes.length === 0 ? (
          <p className="muted">No queued notes stayed behind.</p>
        ) : (
          <ol className="recall-selected-result__list">
            {notes.map((note) => (
              <li key={note.id}>
                <p className="recall-selected-result__row-title">
                  {getNoteResultTitle(note)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </details>
      <p className="muted">
        These notes stayed in the queue and can appear later.
      </p>
    </section>
  );
}

function QuestionReviewRow({
  expandedQuestionKey,
  index,
  onExpandedQuestionKeyChange,
  question,
  questionKey,
  resultId,
}: {
  expandedQuestionKey: ExpandedQuestionKey;
  index: number;
  onExpandedQuestionKeyChange: ExpandedQuestionKeyChange;
  question: RecallQuestion;
  questionKey: string;
  resultId: string;
}) {
  const { t } = useAppTranslation();
  const detailId = getQuestionDetailId(index);
  const isExpanded = expandedQuestionKey === questionKey;
  const ratingLabel =
    question.selfRating === null
      ? t("recall.result.notAnswered")
      : t(getRecallRatingTranslationKey(question.selfRating));
  const ratingTone = getRecallRatingTone(question.selfRating);

  function handleToggleQuestion() {
    onExpandedQuestionKeyChange(isExpanded ? null : questionKey);
  }

  return (
    <li>
      <article className="recall-selected-result__question-card">
        <button
          aria-controls={detailId}
          aria-expanded={isExpanded}
          className="recall-selected-result__row recall-selected-result__row--question recall-selected-result__question-toggle"
          onClick={handleToggleQuestion}
          type="button"
        >
          <span className="recall-selected-result__question-index">
            {index + 1}
          </span>
          <span className="recall-selected-result__row-main">
            <span className="recall-selected-result__row-title">
              {getQuestionPrompt(question)}
            </span>
          </span>
          <span
            className="recall-selected-result__row-pill"
            data-rating-tone={ratingTone}
          >
            {ratingLabel}
          </span>
          <span
            aria-hidden="true"
            className="recall-selected-result__row-expander"
            data-expanded={isExpanded}
          >
            <ChevronDownIcon />
          </span>
        </button>

        {isExpanded ? (
          <QuestionReviewDetail
            detailId={detailId}
            question={question}
            resultId={resultId}
            ratingLabel={ratingLabel}
            ratingTone={ratingTone}
          />
        ) : null}
      </article>
    </li>
  );
}

function QuestionReviewDetail({
  detailId,
  question,
  resultId,
  ratingLabel,
  ratingTone,
}: {
  detailId: string;
  question: RecallQuestion;
  resultId: string;
  ratingLabel: string;
  ratingTone: ReturnType<typeof getRecallRatingTone>;
}) {
  const { t } = useAppTranslation();

  return (
    <div className="recall-selected-result__question-detail" id={detailId}>
      <div className="recall-selected-result__question-detail-block">
        <p className="recall-selected-result__question-detail-label">
          {t("recall.result.selfRating")}
        </p>
        <span
          className="recall-selected-result__row-pill"
          data-rating-tone={ratingTone}
        >
          {ratingLabel}
        </span>
      </div>
      <div className="recall-selected-result__question-detail-block">
        <p className="recall-selected-result__question-detail-label">
          {t("recall.result.yourAnswer")}
        </p>
        <p className="recall-selected-result__question-detail-copy">
          {question.typedAnswer?.trim().length
            ? question.typedAnswer
            : t("recall.result.answer.empty")}
        </p>
      </div>
      <div className="recall-selected-result__question-detail-block">
        <p className="recall-selected-result__question-detail-label">
          {t("recall.result.expectedAnswer")}
        </p>
        <p className="recall-selected-result__question-detail-copy">
          {getQuestionExpectedAnswer(question)}
        </p>
      </div>
      {question.answerCheck !== undefined ? (
        <div className="recall-selected-result__question-detail-block">
          <RecallAnswerCheckPanel
            answerCheck={question.answerCheck}
            showAlgorithmVersion
          />
        </div>
      ) : null}
      <div className="recall-selected-result__question-detail-block">
        <p className="recall-selected-result__question-detail-label">
          {t("recall.result.referenceNote")}
        </p>
        <p className="recall-selected-result__question-detail-title">
          {getQuestionReferenceTitle(question)}
        </p>
        <p className="recall-selected-result__question-detail-copy">
          {getRecallQuestionReferenceText(question)}
        </p>
      </div>
      <QuestionPracticeRepairPanel question={question} resultId={resultId} />
    </div>
  );
}

function QuestionPracticeRepairPanel({
  question,
  resultId,
}: {
  question: RecallQuestion;
  resultId: string;
}) {
  const practiceRepairEntry = question.practiceRepairEntry;

  if (practiceRepairEntry !== undefined) {
    return (
      <ConfirmedPracticeRepairPanel practiceRepairEntry={practiceRepairEntry} />
    );
  }

  const { questionResultId } = question;

  if (questionResultId === undefined) {
    return null;
  }

  const practiceRepairDraft = getQuestionPracticeRepairDraft(question);

  if (practiceRepairDraft === null) {
    return null;
  }

  return (
    <PracticeRepairDraftPanel
      practiceRepairDraft={practiceRepairDraft}
      questionResultId={questionResultId}
      resultId={resultId}
    />
  );
}

function ConfirmedPracticeRepairPanel({
  practiceRepairEntry,
}: {
  practiceRepairEntry: PracticeRepairEntry;
}) {
  const actionablePracticeFollowUp =
    isActionablePracticeFollowUp(practiceRepairEntry);
  const practiceRepairEntryId = getPracticeRepairEntryId(practiceRepairEntry);

  return (
    <div className="recall-selected-result__question-detail-block">
      <h5>Confirmed Practice Repair</h5>
      <p className="recall-selected-result__question-detail-label">Intent</p>
      <p className="recall-selected-result__question-detail-copy">
        {formatPracticeRepairIntentLabel(practiceRepairEntry.intent)}
      </p>
      <p className="recall-selected-result__question-detail-label">
        Correction
      </p>
      <p className="recall-selected-result__question-detail-copy">
        {practiceRepairEntry.correction}
      </p>
      {practiceRepairEntry.nextPracticeIdea !== undefined ? (
        <>
          <p className="recall-selected-result__question-detail-label">
            Next-practice idea
          </p>
          <p className="recall-selected-result__question-detail-copy">
            {practiceRepairEntry.nextPracticeIdea}
          </p>
        </>
      ) : null}
      {actionablePracticeFollowUp ? (
        <>
          <p className="recall-selected-result__question-detail-label">
            Practice Follow-up
          </p>
          <p className="recall-selected-result__question-detail-copy">
            Actionable in Recall Today
          </p>
        </>
      ) : null}
      <ButtonLink
        params={{
          practiceRepairEntryId,
        }}
        to="/practice-repair/$practiceRepairEntryId"
        variant="secondary"
      >
        Open Practice Repair
      </ButtonLink>
    </div>
  );
}

function PracticeRepairDraftPanel({
  practiceRepairDraft,
  questionResultId,
  resultId,
}: {
  practiceRepairDraft: PracticeRepairDraft;
  questionResultId: string;
  resultId: string;
}) {
  return (
    <div className="recall-selected-result__question-detail-block">
      <h5>Practice Repair</h5>
      <p className="recall-selected-result__question-detail-copy">
        {practiceRepairDraft.summary}
      </p>
      <ButtonLink
        params={{
          questionResultId,
          sessionResultId: resultId,
        }}
        to="/practice-repair/results/$sessionResultId/questions/$questionResultId"
        variant="secondary"
      >
        Practice Repair
      </ButtonLink>
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      viewBox="0 0 24 24"
      width="14"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
