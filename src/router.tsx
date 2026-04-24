import { createRouter } from "@tanstack/react-router";

import { createAppNotesContext } from "./lib/notes";
import { createAppSessionContext } from "./lib/session";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    context: {
      notes: createAppNotesContext(),
      session: createAppSessionContext(),
    },
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}
