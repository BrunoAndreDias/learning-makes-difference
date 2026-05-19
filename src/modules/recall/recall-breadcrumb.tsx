import { Link } from "@tanstack/react-router";
import { useAppTranslation } from "../language";

export function RecallBreadcrumb({
  currentLabel,
}: Readonly<{ currentLabel: string }>) {
  const { t } = useAppTranslation();

  return (
    <nav aria-label={t("recall.breadcrumb")} className="recall-breadcrumb">
      <ol>
        <li>
          <Link to="/recall">{t("shell.workspace.recall")}</Link>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page">{currentLabel}</li>
      </ol>
    </nav>
  );
}
