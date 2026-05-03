import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { RecallSelectionPage } from "./recall-route";

const recallSelectionSearchSchema = z.object({
  noteIds: z.string().optional(),
});

type RecallSelectionSearch = z.infer<typeof recallSelectionSearchSchema>;

export const Route = createFileRoute("/_protected/recall/select")({
  validateSearch: recallSelectionSearchSchema,
  component: RecallSelectionRoute,
});

function parseSelectedNoteIds(search: RecallSelectionSearch) {
  if (search.noteIds === undefined) {
    return [];
  }

  const selectedNoteIds: string[] = [];
  const seenNoteIds = new Set<string>();

  for (const noteId of search.noteIds.split(",")) {
    const normalizedNoteId = noteId.trim();

    if (normalizedNoteId.length === 0 || seenNoteIds.has(normalizedNoteId)) {
      continue;
    }

    seenNoteIds.add(normalizedNoteId);
    selectedNoteIds.push(normalizedNoteId);
  }

  return selectedNoteIds;
}

function RecallSelectionRoute() {
  const search = Route.useSearch();

  return (
    <RecallSelectionPage
      initialSelectedNoteIds={parseSelectedNoteIds(search)}
    />
  );
}
