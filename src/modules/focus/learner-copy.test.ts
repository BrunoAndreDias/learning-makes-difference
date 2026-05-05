import { describe, expect, it } from "vitest";

import { formatFocusTargetKindLabel } from "./learner-copy";

describe("focus learner copy", () => {
  it("maps focus target implementation terms to learner-facing labels", () => {
    expect(formatFocusTargetKindLabel("Note")).toBe("Note study");
    expect(formatFocusTargetKindLabel("RecallSession")).toBe("Recall practice");
  });
});
