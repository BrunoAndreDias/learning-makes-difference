import { createFileRoute } from "@tanstack/react-router";

import { RecallResultsPage } from "../modules/learning-loop/routes/results-route";

export const Route = createFileRoute("/_protected/recall/results")({
  component: RecallResultsPage,
});
