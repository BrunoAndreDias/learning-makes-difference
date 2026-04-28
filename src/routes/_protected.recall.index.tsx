import { createFileRoute } from "@tanstack/react-router";

import { RecallResultsWorkspacePage } from "../modules/learning-loop/routes/recall-results-workspace-route";

export const Route = createFileRoute("/_protected/recall/")({
  component: RecallResultsWorkspacePage,
});
