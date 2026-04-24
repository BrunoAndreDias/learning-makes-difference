import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/app/dashboard")({
  component: DashboardPlaceholder,
});

function DashboardPlaceholder() {
  return (
    <section className="card stack">
      <p className="section-label">Protected route</p>
      <h3>Dashboard placeholder</h3>
      <p>
        Future authenticated note, label, and recall entry points will start
        here.
      </p>
    </section>
  );
}
