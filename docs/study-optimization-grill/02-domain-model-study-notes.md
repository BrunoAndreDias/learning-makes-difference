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
Note = source concept or source explanation
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
-> many Metaphors
-> many Acronyms
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
3. Default Study Note prompt comes from the source Note title.
4. Default Study Note expected answer comes from the source Note body.
5. Existing recall results remain historical SessionResult snapshots.
6. New RecallSessions target Study Notes while still showing source Note context.
7. Existing Note label assignments may be copied to each Note's default Study Note; because current pilot data is disposable, resetting the database is also acceptable if simpler.

This keeps the migration vertical and avoids forcing Users to split every existing Note immediately.

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

## Decisions To Grill

1. Should Study Note type be explicit, or can prompt shape remain untyped until templates exist?

Recommended answer: Keep type optional or broad until templates and cloze creation need it.

2. Should scheduling fields live directly on Study Note?

Recommended answer: Store enough scheduling fields on Study Note for fast Recall Today selection, but keep historical recall evidence in Questions, SessionResults, or a separately grilled attempt table.

3. Does the app need a separate recall-attempt table beyond Questions inside SessionResults?

Recommended answer: Only if scheduling, Learning State, or analytics become awkward to compute from SessionResult snapshots.

4. Should "Needs practice" be stored, derived, or both?

Recommended answer: Derive from latest recall evidence for correctness; persist only a cheap projection if filtering requires it.

5. How should Metaphors and Acronyms become practice prompts?

Recommended answer: They remain memory aids by default. The User can create a Study Note that practices a Metaphor or Acronym when that memory aid itself needs recall.

6. How much UI should warn about shared source Notes?

Recommended answer: Show clear shared-source context before source Note edits, but do not block normal editing.

7. Should current code migrate old records or reset pilot data?

Recommended answer: Prefer the simplest safe migration because current pilot data is disposable, but preserve historical SessionResult snapshots if they already exist in a target environment.

## ADR Status

ADR 0005 already captures the hard-to-reverse decision:

```text
Study Notes as Durable Recall Targets
```
