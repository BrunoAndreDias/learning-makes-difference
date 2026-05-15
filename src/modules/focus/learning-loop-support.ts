import type { UserTimeZonePreference } from "../access/session/session-contract";
import type { FlashCardRecallAttemptsByNote, RecallSchedule } from "../recall";
import { buildRecallTodayQueue } from "../recall/recall-today";
import {
  type AppStudyNote,
  deriveStudyNoteLearningStates,
  toStudyNoteRecallHistories,
} from "../study-notes";
import { getStudyNotePracticeRepair } from "../study-notes/practice-repair";

export type FocusLearningLoopSupportSuggestion = {
  actionId: "practice-repair" | "recall-today";
  href: "/recall" | "/study-notes";
};

export function getFocusLearningLoopSupportSuggestions(input: {
  attemptsByNote: readonly FlashCardRecallAttemptsByNote[];
  now: string;
  recallSchedules: readonly RecallSchedule[];
  studyNotes: readonly AppStudyNote[];
  userTimeZone: UserTimeZonePreference;
}): FocusLearningLoopSupportSuggestion[] {
  const histories = toStudyNoteRecallHistories(input.attemptsByNote);
  const suggestions: FocusLearningLoopSupportSuggestion[] = [];

  if (
    deriveStudyNoteLearningStates({
      histories,
      now: input.now,
      recallSchedules: input.recallSchedules,
      studyNotes: input.studyNotes,
    }).some(
      (learningState) => getStudyNotePracticeRepair(learningState) !== null,
    )
  ) {
    suggestions.push({
      actionId: "practice-repair",
      href: "/study-notes",
    });
  }

  if (
    buildRecallTodayQueue({
      histories,
      now: input.now,
      recallSchedules: input.recallSchedules,
      studyNotes: input.studyNotes,
      userTimeZone: input.userTimeZone,
    }).length > 0
  ) {
    suggestions.push({
      actionId: "recall-today",
      href: "/recall",
    });
  }

  return suggestions;
}
