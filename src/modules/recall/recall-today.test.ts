import { describe, expect, it } from "vitest";

import type { AppStudyNote } from "../study-notes";
import {
  buildRecallTodayQueue,
  getPrimaryRecallTodayReason,
} from "./recall-today";

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

describe("Recall Today queue", () => {
  it("builds Recall Today queue items from recall work planning", () => {
    const needsPractice = buildStudyNote({
      id: "needs-practice",
      prompt: "Needs practice",
    });
    const notRecalled = buildStudyNote({
      id: "not-recalled",
      prompt: "Not recalled",
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
          studyNoteId: needsPractice.id,
        },
      ],
      now: "2026-05-15T10:00:00.000Z",
      recallSchedules: [],
      sessionResults: [],
      studyNotes: [notRecalled, needsPractice],
      userTimeZone: "UTC",
    });

    expect(
      queue.map((item) => ({
        id: item.studyNote.id,
        primaryReason: item.primaryReason,
        reasons: item.reasons,
      })),
    ).toEqual([
      {
        id: needsPractice.id,
        primaryReason: "needs-practice",
        reasons: ["needs-practice"],
      },
      {
        id: notRecalled.id,
        primaryReason: "not-recalled",
        reasons: ["not-recalled"],
      },
    ]);
  });

  it("keeps the primary reason helper aligned with recall work planning", () => {
    expect(
      getPrimaryRecallTodayReason({
        reasons: ["due-for-recall", "needs-practice"],
      }),
    ).toBe("needs-practice");
  });
});
