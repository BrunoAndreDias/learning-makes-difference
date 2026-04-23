# PRD: Focus Sessions

## Problem Statement

Learners need more than Notes and recall practice to study effectively. They also need a structured way to protect focused study time, especially when using pomodoro-style work intervals. Without built-in focus tracking, users cannot keep a disciplined study rhythm inside the app or analyze how their study time was spent across note-taking, recall, and broader topic work.

## Solution

A Focus Session capability that lets users run pomodoro-style study blocks alongside note-taking and recall. A FocusSession is separate from a RecallSession, can contain multiple completed focus and break intervals, captures study context automatically from meaningful in-app activity, and produces a FocusRecord only after at least one full focus interval is completed. In v1, `Pomodoro` is the default FocusMethod, focus history is snapshot-based, and analytics emphasize completed focus time plus which study targets appeared during the session.

## User Stories

1. As a learner, I want to start a FocusSession without leaving my study workflow, so that I can begin focused work quickly.
2. As a learner, I want `Pomodoro` to be the default FocusMethod, so that the app supports a proven study pattern out of the box.
3. As a learner, I want a FocusSession to be separate from a RecallSession, so that I can use focus timing while doing different kinds of study work.
4. As a learner, I want to run a FocusSession while taking Notes, so that writing and refining knowledge can happen inside a timed study block.
5. As a learner, I want to run a FocusSession while doing a RecallSession, so that recall practice counts as focused study time.
6. As a learner, I want to run a FocusSession even when I am not inside a specific Note, Label, or RecallSession, so that I can start studying without extra setup.
7. As a learner, I want a FocusSession to support multiple FocusIntervals and BreakIntervals, so that one study block can cover several pomodoro rounds.
8. As a learner, I want to see the timer progress for the current FocusInterval, so that I know how much focused time remains.
9. As a learner, I want to see when I am in a BreakInterval, so that rest time is distinct from focus time.
10. As a learner, I want to explicitly end a FocusSession, so that the app does not silently decide when my study block is over.
11. As a learner, I want completed focus intervals to be saved, so that my focus history reflects real completed work.
12. As a learner, I do not want abandoned or early-stopped intervals saved as focus history, so that analytics stay trustworthy.
13. As a learner, I want a FocusSession to capture multiple FocusTargets over time, so that one study block can include several topics and activities.
14. As a learner, I do not want to manually tag FocusTargets while the timer is running, so that I do not lose concentration entering metadata.
15. As a learner, I want FocusTargets to be inferred automatically from what I do in the app, so that the app reflects my actual workflow.
16. As a learner, I want reading and researching inside a Label context to count as study activity even when I do not edit a Note yet, so that hard concepts are still represented in my focus history.
17. As a learner, I do not want passive or incidental navigation to count as study activity, so that merely opening pages or settings does not pollute analytics.
18. As a learner, I want work on unlabeled Notes to count during a FocusSession, so that I can capture ideas first and classify them later without breaking focus.
19. As a learner, I want unlabeled Note work to appear as a valid FocusTarget, so that uncategorized study time is still visible in history.
20. As a learner, I want a FocusRecord to snapshot study context as it existed during the FocusSession, so that later taxonomy changes do not rewrite past focus history in v1.
21. As a learner, I want a RecallSession inside a FocusSession to count as study inside that FocusSession, so that recall time is not treated as a separate extra block on top.
22. As a learner, I want focus analytics to distinguish between focused work time and break time, so that “study time” means completed FocusInterval time first.
23. As a learner, I want BreakIntervals to remain available in history, so that I can later analyze my focus-to-break rhythm.
24. As a learner, I want the app to record which FocusTargets appeared during a FocusSession, so that I can later see which topics or activities were part of that study block.
25. As a learner, I do not want the app to guess exact minutes per FocusTarget in v1, so that reports do not pretend to know more than they really do.
26. As a learner, I want a FocusSession to remain valid even if some of the study happened outside the app, so that reading a book or researching elsewhere still fits the flow.
27. As a learner, I understand that only in-app StudyActivity can generate automatic FocusTargets in v1, so that the limits of the analytics stay clear.
28. As a learner, I want to review completed FocusRecords later, so that I can analyze my study rhythm over time.
29. As a learner, I want to see the completed FocusIntervals inside a FocusRecord, so that I can understand how a study block was structured.
30. As a learner, I want to see the BreakIntervals inside a FocusRecord, so that I can review the full rhythm of a study block.
31. As a learner, I want to see which Labels appeared in a FocusRecord, so that I can understand which topics were involved in that study block.
32. As a learner, I want to see when RecallSessions appeared in a FocusRecord, so that I can understand which focus blocks included retrieval practice.
33. As a learner, I want the app to support future FocusMethods beyond Pomodoro, so that the domain can grow without renaming the core concepts.
34. As a learner, I want long-break or inactivity auto-ending to be deferred until the product has real usage feedback, so that v1 stays predictable.
35. As a learner, I want FocusSession data scoped to my account only, so that my study history remains private and ownership-safe.
36. As a learner using keyboard navigation or assistive technology, I want to control FocusSessions accessibly, so that timed study remains usable under WCAG requirements.

## Implementation Decisions

