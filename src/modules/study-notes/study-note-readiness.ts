import type { AppStudyNote } from "./study-notes";

export type StudyNoteReadiness = {
  dueForRecallEligible: boolean;
  incomplete: boolean;
  learningStateEligible: boolean;
  recallable: boolean;
  saveable: boolean;
};

export type StudyNoteReadinessLabels = {
  compact: string | null;
  due: string | null;
  practice: string | null;
};

export function getStudyNoteReadiness(
  studyNote: Pick<AppStudyNote, "expectedAnswer" | "prompt">,
): StudyNoteReadiness {
  const hasPrompt = studyNote.prompt.trim().length > 0;
  const hasExpectedAnswer = studyNote.expectedAnswer.trim().length > 0;
  const recallable = hasPrompt && hasExpectedAnswer;

  return {
    dueForRecallEligible: recallable,
    incomplete: !recallable,
    learningStateEligible: recallable,
    recallable,
    saveable: hasPrompt,
  };
}

export function getStudyNoteReadinessLabels(
  studyNote: Pick<AppStudyNote, "expectedAnswer" | "prompt">,
): StudyNoteReadinessLabels | null {
  const readiness = getStudyNoteReadiness(studyNote);

  if (!readiness.incomplete) {
    return null;
  }

  return {
    compact: readiness.saveable ? "Add expected answer" : "Add prompt",
    due: null,
    practice: null,
  };
}
