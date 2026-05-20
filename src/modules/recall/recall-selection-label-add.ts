import { type AppStudyNote, getStudyNoteReadiness } from "../study-notes";

type AddRecallableStudyNotesFromLabelsInput = {
  selectedLabelIds: readonly string[];
  selectedStudyNoteIds: readonly string[];
  studyNotes: readonly AppStudyNote[];
};

type AddRecallableStudyNotesFromLabelsResult = {
  addedStudyNoteIds: string[];
  alreadySelectedStudyNoteIds: string[];
  selectedStudyNoteIds: string[];
  skippedIncompleteStudyNoteIds: string[];
};

function getRequiredLabelIds(selectedLabelIds: readonly string[]) {
  return [
    ...new Set(
      selectedLabelIds.filter((selectedLabelId) => selectedLabelId.length > 0),
    ),
  ];
}

function studyNoteHasAllLabels(
  studyNote: Pick<AppStudyNote, "labelIds">,
  requiredLabelIds: readonly string[],
) {
  return requiredLabelIds.every((requiredLabelId) =>
    studyNote.labelIds.includes(requiredLabelId),
  );
}

export function addRecallableStudyNotesFromLabels({
  selectedLabelIds,
  selectedStudyNoteIds,
  studyNotes,
}: AddRecallableStudyNotesFromLabelsInput): AddRecallableStudyNotesFromLabelsResult {
  const requiredLabelIds = getRequiredLabelIds(selectedLabelIds);

  if (requiredLabelIds.length === 0) {
    return {
      addedStudyNoteIds: [],
      alreadySelectedStudyNoteIds: [],
      selectedStudyNoteIds: [...selectedStudyNoteIds],
      skippedIncompleteStudyNoteIds: [],
    };
  }

  const nextSelectedStudyNoteIds = [...selectedStudyNoteIds];
  const selectedStudyNoteIdSet = new Set(nextSelectedStudyNoteIds);
  const addedStudyNoteIds: string[] = [];
  const alreadySelectedStudyNoteIds: string[] = [];
  const skippedIncompleteStudyNoteIds: string[] = [];

  for (const studyNote of studyNotes) {
    if (!studyNoteHasAllLabels(studyNote, requiredLabelIds)) {
      continue;
    }

    if (!getStudyNoteReadiness(studyNote).recallable) {
      skippedIncompleteStudyNoteIds.push(studyNote.id);
      continue;
    }

    if (selectedStudyNoteIdSet.has(studyNote.id)) {
      alreadySelectedStudyNoteIds.push(studyNote.id);
      continue;
    }

    nextSelectedStudyNoteIds.push(studyNote.id);
    selectedStudyNoteIdSet.add(studyNote.id);
    addedStudyNoteIds.push(studyNote.id);
  }

  return {
    addedStudyNoteIds,
    alreadySelectedStudyNoteIds,
    selectedStudyNoteIds: nextSelectedStudyNoteIds,
    skippedIncompleteStudyNoteIds,
  };
}
