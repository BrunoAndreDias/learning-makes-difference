import { createFileRoute, redirect } from "@tanstack/react-router";

import { hasActiveSession } from "../lib/session";

export const Route = createFileRoute("/_public/")({
  beforeLoad: ({ context }) => {
    throw redirect({
      to: hasActiveSession(context.session.getSnapshot()) ? "/notes" : "/login",
    });
  },
});
