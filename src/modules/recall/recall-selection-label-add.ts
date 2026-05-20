import { type AppStudyNote, getStudyNoteReadiness } from "../study-notes";

export function addRecallableStudyNotesFromLabel(input: {
  selectedLabelId: string;
  selectedStudyNoteIds: readonly string[];
  studyNotes: readonly AppStudyNote[];
}) {
  const selectedStudyNoteIds = [...input.selectedStudyNoteIds];
  const selectedStudyNoteIdSet = new Set(selectedStudyNoteIds);
  const addedStudyNoteIds: string[] = [];

  for (const studyNote of input.studyNotes) {
    if (!studyNote.labelIds.includes(input.selectedLabelId)) {
      continue;
    }

    if (!getStudyNoteReadiness(studyNote).recallable) {
      continue;
    }

    if (selectedStudyNoteIdSet.has(studyNote.id)) {
      continue;
    }

    selectedStudyNoteIds.push(studyNote.id);
    selectedStudyNoteIdSet.add(studyNote.id);
    addedStudyNoteIds.push(studyNote.id);
  }

  return {
    addedStudyNoteIds,
    selectedStudyNoteIds,
  };
}
