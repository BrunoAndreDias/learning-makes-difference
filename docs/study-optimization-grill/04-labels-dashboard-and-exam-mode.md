# Labels, Dashboard, And Exam Mode

## Product Direction

Labels should not be only organization. They should behave as knowledge areas with progress.

Current app already has Labels and label relationships. The blueprint proposes adding learning signals to labels.

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
- A Note can have multiple Labels.
- Label progress should account for direct labels first.
- Descendant aggregation needs a clear rule before it appears in analytics.

## Dashboard Jobs

The dashboard should be actionable.

It should answer:

```text
What should I study now?
Why this?
Which area is weak?
What changed since last time?
```

Candidate overall dashboard:

```text
Today
- due items
- weak items
- best label
- weakest label
- recall accuracy
- confidence calibration
```

Candidate label dashboard:

```text
Label: Networking
Mastery: 68%
Due today: 8
Weak items: 5
Most failed concept: TCP congestion control
Recommended action: 10-minute weak item session
```

Candidate note dashboard:

```text
Note: TCP Congestion Control
Weak Study Items: 2
Last recalled: yesterday
Next recall: tomorrow
Hints used: often
Suggested action: split Note, improve metaphor, or retry weak item
```

## Mastery

Recommended first mastery proxy:

```text
Study Item mastery =
  latest grade
  + success streak
  + interval length
  - lapses
  - hint use
```

Recommended first label mastery:

```text
Label mastery =
  average mastery of active Study Items belonging to Notes with that Label
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

When an exam is near, session building should prioritize:

- due Study Items in exam labels
- weak Study Items in exam labels
- application and comparison Study Items
- shorter recall intervals for low-mastery items

## Decisions To Grill

1. Are Labels knowledge areas or only grouping aids?

Recommended answer: Promote Labels to knowledge areas, but keep the existing graph model.

2. Does label progress include descendant Labels?

Recommended answer: Start with direct labels only. Add descendant aggregation later with explicit UI copy.

3. Should Label priority affect scheduling?

Recommended answer: Yes, but only after baseline due scheduling exists.

4. Should Exam Mode be its own domain concept or just Label metadata?

Recommended answer: Start as Label metadata. Create a separate Exam concept only when multiple Labels need to be grouped under one exam with shared settings.

5. Should mastery be shown as a percentage?

Recommended answer: Use percentages only if the scoring rule is explainable. Early UI may be better with counts: due, weak, mastered.

6. Should dashboards include focus time?

Recommended answer: Yes, but separate retention metrics from focus-time metrics. Time studied is not the same as memory gained.

## Session Outcome To Capture

After grilling, update domain docs with:

- whether Label means knowledge area
- whether label graph relationships affect progress
- whether Exam is a domain term now or later
- accepted dashboard metrics for MVP
