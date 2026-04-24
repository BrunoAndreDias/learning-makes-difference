import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <section className="stack">
      <div className="cluster">
        <h2>Application shell</h2>
        <div className="cluster">
          <Link
            to="/app/dashboard"
            className="nav-link"
            activeProps={{ className: "nav-link nav-link-active" }}
          >
            Dashboard
          </Link>
          <Link
            to="/app/settings"
            className="nav-link"
            activeProps={{ className: "nav-link nav-link-active" }}
          >
            Settings
          </Link>
        </div>
      </div>

      <p className="muted">
        Protected screens are placeholders only in this issue. Domain workflows
        stay out of scope.
      </p>

      <Outlet />
    </section>
  );
}
