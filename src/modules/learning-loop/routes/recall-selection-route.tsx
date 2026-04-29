import { createFileRoute } from "@tanstack/react-router";

import { RecallSelectionPage } from "./recall-route";

export const Route = createFileRoute("/_protected/recall/select")({
  component: RecallSelectionPage,
});
