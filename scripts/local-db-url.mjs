const LOCAL_DATABASE_URL =
  "postgres://postgres:postgres@127.0.0.1:55432/learning_makes_difference";

export function resolveDatabaseUrl() {
  return process.env.DATABASE_URL ?? LOCAL_DATABASE_URL;
}
