import { describe, expect, it } from "vitest";

import {
  getStudyNoteReadiness,
  getStudyNoteReadinessLabels,
} from "./study-note-readiness";
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
  it("requires a prompt to save and a non-empty expected answer for recall-derived surfaces", () => {
    const missingPrompt = buildStudyNote({ prompt: " " });
    const incomplete = buildStudyNote({ expectedAnswer: " " });
    const recallableWithoutSourceBody = buildStudyNote({
      expectedAnswer: "Recall this answer.",
      source: {
        body: "",
        id: "source-1",
        title: "",
        updatedAt: timestamp,
      },
    });

    expect(getStudyNoteReadiness(missingPrompt)).toMatchObject({
      dueForRecallEligible: false,
      incomplete: true,
      learningStateEligible: false,
      recallable: false,
      saveable: false,
    });
    expect(getStudyNoteReadiness(incomplete)).toMatchObject({
      dueForRecallEligible: false,
      incomplete: true,
      learningStateEligible: false,
      recallable: false,
      saveable: true,
    });
    expect(getStudyNoteReadiness(recallableWithoutSourceBody)).toMatchObject({
      dueForRecallEligible: true,
      incomplete: false,
      learningStateEligible: true,
      recallable: true,
      saveable: true,
    });
    expect(getStudyNoteReadinessLabels(incomplete)).toEqual({
      compact: "Add expected answer",
      due: null,
      practice: null,
    });
  });
});
