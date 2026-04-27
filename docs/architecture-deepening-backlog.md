# Architecture Deepening Backlog

These opportunities came from the architecture review on 2026-04-27.

The chosen first thread is **Recall Selection Mode**. It is not listed as backlog because it is the active design topic: deepen the temporary Note selection behavior used to start a RecallSession.

## 1. Notes Workspace Interaction Module

**Files**

- `src/routes/_protected.notes.tsx`
- `src/features/notes/notes-workspace.tsx`
- `tests/app-shell.test.tsx`

**Problem**

The Notes Workspace route owns too much Implementation: search combobox state, guarded editor transitions, Label sync, Note save/create, focus jumps, and RecallSession start. The current Interface is Shallow because tests must drive a full route and DOM workflow to verify rules that belong to the Notes Workspace.

**Solution**

Deepen the Notes Workspace interaction Module so the route is mostly an Adapter for rendering and URL navigation. Keep Learning Loop rules, Note editing state, and workspace-level transitions behind a smaller Interface.

**Benefits**

This improves Locality for the Learning Loop and gives tests more Leverage by letting them exercise workspace behavior without crossing the full router surface.

## 2. RecallSession Interface

**Files**

- `src/features/recall/recall.ts`
- `src/routes/_protected.notes.recall.tsx`
- `src/routes/_protected.history.tsx`
- `tests/recall.test.ts`

**Problem**

The RecallSession Module has useful Depth around Note snapshots, ownership checks, zero-attempt discard, and SessionResult persistence. Its public Interface still leaks the first RecallMode Implementation through FlashCard-specific names and `labelId` / `labelName`, even though v1 RecallSessions target explicitly selected Notes.

**Solution**

Align the public Interface around RecallSession, RecallMode, Question, and SessionResult language. Keep FlashCard behavior as one Implementation detail behind that Interface.

**Benefits**

This preserves existing Locality while increasing Leverage for future AiAssisted and AiGraded RecallModes. Tests can assert durable RecallSession rules instead of current FlashCard-specific mechanics.

## 3. Label Graph Read Module

**Files**

- `src/features/labels/labels.ts`
- `src/routes/_protected.labels.tsx`
- `tests/labels.test.ts`

**Problem**

Label mutation has useful Depth because ownership, DAG traversal, deletion cleanup, and cycle prevention live in one Module. Label reads are Shallow: callers receive ids and rebuild parent Labels, available parent options, and descendant display names themselves.

**Solution**

Deepen the Label graph read behavior so callers ask for the Label DAG view they need instead of reconstructing it locally.

**Benefits**

This improves Locality for DAG knowledge, reduces route-level graph projection, and gives tests a stronger Interface for Label graph behavior.

## 4. Accessibility Behavior Modules

**Files**

- `docs/adr/0001-wcag2-accessibility.md`
- `src/routes/_protected.notes.tsx`
- `src/routes/_protected.tsx`
- `src/design-system/global.css`

**Problem**

ADR-0001 makes WCAG 2.1 AA a first-class requirement, but interactive accessibility rules live inside route Implementations. Menu, dialog, combobox, focus restore, and splitter behavior are all hand-rolled where they are used.

**Solution**

Deepen design-system behavior Modules for repeated accessible interactions. These Modules should own keyboard behavior, focus movement, and expected ARIA state for common UI patterns.

**Benefits**

This creates a real Seam for accessibility behavior, improves Locality for WCAG rules, and gives tests a clearer Interface for keyboard and focus behavior.
