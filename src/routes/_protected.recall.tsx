import { createFileRoute } from "@tanstack/react-router";

import { RecallRouteShell } from "../modules/learning-loop/routes/recall-route";

export const Route = createFileRoute("/_protected/recall")({
  component: RecallRouteShell,
});
