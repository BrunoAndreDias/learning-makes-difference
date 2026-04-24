import { createRouter } from "@tanstack/react-router";

import { createAppSessionContext } from "./lib/session";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    context: {
      session: createAppSessionContext(),
    },
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}
