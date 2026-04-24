import { createFileRoute } from "@tanstack/react-router";

import { ProductAreaPlaceholder } from "./-product-area-placeholder";

export const Route = createFileRoute("/_protected/history")({
  component: HistoryPlaceholder,
});

function HistoryPlaceholder() {
  return (
    <ProductAreaPlaceholder
      description="History will hold the learner's recall-session timeline and later drill into past answers."
      heading="History placeholder"
      intro="This stub reserves a place for date-based summaries, label filters, and detailed session review states."
      sections={[
        {
          description:
            "A timeline or table can summarize previous sessions without losing the surrounding layout balance.",
          title: "Session timeline",
        },
        {
          description:
            "Filters should remain visible while navigating between labels or date ranges.",
          title: "Filter history",
        },
        {
          description:
            "Detailed session review needs room for note snapshots and self-ratings.",
          title: "Inspect results",
        },
      ]}
      summary={
        <p>
          This placeholder gives the shell a denser reporting surface to test,
          which is useful before table or timeline components arrive in later
          issues.
        </p>
      }
    />
  );
}
