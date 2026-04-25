import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

import appLogo from "../../docs/layout/logo.svg";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="auth-shell">
      <Link className="auth-logo" to="/">
        <img alt="Learning Makes Difference" src={appLogo} />
      </Link>
      <Outlet />
    </div>
  );
}
