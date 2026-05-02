import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RecallSelectionPage } from "./recall-route";

const recallSelectionSearchSchema = z.object({
  filter: z.enum(["weak"]).optional(),
  noteIds: z.string().optional(),
});

export const Route = createFileRoute("/_protected/recall/select")({
  validateSearch: recallSelectionSearchSchema,
  component: RecallSelectionRoute,
});

function parseSelectedNoteIds(noteIds: string | undefined) {
  if (noteIds === undefined) {
    return [];
  }

  const selectedNoteIds: string[] = [];
  const seenNoteIds = new Set<string>();

  for (const noteId of noteIds.split(",")) {
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
      initialSelectedFilter={
        search.filter === "weak" ? { kind: "weak" } : { kind: "all" }
      }
      initialSelectedNoteIds={parseSelectedNoteIds(search.noteIds)}
    />
  );
}
