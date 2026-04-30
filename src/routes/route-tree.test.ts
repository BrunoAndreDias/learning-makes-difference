import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("route tree", () => {
  it("includes the public and protected areas from module-owned route files", () => {
    const generatedRouteTree = readFileSync(
      new URL("../routeTree.gen.ts", import.meta.url),
      "utf8",
    );

    expect(generatedRouteTree).toContain(
      "modules/access/routes/public-index-route",
    );
    expect(generatedRouteTree).toContain("modules/access/routes/login-route");
    expect(generatedRouteTree).toContain(
      "modules/learning-loop/routes/notes-route",
    );
    expect(generatedRouteTree).toContain("modules/labels/routes/labels-route");
    expect(generatedRouteTree).toContain(
      "modules/learning-loop/routes/recall-route",
    );
    expect(generatedRouteTree).toContain(
      "modules/learning-loop/routes/focus-route",
    );
    expect(generatedRouteTree).toContain(
      "modules/access/routes/settings-route",
    );

    expect(generatedRouteTree).toContain(
      "'/': typeof modulesAccessRoutesPublicIndexRouteRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/login': typeof modulesAccessRoutesLoginRouteRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/notes': typeof modulesLearningLoopRoutesNotesRouteRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/labels': typeof modulesLabelsRoutesLabelsRouteRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/recall': typeof modulesLearningLoopRoutesRecallRouteRouteWithChildren",
    );
    expect(generatedRouteTree).toContain(
      "'/focus': typeof modulesLearningLoopRoutesFocusRouteRoute",
    );
    expect(generatedRouteTree).not.toContain(
      "'/recall/results': typeof ProtectedRecallResultsRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/recall/select': typeof modulesLearningLoopRoutesRecallSelectionRouteRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/recall/session': typeof modulesLearningLoopRoutesRecallSessionRouteRoute",
    );
    expect(generatedRouteTree).not.toContain(
      "'/history': typeof ProtectedHistoryRoute",
    );
    expect(generatedRouteTree).not.toContain(
      "'/notes/recall': typeof ProtectedNotesRecallRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/settings': typeof modulesAccessRoutesSettingsRouteRoute",
    );
  });
});
