import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { usersTable } from "../access/session/auth-schema";
import { studyNotesTable } from "../study-notes/study-notes-schema";
import type { RecallSession, SessionResult } from "./recall";

type StoredRecallSession = RecallSession & {
  userId: string;
};

type StoredSessionResult = SessionResult & {
  userId: string;
};

export const activeRecallSessionsTable = pgTable(
  "recall_sessions",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => usersTable.id, {
        onDelete: "cascade",
      }),
    sessionId: text("session_id").notNull().unique(),
    payload: jsonb("payload").$type<StoredRecallSession>().notNull(),
  },
  (table) => [
    index("active_recall_sessions_session_id_idx").on(table.sessionId),
  ],
);

export const sessionResultsTable = pgTable(
  "session_results",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
      }),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    payload: jsonb("payload").$type<StoredSessionResult>().notNull(),
  },
  (table) => [
    index("session_results_user_id_completed_at_idx").on(
      table.userId,
      table.completedAt,
    ),
  ],
);

export const recallSchedulesTable = pgTable(
  "recall_schedules",
  {
    studyNoteId: text("study_note_id")
      .primaryKey()
      .references(() => studyNotesTable.id, {
        onDelete: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
      }),
    nextRecallAt: timestamp("next_recall_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    intervalDays: integer("interval_days").notNull(),
    ease: doublePrecision("ease").notNull(),
    repetitionCount: integer("repetition_count").notNull(),
    lastRecalledAt: timestamp("last_recalled_at", {
      mode: "date",
      withTimezone: true,
    }),
  },
  (table) => [
    index("recall_schedules_user_id_next_recall_at_idx").on(
      table.userId,
      table.nextRecallAt,
    ),
  ],
);

export const recallSchema = {
  activeRecallSessionsTable,
  recallSchedulesTable,
  sessionResultsTable,
};
