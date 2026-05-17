import { describe, expect, it } from "vitest";

import type {
  FlashCardRecallAttemptsByNote,
  RecallSchedule,
  RecallSelfRating,
} from "../recall";
import type { AppStudyNote } from "../study-notes";
import { getFocusLearningLoopSupportSuggestions } from "./learning-loop-support";

type FocusLearningLoopSupportInput = Parameters<
  typeof getFocusLearningLoopSupportSuggestions
>[0];

const timestamp = "2026-05-17T09:00:00.000Z";
const practiceRepairSuggestion = {
  actionId: "practice-repair",
  href: "/study-notes",
} as const;
const recallTodaySuggestion = {
  actionId: "recall-today",
  href: "/recall",
} as const;

function buildStudyNote(
  overrides: Partial<AppStudyNote> & Pick<AppStudyNote, "id" | "prompt">,
): AppStudyNote {
  const { id, prompt, ...rest } = overrides;

  return {
    acronyms: [],
    createdAt: timestamp,
    expectedAnswer: "Expected answer",
    id,
    labelIds: [],
    metaphors: [],
    prompt,
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

function buildAttempts(
  studyNote: AppStudyNote,
  rating: RecallSelfRating,
): FlashCardRecallAttemptsByNote {
  const attempts: FlashCardRecallAttemptsByNote["attempts"] = [
    {
      bodySnapshot: "Answer body",
      completedAt: "2026-05-16T09:00:00.000Z",
      rating,
      sessionId: `session-${studyNote.id}`,
      snapshotTitle: studyNote.prompt,
    },
  ];

  return {
    attempts,
    currentTitle: null,
    easy: rating === "easy" ? 1 : 0,
    forgot: rating === "forgot" ? 1 : 0,
    good: rating === "good" ? 1 : 0,
    hard: rating === "hard" ? 1 : 0,
    noteId: studyNote.id,
    snapshotTitle: studyNote.prompt,
    totalAttempts: attempts.length,
  };
}

function buildSchedule(
  studyNoteId: string,
  overrides: Partial<RecallSchedule> = {},
): RecallSchedule {
  return {
    ease: 2.5,
    intervalDays: 7,
    lastRecalledAt: "2026-05-16T09:00:00.000Z",
    nextRecallAt: "2026-05-24T09:00:00.000Z",
    repetitionCount: 1,
    studyNoteId,
    ...overrides,
  };
}

function buildInput(
  overrides: Partial<FocusLearningLoopSupportInput>,
): FocusLearningLoopSupportInput {
  return {
    attemptsByNote: [],
    now: timestamp,
    recallSchedules: [],
    sessionResults: [],
    studyNotes: [],
    userTimeZone: "America/New_York",
    ...overrides,
  };
}

describe("focus learning loop support", () => {
  it("returns no suggestions when every recallable note is already scheduled for later", () => {
    const studyNote = buildStudyNote({
      id: "scheduled-note",
      prompt: "Scheduled note",
    });

    expect(
      getFocusLearningLoopSupportSuggestions(
        buildInput({
          attemptsByNote: [buildAttempts(studyNote, "good")],
          recallSchedules: [buildSchedule(studyNote.id)],
          studyNotes: [studyNote],
        }),
      ),
    ).toEqual([]);
  });

  it("returns Recall Today when a study note has not been recalled yet", () => {
    const studyNote = buildStudyNote({
      id: "fresh-note",
      prompt: "Fresh note",
    });

    expect(
      getFocusLearningLoopSupportSuggestions(
        buildInput({
          studyNotes: [studyNote],
        }),
      ),
    ).toEqual([recallTodaySuggestion]);
  });

  it("returns Practice Repair before Recall Today when a study note needs practice", () => {
    const studyNote = buildStudyNote({
      id: "needs-practice-note",
      prompt: "Needs practice note",
    });

    expect(
      getFocusLearningLoopSupportSuggestions(
        buildInput({
          attemptsByNote: [buildAttempts(studyNote, "hard")],
          recallSchedules: [buildSchedule(studyNote.id)],
          studyNotes: [studyNote],
        }),
      ),
    ).toEqual([practiceRepairSuggestion, recallTodaySuggestion]);
  });
});
