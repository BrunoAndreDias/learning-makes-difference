import { describe, expect, it } from "vitest";

import { formatCount } from "./format-count";

describe("formatCount", () => {
  it("formats singular, regular plural, and custom plural labels", () => {
    expect(formatCount(1, "label")).toBe("1 label");
    expect(formatCount(2, "label")).toBe("2 labels");
    expect(formatCount(2, "match", "matches")).toBe("2 matches");
  });
});
