import { createRouter } from "@tanstack/react-router";
import { createAppLabelsContext } from "./lib/labels";

import { createAppNotesContext } from "./lib/notes";
import { createAppSessionContext } from "./lib/session";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const labels = createAppLabelsContext();

  return createRouter({
    context: {
      notes: createAppNotesContext({
        getOwnedLabelIdsForUser: (userId) =>
          labels.getLabelsForUser(userId).map((label) => label.id),
      }),
      labels,
      session: createAppSessionContext(),
    },
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}
