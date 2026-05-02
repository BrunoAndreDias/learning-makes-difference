import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { usersTable } from "../access/session/auth-schema";
import type { FocusRecord, FocusSession, FocusTarget } from "./focus";

type StoredFocusSession = Omit<
  FocusSession,
  "isStale" | "remainingSeconds" | "stateEndsAt"
> & {
  focusTargets: FocusTarget[];
  targets: FocusTarget[];
  userId: string;
};

type StoredFocusRecord = FocusRecord & {
  focusTargets: FocusTarget[];
  intervals: FocusRecord["intervals"][number][];
  targets: FocusTarget[];
  userId: string;
};

export const activeFocusSessionsTable = pgTable(
  "focus_sessions",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => usersTable.id, {
        onDelete: "cascade",
      }),
    sessionId: text("session_id").notNull().unique(),
    payload: jsonb("payload").$type<StoredFocusSession>().notNull(),
  },
  (table) => [index("focus_sessions_session_id_idx").on(table.sessionId)],
);

export const focusRecordsTable = pgTable(
  "focus_records",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
      }),
    endedAt: timestamp("ended_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    payload: jsonb("payload").$type<StoredFocusRecord>().notNull(),
  },
  (table) => [
    index("focus_records_user_id_ended_at_idx").on(table.userId, table.endedAt),
  ],
);

export const focusSchema = {
  activeFocusSessionsTable,
  focusRecordsTable,
};
