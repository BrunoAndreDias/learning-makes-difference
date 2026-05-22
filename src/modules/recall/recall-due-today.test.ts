import { describe, expect, it } from "vitest";

import type { AppStudyNote } from "../study-notes";
import type { StudyNoteRecallHistory } from "../study-notes/learning-state";
import type { SessionResult } from "./recall";
import { buildDueTodayQueue } from "./recall-due-today";
import type { RecallSchedule } from "./recall-schedule";

const timestamp = "2026-05-01T09:00:00.000Z";

function buildStudyNote(
  overrides: Partial<AppStudyNote> & Pick<AppStudyNote, "id" | "prompt">,
): AppStudyNote {
  const { id, prompt, ...rest } = overrides;

  return {
    acceptedVariants: [],
    acronyms: [],
    createdAt: timestamp,
    expectedAnswer: "Expected answer",
    id,
    keyIdeas: [],
    labelIds: [],
    metaphors: [],
    prompt,
    prohibitedPhrases: [],
    source: {
      body: "Source body",
      id: `source-${id}`,
      title: "Source title",
      updatedAt: timestamp,
    },
    sourceNoteId: `source-${id}`,
    updatedAt: timestamp,
    ...rest,
  };
}

function buildHistory(
  studyNoteId: string,
  rating: "forgot" | "hard" | "good" | "easy",
): StudyNoteRecallHistory {
  return {
    attempts: [
      {
        completedAt: "2026-05-14T09:00:00.000Z",
        rating,
      },
    ],
    studyNoteId,
  };
}

function buildSchedule(
  studyNoteId: string,
  nextRecallAt: string,
): RecallSchedule {
  return {
    ease: 2.35,
    intervalDays: 1,
    lastRecalledAt: "2026-05-14T09:00:00.000Z",
    nextRecallAt,
    repetitionCount: 1,
    studyNoteId,
  };
}

function buildPracticeRepairResult(input: {
  lifecycle?: {
    completedAt?: string | null;
    dismissedAt?: string | null;
    followUpSatisfiedAt?: string | null;
    studyNoteDeletedAt?: string | null;
    supersededAt?: string | null;
  };
  resultId: string;
  studyNote: AppStudyNote;
}): SessionResult {
  return {
    attempts: [
      {
        noteId: input.studyNote.id,
        rating: "hard",
      },
    ],
    completedAt: "2026-05-14T09:00:00.000Z",
    createdAt: "2026-05-14T08:55:00.000Z",
    id: input.resultId,
    mode: "FlashCard",
    notes: [
      {
        acronyms: [],
        body: input.studyNote.expectedAnswer,
        createdAt: input.studyNote.createdAt,
        expectedAnswer: input.studyNote.expectedAnswer,
        id: input.studyNote.id,
        labelIds: input.studyNote.labelIds,
        metaphors: [],
        prompt: input.studyNote.prompt,
        source: { ...input.studyNote.source },
        sourceNoteId: input.studyNote.sourceNoteId,
        title: input.studyNote.prompt,
        updatedAt: input.studyNote.updatedAt,
      },
    ],
    questions: [
      {
        isAnswerRevealed: true,
        noteId: input.studyNote.id,
        noteSnapshot: {
          acronyms: [],
          body: input.studyNote.expectedAnswer,
          createdAt: input.studyNote.createdAt,
          expectedAnswer: input.studyNote.expectedAnswer,
          id: input.studyNote.id,
          labelIds: input.studyNote.labelIds,
          metaphors: [],
          prompt: input.studyNote.prompt,
          source: { ...input.studyNote.source },
          sourceNoteId: input.studyNote.sourceNoteId,
          title: input.studyNote.prompt,
          updatedAt: input.studyNote.updatedAt,
        },
        practiceRepairEntry: {
          confirmedAt: "2026-05-14T09:02:00.000Z",
          correction: "Repair the answer.",
          intent: "tighten-expected-answer",
          intentMetadata: {
            updatedExpectedAnswer: "Updated expected answer",
          },
          lifecycle: input.lifecycle,
          reference: {
            questionIndex: 0,
            questionResultId: `${input.resultId}-question`,
            sessionResultId: input.resultId,
            studyNoteId: input.studyNote.id,
          },
        },
        questionResultId: `${input.resultId}-question`,
        score: 50,
        selfRating: "hard",
        typedAnswer: "",
      },
    ],
    score: 50,
  };
}

describe("Due today queue", () => {
  it("keeps only Due for Recall Study Notes from recall work planning", () => {
    const dueNeedsPractice = buildStudyNote({
      id: "due-needs-practice",
      prompt: "Due and needs practice",
    });
    const dueFollowUp = buildStudyNote({
      id: "due-follow-up",
      prompt: "Due with follow-up",
    });
    const overdue = buildStudyNote({
      id: "overdue",
      prompt: "Overdue note",
    });
    const future = buildStudyNote({
      id: "future",
      prompt: "Future note",
    });
    const incomplete = buildStudyNote({
      expectedAnswer: " ",
      id: "incomplete",
      prompt: "Incomplete note",
    });
    const unresolvedRepair = buildStudyNote({
      id: "unresolved-repair",
      prompt: "Unresolved repair note",
    });

    const queue = buildDueTodayQueue({
      histories: [
        buildHistory(dueNeedsPractice.id, "hard"),
        buildHistory(dueFollowUp.id, "good"),
        buildHistory(overdue.id, "good"),
        buildHistory(future.id, "easy"),
        buildHistory(unresolvedRepair.id, "good"),
      ],
      now: "2026-05-15T10:00:00.000Z",
      recallSchedules: [
        buildSchedule(dueNeedsPractice.id, "2026-05-15T23:30:00.000Z"),
        buildSchedule(dueFollowUp.id, "2026-05-15T08:00:00.000Z"),
        buildSchedule(overdue.id, "2026-05-13T08:00:00.000Z"),
        buildSchedule(future.id, "2026-05-16T08:00:00.000Z"),
        buildSchedule(incomplete.id, "2026-05-15T08:00:00.000Z"),
        buildSchedule(unresolvedRepair.id, "2026-05-15T07:00:00.000Z"),
      ],
      sessionResults: [
        buildPracticeRepairResult({
          lifecycle: {
            completedAt: "2026-05-14T09:10:00.000Z",
          },
          resultId: "due-follow-up-result",
          studyNote: dueFollowUp,
        }),
        buildPracticeRepairResult({
          resultId: "unresolved-repair-result",
          studyNote: unresolvedRepair,
        }),
      ],
      studyNotes: [
        future,
        dueNeedsPractice,
        unresolvedRepair,
        incomplete,
        overdue,
        dueFollowUp,
      ],
      userTimeZone: "America/New_York",
    });

    expect(queue.map((item) => item.studyNote.id)).toEqual([overdue.id]);
  });
});
