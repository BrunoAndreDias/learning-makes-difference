import type { AppNote } from "../notes";
import type { SessionResult } from "../recall";
import type { FocusRecord, FocusTarget } from "./focus";

type FocusWeeklyAnalyticsMetricId =
  | "notes-touched"
  | "notes-created"
  | "recall-answered"
  | "focus-minutes"
  | "completed-sessions"
  | "average-session-length";

export type FocusWeeklyAnalyticsMetric = {
  comparisonLabel: string;
  id: FocusWeeklyAnalyticsMetricId;
  label: string;
  value: string;
};

export type FocusWeeklyAnalytics = {
  heading: string;
  metrics: readonly FocusWeeklyAnalyticsMetric[];
};

type FocusWeeklyAnalyticsInput = {
  focusRecords: readonly FocusRecord[];
  notes: readonly AppNote[];
  now: Date;
  sessionResults: readonly SessionResult[];
};

type DateRange = {
  end: Date;
  start: Date;
};

type WeeklyAnalyticsTotals = {
  averageSessionLength: number;
  completedSessions: number;
  focusMinutes: number;
  notesCreated: number;
  notesTouched: number;
  recallAnswered: number;
};

type ComparisonMetricInput = {
  comparisonUnitSuffix: string;
  current: number;
  id: FocusWeeklyAnalyticsMetricId;
  label: string;
  previous: number;
  valueSuffix: string;
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const FOCUS_WEEKLY_ANALYTICS_HEADING = "This week at a glance";

export function deriveFocusWeeklyAnalytics(
  input: FocusWeeklyAnalyticsInput,
): FocusWeeklyAnalytics {
  const currentWeekRange = getUtcCalendarWeekRange(input.now);
  const previousWeekRange = getPreviousWeekRange(currentWeekRange);
  const currentWeek = getWeeklyAnalyticsTotals(input, currentWeekRange);
  const previousWeek = getWeeklyAnalyticsTotals(input, previousWeekRange);

  return {
    heading: FOCUS_WEEKLY_ANALYTICS_HEADING,
    metrics: [
      createComparisonMetric({
        comparisonUnitSuffix: "",
        current: currentWeek.notesTouched,
        id: "notes-touched",
        label: "Notes touched",
        previous: previousWeek.notesTouched,
        valueSuffix: "",
      }),
      createComparisonMetric({
        comparisonUnitSuffix: "",
        current: currentWeek.notesCreated,
        id: "notes-created",
        label: "Notes created",
        previous: previousWeek.notesCreated,
        valueSuffix: "",
      }),
      createComparisonMetric({
        comparisonUnitSuffix: "",
        current: currentWeek.recallAnswered,
        id: "recall-answered",
        label: "Recall answered",
        previous: previousWeek.recallAnswered,
        valueSuffix: "",
      }),
      createComparisonMetric({
        comparisonUnitSuffix: "",
        current: currentWeek.focusMinutes,
        id: "focus-minutes",
        label: "Focus minutes",
        previous: previousWeek.focusMinutes,
        valueSuffix: "",
      }),
      createComparisonMetric({
        comparisonUnitSuffix: "",
        current: currentWeek.completedSessions,
        id: "completed-sessions",
        label: "Completed sessions",
        previous: previousWeek.completedSessions,
        valueSuffix: "",
      }),
      createComparisonMetric({
        comparisonUnitSuffix: " min",
        current: currentWeek.averageSessionLength,
        id: "average-session-length",
        label: "Average session length",
        previous: previousWeek.averageSessionLength,
        valueSuffix: " min",
      }),
    ],
  };
}

function getUtcCalendarWeekRange(now: Date): DateRange {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());

  return {
    end: new Date(start.getTime() + 7 * DAY_IN_MILLISECONDS - 1),
    start,
  };
}

function getPreviousWeekRange(currentWeekRange: DateRange): DateRange {
  return {
    end: new Date(currentWeekRange.start.getTime() - 1),
    start: new Date(currentWeekRange.start.getTime() - 7 * DAY_IN_MILLISECONDS),
  };
}

function getWeeklyAnalyticsTotals(
  input: FocusWeeklyAnalyticsInput,
  range: DateRange,
): WeeklyAnalyticsTotals {
  const focusRecords = input.focusRecords.filter((record) =>
    isTimestampWithinRange(record.endedAt, range),
  );
  const notes = input.notes.filter((note) =>
    isTimestampWithinRange(note.createdAt, range),
  );
  const sessionResults = input.sessionResults.filter((result) =>
    isTimestampWithinRange(result.completedAt, range),
  );
  const focusMinutes = getFocusMinutes(focusRecords);

  return {
    averageSessionLength: getAverageSessionLength(focusRecords, focusMinutes),
    completedSessions: focusRecords.length,
    focusMinutes,
    notesCreated: notes.length,
    notesTouched: getUniqueTouchedNoteCount(focusRecords),
    recallAnswered: getRecallAnsweredCount(sessionResults),
  };
}

function isTimestampWithinRange(timestamp: string, range: DateRange) {
  const value = Date.parse(timestamp);
  return value >= range.start.getTime() && value <= range.end.getTime();
}

function getUniqueTouchedNoteCount(records: readonly FocusRecord[]) {
  const noteIds = new Set<string>();

  for (const record of records) {
    addTouchedNoteIds(noteIds, record.targets);
    addTouchedNoteIds(noteIds, record.focusTargets);
  }

  return noteIds.size;
}

function addTouchedNoteIds(
  noteIds: Set<string>,
  targets: readonly FocusTarget[],
) {
  for (const target of targets) {
    if (!isNoteFocusTarget(target)) {
      continue;
    }

    noteIds.add(target.note.id);
  }
}

function isNoteFocusTarget(
  target: FocusTarget,
): target is Extract<FocusTarget, { kind: "Note" }> {
  return target.kind === "Note";
}

function getRecallAnsweredCount(results: readonly SessionResult[]) {
  return results.reduce((total, result) => total + result.attempts.length, 0);
}

function getFocusMinutes(records: readonly FocusRecord[]) {
  return records.reduce(
    (total, record) =>
      total + record.completedFocusIntervalCount * record.focusIntervalMinutes,
    0,
  );
}

function getAverageSessionLength(
  records: readonly FocusRecord[],
  focusMinutes: number,
) {
  if (records.length === 0) {
    return 0;
  }

  return Math.round(focusMinutes / records.length);
}

function createComparisonMetric(
  input: ComparisonMetricInput,
): FocusWeeklyAnalyticsMetric {
  return {
    comparisonLabel: formatComparisonLabel({
      current: input.current,
      previous: input.previous,
      unitSuffix: input.comparisonUnitSuffix,
    }),
    id: input.id,
    label: input.label,
    value: `${input.current}${input.valueSuffix}`,
  };
}

function formatComparisonLabel(input: {
  current: number;
  previous: number;
  unitSuffix: string;
}) {
  const difference = input.current - input.previous;

  if (difference === 0) {
    return "No change vs last week";
  }

  const sign = difference > 0 ? "+" : "";
  return `${sign}${difference}${input.unitSuffix} vs last week`;
}
