import { describe, expect, it } from "vitest";

import { getStudyNoteReadiness } from "./study-note-readiness";
import type { AppStudyNote } from "./study-notes";

const timestamp = "2026-05-01T00:00:00.000Z";

function buildStudyNote(overrides: Partial<AppStudyNote> = {}): AppStudyNote {
  return {
    acronyms: [],
    createdAt: timestamp,
    expectedAnswer: "Expected answer",
    id: "study-note-1",
    labelIds: [],
    metaphors: [],
    prompt: "Prompt",
    source: {
      body: "Source body",
      id: "source-1",
      title: "Source title",
      updatedAt: timestamp,
    },
    sourceNoteId: "source-1",
    updatedAt: timestamp,
    ...overrides,
  };
}

describe("Study Note readiness", () => {
  it("requires a prompt before a Study Note can be saved", () => {
    const missingPrompt = buildStudyNote({ prompt: " " });

    expect(getStudyNoteReadiness(missingPrompt)).toMatchObject({
      dueForRecallEligible: false,
      incomplete: true,
      learningStateEligible: false,
      recallable: false,
      saveable: false,
    });
  });

  it("marks prompt-only Study Notes as saveable but incomplete", () => {
    const incomplete = buildStudyNote({ expectedAnswer: " " });

    expect(getStudyNoteReadiness(incomplete)).toMatchObject({
      dueForRecallEligible: false,
      incomplete: true,
      learningStateEligible: false,
      recallable: false,
      saveable: true,
    });
  });

  it("allows recall-derived surfaces when prompt and expected answer are filled", () => {
    const recallableWithoutSourceBody = buildStudyNote({
      expectedAnswer: "Recall this answer.",
      source: {
        body: "",
        id: "source-1",
        title: "",
        updatedAt: timestamp,
      },
    });

    expect(getStudyNoteReadiness(recallableWithoutSourceBody)).toMatchObject({
      dueForRecallEligible: true,
      incomplete: false,
      learningStateEligible: true,
      recallable: true,
      saveable: true,
    });
  });
});
