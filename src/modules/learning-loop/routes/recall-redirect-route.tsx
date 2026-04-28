import { Navigate } from "@tanstack/react-router";

export function RecallRedirectPage() {
  return <Navigate replace to="/notes" />;
}
