import { createRouter } from "@tanstack/react-router";

import { createAppSessionContext } from "./modules/access/domain/session";
import { createAppLabelsContext } from "./modules/labels/domain/labels";
import { createAppNotesContext } from "./modules/learning-loop/domain/notes";
import { createAppRecallContext } from "./modules/learning-loop/domain/recall";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const labels = createAppLabelsContext();
  const notes = createAppNotesContext({
    getOwnedLabelIdsForUser: (userId) =>
      labels.getLabelsForUser(userId).map((label) => label.id),
  });

  return createRouter({
    context: {
      labels,
      notes,
      recall: createAppRecallContext({
        notes,
      }),
      session: createAppSessionContext(),
    },
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}
