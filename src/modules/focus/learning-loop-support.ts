import type { UserTimeZonePreference } from "../access/session/session-contract";
import type { FlashCardRecallAttemptsByNote, RecallSchedule } from "../recall";
import { buildRecallTodayQueue } from "../recall/recall-today";
import {
  type AppStudyNote,
  deriveStudyNoteLearningStates,
  toStudyNoteRecallHistories,
} from "../study-notes";
import { getStudyNotePracticeRepair } from "../study-notes/practice-repair";

export type FocusLearningLoopSupportSuggestion =
  | {
      actionId: "practice-repair";
      href: "/study-notes";
    }
  | {
      actionId: "recall-today";
      href: "/recall";
    };

type FocusLearningLoopSupportInput = {
  attemptsByNote: readonly FlashCardRecallAttemptsByNote[];
  now: string;
  recallSchedules: readonly RecallSchedule[];
  studyNotes: readonly AppStudyNote[];
  userTimeZone: UserTimeZonePreference;
};

export function getFocusLearningLoopSupportSuggestions(
  input: FocusLearningLoopSupportInput,
): FocusLearningLoopSupportSuggestion[] {
  const histories = toStudyNoteRecallHistories(input.attemptsByNote);
  const learningStates = deriveStudyNoteLearningStates({
    histories,
    now: input.now,
    recallSchedules: input.recallSchedules,
    studyNotes: input.studyNotes,
  });
  const recallTodayQueue = buildRecallTodayQueue({
    histories,
    now: input.now,
    recallSchedules: input.recallSchedules,
    studyNotes: input.studyNotes,
    userTimeZone: input.userTimeZone,
  });
  const suggestions: FocusLearningLoopSupportSuggestion[] = [];

  if (
    learningStates.some(
      (learningState) => getStudyNotePracticeRepair(learningState) !== null,
    )
  ) {
    suggestions.push({
      actionId: "practice-repair",
      href: "/study-notes",
    });
  }

  if (recallTodayQueue.length > 0) {
    suggestions.push({
      actionId: "recall-today",
      href: "/recall",
    });
  }

  return suggestions;
}
