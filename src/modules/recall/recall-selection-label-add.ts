import { type AppStudyNote, getStudyNoteReadiness } from "../study-notes";

type AddRecallableStudyNotesFromLabelsInput = {
  selectedLabelIds: readonly string[];
  selectedStudyNoteIds: readonly string[];
  studyNotes: readonly AppStudyNote[];
};

type AddRecallableStudyNotesFromLabelsResult = {
  addedStudyNoteIds: string[];
  selectedStudyNoteIds: string[];
};

export function addRecallableStudyNotesFromLabels({
  selectedLabelIds,
  selectedStudyNoteIds,
  studyNotes,
}: AddRecallableStudyNotesFromLabelsInput): AddRecallableStudyNotesFromLabelsResult {
  const requiredLabelIds = [
    ...new Set(
      selectedLabelIds.filter((selectedLabelId) => selectedLabelId.length > 0),
    ),
  ];

  if (requiredLabelIds.length === 0) {
    return {
      addedStudyNoteIds: [],
      selectedStudyNoteIds: [...selectedStudyNoteIds],
    };
  }

  const nextSelectedStudyNoteIds = [...selectedStudyNoteIds];
  const selectedStudyNoteIdSet = new Set(nextSelectedStudyNoteIds);
  const addedStudyNoteIds: string[] = [];

  for (const studyNote of studyNotes) {
    if (
      !requiredLabelIds.every((selectedLabelId) =>
        studyNote.labelIds.includes(selectedLabelId),
      )
    ) {
      continue;
    }

    if (!getStudyNoteReadiness(studyNote).recallable) {
      continue;
    }

    if (selectedStudyNoteIdSet.has(studyNote.id)) {
      continue;
    }

    nextSelectedStudyNoteIds.push(studyNote.id);
    selectedStudyNoteIdSet.add(studyNote.id);
    addedStudyNoteIds.push(studyNote.id);
  }

  return {
    addedStudyNoteIds,
    selectedStudyNoteIds: nextSelectedStudyNoteIds,
  };
}
