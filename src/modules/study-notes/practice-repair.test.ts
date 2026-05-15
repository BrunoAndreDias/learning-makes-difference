import { describe, expect, it } from "vitest";

import { getStudyNotePracticeRepair } from "./practice-repair";

describe("Study Note Practice Repair", () => {
  it("returns lightweight repair suggestions for weak recall without an error-log workflow", () => {
    const practiceRepair = getStudyNotePracticeRepair({
      dueForRecall: false,
      lastRecalledAt: "2026-05-15T09:00:00.000Z",
      latestScore: "hard",
      needsPractice: true,
      studyNoteId: "study-note-1",
    });

    expect(practiceRepair).toEqual({
      recallTodayActionLabel: "Open Recall Today",
      summary:
        "Latest recall: Hard. Repair before the next attempt or alongside Recall Today.",
      suggestions: [
        {
          id: "edit-expected-answer",
          text: "Tighten the expected answer: name the reason, steps, limit, or one example.",
        },
        {
          id: "split-or-sibling",
          text: "If the prompt is doing too much, split it or create a sibling Study Note from the explanation.",
        },
        {
          id: "optional-memory-aids",
          text: "Use a Metaphor or Acronym only when it solves this recall problem.",
        },
      ],
      title: "Practice Repair",
    });
    expect(practiceRepair?.title).not.toContain("Error log");
    expect(
      practiceRepair?.suggestions.some((suggestion) =>
        suggestion.text.toLowerCase().includes("error log"),
      ),
    ).toBe(false);
  });

  it("does not return Practice Repair for Good, Easy, or missing recall evidence", () => {
    expect(
      getStudyNotePracticeRepair({
        dueForRecall: true,
        lastRecalledAt: "2026-05-15T09:00:00.000Z",
        latestScore: "good",
        needsPractice: false,
        studyNoteId: "study-note-good",
      }),
    ).toBeNull();
    expect(
      getStudyNotePracticeRepair({
        dueForRecall: true,
        lastRecalledAt: "2026-05-15T09:00:00.000Z",
        latestScore: "easy",
        needsPractice: false,
        studyNoteId: "study-note-easy",
      }),
    ).toBeNull();
    expect(
      getStudyNotePracticeRepair({
        dueForRecall: true,
        lastRecalledAt: null,
        latestScore: null,
        needsPractice: false,
        studyNoteId: "study-note-fresh",
      }),
    ).toBeNull();
  });
});
