import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("route tree", () => {
  it("includes the public and protected placeholder areas", () => {
    const generatedRouteTree = readFileSync(
      new URL("../src/routeTree.gen.ts", import.meta.url),
      "utf8",
    );

    expect(generatedRouteTree).toContain("'/': typeof PublicIndexRoute");
    expect(generatedRouteTree).toContain("'/login': typeof AuthLoginRoute");
    expect(generatedRouteTree).toContain(
      "'/notes': typeof ProtectedNotesRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/labels': typeof ProtectedLabelsRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/recall': typeof ProtectedRecallRoute",
    );
    expect(generatedRouteTree).not.toContain(
      "'/recall/results': typeof ProtectedRecallResultsRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/recall/select': typeof ProtectedRecallSelectRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/recall/session': typeof ProtectedRecallSessionRoute",
    );
    expect(generatedRouteTree).not.toContain(
      "'/history': typeof ProtectedHistoryRoute",
    );
    expect(generatedRouteTree).not.toContain(
      "'/notes/recall': typeof ProtectedNotesRecallRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/settings': typeof ProtectedSettingsRoute",
    );
  });
});
