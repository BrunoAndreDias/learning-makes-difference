import { createRouter } from "@tanstack/react-router";

import { createGuestSessionContext } from "./lib/session";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    context: {
      session: createGuestSessionContext(),
    },
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}
