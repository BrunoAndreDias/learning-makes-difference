import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader } from "../../../design-system/page-header";
import { useAppTranslation } from "../../language";

export const Route = createFileRoute("/_auth/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useAppTranslation();

  return (
    <article className="auth-card">
      <PageHeader
        className="auth-card__header"
        description={t("access.forgotPassword.subtitle")}
        headingLevel={2}
        headingProps={{ className: "auth-card__heading" }}
        title={t("access.forgotPassword.heading")}
      />

      <p className="auth-footer">
        <Link className="auth-link" to="/login">
          {t("access.forgotPassword.backToLogin")}
        </Link>
      </p>
    </article>
  );
}
