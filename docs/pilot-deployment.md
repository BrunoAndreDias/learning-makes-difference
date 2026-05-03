# Hosted Pilot Deployment

## Pilot participant instructions

Pilot participants only receive the hosted URL. They open the hosted URL, register with the shared pilot code, and sign in. They do not run local setup, Docker, migrations, or database commands.

## Maintainer deployment contract

Hosted deployment requires these environment variables:

- `DATABASE_URL`
- `SESSION_SECRET`
- `PILOT_REGISTRATION_CODE`

Before pilot participants use the app, the deployment workflow must run migrations in a controlled deploy step against the hosted PostgreSQL database referenced by `DATABASE_URL`. Do not run migrations during ordinary request handling.

## Local maintainer setup

Maintainers use the project-owned PostgreSQL database from `compose.yaml` for local verification. The standard commands are:

- `docker compose up -d postgres`
- `pnpm db:setup`
- `pnpm db:migrate`
- `pnpm db:reset`
- `npm run db:setup`
- `npm run db:migrate`
- `npm run db:reset`

The hosted pilot database and the local maintainer database should both start clean. Test Participant study data is empty by default.

## Same-Wi-Fi fallback

Hosted deployment is the primary pilot path. The same-Wi-Fi local URL is fallback-only for maintainer troubleshooting when the hosted deployment is temporarily unavailable.

## #103 verification checklist

1. Register a new pilot account from the hosted URL with the shared `PILOT_REGISTRATION_CODE`.
2. Sign in with that new account.
3. In Notes, create a Note.
4. In Labels, create a Label.
5. Attach the Label to the Note.
6. Start a RecallSession from the saved Note.
7. Attempt at least one question and finish the session so the app will create a SessionResult.
8. Sign out.
9. Sign back in.
10. Confirm the persisted Note, Label, Note-to-Label assignment, active-auth state, and SessionResult are still present for the same User.
11. While signed in, simulate the case where the server or database is unavailable during an authenticated study write such as creating a Note, editing a Note, creating a Label, or finishing a RecallSession.
12. Confirm the authenticated study write will fail clearly, the UI does not present a false saved state, and the User can retry successfully after service is restored.
