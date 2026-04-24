import { createFileRoute } from "@tanstack/react-router";

import { ProductAreaPlaceholder } from "./-product-area-placeholder";

export const Route = createFileRoute("/_protected/labels")({
  component: LabelsPlaceholder,
});

function LabelsPlaceholder() {
  return (
    <ProductAreaPlaceholder
      description="Labels will organize notes into a graph that can power browsing and recall selection."
      heading="Labels placeholder"
      intro="This stub reserves space for graph navigation, parent-child editing, and note assignment context in one consistent layout."
      sections={[
        {
          description:
            "A future label browser can switch between list and graph views without replacing the shell.",
          title: "Label map",
        },
        {
          description:
            "Editing flows will need clear separation between label metadata and parent relationships.",
          title: "Manage hierarchy",
        },
        {
          description:
            "Assigned note summaries should stay visible while taxonomy changes are made.",
          title: "Review linked notes",
        },
      ]}
      summary={
        <p>
          The placeholder demonstrates enough density to validate card spacing,
          long-copy wrapping, and future mixed-content panels inside the shared
          protected frame.
        </p>
      }
    />
  );
}
