import { describe, expect, it, vi } from "vitest";

import {
  type AppPersistentStudyNotesService,
  createPersistentStudyNotesContext,
} from "./persistent-study-notes";
import type { AppStudyNote } from "./study-notes";

function buildStudyNote(overrides: Partial<AppStudyNote> = {}): AppStudyNote {
  return {
    acceptedVariants: [],
    acronyms: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    expectedAnswer: "A class describes object shape and behavior.",
    id: "study-note-1",
    keyIdeas: [],
    labelIds: [],
    metaphors: [],
    prompt: "What is a class?",
    prohibitedPhrases: [],
    source: {
      body: "",
      id: "source-note-1",
      title: "",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    sourceNoteId: "source-note-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createTestService(
  studyNotes: readonly AppStudyNote[],
): AppPersistentStudyNotesService {
  return {
    createStudyNote: vi.fn(),
    createStudyNoteFromSource: vi.fn(),
    deleteStudyNote: vi.fn(),
    listStudyNotes: vi.fn().mockResolvedValue(studyNotes),
    updateStudyNote: vi.fn(),
  };
}

describe("persistent Study Notes context", () => {
  it("does not notify subscribers when refresh returns the same snapshot", async () => {
    const studyNotes = [buildStudyNote()];
    const context = createPersistentStudyNotesContext({
      service: createTestService(studyNotes),
    });
    const listener = vi.fn();

    context.subscribe(listener);

    await context.refresh("user-casey");

    expect(listener).toHaveBeenCalledTimes(1);

    await context.refresh("user-casey");

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
