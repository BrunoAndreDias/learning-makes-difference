import type { AppStudyNote } from "./study-notes";

export const unlabeledStudyNotesFilterValue = "__unlabeled__";
export const unlabeledStudyNotesFilterLabel = "Unlabeled Study Notes";

export function isUnlabeledStudyNotesFilterValue(value: string) {
  return value === unlabeledStudyNotesFilterValue;
}

export function filterStudyNotesBySelectedLabel(
  studyNotes: readonly AppStudyNote[],
  selectedLabelId: string,
) {
  if (selectedLabelId === "") {
    return studyNotes;
  }

  if (isUnlabeledStudyNotesFilterValue(selectedLabelId)) {
    return studyNotes.filter((studyNote) => studyNote.labelIds.length === 0);
  }

  return studyNotes.filter((studyNote) =>
    studyNote.labelIds.includes(selectedLabelId),
  );
}
