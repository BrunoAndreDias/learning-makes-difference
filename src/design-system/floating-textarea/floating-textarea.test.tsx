// @vitest-environment jsdom

import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FloatingTextarea } from "./floating-textarea";

describe("FloatingTextarea", () => {
  it("renders a labelled textarea with the shared floating placeholder classes", () => {
    render(<FloatingTextarea label="Memory hook" rows={3} />);

    const textarea = screen.getByLabelText("Memory hook");

    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
    expect(textarea.getAttribute("placeholder")).toBe("Memory hook");
    expect(textarea.classList.contains("floating-textarea__control")).toBe(
      true,
    );
    expect(
      textarea.closest("label")?.classList.contains("floating-textarea"),
    ).toBe(true);
  });

  it("keeps the native placeholder available while styling the visible label", () => {
    render(
      <FloatingTextarea
        label="Expected answer"
        placeholder="Explain the answer"
      />,
    );

    expect(screen.getByLabelText("Expected answer")).toBe(
      screen.getByPlaceholderText("Explain the answer"),
    );
  });

  it("publishes the value and focus selectors that move the placeholder label", () => {
    const css = readFileSync(
      `${process.cwd()}/src/design-system/floating-textarea/floating-textarea.css`,
      "utf8",
    );
    const normalizedCss = css.replace(/\s+/g, " ");

    expect(normalizedCss).toContain(
      ".floating-textarea__control:not(:placeholder-shown) + .floating-textarea__label",
    );
    expect(css).toContain(
      ".floating-textarea__control:focus-visible + .floating-textarea__label",
    );
    expect(css).toContain("top: 0;");
    expect(css).toContain("right: auto;");
    expect(css).toContain("width: max-content;");
    expect(css).toContain(
      "background: var(\n    --floating-textarea-label-background,\n    var(--color-shell-panel)\n  );",
    );
    expect(css).toContain("transform: translate(-0.25rem, -50%);");
    expect(css).toContain("letter-spacing: 0.08em;");
  });
});
