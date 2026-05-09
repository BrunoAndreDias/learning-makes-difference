import { and, eq, inArray } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import { labelsTable, studyNoteLabelsTable } from "../labels/labels-schema";
import { notesTable } from "../notes/notes-schema";
import {
  type AppStudyNote,
  AppStudyNotesError,
  type CreateStudyNoteInput,
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

function toAppStudyNote(input: {
  createdAt: Date;
  expectedAnswer: string;
  id: string;
  labelIds: string[];
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
    labelIds: [...input.labelIds],
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

async function toAppStudyNotes(input: {
  db: StudyNotesDatabase<Record<string, unknown>>;
  rows: StudyNoteRow[];
}) {
  if (input.rows.length === 0) {
    return [];
  }

  const studyNoteIds = input.rows.map((row) => row.id);
  const storedStudyNoteLabels = await input.db
    .select()
    .from(studyNoteLabelsTable)
    .where(inArray(studyNoteLabelsTable.studyNoteId, studyNoteIds));
  const labelIdsByStudyNoteId = groupLabelIdsByStudyNoteId(
    storedStudyNoteLabels,
  );

  return input.rows.map((row) =>
    toAppStudyNote({
      ...row,
      labelIds: getSortedStudyNoteLabelIds({
        labelIdsByStudyNoteId,
        studyNoteId: row.id,
      }),
    }),
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

  return row satisfies StudyNoteRow;
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
      const safeLabelIds = await validateOwnedLabelIds({
        db,
        labelIds: normalizeLabelIds(input.labelIds),
        userId,
      });

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
        if (safeLabelIds.length > 0) {
          await tx
            .insert(studyNoteLabelsTable)
            .values(createStudyNoteLabelRows(studyNoteId, safeLabelIds));
        }
      });

      return toAppStudyNote({
        createdAt: timestamp,
        expectedAnswer: sourceBody,
        id: studyNoteId,
        labelIds: safeLabelIds,
        prompt: sourceTitle,
        sourceBody,
        sourceNoteId,
        sourceTitle,
        sourceUpdatedAt: timestamp,
        updatedAt: timestamp,
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
      const prompt = validateRequiredText(input.prompt, "Prompt");
      const expectedAnswer = validateOptionalText(input.expectedAnswer);
      const sourceTitle = validateRequiredText(
        input.sourceTitle,
        "Source title",
      );
      const sourceBody = validateOptionalText(input.sourceBody);
      const safeLabelIds = await validateOwnedLabelIds({
        db,
        labelIds: normalizeLabelIds(input.labelIds),
        userId,
      });

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
          .delete(studyNoteLabelsTable)
          .where(eq(studyNoteLabelsTable.studyNoteId, existingStudyNote.id));
        if (safeLabelIds.length > 0) {
          await tx
            .insert(studyNoteLabelsTable)
            .values(
              createStudyNoteLabelRows(existingStudyNote.id, safeLabelIds),
            );
        }
      });

      return toAppStudyNote({
        createdAt: existingStudyNote.createdAt,
        expectedAnswer,
        id: existingStudyNote.id,
        labelIds: safeLabelIds,
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
