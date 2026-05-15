import { type AppStudyNote, getStudyNoteReadiness } from "../study-notes";
import type { StudyNoteRecallHistory } from "../study-notes/learning-state";

const minimumInterleavedRecallStudyNotes = 4;

export type InterleavedRecallRecommendation = {
  actionLabel: string;
  studyNoteIds: readonly string[];
  summary: string;
  title: string;
};

function isSuccessfulRecallAttempt(
  rating: StudyNoteRecallHistory["attempts"][number]["rating"],
) {
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

function isInterleavedRecallEligible(input: {
  history: StudyNoteRecallHistory | null;
  studyNote: AppStudyNote;
}) {
  return (
    getStudyNoteReadiness(input.studyNote).recallable &&
    getTrailingSuccessfulRecallCount(input.history) >= 2
  );
}

function sharesInterleavedRecallGroup(
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
    !isInterleavedRecallEligible({
      history: historyByStudyNoteId.get(selectedStudyNote.id) ?? null,
      studyNote: selectedStudyNote,
    })
  ) {
    return null;
  }

  const relatedEligibleStudyNotes = input.studyNotes.filter(
    (candidateStudyNote) =>
      sharesInterleavedRecallGroup(selectedStudyNote, candidateStudyNote) &&
      isInterleavedRecallEligible({
        history: historyByStudyNoteId.get(candidateStudyNote.id) ?? null,
        studyNote: candidateStudyNote,
      }),
  );

  if (relatedEligibleStudyNotes.length < minimumInterleavedRecallStudyNotes) {
    return null;
  }

  return {
    actionLabel: "Start Interleaved Recall",
    studyNoteIds: [
      selectedStudyNote.id,
      ...relatedEligibleStudyNotes
        .filter((studyNote) => studyNote.id !== selectedStudyNote.id)
        .map((studyNote) => studyNote.id),
    ],
    summary: `At least two recent Good or Easy recalls make this Study Note eligible for mixed practice with ${relatedEligibleStudyNotes.length} related Study Notes.`,
    title: "Interleaved Recall",
  };
}
