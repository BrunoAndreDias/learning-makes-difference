import { createFileRoute } from "@tanstack/react-router";

import { RecallTodayWorkspacePage } from "./recall-results-workspace-route";

export const Route = createFileRoute("/_protected/recall/")({
  component: RecallIndexRoute,
});

function RecallIndexRoute() {
  return <RecallTodayWorkspacePage />;
}
