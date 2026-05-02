import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { usersTable } from "../access/session/auth-schema";
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

export const recallSchema = {
  activeRecallSessionsTable,
  sessionResultsTable,
};
