export type AppStudyNoteSource = {
  body: string;
  displayName?: string;
  id: string;
  title: string;
  updatedAt: string;
};

export type AppStudyNoteSupportDescription = {
  description: string;
};

export const MAX_STUDY_NOTE_SUPPORT_DESCRIPTIONS_PER_KIND = 1;

export type StudyNoteSupportDescriptionKind = "Acronym" | "Metaphor";
export type StudyNoteKeyIdeaImportance = "required" | "supporting";

export type AppStudyNoteMetaphor = AppStudyNoteSupportDescription;

export type AppStudyNoteAcronym = AppStudyNoteSupportDescription;

export type AppStudyNoteKeyIdea = {
  acceptedPhrases: string[];
  id: string;
  importance: StudyNoteKeyIdeaImportance;
  prohibitedPhrases: string[];
  text: string;
};

export type AppStudyNoteTextReference = {
  id: string;
  text: string;
};

export type AppStudyNoteAcceptedVariant = AppStudyNoteTextReference;

export type AppStudyNoteProhibitedPhrase = AppStudyNoteTextReference;

export type AppStudyNote = {
  acceptedVariants: AppStudyNoteAcceptedVariant[];
  acronyms: AppStudyNoteAcronym[];
  createdAt: string;
  expectedAnswer: string;
  id: string;
  keyIdeas: AppStudyNoteKeyIdea[];
  labelIds: string[];
  metaphors: AppStudyNoteMetaphor[];
  prompt: string;
  prohibitedPhrases: AppStudyNoteProhibitedPhrase[];
  source: AppStudyNoteSource;
  sourceNoteId: string;
  updatedAt: string;
};

export type AppStoredStudyNote = Omit<AppStudyNote, "source"> & {
  source: AppStudyNoteSource;
  userId: string;
};

export type CreateStudyNoteInput = {
  acceptedVariants?: AppStudyNoteAcceptedVariant[];
  acronyms?: AppStudyNoteAcronym[];
  expectedAnswer?: string;
  keyIdeas?: AppStudyNoteKeyIdea[];
  labelIds?: string[];
  metaphors?: AppStudyNoteMetaphor[];
  prompt?: string;
  prohibitedPhrases?: AppStudyNoteProhibitedPhrase[];
  sourceBody: string;
  sourceTitle: string;
};

export type CreateStudyNoteFromSourceInput = {
  sourceNoteId: string;
};

export type DeleteStudyNoteInput = {
  deleteSource: boolean;
};

export type UpdateStudyNoteInput = {
  acceptedVariants: AppStudyNoteAcceptedVariant[];
  acronyms: AppStudyNoteAcronym[];
  expectedAnswer: string;
  keyIdeas: AppStudyNoteKeyIdea[];
  labelIds: string[];
  metaphors: AppStudyNoteMetaphor[];
  prompt: string;
  prohibitedPhrases: AppStudyNoteProhibitedPhrase[];
  sourceBody: string;
  sourceTitle: string;
};

type StudyNotesListener = () => void;

type StudyNotesStorageAdapter = Pick<Storage, "getItem" | "setItem">;

type StudyNotesCrypto = {
  randomUUID: () => string;
};

type OwnedLabelIdsLookup = (userId: string) => readonly string[];

type CreateAppStudyNotesContextOptions = {
  crypto?: StudyNotesCrypto;
  getOwnedLabelIdsForUser?: OwnedLabelIdsLookup;
  keyPrefix?: string;
  storage?: StudyNotesStorageAdapter;
};

const DEFAULT_STORAGE_KEY_PREFIX = "learning-makes-difference-study-notes";
const UNTITLED_SOURCE_DISPLAY_NAME = "Untitled source";

export class AppStudyNotesError extends Error {
  readonly code: "invalid_input" | "not_found" | "unauthorized";

