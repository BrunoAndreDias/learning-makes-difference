import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/login")({
  component: LoginPlaceholder,
});

function LoginPlaceholder() {
  return (
    <section className="stack">
      <p className="section-label">Public route</p>
      <h2>Login placeholder</h2>
      <p>
        Authentication flows will land here once the auth module is implemented.
      </p>
    </section>
  );
}
