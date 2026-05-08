# Domain Model: Study Items

## Central Decision

The blueprint proposes that a Note is source material and a Study Item is the object trained by recall.

This conflicts with the current project language, where a Note is the durable recall item.

Recommended direction:

```text
Note = source concept or source explanation
Study Item = trainable prompt derived from a Note
Review Event = one attempt at a Study Item
```

## Proposed Relationships

```text
User
-> Notes
-> Study Items
-> Review Events

Note
-> many Study Items
-> many Mnemonics
-> many Labels

Study Item
-> one Note
-> many Review Events
-> optional Mnemonics

Label
-> many Notes
-> derived progress through related Study Items
```

## Candidate Types

```ts
type StudyItemType =
  | "definition"
  | "explanation"
  | "application"
  | "comparison"
  | "cloze"
  | "metaphor"
  | "acronym";

type StudyItemStatus =
  | "new"
  | "learning"
  | "weak"
  | "scheduled"
  | "mastered"
  | "archived";

type StudyItem = {
  id: string;
  userId: string;
  noteId: string;
  type: StudyItemType;
  prompt: string;
  expectedAnswer: string;
  explanation?: string;
  intervalDays: number;
  successStreak: number;
  lapses: number;
  status: StudyItemStatus;
  lastReviewedAt?: Date;
  nextReviewAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};
```

```ts
type ReviewGrade = "forgot" | "hard" | "good" | "easy";

type ReviewEvent = {
  id: string;
  userId: string;
  studyItemId: string;
  confidenceBefore?: 1 | 2 | 3 | 4 | 5;
  confidenceAfter?: 1 | 2 | 3 | 4 | 5;
  userAnswer?: string;
  grade: ReviewGrade;
  hintsUsed: number;
  responseTimeMs?: number;
  reviewedAt: Date;
};
```

## Migration Shape

Recommended migration from current app:

1. Add Study Item storage.
2. For every existing Note, create one default Study Item.
3. Default prompt comes from the Note title.
4. Default expected answer comes from the Note body.
5. Existing recall results remain historical snapshots.
6. New recall sessions target Study Items, while still showing Note context.

This gives the app the new architecture without forcing users to split every existing Note immediately.

## Decisions To Grill

1. Does each saved Note automatically get a default Study Item?

Recommended answer: Yes. This preserves current behavior and gives every Note a recall path.

2. Can a Study Item exist without a Note?

Recommended answer: No for now. A Study Item belongs to exactly one Note so source context remains clear.

3. Can a Note have zero Study Items?

Recommended answer: Not while it is active and recall-enabled. Archived Notes may have archived Study Items.

4. Does deleting a Note delete active Study Items?

Recommended answer: Yes. Historical Review Events and Session Results should retain snapshots, not live references only.

5. Are Metaphors and Acronyms Study Items, Mnemonics, or both?

Recommended answer: They are Mnemonics by default. They can also generate Study Items when the user wants to practice them as prompts.

6. Should status live on Study Item or be derived from Review Events?

Recommended answer: Store scheduling fields on Study Item for fast selection. Treat status as derived enough to recompute when Review Events change, but persist it if the UI needs cheap filtering.

7. Should existing `RecallQuestion` become `StudyItemSnapshot`?

Recommended answer: A Recall Session should snapshot the Study Item prompt, expected answer, and owning Note context. The historical object can still be called Question if it represents the prompt inside a session.

## ADR Candidate

This decision probably deserves an ADR because it is:

- hard to reverse once data exists
- surprising because the current docs say the opposite
- a real trade-off between simple Note-based recall and multi-item spaced repetition

Possible ADR title:

```text
Adopt Study Items as the durable trainable recall unit
```
