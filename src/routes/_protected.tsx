import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected")({
  component: ProtectedLayout,
});

function ProtectedLayout() {
  return (
    <section className="panel panel-protected">
      <div className="stack">
        <p className="section-label">Protected area</p>
        <p className="muted">
          Route guards are intentionally deferred. This layout marks the
          authenticated shell the app will grow into.
        </p>
      </div>

      <Outlet />
    </section>
  );
}
