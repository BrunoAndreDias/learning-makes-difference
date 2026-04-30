import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "./protected-layout-route";

export const Route = createFileRoute("/_protected")({
  component: AppLayout,
});
