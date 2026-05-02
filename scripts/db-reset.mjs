import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required to reset the DB.");
}

const sql = postgres(DATABASE_URL, {
  max: 1,
  prepare: false,
});

try {
  await sql.unsafe(`
    drop table if exists auth_sessions;
    drop table if exists users;
    drop table if exists __drizzle_migrations;
  `);
  console.log("Dropped auth/session tables and migration history.");
} finally {
  await sql.end();
}
