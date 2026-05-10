# Recall Scheduler And Session Builder

## Current CONTEXT.md Baseline

- RecallSessions target explicitly selected Study Notes.
- The selected set is temporary and is not a saved deck, collection, or Label.
- Study Notes are presented in random order inside a RecallSession.
- A RecallSession snapshots target Study Notes, source Note references, and generated Questions when it starts.
- Answer reveal shows the Study Note expected answer first and the source Note second.
- FlashCard self-rating uses `forgot`, `hard`, `good`, and `easy`.
- Learning State is a per-Study Note signal based on latest recall score and recency.
- Low-performing user-facing copy is "Needs practice", not "Weak".
- Due for Recall is the domain term; "Recall Today" is user-facing copy for due Study Notes.

## Recall Session Flow

Recommended flow to grill:

```text
Show Study Note prompt
-> optionally ask confidence before answer
-> user answers or mentally answers
-> optional hint ladder
-> reveal Study Note expected answer and source Note
-> user self-rates or AI grades performance
-> store Question and SessionResult evidence
-> update Learning State
-> schedule next recall
```

Current app similarity:

- FlashCard recall already hides the reference material.
- The User already self-rates with Forgot, Hard, Good, Easy.
- SessionResults already preserve historical Questions and snapshots.

Missing pieces:

- next recall date
- deterministic scheduler
- confidence before answer
- hint usage
- Needs practice derivation
- automatic Recall Today builder
- optional attempt evidence separate from SessionResult snapshots

## Grade Language

Blueprint uses:

```text
Missed, Hard, Good, Easy
```

Current app uses:

```text
Forgot, Hard, Good, Easy
```

Recommended answer:

Keep `forgot`, `hard`, `good`, and `easy` in code and user-facing copy. "Forgot" is already established and less harsh than "Missed".

## Simple Scheduler

Candidate MVP rule:

```text
Forgot -> 1 day
Hard   -> current interval * 1.3, minimum 1 day
Good   -> current interval * 2.2, minimum 3 days
Easy   -> current interval * 3.0, minimum 7 days
```

Candidate fields:

```ts
type SchedulableStudyNote = {
  intervalDays: number;
  successStreak: number;
  lapses: number;
  lastRecalledAt?: Date;
  nextRecallAt?: Date;
};
```

## Needs Practice Rule

Candidate MVP rule:

```ts
function needsPractice(input: {
  selfRating: "forgot" | "hard" | "good" | "easy";
  confidenceBefore?: number;
  hintsUsed: number;
  lapses: number;
}) {
  return (
    input.selfRating === "forgot" ||
    input.confidenceBefore === 1 ||
    input.confidenceBefore === 2 ||
    input.hintsUsed > 0 ||
    input.lapses >= 2
  );
}
```

"Needs practice" is user-facing copy. Internal names can be grilled, but should not leak "Weak" into v1 UI.

## Hint Ladder

Recommended ladder:

```text
0. no help
1. small hint
2. acronym
3. metaphor
4. partial answer
5. source Note
```

The app should store how far the User went through the ladder.

Recommended first implementation:

- track only `hintsUsed`
- add richer hint content later
- reveal source Note as the final help level

## Session Builder

Candidate session modes:

- Recall Today
- Needs Practice
- Label Focus
- Mixed Recall
- Exam Support

Candidate Recall Today mix:

```text
50% Study Notes Due for Recall
25% Needs practice Study Notes
15% recent Study Notes
10% interleaved Study Notes
```

Recommended first implementation:

```text
Recall Today = Study Notes Due for Recall sorted by nextRecallAt, then Needs practice priority
Needs Practice = low-performing Study Notes sorted by most recent lapse or low confidence
Manual selection = preserve current user-selected flow
```

## Baseline Decisions Not To Reopen

1. Scheduling belongs at Study Note level, not Note level.
2. Due scheduling is separate from Learning State.
3. "Review Today" is not the accepted term.
4. A skipped Study Note is not learning evidence unless the User explicitly marks it Forgot.
5. A RecallSession may mix sibling Study Notes from the same source Note, but the session builder should avoid placing them too close together if repetition hurts recall.

## Decisions To Grill

1. Should the first scheduler be deterministic or use an existing algorithm such as SM-2?

Recommended answer: deterministic interval ladder first. It is explainable and enough for MVP.

2. Should confidence before answer be required?

Recommended answer: Optional at first, enabled by setting later. Do not block the simple recall loop.

3. Should hints lower the grade automatically?

Recommended answer: No. Store hints as evidence. Let Needs practice and future mastery rules interpret them.

4. Should Users be able to manually override the next recall date?

Recommended answer: Not in MVP. Add later if Users need control.

5. Does scheduling need a separate attempt-evidence table?

Recommended answer: Avoid it until computing Learning State or Due for Recall from Questions and SessionResults becomes awkward.

6. Should Recall Today include Study Notes that are not Due for Recall?

Recommended answer: Start with due Study Notes only. Add a mixed session builder later when due scheduling works.

7. How should AI-generated Questions affect scheduling?

Recommended answer: Scheduling should use the final self-rating or AI grade, not the mere fact that an AI Question was generated.

## Session Outcome To Capture

After grilling, update domain docs with:

- scheduler algorithm choice
- whether confidence is required
- whether hint usage affects scheduling directly
- whether Needs practice is stored or derived
- what counts as recall evidence for scheduling
- whether a separate attempt-evidence table exists
