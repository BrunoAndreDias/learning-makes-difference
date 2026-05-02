import { describe, expect, it } from "vitest";

import { formatSearchMatchLabel } from "./learner-copy";

describe("notes learner copy", () => {
  it("maps search match implementation terms to learner-facing labels", () => {
    expect(formatSearchMatchLabel("Title")).toBe("Prompt");
    expect(formatSearchMatchLabel("Body")).toBe("Notes");
    expect(formatSearchMatchLabel("Metaphor")).toBe("Hook");
    expect(formatSearchMatchLabel("Acronym")).toBe("Hook");
    expect(formatSearchMatchLabel("Label")).toBe("Label");
  });
});
