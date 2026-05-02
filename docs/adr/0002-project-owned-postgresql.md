# Project-Owned PostgreSQL

The app uses PostgreSQL as the canonical store for authenticated study data, and local development provisions PostgreSQL through a repo-level `compose.yaml`. This keeps pilot verification repeatable for maintainers and avoids relying on undeclared machine-global database setup; browser storage may still hold transient UI state, but not Persistent Study Data.

Database access uses Drizzle with explicit SQL migrations. This gives the TypeScript app typed database access while keeping the migration history inspectable and repeatable without adopting a heavier generated-client workflow.

Pilot participants only receive a hosted app URL. Hosted deployment must provision/configure PostgreSQL and run migrations in a controlled deploy step before participants use the app, rather than requiring participant setup or running migrations as part of ordinary request handling.
