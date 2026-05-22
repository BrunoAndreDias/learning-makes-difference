import { createFileRoute } from "@tanstack/react-router";

import { StudyNotesPage, studyNotesSearchSchema } from "./study-notes-route";

export const Route = createFileRoute("/_protected/study-notes/new")({
  validateSearch: studyNotesSearchSchema,
  component: StudyNoteCreateRoute,
});

function StudyNoteCreateRoute() {
  const search = Route.useSearch();

  return <StudyNotesPage routeMode={{ kind: "create" }} search={search} />;
}
