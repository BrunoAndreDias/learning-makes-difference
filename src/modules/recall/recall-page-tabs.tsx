import { Link } from "@tanstack/react-router";

import { useAppTranslation } from "../language";

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
        to="/recall/due-today"
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
        to="/recall/results"
      >
        {t("recall.tabs.results")}
      </Link>
    </nav>
  );
}
