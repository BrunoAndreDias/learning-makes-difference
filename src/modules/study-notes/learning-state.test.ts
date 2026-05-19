import { describe, expect, it } from "vitest";

import type { FlashCardRecallAttemptsByNote } from "../recall";
import {
  deriveStudyNoteLearningStates,
  formatStudyNoteDueLabel,
  formatStudyNoteLearningStateCompactLabel,
  formatStudyNotePracticeSignalLabel,
  listDueStudyNotesForRecall,
  type StudyNoteRecallHistory,
  toStudyNoteRecallHistories,
} from "./learning-state";
import type { AppStudyNote } from "./study-notes";

const timestamp = "2026-04-01T00:00:00.000Z";

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
      body: "Shared source body",
      id: "source-1",
      title: "Shared source",
      updatedAt: timestamp,
    },
    sourceNoteId: "source-1",
    updatedAt: timestamp,
    ...rest,
  };
}

function buildHistory(
  studyNoteId: string,
  attempts: StudyNoteRecallHistory["attempts"],
): StudyNoteRecallHistory {
  return {
    attempts,
    studyNoteId,
  };
}

describe("Study Note learning state", () => {
  it("derives independent learning, due, and Needs practice signals per Study Note", () => {
    const first = buildStudyNote({
      id: "study-note-first",
      prompt: "First shared target",
    });
    const second = buildStudyNote({
      id: "study-note-second",
      prompt: "Second shared target",
    });
    const fresh = buildStudyNote({
      id: "study-note-fresh",
      prompt: "Fresh target",
      source: {
        body: "Another source body",
        id: "source-2",
        title: "Another source",
        updatedAt: timestamp,
      },
      sourceNoteId: "source-2",
    });

    const learningStates = deriveStudyNoteLearningStates({
      histories: [
        buildHistory(first.id, [
          {
            completedAt: "2026-05-01T09:00:00.000Z",
            rating: "hard",
          },
        ]),
        buildHistory(second.id, [
          {
            completedAt: "2026-05-01T10:00:00.000Z",
            rating: "easy",
          },
        ]),
      ],
      now: "2026-05-02T12:00:00.000Z",
      recallSchedules: [
        {
          ease: 2.35,
          intervalDays: 1,
          lastRecalledAt: "2026-05-01T09:00:00.000Z",
          nextRecallAt: "2026-05-02T09:00:00.000Z",
          repetitionCount: 1,
          studyNoteId: first.id,
        },
        {
          ease: 2.65,
          intervalDays: 7,
          lastRecalledAt: "2026-05-01T10:00:00.000Z",
          nextRecallAt: "2026-05-08T10:00:00.000Z",
          repetitionCount: 1,
          studyNoteId: second.id,
        },
      ],
      studyNotes: [first, second, fresh],
    });

    expect(learningStates).toEqual([
      {
        dueForRecall: true,
        lastRecalledAt: "2026-05-01T09:00:00.000Z",
        latestScore: "hard",
        needsPractice: true,
        studyNoteId: first.id,
      },
      {
        dueForRecall: false,
        lastRecalledAt: "2026-05-01T10:00:00.000Z",
        latestScore: "easy",
        needsPractice: false,
        studyNoteId: second.id,
      },
      {
        dueForRecall: true,
        lastRecalledAt: null,
        latestScore: null,
        needsPractice: false,
        studyNoteId: fresh.id,
      },
    ]);
    expect(formatStudyNoteLearningStateCompactLabel(learningStates[0])).toBe(
      "Last score: Hard",
    );
    expect(formatStudyNotePracticeSignalLabel(learningStates[0])).toBe(
      "Needs practice",
    );
    expect(formatStudyNotePracticeSignalLabel(learningStates[1])).toBeNull();
    expect(formatStudyNoteDueLabel(learningStates[0])).toBe("Due for Recall");
    expect(
      listDueStudyNotesForRecall({
        learningStates,
        studyNotes: [first, second, fresh],
      }).map((studyNote) => studyNote.id),
    ).toEqual([first.id, fresh.id]);
  });

  it("keeps incomplete Study Notes out of Learning State and Due for Recall copy", () => {
    const incomplete = buildStudyNote({
      expectedAnswer: " ",
      id: "study-note-incomplete",
      prompt: "Incomplete target",
    });

    const [learningState] = deriveStudyNoteLearningStates({
      histories: [
        buildHistory(incomplete.id, [
          {
            completedAt: "2026-05-01T09:00:00.000Z",
            rating: "hard",
          },
        ]),
      ],
      now: "2026-05-02T12:00:00.000Z",
      studyNotes: [incomplete],
    });

    expect(learningState).toEqual({
      dueForRecall: false,
      lastRecalledAt: null,
      latestScore: null,
      needsPractice: false,
      studyNoteId: incomplete.id,
    });
    expect(formatStudyNoteLearningStateCompactLabel(learningState)).toBe(
      "Add expected answer",
    );
    expect(formatStudyNotePracticeSignalLabel(learningState)).toBeNull();
    expect(formatStudyNoteDueLabel(learningState)).toBeNull();
    expect(
      listDueStudyNotesForRecall({
        learningStates: [learningState],
        studyNotes: [incomplete],
      }),
    ).toEqual([]);
  });

  it("derives Due for Recall from Recall Schedule while Needs practice stays evidence-based", () => {
    const shakyButScheduledLater = buildStudyNote({
      id: "study-note-shaky",
      prompt: "Shaky but scheduled later",
    });
    const strongButDue = buildStudyNote({
      id: "study-note-strong",
      prompt: "Strong but scheduled due",
    });

    const learningStates = deriveStudyNoteLearningStates({
      histories: [
        buildHistory(shakyButScheduledLater.id, [
          {
            completedAt: "2026-05-14T09:00:00.000Z",
            rating: "hard",
          },
        ]),
        buildHistory(strongButDue.id, [
          {
            completedAt: "2026-05-14T09:00:00.000Z",
            rating: "easy",
          },
        ]),
      ],
      now: "2026-05-15T12:00:00.000Z",
      recallSchedules: [
        {
          ease: 2.35,
          intervalDays: 1,
          lastRecalledAt: "2026-05-14T09:00:00.000Z",
          nextRecallAt: "2026-05-16T09:00:00.000Z",
          repetitionCount: 1,
          studyNoteId: shakyButScheduledLater.id,
        },
        {
          ease: 2.65,
          intervalDays: 7,
          lastRecalledAt: "2026-05-14T09:00:00.000Z",
          nextRecallAt: "2026-05-15T09:00:00.000Z",
          repetitionCount: 1,
          studyNoteId: strongButDue.id,
        },
      ],
      studyNotes: [shakyButScheduledLater, strongButDue],
    });

    expect(learningStates).toMatchObject([
      {
        dueForRecall: false,
        latestScore: "hard",
        needsPractice: true,
        studyNoteId: shakyButScheduledLater.id,
      },
      {
        dueForRecall: true,
        latestScore: "easy",
        needsPractice: false,
        studyNoteId: strongButDue.id,
      },
    ]);
  });

  it("maps recall attempt groups to Study Note recall histories", () => {
    const attemptsByNote: FlashCardRecallAttemptsByNote[] = [
      {
        attempts: [
          {
            bodySnapshot: "Answer snapshot",
            completedAt: "2026-05-01T09:00:00.000Z",
            rating: "forgot",
            sessionId: "session-1",
            snapshotTitle: "Prompt snapshot",
          },
        ],
        currentTitle: "Current prompt",
        easy: 0,
        forgot: 1,
        good: 0,
        hard: 0,
        noteId: "study-note-1",
        snapshotTitle: "Prompt snapshot",
        totalAttempts: 1,
      },
    ];

    expect(toStudyNoteRecallHistories(attemptsByNote)).toEqual([
      {
        attempts: [
          {
            completedAt: "2026-05-01T09:00:00.000Z",
            rating: "forgot",
          },
        ],
        studyNoteId: "study-note-1",
      },
    ]);
  });
});
