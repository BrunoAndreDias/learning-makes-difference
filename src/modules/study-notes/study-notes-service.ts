import { and, eq, inArray } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import { notesTable } from "../notes/notes-schema";
import {
  type AppStudyNote,
  AppStudyNotesError,
  type CreateStudyNoteFromSourceInput,
  type CreateStudyNoteInput,
  type DeleteStudyNoteInput,
  type UpdateStudyNoteInput,
} from "./study-notes";
import { studyNotesTable } from "./study-notes-schema";

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

function toAppStudyNote(input: {
  createdAt: Date;
  expectedAnswer: string;
  id: string;
  prompt: string;
  sourceBody: string;
  sourceNoteId: string;
  sourceTitle: string;
  sourceUpdatedAt: Date;
  updatedAt: Date;
}): AppStudyNote {
  return {
    createdAt: input.createdAt.toISOString(),
    expectedAnswer: input.expectedAnswer,
    id: input.id,
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

  return row;
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
      });

      return toAppStudyNote({
        createdAt: timestamp,
        expectedAnswer: sourceBody,
        id: studyNoteId,
        prompt: sourceTitle,
        sourceBody,
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

      await db.insert(studyNotesTable).values({
        createdAt: timestamp,
        expectedAnswer: source.body,
        id: studyNoteId,
        prompt: source.title,
        sourceNoteId: source.id,
        updatedAt: timestamp,
      });

      return toAppStudyNote({
        createdAt: timestamp,
        expectedAnswer: source.body,
        id: studyNoteId,
        prompt: source.title,
        sourceBody: source.body,
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
    async listStudyNotes({ userId }: { userId: string }) {
      const rows = await db
        .select(studyNoteSelectFields)
        .from(studyNotesTable)
        .innerJoin(notesTable, eq(studyNotesTable.sourceNoteId, notesTable.id))
        .where(eq(notesTable.userId, userId));

      return rows
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
      });

      return toAppStudyNote({
        createdAt: existingStudyNote.createdAt,
        expectedAnswer,
        id: existingStudyNote.id,
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

      return rows.map(toAppStudyNote);
    },
  };
}
