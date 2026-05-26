import {
  createFileRoute,
  useLocation,
  useRouteContext,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useResolvedProtectedSession } from "../../access/session/use-resolved-protected-session";
import { StudyGuidancePageReadinessState } from "../../study-guidance/study-guidance-page-readiness";
import { AppLayout } from "./protected-layout-route";
import { authenticatedLandingPath } from "./route-paths";

export const Route = createFileRoute("/_protected")({
  component: ProtectedRouteShell,
});

function ProtectedRouteShell() {
  const persistentFocus = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentFocus,
  });
  const persistentLabels = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentLabels,
  });
  const persistentRecall = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentRecall,
  });
  const persistentStudyNotes = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentStudyNotes,
  });
  const location = useLocation();
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const userId = sessionSnapshot.user?.id ?? null;
  const [isReady, setIsReady] = useState(
    persistentFocus === undefined &&
      persistentLabels === undefined &&
      persistentRecall === undefined &&
      persistentStudyNotes === undefined,
  );

  useEffect(() => {
    let cancelled = false;

    if (
      persistentFocus === undefined &&
      persistentLabels === undefined &&
      persistentRecall === undefined &&
      persistentStudyNotes === undefined
    ) {
      setIsReady(true);
      return () => {
        cancelled = true;
      };
    }

    setIsReady(false);
    void Promise.all([
      persistentFocus?.refresh(userId),
      persistentLabels?.refresh(userId),
      persistentRecall?.refresh(userId),
      persistentStudyNotes?.refresh(userId),
    ])
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    persistentFocus,
    persistentLabels,
    persistentRecall,
    persistentStudyNotes,
    userId,
  ]);

  if (!isReady) {
    const isTodayRoute =
      location.pathname === authenticatedLandingPath ||
      location.pathname.startsWith(`${authenticatedLandingPath}/`);

    if (isTodayRoute) {
      return (
        <AppLayout>
          <StudyGuidancePageReadinessState />
        </AppLayout>
      );
    }

    return null;
  }

  return <AppLayout />;
}
