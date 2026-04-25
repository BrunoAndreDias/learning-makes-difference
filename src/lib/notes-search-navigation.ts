import type { AppNoteSearchResult } from "./notes-search";

export type NotesSearchTargetElement = HTMLInputElement | HTMLTextAreaElement;

export type NotesSearchTargetElements = {
  acronymExpansions: readonly (HTMLTextAreaElement | null)[];
  acronymShortForms: readonly (HTMLInputElement | null)[];
  body: HTMLTextAreaElement | null;
  metaphorExplanations: readonly (HTMLTextAreaElement | null)[];
  metaphorTitles: readonly (HTMLInputElement | null)[];
  title: HTMLInputElement | null;
};

export type NotesSearchNavigationPlan =
  | {
      result: AppNoteSearchResult;
      type: "navigate";
    }
  | {
      guardedResult: AppNoteSearchResult;
      type: "guard";
    };

export type NotesSearchCancelPlan = {
  preserveSearchState: true;
  type: "cancel";
};

export type NotesSearchDiscardPlan =
  | {
      result: AppNoteSearchResult;
      type: "navigate";
    }
  | {
      type: "idle";
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

export function planNotesSearchNavigation(options: {
  hasUnsavedChanges: boolean;
  result: AppNoteSearchResult;
}): NotesSearchNavigationPlan {
  if (options.hasUnsavedChanges) {
    return {
      guardedResult: options.result,
      type: "guard",
    };
  }

  return {
    result: options.result,
    type: "navigate",
  };
}

export function cancelGuardedNotesSearchNavigation(): NotesSearchCancelPlan {
  return {
    preserveSearchState: true,
    type: "cancel",
  };
}

export function discardGuardedNotesSearchNavigation(
  guardedResult: AppNoteSearchResult | null,
): NotesSearchDiscardPlan {
  if (guardedResult === null) {
    return {
      type: "idle",
    };
  }

  return {
    result: guardedResult,
    type: "navigate",
  };
}
