import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { RecallSelectionPage } from "./recall-route";

const recallSelectionSearchSchema = z.object({
  studyNoteIds: z.string().optional(),
});

type RecallSelectionSearch = z.infer<typeof recallSelectionSearchSchema>;

export const Route = createFileRoute("/_protected/recall/select")({
  validateSearch: recallSelectionSearchSchema,
  component: RecallSelectionRoute,
});

function parseSelectedStudyNoteIds(search: RecallSelectionSearch) {
  if (search.studyNoteIds === undefined) {
    return [];
  }

  const selectedStudyNoteIds: string[] = [];
  const seenStudyNoteIds = new Set<string>();

  for (const studyNoteId of search.studyNoteIds.split(",")) {
    const normalizedStudyNoteId = studyNoteId.trim();

    if (
      normalizedStudyNoteId.length === 0 ||
      seenStudyNoteIds.has(normalizedStudyNoteId)
    ) {
      continue;
    }

    seenStudyNoteIds.add(normalizedStudyNoteId);
    selectedStudyNoteIds.push(normalizedStudyNoteId);
  }

  return selectedStudyNoteIds;
}

function RecallSelectionRoute() {
  const search = Route.useSearch();

  return (
    <RecallSelectionPage
      initialSelectedStudyNoteIds={parseSelectedStudyNoteIds(search)}
    />
  );
}
