# Study Research App Opportunities

This maps the research in `docs/study-research.md` into product directions for Learning Makes Difference. The grouping follows product leverage, not research importance: core items strengthen the existing Learning Loop directly; medium-core items deepen the same loop; nice-to-haves are useful only after the core behaviors are stable.

Status markers:

- `Covered`: already represented in the current product/domain and should mainly be refined.
- `Partial`: present, but still worth exploring through UX, edge cases, or deeper implementation.
- `Explore`: not a current product capability or still only a future direction.

## Coverage summary

| Status | Opportunities |
| --- | --- |
| Covered | Recall-first Study Notes; Simple Recall Schedule; Recall Today Queue; Practice Repair After Weak Recall; Feedback-Rich Results Review; Interleaved Recall; Focus Session Learning Loop |
| Partial | Worked-Example Capture; Self-Explanation Prompts; Atomicity and Split Guidance; Label-Based Concept Groups; Memory Aid Suggestions |
| Explore | Dual-Coding Support; Weekly Recall Planning; Guided Beginner Mode; Transfer Prompts; Source Import; AI Drafting Assistance; Exam Simulation; Teaching Mode; Deliberate Practice Targets; Biological Support Nudges; Social Learning Hooks |

## Core things

### Recall-first Study Notes

Status: Covered

Make every saved Study Note naturally lead to closed-book recall: prompt, expected answer, attempt, reveal, self-rate, and correction. This is the strongest product expression of retrieval practice and keeps the app centered on active learning instead of passive note storage.

### Simple Recall Schedule

Status: Covered

Use recall evidence to decide when a Study Note should come back: forgotten or hard answers stay close, good or easy answers move further out. Keep the user-facing copy simple, such as "Recall Today" or the next recall date, rather than exposing algorithm names.

### Recall Today Queue

Status: Covered

Give the User one prioritized place to start: actionable Practice Follow-ups, Needs practice evidence, new recallable Study Notes, and Due for Recall items. This turns spacing and retrieval into a daily habit instead of making the User manually plan every session.

### Practice Repair After Weak Recall

Status: Covered

When a Question is rated Forgot or Hard, guide the User toward a concrete repair: tighten the prompt, tighten the expected answer, split the Study Note, create a sibling Study Note, or add a memory aid. This converts mistakes into future practice without building a heavy error-log system.

### Worked-Example Capture

Status: Partial

Support Notes that contain a clean explanation or worked example, then help the User extract one or more atomic Study Notes from it. This matches the beginner path from example study to guided practice without making worked examples a separate stored object type.

### Self-Explanation Prompts

Status: Partial

Use small prompt helpers while creating or repairing Study Notes: "Why does this work?", "What would break if the assumption changed?", "What is a beginner mistake?", or "Give an example and a non-example." This adds deep processing without forcing another required field.

### Atomicity and Split Guidance

Status: Partial

Detect or nudge when a Study Note is too broad: long prompt, long expected answer, multiple concepts, multiple memory aids, or repeated weak recall. The app should encourage splitting because atomic Study Notes are easier to retrieve, schedule, repair, and interleave.

### Feedback-Rich Results Review

Status: Covered

Make completed RecallSession results question-first: show the attempt context, expected answer, rating, and next action. Results review should be where the User learns what to fix, not just where they see a score.

## Medium-core

### Interleaved Recall

Status: Covered

After a Study Note has enough successful recall evidence, mix it with related Study Notes by Label or sibling source concept. This trains discrimination: the User learns when to use an idea, not only how to repeat it.

### Label-Based Concept Groups

Status: Partial

Use flat Labels to connect related Study Notes and support future interleaving, focused recall, and study planning. Labels should behave like concept groups, not folders, generic tags, or parent-child taxonomy.

### Dual-Coding Support

Status: Explore

Add lightweight ways to capture diagrams, flows, visual structures, or redraw-from-memory prompts. This is most useful for systems, architecture, science, history timelines, and other topics where structure matters.

### Memory Aid Suggestions

Status: Partial

Use Metaphors and Acronyms selectively for abstract, stubborn, or repeatedly missed Study Notes. The app should treat them as support material, not as mandatory decorations on every Study Note.

### Focus Session Learning Loop

Status: Covered

Connect Focus Sessions to meaningful study work: creating Study Notes, recalling, repairing, and reviewing results. The timer is useful when it protects attention and creates reflection points, not when it becomes the main product.

