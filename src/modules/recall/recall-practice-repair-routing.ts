import type {
  PracticeRepairDisplayQuestionLike,
  PracticeRepairEntry,
} from "./recall-practice-repair";

export type PracticeRepairQuestionRouteParams = {
  questionResultId: string;
  sessionResultId: string;
};

export function getPracticeRepairQuestionRouteParams(input: {
  entry: Pick<PracticeRepairEntry, "reference">;
  question?: Pick<PracticeRepairDisplayQuestionLike, "questionResultId">;
}): PracticeRepairQuestionRouteParams | null {
  const questionResultId =
    input.entry.reference.questionResultId ?? input.question?.questionResultId;

  if (questionResultId === undefined) {
    return null;
  }

  return {
    questionResultId,
    sessionResultId: input.entry.reference.sessionResultId,
  };
}
