import { createRouter } from "@tanstack/react-router";

import { createAppLabelsContext } from "./features/labels/labels";
import { createAppNotesContext } from "./features/notes/notes";
import { createAppRecallContext } from "./features/recall/recall";
import { createAppSessionContext } from "./features/session/session";
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
        labels,
        notes,
      }),
      session: createAppSessionContext(),
    },
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}
