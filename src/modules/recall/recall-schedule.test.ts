import { describe, expect, it } from "vitest";

import {
  createInitialRecallSchedule,
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
});
