# Stack Decision: TanStack Start vs Next.js

## Purpose

This document compares **TanStack Start** and **Next.js** against the current v1 PRD for **Learning Makes Difference**.

The goal is not to find the objectively best framework in general. The goal is to choose the framework that best fits this product's actual v1 constraints:

- Single deployable full-stack web app
- SSR-capable TypeScript stack
- React frontend
- PostgreSQL as system of record
- Server-managed cookie sessions
- CRUD-heavy product surface
- Label DAG traversal with recursive SQL
- No AI in v1
- Small initial user base

## Recommendation

If you want the shortest path with the lowest framework risk, choose **Next.js**.

If you want the stack that is likely to feel cleaner and more aligned with your preferences as a TypeScript-heavy React developer, choose **TanStack Start**, but accept a bit more ecosystem and documentation risk.

My recommendation for you right now is:

- **Choose TanStack Start** if you value a more explicit, TS-native, less magic-heavy developer experience and are comfortable absorbing some framework immaturity.
- **Choose Next.js** if you want the safer default with more examples, more hosting paths, and fewer unknowns when you get stuck.

If I had to pick one for this project today without further research, I would lean **TanStack Start**, with the caveat that this is a preference-sensitive decision rather than a hard technical necessity.

## Why This Is Not A Huge Technical Gap

For this product, both frameworks can handle the important requirements:

- SSR-capable app shell
- server-side auth/session handling
- form-heavy CRUD flows
- route loaders / server data fetching
- PostgreSQL-backed persistence
- multi-user scoping
- accessible HTML-first UI

That means the decision is mostly about:

- developer ergonomics
- maturity and documentation
- deployment comfort
- how much framework magic you want

Not about whether one can do the job and the other cannot.

## Project Fit Summary

### TanStack Start

Best fit when you want:

- strong TypeScript feel throughout the stack
- explicit data flow
- modern React patterns without too much framework ceremony
- a single-app architecture without immediately buying into the broader Next.js ecosystem

Potential downside:

- smaller ecosystem
- fewer battle-tested examples
- more chance you hit rough edges and need to think for yourself

### Next.js

Best fit when you want:

- the safest mainstream full-stack React choice
- lots of examples, articles, integrations, and deployment guidance
- lower risk when debugging unfamiliar problems
- easier hiring/transferability if others touch the project later

Potential downside:

- more framework-shaped conventions
- more surface area than you need
- some patterns can feel heavier or less explicit than necessary for a CRUD-first app

## Decision Criteria

### 1. Fit For The Actual Product Shape

This app is not a content site, marketing site, or streaming-heavy application.

It is mostly:

- authenticated CRUD
- relational data
- forms
- server-side authorization
- study-session workflows

That favors frameworks that are good at:

- route-based data loading
- mutation handling
- server-side session access
- predictable form flows

Both frameworks qualify.

Slight edge: **TanStack Start**, because the app sounds more like a disciplined internal-tool-style workflow product than a content platform.

### 2. TypeScript Ergonomics

You said you are fluent in TS/JS. That matters.

TanStack Start tends to appeal to developers who want:

- explicit typing
- explicit routing/data patterns
- less hidden framework behavior

Next.js supports TypeScript well, but the experience can feel more ecosystem-driven than type-driven.

Slight edge: **TanStack Start**.

### 3. Auth And Sessions

Your v1 chose:

- server-managed sessions
- secure HTTP-only cookies
- single deployable app

That is a strong fit for both frameworks.

What matters more is whether the session library and server runtime feel straightforward in your chosen hosting setup.

Next.js has a more established set of examples here.

Slight edge: **Next.js**.

### 4. PostgreSQL And Data Access

Your app needs:

- ordinary CRUD
- strong ownership scoping
- explicit SQL for recursive label traversal

This is more about your DB tool than the framework itself.

Both can work well with Drizzle or Prisma, though Drizzle is probably the better fit because you already expect some explicit SQL.

Result: **tie**.

### 5. Routing And Data Loading

This app will likely have flows like:

