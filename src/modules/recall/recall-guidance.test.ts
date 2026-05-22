import { describe, expect, it } from "vitest";

import type { AppStudyNote } from "../study-notes";
import type { FlashCardRecallAttemptsByNote, SessionResult } from "./recall";
import {
  deriveRecallGuidance,
  getRecallGuidanceRecommendation,
} from "./recall-guidance";
import type { RecallSchedule } from "./recall-schedule";

const timestamp = "2026-05-01T09:00:00.000Z";

function buildStudyNote(
  overrides: Partial<AppStudyNote> &
    Pick<AppStudyNote, "id" | "labelIds" | "prompt">,
): AppStudyNote {
  const { id, labelIds, prompt, ...rest } = overrides;

  return {
    acceptedVariants: [],
    acronyms: [],
    createdAt: timestamp,
    expectedAnswer: "Expected answer",
    id,
    keyIdeas: [],
    labelIds,
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

function buildAttempts(
  noteId: string,
  attempts: FlashCardRecallAttemptsByNote["attempts"],
): FlashCardRecallAttemptsByNote {
  const summary = attempts.reduce(
    (totals, attempt) => ({
      easy: totals.easy + (attempt.rating === "easy" ? 1 : 0),
      forgot: totals.forgot + (attempt.rating === "forgot" ? 1 : 0),
      good: totals.good + (attempt.rating === "good" ? 1 : 0),
      hard: totals.hard + (attempt.rating === "hard" ? 1 : 0),
    }),
    {
      easy: 0,
      forgot: 0,
      good: 0,
      hard: 0,
    },
  );

  return {
    attempts,
    currentTitle: null,
    ...summary,
    noteId,
    snapshotTitle: "Snapshot title",
    totalAttempts: attempts.length,
  };
}

function buildSchedule(
  studyNoteId: string,
  overrides: Partial<RecallSchedule>,
): RecallSchedule {
  return {
    ease: 2.5,
    intervalDays: 1,
    lastRecalledAt: "2026-05-14T09:00:00.000Z",
    nextRecallAt: "2026-05-15T09:00:00.000Z",
    repetitionCount: 1,
    studyNoteId,
    ...overrides,
  };
}

type PracticeRepairEntry = NonNullable<
  SessionResult["questions"][number]["practiceRepairEntry"]
>;

function buildRecallQuestionSnapshot(studyNote: AppStudyNote) {
  return {
    acronyms: [],
    body: studyNote.source.body,
    createdAt: studyNote.createdAt,
    expectedAnswer: studyNote.expectedAnswer,
    id: studyNote.id,
    labelIds: studyNote.labelIds,
    metaphors: [],
    prompt: studyNote.prompt,
    source: {
      body: studyNote.source.body,
      id: studyNote.source.id,
      title: studyNote.source.title,
      updatedAt: studyNote.source.updatedAt,
    },
    sourceNoteId: studyNote.sourceNoteId,
    title: studyNote.prompt,
    updatedAt: studyNote.updatedAt,
  };
}

function buildPracticeRepairEntry(input: {
  completedAt?: string;
  confirmedAt: string;
  questionResultId: string;
  resultId: string;
  studyNoteId: string;
}): PracticeRepairEntry {
  return {
    confirmedAt: input.confirmedAt,
    correction: "Tighten the expected answer.",
    intent: "tighten-expected-answer",
    intentMetadata: {
      updatedExpectedAnswer: null,
    },
    lifecycle:
      input.completedAt === undefined
        ? undefined
        : {
            completedAt: input.completedAt,
          },
    reference: {
      questionIndex: 0,
      questionResultId: input.questionResultId,
      sessionResultId: input.resultId,
      studyNoteId: input.studyNoteId,
    },
  };
}

function buildSessionResult(input: {
  completedAt: string;
  id: string;
  practiceRepairEntry?: PracticeRepairEntry;
  questionResultId: string;
  selfRating: "easy" | "forgot" | "good" | "hard";
  studyNote: AppStudyNote;
}): SessionResult {
  const noteSnapshot = buildRecallQuestionSnapshot(input.studyNote);

  return {
    attempts: [],
    completedAt: input.completedAt,
    createdAt: input.completedAt,
    id: input.id,
    mode: "FlashCard",
    notes: [noteSnapshot],
    questions: [
      {
        isAnswerRevealed: true,
        noteId: input.studyNote.id,
        noteSnapshot,
        practiceRepairEntry: input.practiceRepairEntry,
        questionResultId: input.questionResultId,
        selfRating: input.selfRating,
      },
    ],
  };
}

describe("recall guidance", () => {
  it("derives Study Guidance recommendation facts and preserves the current recommendation copy", () => {
    const biologyId = "label-biology";
    const chemistryId = "label-chemistry";
    const weakBiology = buildStudyNote({
      id: "study-note-biology-weak",
      labelIds: [biologyId],
      prompt: "Diffusion vs. osmosis",
    });
    const freshBiology = buildStudyNote({
      id: "study-note-biology-fresh",
      labelIds: [biologyId],
      prompt: "Phases of mitosis",
    });
    const chemistryStudyNotes = Array.from({ length: 4 }, (_, index) =>
      buildStudyNote({
        id: `study-note-chemistry-${index + 1}`,
        labelIds: [chemistryId],
        prompt: `Chemistry prompt ${index + 1}`,
      }),
    );

    const guidance = deriveRecallGuidance({
      attemptsByNote: [
        buildAttempts(weakBiology.id, [
          {
            bodySnapshot: "Weak biology answer",
            completedAt: "2026-05-14T09:00:00.000Z",
            rating: "hard",
            sessionId: "session-biology-weak",
            snapshotTitle: weakBiology.prompt,
          },
        ]),
        ...chemistryStudyNotes.map((studyNote, index) =>
          buildAttempts(studyNote.id, [
            {
              bodySnapshot: `Chemistry answer ${index + 1}`,
              completedAt: "2026-05-10T09:00:00.000Z",
              rating: "good",
              sessionId: `session-chemistry-good-${index + 1}`,
              snapshotTitle: studyNote.prompt,
            },
            {
              bodySnapshot: `Chemistry answer ${index + 1}`,
              completedAt: "2026-05-12T09:00:00.000Z",
              rating: "easy",
              sessionId: `session-chemistry-easy-${index + 1}`,
              snapshotTitle: studyNote.prompt,
            },
          ]),
        ),
      ],
      now: "2026-05-15T12:00:00.000Z",
      recallSchedules: [
        buildSchedule(weakBiology.id, {}),
        ...chemistryStudyNotes.map((studyNote) =>
          buildSchedule(studyNote.id, {
            ease: 2.65,
            intervalDays: 7,
            lastRecalledAt: "2026-05-12T09:00:00.000Z",
            nextRecallAt: "2026-05-19T09:00:00.000Z",
            repetitionCount: 2,
          }),
        ),
      ],
      sessionResults: [],
      studyNotes: [weakBiology, freshBiology, ...chemistryStudyNotes],
      userTimeZone: "America/New_York",
    });
    const guidanceByStudyNoteId = new Map(
      guidance.map((entry) => [entry.studyNote.id, entry]),
    );

    expect(guidanceByStudyNoteId.get(weakBiology.id)).toMatchObject({
      dueForRecall: true,
      interleavingReady: false,
      needsPractice: true,
      nextRecall: "Recall today",
      notRecalledYet: false,
      recallToday: true,
      recommendation: {
        kind: "needs-practice",
        nextRecall: "Recall today",
        summary:
          "Diffusion vs. osmosis needs practice. Last score: Hard. Next recall: Recall today.",
      },
    });
    expect(guidanceByStudyNoteId.get(freshBiology.id)).toMatchObject({
      dueForRecall: true,
      interleavingReady: false,
      needsPractice: false,
      nextRecall: "Recall today",
      notRecalledYet: true,
      recallToday: true,
      recommendation: {
        kind: "recall-today",
        nextRecall: "Recall today",
        summary:
          "Phases of mitosis is ready for Recall Today. Next recall: Recall today.",
      },
    });
    expect(guidanceByStudyNoteId.get(chemistryStudyNotes[0].id)).toMatchObject({
      dueForRecall: false,
      interleavingReady: true,
      needsPractice: false,
      nextRecall: "Next recall May 19",
      notRecalledYet: false,
      recallToday: false,
      recommendation: {
        kind: "interleaving-ready",
        nextRecall: "Next recall May 19",
        summary:
          "Chemistry prompt 1 is ready for Interleaved Recall after repeated Good or Easy recalls. Next recall: Next recall May 19.",
      },
    });

    expect(
      getRecallGuidanceRecommendation({
        entries: guidance.filter((entry) =>
          entry.studyNote.labelIds.includes(biologyId),
        ),
      }),
    ).toEqual({
      kind: "needs-practice",
      nextRecall: "Recall today",
      summary:
        "Diffusion vs. osmosis needs practice. Last score: Hard. Next recall: Recall today.",
    });
    expect(
      getRecallGuidanceRecommendation({
        entries: guidance.filter((entry) =>
          entry.studyNote.labelIds.includes(chemistryId),
        ),
      }),
    ).toEqual({
      kind: "interleaving-ready",
      nextRecall: "Next recall May 19",
      summary:
        "Chemistry prompt 1 is ready for Interleaved Recall after repeated Good or Easy recalls. Next recall: Next recall May 19.",
    });
  });

  it("exposes planner primary reason for mixed-signal Practice Follow-ups", () => {
    const studyNote = buildStudyNote({
      id: "study-note-follow-up",
      labelIds: [],
      prompt: "Explain osmosis",
    });
    const completedAt = "2026-05-14T09:00:00.000Z";
    const questionResultId = "result-follow-up-question-0";
    const resultId = "result-follow-up";

    const guidance = deriveRecallGuidance({
      attemptsByNote: [
        buildAttempts(studyNote.id, [
          {
            bodySnapshot: "Follow-up answer",
            completedAt,
            rating: "hard",
            sessionId: "session-follow-up",
            snapshotTitle: studyNote.prompt,
          },
        ]),
      ],
      now: "2026-05-15T12:00:00.000Z",
      recallSchedules: [
        buildSchedule(studyNote.id, {
          nextRecallAt: "2026-05-15T09:00:00.000Z",
        }),
      ],
      sessionResults: [
        buildSessionResult({
          completedAt,
          id: resultId,
          practiceRepairEntry: buildPracticeRepairEntry({
            completedAt: "2026-05-14T10:00:00.000Z",
            confirmedAt: completedAt,
            questionResultId,
            resultId,
            studyNoteId: studyNote.id,
          }),
          questionResultId,
          selfRating: "hard",
          studyNote,
        }),
      ],
      studyNotes: [studyNote],
      userTimeZone: "America/New_York",
    });

    expect(guidance[0]).toMatchObject({
      dueForRecall: true,
      needsPractice: true,
      recallToday: true,
      recallTodayPrimaryReason: "practice-follow-up",
      recallTodayReasons: [
        "practice-follow-up",
        "needs-practice",
        "due-for-recall",
      ],
    });
  });
});
