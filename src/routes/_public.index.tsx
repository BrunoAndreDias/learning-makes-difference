import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <section className="stack">
      <p className="section-label">Public route</p>
      <h2>SSR-ready application shell</h2>
      <p>
        This bootstrap slice wires TanStack Start, TypeScript, schema-driven
        environment configuration, and public/protected placeholder route
        areas for future product work.
      </p>
    </section>
  );
}
