# Domain Model: Study Notes

## Status

The naming and direction are resolved by `CONTEXT.md` and ADR 0005:

- Use **Study Note**, not Study Item.
- A Study Note is the durable trained recall target.
- A Note is source material behind one or more Study Notes.
- Labels, Metaphors, Acronyms, Learning State, and Due for Recall attach to Study Notes.

Use this packet to grill the remaining model shape and implementation details. Do not reopen the Study Note direction unless the session explicitly chooses to challenge ADR 0005.

## Central Decision

The blueprint proposed that a Note is source material and a Study Item is the object trained by recall.

Resolved project language:

```text
Note = source explanation or context behind one or more Study Notes
Study Note = trainable prompt and expected answer derived from a Note
Question = prompt inside a RecallSession
SessionResult = completed RecallSession snapshot
Learning State = per-Study Note recall signal
Due for Recall = per-Study Note scheduling state
```

`Review Event` is not currently accepted as a domain term. If scheduling needs a normalized per-attempt table, grill whether that is a technical persistence detail or a new domain concept.

## Proposed Relationships

```text
User
-> Notes
-> Study Notes
-> RecallSessions
-> SessionResults

Note
-> many Study Notes

Study Note
-> one Note
-> many Labels
-> optional Metaphor
-> optional Acronym
-> Learning State
-> optional Due for Recall state

RecallSession
-> many Study Notes
-> many Questions
-> optional SessionResult after at least one attempted Question

Label
-> many Study Notes
-> derived progress through related Study Notes
```

## Candidate Types

These are candidate implementation shapes, not accepted domain terms.

```ts
type StudyNoteType =
  | "question_answer"
  | "definition"
  | "explanation"
  | "application"
  | "comparison"
  | "cloze"
  | "metaphor_prompt"
  | "acronym_prompt";

type StudyNoteScheduleState =
  | "not_recalled_yet"
  | "needs_practice"
  | "scheduled";

type StudyNote = {
  id: string;
  userId: string;
  noteId: string;
  type: StudyNoteType;
  prompt: string;
  expectedAnswer: string;
  referenceFocus?: string;
  scheduleState: StudyNoteScheduleState;
  latestSelfRating?: "forgot" | "hard" | "good" | "easy";
  lastRecalledAt?: Date;
  nextRecallAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};
```

If future scheduling needs richer attempt evidence than `Question` and `SessionResult` provide, grill a separate persistence shape:

```ts
type RecallAttemptEvidence = {
  id: string;
  userId: string;
  studyNoteId: string;
  questionId?: string;
  confidenceBefore?: 1 | 2 | 3 | 4 | 5;
  confidenceAfter?: 1 | 2 | 3 | 4 | 5;
  selfRating: "forgot" | "hard" | "good" | "easy";
  hintsUsed: number;
  responseTimeMs?: number;
  recalledAt: Date;
};
```

## Migration Shape

Recommended migration from the current app:

1. Add or finish Study Note storage.
2. Ensure every saved Note has one default Study Note.
3. Default Study Note prompt can come from the source Note title when a source Note title exists.
4. Default Study Note expected answer comes from the source Note body.
5. Existing recall results remain historical SessionResult snapshots.
6. New RecallSessions target Study Notes while still showing source Note context.
7. Existing Note label assignments may be copied to each Note's default Study Note; because current pilot data is disposable, resetting the database is also acceptable if simpler.

This keeps the migration vertical and avoids forcing Users to split every existing Note immediately.
Resolved for the current pilot: old data may be erased instead of migrated.

## Resolved Baseline

These should not be re-grilled in this packet:

1. Every saved Note has at least one default Study Note.
2. A Study Note cannot exist without exactly one source Note.
3. Users do not create source-only Notes directly.
4. New Study Note creates a new source Note by default.
5. Add Study Note from this source is the explicit path for another Study Note tied to an existing source Note.
6. Editing a source Note does not automatically rewrite existing Study Note prompts or expected answers.
7. Deleting a Study Note does not automatically delete its source Note.
8. Deleting the last Study Note for a source Note requires confirmation to delete both.
9. Metaphors and Acronyms are Study Note-owned memory aids, not standalone workspace destinations.
10. `Question` remains the domain term for a prompt inside a RecallSession.
11. Study Notes remain untyped in v1; prompt shape does not create a stored Study Note type until templates need behavior.
12. A saved Study Note may be incomplete while editing, but it is recallable only when it has a non-empty expected answer.
13. Incomplete Study Notes are not Due for Recall and do not show normal Learning State copy; they show completion-oriented copy such as "Add expected answer".
14. A Study Note with a non-empty expected answer is recallable even if its source Note body is empty.
15. A Study Note cannot be saved without a prompt.
16. A source Note title is optional in v1; the required Study Note prompt is the recall-facing label.
17. An untitled source Note derives its fallback display name live from the oldest created linked Study Note prompt; the empty source title field itself uses neutral copy such as "Untitled source".
18. One Note may support several Study Notes when the source explanation is cohesive and the Study Notes are closely related. Split into separate Notes only when the source context no longer reads as one coherent explanation.

## Decisions To Grill

1. Should Study Note type be explicit, or can prompt shape remain untyped until templates exist?

Resolved answer: Keep Study Notes untyped in v1.

2. Should scheduling fields live directly on Study Note?

Resolved answer: Keep deriving Learning State and Due for Recall from recall evidence for now. Add persisted scheduling fields to Study Notes only when an actual scheduler assigns dates.

3. Does the app need a separate recall-attempt table beyond Questions inside SessionResults?

Resolved answer: No separate recall-attempt table now. Questions inside SessionResults remain the source of recall evidence.

4. Should "Needs practice" be stored, derived, or both?

Resolved answer: Derive "Needs practice" from recall evidence. Persist only a cheap projection later if filtering requires it.

5. How should Metaphors and Acronyms become practice prompts?

Resolved answer: They remain support material only in v1. They are not automatically turned into practice prompts.

6. How much UI should warn about shared source Notes?

Resolved answer: Show clear shared-source context before source Note edits, but do not block normal editing. Confirmation is reserved for destructive actions such as deleting the last Study Note and source Note.

7. Should current code migrate old records or reset pilot data?

Resolved answer: Reset old pilot data. No backfill is required for current environments.

## ADR Status

ADR 0005 already captures the hard-to-reverse decision:

```text
Study Notes as Durable Recall Targets
```
