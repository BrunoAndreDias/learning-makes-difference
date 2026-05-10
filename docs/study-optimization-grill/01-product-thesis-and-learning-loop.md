# Product Thesis And Learning Loop

## Status

Completed. `CONTEXT.md` and ADR 0005 now define the product thesis baseline for later grill sessions:

- Notes are source material.
- Study Notes are the durable trainable recall targets.
- The core Learning Loop works without AI.
- User-facing low-performance language is "Needs practice", not "Weak".
- Scheduled recall uses **Due for Recall** as the domain concept and "Recall Today" as likely UI copy.

## Source Claim

The app should not be only a notes app. Its strongest product direction is to transform notes into active memory.

Proposed product promise:

```text
Not just saving notes. Turning notes into memory.
```

Proposed loop:

```text
Create source material as a Note
-> extract or create Study Notes
-> active recall through RecallSessions
-> self-rate or grade recall
-> update Learning State and Due for Recall
-> reinforce material that Needs practice
-> show progress by Label or study area
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

## Resolved Domain Terms

Accepted:

- Learning Loop
- Study Layer
- Study Note
- Due for Recall
- Learning State
- Label

Rejected or deferred:

- Study Item - rejected in favor of Study Note.
- Weak Item - use "Needs practice" in user-facing copy.
- Review Event - not accepted as a domain term; current recall history is modeled through Questions inside SessionResults.
- Mastery - not accepted for v1 Learning State; future analytics must be explainable before using mastery copy or percentages.
- Knowledge Area - use Label unless a later session establishes a separate term.
- Recall Plan - not accepted; scheduling remains under Due for Recall and later session-builder decisions.

Known resolved conflict:

- Older project language treated the Note as the durable recall item.
- The blueprint treated the Study Item as the durable trainable item.
- Current project language uses Study Note as the durable trainable recall target and Note as source material.

## Resolved Grill Questions

1. Should the product promise be about Notes becoming memory, or about Study Notes becoming memory?

Resolved answer: Notes remain the user's captured source material, but Study Notes become the trainable memory units.

2. Is "Study Item" a domain term users should see, or an internal model?

Resolved answer: No. Use Study Note as domain and user-facing language.

3. Should "Weak" be visible to users?

Resolved answer: No for v1. Use "Needs practice" for low-performing Study Notes.

4. Is the main navigation still Notes, Recall, Focus, Labels, or should a Dashboard become primary?

Resolved answer: Use Study Notes, Recall, and Focus as primary workspace sections in v1. Labels support grouping and filtering, but are not the foundation of RecallSession targeting. Dashboard remains a candidate future surface, not the primary baseline.

5. Does the app need AI to deliver the core promise?

Resolved answer: No. Manual Study Notes, expected answers, recall, self-rating, and simple Learning State copy are enough for the core Learning Loop.

## Session Outcome To Capture

Captured in `CONTEXT.md` and ADR 0005:

- the accepted core loop
- the relationship between Note and Study Note
- the accepted user-facing term for weak material
- the rejection of "Study Item" as domain-visible language
