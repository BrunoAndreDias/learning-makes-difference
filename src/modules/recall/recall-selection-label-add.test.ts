import { describe, expect, it } from "vitest";

import type { AppStudyNote } from "../study-notes";
import { addRecallableStudyNotesFromLabel } from "./recall-selection-label-add";

const timestamp = "2026-05-20T10:00:00.000Z";

function buildStudyNote(
  overrides: Partial<AppStudyNote> & Pick<AppStudyNote, "id" | "labelIds">,
): AppStudyNote {
  const { id, labelIds, ...rest } = overrides;

  return {
    acronyms: [],
    createdAt: timestamp,
    expectedAnswer: "Expected answer.",
    id,
    labelIds: [...labelIds],
    metaphors: [],
    prompt: `Prompt for ${id}`,
    source: {
      body: "Source body.",
      id: `source-${id}`,
      title: `Source ${id}`,
      updatedAt: timestamp,
    },
    sourceNoteId: `source-${id}`,
    updatedAt: timestamp,
    ...rest,
  };
}

describe("recall selection label add", () => {
  it("adds recallable Study Notes from one Label while preserving prior selections", () => {
    const selectedBiologyStudyNote = buildStudyNote({
      id: "study-note-biology-selected",
      labelIds: ["label-biology"],
    });
    const addedBiologyStudyNote = buildStudyNote({
      id: "study-note-biology-added",
      labelIds: ["label-biology"],
    });
    const incompleteBiologyStudyNote = buildStudyNote({
      expectedAnswer: "",
      id: "study-note-biology-incomplete",
      labelIds: ["label-biology"],
    });
    const historyStudyNote = buildStudyNote({
      id: "study-note-history",
      labelIds: ["label-history"],
    });

    const result = addRecallableStudyNotesFromLabel({
      selectedLabelId: "label-biology",
      selectedStudyNoteIds: ["study-note-manual", selectedBiologyStudyNote.id],
      studyNotes: [
        selectedBiologyStudyNote,
        addedBiologyStudyNote,
        incompleteBiologyStudyNote,
        historyStudyNote,
      ],
    });

    expect(result).toEqual({
      addedStudyNoteIds: [addedBiologyStudyNote.id],
      selectedStudyNoteIds: [
        "study-note-manual",
        selectedBiologyStudyNote.id,
        addedBiologyStudyNote.id,
      ],
    });
  });
});
