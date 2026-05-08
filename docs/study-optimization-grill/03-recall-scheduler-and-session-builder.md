# Recall Scheduler And Session Builder

## Recall Session Flow

Recommended flow:

```text
Show Study Item prompt
-> ask confidence before answer
-> user answers
-> optional hint ladder
-> reveal expected answer and source Note
-> user grades performance
-> create Review Event
-> schedule next recall
```

Current app similarity:

- FlashCard recall already hides the Note body.
- The user already self-rates with Forgot, Hard, Good, Easy.

Missing pieces:

- Study Item prompt separate from Note title
- expected answer separate from Note body
- confidence before answer
- hint usage
- next review date
- weak item state
- automatic session builder

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
type SchedulableStudyItem = {
  intervalDays: number;
  successStreak: number;
  lapses: number;
  lastReviewedAt?: Date;
  nextReviewAt?: Date;
};
```

## Weak Item Rule

Candidate MVP rule:

```ts
function isWeakItem(input: {
  grade: "forgot" | "hard" | "good" | "easy";
  confidenceBefore?: number;
  hintsUsed: number;
  lapses: number;
}) {
  return (
    input.grade === "forgot" ||
    input.confidenceBefore === 1 ||
    input.confidenceBefore === 2 ||
    input.hintsUsed > 0 ||
    input.lapses >= 2
  );
}
```

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

The app should store how far the user went through the ladder.

Recommended first implementation:

- track only `hintsUsed`
- add richer hint content later
- reveal source Note as the final help level

## Session Builder

Candidate session modes:

- Daily Recall
- Weak Items
- Label Focus
- Mixed Review
- Exam Mode

Candidate Daily Recall mix:

```text
50% due items
25% weak items
15% recent items
10% interleaved items
```

Recommended first implementation:

```text
Recall Today = due Study Items sorted by nextReviewAt, then weak priority
Weak Items = weak Study Items sorted by most recent lapse or low confidence
Manual selection = preserve current user-selected flow
```

## Decisions To Grill

1. Should scheduling happen at Study Item level or Note level?

Recommended answer: Study Item level. Different prompts from the same Note can age differently.

2. Should the first scheduler be deterministic or use an existing algorithm such as SM-2?

Recommended answer: deterministic interval ladder first. It is explainable and enough for MVP.

3. Should confidence before answer be required?

Recommended answer: Optional at first, enabled by setting later. Do not block the simple recall loop.

4. Should hints lower the grade automatically?

Recommended answer: No. Store hints as evidence. Let weak/mastery rules interpret them.

5. Should users be able to manually override the next review date?

Recommended answer: Not in MVP. Add later if users need control.

6. Does a skipped Study Item create a Review Event?

Recommended answer: No, unless the user explicitly marks it Forgot. A skip is session flow, not learning evidence.

7. Can one Recall Session mix Study Items from the same Note?

Recommended answer: Yes, but avoid showing siblings too close together if it makes the session repetitive.

## Session Outcome To Capture

After grilling, update domain docs with:

- canonical grade labels
- whether confidence is required
- whether scheduling is deterministic
- whether "weak" is a stored state or derived state
- what counts as a Review Event
