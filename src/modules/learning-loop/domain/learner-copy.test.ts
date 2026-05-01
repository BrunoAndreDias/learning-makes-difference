import { describe, expect, it } from "vitest";

import {
  formatFocusTargetKindLabel,
  formatRecallModeLabel,
  formatSearchMatchLabel,
} from "./learner-copy";

describe("learner copy", () => {
  it("maps implementation terms to learner-facing labels", () => {
    expect(formatSearchMatchLabel("Title")).toBe("Prompt");
    expect(formatSearchMatchLabel("Body")).toBe("Notes");
    expect(formatSearchMatchLabel("Metaphor")).toBe("Hook");
    expect(formatSearchMatchLabel("Acronym")).toBe("Hook");
    expect(formatSearchMatchLabel("Label")).toBe("Label");

    expect(formatRecallModeLabel("FlashCard")).toBe("Recall");
    expect(formatFocusTargetKindLabel("RecallSession")).toBe("Recall session");
  });
});
