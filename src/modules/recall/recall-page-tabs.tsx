import { Link } from "@tanstack/react-router";

import { useAppTranslation } from "../language";
import { appRoutePaths } from "../workspace-shell/app-shell/route-paths";

export function RecallPageTabs() {
  const { t } = useAppTranslation();

  return (
    <nav aria-label={t("recall.tabs")} className="recall-page-tabs">
      <Link
        activeProps={{
          "aria-current": "page",
          className: "recall-page-tabs__link recall-page-tabs__link-active",
        }}
        activeOptions={{ exact: true }}
        className="recall-page-tabs__link"
        to={appRoutePaths.recallDueToday}
      >
        {t("recall.dueToday.title")}
      </Link>
      <Link
        activeProps={{
          "aria-current": "page",
          className: "recall-page-tabs__link recall-page-tabs__link-active",
        }}
        activeOptions={{ exact: true }}
        className="recall-page-tabs__link"
        to={appRoutePaths.recallResults}
      >
        {t("recall.tabs.results")}
      </Link>
    </nav>
  );
}
