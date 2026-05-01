import type { AppLabel } from "../../labels/domain/labels";
import { type AppNote, filterNotesByQuery } from "./notes";
import type { RecallSelfRating, SessionResult } from "./recall";

const RECENT_NOTE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RATING_REVIEW_DELAY_MS: Record<RecallSelfRating, number> = {
  missed: 0,
  nailed: 3 * 24 * 60 * 60 * 1000,
  partial: 24 * 60 * 60 * 1000,
};
const ESTIMATED_MINUTES_PER_NOTE = 2;

type RecallSetupHistory = {
  completedAt: string;
  rating: RecallSelfRating;
};

export type RecallSetupFilter =
  | { kind: "all" }
  | { kind: "due" }
  | { kind: "recent" }
  | { kind: "weak" }
  | { kind: "label"; labelId: string };

export type RecallSetupCandidate = {
  isSelected: boolean;
  labelNames: string[];
  latestCompletedAt: string | null;
  latestRating: RecallSelfRating | null;
  note: AppNote;
};

export type RecallSetupSelectedSummary = {
  id: string;
  labelNames: string[];
  latestCompletedAt: string | null;
  latestRating: RecallSelfRating | null;
  title: string;
};

export type RecallSetupFilterSummary =
  | {
      count: number;
      kind: "all" | "due" | "recent" | "weak";
    }
  | {
      count: number;
      kind: "label";
      labelId: string;
      labelName: string;
    };

export type RecallSetupEmptyState =
  | "none"
  | "no-filter-matches"
  | "no-notes"
  | "no-search-matches"
  | "no-selected-notes";

export type RecallSetupAvailableEmptyState = Exclude<
  RecallSetupEmptyState,
  "no-selected-notes"
>;

export type RecallSetupState = {
  availableEmptyState: RecallSetupAvailableEmptyState;
  filterSummaries: RecallSetupFilterSummary[];
  selectedEmptyState: "none" | "no-selected-notes";
  selectedSummaries: RecallSetupSelectedSummary[];
  summary: {
    difficultyLabel: string;
    estimatedTimeLabel: string;
    practiceTypeLabel: string;
    selectedCount: number;
    startDisabledReason: string | null;
  };
  visibleCandidates: RecallSetupCandidate[];
};

function getLatestHistoryByNoteId(
  sessionResults: readonly SessionResult[],
): Map<string, RecallSetupHistory> {
  const latestHistoryByNoteId = new Map<string, RecallSetupHistory>();
  const sortedResults = [...sessionResults].sort((left, right) =>
    right.completedAt.localeCompare(left.completedAt),
  );

  for (const result of sortedResults) {
    for (const attempt of result.attempts) {
      if (latestHistoryByNoteId.has(attempt.noteId)) {
        continue;
      }

      latestHistoryByNoteId.set(attempt.noteId, {
        completedAt: result.completedAt,
        rating: attempt.rating,
      });
    }
  }

  return latestHistoryByNoteId;
}

function isRecentNote(note: AppNote, nowValue: number) {
  return nowValue - new Date(note.updatedAt).getTime() <= RECENT_NOTE_WINDOW_MS;
}

function isWeakNote(history: RecallSetupHistory | undefined) {
  return history?.rating === "missed" || history?.rating === "partial";
}

function isDueNow(
  history: RecallSetupHistory | undefined,
  nowValue: number,
): boolean {
  if (history === undefined) {
    return true;
  }

  const completedAtValue = new Date(history.completedAt).getTime();

  return completedAtValue + RATING_REVIEW_DELAY_MS[history.rating] <= nowValue;
}

function matchesFilter(
  note: AppNote,
  filter: RecallSetupFilter,
  history: RecallSetupHistory | undefined,
  nowValue: number,
) {
  switch (filter.kind) {
    case "all":
      return true;
    case "due":
      return isDueNow(history, nowValue);
    case "recent":
      return isRecentNote(note, nowValue);
    case "weak":
      return isWeakNote(history);
    case "label":
      return note.labelIds.includes(filter.labelId);
  }
}

function getLabelNames(
  note: AppNote,
  labelNameById: ReadonlyMap<string, string>,
): string[] {
  return note.labelIds
    .map((labelId) => labelNameById.get(labelId))
    .filter((labelName): labelName is string => labelName !== undefined);
}

function formatEstimatedTimeLabel(selectedCount: number) {
  return `${selectedCount * ESTIMATED_MINUTES_PER_NOTE} min`;
}

function getPracticeTypeLabel(filter: RecallSetupFilter) {
  switch (filter.kind) {
    case "all":
      return "General recall";
    case "due":
      return "Due review";
    case "recent":
      return "Recent-note warmup";
    case "weak":
      return "Weak-note review";
    case "label":
      return "Label drill";
  }
}

function getDifficultyLabel(
  selectedSummaries: readonly RecallSetupSelectedSummary[],
) {
  if (selectedSummaries.length === 0) {
    return "No notes selected";
  }

  const ratings = selectedSummaries.map((summary) => summary.latestRating);

  if (ratings.every((rating) => rating === null)) {
    return "First-pass recall";
  }

  if (ratings.some((rating) => rating === "missed" || rating === "partial")) {
    return "Challenging mix";
  }

  if (ratings.every((rating) => rating === "nailed")) {
    return "Maintenance review";
  }

  return "Mixed difficulty";
}

