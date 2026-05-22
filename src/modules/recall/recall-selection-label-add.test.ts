import { describe, expect, it } from "vitest";

import type { AppStudyNote } from "../study-notes";
import { addRecallableStudyNotesFromLabels } from "./recall-selection-label-add";

const timestamp = "2026-05-20T10:00:00.000Z";

function buildStudyNote(
  overrides: Partial<AppStudyNote> & Pick<AppStudyNote, "id" | "labelIds">,
): AppStudyNote {
  const { id, labelIds, ...rest } = overrides;

  return {
    acceptedVariants: [],
    acronyms: [],
    createdAt: timestamp,
    expectedAnswer: "Expected answer.",
    id,
    keyIdeas: [],
    labelIds: [...labelIds],
    metaphors: [],
    prompt: `Prompt for ${id}`,
    prohibitedPhrases: [],
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
  it("preserves current selections when no Labels are selected", () => {
    const biologyStudyNote = buildStudyNote({
      id: "study-note-biology",
      labelIds: ["label-biology"],
    });

    const result = addRecallableStudyNotesFromLabels({
      selectedLabelIds: [],
      selectedStudyNoteIds: ["study-note-manual"],
      studyNotes: [biologyStudyNote],
    });

    expect(result).toEqual({
      addedStudyNoteIds: [],
      alreadySelectedStudyNoteIds: [],
      selectedStudyNoteIds: ["study-note-manual"],
      skippedIncompleteStudyNoteIds: [],
    });
  });

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

    const result = addRecallableStudyNotesFromLabels({
      selectedLabelIds: ["label-biology"],
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
      alreadySelectedStudyNoteIds: [selectedBiologyStudyNote.id],
      selectedStudyNoteIds: [
        "study-note-manual",
        selectedBiologyStudyNote.id,
        addedBiologyStudyNote.id,
      ],
      skippedIncompleteStudyNoteIds: [incompleteBiologyStudyNote.id],
    });
  });

  it("adds only recallable Study Notes that match all selected Labels", () => {
    const selectedBiologyExamStudyNote = buildStudyNote({
      id: "study-note-biology-exam-selected",
      labelIds: ["label-biology", "label-exam-1"],
    });
    const addedBiologyExamStudyNote = buildStudyNote({
      id: "study-note-biology-exam-added",
      labelIds: ["label-biology", "label-exam-1"],
    });
    const incompleteBiologyExamStudyNote = buildStudyNote({
      expectedAnswer: "",
      id: "study-note-biology-exam-incomplete",
      labelIds: ["label-biology", "label-exam-1"],
    });
    const biologyOnlyStudyNote = buildStudyNote({
      id: "study-note-biology-only",
      labelIds: ["label-biology"],
    });
    const examOnlyStudyNote = buildStudyNote({
      id: "study-note-exam-only",
      labelIds: ["label-exam-1"],
    });

    const result = addRecallableStudyNotesFromLabels({
      selectedLabelIds: ["label-biology", "label-exam-1"],
      selectedStudyNoteIds: [
        "study-note-manual",
        selectedBiologyExamStudyNote.id,
      ],
      studyNotes: [
        selectedBiologyExamStudyNote,
        addedBiologyExamStudyNote,
        incompleteBiologyExamStudyNote,
        biologyOnlyStudyNote,
        examOnlyStudyNote,
      ],
    });

    expect(result).toEqual({
      addedStudyNoteIds: [addedBiologyExamStudyNote.id],
      alreadySelectedStudyNoteIds: [selectedBiologyExamStudyNote.id],
      selectedStudyNoteIds: [
        "study-note-manual",
        selectedBiologyExamStudyNote.id,
        addedBiologyExamStudyNote.id,
      ],
      skippedIncompleteStudyNoteIds: [incompleteBiologyExamStudyNote.id],
    });
  });
});
