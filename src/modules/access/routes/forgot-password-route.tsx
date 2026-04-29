import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return (
    <article className="auth-card">
      <header className="auth-card__header">
        <h2 className="auth-card__heading">Reset your password</h2>
        <p className="auth-card__subtitle">
          Password reset is coming soon. For now, please contact support.
        </p>
      </header>

      <p className="auth-footer">
        <Link className="auth-link" to="/login">
          ← Back to sign in
        </Link>
      </p>
    </article>
  );
}