### Weekly Recall Planning

Status: Explore

Offer a small weekly planning surface around existing evidence: what was recalled, what needs repair, what is due soon, and what should be practiced next. This supports metacognition without introducing broad analytics or false mastery scores.

### Guided Beginner Mode

Status: Explore

For new or difficult material, present a low-load path: source explanation, worked example, one atomic Study Note, short recall, immediate correction. Avoid throwing beginners straight into mixed practice or large projects.

### Transfer Prompts

Status: Explore

For stronger Study Notes, ask for application in a different context: "Where else could this apply?", "What is a counterexample?", or "How would this fail in a real project?" This moves the app from memory toward transfer.

## Nice-to-haves

### Source Import

Status: Explore

Import external material into the Study Layer so the User can convert it into Notes and Study Notes. Imported content should remain source material; the practiced object should still be the Study Note.

### AI Drafting Assistance

Status: Explore

AI can suggest Study Note prompts, expected answers, repair options, distractors, or memory aids. It should remain optional support because the Core Learning Loop must work manually and without AI.

### Exam Simulation

Status: Explore

Let Users run realistic recall sessions from selected Labels or Study Notes under time pressure. This is useful for exam preparation after the core recall, schedule, and repair mechanics are reliable.

### Teaching Mode

Status: Explore

Prompt the User to explain a Study Note as if teaching someone else: simple explanation, example, non-example, misconception, and unprepared question. This can be a special RecallSession mode later.

### Deliberate Practice Targets

Status: Explore

Allow advanced Users to define one subskill they are improving and attach Study Notes or RecallSessions to that target. This is valuable for skill growth, but premature before the normal Learning Loop is strong.

### Biological Support Nudges

Status: Explore

Small reminders about sleep, breaks, and movement can support learning, especially around Focus Sessions. Keep these subtle; they should not become wellness tracking.

### Social Learning Hooks

Status: Explore

Future peer explanation, mentor feedback, code review, or group recall flows can support active learning. Build only when the single-user learning evidence model is already solid.

## Don'ts to preserve

### Do not reward passive activity as learning evidence

Rereading, highlighting, watching videos, copying notes, and browsing source material should not improve Learning State by themselves. They only count when they produce or reinforce Study Notes, recall evidence, correction, or Practice Repair.

### Do not turn the app into a beautiful-notes tool

Polished notes can create fluency illusion. The product should make it easy to create useful source Notes, but the center of gravity should stay on recallable Study Notes and correction.

### Do not expose algorithm language

Avoid user-facing terms like "SM-2", "spaced-repetition engine", "review interval", or "card state." The User needs clear timing and action, not scheduler internals.

### Do not call things cards, flashcards, quizzes, or tests

The domain language is Study Note, RecallSession, Question, Recall Today, Due for Recall, and Practice Repair. This keeps the product distinct from generic flashcard apps and avoids narrowing the mental model.

### Do not use harsh mastery labels

Avoid "Weak", "failed", "mastered", "90% learned", or broad mastery percentages. Prefer evidence-based copy such as "Needs practice", "Last score: Good", "Not recalled yet", and "Last recalled".

### Do not force every technique into the product

The research is a toolbox, not a checklist. Add a technique only when it strengthens the Learning Loop: create an atomic Study Note, recall it, compare, correct, schedule, and revisit.

### Do not over-interleave too early

Interleaving is powerful after basics exist. For brand-new or struggling Study Notes, too much mixing creates cognitive overload rather than useful difficulty.

### Do not make memory aids mandatory

Metaphors and Acronyms are useful for specific recall problems. Requiring them everywhere will add clutter and encourage decorative work instead of targeted support.

### Do not replace feedback with scores

Scores are not enough. Weak recall should lead to visible correction paths, and strong recall should influence future timing.

### Do not make AI the default study method

AI should help draft, compare, or suggest, but the User must still attempt recall, judge gaps, and confirm repairs. Otherwise the app risks outsourcing the learning process.

### Do not build broad analytics before behavior is trustworthy

Avoid dashboards that imply precision before the underlying evidence is mature. Use only existing Notes, Recall SessionResults, Practice Repair, and FocusRecords as evidence.

### Do not confuse Focus with learning

Time spent is not proof of learning. Focus Sessions are useful when connected to meaningful StudyActivity and reflection, not as a standalone productivity metric.
