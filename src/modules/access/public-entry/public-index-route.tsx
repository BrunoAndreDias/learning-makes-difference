import { createFileRoute, redirect } from "@tanstack/react-router";

import { hasActiveSession } from "../session/session";

export const Route = createFileRoute("/_public/")({
  beforeLoad: async ({ context }) => {
    const sessionSnapshot = await context.session.refresh();

    throw redirect({
      to: hasActiveSession(sessionSnapshot) ? "/study-notes" : "/login",
    });
  },
});
