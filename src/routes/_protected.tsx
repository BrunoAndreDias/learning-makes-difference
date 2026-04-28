import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "../modules/workspace-shell/routes/protected-layout-route";

export const Route = createFileRoute("/_protected")({
  component: AppLayout,
});
