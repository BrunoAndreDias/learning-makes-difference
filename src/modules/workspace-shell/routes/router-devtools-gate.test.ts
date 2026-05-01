import { describe, expect, it } from "vitest";

import { shouldShowRouterDevtools } from "./router-devtools-gate";

describe("router devtools gate", () => {
  it("hides router devtools outside development", () => {
    expect(shouldShowRouterDevtools({ isDevelopment: true })).toBe(true);
    expect(shouldShowRouterDevtools({ isDevelopment: false })).toBe(false);
  });
});
