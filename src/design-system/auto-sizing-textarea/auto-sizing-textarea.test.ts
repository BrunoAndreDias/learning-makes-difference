// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { resizeTextareaToFitContent } from ".";

describe("resizeTextareaToFitContent", () => {
  it("sets textarea height to its full scroll height", () => {
    const textarea = document.createElement("textarea");

    Object.defineProperties(textarea, {
      clientHeight: { value: 70 },
      offsetHeight: { value: 74 },
      scrollHeight: { value: 142 },
    });

    textarea.style.height = "72px";

    resizeTextareaToFitContent(textarea);

    expect(textarea.style.height).toBe("146px");
  });

  it("ignores missing textarea refs", () => {
    expect(() => resizeTextareaToFitContent(null)).not.toThrow();
  });
});
