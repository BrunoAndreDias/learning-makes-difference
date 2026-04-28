import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { foundationTokens } from "./tokens.js";

describe("foundationTokens", () => {
  it("captures the issue 14 design-system contract from docs/layout", () => {
    expect(foundationTokens.brand.logoSource).toBe("docs/layout/logo.svg");
    expect(foundationTokens.brand.layoutReferences).toEqual([
      "docs/layout/no_collapse.png",
      "docs/layout/collapsed_menu_withou_focus_mode.png",
    ]);
    expect(foundationTokens.color.shell.canvas).toBe("#f7f4ea");
    expect(foundationTokens.color.brand.primary).toBe("#2563eb");
    expect(foundationTokens.typography.body.sizeRem).toBe(1);
    expect(foundationTokens.typography.body.lineHeight).toBe(1.5);
    expect(foundationTokens.focus.outlineWidthPx).toBe(3);
    expect(foundationTokens.focus.outlineOffsetPx).toBe(3);
    expect(foundationTokens.spacing[4]).toBe("1rem");
    expect(foundationTokens.radius.lg).toBe("1rem");
    expect(foundationTokens.breakpoints.lg).toBe("72rem");
  });

  it("publishes CSS variables and accessible defaults for the app shell", () => {
    const css = readFileSync(new URL("./global.css", import.meta.url), "utf8");

    expect(css).toContain("--color-shell-canvas: #f7f4ea;");
    expect(css).toContain("--color-brand-primary: #2563eb;");
    expect(css).toContain("--focus-ring: 0 0 0 3px rgba(37, 99, 235, 0.35);");
    expect(css).toContain("font-size: 16px;");
    expect(css).toContain("line-height: 1.5;");
    expect(css).toContain(":focus-visible");
    expect(css).toContain(".app-shell");
    expect(css).toContain(".surface-card");
  });

  it("keeps the app sidebar account row pinned above the flexible notes body", () => {
    const css = readFileSync(
      new URL(
        "../modules/workspace-shell/workspace-shell.css",
        import.meta.url,
      ),
      "utf8",
    );

    expect(css).toContain("grid-template-rows: auto minmax(0, 1fr);");
    expect(css).toContain("align-content: start;");
  });
});
