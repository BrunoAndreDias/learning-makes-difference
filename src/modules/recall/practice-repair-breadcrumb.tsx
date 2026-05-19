import { Link } from "@tanstack/react-router";

import { appRoutePaths } from "../workspace-shell/app-shell/route-paths";

export function PracticeRepairBreadcrumb({
  currentLabel,
}: Readonly<{ currentLabel: string }>) {
  return (
    <nav aria-label="Breadcrumb" className="recall-breadcrumb">
      <ol>
        <li>
          <Link to={appRoutePaths.practiceRepair}>Practice Repair Queue</Link>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page">{currentLabel}</li>
      </ol>
    </nav>
  );
}
