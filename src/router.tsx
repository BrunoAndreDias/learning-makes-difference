import { createRouter } from "@tanstack/react-router";

import { createAppSessionContext } from "./modules/access/session/session";
import { createAppFocusContext } from "./modules/focus";
import { createAppLabelsContext } from "./modules/labels/label-management/labels";
import { createAppNotesContext } from "./modules/notes";
import { createAppRecallContext } from "./modules/recall";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const labels = createAppLabelsContext();
  const notes = createAppNotesContext({
    getOwnedLabelIdsForUser: (userId) =>
      labels.getLabelsForUser(userId).map((label) => label.id),
  });
  const focus = createAppFocusContext({
    getLabelsForUser: (userId) => labels.getLabelsForUser(userId),
  });
  const recall = createAppRecallContext({
    getLabelsForUser: (userId) => labels.getLabelsForUser(userId),
    notes,
    onStudyActivity: focus.captureRecallSessionStudyActivity,
  });

  return createRouter({
    context: {
      focus,
      labels,
      notes,
      recall,
      session: createAppSessionContext(),
    },
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}
