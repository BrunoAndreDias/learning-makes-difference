import { describe, expect, it } from "vitest";

import type { AppStudyNote } from "../study-notes";
import { buildRecallTodayQueue } from "./recall-today";

const timestamp = "2026-05-01T09:00:00.000Z";

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

describe("Recall Today queue", () => {
  it("prioritizes recallable Study Notes by recommendation reason", () => {
    const needsPracticeAndDue = buildStudyNote({
      id: "needs-practice-and-due",
      prompt: "Needs practice and due",
    });
    const notRecalled = buildStudyNote({
      id: "not-recalled",
      prompt: "Not recalled",
    });
    const dueForRecall = buildStudyNote({
      id: "due-for-recall",
      prompt: "Due for Recall",
    });
    const incomplete = buildStudyNote({
      expectedAnswer: " ",
      id: "incomplete",
      prompt: "Incomplete",
    });
    const future = buildStudyNote({
      id: "future",
      prompt: "Future",
    });

    const queue = buildRecallTodayQueue({
      histories: [
        {
          attempts: [
            {
              completedAt: "2026-05-14T09:00:00.000Z",
              rating: "hard",
            },
          ],
          studyNoteId: needsPracticeAndDue.id,
        },
        {
          attempts: [
            {
              completedAt: "2026-05-08T09:00:00.000Z",
              rating: "good",
            },
          ],
          studyNoteId: dueForRecall.id,
        },
        {
          attempts: [
            {
              completedAt: "2026-05-14T09:00:00.000Z",
              rating: "easy",
            },
          ],
          studyNoteId: future.id,
        },
      ],
      now: "2026-05-15T10:00:00.000Z",
      recallSchedules: [
        {
          ease: 2.35,
          intervalDays: 1,
          lastRecalledAt: "2026-05-14T09:00:00.000Z",
          nextRecallAt: "2026-05-15T23:30:00.000Z",
          repetitionCount: 1,
          studyNoteId: needsPracticeAndDue.id,
        },
        {
          ease: 2.5,
          intervalDays: 3,
          lastRecalledAt: "2026-05-08T09:00:00.000Z",
          nextRecallAt: "2026-05-15T08:00:00.000Z",
          repetitionCount: 1,
          studyNoteId: dueForRecall.id,
        },
        {
          ease: 2.65,
          intervalDays: 7,
          lastRecalledAt: "2026-05-14T09:00:00.000Z",
          nextRecallAt: "2026-05-21T09:00:00.000Z",
          repetitionCount: 1,
          studyNoteId: future.id,
        },
      ],
      studyNotes: [
        dueForRecall,
        future,
        incomplete,
        notRecalled,
        needsPracticeAndDue,
      ],
      userTimeZone: "America/New_York",
    });

    expect(
      queue.map((item) => ({
        id: item.studyNote.id,
        reasons: item.reasons,
      })),
    ).toEqual([
      {
        id: needsPracticeAndDue.id,
        reasons: ["needs-practice", "due-for-recall"],
      },
      {
        id: notRecalled.id,
        reasons: ["not-recalled"],
      },
      {
        id: dueForRecall.id,
        reasons: ["due-for-recall"],
      },
    ]);
  });
});
