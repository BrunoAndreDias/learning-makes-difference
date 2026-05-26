import type {
  AppStudyNote,
  AppStudyNoteKeyIdea,
  AppStudyNoteTextReference,
  UpdateStudyNoteInput,
} from "./study-notes";
import { hasStudyNoteSourceContentChanged } from "./study-notes";

export function createBlankStudyNoteDraft(): UpdateStudyNoteInput {
  return {
    acceptedVariants: [],
    acronyms: [],
    expectedAnswer: "",
    keyIdeas: [],
    labelIds: [],
    metaphors: [],
    prompt: "",
    prohibitedPhrases: [],
    sourceBody: "",
    sourceTitle: "",
  };
}

export function cloneStudyNoteDraft(
  draft: UpdateStudyNoteInput,
): UpdateStudyNoteInput {
  return {
    acceptedVariants: draft.acceptedVariants.map((variant) => ({
      ...variant,
    })),
    acronyms: draft.acronyms.map((acronym) => ({ ...acronym })),
    expectedAnswer: draft.expectedAnswer,
    keyIdeas: draft.keyIdeas.map((keyIdea) => ({
      ...keyIdea,
      acceptedPhrases: [...keyIdea.acceptedPhrases],
      prohibitedPhrases: [...keyIdea.prohibitedPhrases],
    })),
    labelIds: [...draft.labelIds],
    metaphors: draft.metaphors.map((metaphor) => ({ ...metaphor })),
    prompt: draft.prompt,
    prohibitedPhrases: draft.prohibitedPhrases.map((phrase) => ({
      ...phrase,
    })),
    sourceBody: draft.sourceBody,
    sourceTitle: draft.sourceTitle,
  };
}

export function createStudyNoteDraftFromStudyNote(
  studyNote: AppStudyNote | null,
): UpdateStudyNoteInput {
  if (studyNote === null) {
    return createBlankStudyNoteDraft();
  }

  return cloneStudyNoteDraft({
    acceptedVariants: studyNote.acceptedVariants,
    acronyms: studyNote.acronyms,
    expectedAnswer: studyNote.expectedAnswer,
    keyIdeas: studyNote.keyIdeas,
    labelIds: studyNote.labelIds,
    metaphors: studyNote.metaphors,
    prompt: studyNote.prompt,
    prohibitedPhrases: studyNote.prohibitedPhrases,
    sourceBody: studyNote.source.body,
    sourceTitle: studyNote.source.title,
  });
}

function normalizeSupportDescriptionsForComparison(
  supportDescriptions: readonly { description: string }[],
) {
  return supportDescriptions
    .map((supportDescription) => supportDescription.description.trim())
    .filter((description) => description.length > 0);
}

function haveSameStringSet(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightValues = new Set(right);

  return left.every((value) => rightValues.has(value));
}

function haveSameStringSequence(
  left: readonly string[],
  right: readonly string[],
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function haveSameTextReferences(
  left: readonly AppStudyNoteTextReference[],
  right: readonly AppStudyNoteTextReference[],
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (reference, index) =>
      reference.id === right[index]?.id &&
      reference.text.trim() === right[index]?.text.trim(),
  );
}

function haveSameKeyIdeas(
  left: readonly AppStudyNoteKeyIdea[],
  right: readonly AppStudyNoteKeyIdea[],
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((keyIdea, index) => {
    const otherKeyIdea = right[index];

    return (
      otherKeyIdea !== undefined &&
      keyIdea.id === otherKeyIdea.id &&
      keyIdea.importance === otherKeyIdea.importance &&
      keyIdea.text.trim() === otherKeyIdea.text.trim() &&
      haveSameStringSequence(
        keyIdea.acceptedPhrases,
        otherKeyIdea.acceptedPhrases,
      ) &&
      haveSameStringSequence(
        keyIdea.prohibitedPhrases,
        otherKeyIdea.prohibitedPhrases,
      )
    );
  });
}

export function areStudyNoteDraftsEqual(
  left: UpdateStudyNoteInput,
  right: UpdateStudyNoteInput,
) {
  return (
    haveSameTextReferences(left.acceptedVariants, right.acceptedVariants) &&
    left.prompt.trim() === right.prompt.trim() &&
    left.expectedAnswer.trim() === right.expectedAnswer.trim() &&
    left.sourceBody.trim() === right.sourceBody.trim() &&
    left.sourceTitle.trim() === right.sourceTitle.trim() &&
    haveSameKeyIdeas(left.keyIdeas, right.keyIdeas) &&
    haveSameStringSet(left.labelIds, right.labelIds) &&
    haveSameStringSequence(
      normalizeSupportDescriptionsForComparison(left.metaphors),
      normalizeSupportDescriptionsForComparison(right.metaphors),
    ) &&
    haveSameStringSequence(
      normalizeSupportDescriptionsForComparison(left.acronyms),
      normalizeSupportDescriptionsForComparison(right.acronyms),
    ) &&
    haveSameTextReferences(left.prohibitedPhrases, right.prohibitedPhrases)
  );
}

export function didSplitStudyNoteDraftChange(input: {
  draft: UpdateStudyNoteInput;
  studyNote: AppStudyNote;
}) {
  return (
    input.draft.prompt.trim() !== input.studyNote.prompt.trim() ||
    input.draft.expectedAnswer.trim() !==
      input.studyNote.expectedAnswer.trim() ||
    hasStudyNoteSourceContentChanged({
      currentSource: input.studyNote.source,
      sourceBody: input.draft.sourceBody,
      sourceTitle: input.draft.sourceTitle,
    })
  );
}

export function setStudyNoteDraftLabelSelection(
  draft: UpdateStudyNoteInput,
  labelId: string,
  isSelected: boolean,
): UpdateStudyNoteInput {
  if (isSelected) {
    if (draft.labelIds.includes(labelId)) {
      return {
        ...draft,
        labelIds: [...draft.labelIds],
      };
    }

    return {
      ...draft,
      labelIds: [...draft.labelIds, labelId],
    };
  }

  return {
    ...draft,
    labelIds: draft.labelIds.filter(
      (currentLabelId) => currentLabelId !== labelId,
    ),
  };
}

export function removeStudyNoteDraftLabel(
  draft: UpdateStudyNoteInput,
  labelId: string,
) {
  return setStudyNoteDraftLabelSelection(draft, labelId, false);
}

export function createSingleStudyNoteDraftSupportDescription(
  description: string,
) {
  if (description.trim().length === 0) {
    return [];
  }

  return [{ description }];
}

export function hasStudyNoteDraftReferenceContent(draft: UpdateStudyNoteInput) {
  return (
    draft.sourceTitle.trim().length > 0 || draft.sourceBody.trim().length > 0
  );
}

export function hasStudyNoteDraftAnswerCheckContent(
  draft: UpdateStudyNoteInput,
) {
  return (
    draft.keyIdeas.some(
      (keyIdea) =>
        keyIdea.text.trim().length > 0 ||
        keyIdea.acceptedPhrases.length > 0 ||
        keyIdea.prohibitedPhrases.length > 0,
    ) ||
    draft.acceptedVariants.some((variant) => variant.text.trim().length > 0) ||
    draft.prohibitedPhrases.some((phrase) => phrase.text.trim().length > 0)
  );
}

export function hasStudyNoteDraftMemoryAidContent(draft: UpdateStudyNoteInput) {
  return [...draft.metaphors, ...draft.acronyms].some(
    (supportDescription) => supportDescription.description.trim().length > 0,
  );
}
