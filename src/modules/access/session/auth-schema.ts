import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import {
  defaultUserTimeZone,
  userLanguagePreferences,
} from "./session-contract";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  userLanguage: text("user_language", {
    enum: userLanguagePreferences,
  }).notNull(),
  userTimeZone: text("user_time_zone").notNull().default(defaultUserTimeZone),
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
});

export const authSessionsTable = pgTable("auth_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
  expiresAt: timestamp("expires_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
});

export const authSchema = {
  authSessionsTable,
  usersTable,
};
