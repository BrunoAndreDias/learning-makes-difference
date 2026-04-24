import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/_public/login")({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  component: LoginPlaceholder,
});

function LoginPlaceholder() {
  const search = Route.useSearch();

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
          <section className="stack" aria-labelledby="redirect-target-label">
            <strong id="redirect-target-label">
              Return path reserved for post-auth handoff
            </strong>
            <code>{search.redirect ?? "/notes"}</code>
          </section>
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
