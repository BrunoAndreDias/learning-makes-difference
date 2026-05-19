import type { RecallNoteSnapshot, RecallQuestion } from "./recall";

export function getRecallResultNoteTitle(
  note: Pick<RecallNoteSnapshot, "body" | "prompt" | "title">,
) {
  const title = (note.prompt ?? note.title).trim();

  return title.length > 0 ? title : note.body;
}

export function getRecallQuestionPrompt(
  question: Pick<RecallQuestion, "noteSnapshot">,
) {
  return getRecallResultNoteTitle(question.noteSnapshot);
}

export function getRecallQuestionExpectedAnswer(
  question: Pick<RecallQuestion, "noteSnapshot">,
) {
  return question.noteSnapshot.expectedAnswer ?? question.noteSnapshot.body;
}

export function getRecallQuestionReferenceText(
  question: Pick<RecallQuestion, "noteSnapshot">,
) {
  return question.noteSnapshot.source?.body ?? question.noteSnapshot.body;
}

export function getRecallQuestionReferenceTitle(
  question: Pick<RecallQuestion, "noteSnapshot">,
) {
  const sourceTitle = question.noteSnapshot.source?.title?.trim();

  if (sourceTitle !== undefined && sourceTitle.length > 0) {
    return sourceTitle;
  }

  return question.noteSnapshot.title;
}
