import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { usersTable } from "../access/session/auth-schema";

export const notesTable = pgTable(
  "notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
      }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    labelIds: text("label_ids").array().notNull(),
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
    index("notes_user_id_updated_at_idx").on(table.userId, table.updatedAt),
  ],
);

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
