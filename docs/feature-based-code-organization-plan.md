# Concept-Based Code Organization Plan

## Goal

Keep product code near the domain concept it belongs to. The repo uses `src/modules` as the first ownership level, then concept folders inside a module when a concept is large enough to have its own route, UI, CSS, tests, and behavior.

This is an organization rule, not a behavioral rewrite.

## Current Shape

```txt
src/
  modules/
    access/
      domain/
      routes/
    labels/
      domain/
      routes/
    learning-loop/
      focus/
      notes-workspace/
      recall/
      shared/
    workspace-shell/
      routes/
  lib/
  design-system/
  styles/
```

## Learning Loop Concepts

`learning-loop/focus` owns **FocusSession** behavior, Focus Section route code, active focus controls, break overlays, CSS, and colocated tests.

`learning-loop/recall` owns **Recall Section**, **Recall Selection Mode**, **RecallSession**, **Question**, **SessionResult**, recall search/result UI, CSS, and colocated tests.

`learning-loop/notes-workspace` owns the **Notes Workspace**, **Note** editing, Note search/navigation, workspace interaction state, sidebar UI, CSS, and colocated tests.

`learning-loop/shared` owns Learning Loop helpers that are used by multiple Learning Loop concepts and are not stable enough to become their own concept folder.

## Principles

- Folder names should use `CONTEXT.md` language where possible.
- Prefer concept folders over technical buckets such as `components`, `domain`, and `routes` inside large product modules.
- Keep tests beside the module they specify.
- Keep CSS beside the concept that owns the UI, except shared workspace CSS used by multiple Learning Loop concepts.
- Routes may live inside concept folders when the route is part of that concept.
- Do not create one-file concept folders. A concept folder should improve locality.
- Keep generic helpers in `src/lib` only when they are not product-specific.

## Import Rules

- `workspace-shell` may import public Learning Loop UI exports from `learning-loop/index.ts`.
- `router.tsx` wires app contexts from concept modules.
- `recall` may import from `notes-workspace` and `focus` because RecallSessions target Notes and active focus can observe recall work.
- `notes-workspace` may import from `recall` only for starting or reporting RecallSession errors from the Notes Workspace route.
- `focus` should not depend on `notes-workspace` or `recall`; FocusSession behavior stays globally available.
- Shared Learning Loop modules must not import concept modules.

## When To Split Further

Split a concept only when a smaller domain term has enough behavior to improve locality and leverage.

Good future candidates:

- `recall/session-result` if result history grows beyond current summary/search behavior.
- `notes-workspace/note-editor` only if editor state becomes a deep module with its own UI surface.
- `labels/label-graph` if Label DAG reads and writes need a deeper interface.

Avoid folders named `models`, `services`, `utils`, or `helpers`. Those names describe implementation style, not domain ownership.

## Verification Checklist

- `pnpm run typecheck`
- `pnpm run test`
- Route tree test still proves TanStack Router imports module-owned route files.
- No Learning Loop import points at `learning-loop/components`, `learning-loop/domain`, or `learning-loop/routes`.
