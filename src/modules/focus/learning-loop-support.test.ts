import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  FlashCardRecallAttemptsByNote,
  RecallGuidanceEntry,
  RecallSchedule,
  SessionResult,
} from "../recall";
import { deriveRecallGuidance } from "../recall";
import type { AppStudyNote } from "../study-notes";
import { getFocusLearningLoopSupportSuggestions } from "./learning-loop-support";

vi.mock("../recall", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../recall")>();

  return {
    ...actual,
    deriveRecallGuidance: vi.fn(),
  };
});

const mockedDeriveRecallGuidance = vi.mocked(deriveRecallGuidance);
const timestamp = "2026-05-17T09:00:00.000Z";

function buildStudyNote(id: string): AppStudyNote {
  return {
    acronyms: [],
    createdAt: timestamp,
    expectedAnswer: "Expected answer",
    id,
    labelIds: [],
    metaphors: [],
    prompt: `Prompt ${id}`,
    source: {
      body: "Source body",
      id: `source-${id}`,
      title: "Source title",
      updatedAt: timestamp,
    },
    sourceNoteId: `source-${id}`,
    updatedAt: timestamp,
  };
}

function buildGuidanceEntry(
  studyNoteId: string,
  overrides: Partial<RecallGuidanceEntry>,
): RecallGuidanceEntry {
  return {
    dueForRecall: false,
    interleavingReady: false,
    lastScore: null,
    needsPractice: false,
    nextRecall: "Next recall May 18",
    notRecalledYet: false,
    recallToday: false,
    recallTodayReasons: [],
    recommendation: {
      kind: "reinforce",
      nextRecall: "Next recall May 18",
      summary: `Prompt ${studyNoteId} is the next Study Note to reinforce. Next recall: Next recall May 18.`,
    },
    studyNote: buildStudyNote(studyNoteId),
    ...overrides,
  };
}

const input: {
  attemptsByNote: readonly FlashCardRecallAttemptsByNote[];
  now: string;
  recallSchedules: readonly RecallSchedule[];
  sessionResults: readonly SessionResult[];
  studyNotes: readonly AppStudyNote[];
  userTimeZone: "America/New_York";
} = {
  attemptsByNote: [],
  now: timestamp,
  recallSchedules: [],
  sessionResults: [],
  studyNotes: [buildStudyNote("study-note-1"), buildStudyNote("study-note-2")],
  userTimeZone: "America/New_York",
};

describe("focus learning loop support", () => {
  afterEach(() => {
    mockedDeriveRecallGuidance.mockReset();
  });

  it("uses Recall Guidance and returns no suggestions when no support facts are present", () => {
    mockedDeriveRecallGuidance.mockReturnValue([
      buildGuidanceEntry("study-note-1", {}),
    ]);

    expect(getFocusLearningLoopSupportSuggestions(input)).toEqual([]);
    expect(mockedDeriveRecallGuidance).toHaveBeenCalledWith(input);
  });

  it("returns only Practice Repair when Recall Guidance reports needsPractice", () => {
    mockedDeriveRecallGuidance.mockReturnValue([
      buildGuidanceEntry("study-note-1", {
        needsPractice: true,
      }),
    ]);

    expect(getFocusLearningLoopSupportSuggestions(input)).toEqual([
      {
        actionId: "practice-repair",
        href: "/study-notes",
      },
    ]);
  });

  it("returns only Recall Today when Recall Guidance reports recallToday", () => {
    mockedDeriveRecallGuidance.mockReturnValue([
      buildGuidanceEntry("study-note-1", {
        recallToday: true,
      }),
    ]);

    expect(getFocusLearningLoopSupportSuggestions(input)).toEqual([
      {
        actionId: "recall-today",
        href: "/recall",
      },
    ]);
  });

  it("returns both suggestions in the existing order when Recall Guidance reports both facts", () => {
    mockedDeriveRecallGuidance.mockReturnValue([
      buildGuidanceEntry("study-note-1", {
        needsPractice: true,
      }),
      buildGuidanceEntry("study-note-2", {
        recallToday: true,
      }),
    ]);

    expect(getFocusLearningLoopSupportSuggestions(input)).toEqual([
      {
        actionId: "practice-repair",
        href: "/study-notes",
      },
      {
        actionId: "recall-today",
        href: "/recall",
      },
    ]);
  });
});
