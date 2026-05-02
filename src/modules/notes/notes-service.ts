import { and, eq, inArray } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import {
  noteAcronymsTable,
  noteMetaphorsTable,
  notesTable,
} from "./notes-schema";
import {
  type AppAcronym,
  type AppMetaphor,
  type AppNote,
  AppNotesError,
} from "./notes-workspace/notes";

type NotesDatabase<TSchema extends Record<string, unknown>> = PgDatabase<
  PgQueryResultHKT,
  TSchema
>;

type NotesCrypto = Pick<Crypto, "randomUUID">;

type CreateNoteInput = {
  acronyms: AppAcronym[];
  body: string;
  labelIds: string[];
  metaphors: AppMetaphor[];
  title: string;
};

type UpdateNoteInput = CreateNoteInput;

type CreateNotesServiceOptions = {
  crypto?: NotesCrypto;
  db: NotesDatabase<Record<string, unknown>>;
  now?: () => Date;
};

function getDefaultCrypto(): NotesCrypto {
  return globalThis.crypto;
}

function validateTitle(title: string): string {
  const trimmedValue = title.trim();

  if (trimmedValue.length === 0) {
    throw new AppNotesError("invalid_input", "Title is required.");
  }

  return trimmedValue;
}

function validateBody(body: string): string {
  return body.trim();
}

function validateLabelIds(labelIds: string[]): string[] {
  return [...new Set(labelIds.filter(Boolean))];
}

function validateHookCount(hooks: readonly unknown[], label: string) {
  if (hooks.length <= 1) {
    return;
  }

  throw new AppNotesError(
    "invalid_input",
    `Only one ${label.toLowerCase()} can be saved per note.`,
  );
}

function validateMetaphors(metaphors: AppMetaphor[]): AppMetaphor[] {
  validateHookCount(metaphors, "Metaphor");

  return metaphors.map((metaphor) => {
    const description = metaphor.description.trim();

    if (description.length === 0) {
      throw new AppNotesError(
        "invalid_input",
        "Metaphor description is required.",
      );
    }

    return {
      description,
    };
  });
}

function validateAcronyms(acronyms: AppAcronym[]): AppAcronym[] {
  validateHookCount(acronyms, "Acronym");

  return acronyms.map((acronym) => {
    const description = acronym.description.trim();

    if (description.length === 0) {
      throw new AppNotesError(
        "invalid_input",
        "Acronym description is required.",
      );
    }

    return {
      description,
    };
  });
}

function toAppNote(input: {
  acronymDescription: string | null;
  body: string;
  createdAt: Date;
  id: string;
  labelIds: string[];
  metaphorDescription: string | null;
  title: string;
  updatedAt: Date;
}): AppNote {
  return {
    acronyms:
      input.acronymDescription === null
        ? []
        : [
            {
              description: input.acronymDescription,
            },
          ],
    body: input.body,
    createdAt: input.createdAt.toISOString(),
    id: input.id,
    labelIds: [...input.labelIds],
    metaphors:
      input.metaphorDescription === null
        ? []
        : [
            {
              description: input.metaphorDescription,
            },
          ],
    title: input.title,
    updatedAt: input.updatedAt.toISOString(),
  };
}

async function readOwnedNotes(
  db: NotesDatabase<Record<string, unknown>>,
  userId: string,
) {
  const storedNotes = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.userId, userId));

  if (storedNotes.length === 0) {
    return [];
  }

  const noteIds = storedNotes.map((note) => note.id);
  const [storedMetaphors, storedAcronyms] = await Promise.all([
    db
      .select()
      .from(noteMetaphorsTable)
      .where(inArray(noteMetaphorsTable.noteId, noteIds)),
    db
      .select()
      .from(noteAcronymsTable)
      .where(inArray(noteAcronymsTable.noteId, noteIds)),
  ]);
  const metaphorsByNoteId = new Map(
    storedMetaphors.map((metaphor) => [metaphor.noteId, metaphor.description]),
  );
  const acronymsByNoteId = new Map(
    storedAcronyms.map((acronym) => [acronym.noteId, acronym.description]),
  );

  return storedNotes
    .sort((left, right) => {
      return right.updatedAt
        .toISOString()
        .localeCompare(left.updatedAt.toISOString());
    })
    .map((note) =>
      toAppNote({
        acronymDescription: acronymsByNoteId.get(note.id) ?? null,
        body: note.body,
        createdAt: note.createdAt,
        id: note.id,
        labelIds: note.labelIds,
        metaphorDescription: metaphorsByNoteId.get(note.id) ?? null,
        title: note.title,
        updatedAt: note.updatedAt,
      }),
    );
}

