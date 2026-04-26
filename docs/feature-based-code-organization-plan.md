# Feature-Based Code Organization Plan

## Goal

Move product-specific modules from a broad `src/lib` folder into feature folders that match the project's domain language. The immediate target is better locality for **Notes**, with a path for **Labels**, **RecallSessions**, and **User** session code later.

This is a code organization change, not a behavioural rewrite. The migration should preserve current routes, tests, and user flows.

## Why Feature-Based Organization

The current `src/lib` shape groups code by technical convenience. That is acceptable early, but it becomes harder to navigate as product concepts deepen. A feature folder should make the first question obvious: "where does Note behaviour live?"

This approach helps both human and agent navigation because the file tree follows the domain map:

- **Note** editing, persistence, search, and search navigation live together.
- **Label** ownership and graph rules live together.
- **RecallSession** progression and history live together.
- **User** session state has an explicit home instead of being another generic library file.

This is not full DDD layering. Do not add `domain`, `application`, `infrastructure`, `entities`, or `use-cases` folders yet. Those layers add value only when a feature has multiple workflows, adapters, or persistence seams that need independent evolution.

## Recommended Shape

```txt
src/
  features/
    notes/
      notes.ts
      note-editor.ts
      note-editor.test.ts
      note-search.ts
      note-search-navigation.ts
    labels/
      labels.ts
    recall/
      recall.ts
    session/
      session.ts
  lib/
    env.ts
  routes/
  design-system/
  styles/
```

Use feature folders for product concepts. Do not introduce `domain`, `application`, or `infrastructure` layers yet. The app is not large enough to justify that extra navigation cost.

## Target Boundaries

The boundary is the product concept, not the UI route.

- `features/notes` owns **Note** persistence helpers, Note editor state, Note search, and Note search navigation.
- `features/labels` owns **Label** persistence helpers and Label relationship rules.
- `features/recall` owns **RecallSession**, recallable Note selection, submitted recall answers, and recall history.
- `features/session` owns **User** session state and authenticated User preferences.
- `routes` own URL structure, loader/action wiring, form rendering, focus management, and navigation side effects.
- `design-system` owns reusable visual primitives.
- `styles` owns global styling and generated CSS entry points.
- `lib` should shrink to generic code only, such as `env.ts`.

If a module cannot be explained with one product concept, keep it outside `features` until its boundary is clearer.

## Principles

- Keep modules near the product concept they describe: **Note** code under `features/notes`, **Label** code under `features/labels`, **RecallSession** code under `features/recall`.
- Keep generic shared modules outside feature folders. A future generic storage adapter should live somewhere like `src/shared/storage`, not under `features/notes`.
- Move files first, then deepen modules. Avoid combining folder migration with behaviour changes unless a test demands it.
- Preserve the current TanStack route file layout. Routes remain in `src/routes`; they import feature modules.
- Prefer direct imports from feature modules until there is enough churn to justify feature-level barrel files.
- Keep tests beside the module they specify when the test describes feature behaviour.
- Rename modules during the move only when the new name improves domain clarity, such as `notes-search.ts` becoming `note-search.ts`.

## Import Rules

Allowed:

- `routes/*` may import from `features/*`, `design-system`, `styles`, and generic `lib` or `shared` modules.
- `features/recall/*` may import from `features/notes/*` and `features/labels/*` because a **RecallSession** is built from **Notes** and **Labels**.
- `features/notes/*` may import from `features/labels/*` only for real Label relationships on a Note.
- Feature modules may import generic helpers from `lib` or a future `shared` folder.

Avoid:

- Feature modules importing route files.
- Feature modules importing UI components from route files.
- Cross-feature imports that exist only to reuse a helper with no domain relationship.
- Barrel files by default. Add an `index.ts` only if import churn becomes a real problem.

## Migration Strategy

Use small vertical phases. Each phase should be reviewable as a file move plus import update, with no intended runtime behaviour change.

For each phase:

1. Create the target feature folder.
2. Move the module and colocated tests.
3. Update imports.
4. Run the verification checklist.
5. Commit or review the phase before moving to the next one.

## Phase 1: Move the Note Feature

Move the files currently related to **Notes**:

```txt
src/lib/notes.ts -> src/features/notes/notes.ts
src/lib/note-editor.ts -> src/features/notes/note-editor.ts
src/lib/note-editor.test.ts -> src/features/notes/note-editor.test.ts
src/lib/notes-search.ts -> src/features/notes/note-search.ts
src/lib/notes-search-navigation.ts -> src/features/notes/note-search-navigation.ts
```

Update imports in:

```txt
src/routes/_protected.notes.tsx
src/routes/_protected.recall.tsx
src/routes/__root.tsx
src/router.tsx
src/lib/recall.ts
```

Expected outcome:

- Note editing, persistence, search, and search navigation live under one folder.
- The Notes route becomes easier to scan because all Note-specific imports point to `features/notes`.
- Existing tests, typecheck, lint, and build still pass.

