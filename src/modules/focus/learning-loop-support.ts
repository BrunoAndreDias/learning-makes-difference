import type { UserTimeZonePreference } from "../access/session/session-contract";
import type {
  FlashCardRecallAttemptsByNote,
  RecallSchedule,
  SessionResult,
} from "../recall";
import { deriveRecallGuidance } from "../recall";
import type { AppStudyNote } from "../study-notes";

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
  sessionResults: readonly SessionResult[];
  studyNotes: readonly AppStudyNote[];
  userTimeZone: UserTimeZonePreference;
};

export function getFocusLearningLoopSupportSuggestions(
  input: FocusLearningLoopSupportInput,
): FocusLearningLoopSupportSuggestion[] {
  const recallGuidance = deriveRecallGuidance({
    attemptsByNote: input.attemptsByNote,
    now: input.now,
    recallSchedules: input.recallSchedules,
    sessionResults: input.sessionResults,
    studyNotes: input.studyNotes,
    userTimeZone: input.userTimeZone,
  });
  const suggestions: FocusLearningLoopSupportSuggestion[] = [];

  if (recallGuidance.some((guidanceEntry) => guidanceEntry.needsPractice)) {
    suggestions.push({
      actionId: "practice-repair",
      href: "/study-notes",
    });
  }

  if (recallGuidance.some((guidanceEntry) => guidanceEntry.recallToday)) {
    suggestions.push({
      actionId: "recall-today",
      href: "/recall",
    });
  }

  return suggestions;
}