async function readOwnedNoteRecord(input: {
  db: NotesDatabase<Record<string, unknown>>;
  noteId: string;
  userId: string;
}) {
  const note =
    (
      await input.db
        .select()
        .from(notesTable)
        .where(
          and(
            eq(notesTable.id, input.noteId),
            eq(notesTable.userId, input.userId),
          ),
        )
        .limit(1)
    )[0] ?? null;

  if (note === null) {
    throw new AppNotesError(
      "not_found",
      "The requested note could not be found for this account.",
    );
  }

  return note;
}

export function createNotesService({
  crypto = getDefaultCrypto(),
  db,
  now = () => new Date(),
}: CreateNotesServiceOptions) {
  return {
    async createNote(input: { input: CreateNoteInput; userId: string }) {
      const timestamp = now();
      const noteId = crypto.randomUUID();
      const safeMetaphors = validateMetaphors(input.input.metaphors);
      const safeAcronyms = validateAcronyms(input.input.acronyms);

      await db.transaction(async (tx) => {
        await tx.insert(notesTable).values({
          id: noteId,
          userId: input.userId,
          title: validateTitle(input.input.title),
          body: validateBody(input.input.body),
          labelIds: validateLabelIds(input.input.labelIds),
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        if (safeMetaphors[0] !== undefined) {
          await tx.insert(noteMetaphorsTable).values({
            noteId,
            description: safeMetaphors[0].description,
          });
        }

        if (safeAcronyms[0] !== undefined) {
          await tx.insert(noteAcronymsTable).values({
            noteId,
            description: safeAcronyms[0].description,
          });
        }
      });

      return toAppNote({
        acronymDescription: safeAcronyms[0]?.description ?? null,
        body: validateBody(input.input.body),
        createdAt: timestamp,
        id: noteId,
        labelIds: validateLabelIds(input.input.labelIds),
        metaphorDescription: safeMetaphors[0]?.description ?? null,
        title: validateTitle(input.input.title),
        updatedAt: timestamp,
      });
    },
    async deleteNote(input: { noteId: string; userId: string }) {
      await readOwnedNoteRecord({
        db,
        noteId: input.noteId,
        userId: input.userId,
      });

      await db.delete(notesTable).where(eq(notesTable.id, input.noteId));
    },
    async listNotes(input: { userId: string }) {
      return readOwnedNotes(db, input.userId);
    },
    async updateNote(input: {
      input: UpdateNoteInput & { noteId: string };
      userId: string;
    }) {
      const existingNote = await readOwnedNoteRecord({
        db,
        noteId: input.input.noteId,
        userId: input.userId,
      });
      const timestamp = now();
      const safeTitle = validateTitle(input.input.title);
      const safeBody = validateBody(input.input.body);
      const safeLabelIds = validateLabelIds(input.input.labelIds);
      const safeMetaphors = validateMetaphors(input.input.metaphors);
      const safeAcronyms = validateAcronyms(input.input.acronyms);

      await db.transaction(async (tx) => {
        await tx
          .update(notesTable)
          .set({
            body: safeBody,
            labelIds: safeLabelIds,
            title: safeTitle,
            updatedAt: timestamp,
          })
          .where(eq(notesTable.id, existingNote.id));

        await tx
          .delete(noteMetaphorsTable)
          .where(eq(noteMetaphorsTable.noteId, existingNote.id));
        await tx
          .delete(noteAcronymsTable)
          .where(eq(noteAcronymsTable.noteId, existingNote.id));

        if (safeMetaphors[0] !== undefined) {
          await tx.insert(noteMetaphorsTable).values({
            noteId: existingNote.id,
            description: safeMetaphors[0].description,
          });
        }

        if (safeAcronyms[0] !== undefined) {
          await tx.insert(noteAcronymsTable).values({
            noteId: existingNote.id,
            description: safeAcronyms[0].description,
          });
        }
      });

      return toAppNote({
        acronymDescription: safeAcronyms[0]?.description ?? null,
        body: safeBody,
        createdAt: existingNote.createdAt,
        id: existingNote.id,
        labelIds: safeLabelIds,
        metaphorDescription: safeMetaphors[0]?.description ?? null,
        title: safeTitle,
        updatedAt: timestamp,
      });
    },
  };
}
