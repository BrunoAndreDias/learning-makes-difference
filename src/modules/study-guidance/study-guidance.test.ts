import { describe, expect, it } from "vitest";

import type { AppLabel } from "../labels/label-management/labels";
import type { FlashCardRecallAttemptsByNote, RecallSchedule } from "../recall";
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
      studyNotes: [weakBiology, freshBiology, ...chemistryStudyNotes],
      userTimeZone: "America/New_York",
    });

    expect(guidance.stats).toEqual([
      expect.objectContaining({ count: 2, label: "Recall today" }),
      expect.objectContaining({ count: 1, label: "Needs practice" }),
      expect.objectContaining({ count: 1, label: "Not recalled yet" }),
      expect.objectContaining({ count: 4, label: "Interleaving ready" }),
    ]);
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
            "Chemistry prompt 1 is interleaving ready after repeated Good or Easy recalls. Next recall: Next recall May 19.",
        }),
        title: "Chemistry",
      }),
    ]);
  });
});
