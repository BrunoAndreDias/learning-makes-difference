import { describe, expect, it } from "vitest";
import type { AppNote } from "../notes";
import type { SessionResult } from "../recall";
import type {
  FocusRecord,
  FocusTarget,
  StudyActivityNoteSnapshot,
} from "./focus";
import { deriveFocusWeeklyAnalytics } from "./focus-weekly-analytics";

describe("deriveFocusWeeklyAnalytics", () => {
  it("derives current-week metrics with previous-week comparisons", () => {
    const currentWeekNote = createNote(
      "note-current",
      "2026-05-05T09:00:00.000Z",
    );
    const previousWeekNote = createNote(
      "note-previous",
      "2026-04-27T09:00:00.000Z",
    );
    const untouchedNote = createNote(
      "note-untouched",
      "2026-04-20T09:00:00.000Z",
    );

    const analytics = deriveFocusWeeklyAnalytics({
      focusRecords: [
        createFocusRecord({
          endedAt: "2026-05-05T10:25:00.000Z",
          focusIntervalMinutes: 25,
          id: "focus-current-1",
          noteIds: [currentWeekNote.id],
        }),
        createFocusRecord({
          completedFocusIntervalCount: 2,
          endedAt: "2026-05-06T10:55:00.000Z",
          focusIntervalMinutes: 25,
          id: "focus-current-2",
          noteIds: [currentWeekNote.id, untouchedNote.id],
        }),
        createFocusRecord({
          endedAt: "2026-04-28T10:25:00.000Z",
          focusIntervalMinutes: 25,
          id: "focus-previous-1",
          noteIds: [previousWeekNote.id],
        }),
      ],
      notes: [currentWeekNote, previousWeekNote, untouchedNote],
      now: new Date("2026-05-06T12:00:00.000Z"),
      sessionResults: [
        createSessionResult({
          attempts: 3,
          completedAt: "2026-05-05T13:00:00.000Z",
          id: "recall-current",
        }),
        createSessionResult({
          attempts: 1,
          completedAt: "2026-04-29T13:00:00.000Z",
          id: "recall-previous",
        }),
      ],
    });

    expect(analytics.heading).toBe("This week at a glance");
    expect(analytics.metrics).toEqual([
      {
        comparisonLabel: "+1 vs last week",
        id: "notes-touched",
        label: "Study Notes touched",
        value: "2",
      },
      {
        comparisonLabel: "No change vs last week",
        id: "notes-created",
        label: "Study Notes created",
        value: "1",
      },
      {
        comparisonLabel: "+2 vs last week",
        id: "recall-answered",
        label: "Recall answered",
        value: "3",
      },
      {
        comparisonLabel: "+50 vs last week",
        id: "focus-minutes",
        label: "Focus minutes",
        value: "75",
      },
      {
        comparisonLabel: "+1 vs last week",
        id: "completed-sessions",
        label: "Completed sessions",
        value: "2",
      },
      {
        comparisonLabel: "+13 min vs last week",
        id: "average-session-length",
        label: "Average session length",
        value: "38 min",
      },
    ]);
  });

  it("returns stable zero states when there is no data", () => {
    const analytics = deriveFocusWeeklyAnalytics({
      focusRecords: [],
      notes: [],
      now: new Date("2026-05-06T12:00:00.000Z"),
      sessionResults: [],
    });

    expect(analytics.metrics).toEqual([
      {
        comparisonLabel: "No change vs last week",
        id: "notes-touched",
        label: "Study Notes touched",
        value: "0",
      },
      {
        comparisonLabel: "No change vs last week",
        id: "notes-created",
        label: "Study Notes created",
        value: "0",
      },
      {
        comparisonLabel: "No change vs last week",
        id: "recall-answered",
        label: "Recall answered",
        value: "0",
      },
      {
        comparisonLabel: "No change vs last week",
        id: "focus-minutes",
        label: "Focus minutes",
        value: "0",
      },
      {
        comparisonLabel: "No change vs last week",
        id: "completed-sessions",
        label: "Completed sessions",
        value: "0",
      },
      {
        comparisonLabel: "No change vs last week",
        id: "average-session-length",
        label: "Average session length",
        value: "0 min",
      },
    ]);
  });

  it("counts only note focus targets and ignores break time in average session length", () => {
    const note = createNote("note-target", "2026-05-05T09:00:00.000Z");

    const analytics = deriveFocusWeeklyAnalytics({
      focusRecords: [
        {
          ...createFocusRecord({
            completedFocusIntervalCount: 1,
            endedAt: "2026-05-05T10:25:00.000Z",
            focusIntervalMinutes: 25,
            id: "focus-current-mixed",
            noteIds: [note.id],
          }),
          completedBreakIntervalCount: 3,
          focusTargets: [
            createNoteTarget(note.id),
            createRecallSessionTarget([note]),
          ],
          targets: [
            createNoteTarget(note.id),
            createRecallSessionTarget([note]),
          ],
        },
      ],
      notes: [note],
      now: new Date("2026-05-06T12:00:00.000Z"),
      sessionResults: [],
    });

    expect(analytics.metrics).toContainEqual({
      comparisonLabel: "+1 vs last week",
      id: "notes-touched",
      label: "Study Notes touched",
      value: "1",
    });
    expect(analytics.metrics).toContainEqual({
      comparisonLabel: "+25 min vs last week",
      id: "average-session-length",
      label: "Average session length",
      value: "25 min",
    });
  });

  it("counts Study Note editor and RecallSession focus targets as touched practice objects", () => {
    const sourceNote = createNote(
      "source-note-target",
      "2026-05-05T09:00:00.000Z",
    );

    const analytics = deriveFocusWeeklyAnalytics({
      focusRecords: [
        {
          ...createFocusRecord({
            endedAt: "2026-05-05T10:25:00.000Z",
            focusIntervalMinutes: 25,
            id: "focus-current-study-notes",
            noteIds: [],
          }),
          focusTargets: [
            createRecallSessionTarget([
              {
                ...sourceNote,
                expectedAnswer: "Expected answer",
                id: "study-note-recall",
                prompt: "Recall prompt",
                source: {
                  body: sourceNote.body,
                  id: sourceNote.id,
                  title: sourceNote.title,
                  updatedAt: sourceNote.updatedAt,
                },
                sourceNoteId: sourceNote.id,
                title: "Recall prompt",
              } satisfies StudyActivityNoteSnapshot,
            ]),
          ],
          targets: [
            {
              kind: "StudyNote",
              labels: [],
              sourceNote: {
                body: sourceNote.body,
                id: sourceNote.id,
                title: sourceNote.title,
                updatedAt: sourceNote.updatedAt,
              },
              studyNote: {
                acronyms: [],
                createdAt: "2026-05-05T09:00:00.000Z",
                expectedAnswer: "Expected answer",
                id: "study-note-edited",
                labelIds: [],
                metaphors: [],
                prompt: "Edited prompt",
                source: {
                  body: sourceNote.body,
                  id: sourceNote.id,
                  title: sourceNote.title,
                  updatedAt: sourceNote.updatedAt,
                },
                sourceNoteId: sourceNote.id,
                updatedAt: "2026-05-05T09:05:00.000Z",
              },
            },
          ],
        },
      ],
      notes: [sourceNote],
      now: new Date("2026-05-06T12:00:00.000Z"),
      sessionResults: [],
    });

    expect(analytics.metrics).toContainEqual({
      comparisonLabel: "+2 vs last week",
      id: "notes-touched",
      label: "Study Notes touched",
      value: "2",
    });
  });
});

