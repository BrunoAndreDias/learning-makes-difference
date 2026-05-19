import { createFileRoute, Navigate } from "@tanstack/react-router";

import { appRoutePaths } from "../workspace-shell/app-shell/route-paths";

export const Route = createFileRoute("/_protected/recall/")({
  component: RecallIndexRoute,
});

function RecallIndexRoute() {
  return <Navigate to={appRoutePaths.recallDueToday} />;
}
