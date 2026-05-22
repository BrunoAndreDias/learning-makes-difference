import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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

export const studyNoteMetaphorsTable = pgTable("study_note_metaphors", {
  studyNoteId: text("study_note_id")
    .primaryKey()
    .references(() => studyNotesTable.id, {
      onDelete: "cascade",
    }),
  description: text("description").notNull(),
});

export const studyNoteAcronymsTable = pgTable("study_note_acronyms", {
  studyNoteId: text("study_note_id")
    .primaryKey()
    .references(() => studyNotesTable.id, {
      onDelete: "cascade",
    }),
  description: text("description").notNull(),
});

export const studyNoteKeyIdeasTable = pgTable(
  "study_note_key_ideas",
  {
    id: text("id").primaryKey(),
    studyNoteId: text("study_note_id")
      .notNull()
      .references(() => studyNotesTable.id, {
        onDelete: "cascade",
      }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    importance: text("importance").notNull(),
    acceptedPhrases: text("accepted_phrases").array().notNull(),
    prohibitedPhrases: text("prohibited_phrases").array().notNull(),
  },
  (table) => [
    index("study_note_key_ideas_study_note_id_position_idx").on(
      table.studyNoteId,
      table.position,
    ),
  ],
);

export const studyNoteAcceptedVariantsTable = pgTable(
  "study_note_accepted_variants",
  {
    id: text("id").primaryKey(),
    studyNoteId: text("study_note_id")
      .notNull()
      .references(() => studyNotesTable.id, {
        onDelete: "cascade",
      }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (table) => [
    index("study_note_accepted_variants_study_note_id_position_idx").on(
      table.studyNoteId,
      table.position,
    ),
  ],
);

export const studyNoteProhibitedPhrasesTable = pgTable(
  "study_note_prohibited_phrases",
  {
    id: text("id").primaryKey(),
    studyNoteId: text("study_note_id")
      .notNull()
      .references(() => studyNotesTable.id, {
        onDelete: "cascade",
      }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (table) => [
    index("study_note_prohibited_phrases_study_note_id_position_idx").on(
      table.studyNoteId,
      table.position,
    ),
  ],
);

export const studyNotesSchema = {
  studyNoteAcceptedVariantsTable,
  studyNoteAcronymsTable,
  studyNoteKeyIdeasTable,
  studyNoteMetaphorsTable,
  studyNoteProhibitedPhrasesTable,
  studyNotesTable,
};
