import { createFileRoute } from "@tanstack/react-router";

import { NotesRecallSessionPage } from "../modules/learning-loop/routes/notes-recall-route";

export const Route = createFileRoute("/_protected/notes/recall")({
  component: NotesRecallSessionPage,
});
