import type { AppNote } from "../notes";
import type { SessionResult } from "../recall";
import type { FocusRecord, FocusTarget } from "./focus";

export type FocusWeeklyAnalyticsMetric = {
  comparisonLabel: string;
  id:
    | "notes-touched"
    | "notes-created"
    | "recall-answered"
    | "focus-minutes"
    | "completed-sessions"
    | "average-session-length";
  label: string;
  value: string;
};

export type FocusWeeklyAnalytics = {
  heading: string;
  metrics: readonly FocusWeeklyAnalyticsMetric[];
};

export function deriveFocusWeeklyAnalytics(input: {
  focusRecords: readonly FocusRecord[];
  notes: readonly AppNote[];
  now: Date;
  sessionResults: readonly SessionResult[];
}): FocusWeeklyAnalytics {
  const currentWeekRange = getUtcCalendarWeekRange(input.now);
  const previousWeekRange = {
    end: new Date(currentWeekRange.start.getTime() - 1),
    start: new Date(currentWeekRange.start.getTime() - 7 * DAY_IN_MILLISECONDS),
  };

  const currentWeekRecords = input.focusRecords.filter((record) =>
    isTimestampWithinRange(record.endedAt, currentWeekRange),
  );
  const previousWeekRecords = input.focusRecords.filter((record) =>
    isTimestampWithinRange(record.endedAt, previousWeekRange),
  );
  const currentWeekNotes = input.notes.filter((note) =>
    isTimestampWithinRange(note.createdAt, currentWeekRange),
  );
  const previousWeekNotes = input.notes.filter((note) =>
    isTimestampWithinRange(note.createdAt, previousWeekRange),
  );
  const currentWeekResults = input.sessionResults.filter((result) =>
    isTimestampWithinRange(result.completedAt, currentWeekRange),
  );
  const previousWeekResults = input.sessionResults.filter((result) =>
    isTimestampWithinRange(result.completedAt, previousWeekRange),
  );

  const currentNotesTouched = getUniqueTouchedNoteCount(currentWeekRecords);
  const previousNotesTouched = getUniqueTouchedNoteCount(previousWeekRecords);
  const currentNotesCreated = currentWeekNotes.length;
  const previousNotesCreated = previousWeekNotes.length;
  const currentRecallAnswered = getRecallAnsweredCount(currentWeekResults);
  const previousRecallAnswered = getRecallAnsweredCount(previousWeekResults);
  const currentFocusMinutes = getFocusMinutes(currentWeekRecords);
  const previousFocusMinutes = getFocusMinutes(previousWeekRecords);
  const currentCompletedSessions = currentWeekRecords.length;
  const previousCompletedSessions = previousWeekRecords.length;
  const currentAverageSessionLength =
    getAverageSessionLength(currentWeekRecords);
  const previousAverageSessionLength =
    getAverageSessionLength(previousWeekRecords);

  return {
    heading: "This week at a glance",
    metrics: [
      {
        comparisonLabel: formatComparisonLabel({
          current: currentNotesTouched,
          previous: previousNotesTouched,
        }),
        id: "notes-touched",
        label: "Notes touched",
        value: String(currentNotesTouched),
      },
      {
        comparisonLabel: formatComparisonLabel({
          current: currentNotesCreated,
          previous: previousNotesCreated,
        }),
        id: "notes-created",
        label: "Notes created",
        value: String(currentNotesCreated),
      },
      {
        comparisonLabel: formatComparisonLabel({
          current: currentRecallAnswered,
          previous: previousRecallAnswered,
        }),
        id: "recall-answered",
        label: "Recall answered",
        value: String(currentRecallAnswered),
      },
      {
        comparisonLabel: formatComparisonLabel({
          current: currentFocusMinutes,
          previous: previousFocusMinutes,
        }),
        id: "focus-minutes",
        label: "Focus minutes",
        value: String(currentFocusMinutes),
      },
      {
        comparisonLabel: formatComparisonLabel({
          current: currentCompletedSessions,
          previous: previousCompletedSessions,
        }),
        id: "completed-sessions",
        label: "Completed sessions",
        value: String(currentCompletedSessions),
      },
      {
        comparisonLabel: formatComparisonLabel({
          current: currentAverageSessionLength,
          previous: previousAverageSessionLength,
          unitSuffix: " min",
        }),
        id: "average-session-length",
        label: "Average session length",
        value: `${currentAverageSessionLength} min`,
      },
    ],
  };
}

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function getUtcCalendarWeekRange(now: Date) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());

  return {
    end: new Date(start.getTime() + 7 * DAY_IN_MILLISECONDS - 1),
    start,
  };
}

function isTimestampWithinRange(
  timestamp: string,
  range: { end: Date; start: Date },
) {
  const value = Date.parse(timestamp);
  return value >= range.start.getTime() && value <= range.end.getTime();
}

function getUniqueTouchedNoteCount(records: readonly FocusRecord[]) {
  const noteIds = new Set<string>();

  for (const record of records) {
    for (const target of [...record.targets, ...record.focusTargets]) {
      if (!isNoteFocusTarget(target)) {
        continue;
      }

      noteIds.add(target.note.id);
    }
  }

  return noteIds.size;
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

function getAverageSessionLength(records: readonly FocusRecord[]) {
  if (records.length === 0) {
    return 0;
  }

  return Math.round(getFocusMinutes(records) / records.length);
}

function formatComparisonLabel(input: {
  current: number;
  previous: number;
  unitSuffix?: string;
}) {
  const difference = input.current - input.previous;

  if (difference === 0) {
    return "No change vs last week";
  }

  const sign = difference > 0 ? "+" : "";
  return `${sign}${difference}${input.unitSuffix ?? ""} vs last week`;
}
