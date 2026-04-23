# Config Decision: Varlock

## Decision

Use **Varlock** for environment configuration instead of a typical plain `.env`-first workflow.

## Why

This project is a good fit for Varlock because v1 is expected to be:

- a TypeScript full-stack app
- server-rendered
- session-based
- PostgreSQL-backed
- deployed as a single app

That means the application will still need environment configuration for things like:

- database connection
- session secrets
- app base URL
- environment name
- logging/runtime flags

Varlock gives a cleaner model than the usual `.env` setup:

- a committed `.env.schema` as the source of truth
- validation at startup
- clearer distinction between secret and non-secret values
- better type-safety and tooling support in TS/JS projects
- less drift than maintaining `.env.example` by hand

## Why This Is A Good Fit Here

This repo is still early. That is exactly when configuration discipline is easiest to establish.

Using Varlock now should help avoid the usual problems:

- missing env vars discovered too late
- `.env.example` going stale
- unclear naming of config values
- accidental leakage of secret values into the repo or tooling

It also fits well with the broader direction already chosen for this project:

- explicit domain language
- explicit v1 scope
- server-managed auth
- PostgreSQL as the system of record

## Recommended Positioning

Varlock should be treated as an **implementation/tooling decision**, not a product feature and not part of the domain model.

That means:

- mention it in architecture and implementation notes
- do not let it affect domain language in `CONTEXT.md`
- do not over-design around it in the PRD

## Suggested V1 Usage

For v1, keep the usage simple:

- define a committed `.env.schema`
- validate env at boot/startup
- use it for server-side config
- avoid building elaborate multi-provider secret workflows too early

Likely initial variables:

- `DATABASE_URL`
- `SESSION_SECRET`
- `APP_URL`
- `APP_ENV`
- `LOG_LEVEL`

## Caveat

Varlock is newer and less standard than the usual dotenv-style workflow.

That is acceptable here, but the adoption rule should be pragmatic:

- if setup is clean and the developer experience feels good, keep it
- if it adds friction disproportionate to the app's needs, fall back quickly to a simpler env approach

## Current Recommendation

Adopt **Varlock** if the chosen stack is either:

- TanStack Start + PostgreSQL + Drizzle
- Next.js + PostgreSQL + Drizzle

In both cases, it should remain a thin configuration layer rather than a major architectural dependency.
