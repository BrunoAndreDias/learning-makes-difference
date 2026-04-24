import { createFileRoute } from "@tanstack/react-router";

import { ProductAreaPlaceholder } from "./-product-area-placeholder";

export const Route = createFileRoute("/_protected/recall")({
  component: RecallPlaceholder,
});

function RecallPlaceholder() {
  return (
    <ProductAreaPlaceholder
      description="Recall sessions will turn saved notes into focused flashcard-style review rounds."
      heading="Recall placeholder"
      intro="This stub leaves room for session setup, in-progress prompts, and completion summaries while preserving the protected shell rhythm."
      sections={[
        {
          description:
            "Session setup needs to expose label selection, note counts, and start controls clearly.",
          title: "Start session",
        },
        {
          description:
            "In-session cards will need a stable area for prompts, reveal actions, and self-rating controls.",
          title: "Practice flow",
        },
        {
          description:
            "Completion summaries should fit beside future study history links without crowding.",
          title: "Session wrap-up",
        },
      ]}
      summary={
        <p>
          The layout checks a deeper reading surface and action-heavy card mix,
          which matters before the recall workflow starts introducing stateful
          interactions.
        </p>
      }
    />
  );
}
