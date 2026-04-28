import { createFileRoute } from "@tanstack/react-router";

import { SessionResultsPage } from "../modules/learning-loop/routes/session-results-route";

export const Route = createFileRoute("/_protected/recall/results")({
  component: SessionResultsPage,
});
