# Focus Integration And Roadmap

## Focus Principle

Focus helps users spend attention. Recall helps users retain learning.

Do not turn Focus into a busy recall screen.

Recommended separation:

```text
Before Focus: choose study context and see weak suggestions
During Focus: timer, current context, quick note capture
After Focus: short recall reflection or Study Item creation
```

## Before Focus

Candidate prompt:

```text
What are you studying?
Label: Networking
Goal: Understand TCP congestion control

Suggested weak items:
- TCP slow start
- Congestion window
- Packet loss
```

Recommended first implementation:

- show weak Labels or weak Study Items near Focus setup
- do not require a FocusTarget before starting
- preserve the current lightweight start flow

## During Focus

Recommended surface:

- timer
- current FocusTarget when known
- quick note capture
- minimal controls

Avoid:

- recall interruptions
- heavy dashboards
- excessive animations
- notifications inside the focused state

## After Focus

Candidate post-Focus recall:

```text
What did you learn?
Explain the main idea without looking.
Which concept still feels weak?
Create one question for future recall.
```

Recommended first implementation:

- after a completed Focus Session, offer "Create Study Item"
- do not force the flow
- keep completed Focus Records read-only

## Roadmap

### Phase 1: Study Item Core

- Study Item model
- default Study Item for each Note
- manual Study Item creation
- Recall Session targets Study Items
- Review Events
- simple scheduler
- weak item rules

### Phase 2: Better Recall UX

- cloze deletion
- templates
- hint ladder
- confidence before answer
- Recall Today
- Weak Items session

### Phase 3: Label Intelligence

- label progress
- weak labels
- direct label dashboard
- basic Exam metadata
- session builder by label and due status

### Phase 4: Mnemonics

- structured Metaphors
- richer Acronyms
- Mnemonics as hints
- user ratings for Mnemonics

### Phase 5: Optional AI

- generate questions
- suggest labels
- generate Metaphors
- generate Acronyms
- split long Notes
- answer feedback

### Phase 6: Adaptive Learning

- forgetting probability
- personalized scheduling
- calibration analytics
- advanced Exam Mode

## Migration Strategy From Current App

Recommended vertical slices:

1. Add Study Item tables and service.
2. Create default Study Items for existing Notes.
3. Keep current Recall UI but source prompts from Study Items.
4. Save Review Events when users rate recall.
5. Add next review scheduling.
6. Add Recall Today.
7. Add manual Study Item editor.
8. Add weak item session.

This avoids a rewrite while shifting the architecture.

## Risks

- Existing domain docs currently reject a separate recall item model.
- Current recall results are stored as JSON snapshots, so migration must preserve history.
- Existing UI copy says Notes in many places where Study Items may become more accurate.
- Label graph analytics can become confusing if direct and descendant labels are mixed.
- Mastery percentages can look more precise than they are.
- AI features can hide weak domain modeling if added too early.

## Decisions To Grill

1. Should Focus recommend weak material before starting, after ending, or both?

Recommended answer: Both, but only after weak Study Items exist.

2. Should post-Focus recall create Review Events?

Recommended answer: Only if it uses an actual Study Item recall flow. Freeform reflection should not count as Review Event evidence.

3. Should the roadmap prioritize Study Items before dashboards?

Recommended answer: Yes. Dashboards need reliable Review Events and scheduling data.

4. Should the app be rewritten around this roadmap?

Recommended answer: No. Migrate the current app in vertical slices.

5. Which decision needs the first ADR?

Recommended answer: adopting Study Items as the trainable recall unit.

## Session Outcome To Capture

After grilling, capture:

- accepted migration sequence
- Focus boundaries
- whether post-Focus recall is a real Recall Session or a separate reflection flow
- first ADR title and decision scope
