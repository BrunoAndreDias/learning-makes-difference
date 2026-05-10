import { createFileRoute, Link } from "@tanstack/react-router";

import { useAppTranslation } from "../../language";

export const Route = createFileRoute("/_auth/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useAppTranslation();

  return (
    <article className="auth-card">
      <header className="auth-card__header">
        <h2 className="auth-card__heading">
          {t("access.forgotPassword.heading")}
        </h2>
        <p className="auth-card__subtitle">
          {t("access.forgotPassword.subtitle")}
        </p>
      </header>

      <p className="auth-footer">
        <Link className="auth-link" to="/login">
          {t("access.forgotPassword.backToLogin")}
        </Link>
      </p>
    </article>
  );
}
