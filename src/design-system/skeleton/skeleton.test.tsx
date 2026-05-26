// @vitest-environment jsdom

import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  PageReadinessCard,
  PageReadinessListRow,
  PageReadinessState,
  SkeletonBlock,
  SkeletonText,
} from "./index";

describe("Skeleton", () => {
  it("renders primitive blocks with optional motion and dimensions", () => {
    const { container } = render(
      <>
        <SkeletonBlock
          animated={false}
          as="div"
          data-testid="hero-skeleton"
          height="2rem"
          width="12rem"
        />
        <SkeletonText lineWidths={["100%", "70%"]} />
      </>,
    );

    const block = screen.getByTestId("hero-skeleton");
    const textLines = container.querySelectorAll(
      ".skeleton-text .skeleton-block",
    );

    expect(block.getAttribute("aria-hidden")).toBe("true");
    expect(block.getAttribute("data-animated")).toBe("false");
    expect(block.style.getPropertyValue("--skeleton-width")).toBe("12rem");
    expect(block.style.getPropertyValue("--skeleton-height")).toBe("2rem");
    expect(textLines).toHaveLength(2);
  });

  it("composes reusable page-readiness pieces without route-local placeholders", () => {
    const { container } = render(
      <PageReadinessState label="Preparing Study Guidance">
        <PageReadinessCard />
        <PageReadinessListRow />
      </PageReadinessState>,
    );

    const region = screen.getByRole("region", {
      name: "Preparing Study Guidance",
    });
    const status = screen.getByRole("status", {
      name: "Preparing Study Guidance",
    });

    expect(region.getAttribute("aria-busy")).toBe("true");
    expect(status).toBeInstanceOf(HTMLParagraphElement);
    expect(container.querySelectorAll(".page-readiness-card")).toHaveLength(1);
    expect(container.querySelectorAll(".page-readiness-list-row")).toHaveLength(
      1,
    );
  });

  it("keeps skeleton motion subtle and disables it for reduced-motion users", () => {
    const css = readFileSync(
      `${process.cwd()}/src/design-system/skeleton/skeleton.css`,
      "utf8",
    );

    expect(css).toContain('.skeleton-block[data-animated="true"]::after');
    expect(css).toContain(
      "animation: skeleton-shimmer 1.8s ease-in-out infinite;",
    );
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation: none;");
  });
});
