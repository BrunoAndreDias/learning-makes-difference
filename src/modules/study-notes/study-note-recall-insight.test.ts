import { describe, expect, it } from "vitest";

import type { RecallGuidanceEntry } from "../recall";
import { deriveStudyNoteRecallInsight } from "./study-note-recall-insight";
import type { AppStudyNote, UpdateStudyNoteInput } from "./study-notes";

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

function buildDraft(
  overrides: Partial<UpdateStudyNoteInput> = {},
): UpdateStudyNoteInput {
  return {
    acronyms: [],
    expectedAnswer: "Expected answer",
    labelIds: [],
    metaphors: [],
    prompt: "Prompt",
    sourceBody: "Source body",
    sourceTitle: "Source title",
    ...overrides,
  };
}

function buildRecallGuidanceEntry(
  overrides: Partial<RecallGuidanceEntry> & {
    studyNoteId?: string;
  } = {},
): RecallGuidanceEntry {
  const studyNote = buildStudyNote({
    id: overrides.studyNoteId ?? "study-note-1",
    labelIds: [],
    prompt: "Prompt",
  });

  return {
    dueForRecall: true,
    interleavingReady: false,
    lastScore: null,
    needsPractice: false,
    nextRecall: "Recall today",
    notRecalledYet: true,
    recallToday: true,
    recallTodayReasons: [],
    recommendation: {
      kind: "recall-today",
      nextRecall: "Recall today",
      summary: "Prompt is ready for Recall Today. Next recall: Recall today.",
    },
    studyNote,
    ...overrides,
  };
}

describe("Study Note recall insight", () => {
  it("preserves the current editor recall-insight copy while using Recall Guidance facts", () => {
    expect(
      deriveStudyNoteRecallInsight({
        draft: buildDraft({ expectedAnswer: " " }),
        nextRecall: "—",
        recallGuidance: null,
      }),
    ).toEqual({
      description: "Complete the note to enable recall.",
      kind: "incomplete",
      lastResult: "—",
      nextRecall: "—",
      statusLabel: "New",
      suggestedAction: "Add expected answer",
    });

    expect(
      deriveStudyNoteRecallInsight({
        draft: buildDraft(),
        nextRecall: "After saving",
        recallGuidance: null,
      }),
    ).toEqual({
      description: "Ready for recall after saving.",
      kind: "new",
      lastResult: "—",
      nextRecall: "After saving",
      statusLabel: "New",
      suggestedAction: "Save to enable recall",
    });

    expect(
      deriveStudyNoteRecallInsight({
        draft: buildDraft(),
        nextRecall: "Today",
        recallGuidance: buildRecallGuidanceEntry(),
      }),
    ).toEqual({
      description: "Not enough recall data yet.",
      kind: "new",
      lastResult: "—",
      nextRecall: "Today",
      statusLabel: "New",
      suggestedAction: "Review this note",
    });

    expect(
      deriveStudyNoteRecallInsight({
        draft: buildDraft(),
        nextRecall: "May 19",
        recallGuidance: buildRecallGuidanceEntry({
          dueForRecall: false,
          nextRecall: "Next recall May 19",
          notRecalledYet: true,
          recallToday: false,
          recommendation: {
            kind: "reinforce",
            nextRecall: "Next recall May 19",
            summary:
              "Prompt is the next Study Note to reinforce. Next recall: Next recall May 19.",
          },
        }),
      }),
    ).toEqual({
      description: "Not enough recall data yet.",
      kind: "new",
      lastResult: "—",
      nextRecall: "May 19",
      statusLabel: "New",
      suggestedAction: "Review when due",
    });

    expect(
      deriveStudyNoteRecallInsight({
        draft: buildDraft(),
        nextRecall: "Today",
        recallGuidance: buildRecallGuidanceEntry({
          lastScore: "hard",
          needsPractice: true,
          notRecalledYet: false,
          recommendation: {
            kind: "needs-practice",
            nextRecall: "Recall today",
            summary:
              "Prompt needs practice. Last score: Hard. Next recall: Recall today.",
          },
        }),
      }),
    ).toEqual({
      description: "This note needs more attention.",
      kind: "practice",
      lastResult: "Hard (2/5)",
      nextRecall: "Today",
      statusLabel: "Needs practice",
      suggestedAction: "Review this note",
    });

    expect(
      deriveStudyNoteRecallInsight({
        draft: buildDraft(),
        nextRecall: "May 19",
        recallGuidance: buildRecallGuidanceEntry({
          dueForRecall: false,
          interleavingReady: true,
          lastScore: "easy",
          needsPractice: false,
          nextRecall: "Next recall May 19",
          notRecalledYet: false,
          recallToday: false,
          recommendation: {
            kind: "interleaving-ready",
            nextRecall: "Next recall May 19",
            summary:
              "Prompt is interleaving ready after repeated Good or Easy recalls. Next recall: Next recall May 19.",
          },
        }),
      }),
    ).toEqual({
      description: "You're recalling this well. Keep it up.",
      kind: "on-track",
      lastResult: "Easy (5/5)",
      nextRecall: "May 19",
      statusLabel: "On track",
      suggestedAction: "Keep it up",
    });

    expect(
      deriveStudyNoteRecallInsight({
        draft: buildDraft(),
        nextRecall: "Today",
        recallGuidance: buildRecallGuidanceEntry({
          dueForRecall: true,
          lastScore: "good",
          needsPractice: false,
          notRecalledYet: false,
          recallToday: true,
          recommendation: {
            kind: "recall-today",
            nextRecall: "Recall today",
            summary:
              "Prompt is ready for Recall Today. Last score: Good. Next recall: Recall today.",
          },
        }),
      }),
    ).toEqual({
      description: "You're recalling this well. Keep it up.",
      kind: "on-track",
      lastResult: "Good (4/5)",
      nextRecall: "Today",
      statusLabel: "On track",
      suggestedAction: "Review this note",
    });
  });
});
