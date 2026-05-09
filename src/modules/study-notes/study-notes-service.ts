import { and, eq, inArray } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import { notesTable } from "../notes/notes-schema";
import {
  type AppStudyNote,
  type AppStudyNoteAcronym,
  type AppStudyNoteMetaphor,
  AppStudyNotesError,
  type CreateStudyNoteInput,
  type UpdateStudyNoteInput,
} from "./study-notes";
import {
  studyNoteAcronymsTable,
  studyNoteMetaphorsTable,
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

function validateHookCount(hooks: readonly unknown[], label: string) {
  if (hooks.length <= 1) {
    return;
  }

  throw new AppStudyNotesError(
    "invalid_input",
    `Only one ${label.toLowerCase()} can be saved per Study Note.`,
  );
}

function validateHooks(
  hooks: readonly { description: string }[] | undefined,
  label: string,
) {
  const safeHooks = hooks ?? [];
  validateHookCount(safeHooks, label);

  return safeHooks.map((hook) => {
    const description = hook.description.trim();

    if (description.length === 0) {
      throw new AppStudyNotesError(
        "invalid_input",
        `${label} description is required.`,
      );
    }

    return {
      description,
    };
  });
}

function toAppStudyNote(input: {
  acronyms: AppStudyNoteAcronym[];
  createdAt: Date;
  expectedAnswer: string;
  id: string;
  metaphors: AppStudyNoteMetaphor[];
  prompt: string;
  sourceBody: string;
  sourceNoteId: string;
  sourceTitle: string;
  sourceUpdatedAt: Date;
  updatedAt: Date;
}): AppStudyNote {
  return {
    acronyms: input.acronyms.map((acronym) => ({ ...acronym })),
    createdAt: input.createdAt.toISOString(),
    expectedAnswer: input.expectedAnswer,
    id: input.id,
    metaphors: input.metaphors.map((metaphor) => ({ ...metaphor })),
    prompt: input.prompt,
    source: {
      body: input.sourceBody,
      id: input.sourceNoteId,
      title: input.sourceTitle,
      updatedAt: input.sourceUpdatedAt.toISOString(),
    },
    sourceNoteId: input.sourceNoteId,
    updatedAt: input.updatedAt.toISOString(),
  };
}

type StudyNoteRow = Omit<
  Parameters<typeof toAppStudyNote>[0],
  "acronyms" | "metaphors"
>;

function groupHooksByStudyNoteId(
  rows: readonly { description: string; studyNoteId: string }[],
) {
  return new Map(
    rows.map((row) => [row.studyNoteId, [{ description: row.description }]]),
  );
}

async function addHooksToStudyNoteRows(
  db: StudyNotesDatabase<Record<string, unknown>>,
  rows: readonly StudyNoteRow[],
) {
  if (rows.length === 0) {
    return [];
  }

  const studyNoteIds = rows.map((row) => row.id);
  const [storedMetaphors, storedAcronyms] = await Promise.all([
    db
      .select()
      .from(studyNoteMetaphorsTable)
      .where(inArray(studyNoteMetaphorsTable.studyNoteId, studyNoteIds)),
    db
      .select()
      .from(studyNoteAcronymsTable)
      .where(inArray(studyNoteAcronymsTable.studyNoteId, studyNoteIds)),
  ]);
  const metaphorsByStudyNoteId = groupHooksByStudyNoteId(storedMetaphors);
  const acronymsByStudyNoteId = groupHooksByStudyNoteId(storedAcronyms);

  return rows.map((row) => ({
    ...row,
    acronyms: acronymsByStudyNoteId.get(row.id) ?? [],
    metaphors: metaphorsByStudyNoteId.get(row.id) ?? [],
  }));
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

  return (await addHooksToStudyNoteRows(input.db, [row]))[0];
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
      const sourceTitle = validateRequiredText(
        input.sourceTitle,
        "Source title",
      );
      const sourceBody = validateOptionalText(input.sourceBody);
      const metaphors = validateHooks(input.metaphors, "Metaphor");
      const acronyms = validateHooks(input.acronyms, "Acronym");

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
          expectedAnswer: sourceBody,
          id: studyNoteId,
          prompt: sourceTitle,
          sourceNoteId,
          updatedAt: timestamp,
        });
        if (metaphors[0] !== undefined) {
          await tx.insert(studyNoteMetaphorsTable).values({
            description: metaphors[0].description,
            studyNoteId,
          });
        }
        if (acronyms[0] !== undefined) {
          await tx.insert(studyNoteAcronymsTable).values({
            description: acronyms[0].description,
            studyNoteId,
          });
        }
      });

      return toAppStudyNote({
        acronyms,
        createdAt: timestamp,
        expectedAnswer: sourceBody,
        id: studyNoteId,
        metaphors,
        prompt: sourceTitle,
        sourceBody,
        sourceNoteId,
        sourceTitle,
        sourceUpdatedAt: timestamp,
        updatedAt: timestamp,
      });
    },
    async listStudyNotes({ userId }: { userId: string }) {
      const rows = await db
        .select(studyNoteSelectFields)
        .from(studyNotesTable)
        .innerJoin(notesTable, eq(studyNotesTable.sourceNoteId, notesTable.id))
        .where(eq(notesTable.userId, userId));

      return (await addHooksToStudyNoteRows(db, rows))
        .sort((left, right) =>
          right.updatedAt
            .toISOString()
            .localeCompare(left.updatedAt.toISOString()),
        )
        .map(toAppStudyNote);
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
      const prompt = validateRequiredText(input.prompt, "Prompt");
      const expectedAnswer = validateOptionalText(input.expectedAnswer);
      const metaphors = validateHooks(input.metaphors, "Metaphor");
      const acronyms = validateHooks(input.acronyms, "Acronym");
      const sourceTitle = validateRequiredText(
        input.sourceTitle,
        "Source title",
      );
      const sourceBody = validateOptionalText(input.sourceBody);

      await db.transaction(async (tx) => {
        await tx
          .update(studyNotesTable)
          .set({
            expectedAnswer,
            prompt,
            updatedAt: timestamp,
          })
          .where(eq(studyNotesTable.id, existingStudyNote.id));
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
        await tx
          .delete(studyNoteMetaphorsTable)
          .where(eq(studyNoteMetaphorsTable.studyNoteId, existingStudyNote.id));
        await tx
          .delete(studyNoteAcronymsTable)
          .where(eq(studyNoteAcronymsTable.studyNoteId, existingStudyNote.id));
        if (metaphors[0] !== undefined) {
          await tx.insert(studyNoteMetaphorsTable).values({
            description: metaphors[0].description,
            studyNoteId: existingStudyNote.id,
          });
        }
        if (acronyms[0] !== undefined) {
          await tx.insert(studyNoteAcronymsTable).values({
            description: acronyms[0].description,
            studyNoteId: existingStudyNote.id,
          });
        }
      });

      return toAppStudyNote({
        acronyms,
        createdAt: existingStudyNote.createdAt,
        expectedAnswer,
        id: existingStudyNote.id,
        metaphors,
        prompt,
        sourceBody,
        sourceNoteId: existingStudyNote.sourceNoteId,
        sourceTitle,
        sourceUpdatedAt: timestamp,
        updatedAt: timestamp,
      });
    },
    async updateSourceNote({
      input,
      userId,
    }: {
      input: UpdateSourceNoteInput;
      userId: string;
    }) {
      const timestamp = now();
      const title = validateRequiredText(input.title, "Source title");
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

      return (
        await Promise.all(
          affectedStudyNotes.map((studyNote) =>
            readOwnedStudyNote({
              db,
              studyNoteId: studyNote.id,
              userId,
            }),
          ),
        )
      ).map(toAppStudyNote);
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

      return (await addHooksToStudyNoteRows(db, rows)).map(toAppStudyNote);
    },
  };
}
