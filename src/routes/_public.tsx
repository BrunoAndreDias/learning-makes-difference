import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
});

function PublicLayout() {
  return (
    <section className="panel">
      <p className="section-label">Public area</p>
      <Outlet />
    </section>
  );
}
