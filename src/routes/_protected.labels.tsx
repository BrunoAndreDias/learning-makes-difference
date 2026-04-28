import { createFileRoute } from "@tanstack/react-router";

import { LabelsPage } from "../modules/labels/routes/labels-route";

export const Route = createFileRoute("/_protected/labels")({
  component: LabelsPage,
});
