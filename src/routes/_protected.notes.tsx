import { createFileRoute } from "@tanstack/react-router";

import { NotesWorkspace } from "../modules/learning-loop/routes/notes-route";

export const Route = createFileRoute("/_protected/notes")({
  component: NotesWorkspace,
});