Acceptance criteria:

- `src/routes/_protected.notes.tsx` imports Note-specific behaviour from `src/features/notes`.
- `src/lib` no longer contains Note-specific modules.
- Existing Note editor tests continue to cover dirty-state detection, guarded transitions, save input generation, and saved-state marking.
- No route file is imported by a feature module.

## Phase 2: Move Labels

Move:

```txt
src/lib/labels.ts -> src/features/labels/labels.ts
```

Update imports in:

```txt
src/routes/_protected.labels.tsx
src/routes/_protected.notes.tsx
src/routes/_protected.recall.tsx
src/routes/_protected.history.tsx
src/routes/__root.tsx
src/router.tsx
src/features/notes/notes.ts
src/lib/recall.ts or src/features/recall/recall.ts if Phase 3 is already done
```

Expected outcome:

- **Label** graph and ownership rules are isolated from generic `lib`.
- Later extraction of a deeper Label graph module has a clear home.

Acceptance criteria:

- `src/lib` no longer contains Label-specific modules.
- Notes and Recall import Label behaviour from `features/labels` only where the domain relationship is explicit.
- Label route behaviour remains unchanged.

## Phase 3: Move Recall

Move:

```txt
src/lib/recall.ts -> src/features/recall/recall.ts
```

Update imports in:

```txt
src/routes/_protected.recall.tsx
src/routes/_protected.history.tsx
src/routes/__root.tsx
src/router.tsx
```

Expected outcome:

- **RecallSession** lifecycle, recallable Note resolution, and SessionResult code sit together.
- Future `AiAssisted` and `AiGraded` work has a single feature folder to grow in.

Acceptance criteria:

- Recall route and history route import RecallSession behaviour from `features/recall`.
- Recall may depend on Notes and Labels, but Notes and Labels do not depend on Recall.
- Existing recall tests and route flows remain unchanged.

## Phase 4: Move Session

Move:

```txt
src/lib/session.ts -> src/features/session/session.ts
```

Update imports in:

```txt
src/routes/_auth.login.tsx
src/routes/_auth.register.tsx
src/routes/_protected.tsx
src/routes/_protected.notes.tsx
src/routes/_protected.recall.tsx
src/routes/_protected.labels.tsx
src/routes/_protected.history.tsx
src/routes/_protected.settings.tsx
src/routes/_public.index.tsx
src/routes/__root.tsx
src/router.tsx
```

Expected outcome:

- **User** session and preference logic has an explicit feature home.
- Authenticated routes no longer depend on broad `lib/session` naming.

Acceptance criteria:

- Auth and protected routes import User session behaviour from `features/session`.
- Session code remains product-specific. Generic auth or storage helpers should not be hidden under `features/session` unless they are only meaningful for the User session feature.

## Phase 5: Evaluate What Remains in `src/lib`

After the feature moves, review remaining `src/lib` files.

Options:

- Delete `src/lib` if it is empty.
- Keep `src/lib/env.ts` if it remains the only generic helper.
- Rename generic shared code to `src/shared` only when there are at least two generic modules that need a home.

Do not create `src/shared` just to hold one file.

## When to Deepen Further

After the move, deepen a feature only when there is pressure from behaviour, tests, or readability.

Examples:

- Split `features/notes/note-repository.ts` only if Note persistence starts hiding meaningful storage rules or account-scoped behaviour.
- Split `features/labels/label-graph.ts` only if Label relationship rules become more than simple persistence helpers.
- Split `features/recall/recall-session.ts` only if RecallSession progression becomes distinct from history and result persistence.

Avoid adding folders like `models`, `services`, or `utils`. Those names describe implementation style, not the domain boundary.

## Verification Checklist

Run after each phase:

```bash
rtk pnpm run lint
rtk pnpm run typecheck
rtk pnpm run test
rtk pnpm run build
```

Also manually inspect the import graph for accidental cross-feature leakage:

- Routes may import from features.
- Features may import from other features only when the domain relationship is real, such as **RecallSession** depending on **Notes** and **Labels**.
- Feature modules should not import route modules.

## Risks

- Import churn can obscure real behaviour changes. Keep the first pass to moves and import updates only.
- Over-layering would make the code harder to navigate. Avoid DDD-style layers until there are multiple adapters or workflows inside a feature.
- Feature modules can become grab bags too. If `features/notes` grows, split by deeper modules such as `note-editor`, `note-search`, and `note-repository` rather than adding generic folders.

## Recommended First Implementation

Start with Phase 1 only. It aligns with the current Note editor extraction and gives immediate locality benefits without touching every feature in the app.

Recommended first implementation order:

1. Move `notes.ts`, `note-editor.ts`, and `note-editor.test.ts`.
2. Move and rename search modules from `notes-search*` to `note-search*`.
3. Update route and recall imports.
4. Run the verification checklist.
5. Review the import graph before starting Phase 2.
