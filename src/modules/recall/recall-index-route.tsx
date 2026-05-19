import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/recall/")({
  component: RecallIndexRoute,
});

function RecallIndexRoute() {
  return <Navigate to="/recall/due-today" />;
}
