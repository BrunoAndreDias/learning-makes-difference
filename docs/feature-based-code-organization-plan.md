# Concept-Based Code Organization Plan

## Goal

Keep product code near the domain concept it belongs to. The repo uses `src/modules` as the first ownership level, then concept folders inside a module when a concept is large enough to have its own route, UI, CSS, tests, and behavior.

The folder structure is concept-first rather than layer-first. Domain concepts and subdomains decide where code lives; technical layers such as `domain`, `application`, `infrastructure`, `components`, and `routes` should not become the primary organization scheme.

This follows two design pressures:

- Domain-driven design supplies the names and ownership boundaries.
- _A Philosophy of Software Design_ supplies the module quality bar: each folder should hide implementation details behind a small, stable interface rather than expose a shallow collection of files.

This is an organization rule, not a behavioral rewrite.

## Current Shape

```txt
src/
  modules/
    access/
      public-entry/
      session/
    labels/
      label-management/
    learning-loop/
      focus/
      notes-workspace/
      recall/
      shared/
    workspace-shell/
      app-shell/
  lib/
  design-system/
  styles/
```

## Target Shape

```txt
src/
  modules/
    access/
      public-entry/
      session/
    focus/
    labels/
      label-management/
    notes/
      notes-workspace/
    recall/
    workspace-shell/
      app-shell/
  lib/
  design-system/
  styles/
```

**Learning Loop** remains domain language for the app's core study cycle, but it should not be the folder that contains every study-related subdomain. Notes, Recall, Focus, and Labels are peer subdomains because each has enough UI, behavior, persistence, and terminology to own a stable public interface.

This is a structural promotion, not a domain rewrite. The dependency directions should remain the same as the current `learning-loop/*` structure after the folders move up one level.

There should be no replacement `shared` folder. Code used by more than one subdomain should either stay inside the subdomain that owns the concept and be consumed through a small public interface, or be promoted to a named module when it represents a real concept with stable behavior.

The existing `learning-loop/shared` folder should be dismantled by ownership, not by convenience. Each file should move to the subdomain or module that owns the concept it expresses. If no owner can be named, the code should stay put until the concept is clarified rather than being moved into a vague shared area.

## Study Subdomains

`focus` owns **FocusSession** behavior, Focus Section route code, active focus controls, break overlays, CSS, and colocated tests.

`recall` owns **Recall Section**, **Recall Selection Mode**, **RecallSession**, **Question**, **SessionResult**, recall search/result UI, CSS, and colocated tests.

`notes` owns **Note** behavior. During migration, the current workspace implementation should move to `notes/notes-workspace` so **Notes Workspace** remains the UI/workspace concept inside the broader Notes subdomain.

`labels` owns **Label** graph behavior, the Labels route, and colocated tests.

## Other Product Concepts

`access/session` owns session state, authentication routes, account settings, and colocated tests.

`access/public-entry` owns the public entry layout and index route before a learner enters a session-protected workspace.

`workspace-shell/app-shell` owns root/protected app shell route code, layout behavior, router devtools gating, and colocated tests.

## Principles

- Folder names should use `CONTEXT.md` language where possible.
- Prefer concept folders over technical buckets such as `components`, `domain`, and `routes` inside large product modules.
- Keep tests beside the module they specify.
- Unit tests stay inside the module they specify and may import internals from that module.
- Integration tests live with the workflow focus. A Notes-focused integration test belongs in `notes`; a Recall-focused integration test belongs in `recall`.
- Integration tests that touch other subdomains should consume those subdomains through their public interfaces.
- Keep CSS beside the concept that owns the UI.
- CSS used by multiple subdomains should move to the module that owns the UI concept: workspace layout CSS belongs to `workspace-shell`, while stable visual primitives belong to `design-system`.
- Do not create generic shared CSS files.
- Routes may live inside concept folders when the route is part of that concept.
- Route implementation belongs inside the owning subdomain. `src/routes` should contain only route-tree glue or tests when the router requires it.
- Do not create one-file concept folders. A concept folder should improve locality.
- Keep generic helpers in `src/lib` only when they are not product-specific.
- Do not use `shared` as a holding area for cross-subdomain code. Promote stable shared behavior to a named module with a simple interface.
- Each top-level subdomain may expose an `index.ts` public interface. Cross-subdomain imports should use that interface by default so internals can move without breaking consumers.

## Import Rules

- `workspace-shell` may import public Learning Loop UI exports from `learning-loop/index.ts`.
- `router.tsx` wires app contexts from concept modules.
- `access/public-entry` may import from `access/session` to redirect learners with an active session.
- Product modules that need account or label context should import from `access/session/session` and `labels/label-management/labels`.
- `recall` may import from `notes` and `focus` because RecallSessions target Notes and active focus can observe recall work.
- `notes` may import from `recall` only for starting or reporting RecallSession errors from the Notes Workspace route.
- `focus` should not depend on `notes` or `recall`; FocusSession behavior stays globally available.
- Named cross-subdomain modules must expose simple interfaces and should not import feature internals.
- `router.tsx` may import route entry points directly when TanStack Router wiring requires it.

## When To Split Further

Split a concept only when a smaller domain term has enough behavior to improve locality and leverage.

Good future candidates:

- `recall/session-result` if result history grows beyond current summary/search behavior.
- `notes/note-editor` only if editor state becomes a deep module with its own UI surface.
- `labels/label-graph` if Label DAG reads and writes need a deeper interface.

Avoid folders named `models`, `services`, `utils`, or `helpers`. Those names describe implementation style, not domain ownership.

## Verification Checklist

- `pnpm run typecheck`
- `pnpm run test`
- Route tree test still proves TanStack Router imports module-owned route files.
- No product import points at folders named `components`, `domain`, or `routes` as concept-level buckets.
- No product module imports from `access/domain`, `access/routes`, `labels/domain`, `labels/routes`, or `workspace-shell/routes`.
