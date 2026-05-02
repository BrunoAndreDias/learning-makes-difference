import { describe, expect, it } from "vitest";

import { formatRecallModeLabel } from "./learner-copy";

describe("recall learner copy", () => {
  it("maps recall mode implementation terms to learner-facing labels", () => {
    expect(formatRecallModeLabel("FlashCard")).toBe("Recall");
  });
});