### Modules

**Focus Module**
- Owns FocusSession lifecycle: start, advance intervals, transition between focus and break, and explicit end.
- Persists FocusRecord only when at least one full FocusInterval completes.
- Keeps FocusSession distinct from RecallSession while allowing overlap.

**Focus Analytics Module**
- Produces user-facing summaries from FocusRecord data.
- Treats completed FocusInterval time as the primary metric.
- Exposes which FocusTargets appeared during a FocusSession without assigning exact minutes per target in v1.

**Study Activity Capture Module**
- Observes meaningful in-app study behaviour and turns it into FocusTargets.
- Must distinguish StudyActivity from incidental navigation.
- Must support Label-based work, RecallSession activity, and unlabeled Note work.

**Recall Module**
- Emits or exposes enough lifecycle signals for FocusSessions to recognize RecallSession activity as nested study work.
- Must not double-count RecallSession time on top of FocusSession time.

**Note Module**
- Exposes enough signals for FocusSessions to recognize note-taking, note review, and unlabeled Note work as study activity.

### Architectural Decisions

- FocusSession is a separate domain concept from RecallSession.
- `Pomodoro` is the default FocusMethod in v1, but the model must allow future FocusMethods.
- A FocusSession may contain multiple FocusIntervals and BreakIntervals.
- In v1, FocusSession ends only through explicit user action; automatic ending after inactivity or long breaks is deferred.
- FocusSession may run even when study happens partly outside the app, but only in-app StudyActivity can generate automatic FocusTargets in v1.
- Focus history is snapshot-based in v1; later Label or Note changes do not rewrite past FocusRecords.
- A FocusSession may accumulate multiple FocusTargets over time.
- FocusTargets are captured automatically in v1 rather than manually entered by the user.
- Analytics record which FocusTargets appeared in the FocusSession, but not exact minute allocation per target in v1.
- Recall work inside a FocusSession is nested study activity, not extra additive time.

### Schema Changes

- Add persistence for active FocusSessions, including current FocusMethod, current interval state, and explicit lifecycle timestamps.
- Add persistence for FocusIntervals and BreakIntervals belonging to a FocusSession.
- Add persistence for FocusRecord as the completed historical record of a FocusSession.
- Add persistence for FocusTargets associated with a FocusRecord.
- Keep all focus-related records ownership-scoped to a single User.
- Preserve snapshot semantics for FocusTargets stored in FocusRecord.

### API and Interaction Decisions

- Starting a FocusSession should require minimal input in v1.
- Focus target classification must be automatic-first and should not interrupt the user during timed work.
- History views should clearly distinguish active FocusSession state from completed FocusRecord history.
- Reporting should distinguish completed focus time from break time.
- Reporting should allow users to see which Labels, RecallSessions, or unlabeled Note work appeared in a completed FocusSession.

## Testing Decisions

A good test verifies externally observable behavior: what a user or calling boundary does, what state changes result, and what historical records are persisted. Tests should avoid asserting on internal timers, private helpers, or implementation details that could change without affecting the product contract.

### Modules to test

**Focus Module**
- Highest priority.
- Test FocusSession start, interval progression, explicit ending, persistence rules, and rejection of incomplete-session history.
- Unit test interval transition rules and integration test persistence against a real database.

**Study Activity Capture Module**
- Test which in-app events count as StudyActivity and which do not.
- Verify that meaningful Label work, RecallSession activity, and unlabeled Note work produce FocusTargets, while incidental navigation does not.

**Focus Analytics Module**
- Test that completed FocusInterval time is the primary metric, BreakIntervals are preserved for secondary analysis, and per-target minute allocation is intentionally absent in v1.

**Recall Module Integration**
- Test that RecallSession activity nested inside FocusSession contributes to FocusTargets and does not create double-counted time.

**Note Module Integration**
- Test that note creation, editing, review flows, and unlabeled Note work can contribute FocusTargets correctly during an active FocusSession.

### Prior Art

- Follow the same testing principle already used in the main app PRD: verify observable behavior rather than implementation details.
- Use the existing Recall and Label testing philosophy as precedent for isolating domain rules with clear inputs and outputs.

## Out of Scope

- Retroactive reclassification of past FocusRecords after later Note or Label changes
- Exact minute allocation across multiple FocusTargets within a single FocusSession
- Automatic FocusSession ending after inactivity, device sleep, or oversized breaks
- Manual target tagging as a required part of starting or running a FocusSession
- Additional FocusMethods beyond the default Pomodoro method
- Notifications, reminders, or cross-device timer synchronization
- Mobile-native background timer behavior
- Out-of-app activity classification beyond the fact that the FocusSession itself can continue running

## Further Notes

- This PRD intentionally covers the focus/pomodoro capability separately from the main app PRD.
- The canonical language for this feature is defined in `CONTEXT.md`, especially `FocusSession`, `FocusMethod`, `FocusInterval`, `BreakInterval`, `FocusRecord`, `FocusTarget`, and `StudyActivity`.
- This PRD is compatible with the existing recall model: RecallSession remains a separate concept and can occur inside a FocusSession.
- Future work may add retroactive analytics, automatic session ending, and additional FocusMethods once real usage patterns are understood.
