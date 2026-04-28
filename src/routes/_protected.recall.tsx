import { createFileRoute } from "@tanstack/react-router";

import { RecallRedirectPage } from "../modules/learning-loop/routes/recall-redirect-route";

export const Route = createFileRoute("/_protected/recall")({
  component: RecallRedirectPage,
});
