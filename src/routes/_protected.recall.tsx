import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/recall")({
  component: RecallRedirectPage,
});

function RecallRedirectPage() {
  return <Navigate replace to="/notes" />;
}
