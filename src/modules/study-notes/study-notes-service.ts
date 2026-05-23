import { and, asc, eq, inArray } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import { labelsTable, studyNoteLabelsTable } from "../labels/labels-schema";
import { notesTable } from "../notes/notes-schema";
import {
  type AppStudyNote,
  type AppStudyNoteAcceptedVariant,
  type AppStudyNoteAcronym,
  type AppStudyNoteKeyIdea,
  type AppStudyNoteMetaphor,
  type AppStudyNoteProhibitedPhrase,
  AppStudyNotesError,
  type AppStudyNoteTextReference,
  type CreateStudyNoteFromSourceInput,
  type CreateStudyNoteInput,
  type DeleteStudyNoteInput,
  getStudyNoteSourceDisplayName,
  resolveCreateStudyNoteFields,
  type StudyNoteKeyIdeaImportance,
  type UpdateStudyNoteInput,
  validateAcceptedVariants,
  validateProhibitedPhrases,
  validateStudyNoteKeyIdeas,
  validateStudyNoteSupportDescriptions,
} from "./study-notes";
import {
  studyNoteAcceptedVariantsTable,
  studyNoteAcronymsTable,
  studyNoteKeyIdeasTable,
  studyNoteMetaphorsTable,
  studyNoteProhibitedPhrasesTable,
  studyNotesTable,
} from "./study-notes-schema";

type StudyNotesDatabase<TSchema extends Record<string, unknown>> = PgDatabase<
  PgQueryResultHKT,
  TSchema
>;

type StudyNotesCrypto = {
  randomUUID: () => string;
};

type CreateStudyNotesServiceOptions = {
  crypto?: StudyNotesCrypto;
  db: StudyNotesDatabase<Record<string, unknown>>;
  now?: () => Date;
};

type UpdateSourceNoteInput = {
  body: string;
  sourceNoteId: string;
  title: string;
};

const studyNoteSelectFields = {
  createdAt: studyNotesTable.createdAt,
  expectedAnswer: studyNotesTable.expectedAnswer,
  id: studyNotesTable.id,
  prompt: studyNotesTable.prompt,
  sourceBody: notesTable.body,
  sourceNoteId: studyNotesTable.sourceNoteId,
  sourceTitle: notesTable.title,
  sourceUpdatedAt: notesTable.updatedAt,
  updatedAt: studyNotesTable.updatedAt,
};

type StudyNoteRow = {
  createdAt: Date;
  expectedAnswer: string;
  id: string;
  prompt: string;
  sourceBody: string;
  sourceNoteId: string;
  sourceTitle: string;
  sourceUpdatedAt: Date;
  updatedAt: Date;
};

type StudyNoteLabelRow = {
  labelId: string;
  studyNoteId: string;
};

type StudyNoteSupportDescriptionRow = {
  description: string;
  studyNoteId: string;
};

type StudyNoteKeyIdeaRow = {
  acceptedPhrases: string[];
  id: string;
  importance: StudyNoteKeyIdeaImportance;
  position: number;
  prohibitedPhrases: string[];
  studyNoteId: string;
  text: string;
};

type StudyNoteTextReferenceRow = AppStudyNoteTextReference & {
  position: number;
  studyNoteId: string;
};

type StudyNoteRowWithDetails = StudyNoteRow & {
  acceptedVariants: AppStudyNoteAcceptedVariant[];
  acronyms: AppStudyNoteAcronym[];
  keyIdeas: AppStudyNoteKeyIdea[];
  labelIds: string[];
  metaphors: AppStudyNoteMetaphor[];
  prohibitedPhrases: AppStudyNoteProhibitedPhrase[];
  sourceDisplayName: string;
};

