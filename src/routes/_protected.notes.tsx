import { createFileRoute } from "@tanstack/react-router";

import { ProductAreaPlaceholder } from "./-product-area-placeholder";

export const Route = createFileRoute("/_protected/notes")({
  component: NotesPlaceholder,
});

function NotesPlaceholder() {
  return (
    <ProductAreaPlaceholder
      description="Notes will anchor the core capture workflow for single-concept learning."
      heading="Notes placeholder"
      intro="This stub keeps room for note search, a note list, and a focused editor without committing to real data flows yet."
      sections={[
        {
          description:
            "Search and filtering controls can sit above the list without collapsing the shell rhythm.",
          title: "Browse notes",
        },
        {
          description:
            "The primary note form will need enough breathing room for title, body, metaphors, and acronyms.",
          title: "Edit note",
        },
        {
          description:
            "Empty and populated states should remain legible across desktop and mobile widths.",
          title: "State coverage",
        },
      ]}
      summary={
        <p>
          The page currently validates three shell concerns: stacked content
          cards, responsive two-column behavior, and room for future note
          actions without shifting the sidebar.
        </p>
      }
    />
  );
}
