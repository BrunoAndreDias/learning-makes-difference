# Product Thesis And Learning Loop

## Source Claim

The app should not be only a notes app. Its strongest product direction is to transform notes into active memory.

Proposed product promise:

```text
Not just saving notes. Turning notes into memory.
```

Proposed loop:

```text
Create note
-> transform note into trainable units
-> active recall
-> measure confidence and performance
-> schedule next recall
-> reinforce weak material
-> show progress by label or knowledge area
```

## Scientific Principles

The blueprint depends on these learning principles:

- Retrieval practice: users should try to recall before seeing the answer.
- Spaced repetition: future recall should be scheduled after each attempt.
- Desirable difficulty: the learning task should be effortful, but the interface should stay simple.
- Interleaving: sessions should sometimes mix related areas instead of drilling one label only.
- Metacognition: users should compare confidence with actual performance.
- Cognitive load: recall should reveal information progressively.

## Product Non-Negotiables

Recommended defaults:

- Recall is the primary learning action, not passive rereading.
- Answers start hidden.
- Users must actively answer or mentally answer before revealing reference material.
- Users record performance after the answer is revealed.
- The app should answer: "What should I study now, and why?"
- AI can reduce friction, but the core loop must work without AI.

## Candidate Domain Terms

Terms to grill:

- Learning Loop
- Study Layer
- Study Item
- Review Event
- Weak Item
- Mastery
- Due for Recall
- Recall Plan
- Knowledge Area

Known conflict:

- Current project language treats the Note as the durable recall item.
- The blueprint treats the Study Item as the durable trainable item.

## Grill Questions

1. Should the product promise be about Notes becoming memory, or about Study Items becoming memory?

Recommended answer: Notes remain the user's captured source material, but Study Items become the trainable memory units.

2. Is "Study Item" a domain term users should see, or an internal model?

Recommended answer: Use Study Item as domain and code language. In user-facing copy, prefer concrete terms such as Question, Cloze, Metaphor prompt, or Recall item depending on the surface.

3. Should "Weak" be visible to users?

Recommended answer: Yes, but softly. "Weak notes" or "weak items" are useful if the copy frames weakness as a learning signal, not failure.

4. Is the main navigation still Notes, Recall, Focus, Labels, or should a Dashboard become primary?

Recommended answer: Keep Notes, Recall, Focus, and Labels for now. Add an actionable Today or Recall Today surface later once scheduling exists.

5. Does the app need AI to deliver the core promise?

Recommended answer: No. Manual Study Items, self-rating, deterministic scheduling, and simple analytics are enough for the scientific core.

## Session Outcome To Capture

After grilling, update domain docs with:

- the accepted core loop
- the relationship between Note and Study Item
- the accepted user-facing term for weak material
- whether "Study Item" is domain-visible or implementation-only
