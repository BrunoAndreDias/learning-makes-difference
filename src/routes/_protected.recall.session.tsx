import { createFileRoute } from "@tanstack/react-router";

import { RecallSessionPage } from "../modules/learning-loop/routes/recall-session-route";

export const Route = createFileRoute("/_protected/recall/session")({
  component: RecallSessionPage,
});
