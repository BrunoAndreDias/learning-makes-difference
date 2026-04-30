import { createRouter } from "@tanstack/react-router";

import { createAppSessionContext } from "./modules/access/domain/session";
import { createAppLabelsContext } from "./modules/labels/domain/labels";
import { createAppFocusContext } from "./modules/learning-loop/domain/focus";
import { createAppNotesContext } from "./modules/learning-loop/domain/notes";
import { createAppRecallContext } from "./modules/learning-loop/domain/recall";
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
