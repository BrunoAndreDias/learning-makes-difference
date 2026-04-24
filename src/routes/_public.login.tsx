import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/login")({
  component: LoginPlaceholder,
});

function LoginPlaceholder() {
  return (
    <section className="stack">
      <article className="card stack">
        <p className="section-label">Public route</p>
        <h2>Login placeholder</h2>
        <p>
          Authentication flows will land here once the auth module is
          implemented.
        </p>
      </article>

      <div className="placeholder-grid">
        <article className="card stack">
          <p className="section-label">Entry point</p>
          <p>
            The public login route gives the unauthenticated area a concrete
            destination before real form handling and password workflows exist.
          </p>
          <div className="tag-row">
            <span className="tag">Email</span>
            <span className="tag">Password</span>
            <span className="tag">Forgot password</span>
          </div>
        </article>

        <article className="card stack">
          <p className="section-label">Layout check</p>
          <p>
            The placeholder validates a compact public card stack distinct from
            the denser protected shell.
          </p>
        </article>
      </div>
    </section>
  );
}
