import { describe, expect, it } from "vitest";

import type { RecallGuidanceEntry } from "../recall";
import {
  deriveStudyNoteRecallInsight,
  type StudyNoteRecallInsight,
} from "./study-note-recall-insight";
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
  const { studyNoteId, ...entryOverrides } = overrides;
  const studyNote = buildStudyNote({
    id: studyNoteId ?? "study-note-1",
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
    ...entryOverrides,
  };
}

type RecallInsightInput = Parameters<typeof deriveStudyNoteRecallInsight>[0];

type RecallInsightScenario = {
  expected: StudyNoteRecallInsight;
  input: RecallInsightInput;
  name: string;
};

const recallInsightScenarios = [
  {
    expected: {
      description: "Complete the note to enable recall.",
      kind: "incomplete",
      lastResult: "—",
      nextRecall: "—",
      statusLabel: "New",
      suggestedAction: "Add expected answer",
    },
    input: {
      draft: buildDraft({ expectedAnswer: " " }),
      nextRecall: "—",
      recallGuidance: null,
    },
    name: "marks drafts without expected answers as incomplete",
  },
  {
    expected: {
      description: "Ready for recall after saving.",
      kind: "new",
      lastResult: "—",
      nextRecall: "After saving",
      statusLabel: "New",
      suggestedAction: "Save to enable recall",
    },
    input: {
      draft: buildDraft(),
      nextRecall: "After saving",
      recallGuidance: null,
    },
    name: "keeps unsaved recallable drafts in the save-first state",
  },
  {
    expected: {
      description: "Not enough recall data yet.",
      kind: "new",
      lastResult: "—",
      nextRecall: "Today",
      statusLabel: "New",
      suggestedAction: "Review this note",
    },
    input: {
      draft: buildDraft(),
      nextRecall: "Today",
      recallGuidance: buildRecallGuidanceEntry(),
    },
    name: "prompts due unrecalled Study Notes to review now",
  },
  {
    expected: {
      description: "Not enough recall data yet.",
      kind: "new",
      lastResult: "—",
      nextRecall: "May 19",
      statusLabel: "New",
      suggestedAction: "Review when due",
    },
    input: {
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
    },
    name: "prompts scheduled unrecalled Study Notes to wait until due",
  },
  {
    expected: {
      description: "This note needs more attention.",
      kind: "practice",
      lastResult: "Hard (2/5)",
      nextRecall: "Today",
      statusLabel: "Needs practice",
      suggestedAction: "Review this note",
    },
    input: {
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
    },
    name: "surfaces Needs practice for hard recall evidence",
  },
  {
    expected: {
      description: "You're recalling this well. Keep it up.",
      kind: "on-track",
      lastResult: "Easy (5/5)",
      nextRecall: "May 19",
      statusLabel: "On track",
      suggestedAction: "Keep it up",
    },
    input: {
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
    },
    name: "keeps successful scheduled Study Notes on track",
  },
  {
    expected: {
      description: "You're recalling this well. Keep it up.",
      kind: "on-track",
      lastResult: "Good (4/5)",
      nextRecall: "Today",
      statusLabel: "On track",
      suggestedAction: "Review this note",
    },
    input: {
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
    },
    name: "prompts successful due Study Notes to review now",
  },
] satisfies readonly RecallInsightScenario[];

describe("Study Note recall insight", () => {
  it.each(recallInsightScenarios)("$name", ({ expected, input }) => {
    expect(deriveStudyNoteRecallInsight(input)).toEqual(expected);
  });
});
