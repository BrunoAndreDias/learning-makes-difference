import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const notesTable = pgTable("notes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  labelIds: text("label_ids").array().notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
  }).notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  }).notNull(),
});

export const noteMetaphorsTable = pgTable("note_metaphors", {
  noteId: text("note_id")
    .primaryKey()
    .references(() => notesTable.id, {
      onDelete: "cascade",
    }),
  description: text("description").notNull(),
});

export const noteAcronymsTable = pgTable("note_acronyms", {
  noteId: text("note_id")
    .primaryKey()
    .references(() => notesTable.id, {
      onDelete: "cascade",
    }),
  description: text("description").notNull(),
});

export const notesSchema = {
  noteAcronymsTable,
  noteMetaphorsTable,
  notesTable,
};
