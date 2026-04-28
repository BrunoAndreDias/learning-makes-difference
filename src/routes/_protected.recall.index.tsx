import { createFileRoute } from "@tanstack/react-router";

import { RecallHomePage } from "../modules/learning-loop/routes/recall-route";

export const Route = createFileRoute("/_protected/recall/")({
  component: RecallHomePage,
});