function getDefaultCrypto(): StudyNotesCrypto {
  return globalThis.crypto;
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

function getSourceDisplayNameFromRows(input: {
  linkedStudyNotes: readonly Pick<StudyNoteRow, "createdAt" | "prompt">[];
  sourceTitle: string;
}): string {
  return getStudyNoteSourceDisplayName({
    linkedStudyNotes: input.linkedStudyNotes.map((studyNote) => ({
      createdAt: studyNote.createdAt.getTime(),
      prompt: studyNote.prompt,
    })),
    sourceTitle: input.sourceTitle,
  });
}

function normalizeLabelIds(labelIds: readonly string[] | undefined): string[] {
  return [...new Set((labelIds ?? []).filter(Boolean))];
}

async function validateOwnedLabelIds(input: {
  db: StudyNotesDatabase<Record<string, unknown>>;
  labelIds: string[];
  userId: string;
}) {
  if (input.labelIds.length === 0) {
    return input.labelIds;
  }

  const ownedLabels = await input.db
    .select({
      id: labelsTable.id,
    })
    .from(labelsTable)
    .where(
      and(
        eq(labelsTable.userId, input.userId),
        inArray(labelsTable.id, input.labelIds),
      ),
    );

  if (ownedLabels.length !== input.labelIds.length) {
    throw new AppStudyNotesError(
      "invalid_input",
      "Study Notes can only be assigned to labels owned by this account.",
    );
  }

  return input.labelIds;
}

function groupLabelIdsByStudyNoteId(
  studyNoteLabels: readonly StudyNoteLabelRow[],
) {
  const labelIdsByStudyNoteId = new Map<string, Set<string>>();

  for (const studyNoteLabel of studyNoteLabels) {
    const labelIds = labelIdsByStudyNoteId.get(studyNoteLabel.studyNoteId);

    if (labelIds === undefined) {
      labelIdsByStudyNoteId.set(
        studyNoteLabel.studyNoteId,
        new Set([studyNoteLabel.labelId]),
      );
      continue;
    }

    labelIds.add(studyNoteLabel.labelId);
  }

  return labelIdsByStudyNoteId;
}

function getSortedStudyNoteLabelIds(input: {
  labelIdsByStudyNoteId: Map<string, Set<string>>;
  studyNoteId: string;
}) {
  return [...(input.labelIdsByStudyNoteId.get(input.studyNoteId) ?? [])].sort();
}

function createStudyNoteLabelRows(
  studyNoteId: string,
  labelIds: readonly string[],
): StudyNoteLabelRow[] {
  return labelIds.map((labelId) => ({
    labelId,
    studyNoteId,
  }));
}

function createStudyNoteKeyIdeaRows(
  studyNoteId: string,
  keyIdeas: readonly AppStudyNoteKeyIdea[],
) {
  return keyIdeas.map((keyIdea, position) => ({
    acceptedPhrases: [...keyIdea.acceptedPhrases],
    id: keyIdea.id,
    importance: keyIdea.importance,
    position,
    prohibitedPhrases: [...keyIdea.prohibitedPhrases],
    studyNoteId,
    text: keyIdea.text,
  }));
}

function createStudyNoteTextReferenceRows(
  studyNoteId: string,
  references: readonly AppStudyNoteTextReference[],
) {
  return references.map((reference, position) => ({
    id: reference.id,
    position,
    studyNoteId,
    text: reference.text,
  }));
}

function groupSupportDescriptionsByStudyNoteId(
  rows: readonly StudyNoteSupportDescriptionRow[],
) {
  const supportDescriptionsByStudyNoteId = new Map<
    string,
    { description: string }[]
  >();

  for (const row of rows) {
    const supportDescriptions =
      supportDescriptionsByStudyNoteId.get(row.studyNoteId) ?? [];
    supportDescriptions.push({ description: row.description });
    supportDescriptionsByStudyNoteId.set(row.studyNoteId, supportDescriptions);
  }

  return supportDescriptionsByStudyNoteId;
}

function groupKeyIdeasByStudyNoteId(rows: readonly StudyNoteKeyIdeaRow[]) {
  const keyIdeasByStudyNoteId = new Map<string, AppStudyNoteKeyIdea[]>();

  for (const row of rows) {
    const keyIdeas = keyIdeasByStudyNoteId.get(row.studyNoteId) ?? [];
    keyIdeas.push({
      acceptedPhrases: [...row.acceptedPhrases],
      id: row.id,
      importance: row.importance,
      prohibitedPhrases: [...row.prohibitedPhrases],
      text: row.text,
    });
    keyIdeasByStudyNoteId.set(row.studyNoteId, keyIdeas);
  }

  return keyIdeasByStudyNoteId;
}

function groupTextReferencesByStudyNoteId(
  rows: readonly StudyNoteTextReferenceRow[],
) {
  const referencesByStudyNoteId = new Map<
    string,
    AppStudyNoteTextReference[]
  >();

  for (const row of rows) {
    const references = referencesByStudyNoteId.get(row.studyNoteId) ?? [];
    references.push({
      id: row.id,
      text: row.text,
    });
    referencesByStudyNoteId.set(row.studyNoteId, references);
  }

  return referencesByStudyNoteId;
}

function groupStudyNotesBySourceNoteId(rows: readonly StudyNoteRow[]) {
  const studyNotesBySourceNoteId = new Map<string, StudyNoteRow[]>();

  for (const row of rows) {
    const studyNotes = studyNotesBySourceNoteId.get(row.sourceNoteId) ?? [];
    studyNotes.push(row);
    studyNotesBySourceNoteId.set(row.sourceNoteId, studyNotes);
  }

  return studyNotesBySourceNoteId;
}

function getSingleSupportDescriptionText(
  supportDescriptions: readonly { description: string }[],
) {
  return supportDescriptions[0]?.description ?? null;
}

function toAppStudyNote(input: StudyNoteRowWithDetails): AppStudyNote {
  return {
    acceptedVariants: input.acceptedVariants.map((variant) => ({ ...variant })),
    acronyms: input.acronyms.map((acronym) => ({ ...acronym })),
    createdAt: input.createdAt.toISOString(),
    expectedAnswer: input.expectedAnswer,
    id: input.id,
    keyIdeas: input.keyIdeas.map((keyIdea) => ({
      ...keyIdea,
      acceptedPhrases: [...keyIdea.acceptedPhrases],
      prohibitedPhrases: [...keyIdea.prohibitedPhrases],
    })),
    labelIds: [...input.labelIds],
    metaphors: input.metaphors.map((metaphor) => ({ ...metaphor })),
    prompt: input.prompt,
    prohibitedPhrases: input.prohibitedPhrases.map((phrase) => ({ ...phrase })),
    source: {
      body: input.sourceBody,
      displayName: input.sourceDisplayName,
      id: input.sourceNoteId,
      title: input.sourceTitle,
      updatedAt: input.sourceUpdatedAt.toISOString(),
    },
    sourceNoteId: input.sourceNoteId,
    updatedAt: input.updatedAt.toISOString(),
  };
}

async function addDetailsToStudyNoteRows(
  db: StudyNotesDatabase<Record<string, unknown>>,
  rows: readonly StudyNoteRow[],
): Promise<StudyNoteRowWithDetails[]> {
  if (rows.length === 0) {
    return [];
  }

  const studyNoteIds = rows.map((row) => row.id);
  const sourceNoteIds = [...new Set(rows.map((row) => row.sourceNoteId))];
  const [
    storedStudyNoteLabels,
    storedMetaphors,
    storedAcronyms,
    storedKeyIdeas,
    storedAcceptedVariants,
    storedProhibitedPhrases,
  ] = await Promise.all([
    db
      .select()
      .from(studyNoteLabelsTable)
      .where(inArray(studyNoteLabelsTable.studyNoteId, studyNoteIds)),
    db
      .select()
      .from(studyNoteMetaphorsTable)
      .where(inArray(studyNoteMetaphorsTable.studyNoteId, studyNoteIds)),
    db
      .select()
      .from(studyNoteAcronymsTable)
      .where(inArray(studyNoteAcronymsTable.studyNoteId, studyNoteIds)),
    db
      .select()
      .from(studyNoteKeyIdeasTable)
      .where(inArray(studyNoteKeyIdeasTable.studyNoteId, studyNoteIds))
      .orderBy(
        asc(studyNoteKeyIdeasTable.studyNoteId),
        asc(studyNoteKeyIdeasTable.position),
      ),
    db
      .select()
      .from(studyNoteAcceptedVariantsTable)
      .where(inArray(studyNoteAcceptedVariantsTable.studyNoteId, studyNoteIds))
      .orderBy(
        asc(studyNoteAcceptedVariantsTable.studyNoteId),
        asc(studyNoteAcceptedVariantsTable.position),
      ),
    db
      .select()
      .from(studyNoteProhibitedPhrasesTable)
      .where(inArray(studyNoteProhibitedPhrasesTable.studyNoteId, studyNoteIds))
      .orderBy(
        asc(studyNoteProhibitedPhrasesTable.studyNoteId),
        asc(studyNoteProhibitedPhrasesTable.position),
      ),
  ]);
  const linkedStudyNoteRows = await db
    .select(studyNoteSelectFields)
    .from(studyNotesTable)
    .innerJoin(notesTable, eq(studyNotesTable.sourceNoteId, notesTable.id))
    .where(inArray(studyNotesTable.sourceNoteId, sourceNoteIds));
  const labelIdsByStudyNoteId = groupLabelIdsByStudyNoteId(
    storedStudyNoteLabels,
  );
  const metaphorsByStudyNoteId =
    groupSupportDescriptionsByStudyNoteId(storedMetaphors);
  const acronymsByStudyNoteId =
    groupSupportDescriptionsByStudyNoteId(storedAcronyms);
  const keyIdeasByStudyNoteId = groupKeyIdeasByStudyNoteId(storedKeyIdeas);
  const acceptedVariantsByStudyNoteId = groupTextReferencesByStudyNoteId(
    storedAcceptedVariants,
  );
  const prohibitedPhrasesByStudyNoteId = groupTextReferencesByStudyNoteId(
    storedProhibitedPhrases,
  );
  const linkedStudyNotesBySourceNoteId =
    groupStudyNotesBySourceNoteId(linkedStudyNoteRows);

  return rows.map((row) => ({
    acceptedVariants: acceptedVariantsByStudyNoteId.get(row.id) ?? [],
    ...row,
    acronyms: acronymsByStudyNoteId.get(row.id) ?? [],
    keyIdeas: keyIdeasByStudyNoteId.get(row.id) ?? [],
    labelIds: getSortedStudyNoteLabelIds({
      labelIdsByStudyNoteId,
      studyNoteId: row.id,
    }),
    metaphors: metaphorsByStudyNoteId.get(row.id) ?? [],
    prohibitedPhrases: prohibitedPhrasesByStudyNoteId.get(row.id) ?? [],
    sourceDisplayName: getSourceDisplayNameFromRows({
      linkedStudyNotes:
        linkedStudyNotesBySourceNoteId.get(row.sourceNoteId) ?? [],
      sourceTitle: row.sourceTitle,
    }),
  }));
}

async function toAppStudyNotes(input: {
  db: StudyNotesDatabase<Record<string, unknown>>;
  rows: StudyNoteRow[];
}) {
  return (await addDetailsToStudyNoteRows(input.db, input.rows)).map(
    toAppStudyNote,
  );
}

async function readOwnedStudyNote(input: {
  db: StudyNotesDatabase<Record<string, unknown>>;
  studyNoteId: string;
  userId: string;
}) {
  const row =
    (
      await input.db
        .select(studyNoteSelectFields)
        .from(studyNotesTable)
        .innerJoin(notesTable, eq(studyNotesTable.sourceNoteId, notesTable.id))
        .where(
          and(
            eq(studyNotesTable.id, input.studyNoteId),
            eq(notesTable.userId, input.userId),
          ),
        )
        .limit(1)
    )[0] ?? null;

  if (row === null) {
    throw new AppStudyNotesError(
      "not_found",
      "The requested Study Note could not be found for this account.",
    );
  }

  return (await addDetailsToStudyNoteRows(input.db, [row]))[0];
}

export function createStudyNotesService({
  crypto = getDefaultCrypto(),
  db,
  now = () => new Date(),
}: CreateStudyNotesServiceOptions) {
  return {
    async createStudyNote({
      input,
      userId,
    }: {
      input: CreateStudyNoteInput;
      userId: string;
    }) {
      const timestamp = now();
      const sourceNoteId = crypto.randomUUID();
      const studyNoteId = crypto.randomUUID();
      const acceptedVariants = validateAcceptedVariants(input.acceptedVariants);
      const sourceTitle = validateOptionalText(input.sourceTitle);
      const sourceBody = validateOptionalText(input.sourceBody);
      const { expectedAnswer, prompt } = resolveCreateStudyNoteFields(input, {
        expectedAnswer: sourceBody,
        prompt: sourceTitle,
      });
      const acronyms = validateStudyNoteSupportDescriptions(
        input.acronyms,
        "Acronym",
      );
      const keyIdeas = validateStudyNoteKeyIdeas(input.keyIdeas);
      const safeLabelIds = await validateOwnedLabelIds({
        db,
        labelIds: normalizeLabelIds(input.labelIds),
        userId,
      });
      const metaphors = validateStudyNoteSupportDescriptions(
        input.metaphors,
        "Metaphor",
      );
      const prohibitedPhrases = validateProhibitedPhrases(
        input.prohibitedPhrases,
      );

      await db.transaction(async (tx) => {
        await tx.insert(notesTable).values({
          body: sourceBody,
          createdAt: timestamp,
          id: sourceNoteId,
          labelIds: [],
          title: sourceTitle,
          updatedAt: timestamp,
          userId,
        });
        await tx.insert(studyNotesTable).values({
          createdAt: timestamp,
          expectedAnswer,
          id: studyNoteId,
          prompt,
          sourceNoteId,
          updatedAt: timestamp,
        });
        if (safeLabelIds.length > 0) {
          await tx
            .insert(studyNoteLabelsTable)
            .values(createStudyNoteLabelRows(studyNoteId, safeLabelIds));
        }
        const metaphorDescription = getSingleSupportDescriptionText(metaphors);
        const acronymDescription = getSingleSupportDescriptionText(acronyms);

        if (metaphorDescription !== null) {
          await tx.insert(studyNoteMetaphorsTable).values({
            description: metaphorDescription,
            studyNoteId,
          });
        }
        if (acronymDescription !== null) {
          await tx.insert(studyNoteAcronymsTable).values({
            description: acronymDescription,
            studyNoteId,
          });
        }
        if (keyIdeas.length > 0) {
          await tx
            .insert(studyNoteKeyIdeasTable)
            .values(createStudyNoteKeyIdeaRows(studyNoteId, keyIdeas));
        }
        if (acceptedVariants.length > 0) {
          await tx
            .insert(studyNoteAcceptedVariantsTable)
            .values(
              createStudyNoteTextReferenceRows(studyNoteId, acceptedVariants),
            );
        }
        if (prohibitedPhrases.length > 0) {
          await tx
            .insert(studyNoteProhibitedPhrasesTable)
            .values(
              createStudyNoteTextReferenceRows(studyNoteId, prohibitedPhrases),
            );
        }
      });

      return toAppStudyNote({
        acceptedVariants,
        acronyms,
        createdAt: timestamp,
        expectedAnswer,
        id: studyNoteId,
        keyIdeas,
        labelIds: safeLabelIds,
        metaphors,
        prompt,
        prohibitedPhrases,
        sourceBody,
        sourceDisplayName: getSourceDisplayNameFromRows({
          linkedStudyNotes: [{ createdAt: timestamp, prompt }],
          sourceTitle,
        }),
        sourceNoteId,
        sourceTitle,
        sourceUpdatedAt: timestamp,
        updatedAt: timestamp,
      });
    },
    async createStudyNoteFromSource({
      input,
      userId,
    }: {
      input: CreateStudyNoteFromSourceInput;
      userId: string;
    }) {
      const source =
        (
          await db
            .select()
            .from(notesTable)
            .where(
              and(
                eq(notesTable.id, input.sourceNoteId),
                eq(notesTable.userId, userId),
              ),
            )
            .limit(1)
        )[0] ?? null;

      if (source === null) {
        throw new AppStudyNotesError(
          "not_found",
          "The requested source Note could not be found for this account.",
        );
      }

      const timestamp = now();
      const studyNoteId = crypto.randomUUID();
      const linkedStudyNotes = await db
        .select(studyNoteSelectFields)
        .from(studyNotesTable)
        .innerJoin(notesTable, eq(studyNotesTable.sourceNoteId, notesTable.id))
        .where(eq(studyNotesTable.sourceNoteId, source.id));
      const prompt = getSourceDisplayNameFromRows({
        linkedStudyNotes,
        sourceTitle: source.title,
      });

      await db.transaction(async (tx) => {
        await tx.insert(studyNotesTable).values({
          createdAt: timestamp,
          expectedAnswer: source.body,
          id: studyNoteId,
          prompt,
          sourceNoteId: source.id,
          updatedAt: timestamp,
        });
      });

      return toAppStudyNote({
        acceptedVariants: [],
        acronyms: [],
        createdAt: timestamp,
        expectedAnswer: source.body,
        id: studyNoteId,
        keyIdeas: [],
        labelIds: [],
        metaphors: [],
        prompt,
        prohibitedPhrases: [],
        sourceBody: source.body,
        sourceDisplayName: getSourceDisplayNameFromRows({
          linkedStudyNotes: [
            ...linkedStudyNotes,
            { createdAt: timestamp, prompt },
          ],
          sourceTitle: source.title,
        }),
        sourceNoteId: source.id,
        sourceTitle: source.title,
        sourceUpdatedAt: source.updatedAt,
        updatedAt: timestamp,
      });
    },
    async deleteStudyNote({
      input,
      userId,
    }: {
      input: DeleteStudyNoteInput & { studyNoteId: string };
      userId: string;
    }) {
      const existingStudyNote = await readOwnedStudyNote({
        db,
        studyNoteId: input.studyNoteId,
        userId,
      });
      const siblingStudyNotes = await db
        .select({ id: studyNotesTable.id })
        .from(studyNotesTable)
        .innerJoin(notesTable, eq(studyNotesTable.sourceNoteId, notesTable.id))
        .where(
          and(
            eq(studyNotesTable.sourceNoteId, existingStudyNote.sourceNoteId),
            eq(notesTable.userId, userId),
          ),
        );
      const isLastStudyNote = siblingStudyNotes.length === 1;

      if (isLastStudyNote && !input.deleteSource) {
        throw new AppStudyNotesError(
          "invalid_input",
          "Deleting the last Study Note for a source Note requires deleting the source too.",
        );
      }

      await db.transaction(async (tx) => {
        await tx
          .delete(studyNotesTable)
          .where(eq(studyNotesTable.id, existingStudyNote.id));

        if (isLastStudyNote) {
          await tx
            .delete(notesTable)
            .where(
              and(
                eq(notesTable.id, existingStudyNote.sourceNoteId),
                eq(notesTable.userId, userId),
              ),
            );
        }
      });
    },
    async listStudyNotes({
      labelId,
      userId,
    }: {
      labelId?: string;
      userId: string;
    }) {
      const rows = await db
        .select(studyNoteSelectFields)
        .from(studyNotesTable)
        .innerJoin(notesTable, eq(studyNotesTable.sourceNoteId, notesTable.id))
        .where(
          labelId === undefined
            ? eq(notesTable.userId, userId)
            : and(
                eq(notesTable.userId, userId),
                inArray(
                  studyNotesTable.id,
                  db
                    .select({ id: studyNoteLabelsTable.studyNoteId })
                    .from(studyNoteLabelsTable)
                    .where(eq(studyNoteLabelsTable.labelId, labelId)),
                ),
              ),
        );

      return toAppStudyNotes({
        db,
        rows: rows.sort((left, right) =>
          right.updatedAt
            .toISOString()
            .localeCompare(left.updatedAt.toISOString()),
        ),
      });
    },
    async updateStudyNote({
      input,
      userId,
    }: {
      input: UpdateStudyNoteInput & { studyNoteId: string };
      userId: string;
    }) {
      const existingStudyNote = await readOwnedStudyNote({
        db,
        studyNoteId: input.studyNoteId,
        userId,
      });
      const timestamp = now();
      const acceptedVariants = validateAcceptedVariants(input.acceptedVariants);
      const acronyms = validateStudyNoteSupportDescriptions(
        input.acronyms,
        "Acronym",
      );
      const expectedAnswer = validateOptionalText(input.expectedAnswer);
      const keyIdeas = validateStudyNoteKeyIdeas(input.keyIdeas);
      const safeLabelIds = await validateOwnedLabelIds({
        db,
        labelIds: normalizeLabelIds(input.labelIds),
        userId,
      });
      const metaphors = validateStudyNoteSupportDescriptions(
        input.metaphors,
        "Metaphor",
      );
      const prompt = validateRequiredText(input.prompt, "Prompt");
      const prohibitedPhrases = validateProhibitedPhrases(
        input.prohibitedPhrases,
      );
      const sourceTitle = validateOptionalText(input.sourceTitle);
      const sourceBody = validateOptionalText(input.sourceBody);
      const sourceStudyNotes = await db
        .select({ id: studyNotesTable.id })
        .from(studyNotesTable)
        .where(
          eq(studyNotesTable.sourceNoteId, existingStudyNote.sourceNoteId),
        );
      const didSourceChange =
        sourceTitle !== existingStudyNote.sourceTitle.trim() ||
        sourceBody !== existingStudyNote.sourceBody.trim();
      const shouldDetachSource =
        didSourceChange &&
        sourceStudyNotes.some(
          (studyNote) => studyNote.id !== existingStudyNote.id,
        );
      const sourceNoteId = shouldDetachSource
        ? crypto.randomUUID()
        : existingStudyNote.sourceNoteId;

      await db.transaction(async (tx) => {
        if (shouldDetachSource) {
          await tx.insert(notesTable).values({
            body: sourceBody,
            createdAt: timestamp,
            id: sourceNoteId,
            labelIds: [],
            title: sourceTitle,
            updatedAt: timestamp,
            userId,
          });
        }
        await tx
          .update(studyNotesTable)
          .set({
            expectedAnswer,
            prompt,
            sourceNoteId,
            updatedAt: timestamp,
          })
          .where(eq(studyNotesTable.id, existingStudyNote.id));
        if (didSourceChange && !shouldDetachSource) {
          await tx
            .update(notesTable)
            .set({
              body: sourceBody,
              title: sourceTitle,
              updatedAt: timestamp,
            })
            .where(
              and(
                eq(notesTable.id, existingStudyNote.sourceNoteId),
                eq(notesTable.userId, userId),
              ),
            );
        }
        await tx
          .delete(studyNoteLabelsTable)
          .where(eq(studyNoteLabelsTable.studyNoteId, existingStudyNote.id));
        if (safeLabelIds.length > 0) {
          await tx
            .insert(studyNoteLabelsTable)
            .values(
              createStudyNoteLabelRows(existingStudyNote.id, safeLabelIds),
            );
        }
        await tx
          .delete(studyNoteMetaphorsTable)
          .where(eq(studyNoteMetaphorsTable.studyNoteId, existingStudyNote.id));
        await tx
          .delete(studyNoteAcronymsTable)
          .where(eq(studyNoteAcronymsTable.studyNoteId, existingStudyNote.id));
        await tx
          .delete(studyNoteKeyIdeasTable)
          .where(eq(studyNoteKeyIdeasTable.studyNoteId, existingStudyNote.id));
        await tx
          .delete(studyNoteAcceptedVariantsTable)
          .where(
            eq(
              studyNoteAcceptedVariantsTable.studyNoteId,
              existingStudyNote.id,
            ),
          );
        await tx
          .delete(studyNoteProhibitedPhrasesTable)
          .where(
            eq(
              studyNoteProhibitedPhrasesTable.studyNoteId,
              existingStudyNote.id,
            ),
          );
        const metaphorDescription = getSingleSupportDescriptionText(metaphors);
        const acronymDescription = getSingleSupportDescriptionText(acronyms);

        if (metaphorDescription !== null) {
          await tx.insert(studyNoteMetaphorsTable).values({
            description: metaphorDescription,
            studyNoteId: existingStudyNote.id,
          });
        }
        if (acronymDescription !== null) {
          await tx.insert(studyNoteAcronymsTable).values({
            description: acronymDescription,
            studyNoteId: existingStudyNote.id,
          });
        }
        if (keyIdeas.length > 0) {
          await tx
            .insert(studyNoteKeyIdeasTable)
            .values(createStudyNoteKeyIdeaRows(existingStudyNote.id, keyIdeas));
        }
        if (acceptedVariants.length > 0) {
          await tx
            .insert(studyNoteAcceptedVariantsTable)
            .values(
              createStudyNoteTextReferenceRows(
                existingStudyNote.id,
                acceptedVariants,
              ),
            );
        }
        if (prohibitedPhrases.length > 0) {
          await tx
            .insert(studyNoteProhibitedPhrasesTable)
            .values(
              createStudyNoteTextReferenceRows(
                existingStudyNote.id,
                prohibitedPhrases,
              ),
            );
        }
      });

      return toAppStudyNote(
        await readOwnedStudyNote({
          db,
          studyNoteId: existingStudyNote.id,
          userId,
        }),
      );
    },
    async updateSourceNote({
      input,
      userId,
    }: {
      input: UpdateSourceNoteInput;
      userId: string;
    }) {
      const timestamp = now();
      const title = validateOptionalText(input.title);
      const body = validateOptionalText(input.body);
      const existingSource =
        (
          await db
            .select()
            .from(notesTable)
            .where(
              and(
                eq(notesTable.id, input.sourceNoteId),
                eq(notesTable.userId, userId),
              ),
            )
            .limit(1)
        )[0] ?? null;

      if (existingSource === null) {
        throw new AppStudyNotesError(
          "not_found",
          "The requested source Note could not be found for this account.",
        );
      }

      await db
        .update(notesTable)
        .set({
          body,
          title,
          updatedAt: timestamp,
        })
        .where(eq(notesTable.id, input.sourceNoteId));

      const affectedStudyNotes = await db
        .select({ id: studyNotesTable.id })
        .from(studyNotesTable)
        .where(eq(studyNotesTable.sourceNoteId, input.sourceNoteId));

      if (affectedStudyNotes.length === 0) {
        return [];
      }

      return toAppStudyNotes({
        db,
        rows: await Promise.all(
          affectedStudyNotes.map((studyNote) =>
            readOwnedStudyNote({
              db,
              studyNoteId: studyNote.id,
              userId,
            }),
          ),
        ),
      });
    },
    async listStudyNotesForSources({
      sourceNoteIds,
      userId,
    }: {
      sourceNoteIds: string[];
      userId: string;
    }) {
      if (sourceNoteIds.length === 0) {
        return [];
      }

      const rows = await db
        .select(studyNoteSelectFields)
        .from(studyNotesTable)
        .innerJoin(notesTable, eq(studyNotesTable.sourceNoteId, notesTable.id))
        .where(
          and(
            eq(notesTable.userId, userId),
            inArray(studyNotesTable.sourceNoteId, sourceNoteIds),
          ),
        );

      return toAppStudyNotes({ db, rows });
    },
  };
}