- `/login`
- `/notes`
- `/notes/:id`
- `/labels`
- `/labels/:id`
- `/recall/start`
- `/recall/:sessionId`
- `/history`
- `/settings`

TanStack Start is attractive here because it keeps routing/data concerns close and relatively explicit.

Next.js is also strong, but depending on how you structure server actions, route handlers, and fetching, it can feel more scattered.

Slight edge: **TanStack Start**.

### 6. Deployment And Operational Risk

Next.js has the advantage if you want:

- easier “industry standard” deployment paths
- broader hosting documentation
- more integration examples

TanStack Start is viable, but the operational path is a bit less default and a bit more chosen.

If you want the lower-risk production path, that matters.

Clear edge: **Next.js**.

### 7. Long-Term Maintainability

For a project like this, maintainability is more about whether the code stays honest than which logo is on the framework.

That said:

- Next.js gives you more ecosystem support over time
- TanStack Start may give you a codebase that feels more intentional and less framework-driven if you keep it disciplined

This is mostly team preference.

Result: **tie with preference bias**.

## Scoring For This PRD

This is intentionally subjective, but grounded in your current constraints.

| Criterion | TanStack Start | Next.js |
|---|---:|---:|
| Product fit for CRUD + sessions | 9/10 | 8/10 |
| TypeScript ergonomics | 9/10 | 8/10 |
| Auth/session maturity | 7/10 | 9/10 |
| PostgreSQL / DB fit | 8/10 | 8/10 |
| Routing/data loading clarity | 9/10 | 8/10 |
| Deployment/documentation safety | 7/10 | 10/10 |
| Overall fit for you | 9/10 | 8/10 |

## Recommended Pairings

### If You Choose TanStack Start

Recommended stack:

- TanStack Start
- React
- TypeScript
- PostgreSQL
- Drizzle ORM
- explicit SQL for recursive label traversal
- cookie-based server sessions

Why:

- matches the explicit TS-first direction
- Drizzle fits the hybrid ORM + SQL approach better than Prisma
- keeps the stack relatively lean and understandable

### If You Choose Next.js

Recommended stack:

- Next.js
- React
- TypeScript
- PostgreSQL
- Drizzle ORM
- explicit SQL for recursive label traversal
- cookie-based server sessions

Why:

- still keeps the data layer pragmatic
- avoids over-abstracting recursive queries
- lets the framework choice stay mainstream while the DB layer stays honest

## What I Would Avoid

Regardless of framework, I would avoid:

- choosing Prisma if you already expect important explicit SQL and want tight control over queries
- introducing a separate API service in v1
- using JWT auth for this app
- optimizing for AI features before the flashcard loop is validated
- choosing based on trendiness instead of the shape of your actual product

## Suggested Decision Rule

Choose **TanStack Start** if these statements feel true:

- I want one TS-first app with minimal conceptual overhead.
- I am comfortable solving some problems without huge ecosystem support.
- I care more about framework feel than mainstream safety.

Choose **Next.js** if these statements feel true:

- I want the most documented and least risky path.
- I want easier answers when I hit deployment or auth friction.
- I would rather accept some framework weight than framework uncertainty.

## My Final Recommendation

For **Learning Makes Difference**, I would personally choose:

**TanStack Start + PostgreSQL + Drizzle**

Why:

- it matches the product shape
- it matches your language preference
- it avoids splitting the app artificially
- it fits a CRUD-heavy, session-heavy, server-aware app well
- it leaves room to add AI later without having to redesign the core

The honest caveat is simple:

If, after reading docs and trying a tiny spike, TanStack Start feels rough or under-documented for auth/session flows, switch to **Next.js** quickly and without regret. That would be a pragmatic downgrade in novelty, not a technical failure.

## Suggested Next Step

Before fully committing, build a tiny spike in the chosen framework with only these four things:

1. Login page with cookie session
2. Authenticated Notes list page
3. PostgreSQL-backed Note create form
4. One recursive SQL query for Label descendants

If that spike feels clean, the framework is good enough for this project.
