import { createFileRoute, redirect } from "@tanstack/react-router";

import {
  appRoutePaths,
  authenticatedLandingPath,
} from "../../workspace-shell/app-shell/route-paths";
import { hasActiveSession } from "../session/session";

export const Route = createFileRoute("/_public/")({
  beforeLoad: async ({ context }) => {
    const sessionSnapshot = await context.session.refresh();

    throw redirect({
      to: hasActiveSession(sessionSnapshot)
        ? authenticatedLandingPath
        : appRoutePaths.login,
    });
  },
});
