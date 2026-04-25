import { createRouter } from "@tanstack/react-router";
import { createAppLabelsContext } from "./lib/labels";

import { createAppNotesContext } from "./lib/notes";
import { createAppRecallContext } from "./lib/recall";
import { createAppSessionContext } from "./lib/session";
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