function createNote(id: string, createdAt: string): AppNote {
  return {
    acronyms: [],
    body: `${id} body`,
    createdAt,
    id,
    labelIds: [],
    metaphors: [],
    title: `${id} title`,
    updatedAt: createdAt,
  };
}

function createSessionResult(input: {
  attempts: number;
  completedAt: string;
  id: string;
}): SessionResult {
  return {
    attempts: Array.from({ length: input.attempts }, (_, index) => ({
      noteId: `note-${index}`,
      rating: "good",
    })),
    completedAt: input.completedAt,
    createdAt: input.completedAt,
    id: input.id,
    mode: "FlashCard",
    notes: [],
    questions: [],
    score: null,
  };
}

function createFocusRecord(input: {
  completedFocusIntervalCount?: number;
  endedAt: string;
  focusIntervalMinutes: number;
  id: string;
  noteIds: string[];
}): FocusRecord {
  const startedAt = new Date(
    Date.parse(input.endedAt) -
      (input.completedFocusIntervalCount ?? 1) *
        input.focusIntervalMinutes *
        60 *
        1000,
  ).toISOString();

  return {
    breakIntervalMinutes: 5,
    completedBreakIntervalCount: 0,
    completedFocusIntervalCount: input.completedFocusIntervalCount ?? 1,
    createdAt: startedAt,
    endedAt: input.endedAt,
    focusIntervalMinutes: input.focusIntervalMinutes,
    focusTargets: input.noteIds.map(createNoteTarget),
    id: input.id,
    intervals: [],
    method: "Pomodoro",
    plannedFocusIntervalCount: null,
    startedAt,
    targets: input.noteIds.map(createNoteTarget),
  };
}

function createNoteTarget(noteId: string): FocusTarget {
  return {
    kind: "Note",
    labels: [],
    note: createNote(noteId, "2026-04-01T00:00:00.000Z"),
  };
}

function createRecallSessionTarget(
  notes: readonly StudyActivityNoteSnapshot[],
): FocusTarget {
  return {
    kind: "RecallSession",
    labels: [],
    notes,
    recallSession: {
      createdAt: "2026-05-05T10:00:00.000Z",
      id: "recall-session-target",
      mode: "FlashCard",
    },
  };
}
