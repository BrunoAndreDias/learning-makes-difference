import { describe, expect, it } from "vitest";

import {
  createInitialRecallSchedule,
  formatNextRecallTiming,
  getUpdatedRecallSchedule,
  isRecallScheduleDue,
} from "./recall-schedule";

describe("Recall Schedule", () => {
  it("keeps Forgot and Hard close while Good and Easy push recall farther out", () => {
    const initial = createInitialRecallSchedule({
      now: "2026-05-15T09:00:00.000Z",
      studyNoteId: "study-note-1",
    });

    expect(isRecallScheduleDue(initial, "2026-05-15T23:00:00.000Z")).toBe(true);

    expect(
      getUpdatedRecallSchedule({
        now: "2026-05-15T09:00:00.000Z",
        rating: "forgot",
        schedule: initial,
      }).nextRecallAt,
    ).toBe("2026-05-16T09:00:00.000Z");
    expect(
      getUpdatedRecallSchedule({
        now: "2026-05-15T09:00:00.000Z",
        rating: "hard",
        schedule: initial,
      }).nextRecallAt,
    ).toBe("2026-05-16T09:00:00.000Z");
    expect(
      getUpdatedRecallSchedule({
        now: "2026-05-15T09:00:00.000Z",
        rating: "good",
        schedule: initial,
      }).nextRecallAt,
    ).toBe("2026-05-18T09:00:00.000Z");
    expect(
      getUpdatedRecallSchedule({
        now: "2026-05-15T09:00:00.000Z",
        rating: "easy",
        schedule: initial,
      }).nextRecallAt,
    ).toBe("2026-05-22T09:00:00.000Z");
  });

  it("formats factual next recall timing copy without algorithm language", () => {
    expect(
      formatNextRecallTiming({
        now: "2026-05-15T12:00:00.000Z",
        schedule: null,
        userTimeZone: "America/New_York",
      }),
    ).toBe("Recall today");
    expect(
      formatNextRecallTiming({
        now: "2026-05-15T12:00:00.000Z",
        schedule: {
          ease: 2.5,
          intervalDays: 1,
          lastRecalledAt: "2026-05-14T09:00:00.000Z",
          nextRecallAt: "2026-05-15T23:30:00.000Z",
          repetitionCount: 1,
          studyNoteId: "study-note-due-today",
        },
        userTimeZone: "America/New_York",
      }),
    ).toBe("Recall today");
    expect(
      formatNextRecallTiming({
        now: "2026-05-15T12:00:00.000Z",
        schedule: {
          ease: 2.5,
          intervalDays: 1,
          lastRecalledAt: "2026-05-15T09:00:00.000Z",
          nextRecallAt: "2026-05-16T09:00:00.000Z",
          repetitionCount: 1,
          studyNoteId: "study-note-tomorrow",
        },
        userTimeZone: "America/New_York",
      }),
    ).toBe("Next recall tomorrow");
    expect(
      formatNextRecallTiming({
        now: "2026-05-15T12:00:00.000Z",
        schedule: {
          ease: 2.65,
          intervalDays: 7,
          lastRecalledAt: "2026-05-12T09:00:00.000Z",
          nextRecallAt: "2026-05-19T09:00:00.000Z",
          repetitionCount: 2,
          studyNoteId: "study-note-later",
        },
        userTimeZone: "America/New_York",
      }),
    ).toBe("Next recall May 19");
  });
});
