import type { AppNoteSearchResult } from "./note-search";

export type NotesSearchTargetElement = HTMLInputElement | HTMLTextAreaElement;

export type NotesSearchTargetElements = {
  acronymDescriptions: readonly (HTMLTextAreaElement | null)[];
  body: HTMLTextAreaElement | null;
  metaphorDescriptions: readonly (HTMLTextAreaElement | null)[];
  title: HTMLInputElement | null;
};

export function resolveNotesSearchTargetElement(
  elements: NotesSearchTargetElements,
  result: AppNoteSearchResult,
): NotesSearchTargetElement | null {
  const targetIndex = result.target.index ?? 0;

  switch (result.target.field) {
    case "title":
      return elements.title;
    case "body":
      return elements.body;
    case "metaphorDescription":
      return elements.metaphorDescriptions[targetIndex] ?? null;
    case "acronymDescription":
      return elements.acronymDescriptions[targetIndex] ?? null;
  }
}