function getAvailableEmptyState(input: {
  hasFilterMatches: boolean;
  hasNotes: boolean;
  hasSearchQuery: boolean;
  visibleCandidateCount: number;
}): RecallSetupAvailableEmptyState {
  if (!input.hasNotes) {
    return "no-notes";
  }

  if (input.visibleCandidateCount > 0) {
    return "none";
  }

  if (input.hasSearchQuery) {
    return "no-search-matches";
  }

  if (!input.hasFilterMatches) {
    return "no-filter-matches";
  }

  return "no-search-matches";
}

function buildFilterSummaries(input: {
  labels: readonly AppLabel[];
  latestHistoryByNoteId: ReadonlyMap<string, RecallSetupHistory>;
  notes: readonly AppNote[];
  nowValue: number;
}): RecallSetupFilterSummary[] {
  const countNotes = (predicate: (note: AppNote) => boolean) =>
    input.notes.filter(predicate).length;
  const baseFilters: RecallSetupFilterSummary[] = [
    { count: input.notes.length, kind: "all" },
    {
      count: countNotes((note) =>
        isDueNow(input.latestHistoryByNoteId.get(note.id), input.nowValue),
      ),
      kind: "due",
    },
    {
      count: countNotes((note) =>
        isWeakNote(input.latestHistoryByNoteId.get(note.id)),
      ),
      kind: "weak",
    },
    {
      count: countNotes((note) => isRecentNote(note, input.nowValue)),
      kind: "recent",
    },
  ];

  const labelFilters = input.labels.map((label) => ({
    count: countNotes((note) => note.labelIds.includes(label.id)),
    kind: "label" as const,
    labelId: label.id,
    labelName: label.name,
  }));

  return [...baseFilters, ...labelFilters];
}

function buildCandidate(input: {
  history: RecallSetupHistory | undefined;
  labelNameById: ReadonlyMap<string, string>;
  note: AppNote;
  selectedNoteIdSet: ReadonlySet<string>;
}): RecallSetupCandidate {
  return {
    isSelected: input.selectedNoteIdSet.has(input.note.id),
    labelNames: getLabelNames(input.note, input.labelNameById),
    latestCompletedAt: input.history?.completedAt ?? null,
    latestRating: input.history?.rating ?? null,
    note: input.note,
  };
}

function buildSelectedSummary(input: {
  history: RecallSetupHistory | undefined;
  labelNameById: ReadonlyMap<string, string>;
  note: AppNote;
}): RecallSetupSelectedSummary {
  return {
    id: input.note.id,
    labelNames: getLabelNames(input.note, input.labelNameById),
    latestCompletedAt: input.history?.completedAt ?? null,
    latestRating: input.history?.rating ?? null,
    title: input.note.title,
  };
}

export function deriveRecallSetupState(input: {
  labels: readonly AppLabel[];
  notes: readonly AppNote[];
  now: string;
  searchQuery: string;
  selectedFilter: RecallSetupFilter;
  selectedNoteIds: readonly string[];
  sessionResults: readonly SessionResult[];
}): RecallSetupState {
  const latestHistoryByNoteId = getLatestHistoryByNoteId(input.sessionResults);
  const labelNameById = new Map(
    input.labels.map((label) => [label.id, label.name] as const),
  );
  const noteById = new Map(input.notes.map((note) => [note.id, note] as const));
  const nowValue = new Date(input.now).getTime();
  const selectedNoteIdSet = new Set(input.selectedNoteIds);
  const filterMatchedNotes = input.notes.filter((note) =>
    matchesFilter(
      note,
      input.selectedFilter,
      latestHistoryByNoteId.get(note.id),
      nowValue,
    ),
  );
  const visibleNotes = filterNotesByQuery(
    filterMatchedNotes,
    input.searchQuery,
  );
  const visibleCandidates = visibleNotes.map((note) => {
    return buildCandidate({
      history: latestHistoryByNoteId.get(note.id),
      labelNameById,
      note,
      selectedNoteIdSet,
    });
  });
  const selectedSummaries = input.selectedNoteIds
    .map((noteId) => {
      const note = noteById.get(noteId);

      if (note === undefined) {
        return null;
      }

      return buildSelectedSummary({
        history: latestHistoryByNoteId.get(note.id),
        labelNameById,
        note,
      });
    })
    .filter(
      (summary): summary is RecallSetupSelectedSummary => summary !== null,
    );

  return {
    availableEmptyState: getAvailableEmptyState({
      hasFilterMatches: filterMatchedNotes.length > 0,
      hasNotes: input.notes.length > 0,
      hasSearchQuery: input.searchQuery.trim().length > 0,
      visibleCandidateCount: visibleCandidates.length,
    }),
    filterSummaries: buildFilterSummaries({
      labels: input.labels,
      latestHistoryByNoteId,
      notes: input.notes,
      nowValue,
    }),
    selectedEmptyState:
      selectedSummaries.length === 0 ? "no-selected-notes" : "none",
    selectedSummaries,
    summary: {
      difficultyLabel: getDifficultyLabel(selectedSummaries),
      estimatedTimeLabel: formatEstimatedTimeLabel(selectedSummaries.length),
      practiceTypeLabel: getPracticeTypeLabel(input.selectedFilter),
      selectedCount: selectedSummaries.length,
      startDisabledReason:
        selectedSummaries.length === 0
          ? "Pick at least one note to start recall."
          : null,
    },
    visibleCandidates,
  };
}
