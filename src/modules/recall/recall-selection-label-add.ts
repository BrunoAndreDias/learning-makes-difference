import { type AppStudyNote, getStudyNoteReadiness } from "../study-notes";

type AddRecallableStudyNotesFromLabelInput = {
  selectedLabelId: string;
  selectedStudyNoteIds: readonly string[];
  studyNotes: readonly AppStudyNote[];
};

type AddRecallableStudyNotesFromLabelResult = {
  addedStudyNoteIds: string[];
  selectedStudyNoteIds: string[];
};

export function addRecallableStudyNotesFromLabel({
  selectedLabelId,
  selectedStudyNoteIds,
  studyNotes,
}: AddRecallableStudyNotesFromLabelInput): AddRecallableStudyNotesFromLabelResult {
  const nextSelectedStudyNoteIds = [...selectedStudyNoteIds];
  const selectedStudyNoteIdSet = new Set(nextSelectedStudyNoteIds);
  const addedStudyNoteIds: string[] = [];

  for (const studyNote of studyNotes) {
    if (!studyNote.labelIds.includes(selectedLabelId)) {
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
