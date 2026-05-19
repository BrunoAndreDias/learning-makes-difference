import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_protected/recall/results/$sessionResultId/questions/$questionResultId/repair",
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      params,
      replace: true,
      to: "/recall/repair/$sessionResultId/questions/$questionResultId",
    });
  },
});
