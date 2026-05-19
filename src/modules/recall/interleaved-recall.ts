import { type AppStudyNote, getStudyNoteReadiness } from "../study-notes";
import type { StudyNoteRecallHistory } from "../study-notes/learning-state";

const MINIMUM_INTERLEAVED_RECALL_STUDY_NOTES = 4;

type RecallHistoryRating = StudyNoteRecallHistory["attempts"][number]["rating"];

export type InterleavedRecallRecommendation = {
  actionLabel: string;
  studyNoteIds: readonly string[];
  summary: string;
  title: string;
};

function isSuccessfulRecallAttempt(rating: RecallHistoryRating) {
  return rating === "good" || rating === "easy";
}

function getTrailingSuccessfulRecallCount(
  history: StudyNoteRecallHistory | null,
): number {
  if (history === null) {
    return 0;
  }

  let successfulRecallCount = 0;

  for (let index = history.attempts.length - 1; index >= 0; index -= 1) {
    const attempt = history.attempts[index];

    if (attempt === undefined || !isSuccessfulRecallAttempt(attempt.rating)) {
      break;
    }

    successfulRecallCount += 1;
  }

  return successfulRecallCount;
}

function isStudyNoteEligibleForInterleavedRecall(input: {
  history: StudyNoteRecallHistory | null;
  studyNote: AppStudyNote;
}) {
  return (
    getStudyNoteReadiness(input.studyNote).recallable &&
    getTrailingSuccessfulRecallCount(input.history) >= 2
  );
}

function isStudyNoteInInterleavedRecallGroup(
  anchorStudyNote: AppStudyNote,
  candidateStudyNote: AppStudyNote,
) {
  if (anchorStudyNote.id === candidateStudyNote.id) {
    return true;
  }

  if (anchorStudyNote.sourceNoteId === candidateStudyNote.sourceNoteId) {
    return true;
  }

  const anchorLabelIds = new Set(anchorStudyNote.labelIds);

  return candidateStudyNote.labelIds.some((labelId) =>
    anchorLabelIds.has(labelId),
  );
}

function getEligibleStudyNotesInInterleavedRecallGroup(input: {
  historyByStudyNoteId: ReadonlyMap<string, StudyNoteRecallHistory>;
  selectedStudyNote: AppStudyNote;
  studyNotes: readonly AppStudyNote[];
}) {
  return input.studyNotes.filter(
    (candidateStudyNote) =>
      isStudyNoteInInterleavedRecallGroup(
        input.selectedStudyNote,
        candidateStudyNote,
      ) &&
      isStudyNoteEligibleForInterleavedRecall({
        history: input.historyByStudyNoteId.get(candidateStudyNote.id) ?? null,
        studyNote: candidateStudyNote,
      }),
  );
}

export function getInterleavedRecallRecommendation(input: {
  histories: readonly StudyNoteRecallHistory[];
  studyNote: AppStudyNote | null;
  studyNotes: readonly AppStudyNote[];
}): InterleavedRecallRecommendation | null {
  if (input.studyNote === null) {
    return null;
  }

  const selectedStudyNote = input.studyNote;

  const historyByStudyNoteId = new Map(
    input.histories.map((history) => [history.studyNoteId, history]),
  );

  if (
    !isStudyNoteEligibleForInterleavedRecall({
      history: historyByStudyNoteId.get(selectedStudyNote.id) ?? null,
      studyNote: selectedStudyNote,
    })
  ) {
    return null;
  }

  const eligibleStudyNotesInGroup =
    getEligibleStudyNotesInInterleavedRecallGroup({
      historyByStudyNoteId,
      selectedStudyNote,
      studyNotes: input.studyNotes,
    });

  if (
    eligibleStudyNotesInGroup.length < MINIMUM_INTERLEAVED_RECALL_STUDY_NOTES
  ) {
    return null;
  }

  const recommendedStudyNoteIds = [
    selectedStudyNote.id,
    ...eligibleStudyNotesInGroup
      .filter((studyNote) => studyNote.id !== selectedStudyNote.id)
      .map((studyNote) => studyNote.id),
  ];

  return {
    actionLabel: "Start Interleaved Recall",
    studyNoteIds: recommendedStudyNoteIds,
    summary: `At least two recent Good or Easy recalls make this Study Note eligible for mixed practice with ${eligibleStudyNotesInGroup.length} related Study Notes.`,
    title: "Interleaved Recall",
  };
}
