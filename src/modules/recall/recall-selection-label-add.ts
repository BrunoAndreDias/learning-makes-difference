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
      selectedStudyNoteIds: [...selectedStudyNoteIds],
    };
  }

  const nextSelectedStudyNoteIds = [...selectedStudyNoteIds];
  const selectedStudyNoteIdSet = new Set(nextSelectedStudyNoteIds);
  const addedStudyNoteIds: string[] = [];

  for (const studyNote of studyNotes) {
    if (!studyNoteHasAllLabels(studyNote, requiredLabelIds)) {
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
