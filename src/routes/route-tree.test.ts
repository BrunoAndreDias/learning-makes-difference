import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("route tree", () => {
  it("includes the public and protected areas from module-owned route files", () => {
    const generatedRouteTree = readFileSync(
      new URL("../routeTree.gen.ts", import.meta.url),
      "utf8",
    );

    expect(generatedRouteTree).toContain(
      "modules/access/public-entry/public-index-route",
    );
    expect(generatedRouteTree).toContain("modules/access/session/login-route");
    expect(generatedRouteTree).toContain(
      "modules/study-notes/study-notes-route",
    );
    expect(generatedRouteTree).not.toContain(
      "modules/notes/notes-workspace/notes-route",
    );
    expect(generatedRouteTree).not.toContain(
      "modules/notes/study-notes-prototype/study-notes-prototype-route",
    );
    expect(generatedRouteTree).not.toContain(
      "modules/labels/label-management/labels-route",
    );
    expect(generatedRouteTree).toContain("modules/recall/recall-route");
    expect(generatedRouteTree).toContain(
      "modules/recall/recall-practice-repair-queue-route",
    );
    expect(generatedRouteTree).toContain(
      "modules/recall/recall-practice-repair-route",
    );
    expect(generatedRouteTree).toContain(
      "modules/recall/recall-practice-repair-draft-route",
    );
    expect(generatedRouteTree).toContain(
      "modules/recall/recall-practice-repair-results-redirect-route",
    );
    expect(generatedRouteTree).toContain("modules/focus/focus-route");
    expect(generatedRouteTree).toContain(
      "modules/study-guidance/study-guidance-route",
    );
    expect(generatedRouteTree).toContain(
      "modules/access/session/settings-route",
    );

    expect(generatedRouteTree).toContain(
      "'/': typeof modulesAccessPublicEntryPublicIndexRouteRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/login': typeof modulesAccessSessionLoginRouteRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/study-notes': typeof modulesStudyNotesStudyNotesRouteRoute",
    );
    expect(generatedRouteTree).not.toContain(
      "'/notes': typeof modulesNotesNotesWorkspaceNotesRouteRoute",
    );
    expect(generatedRouteTree).not.toContain("'/study-notes-prototype'");
    expect(generatedRouteTree).not.toContain(
      "'/labels': typeof modulesLabelsLabelManagementLabelsRouteRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/recall': typeof modulesRecallRecallRouteRouteWithChildren",
    );
    expect(generatedRouteTree).toContain(
      "'/focus': typeof modulesFocusFocusRouteRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/today': typeof modulesStudyGuidanceStudyGuidanceRouteRoute",
    );
    expect(generatedRouteTree).not.toContain(
      "'/insights': typeof modulesStudyGuidanceStudyGuidanceRouteRoute",
    );
    expect(generatedRouteTree).toContain("'/recall/results':");
    expect(generatedRouteTree).toContain("'/recall/repair':");
    expect(generatedRouteTree).toContain(
      "'/recall/repair/$sessionResultId/questions/$questionResultId':",
    );
    expect(generatedRouteTree).toContain(
      "'/recall/results/$sessionResultId/questions/$questionResultId/repair':",
    );
    expect(generatedRouteTree).toContain(
      "'/recall/repair/$practiceRepairEntryId':",
    );
    expect(generatedRouteTree).toContain(
      "'/recall/select': typeof modulesRecallRecallSelectionRouteRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/recall/session': typeof modulesRecallRecallSessionRouteRoute",
    );
    expect(generatedRouteTree).not.toContain(
      "'/history': typeof ProtectedHistoryRoute",
    );
    expect(generatedRouteTree).not.toContain(
      "'/notes/recall': typeof ProtectedNotesRecallRoute",
    );
    expect(generatedRouteTree).toContain(
      "'/settings': typeof modulesAccessSessionSettingsRouteRoute",
    );
  });
});
