import { createFileRoute } from "@tanstack/react-router";

import { RecallDueTodayWorkspacePage } from "./recall-results-workspace-route";

export const Route = createFileRoute("/_protected/recall/due-today")({
  component: RecallDueTodayRoute,
});

function RecallDueTodayRoute() {
  return <RecallDueTodayWorkspacePage />;
}
