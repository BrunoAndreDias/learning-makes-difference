import { describe, expect, it } from "vitest";

import type { AppLabel } from "../labels/label-management/labels";
import type {
  FlashCardRecallAttemptsByNote,
  RecallSchedule,
  SessionResult,
} from "../recall";
import type { AppStudyNote } from "../study-notes";
import { deriveStudyGuidance } from "./study-guidance";

const timestamp = "2026-05-01T09:00:00.000Z";

function buildStudyNote(
  overrides: Partial<AppStudyNote> &
    Pick<AppStudyNote, "id" | "labelIds" | "prompt">,
): AppStudyNote {
  const { id, labelIds, prompt, ...rest } = overrides;

  return {
    acronyms: [],
    createdAt: timestamp,
    expectedAnswer: "Expected answer",
    id,
    labelIds,
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

function buildSessionResult(input: {
  completedAt: string;
  id: string;
  practiceRepairCorrection?: string;
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
        practiceRepairEntry:
          input.practiceRepairCorrection === undefined
            ? undefined
            : {
                confirmedAt: input.completedAt,
                correction: input.practiceRepairCorrection,
                intent: "tighten-expected-answer",
                intentMetadata: {
                  updatedExpectedAnswer: null,
                },
                reference: {
                  questionIndex: 0,
                  questionResultId: input.questionResultId,
                  sessionResultId: input.id,
                  studyNoteId: input.studyNote.id,
                },
              },
        questionResultId: input.questionResultId,
        selfRating: input.selfRating,
      },
    ],
  };
}

describe("Study Guidance", () => {
  it("derives factual summary counts and topic recommendations from Study Note and Label evidence", () => {
    const biology: AppLabel = {
      id: "label-biology",
      name: "Biology",
      parentIds: [],
    };
    const chemistry: AppLabel = {
      id: "label-chemistry",
      name: "Chemistry",
      parentIds: [],
    };
    const weakBiology = buildStudyNote({
      id: "study-note-biology-weak",
      labelIds: [biology.id],
      prompt: "Diffusion vs. osmosis",
    });
    const freshBiology = buildStudyNote({
      id: "study-note-biology-fresh",
      labelIds: [biology.id],
      prompt: "Phases of mitosis",
    });
    const chemistryStudyNotes = Array.from({ length: 4 }, (_, index) =>
      buildStudyNote({
        id: `study-note-chemistry-${index + 1}`,
        labelIds: [chemistry.id],
        prompt: `Chemistry prompt ${index + 1}`,
      }),
    );

    const guidance = deriveStudyGuidance({
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
      labels: [biology, chemistry],
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

    expect(guidance.stats).toEqual([
      expect.objectContaining({ count: 2, label: "Recall Today" }),
      expect.objectContaining({ count: 1, label: "Needs practice" }),
      expect.objectContaining({ count: 1, label: "Not recalled yet" }),
      expect.objectContaining({ count: 4, label: "Interleaved Recall" }),
    ]);
    expect(guidance.practiceRepair).toBeNull();
    expect(guidance.topics).toEqual([
      expect.objectContaining({
        interleavingReadyCount: 0,
        needsPracticeCount: 1,
        notRecalledYetCount: 1,
        recallTodayCount: 2,
        recommendation: expect.objectContaining({
          nextRecall: "Recall today",
          summary:
            "Diffusion vs. osmosis needs practice. Last score: Hard. Next recall: Recall today.",
        }),
        title: "Biology",
      }),
      expect.objectContaining({
        interleavingReadyCount: 4,
        needsPracticeCount: 0,
        notRecalledYetCount: 0,
        recallTodayCount: 0,
        recommendation: expect.objectContaining({
          nextRecall: "Next recall May 19",
          summary:
            "Chemistry prompt 1 is ready for Interleaved Recall after repeated Good or Easy recalls. Next recall: Next recall May 19.",
        }),
        title: "Chemistry",
      }),
    ]);
  });

  it("surfaces active Practice Repair entries and repair candidates before generic needs-practice guidance", () => {
    const biology: AppLabel = {
      id: "label-biology",
      name: "Biology",
      parentIds: [],
    };
    const activeRepairStudyNote = buildStudyNote({
      id: "study-note-biology-active-repair",
      labelIds: [biology.id],
      prompt: "Explain active transport",
    });
    const repairCandidateStudyNote = buildStudyNote({
      id: "study-note-biology-repair-candidate",
      labelIds: [biology.id],
      prompt: "Explain osmosis",
    });

    const guidance = deriveStudyGuidance({
      attemptsByNote: [
        buildAttempts(activeRepairStudyNote.id, [
          {
            bodySnapshot: "Active transport answer",
            completedAt: "2026-05-14T09:00:00.000Z",
            rating: "hard",
            sessionId: "session-biology-active-repair",
            snapshotTitle: activeRepairStudyNote.prompt,
          },
        ]),
        buildAttempts(repairCandidateStudyNote.id, [
          {
            bodySnapshot: "Osmosis answer",
            completedAt: "2026-05-15T08:00:00.000Z",
            rating: "forgot",
            sessionId: "session-biology-repair-candidate",
            snapshotTitle: repairCandidateStudyNote.prompt,
          },
        ]),
      ],
      labels: [biology],
      now: "2026-05-15T12:00:00.000Z",
      recallSchedules: [
        buildSchedule(activeRepairStudyNote.id, {}),
        buildSchedule(repairCandidateStudyNote.id, {}),
      ],
      sessionResults: [
        buildSessionResult({
          completedAt: "2026-05-14T09:00:00.000Z",
          id: "result-active-repair",
          practiceRepairCorrection:
            "Call out ATP use directly in the expected answer.",
          questionResultId: "result-active-repair-question-0",
          selfRating: "hard",
          studyNote: activeRepairStudyNote,
        }),
        buildSessionResult({
          completedAt: "2026-05-15T08:00:00.000Z",
          id: "result-repair-candidate",
          questionResultId: "result-repair-candidate-question-0",
          selfRating: "forgot",
          studyNote: repairCandidateStudyNote,
        }),
      ],
      studyNotes: [activeRepairStudyNote, repairCandidateStudyNote],
      userTimeZone: "America/New_York",
    });

    expect(guidance.practiceRepair).toEqual({
      activeEntryCount: 1,
      candidateCount: 1,
      hasActiveEntries: true,
      hasCandidates: true,
      summary:
        "1 active Practice Repair entry and 1 new repair candidate are waiting in Recall.",
    });
    expect(guidance.topics).toEqual([
      expect.objectContaining({
        practiceRepairActiveCount: 1,
        practiceRepairCandidateCount: 1,
        recommendation: {
          kind: "practice-repair",
          summary:
            "1 active Practice Repair entry and 1 new repair candidate are waiting for Biology. Open Practice Repair before repeating generic Needs practice work.",
        },
        title: "Biology",
      }),
    ]);
  });
});
