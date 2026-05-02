# Learning Makes Difference

TanStack Start application skeleton for the Learning Makes Difference product.

## Scripts

- `npm run dev` starts the SSR development server through Varlock.
- `npm run build` creates the production build in `.output/`.
- `npm run start` runs the built server.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm run test` runs the Vitest suite.
- `npm run lint` checks formatting and lint rules with Biome.
- `npm run format` applies Biome formatting fixes.

## Environment

Environment configuration is schema-driven via [`.env.schema`](./.env.schema). This is the committed source of truth for required runtime variables:

- `APP_ENV`
- `APP_URL`
- `DATABASE_URL`
- `PILOT_REGISTRATION_CODE`
- `SESSION_SECRET`
- `LOG_LEVEL`

Defaults are development-safe placeholders so the skeleton boots locally. Override them in a local `.env` file or your deployment secret manager as implementation work continues.

## Local development

1. Install dependencies with `pnpm install`.
2. Run `npm run dev`.
3. Open `http://localhost:3000`.

## PostgreSQL integration tests

DB integration tests run separately from the fast Vitest suite and require a real PostgreSQL server.

1. Start the repo-owned database: `docker compose up -d postgres`
2. Run the DB suite: `npm run test:db`
3. Reset the local DB if needed: `npm run db:reset`

`npm run test:db` uses `DATABASE_URL` when it is set. If not, it defaults to `postgres://postgres:postgres@127.0.0.1:55432/learning_makes_difference`, which matches [`compose.yaml`](./compose.yaml).

CI runs `npm run test` in the fast job and `npm run test:db` in a separate job with a PostgreSQL service.
