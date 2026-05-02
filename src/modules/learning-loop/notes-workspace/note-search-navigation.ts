import type { AppNoteSearchResult } from "./note-search";

export type NotesSearchTargetElement = HTMLInputElement | HTMLTextAreaElement;

export type NotesSearchTargetElements = {
  acronymExpansions: readonly (HTMLTextAreaElement | null)[];
  acronymShortForms: readonly (HTMLInputElement | null)[];
  body: HTMLTextAreaElement | null;
  metaphorExplanations: readonly (HTMLTextAreaElement | null)[];
  metaphorTitles: readonly (HTMLInputElement | null)[];
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
    case "metaphorTitle":
      return elements.metaphorTitles[targetIndex] ?? null;
    case "metaphorExplanation":
      return elements.metaphorExplanations[targetIndex] ?? null;
    case "acronymShortForm":
      return elements.acronymShortForms[targetIndex] ?? null;
    case "acronymExpansion":
      return elements.acronymExpansions[targetIndex] ?? null;
  }
}
