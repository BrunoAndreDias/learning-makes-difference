# Focus Integration And Roadmap

## Current CONTEXT.md Baseline

- FocusSession helps Users spend attention; RecallSession helps Users test recall.
- FocusSession is separate from RecallSession and may overlap with Note-taking, Note review, or RecallSession work.
- FocusTarget can refer to a Label, a RecallSession, or unlabeled Study Note work.
- In v1, FocusTargets are captured automatically from observed StudyActivity.
- The app stores FocusTargets for a FocusSession rather than a full StudyActivity event log.
- FocusRecords are read-only and snapshot their FocusTargets.
- Focus Section analytics derive only from existing Notes, SessionResults, and FocusRecords.
- Focus Section route is `/focus`; compact active controls live in the Focus Dock.
- Focus configuration is limited to Pomodoro timing values in v1.

## Focus Principle

Focus helps Users spend attention. Recall helps Users retain learning.

Do not turn Focus into a busy recall screen.

Recommended separation:

```text
Before Focus: choose or infer study context and optionally show Needs practice suggestions
During Focus: timer, current context, quick Study Note capture
After Focus: optional recall reflection or Study Note creation
```

## Before Focus

Candidate prompt:

```text
What are you studying?
Label: Networking
Focus context: Understand TCP congestion control

Suggested Needs practice Study Notes:
- TCP slow start
- Congestion window
- Packet loss
```

Recommended first implementation:

- show Needs practice Labels or Study Notes near Focus setup only after that signal exists
- do not require a FocusTarget before starting
- preserve the current lightweight start flow
- let v1 automatic StudyActivity capture create FocusTargets during the FocusSession

## During Focus

Recommended surface:

- timer
- current FocusTarget when known
- quick Study Note capture
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
Which Study Note still needs practice?
Create one Study Note for future recall.
```

Recommended first implementation:

- after a completed FocusSession, offer "Create Study Note"
- do not force the flow
- keep completed FocusRecords read-only
- do not create recall evidence unless the User enters an actual RecallSession flow

## Roadmap

### Phase 1: Study Note Core

- Study Note model
- default Study Note for each Note
- manual Study Note creation
- RecallSession targets Study Notes
- Question and SessionResult evidence for recall
- Learning State
- simple scheduler and Due for Recall
- Needs practice rules

### Phase 2: Better Recall UX

- cloze deletion
- templates
- hint ladder
- confidence before answer
- Recall Today
- Needs Practice session

### Phase 3: Label Intelligence

- Label progress from directly assigned Study Notes
- Labels needing practice
- direct Label dashboard or actionable surface
- basic Exam metadata, if accepted
- session builder by Label and Due for Recall

### Phase 4: Memory Aids

- structured Metaphors
- richer Acronyms
- Metaphors and Acronyms as hints
- user ratings for memory aids, if useful

### Phase 5: Optional AI

- generate Questions
- suggest Labels
- generate Metaphors
- generate Acronyms
- split long source Notes into Study Notes
- answer feedback

### Phase 6: Adaptive Learning

- forgetting probability
- personalized scheduling
- calibration analytics
- advanced Exam Mode

## Migration Strategy From Current App

Recommended vertical slices:

1. Add or finish Study Note tables and service.
2. Create default Study Notes for existing Notes.
3. Keep current Recall UI but source prompts from Study Notes.
4. Store Question and SessionResult evidence when Users rate recall.
5. Add next recall scheduling.
6. Add Recall Today.
7. Add manual Study Note editor.
8. Add Needs Practice session.

This avoids a rewrite while shifting the architecture.

## Risks

- ADR 0005 resolved the Study Note direction, but stale code or copy may still say Notes or Study Items.
- Current recall results are stored as JSON snapshots, so scheduling may need either careful projection or a separate attempt-evidence table.
- Label graph analytics can become confusing if direct and descendant Labels are mixed.
- Mastery percentages can look more precise than they are.
- AI features can hide weak domain modeling if added too early.
- Focus suggestions can make Focus feel like another recall dashboard if shown too aggressively.

## Decisions To Grill

1. Should Focus recommend Needs practice material before starting, after ending, or both?

Recommended answer: Both, but only after Needs practice Study Notes exist.

2. Should post-Focus recall create recall evidence?

Recommended answer: Only if it uses an actual Study Note RecallSession flow. Freeform reflection should not count as Question, SessionResult, or scheduling evidence.

3. Should the roadmap prioritize Study Notes before dashboards?

Recommended answer: Yes. Dashboards and actionable surfaces need reliable Learning State, Due for Recall, and scheduling data.

4. Should the app be rewritten around this roadmap?

Recommended answer: No. Migrate the current app in vertical slices.

5. Which decision needs the next ADR?

Recommended answer: ADR 0005 already covers Study Notes as durable recall targets. The next ADR candidate is a hard-to-reverse scheduler or recall-attempt persistence decision, if the grill session decides one is needed.

## Session Outcome To Capture

After grilling, capture:

- accepted migration sequence
- Focus boundaries
- whether post-Focus recall is a real RecallSession or a separate reflection flow
- whether Focus can recommend Needs practice material
- next ADR title and decision scope, if any
