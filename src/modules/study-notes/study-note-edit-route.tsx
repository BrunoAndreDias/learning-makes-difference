import { createFileRoute } from "@tanstack/react-router";

import { StudyNotesPage, studyNotesSearchSchema } from "./study-notes-route";

export const Route = createFileRoute("/_protected/study-notes/$studyNoteId")({
  validateSearch: studyNotesSearchSchema,
  component: StudyNoteEditRoute,
});

function StudyNoteEditRoute() {
  const search = Route.useSearch();
  const { studyNoteId } = Route.useParams();

  return (
    <StudyNotesPage
      routeMode={{
        kind: "edit",
        studyNoteId,
      }}
      search={search}
    />
  );
}
