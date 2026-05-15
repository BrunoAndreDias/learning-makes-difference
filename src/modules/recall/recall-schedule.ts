import type { UserTimeZonePreference } from "../access/session/session-contract";
import { formatLocalMonthDay, getLocalDateKey } from "./local-date";
import type { RecallSelfRating } from "./recall";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RecallSchedule = {
  ease: number;
  intervalDays: number;
  lastRecalledAt: string | null;
  nextRecallAt: string;
  repetitionCount: number;
  studyNoteId: string;
};

export function createInitialRecallSchedule(input: {
  now: string;
  studyNoteId: string;
}): RecallSchedule {
  return {
    ease: 2.5,
    intervalDays: 0,
    lastRecalledAt: null,
    nextRecallAt: input.now,
    repetitionCount: 0,
    studyNoteId: input.studyNoteId,
  };
}

function addDays(timestamp: string, days: number): string {
  return new Date(new Date(timestamp).getTime() + days * DAY_MS).toISOString();
}

function getNextIntervalDays(input: {
  rating: RecallSelfRating;
  schedule: RecallSchedule;
}): number {
  switch (input.rating) {
    case "forgot":
    case "hard":
      return 1;
    case "good":
      return Math.max(3, input.schedule.intervalDays + 3);
    case "easy":
      return Math.max(7, input.schedule.intervalDays + 7);
  }
}

function getNextEase(input: {
  rating: RecallSelfRating;
  schedule: RecallSchedule;
}): number {
  switch (input.rating) {
    case "forgot":
      return Math.max(1.3, input.schedule.ease - 0.3);
    case "hard":
      return Math.max(1.3, input.schedule.ease - 0.15);
    case "good":
      return input.schedule.ease;
    case "easy":
      return input.schedule.ease + 0.15;
  }
}

export function getUpdatedRecallSchedule(input: {
  now: string;
  rating: RecallSelfRating;
  schedule: RecallSchedule;
}): RecallSchedule {
  const intervalDays = getNextIntervalDays(input);

  return {
    ease: getNextEase(input),
    intervalDays,
    lastRecalledAt: input.now,
    nextRecallAt: addDays(input.now, intervalDays),
    repetitionCount: input.schedule.repetitionCount + 1,
    studyNoteId: input.schedule.studyNoteId,
  };
}

export function isRecallScheduleDue(
  schedule: RecallSchedule,
  now: string,
): boolean {
  const nextRecallAt = new Date(schedule.nextRecallAt).getTime();
  const nowTimestamp = new Date(now).getTime();

  if (Number.isNaN(nextRecallAt) || Number.isNaN(nowTimestamp)) {
    return false;
  }

  return nextRecallAt <= nowTimestamp;
}

export function formatNextRecallTiming(input: {
  now: string;
  schedule: RecallSchedule | null;
  userTimeZone: UserTimeZonePreference;
}): string | null {
  if (input.schedule === null) {
    return "Recall today";
  }

  const nextRecallDateKey = getLocalDateKey({
    timestamp: input.schedule.nextRecallAt,
    userTimeZone: input.userTimeZone,
  });
  const todayDateKey = getLocalDateKey({
    timestamp: input.now,
    userTimeZone: input.userTimeZone,
  });

  if (nextRecallDateKey === null || todayDateKey === null) {
    return null;
  }

  if (nextRecallDateKey <= todayDateKey) {
    return "Recall today";
  }

  const tomorrowDateKey = getLocalDateKey({
    timestamp: new Date(new Date(input.now).getTime() + DAY_MS).toISOString(),
    userTimeZone: input.userTimeZone,
  });

  if (tomorrowDateKey !== null && nextRecallDateKey === tomorrowDateKey) {
    return "Next recall tomorrow";
  }

  const formattedDate = formatLocalMonthDay({
    timestamp: input.schedule.nextRecallAt,
    userTimeZone: input.userTimeZone,
  });

  return formattedDate === null ? null : `Next recall ${formattedDate}`;
}
