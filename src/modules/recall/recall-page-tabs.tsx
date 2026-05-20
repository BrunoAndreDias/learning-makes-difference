import { Link } from "@tanstack/react-router";

import { type AppTranslationKey, useAppTranslation } from "../language";
import { appRoutePaths } from "../workspace-shell/app-shell/route-paths";

type RecallPageTabPath = (typeof appRoutePaths)[
  | "recall"
  | "recallDueToday"
  | "recallResults"];

type RecallPageTabItem = {
  labelKey: AppTranslationKey;
  to: RecallPageTabPath;
};

const recallPageTabItems = [
  {
    labelKey: "recall.today.title",
    to: appRoutePaths.recall,
  },
  {
    labelKey: "recall.dueToday.title",
    to: appRoutePaths.recallDueToday,
  },
  {
    labelKey: "recall.tabs.results",
    to: appRoutePaths.recallResults,
  },
] as const satisfies readonly RecallPageTabItem[];

export function RecallPageTabs() {
  const { t } = useAppTranslation();

  return (
    <nav aria-label={t("recall.tabs")} className="recall-page-tabs">
      {recallPageTabItems.map((tabItem) => (
        <Link
          activeProps={{
            "aria-current": "page",
            className: "recall-page-tabs__link recall-page-tabs__link-active",
          }}
          activeOptions={{ exact: true }}
          className="recall-page-tabs__link"
          key={tabItem.to}
          to={tabItem.to}
        >
          {t(tabItem.labelKey)}
        </Link>
      ))}
    </nav>
  );
}
