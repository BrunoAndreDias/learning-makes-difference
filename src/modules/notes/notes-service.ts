import { and, eq, inArray } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import { labelsTable, noteLabelsTable } from "../labels/labels-schema";
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

type ValidatedNoteInput = {
  acronyms: AppAcronym[];
  body: string;
  labelIds: string[];
  metaphors: AppMetaphor[];
  title: string;
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

async function validateOwnedLabelIds(input: {
  db: NotesDatabase<Record<string, unknown>>;
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
    throw new AppNotesError(
      "invalid_input",
      "Notes can only be assigned to labels owned by this account.",
    );
  }

  return input.labelIds;
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

function validateHooks(
  hooks: readonly { description: string }[],
  label: string,
): { description: string }[] {
  validateHookCount(hooks, label);

  return hooks.map((hook) => {
    const description = hook.description.trim();

    if (description.length === 0) {
      throw new AppNotesError(
        "invalid_input",
        `${label} description is required.`,
      );
    }

    return {
      description,
    };
  });
}

function validateMetaphors(metaphors: AppMetaphor[]): AppMetaphor[] {
  return validateHooks(metaphors, "Metaphor");
}

function validateAcronyms(acronyms: AppAcronym[]): AppAcronym[] {
  return validateHooks(acronyms, "Acronym");
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

function getFirstDescription(hooks: readonly { description: string }[]) {
  return hooks[0]?.description ?? null;
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
  const [storedMetaphors, storedAcronyms, storedNoteLabels] = await Promise.all(
    [
      db
        .select()
        .from(noteMetaphorsTable)
        .where(inArray(noteMetaphorsTable.noteId, noteIds)),
      db
        .select()
        .from(noteAcronymsTable)
        .where(inArray(noteAcronymsTable.noteId, noteIds)),
      db
        .select()
        .from(noteLabelsTable)
        .where(inArray(noteLabelsTable.noteId, noteIds)),
    ],
  );
  const metaphorsByNoteId = new Map(
    storedMetaphors.map((metaphor) => [metaphor.noteId, metaphor.description]),
  );
  const acronymsByNoteId = new Map(
    storedAcronyms.map((acronym) => [acronym.noteId, acronym.description]),
  );
  const labelIdsByNoteId = new Map<string, string[]>();

  for (const noteLabel of storedNoteLabels) {
    const labelIds = labelIdsByNoteId.get(noteLabel.noteId) ?? [];
    labelIds.push(noteLabel.labelId);
    labelIdsByNoteId.set(noteLabel.noteId, labelIds);
  }

  return storedNotes
    .sort((left, right) => {
      return right.updatedAt
        .toISOString()
        .localeCompare(left.updatedAt.toISOString());
    })
    .map((note) =>
      toAppNote({
        labelIds: note.labelIds.filter((labelId) =>
          new Set(labelIdsByNoteId.get(note.id) ?? []).has(labelId),
        ),
        acronymDescription: acronymsByNoteId.get(note.id) ?? null,
        body: note.body,
        createdAt: note.createdAt,
        id: note.id,
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

function validateCreateNoteInput(input: CreateNoteInput): ValidatedNoteInput {
  const safeMetaphors = validateMetaphors(input.metaphors);
  const safeAcronyms = validateAcronyms(input.acronyms);
  const safeTitle = validateTitle(input.title);
  const safeBody = validateBody(input.body);
  const safeLabelIds = validateLabelIds(input.labelIds);

  return {
    acronyms: safeAcronyms,
    body: safeBody,
    labelIds: safeLabelIds,
    metaphors: safeMetaphors,
    title: safeTitle,
  };
}

function validateUpdateNoteInput(input: UpdateNoteInput): ValidatedNoteInput {
  const safeTitle = validateTitle(input.title);
  const safeBody = validateBody(input.body);
  const safeLabelIds = validateLabelIds(input.labelIds);
  const safeMetaphors = validateMetaphors(input.metaphors);
  const safeAcronyms = validateAcronyms(input.acronyms);

  return {
    acronyms: safeAcronyms,
    body: safeBody,
    labelIds: safeLabelIds,
    metaphors: safeMetaphors,
    title: safeTitle,
  };
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
      const safeInput = validateCreateNoteInput(input.input);
      const safeLabelIds = await validateOwnedLabelIds({
        db,
        labelIds: safeInput.labelIds,
        userId: input.userId,
      });

      await db.transaction(async (tx) => {
        await tx.insert(notesTable).values({
          id: noteId,
          userId: input.userId,
          title: safeInput.title,
          body: safeInput.body,
          labelIds: safeLabelIds,
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        if (safeLabelIds.length > 0) {
          await tx.insert(noteLabelsTable).values(
            safeLabelIds.map((labelId) => ({
              labelId,
              noteId,
            })),
          );
        }

        if (safeInput.metaphors[0] !== undefined) {
          await tx.insert(noteMetaphorsTable).values({
            noteId,
            description: safeInput.metaphors[0].description,
          });
        }

        if (safeInput.acronyms[0] !== undefined) {
          await tx.insert(noteAcronymsTable).values({
            noteId,
            description: safeInput.acronyms[0].description,
          });
        }
      });

      return toAppNote({
        acronymDescription: getFirstDescription(safeInput.acronyms),
        body: safeInput.body,
        createdAt: timestamp,
        id: noteId,
        labelIds: safeLabelIds,
        metaphorDescription: getFirstDescription(safeInput.metaphors),
        title: safeInput.title,
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
      const safeInput = validateUpdateNoteInput(input.input);
      const safeLabelIds = await validateOwnedLabelIds({
        db,
        labelIds: safeInput.labelIds,
        userId: input.userId,
      });

      await db.transaction(async (tx) => {
        await tx
          .update(notesTable)
          .set({
            body: safeInput.body,
            labelIds: safeLabelIds,
            title: safeInput.title,
            updatedAt: timestamp,
          })
          .where(eq(notesTable.id, existingNote.id));

        await tx
          .delete(noteLabelsTable)
          .where(eq(noteLabelsTable.noteId, existingNote.id));
        await tx
          .delete(noteMetaphorsTable)
          .where(eq(noteMetaphorsTable.noteId, existingNote.id));
        await tx
          .delete(noteAcronymsTable)
          .where(eq(noteAcronymsTable.noteId, existingNote.id));

        if (safeLabelIds.length > 0) {
          await tx.insert(noteLabelsTable).values(
            safeLabelIds.map((labelId) => ({
              labelId,
              noteId: existingNote.id,
            })),
          );
        }

        if (safeInput.metaphors[0] !== undefined) {
          await tx.insert(noteMetaphorsTable).values({
            noteId: existingNote.id,
            description: safeInput.metaphors[0].description,
          });
        }

        if (safeInput.acronyms[0] !== undefined) {
          await tx.insert(noteAcronymsTable).values({
            noteId: existingNote.id,
            description: safeInput.acronyms[0].description,
          });
        }
      });

      return toAppNote({
        acronymDescription: getFirstDescription(safeInput.acronyms),
        body: safeInput.body,
        createdAt: existingNote.createdAt,
        id: existingNote.id,
        labelIds: safeLabelIds,
        metaphorDescription: getFirstDescription(safeInput.metaphors),
        title: safeInput.title,
        updatedAt: timestamp,
      });
    },
  };
}
