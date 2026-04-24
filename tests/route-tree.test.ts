import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("route tree", () => {
  it("includes the public and protected placeholder areas", () => {
    const generatedRouteTree = readFileSync(
      new URL("../src/routeTree.gen.ts", import.meta.url),
      "utf8",
    );

    expect(generatedRouteTree).toContain("'/': typeof PublicIndexRoute");
    expect(generatedRouteTree).toContain("'/login': typeof PublicLoginRoute");
    expect(generatedRouteTree).toContain(
      "'/app': typeof ProtectedAppRouteWithChildren",
    );
    expect(generatedRouteTree).toContain(
      "'/app/dashboard': typeof ProtectedAppDashboardRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/app/settings': typeof ProtectedAppSettingsRoute",
    );
  });
});
