# Labels, Dashboard, And Exam Mode

## Current CONTEXT.md Baseline

- A Label groups Study Notes, not source Notes.
- Labels form a DAG, not a flat list or tree.
- A Study Note can belong to multiple Labels directly.
- Labels may help filter or group Study Notes, but RecallSessions target selected Study Notes directly.
- Learning State is per Study Note and is based on latest recall score and recency in v1.
- "Needs practice" is accepted user-facing copy for low-performing Study Notes.
- Study Objective can be "Specific exam", but in v1 it is profile context only and does not affect Labels, scheduling, FocusTargets, or RecallSessions.
- Dashboard is not an accepted primary workspace term in `CONTEXT.md`; treat it as a candidate actionable surface.

## Product Direction

Labels should not be only organization. They can behave like study areas with progress once Study Note Learning State and Due for Recall exist.

Current app already has Labels and label relationships. The blueprint proposes adding learning signals to Labels.

## Candidate Label Fields

```ts
type Label = {
  id: string;
  userId: string;
  name: string;
  color?: string;
  priority: "low" | "normal" | "high";
  examDate?: Date;
  targetMastery?: number;
  recallEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};
```

Current repo consideration:

- Labels are currently a graph, not a flat category list.
- A Study Note can have multiple Labels.
- Label progress should account for direct Study Note labels first.
- Descendant aggregation needs a clear rule before it appears in analytics.
- Label priority and exam metadata are future scheduling inputs, not v1 profile settings.

## Dashboard Jobs

The candidate dashboard or actionable surface should answer:

```text
What should I study now?
Why this?
Which Label needs practice?
What changed since last time?
```

Candidate overall surface:

```text
Today
- Study Notes Due for Recall
- Needs practice Study Notes
- strongest Label
- Label needing practice
- recall self-rating trend
- confidence calibration
```

Candidate Label surface:

```text
Label: Networking
Due for Recall: 8
Needs practice: 5
Not recalled yet: 12
Most missed Study Note: TCP congestion control
Recommended action: 10-minute Needs Practice session
```

Candidate Study Note or source Note surface:

```text
Study Note: TCP slow start
Source Note: TCP Congestion Control
Learning State: Last score: Forgot
Due for Recall: today
Hints used: often
Suggested action: retry, improve Metaphor, or split source Note into narrower Study Notes
```

## Mastery

`CONTEXT.md` does not accept Mastery as a v1 Learning State term. Grill it as a future analytics concept only.

Recommended first Label summary:

```text
Label progress =
  count of Study Notes Due for Recall
  + count of Study Notes that need practice
  + count of Study Notes Not recalled yet
  + latest recall facts
```

Future mastery proxy to grill:

```text
Study Note mastery =
  latest self-rating
  + success streak
  + interval length
  - lapses
  - hint use
```

Recommended first Label mastery, if percentages are accepted later:

```text
Label mastery =
  average mastery of active Study Notes directly assigned to that Label
```

Avoid pretending this is a scientifically precise score in early versions.

## Exam Mode

Candidate setup:

```text
Exam
- name
- date
- labels
- target mastery
- daily recall plan
```

When an exam is near, session building could prioritize:

- Study Notes Due for Recall in exam Labels
- Needs practice Study Notes in exam Labels
- application and comparison Study Notes
- shorter recall intervals for low-performing Study Notes

Current boundary:

- Study Objective may say "Specific exam", but it does not drive behavior in v1.
- Exam Mode is not yet a domain concept in `CONTEXT.md`.

## Decisions To Grill

1. Are Labels knowledge areas or only grouping aids?

Recommended answer: Keep the domain term Label. Let top-level Labels behave as study areas without introducing "Knowledge Area" yet.

2. Does Label progress include descendant Labels?

Recommended answer: Start with direct Study Note labels only. Add descendant aggregation later with explicit UI copy.

3. Should Label priority affect scheduling?

Recommended answer: Yes, but only after baseline Due for Recall scheduling exists.

4. Should Exam Mode be its own domain concept or just Label metadata?

Recommended answer: Start as future Label metadata. Create a separate Exam concept only when multiple Labels need to be grouped under one exam with shared settings.

5. Should mastery be shown as a percentage?

Recommended answer: Use percentages only if the scoring rule is explainable. Early UI is better with counts: Due for Recall, Needs practice, Not recalled yet.

6. Should dashboards include focus time?

Recommended answer: Yes, but separate retention metrics from FocusSession and FocusRecord metrics. Time studied is not the same as memory gained.

7. Should Dashboard become primary navigation?

Recommended answer: No for now. Keep Study Notes, Recall, and Focus as the primary workspace sections; introduce actionable surfaces only when scheduling data exists.

## Session Outcome To Capture

After grilling, update domain docs with:

- whether Label copy can imply a study area
- whether Label graph relationships affect progress
- whether Exam is a domain term now or later
- accepted Label summary metrics for MVP
- whether Mastery is rejected, deferred, or accepted with a precise rule
