import {
  createFileRoute,
  Link,
  useBlocker,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { z } from "zod";

import { resizeTextareaToFitContent } from "../../design-system/auto-sizing-textarea";
import { Button, ButtonLink } from "../../design-system/button";
import { PageLayout } from "../../design-system/page-layout";
import {
  defaultShowStudyNoteTemplatesPreference,
  defaultUserTimeZone,
} from "../access/session/session-contract";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import {
  type AppLabel,
  AppLabelError,
} from "../labels/label-management/labels";
import "../notes/notes-workspace/notes-editor-route.css";
import "../notes/notes-workspace/notes-form-foundation.css";
import "../notes/notes-workspace/notes-foundation.css";
import "../notes/notes-workspace/notes-responsive.css";
import "../notes/notes-workspace/notes-toolbar.css";
import {
  AppRecallError,
  deriveRecallGuidance,
  formatNextRecallTiming,
  type RecallQuestion,
  type RecallSchedule,
  resolveSessionResultQuestion,
  type SessionResult,
} from "../recall";
import { getInterleavedRecallRecommendation } from "../recall/interleaved-recall";
import {
  formatPracticeRepairIntentLabel,
  getPracticeRepairEntryId,
  isPracticeRepairEntryForIntent,
  listActionablePracticeFollowUpsForStudyNote,
  type PracticeRepairEntry,
  type PracticeRepairEntryForIntent,
  type PracticeRepairIntent,
  type PracticeRepairLinkedCompletionInput,
  type PracticeRepairMemoryAidKind,
  type PracticeRepairQuestionReference,
  practiceRepairIntents,
} from "../recall/recall-practice-repair";
import { planRecallWork } from "../recall/recall-work-planning";
import { appRoutePaths } from "../workspace-shell/app-shell/route-paths";
import "./study-notes.css";
import {
  type AppPersistentStudyNotesContext,
  type AppStudyNote,
  type AppStudyNoteKeyIdea,
  type AppStudyNotesContext,
  AppStudyNotesError,
  type AppStudyNoteTextReference,
  deriveStudyNoteLearningStates,
  filterStudyNotesBySelectedLabel,
  formatStudyNoteDueLabel,
  formatStudyNoteLearningStateCompactLabel,
  formatStudyNotePracticeSignalLabel,
  getStudyNoteReadiness,
  hasStudyNoteSourceContentChanged,
  isUnlabeledStudyNotesFilterValue,
  listStudyNotesForUser,
  type StudyNoteKeyIdeaImportance,
  type StudyNoteLearningState,
  toStudyNoteRecallHistories,
  type UpdateStudyNoteInput,
  unlabeledStudyNotesFilterLabel,
  unlabeledStudyNotesFilterValue,
} from ".";
import {
  applyStudyNoteAnswerCheckReferenceSuggestions,
  hasStudyNoteAnswerCheckReferenceSuggestions,
  inferStudyNoteAnswerCheckReferenceSuggestions,
} from "./answer-check-reference-suggestions";
import { getStudyNotePracticeRepair } from "./practice-repair";
import {
  deriveStudyNoteRecallInsight,
  formatRecallSelfRatingResultLabel,
} from "./study-note-recall-insight";

export const studyNotesSearchSchema = z.object({
  focus: z.enum(["expected-answer"]).optional(),
  labelId: z.string().optional(),
  practiceRepairAction: z.enum(practiceRepairIntents).optional(),
  practiceRepairEntryId: z.string().optional(),
  studyNoteId: z.string().optional(),
});

const DEFAULT_COLLAPSED_STUDY_NOTES_COUNT = 8;

export const Route = createFileRoute("/_protected/study-notes")({
  validateSearch: studyNotesSearchSchema,
  component: StudyNotesWorkspaceRoute,
});

export type StudyNotesSearch = z.infer<typeof studyNotesSearchSchema>;
export type StudyNotesRouteMode =
  | {
      kind: "workspace";
    }
  | {
      kind: "create";
    }
  | {
      kind: "edit";
      studyNoteId: string;
    };
type StudyNotesRouteKind = StudyNotesRouteMode["kind"];
type StudyNotesRouteTarget =
  | {
      to: typeof appRoutePaths.studyNotes;
    }
  | {
      to: typeof appRoutePaths.studyNotesNew;
    }
  | {
      params: {
        studyNoteId: string;
      };
      to: typeof appRoutePaths.studyNoteEditor;
    };
type LinkedPracticeRepairContext = {
  action: PracticeRepairIntent;
  entry: PracticeRepairEntry;
  practiceRepairEntryId: string;
};

type AnswerCheckSuggestionSession = {
  baselineDraft: UpdateStudyNoteInput;
};

function createBlankDraft(): UpdateStudyNoteInput {
  return {
    acceptedVariants: [],
    acronyms: [],
    expectedAnswer: "",
    keyIdeas: [],
    labelIds: [],
    metaphors: [],
    prompt: "",
    prohibitedPhrases: [],
    sourceBody: "",
    sourceTitle: "",
  };
}

function StudyNotesWorkspaceRoute() {
  const search = Route.useSearch();

  return <StudyNotesManagementPage search={search} />;
}

type StudyNotesManagementStatusFilter =
  | "all"
  | "due-for-recall"
  | "incomplete"
  | "needs-practice"
  | "not-recalled-yet";
type StudyNotesManagementSortOrder =
  | "least-recently-updated"
  | "recently-updated"
  | "study-note-a-z"
  | "study-note-z-a";
type StudyNotesManagementRecallGuidanceEntry = ReturnType<
  typeof deriveRecallGuidance
>[number];
type StudyNotesManagementRowStatusKind = "attention" | "neutral" | "practice";

const studyNotesManagementStatusFilterOptions = [
  { label: "All statuses", value: "all" },
  { label: "Incomplete", value: "incomplete" },
  { label: "Not recalled yet", value: "not-recalled-yet" },
  { label: "Needs practice", value: "needs-practice" },
  { label: "Due for Recall", value: "due-for-recall" },
] as const satisfies readonly {
  label: string;
  value: StudyNotesManagementStatusFilter;
}[];

const studyNotesManagementSortOptions = [
  { label: "Recently updated", value: "recently-updated" },
  { label: "Least recently updated", value: "least-recently-updated" },
  { label: "Study note A-Z", value: "study-note-a-z" },
  { label: "Study note Z-A", value: "study-note-z-a" },
] as const satisfies readonly {
  label: string;
  value: StudyNotesManagementSortOrder;
}[];

function StudyNotesManagementPage({
  search,
}: Readonly<{
  search: StudyNotesSearch;
}>) {
  const navigate = useNavigate();
  const studyNotesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.studyNotes,
  });
  const persistentStudyNotesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentStudyNotes,
  });
  const labelsContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.labels,
  });
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const persistentRecallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentRecall,
  });
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const userId = sessionSnapshot.user?.id ?? null;
  const userTimeZone =
    sessionSnapshot.user?.userTimeZone ?? defaultUserTimeZone;
  const now = new Date().toISOString();
  const studyNotesStore:
    | Pick<AppStudyNotesContext, "getSnapshot" | "subscribe">
    | Pick<AppPersistentStudyNotesContext, "getSnapshot" | "subscribe"> =
    persistentStudyNotesContext ?? studyNotesContext;
  const studyNotesSnapshot = useSyncExternalStore(
    studyNotesStore.subscribe,
    studyNotesStore.getSnapshot,
    studyNotesStore.getSnapshot,
  );
  const recallResultsSnapshot = useSyncExternalStore(
    recallContext.subscribe,
    recallContext.getSessionResultsSnapshot,
    recallContext.getSessionResultsSnapshot,
  );
  const recallSchedulesSnapshot = useSyncExternalStore(
    recallContext.subscribe,
    recallContext.getRecallSchedulesSnapshot,
    recallContext.getRecallSchedulesSnapshot,
  );
  const [availableLabels, setAvailableLabels] = useState<AppLabel[]>(() =>
    userId === null ? [] : labelsContext.getLabelsForUser(userId),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isDeletingStudyNoteId, setDeletingStudyNoteId] = useState<
    string | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLabelId, setSelectedLabelId] = useState(
    () => search.labelId ?? "",
  );
  const [selectedStatusFilter, setSelectedStatusFilter] =
    useState<StudyNotesManagementStatusFilter>("all");
  const [selectedSortOrder, setSelectedSortOrder] =
    useState<StudyNotesManagementSortOrder>("recently-updated");
  const allStudyNotes = useMemo(
    () => listStudyNotesForUser(studyNotesSnapshot, userId),
    [studyNotesSnapshot, userId],
  );
  const recallAttemptsByNote = useMemo(
    () =>
      userId === null || recallResultsSnapshot.length === 0
        ? []
        : recallContext.listAttemptsByNote({ userId }),
    [recallContext, recallResultsSnapshot, userId],
  );
  const recallHistories = useMemo(
    () => toStudyNoteRecallHistories(recallAttemptsByNote),
    [recallAttemptsByNote],
  );
  const learningStates = useMemo(
    () =>
      deriveStudyNoteLearningStates({
        histories: recallHistories,
        now,
        recallSchedules: recallSchedulesSnapshot,
        studyNotes: allStudyNotes,
      }),
    [allStudyNotes, now, recallHistories, recallSchedulesSnapshot],
  );
  const recallGuidanceEntries = useMemo(
    () =>
      deriveRecallGuidance({
        attemptsByNote: recallAttemptsByNote,
        now,
        recallSchedules: recallSchedulesSnapshot,
        sessionResults: recallResultsSnapshot,
        studyNotes: allStudyNotes,
        userTimeZone,
      }),
    [
      allStudyNotes,
      now,
      recallAttemptsByNote,
      recallResultsSnapshot,
      recallSchedulesSnapshot,
      userTimeZone,
    ],
  );
  const recallTodayQueue = useMemo(() => {
    if (userId === null) {
      return [];
    }

    return planRecallWork({
      histories: recallHistories,
      now,
      recallSchedules: recallSchedulesSnapshot,
      sessionResults: recallResultsSnapshot,
      studyNotes: allStudyNotes,
      userTimeZone,
    }).recallTodayQueue;
  }, [
    allStudyNotes,
    now,
    recallHistories,
    recallResultsSnapshot,
    recallSchedulesSnapshot,
    userId,
    userTimeZone,
  ]);
  const recallTodayStudyNoteIds = useMemo(
    () => recallTodayQueue.map((queueItem) => queueItem.studyNote.id),
    [recallTodayQueue],
  );
  const learningStateByStudyNoteId = useMemo(
    () =>
      new Map(
        learningStates.map((learningState) => [
          learningState.studyNoteId,
          learningState,
        ]),
      ),
    [learningStates],
  );
  const recallGuidanceByStudyNoteId = useMemo(
    () =>
      new Map(
        recallGuidanceEntries.map((entry) => [entry.studyNote.id, entry]),
      ),
    [recallGuidanceEntries],
  );
  const recallScheduleByStudyNoteId = useMemo(
    () =>
      new Map(
        recallSchedulesSnapshot.map((schedule) => [
          schedule.studyNoteId,
          schedule,
        ]),
      ),
    [recallSchedulesSnapshot],
  );
  const studyNoteCountBySourceId = useMemo(() => {
    const counts = new Map<string, number>();

    for (const studyNote of allStudyNotes) {
      counts.set(
        studyNote.sourceNoteId,
        (counts.get(studyNote.sourceNoteId) ?? 0) + 1,
      );
    }

    return counts;
  }, [allStudyNotes]);
  const filteredStudyNotes = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

    return filterStudyNotesBySelectedLabel(allStudyNotes, selectedLabelId)
      .filter((studyNote) => {
        if (
          !matchesStudyNoteStatusFilter({
            learningState: learningStateByStudyNoteId.get(studyNote.id) ?? null,
            statusFilter: selectedStatusFilter,
            studyNote,
          })
        ) {
          return false;
        }

        if (normalizedQuery.length === 0) {
          return true;
        }

        const searchableText = [
          studyNote.prompt,
          studyNote.expectedAnswer,
          studyNote.source.body,
          studyNote.source.displayName ?? "",
          studyNote.source.title,
          getStudyNoteLabelNames(availableLabels, studyNote.labelIds).join(" "),
        ]
          .join(" ")
          .toLocaleLowerCase();

        return searchableText.includes(normalizedQuery);
      })
      .sort((left, right) =>
        compareStudyNotesForManagementSort({
          left,
          right,
          sortOrder: selectedSortOrder,
        }),
      );
  }, [
    allStudyNotes,
    availableLabels,
    learningStateByStudyNoteId,
    searchQuery,
    selectedLabelId,
    selectedSortOrder,
    selectedStatusFilter,
  ]);
  const storeMutation = persistentStudyNotesContext ?? studyNotesContext;
  const emptyManagementMessage = getStudyNotesManagementEmptyMessage({
    allStudyNotesCount: allStudyNotes.length,
    filteredStudyNotesCount: filteredStudyNotes.length,
  });

  useEffect(() => {
    if (persistentStudyNotesContext === undefined) {
      return;
    }

    void persistentStudyNotesContext.refresh(userId).catch((error: unknown) => {
      if (error instanceof AppStudyNotesError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    });
  }, [persistentStudyNotesContext, userId]);

  useEffect(() => {
    function syncLabels() {
      if (userId === null) {
        setAvailableLabels([]);
        return;
      }

      setAvailableLabels(labelsContext.getLabelsForUser(userId));
    }

    syncLabels();

    return labelsContext.subscribe(syncLabels);
  }, [labelsContext, userId]);

  useEffect(() => {
    setSelectedLabelId(search.labelId ?? "");
  }, [search.labelId]);

  useEffect(() => {
    if (
      search.studyNoteId === undefined ||
      !allStudyNotes.some((studyNote) => studyNote.id === search.studyNoteId)
    ) {
      return;
    }

    void navigate({
      params: {
        studyNoteId: search.studyNoteId,
      },
      replace: true,
      search: {
        focus: search.focus,
        practiceRepairAction: search.practiceRepairAction,
        practiceRepairEntryId: search.practiceRepairEntryId,
      },
      to: appRoutePaths.studyNoteEditor,
    });
  }, [
    allStudyNotes,
    navigate,
    search.focus,
    search.practiceRepairAction,
    search.practiceRepairEntryId,
    search.studyNoteId,
  ]);

  useEffect(() => {
    if (
      selectedLabelId === "" ||
      isUnlabeledStudyNotesFilterValue(selectedLabelId) ||
      availableLabels.some((label) => label.id === selectedLabelId)
    ) {
      return;
    }

    void navigate({
      replace: true,
      search: (previousSearch) => ({
        ...previousSearch,
        labelId: undefined,
      }),
      to: appRoutePaths.studyNotes,
    });
  }, [availableLabels, navigate, selectedLabelId]);

  function handleNewStudyNote() {
    void navigate({ to: appRoutePaths.studyNotesNew });
  }

  function handleSelectedLabelChange(nextSelectedLabelId: string) {
    setSelectedLabelId(nextSelectedLabelId);
    void navigate({
      replace: true,
      search: (previousSearch) => ({
        ...previousSearch,
        labelId: getStudyNotesManagementLabelSearchValue(nextSelectedLabelId),
      }),
      to: appRoutePaths.studyNotes,
    });
  }

  function handleStatusFilterChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextStatusFilter = readStudyNotesManagementStatusFilter(
      event.target.value,
    );

    if (nextStatusFilter === null) {
      return;
    }

    setSelectedStatusFilter(nextStatusFilter);
  }

  function handleSortOrderChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextSortOrder = readStudyNotesManagementSortOrder(event.target.value);

    if (nextSortOrder === null) {
      return;
    }

    setSelectedSortOrder(nextSortOrder);
  }

  async function handleStartRecallSession() {
    if (userId === null) {
      return;
    }

    if (recallTodayStudyNoteIds.length === 0) {
      await navigate({ to: appRoutePaths.recall });
      return;
    }

    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      if (persistentRecallContext === undefined) {
        recallContext.startFlashCardSession({
          mode: "FlashCard",
          studyNoteIds: [...recallTodayStudyNoteIds],
          userId,
        });
      } else {
        await persistentRecallContext.startFlashCardSession(userId, {
          mode: "FlashCard",
          studyNoteIds: recallTodayStudyNoteIds,
        });
      }

      await navigate({ to: appRoutePaths.recallSession });
    } catch (error) {
      if (error instanceof AppRecallError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  async function handleDeleteStudyNote(studyNote: AppStudyNote) {
    if (userId === null) {
      return;
    }

    const hasSiblingStudyNotes =
      (studyNoteCountBySourceId.get(studyNote.sourceNoteId) ?? 0) > 1;

    if (
      !window.confirm(
        getDeleteStudyNoteConfirmationMessage(hasSiblingStudyNotes),
      )
    ) {
      return;
    }

    setDeletingStudyNoteId(studyNote.id);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      await storeMutation.deleteStudyNote(userId, studyNote.id, {
        deleteSource: !hasSiblingStudyNotes,
      });
      setFeedbackMessage(`Deleted ${studyNote.prompt}`);
    } catch (error) {
      if (error instanceof AppStudyNotesError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    } finally {
      setDeletingStudyNoteId(null);
    }
  }

  return (
    <PageLayout
      actions={
        <>
          <Button
            aria-label="New Study Note"
            className="study-notes-new-note"
            onClick={handleNewStudyNote}
            type="button"
            variant="secondary"
          >
            <PlusIcon />
            <span>New note</span>
          </Button>
          <Button
            className="study-notes-start-recall"
            onClick={() => void handleStartRecallSession()}
            type="button"
            variant="secondary"
          >
            <PlayIcon />
            <span>Start Recall Session</span>
          </Button>
        </>
      }
      actionsClassName="study-notes-hero__actions"
      bodyClassName="study-notes-management-page__body"
      className="notes-workspace study-notes-management-page"
      description="Browse, filter, and act on Study Notes without opening the editor."
      headerClassName="study-notes-hero"
      headingLevel={1}
      title="Study Notes"
    >
      <div className="study-notes-management-shell">
        <section
          aria-label="Study Notes management"
          className="study-notes-management"
        >
          <div className="study-notes-management__filters">
            <label className="study-notes-management__control">
              <span>Search Study Notes</span>
              <input
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search Study Notes"
                type="search"
                value={searchQuery}
              />
            </label>
            <label className="study-notes-management__control">
              <span>Filter Study Notes by label</span>
              <select
                aria-label="Filter Study Notes by label"
                onChange={(event) =>
                  handleSelectedLabelChange(event.target.value)
                }
                value={selectedLabelId}
              >
                <option value="">All labels</option>
                <option value={unlabeledStudyNotesFilterValue}>
                  {unlabeledStudyNotesFilterLabel}
                </option>
                {availableLabels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="study-notes-management__control">
              <span>Filter Study Notes by status</span>
              <select
                aria-label="Filter Study Notes by status"
                onChange={handleStatusFilterChange}
                value={selectedStatusFilter}
              >
                {studyNotesManagementStatusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="study-notes-management__control">
              <span>Sort Study Notes</span>
              <select
                aria-label="Sort Study Notes"
                onChange={handleSortOrderChange}
                value={selectedSortOrder}
              >
                {studyNotesManagementSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="study-notes-management__summary">
            <p>
              Showing {filteredStudyNotes.length} of {allStudyNotes.length}{" "}
              Study Notes
            </p>
          </div>

          {errorMessage === null ? null : (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
          {feedbackMessage === null ? null : (
            <p className="study-notes-management__feedback" role="status">
              {feedbackMessage}
            </p>
          )}

          {emptyManagementMessage === null ? (
            <div className="study-notes-management__table-wrap">
              <table
                aria-label="Study Notes management list"
                className="study-notes-management__table"
              >
                <thead>
                  <tr>
                    <th scope="col">Study note</th>
                    <th scope="col">Labels</th>
                    <th scope="col">Recall status</th>
                    <th scope="col">Last updated</th>
                    <th scope="col">Next recall / Suggested action</th>
                    <th scope="col">Source</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudyNotes.map((studyNote) => (
                    <StudyNotesManagementTableRow
                      availableLabels={availableLabels}
                      isDeleting={isDeletingStudyNoteId === studyNote.id}
                      key={studyNote.id}
                      learningState={
                        learningStateByStudyNoteId.get(studyNote.id) ?? null
                      }
                      now={now}
                      onDeleteStudyNote={handleDeleteStudyNote}
                      recallGuidance={
                        recallGuidanceByStudyNoteId.get(studyNote.id) ?? null
                      }
                      schedule={
                        recallScheduleByStudyNoteId.get(studyNote.id) ?? null
                      }
                      sourceStudyNoteCount={
                        studyNoteCountBySourceId.get(studyNote.sourceNoteId) ??
                        0
                      }
                      studyNote={studyNote}
                      userTimeZone={userTimeZone}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted study-notes-management__empty">
              {emptyManagementMessage}
            </p>
          )}
        </section>
      </div>
    </PageLayout>
  );
}

function StudyNotesManagementTableRow({
  availableLabels,
  isDeleting,
  learningState,
  now,
  onDeleteStudyNote,
  recallGuidance,
  schedule,
  sourceStudyNoteCount,
  studyNote,
  userTimeZone,
}: Readonly<{
  availableLabels: readonly AppLabel[];
  isDeleting: boolean;
  learningState: StudyNoteLearningState | null;
  now: string;
  onDeleteStudyNote: (studyNote: AppStudyNote) => Promise<void>;
  recallGuidance: StudyNotesManagementRecallGuidanceEntry | null;
  schedule: RecallSchedule | null;
  sourceStudyNoteCount: number;
  studyNote: AppStudyNote;
  userTimeZone: string;
}>) {
  const title = studyNote.prompt;
  const labelNames = getStudyNoteLabelNames(
    availableLabels,
    studyNote.labelIds,
  );
  const nextRecallLabel =
    formatNextRecallTiming({
      now,
      schedule,
      userTimeZone,
    }) ?? "On schedule";
  const recallInsight = deriveStudyNoteRecallInsight({
    draft: createDraftFromStudyNote(studyNote),
    nextRecall: nextRecallLabel,
    recallGuidance,
  });
  const recallDetailLabel =
    getStudyNotesManagementRecallDetailLabel(learningState);
  const sourceLabel = getStudyNoteSourceDisplayLabel(studyNote);
  const isSharedSource = sourceStudyNoteCount > 1;

  return (
    <tr>
      <td
        className="study-notes-management__study-note"
        data-label="Study note"
      >
        <Link
          className="study-notes-management__title-link"
          params={{
            studyNoteId: studyNote.id,
          }}
          to={appRoutePaths.studyNoteEditor}
        >
          {title}
        </Link>
        <p className="study-notes-management__study-note-meta">
          {getStudyNoteExpectedAnswerPreview(studyNote)}
        </p>
      </td>
      <td data-label="Labels">
        <div className="study-notes-management__cell-stack">
          <span>{labelNames.join(", ")}</span>
        </div>
      </td>
      <td data-label="Recall status">
        <div className="study-notes-management__cell-stack">
          <span
            className="study-notes-management__status-badge"
            data-status-kind={getStudyNotesManagementRowStatusKind(
              learningState,
            )}
          >
            {getStudyNotesManagementRecallStatusLabel(learningState)}
          </span>
          {recallDetailLabel === null ? null : <span>{recallDetailLabel}</span>}
        </div>
      </td>
      <td data-label="Last updated">
        <div className="study-notes-management__cell-stack">
          <span>{formatRelativeUpdatedLabel(studyNote.updatedAt)}</span>
        </div>
      </td>
      <td data-label="Next recall / Suggested action">
        <div className="study-notes-management__cell-stack">
          <span>{nextRecallLabel}</span>
          <span>{recallInsight.suggestedAction}</span>
        </div>
      </td>
      <td data-label="Source">
        <div className="study-notes-management__cell-stack">
          <span>{sourceLabel}</span>
          {isSharedSource ? <span>Shared source</span> : null}
        </div>
      </td>
      <td data-label="Actions">
        <div className="study-notes-management__actions">
          <ButtonLink
            aria-label={`Edit ${title}`}
            params={{
              studyNoteId: studyNote.id,
            }}
            size="compact"
            to={appRoutePaths.studyNoteEditor}
            variant="secondary"
          >
            Edit
          </ButtonLink>
          <Button
            aria-label={`Delete ${title}`}
            disabled={isDeleting}
            onClick={() => void onDeleteStudyNote(studyNote)}
            size="compact"
            type="button"
            variant="danger"
          >
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}

function readStudyNotesManagementStatusFilter(value: string) {
  return (
    studyNotesManagementStatusFilterOptions.find(
      (option) => option.value === value,
    )?.value ?? null
  );
}

function readStudyNotesManagementSortOrder(value: string) {
  return (
    studyNotesManagementSortOptions.find((option) => option.value === value)
      ?.value ?? null
  );
}

function getStudyNotesManagementLabelSearchValue(labelId: string) {
  if (labelId.length === 0) {
    return undefined;
  }

  return labelId;
}

function getStudyNotesManagementEmptyMessage(input: {
  allStudyNotesCount: number;
  filteredStudyNotesCount: number;
}) {
  if (input.allStudyNotesCount === 0) {
    return "Create a Study Note to start practicing.";
  }

  if (input.filteredStudyNotesCount === 0) {
    return "No Study Notes match the current filters.";
  }

  return null;
}

function getStudyNoteExpectedAnswerPreview(studyNote: AppStudyNote) {
  if (studyNote.expectedAnswer.trim().length === 0) {
    return "Add the expected answer before recall.";
  }

  return studyNote.expectedAnswer;
}

function getStudyNotesManagementRecallStatusLabel(
  learningState: StudyNoteLearningState | null,
) {
  if (learningState === null) {
    return "Study Note";
  }

  return formatStudyNoteLearningStateCompactLabel(learningState);
}

function getStudyNotesManagementRecallDetailLabel(
  learningState: StudyNoteLearningState | null,
) {
  if (learningState?.needsPractice === true) {
    return "Needs practice";
  }

  if (
    learningState?.dueForRecall === true &&
    learningState.latestScore !== null
  ) {
    return formatStudyNoteDueLabel(learningState);
  }

  return null;
}

function getStudyNotesManagementRowStatusKind(
  learningState: StudyNoteLearningState | null,
): StudyNotesManagementRowStatusKind {
  if (learningState?.needsPractice === true) {
    return "practice";
  }

  if (learningState?.dueForRecall === true) {
    return "attention";
  }

  return "neutral";
}

function matchesStudyNoteStatusFilter(input: {
  learningState: StudyNoteLearningState | null;
  statusFilter: StudyNotesManagementStatusFilter;
  studyNote: AppStudyNote;
}) {
  const readiness = getStudyNoteReadiness(input.studyNote);

  switch (input.statusFilter) {
    case "all":
      return true;
    case "incomplete":
      return readiness.incomplete;
    case "not-recalled-yet":
      return readiness.recallable && input.learningState?.latestScore === null;
    case "needs-practice":
      return input.learningState?.needsPractice === true;
    case "due-for-recall":
      return (
        input.learningState?.dueForRecall === true &&
        input.learningState.latestScore !== null &&
        input.learningState.needsPractice === false
      );
  }
}

function compareStudyNotesForManagementSort(input: {
  left: AppStudyNote;
  right: AppStudyNote;
  sortOrder: StudyNotesManagementSortOrder;
}) {
  switch (input.sortOrder) {
    case "least-recently-updated":
      return (
        input.left.updatedAt.localeCompare(input.right.updatedAt) ||
        input.left.prompt.localeCompare(input.right.prompt)
      );
    case "recently-updated":
      return (
        input.right.updatedAt.localeCompare(input.left.updatedAt) ||
        input.left.prompt.localeCompare(input.right.prompt)
      );
    case "study-note-a-z":
      return (
        input.left.prompt.localeCompare(input.right.prompt) ||
        input.right.updatedAt.localeCompare(input.left.updatedAt)
      );
    case "study-note-z-a":
      return (
        input.right.prompt.localeCompare(input.left.prompt) ||
        input.right.updatedAt.localeCompare(input.left.updatedAt)
      );
  }
}

function getStudyNoteSourceDisplayLabel(studyNote: AppStudyNote) {
  const displayName = studyNote.source.displayName?.trim();

  if (displayName !== undefined && displayName.length > 0) {
    return displayName;
  }

  const sourceTitle = studyNote.source.title.trim();

  if (sourceTitle.length > 0) {
    return sourceTitle;
  }

  return "Untitled source";
}

function getRouteStudyNoteId(routeMode: StudyNotesRouteMode) {
  switch (routeMode.kind) {
    case "workspace":
    case "create":
      return null;
    case "edit":
      return routeMode.studyNoteId;
  }
}

function getStudyNotesRouteTarget(input: {
  routeKind: StudyNotesRouteKind;
  routeStudyNoteId: string | null;
}): StudyNotesRouteTarget {
  switch (input.routeKind) {
    case "workspace":
      return {
        to: appRoutePaths.studyNotes,
      };
    case "create":
      return {
        to: appRoutePaths.studyNotesNew,
      };
    case "edit": {
      if (input.routeStudyNoteId === null) {
        throw new Error("Expected an edit route to include a Study Note id.");
      }

      return {
        params: {
          studyNoteId: input.routeStudyNoteId,
        },
        to: appRoutePaths.studyNoteEditor,
      };
    }
  }
}

function getInitialSelectedStudyNoteId(input: {
  routeMode: StudyNotesRouteMode;
  studyNotes: readonly AppStudyNote[];
}) {
  switch (input.routeMode.kind) {
    case "workspace":
      return input.studyNotes[0]?.id ?? null;
    case "create":
      return null;
    case "edit":
      return input.routeMode.studyNoteId;
  }
}

function findStudyNoteById(
  studyNotes: readonly AppStudyNote[],
  studyNoteId: string | null,
) {
  if (studyNoteId === null) {
    return null;
  }

  return studyNotes.find((studyNote) => studyNote.id === studyNoteId) ?? null;
}

function getSelectedStudyNote(input: {
  isCreatingStudyNote: boolean;
  matchedSelectedStudyNote: AppStudyNote | null;
  routeKind: StudyNotesRouteKind;
  studyNotes: readonly AppStudyNote[];
}) {
  if (input.isCreatingStudyNote) {
    return null;
  }

  if (input.matchedSelectedStudyNote !== null) {
    return input.matchedSelectedStudyNote;
  }

  if (input.routeKind !== "workspace") {
    return null;
  }

  return input.studyNotes[0] ?? null;
}

function getTargetStudyNoteId(input: {
  routeKind: StudyNotesRouteKind;
  routeStudyNoteId: string | null;
  searchStudyNoteId: string | undefined;
}) {
  if (input.routeKind === "edit") {
    return input.routeStudyNoteId;
  }

  return input.searchStudyNoteId ?? null;
}

function getLinkedPracticeRepairNavigationSearch(input: {
  linkedPracticeRepair: LinkedPracticeRepairContext | null;
  search: StudyNotesSearch;
}) {
  if (input.linkedPracticeRepair === null) {
    return undefined;
  }

  return {
    practiceRepairAction: input.search.practiceRepairAction,
    practiceRepairEntryId: input.search.practiceRepairEntryId,
  };
}

function findLinkedPracticeRepairContext(input: {
  practiceRepairAction: StudyNotesSearch["practiceRepairAction"];
  practiceRepairEntryId: string | undefined;
  sessionResults: readonly SessionResult[];
}): LinkedPracticeRepairContext | null {
  const { practiceRepairAction, practiceRepairEntryId, sessionResults } = input;

  if (practiceRepairEntryId === undefined) {
    return null;
  }

  for (const result of sessionResults) {
    for (const question of result.questions) {
      const entry = question.practiceRepairEntry;

      if (
        entry !== undefined &&
        getPracticeRepairEntryId(entry) === practiceRepairEntryId
      ) {
        return {
          action: practiceRepairAction ?? entry.intent,
          entry,
          practiceRepairEntryId,
        };
      }
    }
  }

  return null;
}

function getLinkedPracticeRepairKey(
  context: Pick<
    LinkedPracticeRepairContext,
    "action" | "practiceRepairEntryId"
  >,
) {
  return `${context.practiceRepairEntryId}:${context.action}`;
}

function createDraftFromStudyNote(
  studyNote: AppStudyNote | null,
): UpdateStudyNoteInput {
  if (studyNote === null) {
    return createBlankDraft();
  }

  return cloneStudyNoteDraft({
    acceptedVariants: studyNote.acceptedVariants,
    acronyms: studyNote.acronyms,
    expectedAnswer: studyNote.expectedAnswer,
    keyIdeas: studyNote.keyIdeas,
    labelIds: studyNote.labelIds,
    metaphors: studyNote.metaphors,
    prompt: studyNote.prompt,
    prohibitedPhrases: studyNote.prohibitedPhrases,
    sourceBody: studyNote.source.body,
    sourceTitle: studyNote.source.title,
  });
}

function cloneStudyNoteDraft(
  draft: UpdateStudyNoteInput,
): UpdateStudyNoteInput {
  return {
    acceptedVariants: draft.acceptedVariants.map((variant) => ({
      ...variant,
    })),
    acronyms: draft.acronyms.map((acronym) => ({ ...acronym })),
    expectedAnswer: draft.expectedAnswer,
    keyIdeas: draft.keyIdeas.map((keyIdea) => ({
      ...keyIdea,
      acceptedPhrases: [...keyIdea.acceptedPhrases],
      prohibitedPhrases: [...keyIdea.prohibitedPhrases],
    })),
    labelIds: [...draft.labelIds],
    metaphors: draft.metaphors.map((metaphor) => ({ ...metaphor })),
    prompt: draft.prompt,
    prohibitedPhrases: draft.prohibitedPhrases.map((phrase) => ({
      ...phrase,
    })),
    sourceBody: draft.sourceBody,
    sourceTitle: draft.sourceTitle,
  };
}

function normalizeSupportDescriptionsForComparison(
  supportDescriptions: readonly { description: string }[],
) {
  return supportDescriptions
    .map((supportDescription) => supportDescription.description.trim())
    .filter((description) => description.length > 0);
}

function haveSameStringSet(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightValues = new Set(right);

  return left.every((value) => rightValues.has(value));
}

function haveSameStringSequence(
  left: readonly string[],
  right: readonly string[],
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function haveSameAnswerCheckTextReferences(
  left: readonly AppStudyNoteTextReference[],
  right: readonly AppStudyNoteTextReference[],
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (reference, index) =>
      reference.id === right[index]?.id &&
      reference.text.trim() === right[index]?.text.trim(),
  );
}

function haveSameKeyIdeas(
  left: readonly AppStudyNoteKeyIdea[],
  right: readonly AppStudyNoteKeyIdea[],
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((keyIdea, index) => {
    const otherKeyIdea = right[index];

    return (
      otherKeyIdea !== undefined &&
      keyIdea.id === otherKeyIdea.id &&
      keyIdea.importance === otherKeyIdea.importance &&
      keyIdea.text.trim() === otherKeyIdea.text.trim() &&
      haveSameStringSequence(
        keyIdea.acceptedPhrases,
        otherKeyIdea.acceptedPhrases,
      ) &&
      haveSameStringSequence(
        keyIdea.prohibitedPhrases,
        otherKeyIdea.prohibitedPhrases,
      )
    );
  });
}

function areStudyNoteDraftsEqual(
  left: UpdateStudyNoteInput,
  right: UpdateStudyNoteInput,
) {
  return (
    haveSameAnswerCheckTextReferences(
      left.acceptedVariants,
      right.acceptedVariants,
    ) &&
    left.prompt.trim() === right.prompt.trim() &&
    left.expectedAnswer.trim() === right.expectedAnswer.trim() &&
    left.sourceBody.trim() === right.sourceBody.trim() &&
    left.sourceTitle.trim() === right.sourceTitle.trim() &&
    haveSameKeyIdeas(left.keyIdeas, right.keyIdeas) &&
    haveSameStringSet(left.labelIds, right.labelIds) &&
    haveSameStringSequence(
      normalizeSupportDescriptionsForComparison(left.metaphors),
      normalizeSupportDescriptionsForComparison(right.metaphors),
    ) &&
    haveSameStringSequence(
      normalizeSupportDescriptionsForComparison(left.acronyms),
      normalizeSupportDescriptionsForComparison(right.acronyms),
    ) &&
    haveSameAnswerCheckTextReferences(
      left.prohibitedPhrases,
      right.prohibitedPhrases,
    )
  );
}

function didSplitStudyNoteDraftChange(input: {
  draft: UpdateStudyNoteInput;
  studyNote: AppStudyNote;
}) {
  return (
    input.draft.prompt.trim() !== input.studyNote.prompt.trim() ||
    input.draft.expectedAnswer.trim() !==
      input.studyNote.expectedAnswer.trim() ||
    hasStudyNoteSourceContentChanged({
      currentSource: input.studyNote.source,
      sourceBody: input.draft.sourceBody,
      sourceTitle: input.draft.sourceTitle,
    })
  );
}

function StudyNotesTextField({
  inputRef,
  isPracticeRepairFocus = false,
  label,
  maxLength,
  onChange,
  optional = false,
  placeholder,
  value,
}: Readonly<{
  inputRef?: Ref<HTMLInputElement>;
  isPracticeRepairFocus?: boolean;
  label: string;
  maxLength: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  optional?: boolean;
  placeholder?: string;
  value: string;
}>) {
  return (
    <label
      className="study-notes-field study-notes-field--single-line"
      data-practice-repair-focus={isPracticeRepairFocus ? "true" : undefined}
    >
      <span className="study-notes-field__label">
        {label}
        {optional ? <span aria-hidden="true"> (optional)</span> : null}
      </span>
      <span className="study-notes-field__control">
        <input
          aria-label={label}
          ref={inputRef}
          maxLength={maxLength}
          onChange={onChange}
          placeholder={placeholder ?? label}
          value={value}
        />
        <span className="study-notes-field__count">
          {value.length}/{maxLength}
        </span>
      </span>
    </label>
  );
}

function StudyNotesTextarea({
  inputRef,
  isPracticeRepairFocus = false,
  label,
  maxLength,
  onChange,
  optional = false,
  placeholder,
  rows,
  value,
}: Readonly<{
  inputRef?: Ref<HTMLTextAreaElement>;
  isPracticeRepairFocus?: boolean;
  label: string;
  maxLength: number;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  optional?: boolean;
  placeholder?: string;
  rows: number;
  value: string;
}>) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const setTextareaRef = useCallback(
    (textarea: HTMLTextAreaElement | null) => {
      textareaRef.current = textarea;
      resizeTextareaToFitContent(textarea);

      if (typeof inputRef === "function") {
        inputRef(textarea);
        return;
      }

      if (inputRef !== undefined && inputRef !== null) {
        inputRef.current = textarea;
      }
    },
    [inputRef],
  );

  useEffect(() => {
    resizeTextareaToFitContent(textareaRef.current);
  });

  return (
    <label
      className="study-notes-field study-notes-field--multiline"
      data-practice-repair-focus={isPracticeRepairFocus ? "true" : undefined}
    >
      <span className="study-notes-field__label">
        {label}
        {optional ? <span aria-hidden="true"> (optional)</span> : null}
      </span>
      <span className="study-notes-field__control">
        <textarea
          aria-label={label}
          data-auto-size="true"
          ref={setTextareaRef}
          maxLength={maxLength}
          onChange={(event) => {
            resizeTextareaToFitContent(event.currentTarget);
            onChange(event);
          }}
          placeholder={placeholder ?? label}
          rows={rows}
          value={value}
        />
        <span className="study-notes-field__count">
          {value.length}/{maxLength}
        </span>
      </span>
    </label>
  );
}

function StudyNoteFact({
  icon,
  label,
  value,
  valueClassName,
}: Readonly<{
  icon: ReactNode;
  label: string;
  value: ReactNode;
  valueClassName?: string;
}>) {
  return (
    <div className="study-notes-fact">
      <dt>
        <span aria-hidden="true" className="study-notes-fact__icon">
          {icon}
        </span>
        <span>{label}</span>
      </dt>
      <dd
        className={["study-notes-fact__value", valueClassName]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7-11-7Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M4 7h7" />
      <path d="M15 7h5" />
      <path d="M13 5v4" />
      <path d="M4 17h5" />
      <path d="M13 17h7" />
      <path d="M11 15v4" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

function StudyNoteDocumentIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M6 3h9l3 3v15H6V3Z" />
      <path d="M14 3v4h4" />
      <path d="M9 11h6" />
      <path d="M9 15h5" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M8 8h10v12H8V8Z" />
      <path d="M6 16H4V4h10v2" />
    </svg>
  );
}

function CalendarCheckIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M7 3v4" />
      <path d="M17 3v4" />
      <path d="M4 8h16" />
      <path d="M5 5h14v15H5V5Z" />
      <path d="m8 14 2 2 5-5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function HelpCircleIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.4 2.4 0 0 1 4.5 1.2c0 1.8-2.3 2.1-2.3 3.8" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="m12 3 1.8 4.4L18 9l-4.2 1.6L12 15l-1.8-4.4L6 9l4.2-1.6L12 3Z" />
      <path d="m19 14 .8 2 2.2.8-2.2.8-.8 2.4-.8-2.4-2.2-.8 2.2-.8.8-2Z" />
      <path d="m5 13 .7 1.7 1.8.7-1.8.7L5 18l-.7-1.9-1.8-.7 1.8-.7L5 13Z" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M12 3v18" />
      <path d="M5 7h14" />
      <path d="m6 7-3 6h6L6 7Z" />
      <path d="m18 7-3 6h6l-3-6Z" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M14.7 6.3a4 4 0 0 0 5 5L10 21l-5-5 9.7-9.7Z" />
      <path d="m7 18-1-1" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </svg>
  );
}

const studyNoteTemplateActions = [
  {
    icon: <HelpCircleIcon />,
    label: "Why",
    prompt: "Why does this work?",
  },
  {
    icon: <WrenchIcon />,
    label: "How",
    prompt: "How would I use this?",
  },
  {
    icon: <SparklesIcon />,
    label: "Example",
    prompt: "What example proves this?",
  },
  {
    icon: <ScaleIcon />,
    label: "Compare",
    prompt: "How is this different from a related idea?",
  },
  {
    icon: <TrendIcon />,
    label: "Cause & effect",
    prompt: "What causes this and what changes because of it?",
  },
] as const;

function WarningIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="m4 16 5-5 4 4 7-8" />
      <path d="M15 7h5v5" />
    </svg>
  );
}

function setLabelIdSelection(
  labelIds: readonly string[],
  labelId: string,
  isSelected: boolean,
): string[] {
  if (isSelected) {
    if (labelIds.includes(labelId)) {
      return [...labelIds];
    }

    return [...labelIds, labelId];
  }

  return labelIds.filter((currentLabelId) => currentLabelId !== labelId);
}

function countStudyNotesWithLabel(
  studyNotes: readonly Pick<AppStudyNote, "labelIds">[],
  labelId: string,
) {
  return studyNotes.filter((studyNote) => studyNote.labelIds.includes(labelId))
    .length;
}

function formatAffectedStudyNotesCount(count: number) {
  return `${count} active Study Note${count === 1 ? "" : "s"}`;
}

function removeLabelFromDraft(
  draft: UpdateStudyNoteInput,
  labelId: string,
): UpdateStudyNoteInput {
  return {
    ...draft,
    labelIds: setLabelIdSelection(draft.labelIds, labelId, false),
  };
}

function createSingleSupportDescriptionDraft(description: string) {
  if (description.trim().length === 0) {
    return [];
  }

  return [{ description }];
}

function createDraftReferenceId() {
  return globalThis.crypto.randomUUID();
}

function createEmptyKeyIdeaDraft(): AppStudyNoteKeyIdea {
  return {
    acceptedPhrases: [],
    id: createDraftReferenceId(),
    importance: "required",
    prohibitedPhrases: [],
    text: "",
  };
}

function createEmptyAnswerCheckTextReferenceDraft(): AppStudyNoteTextReference {
  return {
    id: createDraftReferenceId(),
    text: "",
  };
}

function parsePhraseListDraft(value: string) {
  return value
    .split("\n")
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 0);
}

function formatPhraseListDraft(phrases: readonly string[]) {
  return phrases.join("\n");
}

function readKeyIdeaImportance(value: string): StudyNoteKeyIdeaImportance {
  switch (value) {
    case "required":
      return "required";
    case "supporting":
      return "supporting";
    default:
      return "required";
  }
}

const STUDY_NOTE_EDITOR_FORM_ID = "study-note-editor-form";
const STUDY_NOTE_GUIDANCE_COPY = {
  acronymPlaceholder: "Initials that cue the answer.",
  expectedAnswerPlaceholder:
    "Explain the reason, steps, limits, and one example or non-example.",
  metaphorPlaceholder: "Compare it to something familiar.",
  prompt:
    "Ask why, how, when it works, when it does not, or what a worked example shows.",
  promptPlaceholder:
    "Why does this work? How would I use it? What example proves it?",
} as const;

type StudyNoteLearningLabels = {
  compact: string;
  due: string | null;
  practice: string | null;
};

type StudyNoteStatusKind = "attention" | "complete" | "neutral" | "practice";
type StudyNoteEditorTarget =
  | {
      studyNoteId: string;
      type: "study-note";
    }
  | {
      type: "new";
    };
type AnswerCheckTextReferenceField = "acceptedVariants" | "prohibitedPhrases";

type PracticeRepairMutationAction =
  | "complete"
  | "dismiss"
  | "edit"
  | "linked-action";
type SplitStudyNotePracticeRepairEntry =
  PracticeRepairEntryForIntent<"split-study-note">;
type PracticeRepairOriginSnapshot = {
  prompt: string;
  ratingLabel: string;
  sourceTitle: string;
};
type PracticeRepairEntryView = {
  entry: PracticeRepairEntry;
  origin: PracticeRepairOriginSnapshot | null;
};
type ActivePracticeRepairEntryReader = {
  listActivePracticeRepairEntriesForStudyNote(input: {
    studyNoteId: string;
    userId: string;
  }): PracticeRepairEntry[];
};
type PendingPracticeRepairMemoryAidAction = {
  memoryAidKind: PracticeRepairMemoryAidKind;
  reference: PracticeRepairQuestionReference;
} | null;
type PracticeRepairEntryViewInput = {
  sessionResults: readonly SessionResult[];
  studyNoteId: string | null;
};
type ActivePracticeRepairEntryViewInput = PracticeRepairEntryViewInput & {
  recallContext: ActivePracticeRepairEntryReader;
  userId: string | null;
};

type SaveBarInput = {
  isSaving: boolean;
  pendingEditorTarget: StudyNoteEditorTarget | null;
  saveStatus: string | null;
};
type SaveDraftOptions = {
  redirectAfterCreate: boolean;
};

const practiceRepairMutationActions = [
  "edit",
  "linked-action",
  "complete",
  "dismiss",
] as const satisfies readonly PracticeRepairMutationAction[];

function getEditorTargetRouteTarget(
  target: StudyNoteEditorTarget,
): StudyNotesRouteTarget {
  switch (target.type) {
    case "new":
      return {
        to: appRoutePaths.studyNotesNew,
      };
    case "study-note":
      return {
        params: {
          studyNoteId: target.studyNoteId,
        },
        to: appRoutePaths.studyNoteEditor,
      };
  }
}

const selectedStudyNoteDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function getSaveBarStatusText({
  isSaving,
  pendingEditorTarget,
  saveStatus,
}: SaveBarInput) {
  if (isSaving) {
    return "Saving changes...";
  }

  if (pendingEditorTarget === null) {
    return saveStatus ?? "You have unsaved changes.";
  }

  switch (pendingEditorTarget.type) {
    case "new":
      return "Save or discard changes before starting a new Study Note";
    case "study-note":
      return "Save or discard changes before switching Study Notes";
  }
}

function getSaveBarPrimaryAction(pendingEditorTarget: StudyNoteEditorTarget) {
  switch (pendingEditorTarget.type) {
    case "new":
      return "Save and start new";
    case "study-note":
      return "Save and switch";
  }
}

function getSaveBarDiscardAction(pendingEditorTarget: StudyNoteEditorTarget) {
  switch (pendingEditorTarget.type) {
    case "new":
      return "Discard and start new";
    case "study-note":
      return "Discard and switch";
  }
}

const DISCARD_STUDY_NOTE_CHANGES_MESSAGE =
  "Discard unsaved changes and leave this Study Note?";
const CANCEL_STUDY_NOTE_EDITOR_MESSAGE =
  "Discard unsaved changes and return to Study Notes?";
const DETACHED_SHARED_SOURCE_SAVE_MESSAGE =
  "Saved. Reference explanation is now independent from the shared source.";

function confirmDiscardStudyNoteChanges() {
  return window.confirm(DISCARD_STUDY_NOTE_CHANGES_MESSAGE);
}

function confirmCancelStudyNoteEditor() {
  return window.confirm(CANCEL_STUDY_NOTE_EDITOR_MESSAGE);
}

function getDeleteStudyNoteConfirmationMessage(hasSiblingStudyNotes: boolean) {
  if (hasSiblingStudyNotes) {
    return "Delete this Study Note only? Sibling Study Notes will keep the shared Reference explanation.";
  }

  return "Delete this last Study Note? The linked Reference explanation will also be deleted.";
}

function getSharedSourceReferenceGuidance(input: {
  sourceDisplayLabel: string;
  studyNoteCount: number;
}) {
  return [
    `Shared source: ${input.sourceDisplayLabel}.`,
    `${input.studyNoteCount} Study Notes use this Reference explanation.`,
    "Saving changes here will make this Study Note independent.",
  ].join(" ");
}

function getUpdatedMemoryAidKind(input: {
  previousAcronym: string;
  previousMetaphor: string;
  savedAcronym: string;
  savedMetaphor: string;
}): PracticeRepairMemoryAidKind | null {
  if (
    input.savedAcronym.length > 0 &&
    input.savedAcronym !== input.previousAcronym
  ) {
    return "Acronym";
  }

  if (
    input.savedMetaphor.length > 0 &&
    input.savedMetaphor !== input.previousMetaphor
  ) {
    return "Metaphor";
  }

  return null;
}

function getStudyNoteStatusKind(
  learningState: StudyNoteLearningState | null,
): StudyNoteStatusKind {
  if (learningState === null || learningState.latestScore === null) {
    return "attention";
  }

  if (learningState.needsPractice) {
    return "practice";
  }

  if (learningState.dueForRecall) {
    return "complete";
  }

  return "neutral";
}

function formatRelativeUpdatedLabel(timestamp: string) {
  const updatedAt = new Date(timestamp).getTime();

  if (Number.isNaN(updatedAt)) {
    return "";
  }

  const elapsedMs = Date.now() - updatedAt;
  const dayMs = 24 * 60 * 60 * 1000;

  if (elapsedMs < 60 * 1000) {
    return "Just now";
  }

  if (elapsedMs < dayMs) {
    return "Today";
  }

  const days = Math.max(1, Math.round(elapsedMs / dayMs));

  if (days === 1) {
    return "1 day ago";
  }

  if (days <= 6) {
    return `${days} days ago`;
  }

  return selectedStudyNoteDateFormatter.format(new Date(timestamp));
}

function getPracticeRepairEntryKey(reference: PracticeRepairQuestionReference) {
  return [
    reference.sessionResultId,
    reference.questionResultId ?? reference.questionIndex.toString(),
  ].join(":");
}

function getPracticeRepairMutationKey(
  action: PracticeRepairMutationAction,
  reference: PracticeRepairQuestionReference,
) {
  return `${action}:${getPracticeRepairEntryKey(reference)}`;
}

function getPracticeRepairOriginPrompt(question: RecallQuestion) {
  const prompt = (
    question.noteSnapshot.prompt ?? question.noteSnapshot.title
  ).trim();

  if (prompt.length > 0) {
    return prompt;
  }

  return question.noteSnapshot.body;
}

function getPracticeRepairOriginSourceTitle(question: RecallQuestion) {
  const displayName = question.noteSnapshot.source?.displayName?.trim();

  if (displayName !== undefined && displayName.length > 0) {
    return displayName;
  }

  const sourceTitle = question.noteSnapshot.source?.title.trim() ?? "";

  if (sourceTitle.length > 0) {
    return sourceTitle;
  }

  const prompt = question.noteSnapshot.prompt?.trim() ?? "";

  if (prompt.length > 0) {
    return prompt;
  }

  const noteTitle = question.noteSnapshot.title.trim();

  if (noteTitle.length > 0) {
    return noteTitle;
  }

  return "Untitled source";
}

function getPracticeRepairOriginSnapshot(input: {
  entry: PracticeRepairEntry;
  sessionResults: readonly SessionResult[];
}): PracticeRepairOriginSnapshot | null {
  const result = input.sessionResults.find(
    (candidate) => candidate.id === input.entry.reference.sessionResultId,
  );

  if (result === undefined) {
    return null;
  }

  const question = resolveSessionResultQuestion({
    reference: input.entry.reference,
    result,
  });

  if (question === null) {
    return null;
  }

  return {
    prompt: getPracticeRepairOriginPrompt(question),
    ratingLabel: formatRecallSelfRatingResultLabel(question.selfRating),
    sourceTitle: getPracticeRepairOriginSourceTitle(question),
  };
}

function getActivePracticeRepairEntryViews({
  recallContext,
  sessionResults,
  studyNoteId,
  userId,
}: ActivePracticeRepairEntryViewInput): PracticeRepairEntryView[] {
  if (studyNoteId === null || userId === null || sessionResults.length === 0) {
    return [];
  }

  return recallContext
    .listActivePracticeRepairEntriesForStudyNote({
      studyNoteId,
      userId,
    })
    .map((entry) => ({
      entry,
      origin: getPracticeRepairOriginSnapshot({
        entry,
        sessionResults,
      }),
    }));
}

function getActionablePracticeFollowUpEntryViews({
  sessionResults,
  studyNoteId,
}: PracticeRepairEntryViewInput): PracticeRepairEntryView[] {
  if (studyNoteId === null || sessionResults.length === 0) {
    return [];
  }

  return listActionablePracticeFollowUpsForStudyNote({
    results: sessionResults,
    studyNoteId,
  }).map((entry) => ({
    entry,
    origin: getPracticeRepairOriginSnapshot({
      entry,
      sessionResults,
    }),
  }));
}

function getStudyNoteLabelNames(
  labels: readonly AppLabel[],
  labelIds: readonly string[],
) {
  const attachedLabels = getAttachedLabels(labels, labelIds);

  if (attachedLabels.length === 0) {
    return ["General"];
  }

  return attachedLabels.map((label) => label.name);
}

function getSupportDescriptionValue(
  supportDescriptions: readonly { description: string }[],
) {
  return supportDescriptions[0]?.description ?? "";
}

function getSupportDescriptionValueByKind(input: {
  memoryAidKind: PracticeRepairMemoryAidKind;
  studyNote: AppStudyNote;
}) {
  return input.memoryAidKind === "Metaphor"
    ? getSupportDescriptionValue(input.studyNote.metaphors)
    : getSupportDescriptionValue(input.studyNote.acronyms);
}

function getPracticeRepairMemoryAidReference(input: {
  memoryAidKind: PracticeRepairMemoryAidKind;
  studyNoteId: string;
}) {
  return `${input.studyNoteId}:${input.memoryAidKind.toLowerCase()}`;
}

function findSplitStudyNotePracticeRepairEntry(
  entries: readonly PracticeRepairEntryView[],
): SplitStudyNotePracticeRepairEntry | null {
  for (const { entry } of entries) {
    if (isPracticeRepairEntryForIntent(entry, "split-study-note")) {
      return entry;
    }
  }

  return null;
}

function formatSplitTargetCreatedStatus(
  entry: SplitStudyNotePracticeRepairEntry,
) {
  return entry.intentMetadata.narrowedOriginalStudyNoteAt === null
    ? "Split target created. Narrow the original Study Note and save changes to complete Practice Repair."
    : "Practice Repair completed";
}

function formatOriginalNarrowedStatus(
  entry: SplitStudyNotePracticeRepairEntry,
) {
  return entry.intentMetadata.createdStudyNoteIds.length === 0
    ? "Original narrowed. Create a split target to complete Practice Repair."
    : "Practice Repair completed";
}

function getLinkedPracticeRepairReturnTarget(
  linkedPracticeRepair: LinkedPracticeRepairContext,
) {
  return {
    params: {
      practiceRepairEntryId: linkedPracticeRepair.practiceRepairEntryId,
    },
    to: "/practice-repair/$practiceRepairEntryId" as const,
  };
}

function formatLinkedPracticeRepairSummary(action: PracticeRepairIntent) {
  switch (action) {
    case "tighten-prompt":
      return "Update the prompt here, then return to Practice Repair when the correction is ready.";
    case "tighten-expected-answer":
      return "Update the expected answer here, then return to Practice Repair when the correction is ready.";
    case "add-memory-aid":
      return "Add the missing memory aid here, then return to Practice Repair when the correction is ready.";
    case "split-study-note":
      return "Narrow the original Study Note or create the split target here, then return to Practice Repair.";
    case "create-sibling-study-note":
      return "Create the related sibling Study Note here, then return to Practice Repair when the correction is ready.";
  }
}

function formatSelectedNextRecall(input: {
  now: string;
  schedule: RecallSchedule | null;
  userTimeZone: string;
}) {
  const timing = formatNextRecallTiming({
    now: input.now,
    schedule: input.schedule,
    userTimeZone: input.userTimeZone,
  });

  if (timing === null) {
    return "On schedule";
  }

  if (timing === "Recall today") {
    return "Today";
  }

  if (timing === "Next recall tomorrow") {
    return "Tomorrow";
  }

  return timing.replace(/^Next recall /, "");
}

function hasDraftReferenceContent(draft: UpdateStudyNoteInput) {
  return (
    draft.sourceTitle.trim().length > 0 || draft.sourceBody.trim().length > 0
  );
}

function hasDraftAnswerCheckContent(draft: UpdateStudyNoteInput) {
  return (
    draft.keyIdeas.some(
      (keyIdea) =>
        keyIdea.text.trim().length > 0 ||
        keyIdea.acceptedPhrases.length > 0 ||
        keyIdea.prohibitedPhrases.length > 0,
    ) ||
    draft.acceptedVariants.some((variant) => variant.text.trim().length > 0) ||
    draft.prohibitedPhrases.some((phrase) => phrase.text.trim().length > 0)
  );
}

function hasDraftMemoryAidContent(draft: UpdateStudyNoteInput) {
  return [...draft.metaphors, ...draft.acronyms].some(
    (supportDescription) => supportDescription.description.trim().length > 0,
  );
}

function getStudyNoteLearningLabels(
  learningState: StudyNoteLearningState,
): StudyNoteLearningLabels {
  return {
    compact: formatStudyNoteLearningStateCompactLabel(learningState),
    due: formatStudyNoteDueLabel(learningState),
    practice: formatStudyNotePracticeSignalLabel(learningState),
  };
}

function getAttachedLabels(
  labels: readonly AppLabel[],
  labelIds: readonly string[],
) {
  const attachedLabelIds = new Set(labelIds);

  return labels.filter((label) => attachedLabelIds.has(label.id));
}

function PracticeRepairOriginDetails({
  origin,
}: Readonly<{
  origin: PracticeRepairOriginSnapshot | null;
}>) {
  return (
    <div className="study-notes-practice-repair-entry__origin">
      <span className="study-notes-editor__group-label">Results origin</span>
      {origin === null ? (
        <p className="study-notes-practice-repair-entry__origin-fallback">
          Results snapshot unavailable.
        </p>
      ) : (
        <dl className="study-notes-practice-repair-entry__origin-list">
          <div>
            <dt>Weak recall</dt>
            <dd>{origin.ratingLabel}</dd>
          </div>
          <div>
            <dt>Prompt snapshot</dt>
            <dd>{origin.prompt}</dd>
          </div>
          <div>
            <dt>Source snapshot</dt>
            <dd>{origin.sourceTitle}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

const ANSWER_CHECK_TEXT_REFERENCE_COPY = {
  acceptedVariants: {
    addLabel: "Add Accepted Variant",
    emptyLabel: "No Accepted Variants yet.",
    itemLabel: "Accepted Variant",
    placeholder: "A full alternative answer.",
    summary: "Save full-answer alternatives the User has explicitly approved.",
    title: "Accepted Variants",
  },
  prohibitedPhrases: {
    addLabel: "Add Prohibited Phrase",
    emptyLabel: "No Prohibited Phrases yet.",
    itemLabel: "Prohibited Phrase",
    placeholder: "Wrong wording that should not pass.",
    summary:
      "Add wording that should block likely-correct guidance for the whole Study Note.",
    title: "Prohibited Phrases",
  },
} as const satisfies Record<
  AnswerCheckTextReferenceField,
  {
    addLabel: string;
    emptyLabel: string;
    itemLabel: string;
    placeholder: string;
    summary: string;
    title: string;
  }
>;

function StudyNotesKeyIdeasEditor({
  keyIdeas,
  onAdd,
  onRemove,
  onUpdate,
}: Readonly<{
  keyIdeas: readonly AppStudyNoteKeyIdea[];
  onAdd: () => void;
  onRemove: (keyIdeaId: string) => void;
  onUpdate: (
    keyIdeaId: string,
    updater: (keyIdea: AppStudyNoteKeyIdea) => AppStudyNoteKeyIdea,
  ) => void;
}>) {
  return (
    <div className="study-notes-answer-check__section">
      <div className="study-notes-answer-check__section-header">
        <div>
          <span className="study-notes-editor__group-label">Key Ideas</span>
          <p className="study-notes-editor__summary-copy">
            Add the concepts the User expects to recall. The normal flow needs
            only the idea and whether it is required or supporting.
          </p>
        </div>
        <Button
          onClick={onAdd}
          size="compact"
          type="button"
          variant="secondary"
        >
          <PlusIcon />
          <span>Add Key Idea</span>
        </Button>
      </div>
      {keyIdeas.length === 0 ? (
        <p className="muted study-notes-answer-check__empty">
          No Key Ideas yet.
        </p>
      ) : (
        <div className="study-notes-answer-check__items">
          {keyIdeas.map((keyIdea) => (
            <article
              className="study-notes-answer-check__item"
              key={keyIdea.id}
            >
              <div className="study-notes-answer-check__item-toolbar">
                <label className="study-notes-answer-check__importance">
                  <span className="study-notes-field__label">Importance</span>
                  <select
                    aria-label="Importance"
                    onChange={(event) =>
                      onUpdate(keyIdea.id, (current) => ({
                        ...current,
                        importance: readKeyIdeaImportance(event.target.value),
                      }))
                    }
                    value={keyIdea.importance}
                  >
                    <option value="required">Required</option>
                    <option value="supporting">Supporting</option>
                  </select>
                </label>
                <Button
                  onClick={() => onRemove(keyIdea.id)}
                  size="compact"
                  type="button"
                  variant="danger"
                >
                  <span>Remove Key Idea</span>
                </Button>
              </div>
              <StudyNotesTextarea
                label="Key Idea"
                maxLength={400}
                onChange={(event) =>
                  onUpdate(keyIdea.id, (current) => ({
                    ...current,
                    text: event.target.value,
                  }))
                }
                placeholder="What must the answer clearly cover?"
                rows={2}
                value={keyIdea.text}
              />
              <details className="study-notes-answer-check__advanced">
                <summary>Advanced phrase rules</summary>
                <div className="study-notes-answer-check__advanced-fields">
                  <StudyNotesTextarea
                    label="Accepted phrases"
                    maxLength={500}
                    onChange={(event) =>
                      onUpdate(keyIdea.id, (current) => ({
                        ...current,
                        acceptedPhrases: parsePhraseListDraft(
                          event.target.value,
                        ),
                      }))
                    }
                    optional
                    placeholder="One phrase per line."
                    rows={2}
                    value={formatPhraseListDraft(keyIdea.acceptedPhrases)}
                  />
                  <StudyNotesTextarea
                    label="Prohibited phrases"
                    maxLength={500}
                    onChange={(event) =>
                      onUpdate(keyIdea.id, (current) => ({
                        ...current,
                        prohibitedPhrases: parsePhraseListDraft(
                          event.target.value,
                        ),
                      }))
                    }
                    optional
                    placeholder="One phrase per line."
                    rows={2}
                    value={formatPhraseListDraft(keyIdea.prohibitedPhrases)}
                  />
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function StudyNotesAnswerCheckTextReferenceEditor({
  field,
  onAdd,
  onRemove,
  onUpdate,
  references,
}: Readonly<{
  field: AnswerCheckTextReferenceField;
  onAdd: (field: AnswerCheckTextReferenceField) => void;
  onRemove: (field: AnswerCheckTextReferenceField, referenceId: string) => void;
  onUpdate: (
    field: AnswerCheckTextReferenceField,
    referenceId: string,
    text: string,
  ) => void;
  references: readonly AppStudyNoteTextReference[];
}>) {
  const copy = ANSWER_CHECK_TEXT_REFERENCE_COPY[field];

  return (
    <div className="study-notes-answer-check__section">
      <div className="study-notes-answer-check__section-header">
        <div>
          <span className="study-notes-editor__group-label">{copy.title}</span>
          <p className="study-notes-editor__summary-copy">{copy.summary}</p>
        </div>
        <Button
          onClick={() => onAdd(field)}
          size="compact"
          type="button"
          variant="secondary"
        >
          <PlusIcon />
          <span>{copy.addLabel}</span>
        </Button>
      </div>
      {references.length === 0 ? (
        <p className="muted study-notes-answer-check__empty">
          {copy.emptyLabel}
        </p>
      ) : (
        <div className="study-notes-answer-check__items">
          {references.map((reference) => (
            <article
              className="study-notes-answer-check__item"
              key={reference.id}
            >
              <div className="study-notes-answer-check__item-toolbar">
                <span className="study-notes-editor__group-label">
                  {copy.itemLabel}
                </span>
                <Button
                  onClick={() => onRemove(field, reference.id)}
                  size="compact"
                  type="button"
                  variant="danger"
                >
                  <span>Remove {copy.itemLabel}</span>
                </Button>
              </div>
              <StudyNotesTextarea
                label={copy.itemLabel}
                maxLength={500}
                onChange={(event) =>
                  onUpdate(field, reference.id, event.target.value)
                }
                placeholder={copy.placeholder}
                rows={2}
                value={reference.text}
              />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function StudyNotesAnswerCheckEditor({
  feedbackMessage,
  draft,
  hasContent,
  hasPendingSuggestions,
  isOpen,
  onDiscardSuggestions,
  onInferSuggestions,
  onAddKeyIdea,
  onAddTextReference,
  onRemoveKeyIdea,
  onRemoveTextReference,
  onToggle,
  onUpdateKeyIdea,
  onUpdateTextReference,
  selectedDisclosureKey,
}: Readonly<{
  feedbackMessage: string | null;
  draft: UpdateStudyNoteInput;
  hasContent: boolean;
  hasPendingSuggestions: boolean;
  isOpen: boolean;
  onDiscardSuggestions: () => void;
  onInferSuggestions: () => void;
  onAddKeyIdea: () => void;
  onAddTextReference: (field: AnswerCheckTextReferenceField) => void;
  onRemoveKeyIdea: (keyIdeaId: string) => void;
  onRemoveTextReference: (
    field: AnswerCheckTextReferenceField,
    referenceId: string,
  ) => void;
  onToggle: (isOpen: boolean) => void;
  onUpdateKeyIdea: (
    keyIdeaId: string,
    updater: (keyIdea: AppStudyNoteKeyIdea) => AppStudyNoteKeyIdea,
  ) => void;
  onUpdateTextReference: (
    field: AnswerCheckTextReferenceField,
    referenceId: string,
    text: string,
  ) => void;
  selectedDisclosureKey: string;
}>) {
  return (
    <section
      aria-label="Answer-check reference material"
      className="study-notes-editor__answer-check study-notes-editor__info-section"
    >
      <details
        className="study-notes-editor__disclosure"
        key={`answer-check-${selectedDisclosureKey}`}
        onToggle={(event) => onToggle(event.currentTarget.open)}
        open={isOpen}
      >
        <summary className="study-notes-editor__disclosure-summary">
          <span>
            <span className="study-notes-editor__group-label">
              Answer-check reference material
            </span>
            <span className="study-notes-editor__summary-copy">
              {hasContent
                ? "Reference material ready"
                : "Optional guidance for Answer Check"}
            </span>
          </span>
          <ChevronDownIcon />
        </summary>
        <div className="study-notes-editor__disclosure-body">
          <div className="study-notes-answer-check__suggestion-toolbar">
            <div className="study-notes-answer-check__suggestion-actions">
              <Button
                onClick={onInferSuggestions}
                size="compact"
                type="button"
                variant="secondary"
              >
                <SparklesIcon />
                <span>Infer suggestions</span>
              </Button>
              {!hasPendingSuggestions ? null : (
                <Button
                  onClick={onDiscardSuggestions}
                  size="compact"
                  type="button"
                  variant="secondary"
                >
                  <span>Discard suggestions</span>
                </Button>
              )}
            </div>
            {feedbackMessage === null ? null : (
              <p
                className="study-notes-answer-check__suggestion-feedback"
                role="status"
              >
                {feedbackMessage}
              </p>
            )}
          </div>
          <StudyNotesKeyIdeasEditor
            keyIdeas={draft.keyIdeas}
            onAdd={onAddKeyIdea}
            onRemove={onRemoveKeyIdea}
            onUpdate={onUpdateKeyIdea}
          />
          <StudyNotesAnswerCheckTextReferenceEditor
            field="acceptedVariants"
            onAdd={onAddTextReference}
            onRemove={onRemoveTextReference}
            onUpdate={onUpdateTextReference}
            references={draft.acceptedVariants}
          />
          <StudyNotesAnswerCheckTextReferenceEditor
            field="prohibitedPhrases"
            onAdd={onAddTextReference}
            onRemove={onRemoveTextReference}
            onUpdate={onUpdateTextReference}
            references={draft.prohibitedPhrases}
          />
        </div>
      </details>
    </section>
  );
}

export function StudyNotesPage({
  routeMode,
  search,
}: {
  routeMode: StudyNotesRouteMode;
  search: StudyNotesSearch;
}) {
  const navigate = useNavigate();
  const routeKind = routeMode.kind;
  const routeStudyNoteId = getRouteStudyNoteId(routeMode);
  const studyNotesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.studyNotes,
  });
  const persistentStudyNotesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentStudyNotes,
  });
  const labelsContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.labels,
  });
  const persistentLabelsContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentLabels,
  });
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const persistentRecallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentRecall,
  });
  const focusContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.focus,
  });
  const persistentFocusContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentFocus,
  });
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const userId = sessionSnapshot.user?.id ?? null;
  const now = new Date().toISOString();
  const userTimeZone =
    sessionSnapshot.user?.userTimeZone ?? defaultUserTimeZone;
  const showStudyNoteTemplates =
    sessionSnapshot.user?.showStudyNoteTemplates ??
    defaultShowStudyNoteTemplatesPreference;
  const studyNotesStore:
    | Pick<AppStudyNotesContext, "getSnapshot" | "subscribe">
    | Pick<AppPersistentStudyNotesContext, "getSnapshot" | "subscribe"> =
    persistentStudyNotesContext ?? studyNotesContext;
  const studyNotesSnapshot = useSyncExternalStore(
    studyNotesStore.subscribe,
    studyNotesStore.getSnapshot,
    studyNotesStore.getSnapshot,
  );
  const recallResultsSnapshot = useSyncExternalStore(
    recallContext.subscribe,
    recallContext.getSessionResultsSnapshot,
    recallContext.getSessionResultsSnapshot,
  );
  const recallSchedulesSnapshot = useSyncExternalStore(
    recallContext.subscribe,
    recallContext.getRecallSchedulesSnapshot,
    recallContext.getRecallSchedulesSnapshot,
  );
  const linkedPracticeRepair = useMemo(
    () =>
      findLinkedPracticeRepairContext({
        practiceRepairAction: search.practiceRepairAction,
        practiceRepairEntryId: search.practiceRepairEntryId,
        sessionResults: recallResultsSnapshot,
      }),
    [
      recallResultsSnapshot,
      search.practiceRepairAction,
      search.practiceRepairEntryId,
    ],
  );
  useSyncExternalStore(
    focusContext.subscribe,
    focusContext.getSnapshot,
    focusContext.getSnapshot,
  );
  const [availableLabels, setAvailableLabels] = useState<AppLabel[]>(() =>
    userId === null ? [] : labelsContext.getLabelsForUser(userId),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLabelId, setSelectedLabelId] = useState(
    () => search.labelId ?? "",
  );
  const [isStudyNotesCatalogExpanded, setStudyNotesCatalogExpanded] =
    useState(false);
  const [collapsedStudyNotesCount, setCollapsedStudyNotesCount] = useState(
    DEFAULT_COLLAPSED_STUDY_NOTES_COUNT,
  );
  const allStudyNotes = useMemo(
    () => listStudyNotesForUser(studyNotesSnapshot, userId),
    [studyNotesSnapshot, userId],
  );
  const labelFilteredStudyNotes = useMemo(
    () => filterStudyNotesBySelectedLabel(allStudyNotes, selectedLabelId),
    [allStudyNotes, selectedLabelId],
  );
  const studyNotes = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

    if (normalizedQuery.length === 0) {
      return labelFilteredStudyNotes;
    }

    return labelFilteredStudyNotes.filter((studyNote) => {
      const labelNames = getStudyNoteLabelNames(
        availableLabels,
        studyNote.labelIds,
      ).join(" ");
      const searchableText = [
        studyNote.prompt,
        studyNote.expectedAnswer,
        studyNote.source.title,
        studyNote.source.body,
        labelNames,
      ]
        .join(" ")
        .toLocaleLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [availableLabels, labelFilteredStudyNotes, searchQuery]);
  const hiddenStudyNotesCount = Math.max(
    studyNotes.length - collapsedStudyNotesCount,
    0,
  );
  const isStudyNotesCatalogExpandable = hiddenStudyNotesCount > 0;
  const visibleStudyNotes = isStudyNotesCatalogExpanded
    ? studyNotes
    : studyNotes.slice(0, collapsedStudyNotesCount);
  const recallAttemptsByNote = useMemo(
    () =>
      userId === null || recallResultsSnapshot.length === 0
        ? []
        : recallContext.listAttemptsByNote({ userId }),
    [recallContext, recallResultsSnapshot, userId],
  );
  const recallHistories = useMemo(
    () => toStudyNoteRecallHistories(recallAttemptsByNote),
    [recallAttemptsByNote],
  );
  const recallGuidanceEntries = useMemo(
    () =>
      deriveRecallGuidance({
        attemptsByNote: recallAttemptsByNote,
        now,
        recallSchedules: recallSchedulesSnapshot,
        sessionResults: recallResultsSnapshot,
        studyNotes: allStudyNotes,
        userTimeZone,
      }),
    [
      allStudyNotes,
      now,
      recallAttemptsByNote,
      recallResultsSnapshot,
      recallSchedulesSnapshot,
      userTimeZone,
    ],
  );
  const learningStates = useMemo(
    () =>
      deriveStudyNoteLearningStates({
        histories: recallHistories,
        now,
        recallSchedules: recallSchedulesSnapshot,
        studyNotes,
      }),
    [now, recallHistories, recallSchedulesSnapshot, studyNotes],
  );
  const recallTodayQueue = useMemo(() => {
    if (userId === null) {
      return [];
    }

    return planRecallWork({
      histories: recallHistories,
      now,
      recallSchedules: recallSchedulesSnapshot,
      sessionResults: recallResultsSnapshot,
      studyNotes: allStudyNotes,
      userTimeZone,
    }).recallTodayQueue;
  }, [
    allStudyNotes,
    now,
    recallHistories,
    recallResultsSnapshot,
    recallSchedulesSnapshot,
    userId,
    userTimeZone,
  ]);
  const recallTodayStudyNoteIds = useMemo(
    () => recallTodayQueue.map((queueItem) => queueItem.studyNote.id),
    [recallTodayQueue],
  );
  const recallScheduleByStudyNoteId = useMemo(
    () =>
      new Map(
        recallSchedulesSnapshot.map((recallSchedule) => [
          recallSchedule.studyNoteId,
          recallSchedule,
        ]),
      ),
    [recallSchedulesSnapshot],
  );
  const learningStateByStudyNoteId = useMemo(
    () =>
      new Map(
        learningStates.map((learningState) => [
          learningState.studyNoteId,
          learningState,
        ]),
      ),
    [learningStates],
  );
  const recallGuidanceByStudyNoteId = useMemo(
    () =>
      new Map(
        recallGuidanceEntries.map((entry) => [entry.studyNote.id, entry]),
      ),
    [recallGuidanceEntries],
  );
  const [selectedStudyNoteId, setSelectedStudyNoteId] = useState<string | null>(
    getInitialSelectedStudyNoteId({
      routeMode,
      studyNotes,
    }),
  );
  const [appliedLinkedPracticeRepairKey, setAppliedLinkedPracticeRepairKey] =
    useState<string | null>(null);
  const [isCreatingStudyNote, setCreatingStudyNote] = useState(
    () => routeKind === "create",
  );
  const matchedSelectedStudyNote = findStudyNoteById(
    studyNotes,
    selectedStudyNoteId,
  );
  const isMissingSelectedStudyNote =
    routeKind === "edit" &&
    !isCreatingStudyNote &&
    routeStudyNoteId !== null &&
    matchedSelectedStudyNote === null;
  const selectedStudyNote = getSelectedStudyNote({
    isCreatingStudyNote,
    matchedSelectedStudyNote,
    routeKind,
    studyNotes,
  });
  const selectedDisclosureKey =
    selectedStudyNote?.id ?? (isCreatingStudyNote ? "new" : "empty");
  const selectedSourceStudyNotes =
    selectedStudyNote === null
      ? []
      : allStudyNotes.filter(
          (studyNote) =>
            studyNote.sourceNoteId === selectedStudyNote.sourceNoteId,
        );
  const selectedLearningState =
    selectedStudyNote === null
      ? null
      : (learningStateByStudyNoteId.get(selectedStudyNote.id) ?? null);
  const selectedRecallSchedule =
    selectedStudyNote === null
      ? null
      : (recallScheduleByStudyNoteId.get(selectedStudyNote.id) ?? null);
  const selectedRecallGuidance =
    selectedStudyNote === null
      ? null
      : (recallGuidanceByStudyNoteId.get(selectedStudyNote.id) ?? null);
  const selectedPracticeRepairStudyNoteId = selectedStudyNote?.id ?? null;
  const activePracticeRepairEntries = useMemo<PracticeRepairEntryView[]>(
    () =>
      getActivePracticeRepairEntryViews({
        recallContext,
        sessionResults: recallResultsSnapshot,
        studyNoteId: selectedPracticeRepairStudyNoteId,
        userId,
      }),
    [
      recallContext,
      recallResultsSnapshot,
      selectedPracticeRepairStudyNoteId,
      userId,
    ],
  );
  const actionablePracticeFollowUps = useMemo<PracticeRepairEntryView[]>(
    () =>
      getActionablePracticeFollowUpEntryViews({
        sessionResults: recallResultsSnapshot,
        studyNoteId: selectedPracticeRepairStudyNoteId,
      }),
    [recallResultsSnapshot, selectedPracticeRepairStudyNoteId],
  );
  const practiceRepair = useMemo(
    () =>
      actionablePracticeFollowUps.length > 0
        ? null
        : getStudyNotePracticeRepair(selectedLearningState),
    [actionablePracticeFollowUps.length, selectedLearningState],
  );
  const interleavedRecallRecommendation = useMemo(
    () =>
      getInterleavedRecallRecommendation({
        histories: recallHistories,
        studyNote: selectedStudyNote,
        studyNotes: allStudyNotes,
      }),
    [allStudyNotes, recallHistories, selectedStudyNote],
  );
  const [draft, setDraft] = useState<UpdateStudyNoteInput>(() =>
    createDraftFromStudyNote(selectedStudyNote),
  );
  const selectedLabels = getAttachedLabels(availableLabels, draft.labelIds);
  const promptInputRef = useRef<HTMLInputElement>(null);
  const expectedAnswerInputRef = useRef<HTMLTextAreaElement>(null);
  const metaphorInputRef = useRef<HTMLTextAreaElement>(null);
  const acronymInputRef = useRef<HTMLInputElement>(null);
  const labelManagerRef = useRef<HTMLDivElement>(null);
  const pendingDraftLabelRemovalRef = useRef<{
    labelId: string;
    studyNoteId: string;
  } | null>(null);
  const studyNotesCatalogListRef = useRef<HTMLElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [practiceRepairMutationKey, setPracticeRepairMutationKey] = useState<
    string | null
  >(null);
  const [practiceRepairCorrectionDrafts, setPracticeRepairCorrectionDrafts] =
    useState<Record<string, string>>({});
  const [
    pendingPracticeRepairMemoryAidAction,
    setPendingPracticeRepairMemoryAidAction,
  ] = useState<PendingPracticeRepairMemoryAidAction>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const [pendingEditorTarget, setPendingEditorTarget] =
    useState<StudyNoteEditorTarget | null>(null);
  const [isNewDiscardDialogOpen, setNewDiscardDialogOpen] = useState(false);
  const [isAnswerCheckOpenOverride, setAnswerCheckOpenOverride] = useState<
    boolean | null
  >(null);
  const [isReferenceOpenOverride, setReferenceOpenOverride] = useState<
    boolean | null
  >(null);
  const [isMemoryAidsOpenOverride, setMemoryAidsOpenOverride] = useState<
    boolean | null
  >(null);
  const [isLabelManagerOpen, setLabelManagerOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [isCreatingLabel, setCreatingLabel] = useState(false);
  const [answerCheckSuggestionFeedback, setAnswerCheckSuggestionFeedback] =
    useState<string | null>(null);
  const [answerCheckSuggestionSession, setAnswerCheckSuggestionSession] =
    useState<AnswerCheckSuggestionSession | null>(null);
  const clearAnswerCheckSuggestionState = useCallback(() => {
    setAnswerCheckSuggestionFeedback(null);
    setAnswerCheckSuggestionSession(null);
  }, []);
  const storeMutation = persistentStudyNotesContext ?? studyNotesContext;
  const currentStudyNotesRouteTarget = useMemo(
    () =>
      getStudyNotesRouteTarget({
        routeKind,
        routeStudyNoteId,
      }),
    [routeKind, routeStudyNoteId],
  );
  const hasDraftChanges = !areStudyNoteDraftsEqual(
    draft,
    createDraftFromStudyNote(selectedStudyNote),
  );
  const isSaveBarVisible =
    hasDraftChanges || isSaving || pendingEditorTarget !== null;

  useBlocker({
    disabled: !hasDraftChanges || isSaving,
    enableBeforeUnload: hasDraftChanges && !isSaving,
    shouldBlockFn: () => !confirmDiscardStudyNoteChanges(),
  });

  useEffect(() => {
    if (persistentStudyNotesContext === undefined) {
      return;
    }

    void persistentStudyNotesContext.refresh(userId).catch((error: unknown) => {
      if (error instanceof AppStudyNotesError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    });
  }, [persistentStudyNotesContext, userId]);

  useEffect(() => {
    function syncLabels() {
      if (userId === null) {
        setAvailableLabels([]);
        return;
      }

      setAvailableLabels(labelsContext.getLabelsForUser(userId));
    }

    syncLabels();

    return labelsContext.subscribe(syncLabels);
  }, [labelsContext, userId]);

  useEffect(() => {
    setSelectedLabelId(search.labelId ?? "");
  }, [search.labelId]);

  useEffect(() => {
    if (
      selectedLabelId === "" ||
      isUnlabeledStudyNotesFilterValue(selectedLabelId) ||
      availableLabels.some((label) => label.id === selectedLabelId)
    ) {
      return;
    }

    void navigate({
      ...currentStudyNotesRouteTarget,
      replace: true,
      search: (previousSearch) => ({
        ...previousSearch,
        labelId: undefined,
      }),
    });
  }, [
    availableLabels,
    currentStudyNotesRouteTarget,
    navigate,
    selectedLabelId,
  ]);

  useEffect(() => {
    const listElement = studyNotesCatalogListRef.current;

    if (listElement === null || studyNotes.length === 0) {
      setCollapsedStudyNotesCount(DEFAULT_COLLAPSED_STUDY_NOTES_COUNT);
      return;
    }

    let animationFrameId = 0;

    function measureCollapsedStudyNotesCount() {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(() => {
        const currentListElement = studyNotesCatalogListRef.current;

        if (currentListElement === null) {
          return;
        }

        const rowElement =
          currentListElement.querySelector<HTMLElement>(".study-note-row");

        if (rowElement === null) {
          return;
        }

        const rowContainer = rowElement.closest("li");
        const rowHeight =
          rowContainer?.getBoundingClientRect().height ??
          rowElement.getBoundingClientRect().height;

        if (rowHeight <= 0) {
          return;
        }

        const measuredCount = Math.max(
          1,
          Math.floor(currentListElement.clientHeight / rowHeight),
        );
        const nextCount = Math.min(studyNotes.length, measuredCount);

        setCollapsedStudyNotesCount((currentCount) =>
          currentCount === nextCount ? currentCount : nextCount,
        );
      });
    }

    measureCollapsedStudyNotesCount();
    window.addEventListener("resize", measureCollapsedStudyNotesCount);

    const ResizeObserverConstructor = window.ResizeObserver;

    if (typeof ResizeObserverConstructor !== "function") {
      return () => {
        window.cancelAnimationFrame(animationFrameId);
        window.removeEventListener("resize", measureCollapsedStudyNotesCount);
      };
    }

    const resizeObserver = new ResizeObserverConstructor(
      measureCollapsedStudyNotesCount,
    );
    resizeObserver.observe(listElement);

    const firstRowElement =
      listElement.querySelector<HTMLElement>(".study-note-row");

    if (firstRowElement !== null) {
      resizeObserver.observe(firstRowElement);
    }
    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureCollapsedStudyNotesCount);
    };
  }, [studyNotes.length]);

  useEffect(() => {
    if (routeKind === "workspace") {
      return;
    }

    if (routeKind === "create") {
      setCreatingStudyNote(true);
      setSelectedStudyNoteId(null);
      return;
    }

    setCreatingStudyNote(false);
    setSelectedStudyNoteId(routeStudyNoteId);
  }, [routeKind, routeStudyNoteId]);

  useEffect(() => {
    if (isCreatingStudyNote) {
      return;
    }

    if (routeKind !== "workspace") {
      return;
    }

    if (
      selectedStudyNoteId !== null &&
      studyNotes.some((studyNote) => studyNote.id === selectedStudyNoteId)
    ) {
      return;
    }

    setSelectedStudyNoteId(studyNotes[0]?.id ?? null);
  }, [isCreatingStudyNote, routeKind, selectedStudyNoteId, studyNotes]);

  useEffect(() => {
    if (routeKind !== "workspace") {
      return;
    }

    if (linkedPracticeRepair === null) {
      return;
    }

    const nextLinkedPracticeRepairKey =
      getLinkedPracticeRepairKey(linkedPracticeRepair);

    if (appliedLinkedPracticeRepairKey === nextLinkedPracticeRepairKey) {
      return;
    }

    setCreatingStudyNote(false);
    setSelectedStudyNoteId(linkedPracticeRepair.entry.reference.studyNoteId);
    setAppliedLinkedPracticeRepairKey(nextLinkedPracticeRepairKey);
  }, [appliedLinkedPracticeRepairKey, linkedPracticeRepair, routeKind]);

  useEffect(() => {
    const pendingDraftLabelRemoval = pendingDraftLabelRemovalRef.current;

    if (
      pendingDraftLabelRemoval !== null &&
      selectedStudyNote?.id === pendingDraftLabelRemoval.studyNoteId
    ) {
      pendingDraftLabelRemovalRef.current = null;
      setDraft((current) =>
        removeLabelFromDraft(current, pendingDraftLabelRemoval.labelId),
      );
      setPendingEditorTarget(null);
      setPendingPracticeRepairMemoryAidAction(null);
      return;
    }

    const nextDraft = createDraftFromStudyNote(selectedStudyNote);

    setDraft(nextDraft);
    setPendingEditorTarget(null);
    setPendingPracticeRepairMemoryAidAction(null);
  }, [selectedStudyNote]);

  useEffect(() => {
    if (selectedDisclosureKey.length === 0) {
      return;
    }

    clearAnswerCheckSuggestionState();
    setAnswerCheckOpenOverride(null);
    setReferenceOpenOverride(null);
    setMemoryAidsOpenOverride(null);
    setLabelManagerOpen(false);
    setNewLabelName("");
  }, [clearAnswerCheckSuggestionState, selectedDisclosureKey]);

  useEffect(() => {
    if (
      linkedPracticeRepair?.action !== "add-memory-aid" ||
      selectedStudyNote?.id !== linkedPracticeRepair.entry.reference.studyNoteId
    ) {
      return;
    }

    setMemoryAidsOpenOverride(true);
  }, [linkedPracticeRepair, selectedStudyNote?.id]);

  useEffect(() => {
    if (
      linkedPracticeRepair === null ||
      selectedStudyNote?.id !== linkedPracticeRepair.entry.reference.studyNoteId
    ) {
      return;
    }

    if (linkedPracticeRepair.action === "tighten-prompt") {
      promptInputRef.current?.focus();
      return;
    }

    if (linkedPracticeRepair.action === "tighten-expected-answer") {
      expectedAnswerInputRef.current?.focus();
    }
  }, [linkedPracticeRepair, selectedStudyNote?.id]);

  useEffect(() => {
    const targetStudyNoteId = getTargetStudyNoteId({
      routeKind,
      routeStudyNoteId,
      searchStudyNoteId: search.studyNoteId,
    });

    if (targetStudyNoteId === null) {
      return;
    }

    if (
      !allStudyNotes.some((studyNote) => studyNote.id === targetStudyNoteId)
    ) {
      return;
    }

    if (isCreatingStudyNote) {
      setCreatingStudyNote(false);
    }

    if (selectedStudyNote?.id !== targetStudyNoteId) {
      setSelectedStudyNoteId(targetStudyNoteId);
      return;
    }

    if (search.focus === "expected-answer") {
      expectedAnswerInputRef.current?.focus();
    }
  }, [
    allStudyNotes,
    isCreatingStudyNote,
    routeKind,
    routeStudyNoteId,
    search.focus,
    search.studyNoteId,
    selectedStudyNote?.id,
  ]);

  useEffect(() => {
    if (
      linkedPracticeRepair?.action !== "add-memory-aid" ||
      selectedStudyNote?.id !== linkedPracticeRepair.entry.reference.studyNoteId
    ) {
      return;
    }

    const hasMetaphor =
      getSupportDescriptionValue(draft.metaphors).trim().length > 0;

    if (hasMetaphor) {
      acronymInputRef.current?.focus();
      return;
    }

    metaphorInputRef.current?.focus();
  }, [draft.metaphors, linkedPracticeRepair, selectedStudyNote?.id]);

  useEffect(() => {
    if (
      linkedPracticeRepair?.action !== "split-study-note" ||
      selectedStudyNote?.id !== linkedPracticeRepair.entry.reference.studyNoteId
    ) {
      return;
    }

    promptInputRef.current?.focus();
  }, [linkedPracticeRepair, selectedStudyNote?.id]);

  useEffect(() => {
    if (saveStatus === null || hasDraftChanges || isSaving) {
      return;
    }

    const timeoutId = window.setTimeout(() => setSaveStatus(null), 1800);

    return () => window.clearTimeout(timeoutId);
  }, [hasDraftChanges, isSaving, saveStatus]);

  useEffect(() => {
    if (!isLabelManagerOpen) {
      return;
    }

    function handleDocumentMouseDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (labelManagerRef.current?.contains(target)) {
        return;
      }

      setLabelManagerOpen(false);
    }

    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [isLabelManagerOpen]);

  function updateDraft(
    updater: (current: UpdateStudyNoteInput) => UpdateStudyNoteInput,
  ) {
    setDraft(updater);
    setErrorMessage(null);
    setSaveStatus(null);
    setNewDiscardDialogOpen(false);
  }

  function updateDraftLabelSelection(labelId: string, isSelected: boolean) {
    updateDraft((current) => ({
      ...current,
      labelIds: setLabelIdSelection(current.labelIds, labelId, isSelected),
    }));
  }

  async function createLabelFromEditor() {
    const trimmedName = newLabelName.trim();

    if (userId === null || trimmedName.length === 0) {
      return;
    }

    const existingLabel = availableLabels.find(
      (label) =>
        label.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
    );

    if (existingLabel !== undefined) {
      updateDraftLabelSelection(existingLabel.id, true);
      setNewLabelName("");
      return;
    }

    setCreatingLabel(true);
    setErrorMessage(null);
    setSaveStatus(null);

    try {
      const createdLabel =
        persistentLabelsContext === undefined
          ? labelsContext.createLabel({
              name: trimmedName,
              userId,
            })
          : await persistentLabelsContext.createLabel(userId, {
              name: trimmedName,
            });

      updateDraftLabelSelection(createdLabel.id, true);
      setNewLabelName("");
    } catch (error) {
      if (error instanceof AppLabelError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    } finally {
      setCreatingLabel(false);
    }
  }

  async function handleDeleteLabel(label: AppLabel) {
    if (userId === null) {
      return;
    }

    const affectedStudyNotesCount = countStudyNotesWithLabel(
      allStudyNotes,
      label.id,
    );
    const shouldDeleteLabel = window.confirm(
      `Delete "${label.name}"? This will remove it from ${formatAffectedStudyNotesCount(affectedStudyNotesCount)}. Historical SessionResult snapshots stay unchanged.`,
    );

    if (!shouldDeleteLabel) {
      return;
    }

    setErrorMessage(null);
    setSaveStatus(null);

    if (selectedStudyNote !== null && draft.labelIds.includes(label.id)) {
      pendingDraftLabelRemovalRef.current = {
        labelId: label.id,
        studyNoteId: selectedStudyNote.id,
      };
    }

    try {
      if (persistentLabelsContext === undefined) {
        labelsContext.deleteLabel({
          labelId: label.id,
          userId,
        });
      } else {
        await persistentLabelsContext.deleteLabel(userId, label.id);
      }

      storeMutation.removeLabelAssignments(userId, label.id);
      setDraft((current) => removeLabelFromDraft(current, label.id));
      setSaveStatus(`Deleted ${label.name} label`);
    } catch (error) {
      if (
        error instanceof AppLabelError ||
        error instanceof AppStudyNotesError
      ) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  function navigateToEditorTarget(target: StudyNoteEditorTarget) {
    void navigate({
      ...getEditorTargetRouteTarget(target),
      ignoreBlocker: true,
    });
  }

  function applyEditorTarget(target: StudyNoteEditorTarget) {
    clearAnswerCheckSuggestionState();
    setErrorMessage(null);
    setSaveStatus(null);
    setPendingEditorTarget(null);
    setNewDiscardDialogOpen(false);

    if (routeKind !== "workspace") {
      navigateToEditorTarget(target);
      return;
    }

    if (target.type === "new") {
      setDraft(createBlankDraft());
      setCreatingStudyNote(true);
      return;
    }

    setCreatingStudyNote(false);
    setSelectedStudyNoteId(target.studyNoteId);
  }

  function requestEditorTarget(target: StudyNoteEditorTarget) {
    if (target.type === "new" && isCreatingStudyNote) {
      return;
    }

    if (
      target.type === "study-note" &&
      !isCreatingStudyNote &&
      target.studyNoteId === selectedStudyNote?.id
    ) {
      return;
    }

    if (hasDraftChanges) {
      setErrorMessage(null);
      setSaveStatus(null);
      setNewDiscardDialogOpen(false);
      setPendingEditorTarget(target);
      return;
    }

    applyEditorTarget(target);
  }

  function handleNewStudyNote() {
    requestEditorTarget({ type: "new" });
  }

  function discardDraft() {
    clearAnswerCheckSuggestionState();
    setErrorMessage(null);
    setSaveStatus(null);

    if (pendingEditorTarget !== null) {
      applyEditorTarget(pendingEditorTarget);
      return;
    }

    if (selectedStudyNote === null && hasDraftChanges) {
      setNewDiscardDialogOpen(true);
      return;
    }

    setPendingEditorTarget(null);

    if (selectedStudyNote === null) {
      abandonNewDraft();
      return;
    }

    const selectedDraft = createDraftFromStudyNote(selectedStudyNote);

    setDraft(selectedDraft);
  }

  function abandonNewDraft() {
    clearAnswerCheckSuggestionState();
    setErrorMessage(null);
    setSaveStatus(null);
    setPendingEditorTarget(null);
    setNewDiscardDialogOpen(false);

    if (selectedStudyNote === null) {
      setCreatingStudyNote(false);
      setDraft(createDraftFromStudyNote(selectedStudyNote));
      return;
    }
  }

  function stayOnCurrentDraft() {
    setErrorMessage(null);
    setPendingEditorTarget(null);
    setNewDiscardDialogOpen(false);
  }

  async function handleCancelEditor() {
    if (hasDraftChanges && !confirmCancelStudyNoteEditor()) {
      return;
    }

    setErrorMessage(null);
    setSaveStatus(null);
    await navigate({
      ignoreBlocker: true,
      to: appRoutePaths.studyNotes,
    });
  }

  async function handleDeleteStudyNote() {
    if (selectedStudyNote === null) {
      return;
    }

    const hasSiblingStudyNotes = selectedSourceStudyNotes.length > 1;

    if (
      !window.confirm(
        getDeleteStudyNoteConfirmationMessage(hasSiblingStudyNotes),
      )
    ) {
      return;
    }

    setErrorMessage(null);
    setSaveStatus(null);

    try {
      await storeMutation.deleteStudyNote(userId, selectedStudyNote.id, {
        deleteSource: !hasSiblingStudyNotes,
      });

      if (routeKind === "workspace") {
        setCreatingStudyNote(false);
        setSelectedStudyNoteId(
          studyNotes.find((studyNote) => studyNote.id !== selectedStudyNote.id)
            ?.id ?? null,
        );
      } else {
        await navigate({
          to: appRoutePaths.studyNotes,
        });
      }
    } catch (error) {
      handleError(error);
    }
  }

  async function completeLinkedPracticeRepairEntry(
    input: PracticeRepairLinkedCompletionInput,
    successMessage = "Practice Repair completed",
  ) {
    await mutatePracticeRepairEntry({
      action: "linked-action",
      mutation: (validatedUserId) => {
        if (persistentRecallContext === undefined) {
          recallContext.completeLinkedPracticeRepairEntry({
            ...input,
            userId: validatedUserId,
          });
          return;
        }

        return persistentRecallContext.completeLinkedPracticeRepairEntry(
          validatedUserId,
          input,
        );
      },
      reference: input.reference,
      successMessage,
    });
  }

  async function handleCreateSiblingStudyNote(input?: {
    practiceRepairReference?: PracticeRepairQuestionReference;
  }) {
    if (selectedStudyNote === null) {
      return;
    }

    setErrorMessage(null);
    setSaveStatus(null);

    try {
      const createdStudyNote = await storeMutation.createStudyNoteFromSource(
        userId,
        {
          sourceNoteId: selectedStudyNote.sourceNoteId,
        },
      );

      if (input?.practiceRepairReference !== undefined) {
        await completeLinkedPracticeRepairEntry({
          intent: "create-sibling-study-note",
          intentMetadata: {
            createdStudyNoteId: createdStudyNote.id,
          },
          reference: input.practiceRepairReference,
        });
      }

      if (routeKind === "workspace") {
        setCreatingStudyNote(false);
        setSelectedStudyNoteId(createdStudyNote.id);
      } else {
        await navigate({
          params: {
            studyNoteId: createdStudyNote.id,
          },
          search: getLinkedPracticeRepairNavigationSearch({
            linkedPracticeRepair,
            search,
          }),
          to: appRoutePaths.studyNoteEditor,
        });
      }
    } catch (error) {
      if (error instanceof AppRecallError) {
        setErrorMessage(error.message);
        return;
      }

      handleError(error);
    }
  }

  async function handleSplitStudyNote(
    entry: SplitStudyNotePracticeRepairEntry,
  ) {
    if (selectedStudyNote === null) {
      return;
    }

    setErrorMessage(null);
    setSaveStatus(null);

    try {
      const createdStudyNote = await storeMutation.createStudyNoteFromSource(
        userId,
        {
          sourceNoteId: selectedStudyNote.sourceNoteId,
        },
      );

      await completeLinkedPracticeRepairEntry(
        {
          intent: "split-study-note",
          intentMetadata: {
            createdStudyNoteIds: [createdStudyNote.id],
            narrowedOriginalStudyNoteAt: null,
          },
          reference: entry.reference,
        },
        formatSplitTargetCreatedStatus(entry),
      );
    } catch (error) {
      if (error instanceof AppRecallError) {
        setErrorMessage(error.message);
        return;
      }

      handleError(error);
    }
  }

  async function handleLinkedSplitStudyNote() {
    if (
      linkedPracticeRepair === null ||
      !isPracticeRepairEntryForIntent(
        linkedPracticeRepair.entry,
        "split-study-note",
      )
    ) {
      return;
    }

    await handleSplitStudyNote(linkedPracticeRepair.entry);
  }

  function handleStartMemoryAidPracticeRepair(input: {
    memoryAidKind: PracticeRepairMemoryAidKind;
    reference: PracticeRepairQuestionReference;
  }) {
    setErrorMessage(null);
    setSaveStatus(null);
    setMemoryAidsOpenOverride(true);
    setPendingPracticeRepairMemoryAidAction({
      memoryAidKind: input.memoryAidKind,
      reference: input.reference,
    });
  }

  async function mutatePracticeRepairEntry(input: {
    action: PracticeRepairMutationAction;
    mutation: (validatedUserId: string) => Promise<unknown> | undefined;
    onSuccess?: () => void;
    reference: PracticeRepairQuestionReference;
    successMessage: string;
  }) {
    if (userId === null) {
      return;
    }

    setErrorMessage(null);
    setSaveStatus(null);
    setPracticeRepairMutationKey(
      getPracticeRepairMutationKey(input.action, input.reference),
    );

    try {
      const mutationResult = input.mutation(userId);

      if (mutationResult !== undefined) {
        await mutationResult;
      }

      input.onSuccess?.();
      setSaveStatus(input.successMessage);
    } catch (error) {
      if (error instanceof AppRecallError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    } finally {
      setPracticeRepairMutationKey(null);
    }
  }

  async function updatePracticeRepairEntryCorrection(input: {
    correction: string;
    reference: PracticeRepairQuestionReference;
  }) {
    const correction = input.correction.trim();
    const entryKey = getPracticeRepairEntryKey(input.reference);

    await mutatePracticeRepairEntry({
      action: "edit",
      mutation: (validatedUserId) => {
        if (persistentRecallContext === undefined) {
          recallContext.updatePracticeRepairEntryCorrection({
            correction,
            reference: input.reference,
            userId: validatedUserId,
          });
          return;
        }

        return persistentRecallContext.updatePracticeRepairEntryCorrection(
          validatedUserId,
          {
            correction,
            reference: input.reference,
          },
        );
      },
      onSuccess: () =>
        setPracticeRepairCorrectionDrafts((current) => ({
          ...current,
          [entryKey]: correction,
        })),
      reference: input.reference,
      successMessage: "Practice Repair updated",
    });
  }

  async function completePracticeRepairEntry(
    reference: PracticeRepairQuestionReference,
  ) {
    await mutatePracticeRepairEntry({
      action: "complete",
      mutation: (validatedUserId) => {
        if (persistentRecallContext === undefined) {
          recallContext.completePracticeRepairEntry({
            reference,
            userId: validatedUserId,
          });
          return;
        }

        return persistentRecallContext.completePracticeRepairEntry(
          validatedUserId,
          {
            reference,
          },
        );
      },
      reference,
      successMessage: "Practice Repair completed",
    });
  }

  async function dismissPracticeRepairEntry(
    reference: PracticeRepairQuestionReference,
  ) {
    await mutatePracticeRepairEntry({
      action: "dismiss",
      mutation: (validatedUserId) => {
        if (persistentRecallContext === undefined) {
          recallContext.dismissPracticeRepairEntry({
            reference,
            userId: validatedUserId,
          });
          return;
        }

        return persistentRecallContext.dismissPracticeRepairEntry(
          validatedUserId,
          {
            reference,
          },
        );
      },
      reference,
      successMessage: "Practice Repair dismissed",
    });
  }

  function isPracticeRepairMutationPending(
    reference: PracticeRepairQuestionReference,
  ) {
    return practiceRepairMutationActions.some(
      (action) =>
        practiceRepairMutationKey ===
        getPracticeRepairMutationKey(action, reference),
    );
  }

  async function handleStartRecallSession() {
    if (userId === null) {
      return;
    }

    if (recallTodayStudyNoteIds.length === 0) {
      await navigate({ to: appRoutePaths.recall });
      return;
    }

    setErrorMessage(null);
    setSaveStatus(null);

    try {
      await startFlashCardRecallForStudyNotes({
        studyNoteIds: recallTodayStudyNoteIds,
        userId,
      });
      await navigate({ to: appRoutePaths.recallSession });
    } catch (error) {
      if (error instanceof AppRecallError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  async function handleStartInterleavedRecall() {
    if (userId === null || interleavedRecallRecommendation === null) {
      return;
    }

    setErrorMessage(null);
    setSaveStatus(null);

    try {
      await startFlashCardRecallForStudyNotes({
        studyNoteIds: interleavedRecallRecommendation.studyNoteIds,
        userId,
      });
      await navigate({ to: appRoutePaths.recallSession });
    } catch (error) {
      if (error instanceof AppRecallError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  async function startFlashCardRecallForStudyNotes(input: {
    studyNoteIds: readonly string[];
    userId: string;
  }) {
    const studyNoteIds = [...input.studyNoteIds];

    if (persistentRecallContext === undefined) {
      recallContext.startFlashCardSession({
        mode: "FlashCard",
        studyNoteIds,
        userId: input.userId,
      });
      return;
    }

    await persistentRecallContext.startFlashCardSession(input.userId, {
      mode: "FlashCard",
      studyNoteIds,
    });
  }

  async function maybeCompletePendingPracticeRepairMemoryAidAction(
    savedStudyNote: AppStudyNote,
  ) {
    if (
      pendingPracticeRepairMemoryAidAction === null ||
      savedStudyNote.id !==
        pendingPracticeRepairMemoryAidAction.reference.studyNoteId
    ) {
      return false;
    }

    const description = getSupportDescriptionValueByKind({
      memoryAidKind: pendingPracticeRepairMemoryAidAction.memoryAidKind,
      studyNote: savedStudyNote,
    }).trim();

    if (description.length === 0) {
      setSaveStatus(
        `Saved. Add a ${pendingPracticeRepairMemoryAidAction.memoryAidKind} to complete Practice Repair.`,
      );
      return true;
    }

    await completeLinkedPracticeRepairEntry({
      intent: "add-memory-aid",
      intentMetadata: {
        memoryAidId: getPracticeRepairMemoryAidReference({
          memoryAidKind: pendingPracticeRepairMemoryAidAction.memoryAidKind,
          studyNoteId: savedStudyNote.id,
        }),
        memoryAidKind: pendingPracticeRepairMemoryAidAction.memoryAidKind,
      },
      reference: pendingPracticeRepairMemoryAidAction.reference,
    });
    setPendingPracticeRepairMemoryAidAction(null);
    return true;
  }

  async function maybeCompleteLinkedMemoryAidPracticeRepair(input: {
    previousStudyNote: AppStudyNote | null;
    savedStudyNote: AppStudyNote;
  }) {
    if (linkedPracticeRepair?.action !== "add-memory-aid") {
      return false;
    }

    const linkedStudyNoteId = linkedPracticeRepair.entry.reference.studyNoteId;

    if (
      input.previousStudyNote?.id !== linkedStudyNoteId ||
      input.savedStudyNote.id !== linkedStudyNoteId
    ) {
      return false;
    }

    const previousAcronym = getSupportDescriptionValue(
      input.previousStudyNote.acronyms,
    ).trim();
    const savedAcronym = getSupportDescriptionValue(
      input.savedStudyNote.acronyms,
    ).trim();
    const previousMetaphor = getSupportDescriptionValue(
      input.previousStudyNote.metaphors,
    ).trim();
    const savedMetaphor = getSupportDescriptionValue(
      input.savedStudyNote.metaphors,
    ).trim();
    const memoryAidKind = getUpdatedMemoryAidKind({
      previousAcronym,
      previousMetaphor,
      savedAcronym,
      savedMetaphor,
    });

    if (memoryAidKind === null) {
      setSaveStatus(
        "Saved. Add a Metaphor or Acronym to complete Practice Repair.",
      );
      return true;
    }

    await completeLinkedPracticeRepairEntry({
      intent: "add-memory-aid",
      intentMetadata: {
        memoryAidId: getPracticeRepairMemoryAidReference({
          memoryAidKind,
          studyNoteId: input.savedStudyNote.id,
        }),
        memoryAidKind,
      },
      reference: linkedPracticeRepair.entry.reference,
    });

    return true;
  }

  async function maybeCompleteLinkedExpectedAnswerPracticeRepair(input: {
    previousStudyNote: AppStudyNote | null;
    savedStudyNote: AppStudyNote;
  }) {
    if (linkedPracticeRepair?.action !== "tighten-expected-answer") {
      return false;
    }

    const linkedStudyNoteId = linkedPracticeRepair.entry.reference.studyNoteId;

    if (
      input.previousStudyNote?.id !== linkedStudyNoteId ||
      input.savedStudyNote.id !== linkedStudyNoteId
    ) {
      return false;
    }

    const previousExpectedAnswer =
      input.previousStudyNote.expectedAnswer.trim();
    const updatedExpectedAnswer = input.savedStudyNote.expectedAnswer.trim();

    if (updatedExpectedAnswer === previousExpectedAnswer) {
      return false;
    }

    if (updatedExpectedAnswer.length === 0) {
      setSaveStatus(
        "Saved. Add an expected answer to complete Practice Repair.",
      );
      return true;
    }

    await completeLinkedPracticeRepairEntry({
      intent: "tighten-expected-answer",
      intentMetadata: {
        updatedExpectedAnswer,
      },
      reference: linkedPracticeRepair.entry.reference,
    });

    return true;
  }

  async function maybeRecordSplitStudyNoteNarrowing(input: {
    entry: SplitStudyNotePracticeRepairEntry | null;
    savedStudyNote: AppStudyNote;
    shouldRecordNarrowing: boolean;
  }) {
    if (
      input.entry === null ||
      !input.shouldRecordNarrowing ||
      input.savedStudyNote.id !== input.entry.reference.studyNoteId
    ) {
      return false;
    }

    await completeLinkedPracticeRepairEntry(
      {
        intent: "split-study-note",
        intentMetadata: {
          createdStudyNoteIds: [],
          narrowedOriginalStudyNoteAt: input.savedStudyNote.updatedAt,
        },
        reference: input.entry.reference,
      },
      formatOriginalNarrowedStatus(input.entry),
    );

    return true;
  }

  async function maybeHandlePracticeRepairSaveStatus(input: {
    activeSplitPracticeRepairEntry: SplitStudyNotePracticeRepairEntry | null;
    previousStudyNote: AppStudyNote | null;
    savedStudyNote: AppStudyNote;
    shouldRecordSplitStudyNoteNarrowing: boolean;
  }) {
    if (
      await maybeCompleteLinkedExpectedAnswerPracticeRepair({
        previousStudyNote: input.previousStudyNote,
        savedStudyNote: input.savedStudyNote,
      })
    ) {
      return true;
    }

    if (
      await maybeRecordSplitStudyNoteNarrowing({
        entry: input.activeSplitPracticeRepairEntry,
        savedStudyNote: input.savedStudyNote,
        shouldRecordNarrowing: input.shouldRecordSplitStudyNoteNarrowing,
      })
    ) {
      return true;
    }

    if (
      await maybeCompleteLinkedMemoryAidPracticeRepair({
        previousStudyNote: input.previousStudyNote,
        savedStudyNote: input.savedStudyNote,
      })
    ) {
      return true;
    }

    return maybeCompletePendingPracticeRepairMemoryAidAction(
      input.savedStudyNote,
    );
  }

  async function saveDraft({
    redirectAfterCreate,
  }: SaveDraftOptions): Promise<AppStudyNote | null> {
    if (!hasDraftChanges) {
      return selectedStudyNote;
    }

    setErrorMessage(null);
    setSaveStatus(null);
    setSaving(true);

    try {
      const activeSplitPracticeRepairEntry =
        selectedStudyNote === null
          ? null
          : findSplitStudyNotePracticeRepairEntry(activePracticeRepairEntries);
      const didReferenceExplanationChange =
        selectedStudyNote !== null &&
        hasStudyNoteSourceContentChanged({
          currentSource: selectedStudyNote.source,
          sourceBody: draft.sourceBody,
          sourceTitle: draft.sourceTitle,
        });
      const shouldRecordSplitStudyNoteNarrowing =
        selectedStudyNote !== null &&
        activeSplitPracticeRepairEntry !== null &&
        didSplitStudyNoteDraftChange({
          draft,
          studyNote: selectedStudyNote,
        });
      let savedStudyNote: AppStudyNote;

      if (selectedStudyNote === null) {
        const createdStudyNote = await storeMutation.createStudyNote(userId, {
          expectedAnswer: draft.expectedAnswer,
          prompt: draft.prompt,
          sourceBody: draft.sourceBody,
          sourceTitle: draft.sourceTitle,
        });
        const updatedStudyNote = await storeMutation.updateStudyNote(
          userId,
          createdStudyNote.id,
          draft,
        );

        if (routeKind === "workspace") {
          setSelectedStudyNoteId(updatedStudyNote.id);
          setCreatingStudyNote(false);
        } else if (routeKind === "create" && redirectAfterCreate) {
          await navigate({
            params: {
              studyNoteId: updatedStudyNote.id,
            },
            to: appRoutePaths.studyNoteEditor,
          });
        }

        savedStudyNote = updatedStudyNote;
      } else {
        savedStudyNote = await storeMutation.updateStudyNote(
          userId,
          selectedStudyNote.id,
          draft,
        );
      }

      await captureFocusStudyNoteActivity(savedStudyNote);

      const didHandlePracticeRepairSaveStatus =
        await maybeHandlePracticeRepairSaveStatus({
          activeSplitPracticeRepairEntry,
          previousStudyNote: selectedStudyNote,
          savedStudyNote,
          shouldRecordSplitStudyNoteNarrowing,
        });
      const didDetachSharedSource =
        selectedStudyNote !== null &&
        didReferenceExplanationChange &&
        selectedSourceStudyNotes.length > 1 &&
        savedStudyNote.sourceNoteId !== selectedStudyNote.sourceNoteId;

      if (!didHandlePracticeRepairSaveStatus) {
        setSaveStatus(
          didDetachSharedSource
            ? DETACHED_SHARED_SOURCE_SAVE_MESSAGE
            : "Saved just now",
        );
      }

      clearAnswerCheckSuggestionState();
      return savedStudyNote;
    } catch (error) {
      handleError(error);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await saveDraft({
      redirectAfterCreate: true,
    });
  }

  async function saveDraftAndApplyPendingTarget() {
    if (pendingEditorTarget === null) {
      await saveDraft({
        redirectAfterCreate: true,
      });
      return;
    }

    const target = pendingEditorTarget;
    const savedStudyNote = await saveDraft({
      redirectAfterCreate: false,
    });

    if (savedStudyNote === null) {
      return;
    }

    applyEditorTarget(target);
  }

  async function captureFocusStudyNoteActivity(studyNote: AppStudyNote) {
    if (userId === null) {
      return;
    }

    const input = {
      labels: getAttachedLabels(
        labelsContext.getLabelsForUser(userId),
        studyNote.labelIds,
      ),
      studyNote,
    };

    if (persistentFocusContext !== undefined) {
      await persistentFocusContext.captureStudyNoteStudyActivity(userId, input);
      return;
    }

    focusContext.captureStudyNoteStudyActivity({
      ...input,
      userId,
    });
  }

  function handleError(error: unknown) {
    if (error instanceof AppStudyNotesError) {
      setErrorMessage(error.message);
      return;
    }

    throw error;
  }

  function updateDraftSupportDescription(
    field: "acronyms" | "metaphors",
    description: string,
  ) {
    updateDraft((current) => ({
      ...current,
      [field]: createSingleSupportDescriptionDraft(description),
    }));
  }

  function addDraftKeyIdea() {
    setAnswerCheckOpenOverride(true);
    updateDraft((current) => ({
      ...current,
      keyIdeas: [...current.keyIdeas, createEmptyKeyIdeaDraft()],
    }));
  }

  function updateDraftKeyIdea(
    keyIdeaId: string,
    updater: (keyIdea: AppStudyNoteKeyIdea) => AppStudyNoteKeyIdea,
  ) {
    updateDraft((current) => ({
      ...current,
      keyIdeas: current.keyIdeas.map((keyIdea) =>
        keyIdea.id === keyIdeaId ? updater(keyIdea) : keyIdea,
      ),
    }));
  }

  function removeDraftKeyIdea(keyIdeaId: string) {
    updateDraft((current) => ({
      ...current,
      keyIdeas: current.keyIdeas.filter((keyIdea) => keyIdea.id !== keyIdeaId),
    }));
  }

  function addDraftTextReference(field: AnswerCheckTextReferenceField) {
    setAnswerCheckOpenOverride(true);
    updateDraft((current) => ({
      ...current,
      [field]: [...current[field], createEmptyAnswerCheckTextReferenceDraft()],
    }));
  }

  function updateDraftTextReference(
    field: AnswerCheckTextReferenceField,
    referenceId: string,
    text: string,
  ) {
    updateDraft((current) => ({
      ...current,
      [field]: current[field].map((reference) =>
        reference.id === referenceId ? { ...reference, text } : reference,
      ),
    }));
  }

  function removeDraftTextReference(
    field: AnswerCheckTextReferenceField,
    referenceId: string,
  ) {
    updateDraft((current) => ({
      ...current,
      [field]: current[field].filter(
        (reference) => reference.id !== referenceId,
      ),
    }));
  }

  function inferAnswerCheckSuggestions() {
    const suggestions = inferStudyNoteAnswerCheckReferenceSuggestions({
      createId: createDraftReferenceId,
      draft,
      sessionResults: recallResultsSnapshot,
      studyNoteId: selectedStudyNote?.id ?? null,
    });

    if (!hasStudyNoteAnswerCheckReferenceSuggestions(suggestions)) {
      setAnswerCheckSuggestionFeedback(
        "No draft suggestions found from the expected answer or recall history yet.",
      );
      return;
    }

    setAnswerCheckOpenOverride(true);
    setAnswerCheckSuggestionSession((current) => ({
      baselineDraft: current?.baselineDraft ?? cloneStudyNoteDraft(draft),
    }));
    setAnswerCheckSuggestionFeedback(
      "Draft suggestions added. Review, edit, save, or discard them. They stay inactive until you save.",
    );
    updateDraft((current) =>
      applyStudyNoteAnswerCheckReferenceSuggestions({
        draft: current,
        suggestions,
      }),
    );
  }

  function discardAnswerCheckSuggestions() {
    if (answerCheckSuggestionSession === null) {
      return;
    }

    setDraft(cloneStudyNoteDraft(answerCheckSuggestionSession.baselineDraft));
    setAnswerCheckSuggestionSession(null);
    setAnswerCheckSuggestionFeedback("Draft suggestions discarded.");
    setErrorMessage(null);
    setSaveStatus(null);
  }

  const selectedNextRecall = formatSelectedNextRecall({
    now,
    schedule: selectedRecallSchedule,
    userTimeZone,
  });
  const selectedRecallInsight = deriveStudyNoteRecallInsight({
    draft,
    nextRecall: selectedNextRecall,
    recallGuidance: selectedRecallGuidance,
  });
  const answerCheckHasContent = hasDraftAnswerCheckContent(draft);
  const isAnswerCheckOpen = isAnswerCheckOpenOverride ?? answerCheckHasContent;
  const hasPendingAnswerCheckSuggestions =
    answerCheckSuggestionSession !== null;
  const referenceHasContent = hasDraftReferenceContent(draft);
  const referenceDisclosureDefaultOpen = referenceHasContent;
  const isReferenceOpen =
    isReferenceOpenOverride ?? referenceDisclosureDefaultOpen;
  const sharedSourceReferenceGuidance =
    selectedStudyNote === null || selectedSourceStudyNotes.length <= 1
      ? null
      : getSharedSourceReferenceGuidance({
          sourceDisplayLabel: getStudyNoteSourceDisplayLabel(selectedStudyNote),
          studyNoteCount: selectedSourceStudyNotes.length,
        });
  const memoryAidsHasContent = hasDraftMemoryAidContent(draft);
  const isMemoryAidsOpen = isMemoryAidsOpenOverride ?? memoryAidsHasContent;
  const saveBarStatusText = getSaveBarStatusText({
    isSaving,
    pendingEditorTarget,
    saveStatus,
  });
  const shouldShowStudyNoteTemplates =
    showStudyNoteTemplates && draft.prompt.trim().length === 0;
  const visibleSelectedLabels =
    selectedLabels.length === 0
      ? [{ id: "general", name: "General" }]
      : selectedLabels;
  const linkedPracticeRepairReturnTarget =
    linkedPracticeRepair === null
      ? null
      : getLinkedPracticeRepairReturnTarget(linkedPracticeRepair);
  const linkedPracticeRepairAction = linkedPracticeRepair?.action ?? null;
  const isPromptPracticeRepairFocus =
    linkedPracticeRepairAction === "tighten-prompt" ||
    linkedPracticeRepairAction === "split-study-note";
  const isExpectedAnswerPracticeRepairFocus =
    linkedPracticeRepairAction === "tighten-expected-answer";
  const isMemoryAidsPracticeRepairFocus =
    linkedPracticeRepairAction === "add-memory-aid";
  const shouldShowEditorPracticeRepairSections = linkedPracticeRepair === null;

  return (
    <PageLayout
      actions={
        <>
          <Button
            aria-label="New Study Note"
            className="study-notes-new-note"
            onClick={handleNewStudyNote}
            type="button"
            variant="secondary"
          >
            <PlusIcon />
            <span>New note</span>
          </Button>
          <Button
            className="study-notes-start-recall"
            onClick={() => void handleStartRecallSession()}
            type="button"
            variant="secondary"
          >
            <PlayIcon />
            <span>Start Recall Session</span>
          </Button>
        </>
      }
      actionsClassName="study-notes-hero__actions"
      bodyClassName="study-notes-workspace__body"
      className="notes-workspace study-notes-workspace"
      description="Write stronger recall prompts with guidance and templates—no extra required fields."
      headerClassName="study-notes-hero"
      headingLevel={1}
      title="Study Notes"
    >
      <div
        className="notes-layout study-notes-layout"
        data-save-bar-visible={isSaveBarVisible ? "true" : "false"}
      >
        <aside
          aria-label="Study Notes catalog"
          className="notes-list-panel"
          data-list-expanded={isStudyNotesCatalogExpanded ? "true" : undefined}
        >
          <div className="study-notes-catalog-tools">
            <label className="study-notes-search">
              <span className="sr-only">Search notes</span>
              <SearchIcon />
              <input
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setStudyNotesCatalogExpanded(false);
                }}
                placeholder="Search notes"
                type="search"
                value={searchQuery}
              />
            </label>
            <label className="study-notes-filter">
              <span className="sr-only">Filter by label</span>
              <SlidersIcon />
              <select
                aria-label="Filter Study Notes by label"
                onChange={(event) => {
                  const nextSelectedLabelId = event.target.value;

                  setSelectedLabelId(nextSelectedLabelId);
                  setStudyNotesCatalogExpanded(false);
                  void navigate({
                    ...currentStudyNotesRouteTarget,
                    replace: true,
                    search: (previousSearch) => ({
                      ...previousSearch,
                      labelId:
                        nextSelectedLabelId.length === 0
                          ? undefined
                          : nextSelectedLabelId,
                    }),
                  });
                }}
                value={selectedLabelId}
              >
                <option value="">All labels</option>
                <option value={unlabeledStudyNotesFilterValue}>
                  {unlabeledStudyNotesFilterLabel}
                </option>
                {availableLabels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="study-notes-catalog-meta">
            <span>{studyNotes.length} notes</span>
            <button className="study-notes-sort" type="button">
              Recently updated
              <ChevronDownIcon />
            </button>
          </div>
          <nav
            aria-label="Study Notes list"
            className="notes-list"
            ref={studyNotesCatalogListRef}
          >
            {studyNotes.length === 0 ? (
              <p className="muted notes-list__empty">
                Create a Study Note to start practicing.
              </p>
            ) : (
              <ul className="notes-list__items">
                {visibleStudyNotes.map((studyNote) => {
                  const learningState = learningStateByStudyNoteId.get(
                    studyNote.id,
                  );
                  const learningLabels =
                    learningState === undefined
                      ? null
                      : getStudyNoteLearningLabels(learningState);
                  const labelNames = getStudyNoteLabelNames(
                    availableLabels,
                    studyNote.labelIds,
                  );
                  const schedule =
                    recallScheduleByStudyNoteId.get(studyNote.id) ?? null;
                  const timingLabel = formatNextRecallTiming({
                    now,
                    schedule,
                    userTimeZone,
                  });
                  const rowStatus =
                    learningLabels?.practice ??
                    (learningLabels?.due
                      ? timingLabel
                      : learningLabels?.compact) ??
                    "Study Note";
                  const statusKind = getStudyNoteStatusKind(
                    learningState ?? null,
                  );

                  return (
                    <li key={studyNote.id}>
                      <button
                        aria-label={studyNote.prompt}
                        aria-current={
                          studyNote.id === selectedStudyNote?.id
                            ? "page"
                            : undefined
                        }
                        className="study-note-row"
                        data-selected={
                          studyNote.id === selectedStudyNote?.id
                            ? "true"
                            : undefined
                        }
                        data-status-kind={statusKind}
                        onClick={() =>
                          requestEditorTarget({
                            studyNoteId: studyNote.id,
                            type: "study-note",
                          })
                        }
                        type="button"
                      >
                        <span className="study-note-row__icon">
                          <StudyNoteDocumentIcon />
                        </span>
                        <span className="study-note-row__content">
                          <strong>{studyNote.prompt}</strong>
                          <span>{labelNames.slice(0, 2).join(" · ")}</span>
                          <span className="study-note-row__status">
                            {rowStatus}
                          </span>
                        </span>
                        <span className="study-note-row__updated-inline">
                          {formatRelativeUpdatedLabel(studyNote.updatedAt)}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {isStudyNotesCatalogExpandable &&
                !isStudyNotesCatalogExpanded ? (
                  <li className="study-notes-catalog-footer">
                    <button
                      className="study-notes-show-more"
                      onClick={() => setStudyNotesCatalogExpanded(true)}
                      type="button"
                    >
                      Show {hiddenStudyNotesCount} more
                      <ChevronDownIcon />
                    </button>
                  </li>
                ) : null}
              </ul>
            )}
          </nav>
        </aside>

        {isMissingSelectedStudyNote ? (
          <section
            aria-label="Study Note missing state"
            className="notes-editor study-notes-editor study-notes-editor--empty"
          >
            <div className="study-notes-editor__empty">
              <h2>Study Note not found</h2>
              <p className="muted">
                This Study Note no longer exists or the link is no longer valid.
              </p>
              <div className="study-notes-editor__toolbar">
                <ButtonLink to={appRoutePaths.studyNotes} variant="secondary">
                  Back to Study Notes
                </ButtonLink>
                <ButtonLink to={appRoutePaths.studyNotesNew} variant="primary">
                  New Study Note
                </ButtonLink>
              </div>
            </div>
          </section>
        ) : (
          <form
            aria-label="Study Note editor surface"
            aria-busy={isSaving ? "true" : undefined}
            className="notes-editor study-notes-editor"
            data-save-bar-visible={isSaveBarVisible ? "true" : "false"}
            id={STUDY_NOTE_EDITOR_FORM_ID}
            onSubmit={(event) => void handleSubmit(event)}
          >
            <fieldset className="notes-editor__study-surface">
              <legend className="sr-only">Study Note</legend>
              <div className="study-notes-editor__masthead">
                <div className="study-notes-editor__title">
                  <h2>{draft.prompt.trim() || "New Study Note"}</h2>
                  <p className="study-notes-editor__title-meta">
                    {visibleSelectedLabels
                      .map((label) => label.name)
                      .join(" · ")}
                    {visibleSelectedLabels.length === 0 ? null : " · "}
                    {selectedStudyNote === null
                      ? "Draft"
                      : `Updated ${formatRelativeUpdatedLabel(selectedStudyNote.updatedAt).toLowerCase()}`}
                  </p>
                </div>
                <div className="study-notes-editor__toolbar">
                  {saveStatus === null ? null : (
                    <span className="study-notes-editor__saved">
                      <CheckIcon />
                      {saveStatus}
                    </span>
                  )}
                  {linkedPracticeRepairReturnTarget === null ? null : (
                    <ButtonLink
                      className="study-notes-editor__repair-return"
                      params={linkedPracticeRepairReturnTarget.params}
                      size="compact"
                      to={linkedPracticeRepairReturnTarget.to}
                      variant="secondary"
                    >
                      Return to Practice Repair
                    </ButtonLink>
                  )}
                  <Button
                    onClick={() => void handleCancelEditor()}
                    size="compact"
                    type="button"
                    variant="secondary"
                  >
                    Cancel
                  </Button>
                  {selectedStudyNote === null ? null : (
                    <Button
                      onClick={() => void handleDeleteStudyNote()}
                      size="compact"
                      type="button"
                      variant="danger"
                    >
                      <TrashIcon />
                      Delete note
                    </Button>
                  )}
                  {hasDraftChanges || isSaving ? (
                    <Button size="compact" type="submit" variant="primary">
                      {isSaving ? "Saving..." : "Save changes"}
                    </Button>
                  ) : null}
                  {linkedPracticeRepair?.action ===
                  "create-sibling-study-note" ? (
                    <Button
                      onClick={() =>
                        void handleCreateSiblingStudyNote({
                          practiceRepairReference:
                            linkedPracticeRepair.entry.reference,
                        })
                      }
                      size="compact"
                      type="button"
                      variant="secondary"
                    >
                      <CopyIcon />
                      <span>Create sibling Study Note</span>
                    </Button>
                  ) : null}
                  {linkedPracticeRepair !== null &&
                  isPracticeRepairEntryForIntent(
                    linkedPracticeRepair.entry,
                    "split-study-note",
                  ) ? (
                    <Button
                      onClick={() => void handleLinkedSplitStudyNote()}
                      size="compact"
                      type="button"
                      variant="secondary"
                    >
                      <CopyIcon />
                      <span>Create split target</span>
                    </Button>
                  ) : null}
                  <Button
                    aria-label="Add Study Note from this explanation"
                    disabled={selectedStudyNote === null}
                    iconOnly
                    onClick={() => void handleCreateSiblingStudyNote()}
                    size="compact"
                    type="button"
                  >
                    <CopyIcon />
                  </Button>
                </div>
              </div>

              <div className="study-notes-editor__fields">
                {linkedPracticeRepair === null ? null : (
                  <section
                    aria-label="Linked Practice Repair"
                    className="study-notes-practice-repair study-notes-practice-repair--linked"
                  >
                    <div className="study-notes-practice-repair__header">
                      <div className="study-notes-practice-repair__title-row">
                        <h2 className="study-notes-practice-repair__title">
                          Linked Practice Repair
                        </h2>
                        <span className="study-notes-practice-repair__signal">
                          Linked
                        </span>
                      </div>
                      <p className="muted study-notes-editor__guidance">
                        {formatLinkedPracticeRepairSummary(
                          linkedPracticeRepair.action,
                        )}
                      </p>
                    </div>
                  </section>
                )}
                <StudyNotesTextField
                  inputRef={promptInputRef}
                  isPracticeRepairFocus={isPromptPracticeRepairFocus}
                  label="Prompt"
                  maxLength={500}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      prompt: event.target.value,
                    }))
                  }
                  placeholder={STUDY_NOTE_GUIDANCE_COPY.promptPlaceholder}
                  value={draft.prompt}
                />
                {shouldShowStudyNoteTemplates ? (
                  <div className="study-notes-template-row">
                    <span>Quick start with a template (optional)</span>
                    <div className="study-notes-template-row__actions">
                      {studyNoteTemplateActions.map((template) => (
                        <Button
                          className="study-notes-template-action"
                          key={template.label}
                          onClick={() =>
                            updateDraft((current) => ({
                              ...current,
                              prompt:
                                current.prompt.trim().length === 0
                                  ? template.prompt
                                  : current.prompt,
                            }))
                          }
                          size="compact"
                          type="button"
                          variant="secondary"
                        >
                          {template.icon}
                          <span>{template.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <StudyNotesTextarea
                  inputRef={expectedAnswerInputRef}
                  isPracticeRepairFocus={isExpectedAnswerPracticeRepairFocus}
                  label="Expected answer"
                  maxLength={1000}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      expectedAnswer: event.target.value,
                    }))
                  }
                  placeholder={
                    STUDY_NOTE_GUIDANCE_COPY.expectedAnswerPlaceholder
                  }
                  rows={4}
                  value={draft.expectedAnswer}
                />

                <div className="study-notes-editor__label-row">
                  <span className="study-notes-editor__group-label">
                    Labels <span aria-hidden="true">(optional)</span>
                  </span>
                  <p className="study-notes-editor__summary-copy">
                    Add a few keywords to help you find and filter this note.
                  </p>
                  <div className="study-notes-editor__chips">
                    {visibleSelectedLabels.map((label) => (
                      <span className="study-notes-chip" key={label.id}>
                        {label.name}
                        {label.id === "general" ? null : (
                          <button
                            aria-label={`Remove ${label.name} label`}
                            onClick={() =>
                              updateDraftLabelSelection(label.id, false)
                            }
                            type="button"
                          >
                            <span aria-hidden="true">x</span>
                          </button>
                        )}
                      </span>
                    ))}
                    <div
                      className="study-notes-label-combobox"
                      ref={labelManagerRef}
                    >
                      <Button
                        aria-controls="study-notes-label-manager"
                        aria-expanded={isLabelManagerOpen}
                        aria-label="Manage labels"
                        className="study-notes-label-manager-toggle"
                        onClick={() => setLabelManagerOpen((value) => !value)}
                        size="compact"
                        type="button"
                        variant="secondary"
                      >
                        <PlusIcon />
                        <span>Add label</span>
                      </Button>
                      {isLabelManagerOpen ? (
                        <section
                          aria-label="Study Note labels"
                          className="study-notes-label-manager"
                          id="study-notes-label-manager"
                        >
                          <div className="study-notes-label-create">
                            <label>
                              <span className="sr-only">Add label</span>
                              <input
                                onKeyDown={(event) => {
                                  if (event.key !== "Enter") {
                                    return;
                                  }

                                  event.preventDefault();
                                  void createLabelFromEditor();
                                }}
                                onChange={(event) =>
                                  setNewLabelName(event.target.value)
                                }
                                placeholder="Add label..."
                                type="text"
                                value={newLabelName}
                              />
                            </label>
                            <Button
                              disabled={
                                isCreatingLabel ||
                                newLabelName.trim().length === 0
                              }
                              onClick={() => void createLabelFromEditor()}
                              size="compact"
                              type="button"
                              variant="secondary"
                            >
                              <PlusIcon />
                              <span>
                                {isCreatingLabel ? "Adding" : "Create"}
                              </span>
                            </Button>
                          </div>
                          {availableLabels.length === 0 ? (
                            <p className="muted">No Labels yet.</p>
                          ) : (
                            <div className="study-notes-labels">
                              {availableLabels.map((label) => (
                                <div
                                  className="study-notes-label"
                                  key={label.id}
                                >
                                  <label className="study-notes-label__selection">
                                    <input
                                      checked={draft.labelIds.includes(
                                        label.id,
                                      )}
                                      onChange={(event) =>
                                        updateDraftLabelSelection(
                                          label.id,
                                          event.target.checked,
                                        )
                                      }
                                      type="checkbox"
                                    />
                                    <span>{label.name}</span>
                                  </label>
                                  <button
                                    aria-label={`Delete ${label.name} label`}
                                    className="study-notes-label__delete"
                                    onClick={() =>
                                      void handleDeleteLabel(label)
                                    }
                                    type="button"
                                  >
                                    Delete
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      ) : null}
                    </div>
                  </div>
                </div>

                <StudyNotesAnswerCheckEditor
                  feedbackMessage={answerCheckSuggestionFeedback}
                  draft={draft}
                  hasContent={answerCheckHasContent}
                  hasPendingSuggestions={hasPendingAnswerCheckSuggestions}
                  isOpen={isAnswerCheckOpen}
                  onDiscardSuggestions={discardAnswerCheckSuggestions}
                  onInferSuggestions={inferAnswerCheckSuggestions}
                  onAddKeyIdea={addDraftKeyIdea}
                  onAddTextReference={addDraftTextReference}
                  onRemoveKeyIdea={removeDraftKeyIdea}
                  onRemoveTextReference={removeDraftTextReference}
                  onToggle={setAnswerCheckOpenOverride}
                  onUpdateKeyIdea={updateDraftKeyIdea}
                  onUpdateTextReference={updateDraftTextReference}
                  selectedDisclosureKey={selectedDisclosureKey}
                />

                <section
                  aria-label="Memory aids"
                  className="study-notes-editor__memory-aids study-notes-editor__info-section"
                  data-practice-repair-focus={
                    isMemoryAidsPracticeRepairFocus ? "true" : undefined
                  }
                >
                  <details
                    className="study-notes-editor__disclosure"
                    key={`memory-aids-${selectedDisclosureKey}`}
                    onToggle={(event) =>
                      setMemoryAidsOpenOverride(event.currentTarget.open)
                    }
                    open={isMemoryAidsOpen}
                  >
                    <summary className="study-notes-editor__disclosure-summary">
                      <span>
                        <span className="study-notes-editor__group-label">
                          Memory aids
                        </span>
                        <span className="study-notes-editor__summary-copy">
                          {memoryAidsHasContent
                            ? "Support content available"
                            : "Optional recall support"}
                        </span>
                      </span>
                      <ChevronDownIcon />
                    </summary>
                    <div className="study-notes-editor__disclosure-body">
                      <StudyNotesTextarea
                        inputRef={metaphorInputRef}
                        label="Metaphor"
                        maxLength={500}
                        onChange={(event) => {
                          updateDraftSupportDescription(
                            "metaphors",
                            event.target.value,
                          );
                        }}
                        optional
                        placeholder={
                          STUDY_NOTE_GUIDANCE_COPY.metaphorPlaceholder
                        }
                        rows={2}
                        value={getSupportDescriptionValue(draft.metaphors)}
                      />
                      <StudyNotesTextField
                        inputRef={acronymInputRef}
                        label="Acronym"
                        maxLength={200}
                        onChange={(event) => {
                          updateDraftSupportDescription(
                            "acronyms",
                            event.target.value,
                          );
                        }}
                        optional
                        placeholder={
                          STUDY_NOTE_GUIDANCE_COPY.acronymPlaceholder
                        }
                        value={getSupportDescriptionValue(draft.acronyms)}
                      />
                    </div>
                  </details>
                </section>

                {!shouldShowEditorPracticeRepairSections ||
                activePracticeRepairEntries.length === 0 ? null : (
                  <section
                    aria-label="Active Practice Repair"
                    className="study-notes-practice-repair study-notes-practice-repair--active"
                  >
                    <div className="study-notes-practice-repair__header">
                      <div className="study-notes-practice-repair__title-row">
                        <h2 className="study-notes-practice-repair__title">
                          Active Practice Repair
                        </h2>
                        <span className="study-notes-practice-repair__signal">
                          Active
                        </span>
                      </div>
                      <p className="muted study-notes-editor__guidance">
                        Edit the correction while this entry is active. Mark it
                        complete or dismiss it explicitly when the repair no
                        longer belongs in active planning work.
                      </p>
                    </div>
                    <div className="study-notes-practice-repair__entries">
                      {activePracticeRepairEntries.map(({ entry, origin }) => {
                        const entryKey = getPracticeRepairEntryKey(
                          entry.reference,
                        );
                        const correctionDraft =
                          practiceRepairCorrectionDrafts[entryKey] ??
                          entry.correction;
                        const isMutationPending =
                          isPracticeRepairMutationPending(entry.reference);

                        return (
                          <article
                            aria-label={formatPracticeRepairIntentLabel(
                              entry.intent,
                            )}
                            className="study-notes-practice-repair-entry"
                            key={entryKey}
                          >
                            <div className="study-notes-practice-repair-entry__header">
                              <div className="study-notes-practice-repair-entry__title-group">
                                <h3 className="study-notes-practice-repair-entry__title">
                                  {formatPracticeRepairIntentLabel(
                                    entry.intent,
                                  )}
                                </h3>
                                <p className="study-notes-practice-repair-entry__meta">
                                  Confirmed{" "}
                                  {formatRelativeUpdatedLabel(
                                    entry.confirmedAt,
                                  )}
                                </p>
                              </div>
                            </div>
                            <PracticeRepairOriginDetails origin={origin} />
                            <StudyNotesTextarea
                              label="Correction"
                              maxLength={1000}
                              onChange={(event) =>
                                setPracticeRepairCorrectionDrafts(
                                  (current) => ({
                                    ...current,
                                    [entryKey]: event.target.value,
                                  }),
                                )
                              }
                              rows={3}
                              value={correctionDraft}
                            />
                            {entry.nextPracticeIdea === undefined ? null : (
                              <div className="study-notes-practice-repair-entry__next-practice">
                                <span className="study-notes-editor__group-label">
                                  Next-practice idea
                                </span>
                                <p>{entry.nextPracticeIdea}</p>
                              </div>
                            )}
                            <div className="study-notes-practice-repair__actions">
                              {isPracticeRepairEntryForIntent(
                                entry,
                                "split-study-note",
                              ) ? (
                                <Button
                                  disabled={isMutationPending}
                                  onClick={() =>
                                    void handleSplitStudyNote(entry)
                                  }
                                  size="compact"
                                  type="button"
                                  variant="secondary"
                                >
                                  <CopyIcon />
                                  <span>Split Study Note</span>
                                </Button>
                              ) : null}
                              {entry.intent === "create-sibling-study-note" ? (
                                <Button
                                  disabled={isMutationPending}
                                  onClick={() =>
                                    void handleCreateSiblingStudyNote({
                                      practiceRepairReference: entry.reference,
                                    })
                                  }
                                  size="compact"
                                  type="button"
                                  variant="secondary"
                                >
                                  <CopyIcon />
                                  <span>Create sibling Study Note</span>
                                </Button>
                              ) : null}
                              {entry.intent === "add-memory-aid" ? (
                                <>
                                  <Button
                                    disabled={isMutationPending}
                                    onClick={() =>
                                      handleStartMemoryAidPracticeRepair({
                                        memoryAidKind: "Metaphor",
                                        reference: entry.reference,
                                      })
                                    }
                                    size="compact"
                                    type="button"
                                    variant="secondary"
                                  >
                                    <span>Add Metaphor</span>
                                  </Button>
                                  <Button
                                    disabled={isMutationPending}
                                    onClick={() =>
                                      handleStartMemoryAidPracticeRepair({
                                        memoryAidKind: "Acronym",
                                        reference: entry.reference,
                                      })
                                    }
                                    size="compact"
                                    type="button"
                                    variant="secondary"
                                  >
                                    <span>Add Acronym</span>
                                  </Button>
                                </>
                              ) : null}
                              <Button
                                disabled={
                                  isMutationPending ||
                                  correctionDraft.trim().length === 0 ||
                                  correctionDraft.trim() === entry.correction
                                }
                                onClick={() =>
                                  void updatePracticeRepairEntryCorrection({
                                    correction: correctionDraft,
                                    reference: entry.reference,
                                  })
                                }
                                size="compact"
                                type="button"
                                variant="secondary"
                              >
                                Save correction
                              </Button>
                              <Button
                                disabled={isMutationPending}
                                onClick={() =>
                                  void completePracticeRepairEntry(
                                    entry.reference,
                                  )
                                }
                                size="compact"
                                type="button"
                                variant="secondary"
                              >
                                Mark complete
                              </Button>
                              <Button
                                disabled={isMutationPending}
                                onClick={() =>
                                  void dismissPracticeRepairEntry(
                                    entry.reference,
                                  )
                                }
                                size="compact"
                                type="button"
                                variant="danger"
                              >
                                Dismiss
                              </Button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}

                {!shouldShowEditorPracticeRepairSections ||
                practiceRepair === null ? null : (
                  <section
                    aria-label={practiceRepair.title}
                    className="study-notes-practice-repair"
                  >
                    <div className="study-notes-practice-repair__header">
                      <div className="study-notes-practice-repair__title-row">
                        <h2 className="study-notes-practice-repair__title">
                          {practiceRepair.title}
                        </h2>
                        <span className="study-notes-practice-repair__signal">
                          Needs repair
                        </span>
                      </div>
                      <p className="muted study-notes-editor__guidance">
                        {practiceRepair.summary}
                      </p>
                    </div>
                    <ul
                      aria-label="Practice Repair checklist"
                      className="study-notes-practice-repair__list"
                    >
                      {practiceRepair.suggestions.map((suggestion) => (
                        <li
                          className="study-notes-practice-repair__item"
                          key={suggestion.id}
                        >
                          <span
                            aria-hidden="true"
                            className="study-notes-practice-repair__marker"
                          />
                          <span>{suggestion.text}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="study-notes-practice-repair__actions">
                      <Button
                        onClick={() => void handleCreateSiblingStudyNote()}
                        size="compact"
                        type="button"
                        variant="secondary"
                      >
                        <CopyIcon />
                        <span>Create sibling Study Note</span>
                      </Button>
                      <ButtonLink
                        to="/recall"
                        size="compact"
                        variant="secondary"
                      >
                        <CalendarCheckIcon />
                        <span>{practiceRepair.recallTodayActionLabel}</span>
                      </ButtonLink>
                    </div>
                  </section>
                )}

                {interleavedRecallRecommendation === null ? null : (
                  <section
                    aria-label={interleavedRecallRecommendation.title}
                    className="study-notes-interleaved-recall"
                  >
                    <div className="study-notes-interleaved-recall__header">
                      <p className="section-label">
                        {interleavedRecallRecommendation.title}
                      </p>
                      <h2 className="study-notes-interleaved-recall__title">
                        {interleavedRecallRecommendation.title}
                      </h2>
                      <p className="muted study-notes-editor__guidance">
                        {interleavedRecallRecommendation.summary}
                      </p>
                    </div>
                    <div className="study-notes-interleaved-recall__actions">
                      <Button
                        onClick={() => void handleStartInterleavedRecall()}
                        size="compact"
                        type="button"
                        variant="secondary"
                      >
                        {interleavedRecallRecommendation.actionLabel}
                      </Button>
                    </div>
                  </section>
                )}

                <section
                  aria-label="Reference explanation"
                  className="study-notes-editor__source study-notes-editor__info-section"
                >
                  <details
                    className="study-notes-editor__disclosure"
                    key={`reference-${selectedDisclosureKey}`}
                    onToggle={(event) =>
                      setReferenceOpenOverride(event.currentTarget.open)
                    }
                    open={isReferenceOpen}
                  >
                    <summary className="study-notes-editor__disclosure-summary">
                      <span>
                        <span className="study-notes-editor__group-label">
                          Reference explanation
                        </span>
                        <span className="study-notes-editor__summary-copy">
                          {referenceHasContent
                            ? "Source material available"
                            : "Secondary source material"}
                        </span>
                      </span>
                      <ChevronDownIcon />
                    </summary>
                    <div className="study-notes-editor__disclosure-body">
                      {sharedSourceReferenceGuidance === null ? null : (
                        <p className="muted study-notes-editor__guidance">
                          {sharedSourceReferenceGuidance}
                        </p>
                      )}
                      <StudyNotesTextarea
                        label="Note title"
                        maxLength={200}
                        onChange={(event) =>
                          updateDraft((current) => ({
                            ...current,
                            sourceTitle: event.target.value,
                          }))
                        }
                        rows={1}
                        value={draft.sourceTitle}
                      />
                      <StudyNotesTextarea
                        label="Explanation"
                        maxLength={1000}
                        onChange={(event) =>
                          updateDraft((current) => ({
                            ...current,
                            sourceBody: event.target.value,
                          }))
                        }
                        rows={6}
                        value={draft.sourceBody}
                      />
                    </div>
                  </details>
                </section>

                <section
                  aria-label="Recall insights"
                  className="study-notes-summary-card study-notes-recall-insights"
                  data-insight-kind={selectedRecallInsight.kind}
                >
                  <div className="study-notes-summary-card__header">
                    <span className="study-notes-summary-card__icon">
                      <TrendIcon />
                    </span>
                    <div>
                      <h3>{selectedRecallInsight.statusLabel}</h3>
                      <p>{selectedRecallInsight.description}</p>
                    </div>
                  </div>
                  <dl className="study-notes-summary-card__facts">
                    <StudyNoteFact
                      icon={<ClockIcon />}
                      label="Next recall"
                      value={selectedRecallInsight.nextRecall}
                    />
                    <StudyNoteFact
                      icon={<CalendarCheckIcon />}
                      label="Last result"
                      value={selectedRecallInsight.lastResult}
                    />
                    <StudyNoteFact
                      icon={<StudyNoteDocumentIcon />}
                      label="Suggested action"
                      value={selectedRecallInsight.suggestedAction}
                    />
                  </dl>
                </section>
              </div>
            </fieldset>

            {errorMessage === null || isSaveBarVisible ? null : (
              <p className="form-error" role="alert">
                {errorMessage}
              </p>
            )}
            {saveStatus === null || isSaveBarVisible ? null : (
              <p className="sr-only" aria-live="polite" role="status">
                {saveStatus}
              </p>
            )}
          </form>
        )}

        {isSaveBarVisible ? (
          <section
            aria-label="Unsaved Study Note changes"
            className="study-notes-save-bar"
          >
            <div className="study-notes-save-bar__message">
              <span className="study-notes-save-bar__icon">
                <WarningIcon />
              </span>
              <p
                aria-live={
                  isSaving || saveStatus !== null ? "polite" : undefined
                }
                role={isSaving || saveStatus !== null ? "status" : undefined}
              >
                {saveBarStatusText}
              </p>
              {errorMessage === null ? null : (
                <p className="study-notes-save-bar__error" role="alert">
                  {errorMessage}
                </p>
              )}
            </div>
            <div className="study-notes-save-bar__actions">
              {pendingEditorTarget === null ? null : (
                <Button
                  disabled={isSaving}
                  onClick={stayOnCurrentDraft}
                  size="compact"
                  type="button"
                >
                  Stay
                </Button>
              )}
              {pendingEditorTarget !== null ? (
                <>
                  <Button
                    disabled={isSaving}
                    onClick={discardDraft}
                    size="compact"
                    type="button"
                    variant="danger"
                  >
                    {getSaveBarDiscardAction(pendingEditorTarget)}
                  </Button>
                  <Button
                    disabled={isSaving}
                    onClick={() => void saveDraftAndApplyPendingTarget()}
                    size="compact"
                    type="button"
                    variant="primary"
                  >
                    {isSaving
                      ? "Saving..."
                      : getSaveBarPrimaryAction(pendingEditorTarget)}
                  </Button>
                </>
              ) : hasDraftChanges ? (
                <Button
                  disabled={isSaving}
                  onClick={discardDraft}
                  size="compact"
                  type="button"
                  variant="secondary"
                >
                  Discard changes
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        {isNewDiscardDialogOpen ? (
          <div className="study-notes-discard-dialog-backdrop">
            <section
              aria-labelledby="study-notes-discard-dialog-title"
              aria-modal="true"
              className="study-notes-discard-dialog"
              role="dialog"
            >
              <h2 id="study-notes-discard-dialog-title">
                Discard this new Study Note?
              </h2>
              <p>This note has not been saved yet.</p>
              <p>Your changes will be lost.</p>
              <div className="study-notes-discard-dialog__actions">
                <Button
                  onClick={() => setNewDiscardDialogOpen(false)}
                  type="button"
                  variant="secondary"
                >
                  Keep editing
                </Button>
                <Button
                  onClick={abandonNewDraft}
                  type="button"
                  variant="danger"
                >
                  Discard draft
                </Button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </PageLayout>
  );
}
