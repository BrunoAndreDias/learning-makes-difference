import type { AppStudyNote } from "./study-notes";

export type StudyNoteReadiness = {
  dueForRecallEligible: boolean;
  incomplete: boolean;
  learningStateEligible: boolean;
  recallable: boolean;
  saveable: boolean;
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
