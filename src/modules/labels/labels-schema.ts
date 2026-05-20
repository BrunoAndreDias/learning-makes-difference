import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { usersTable } from "../access/session/auth-schema";
import { notesTable } from "../notes/notes-schema";
import { studyNotesTable } from "../study-notes/study-notes-schema";

export const labelsTable = pgTable(
  "labels",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
      }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    index("labels_user_id_updated_at_idx").on(table.userId, table.updatedAt),
  ],
);

export const noteLabelsTable = pgTable(
  "note_labels",
  {
    noteId: text("note_id")
      .notNull()
      .references(() => notesTable.id, {
        onDelete: "cascade",
      }),
    labelId: text("label_id")
      .notNull()
      .references(() => labelsTable.id, {
        onDelete: "cascade",
      }),
  },
  (table) => [
    primaryKey({
      columns: [table.noteId, table.labelId],
      name: "note_labels_pk",
    }),
    index("note_labels_label_id_idx").on(table.labelId),
  ],
);

export const studyNoteLabelsTable = pgTable(
  "study_note_labels",
  {
    studyNoteId: text("study_note_id")
      .notNull()
      .references(() => studyNotesTable.id, {
        onDelete: "cascade",
      }),
    labelId: text("label_id")
      .notNull()
      .references(() => labelsTable.id, {
        onDelete: "cascade",
      }),
  },
  (table) => [
    primaryKey({
      columns: [table.studyNoteId, table.labelId],
      name: "study_note_labels_pk",
    }),
    index("study_note_labels_label_id_idx").on(table.labelId),
  ],
);

export const labelsSchema = {
  labelsTable,
  noteLabelsTable,
  studyNoteLabelsTable,
};
