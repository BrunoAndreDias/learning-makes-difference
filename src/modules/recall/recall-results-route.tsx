import { createFileRoute } from "@tanstack/react-router";

import { RecallResultsWorkspacePage } from "./recall-results-workspace-route";

export const Route = createFileRoute("/_protected/recall/results")({
  component: RecallResultsRoute,
});

function RecallResultsRoute() {
  return <RecallResultsWorkspacePage forcedView="results" />;
}