  constructor(
    code: "invalid_input" | "not_found" | "unauthorized",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

export type AppStudyNotesContext = {
  createStudyNote: (
    userId: string | null,
    input: CreateStudyNoteInput,
  ) => AppStudyNote;
  createStudyNoteFromSource: (
    userId: string | null,
    input: CreateStudyNoteFromSourceInput,
  ) => AppStudyNote;
  deleteStudyNote: (
    userId: string | null,
    studyNoteId: string,
    input: DeleteStudyNoteInput,
  ) => void;
  getSnapshot: () => readonly AppStoredStudyNote[];
  removeLabelAssignments: (userId: string | null, labelId: string) => void;
  subscribe: (listener: StudyNotesListener) => () => void;
  updateStudyNote: (
    userId: string | null,
    studyNoteId: string,
    input: UpdateStudyNoteInput,
  ) => AppStudyNote;
};

function getDefaultStorage(): StudyNotesStorageAdapter | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

function getDefaultCrypto(): StudyNotesCrypto {
  return globalThis.crypto;
}

function getStudyNotesStorageKey(prefix: string): string {
  return `${prefix}:records`;
}

function validateUserId(userId: string | null): string {
  if (userId === null) {
    throw new AppStudyNotesError(
      "unauthorized",
      "A signed-in user is required.",
    );
  }

  return userId;
}

function validateRequiredText(value: string, label: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new AppStudyNotesError("invalid_input", `${label} is required.`);
  }

  return trimmedValue;
}

function validateOptionalText(value: string): string {
  return value.trim();
}

function validateStableReferenceId(value: string, label: string): string {
  const id = value.trim();

  if (id.length === 0) {
    throw new AppStudyNotesError("invalid_input", `${label} id is required.`);
  }

  return id;
}

function normalizePhraseList(phrases: readonly string[] | undefined): string[] {
  return [...new Set((phrases ?? []).map((phrase) => phrase.trim()))].filter(
    (phrase) => phrase.length > 0,
  );
}

function isStudyNoteKeyIdeaImportance(
  value: string,
): value is StudyNoteKeyIdeaImportance {
  return value === "required" || value === "supporting";
}

function validateUniqueReferenceIds<TReference extends { id: string }>(
  references: readonly TReference[],
  label: string,
) {
  const seenIds = new Set<string>();

  for (const reference of references) {
    if (!seenIds.has(reference.id)) {
      seenIds.add(reference.id);
      continue;
    }

    throw new AppStudyNotesError(
      "invalid_input",
      `${label} ids must be unique per Study Note.`,
    );
  }
}

function normalizeLabelIds(labelIds: readonly string[] | undefined): string[] {
  return [...new Set((labelIds ?? []).filter(Boolean))];
}

function validateOwnedLabelIds(
  labelIds: readonly string[] | undefined,
  options: {
    getOwnedLabelIdsForUser?: OwnedLabelIdsLookup;
    userId: string;
  },
): string[] {
  const normalizedLabelIds = normalizeLabelIds(labelIds);

  if (options.getOwnedLabelIdsForUser === undefined) {
    return normalizedLabelIds;
  }

  const ownedLabelIds = new Set(
    options.getOwnedLabelIdsForUser(options.userId),
  );

  if (normalizedLabelIds.every((labelId) => ownedLabelIds.has(labelId))) {
    return normalizedLabelIds;
  }

  throw new AppStudyNotesError(
    "invalid_input",
    "Study Notes can only be assigned to labels owned by this account.",
  );
}

function validateSupportDescriptionCount(
  supportDescriptions: readonly unknown[],
  kind: StudyNoteSupportDescriptionKind,
) {
  if (
    supportDescriptions.length <= MAX_STUDY_NOTE_SUPPORT_DESCRIPTIONS_PER_KIND
  ) {
    return;
  }

  throw new AppStudyNotesError(
    "invalid_input",
    `Only one ${kind.toLowerCase()} can be saved per Study Note.`,
  );
}

export function validateStudyNoteSupportDescriptions(
  supportDescriptions: readonly { description: string }[] | undefined,
  kind: StudyNoteSupportDescriptionKind,
): AppStudyNoteSupportDescription[] {
  const safeSupportDescriptions = supportDescriptions ?? [];
  validateSupportDescriptionCount(safeSupportDescriptions, kind);

  return safeSupportDescriptions.map((supportDescription) => {
    const description = supportDescription.description.trim();

    if (description.length === 0) {
      throw new AppStudyNotesError(
        "invalid_input",
        `${kind} description is required.`,
      );
    }

    return {
      description,
    };
  });
}

function validateMetaphors(
  metaphors: readonly AppStudyNoteMetaphor[] | undefined,
): AppStudyNoteMetaphor[] {
  return validateStudyNoteSupportDescriptions(metaphors, "Metaphor");
}

function validateAcronyms(
  acronyms: readonly AppStudyNoteAcronym[] | undefined,
): AppStudyNoteAcronym[] {
  return validateStudyNoteSupportDescriptions(acronyms, "Acronym");
}

export function validateStudyNoteKeyIdeas(
  keyIdeas: readonly AppStudyNoteKeyIdea[] | undefined,
): AppStudyNoteKeyIdea[] {
  const safeKeyIdeas = (keyIdeas ?? []).map((keyIdea) => {
    const importance = keyIdea.importance.trim();

    if (!isStudyNoteKeyIdeaImportance(importance)) {
      throw new AppStudyNotesError(
        "invalid_input",
        "Key Idea importance must be required or supporting.",
      );
    }

    return {
      acceptedPhrases: normalizePhraseList(keyIdea.acceptedPhrases),
      id: validateStableReferenceId(keyIdea.id, "Key Idea"),
      importance,
      prohibitedPhrases: normalizePhraseList(keyIdea.prohibitedPhrases),
      text: validateRequiredText(keyIdea.text, "Key Idea"),
    };
  });

  validateUniqueReferenceIds(safeKeyIdeas, "Key Idea");

  return safeKeyIdeas;
}

function validateStudyNoteTextReferences<
  TReference extends AppStudyNoteTextReference,
>(references: readonly TReference[] | undefined, label: string): TReference[] {
  const safeReferences = (references ?? []).map((reference) => ({
    ...reference,
    id: validateStableReferenceId(reference.id, label),
    text: validateRequiredText(reference.text, label),
  }));

  validateUniqueReferenceIds(safeReferences, label);

  return safeReferences;
}

export function validateAcceptedVariants(
  acceptedVariants: readonly AppStudyNoteAcceptedVariant[] | undefined,
): AppStudyNoteAcceptedVariant[] {
  return validateStudyNoteTextReferences(acceptedVariants, "Accepted Variant");
}

export function validateProhibitedPhrases(
  prohibitedPhrases: readonly AppStudyNoteProhibitedPhrase[] | undefined,
): AppStudyNoteProhibitedPhrase[] {
  return validateStudyNoteTextReferences(
    prohibitedPhrases,
    "Prohibited Phrase",
  );
}

type PersistedStudyNoteRecord = Omit<
  AppStoredStudyNote,
  | "acceptedVariants"
  | "acronyms"
  | "keyIdeas"
  | "metaphors"
  | "prohibitedPhrases"
> & {
  acceptedVariants?: AppStudyNoteAcceptedVariant[];
  acronyms?: AppStudyNoteAcronym[];
  keyIdeas?: AppStudyNoteKeyIdea[];
  metaphors?: AppStudyNoteMetaphor[];
  prohibitedPhrases?: AppStudyNoteProhibitedPhrase[];
};

type SourceDisplayNameStudyNote = {
  createdAt: number | string;
  prompt: string;
};

function compareSourceDisplayNameStudyNotes(
  left: SourceDisplayNameStudyNote,
  right: SourceDisplayNameStudyNote,
): number {
  if (
    typeof left.createdAt === "number" &&
    typeof right.createdAt === "number"
  ) {
    return left.createdAt - right.createdAt;
  }

  return String(left.createdAt).localeCompare(String(right.createdAt));
}

export function getStudyNoteSourceDisplayName(input: {
  linkedStudyNotes: readonly SourceDisplayNameStudyNote[];
  sourceTitle: string;
}): string {
  const trimmedTitle = input.sourceTitle.trim();

  if (trimmedTitle.length > 0) {
    return trimmedTitle;
  }

  const fallbackPrompt =
    [...input.linkedStudyNotes]
      .sort(compareSourceDisplayNameStudyNotes)
      .find((studyNote) => studyNote.prompt.trim().length > 0)
      ?.prompt.trim() ?? null;

  return fallbackPrompt ?? UNTITLED_SOURCE_DISPLAY_NAME;
}

export function resolveCreateStudyNoteFields(
  input: CreateStudyNoteInput,
  defaults: Pick<AppStudyNote, "expectedAnswer" | "prompt">,
): Pick<AppStudyNote, "expectedAnswer" | "prompt"> {
  const prompt = input.prompt === undefined ? defaults.prompt : input.prompt;

  return {
    expectedAnswer:
      input.expectedAnswer === undefined
        ? defaults.expectedAnswer
        : validateOptionalText(input.expectedAnswer),
    prompt: validateRequiredText(prompt, "Prompt"),
  };
}

function getStoredSourceDisplayName(
  note: AppStoredStudyNote,
  allStudyNotes: readonly AppStoredStudyNote[],
): string {
  return getStudyNoteSourceDisplayName({
    linkedStudyNotes: allStudyNotes.filter(
      (studyNote) => studyNote.sourceNoteId === note.sourceNoteId,
    ),
    sourceTitle: note.source.title,
  });
}

function toPublicStudyNote(
  note: AppStoredStudyNote,
  allStudyNotes: readonly AppStoredStudyNote[],
): AppStudyNote {
  return {
    acceptedVariants: note.acceptedVariants.map((variant) => ({ ...variant })),
    acronyms: note.acronyms.map((acronym) => ({ ...acronym })),
    createdAt: note.createdAt,
    expectedAnswer: note.expectedAnswer,
    id: note.id,
    keyIdeas: note.keyIdeas.map((keyIdea) => ({
      ...keyIdea,
      acceptedPhrases: [...keyIdea.acceptedPhrases],
      prohibitedPhrases: [...keyIdea.prohibitedPhrases],
    })),
    labelIds: [...note.labelIds],
    metaphors: note.metaphors.map((metaphor) => ({ ...metaphor })),
    prompt: note.prompt,
    prohibitedPhrases: note.prohibitedPhrases.map((phrase) => ({
      ...phrase,
    })),
    source: {
      ...note.source,
      displayName: getStoredSourceDisplayName(note, allStudyNotes),
    },
    sourceNoteId: note.sourceNoteId,
    updatedAt: note.updatedAt,
  };
}

function sortStoredStudyNotes(
  studyNotes: readonly AppStoredStudyNote[],
): AppStoredStudyNote[] {
  return [...studyNotes].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

export function removeLabelAssignmentsFromStoredStudyNotes(
  snapshot: readonly AppStoredStudyNote[],
  input: {
    labelId: string;
    userId: string;
  },
) {
  let didChange = false;
  const nextSnapshot = snapshot.map((studyNote) => {
    if (
      studyNote.userId !== input.userId ||
      !studyNote.labelIds.includes(input.labelId)
    ) {
      return studyNote;
    }

    didChange = true;

    return {
      ...studyNote,
      labelIds: studyNote.labelIds.filter(
        (labelId) => labelId !== input.labelId,
      ),
    };
  });

  return {
    didChange,
    snapshot: nextSnapshot,
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStoredStudyNoteSource(value: unknown): value is AppStudyNoteSource {
  return (
    isObjectRecord(value) &&
    typeof value.body === "string" &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isStoredSupportDescription(
  value: unknown,
): value is AppStudyNoteSupportDescription {
  return isObjectRecord(value) && typeof value.description === "string";
}

function isStoredSupportDescriptions(
  value: unknown,
): value is AppStudyNoteSupportDescription[] {
  return Array.isArray(value) && value.every(isStoredSupportDescription);
}

function hasOptionalStoredSupportDescriptions(value: unknown) {
  return value === undefined || isStoredSupportDescriptions(value);
}

function isStoredKeyIdea(value: unknown): value is AppStudyNoteKeyIdea {
  return (
    isObjectRecord(value) &&
    Array.isArray(value.acceptedPhrases) &&
    value.acceptedPhrases.every((phrase) => typeof phrase === "string") &&
    typeof value.id === "string" &&
    typeof value.importance === "string" &&
    Array.isArray(value.prohibitedPhrases) &&
    value.prohibitedPhrases.every((phrase) => typeof phrase === "string") &&
    typeof value.text === "string"
  );
}

function isStoredKeyIdeas(value: unknown): value is AppStudyNoteKeyIdea[] {
  return Array.isArray(value) && value.every(isStoredKeyIdea);
}

function hasOptionalStoredKeyIdeas(value: unknown) {
  return value === undefined || isStoredKeyIdeas(value);
}

function isStoredTextReference(
  value: unknown,
): value is AppStudyNoteTextReference {
  return (
    isObjectRecord(value) &&
    typeof value.id === "string" &&
    typeof value.text === "string"
  );
}

function isStoredTextReferences(
  value: unknown,
): value is AppStudyNoteTextReference[] {
  return Array.isArray(value) && value.every(isStoredTextReference);
}

function hasOptionalStoredTextReferences(value: unknown) {
  return value === undefined || isStoredTextReferences(value);
}

function isPersistedStudyNote(
  value: unknown,
): value is PersistedStudyNoteRecord {
  return (
    isObjectRecord(value) &&
    hasOptionalStoredTextReferences(value.acceptedVariants) &&
    hasOptionalStoredSupportDescriptions(value.acronyms) &&
    typeof value.createdAt === "string" &&
    typeof value.expectedAnswer === "string" &&
    typeof value.id === "string" &&
    hasOptionalStoredKeyIdeas(value.keyIdeas) &&
    (value.labelIds === undefined ||
      (Array.isArray(value.labelIds) &&
        value.labelIds.every((labelId) => typeof labelId === "string"))) &&
    hasOptionalStoredSupportDescriptions(value.metaphors) &&
    typeof value.prompt === "string" &&
    hasOptionalStoredTextReferences(value.prohibitedPhrases) &&
    typeof value.sourceNoteId === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.userId === "string" &&
    isStoredStudyNoteSource(value.source)
  );
}

function toStoredStudyNote(
  studyNote: PersistedStudyNoteRecord,
): AppStoredStudyNote {
  return {
    ...studyNote,
    acceptedVariants: studyNote.acceptedVariants ?? [],
    acronyms: studyNote.acronyms ?? [],
    keyIdeas: studyNote.keyIdeas ?? [],
    labelIds: Array.isArray(studyNote.labelIds) ? studyNote.labelIds : [],
    metaphors: studyNote.metaphors ?? [],
    prohibitedPhrases: studyNote.prohibitedPhrases ?? [],
  };
}

function parseStoredStudyNotes(value: string | null): AppStoredStudyNote[] {
  if (value === null) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isPersistedStudyNote).map(toStoredStudyNote);
  } catch {
    return [];
  }
}

export function listStudyNotesForUser(
  studyNotes: readonly AppStoredStudyNote[],
  userId: string | null,
  options: {
    labelId?: string;
  } = {},
): AppStudyNote[] {
  if (userId === null) {
    return [];
  }

  return sortStoredStudyNotes(
    studyNotes.filter(
      (studyNote) =>
        studyNote.userId === userId &&
        (options.labelId === undefined ||
          studyNote.labelIds.includes(options.labelId)),
    ),
  ).map((studyNote) => toPublicStudyNote(studyNote, studyNotes));
}

export function createAppStudyNotesContext(
  options: CreateAppStudyNotesContextOptions = {},
): AppStudyNotesContext {
  const storage = options.storage ?? getDefaultStorage();
  const cryptoProvider = options.crypto ?? getDefaultCrypto();
  const keyPrefix = options.keyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX;
  const listeners = new Set<StudyNotesListener>();
  let snapshot: readonly AppStoredStudyNote[] = parseStoredStudyNotes(
    storage?.getItem(getStudyNotesStorageKey(keyPrefix)) ?? null,
  );

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function writeSnapshot(nextSnapshot: readonly AppStoredStudyNote[]) {
    snapshot = sortStoredStudyNotes(nextSnapshot);
    storage?.setItem(
      getStudyNotesStorageKey(keyPrefix),
      JSON.stringify(snapshot),
    );
    notifyListeners();
  }

  return {
    createStudyNote(userId, input) {
      const validatedUserId = validateUserId(userId);
      const timestamp = new Date().toISOString();
      const acceptedVariants = validateAcceptedVariants(input.acceptedVariants);
      const sourceTitle = validateOptionalText(input.sourceTitle);
      const sourceBody = validateOptionalText(input.sourceBody);
      const { expectedAnswer, prompt } = resolveCreateStudyNoteFields(input, {
        expectedAnswer: sourceBody,
        prompt: sourceTitle,
      });
      const acronyms = validateAcronyms(input.acronyms);
      const keyIdeas = validateStudyNoteKeyIdeas(input.keyIdeas);
      const labelIds = validateOwnedLabelIds(input.labelIds, {
        getOwnedLabelIdsForUser: options.getOwnedLabelIdsForUser,
        userId: validatedUserId,
      });
      const metaphors = validateMetaphors(input.metaphors);
      const prohibitedPhrases = validateProhibitedPhrases(
        input.prohibitedPhrases,
      );
      const sourceNoteId = cryptoProvider.randomUUID();
      const studyNote: AppStoredStudyNote = {
        acceptedVariants,
        acronyms,
        createdAt: timestamp,
        expectedAnswer,
        id: cryptoProvider.randomUUID(),
        keyIdeas,
        labelIds,
        metaphors,
        prompt,
        prohibitedPhrases,
        source: {
          body: sourceBody,
          id: sourceNoteId,
          title: sourceTitle,
          updatedAt: timestamp,
        },
        sourceNoteId,
        updatedAt: timestamp,
        userId: validatedUserId,
      };

      writeSnapshot([studyNote, ...snapshot]);

      return toPublicStudyNote(studyNote, [studyNote, ...snapshot]);
    },
    createStudyNoteFromSource(userId, input) {
      const validatedUserId = validateUserId(userId);
      const sourceStudyNote = snapshot.find(
        (studyNote) =>
          studyNote.sourceNoteId === input.sourceNoteId &&
          studyNote.userId === validatedUserId,
      );

      if (sourceStudyNote === undefined) {
        throw new AppStudyNotesError(
          "not_found",
          "The requested source Note could not be found for this account.",
        );
      }

      const timestamp = new Date().toISOString();
      const prompt = getStudyNoteSourceDisplayName({
        linkedStudyNotes: snapshot.filter(
          (studyNote) =>
            studyNote.sourceNoteId === sourceStudyNote.sourceNoteId,
        ),
        sourceTitle: sourceStudyNote.source.title,
      });
      const studyNote: AppStoredStudyNote = {
        acceptedVariants: [],
        acronyms: [],
        createdAt: timestamp,
        expectedAnswer: sourceStudyNote.source.body,
        id: cryptoProvider.randomUUID(),
        keyIdeas: [],
        labelIds: [],
        metaphors: [],
        prompt,
        prohibitedPhrases: [],
        source: {
          body: sourceStudyNote.source.body,
          id: sourceStudyNote.source.id,
          title: sourceStudyNote.source.title,
          updatedAt: sourceStudyNote.source.updatedAt,
        },
        sourceNoteId: sourceStudyNote.sourceNoteId,
        updatedAt: timestamp,
        userId: validatedUserId,
      };

      writeSnapshot([studyNote, ...snapshot]);

      return toPublicStudyNote(studyNote, [studyNote, ...snapshot]);
    },
    deleteStudyNote(userId, studyNoteId, input) {
      const validatedUserId = validateUserId(userId);
      const existingStudyNote = snapshot.find(
        (studyNote) => studyNote.id === studyNoteId,
      );

      if (
        existingStudyNote === undefined ||
        existingStudyNote.userId !== validatedUserId
      ) {
        throw new AppStudyNotesError(
          "not_found",
          "The requested Study Note could not be found for this account.",
        );
      }

      const siblingStudyNotes = snapshot.filter(
        (studyNote) =>
          studyNote.userId === validatedUserId &&
          studyNote.sourceNoteId === existingStudyNote.sourceNoteId &&
          studyNote.id !== existingStudyNote.id,
      );

      if (siblingStudyNotes.length === 0 && !input.deleteSource) {
        throw new AppStudyNotesError(
          "invalid_input",
          "Deleting the last Study Note for a source Note requires deleting the source too.",
        );
      }

      writeSnapshot(
        snapshot.filter((studyNote) => studyNote.id !== existingStudyNote.id),
      );
    },
    getSnapshot() {
      return snapshot;
    },
    removeLabelAssignments(userId, labelId) {
      const validatedUserId = validateUserId(userId);
      const nextSnapshot = removeLabelAssignmentsFromStoredStudyNotes(
        snapshot,
        {
          labelId,
          userId: validatedUserId,
        },
      );

      if (!nextSnapshot.didChange) {
        return;
      }

      writeSnapshot(nextSnapshot.snapshot);
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    updateStudyNote(userId, studyNoteId, input) {
      const validatedUserId = validateUserId(userId);
      const existingStudyNote = snapshot.find(
        (studyNote) => studyNote.id === studyNoteId,
      );

      if (
        existingStudyNote === undefined ||
        existingStudyNote.userId !== validatedUserId
      ) {
        throw new AppStudyNotesError(
          "not_found",
          "The requested Study Note could not be found for this account.",
        );
      }

      const timestamp = new Date().toISOString();
      const acceptedVariants = validateAcceptedVariants(input.acceptedVariants);
      const acronyms = validateAcronyms(input.acronyms);
      const keyIdeas = validateStudyNoteKeyIdeas(input.keyIdeas);
      const labelIds = validateOwnedLabelIds(input.labelIds, {
        getOwnedLabelIdsForUser: options.getOwnedLabelIdsForUser,
        userId: validatedUserId,
      });
      const metaphors = validateMetaphors(input.metaphors);
      const prohibitedPhrases = validateProhibitedPhrases(
        input.prohibitedPhrases,
      );
      const shouldDetachSource = snapshot.some(
        (studyNote) =>
          studyNote.userId === validatedUserId &&
          studyNote.sourceNoteId === existingStudyNote.sourceNoteId &&
          studyNote.id !== existingStudyNote.id,
      );
      const sourceNoteId = shouldDetachSource
        ? cryptoProvider.randomUUID()
        : existingStudyNote.sourceNoteId;
      const updatedSource = {
        body: validateOptionalText(input.sourceBody),
        id: sourceNoteId,
        title: validateOptionalText(input.sourceTitle),
        updatedAt: timestamp,
      };
      const updatedStudyNote: AppStoredStudyNote = {
        ...existingStudyNote,
        acceptedVariants,
        acronyms,
        expectedAnswer: validateOptionalText(input.expectedAnswer),
        keyIdeas,
        labelIds,
        metaphors,
        prompt: validateRequiredText(input.prompt, "Prompt"),
        prohibitedPhrases,
        source: updatedSource,
        sourceNoteId,
        updatedAt: timestamp,
      };

      writeSnapshot([
        updatedStudyNote,
        ...snapshot.filter((studyNote) => studyNote.id !== studyNoteId),
      ]);

      return toPublicStudyNote(updatedStudyNote, [
        updatedStudyNote,
        ...snapshot.filter((studyNote) => studyNote.id !== studyNoteId),
      ]);
    },
  };
}
