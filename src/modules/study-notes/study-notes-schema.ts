import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { notesTable } from "../notes/notes-schema";

export const studyNotesTable = pgTable(
  "study_notes",
  {
    id: text("id").primaryKey(),
    sourceNoteId: text("source_note_id")
      .notNull()
      .references(() => notesTable.id, {
        onDelete: "cascade",
      }),
    prompt: text("prompt").notNull(),
    expectedAnswer: text("expected_answer").notNull(),
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
    index("study_notes_source_note_id_updated_at_idx").on(
      table.sourceNoteId,
      table.updatedAt,
    ),
  ],
);

export const studyNotesSchema = {
  studyNotesTable,
};
