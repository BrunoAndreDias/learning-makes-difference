import { createFileRoute } from "@tanstack/react-router";

import { RecallSelectionPage } from "../modules/learning-loop/routes/recall-route";

export const Route = createFileRoute("/_protected/recall/select")({
  component: RecallSelectionPage,
});
