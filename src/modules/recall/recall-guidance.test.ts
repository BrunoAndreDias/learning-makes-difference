import { describe, expect, it } from "vitest";

import type { AppStudyNote } from "../study-notes";
import type { FlashCardRecallAttemptsByNote } from "./recall";
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
});
