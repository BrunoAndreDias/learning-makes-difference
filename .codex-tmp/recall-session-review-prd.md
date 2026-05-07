## Problem Statement

The Recall Section currently reviews a completed SessionResult in a way that feels duplicated and semantically muddy, especially for FlashCard results. In the current Session review, the Notes used section and the Questions and answers section often restate the same single-note result, the selected-result footer repeats start-new-recall actions that already exist in the master panel, and FlashCard percentages are presented as if they were objective scores even though they are only derived from the learner's self-rating. The result is a review flow that feels bloated, weakens the question-first nature of active recall, and makes it harder for the User to understand what actually happened in the RecallSession.

## Solution

Redesign SessionResult review in the Recall Section to be question-first, compact by default, and explicit about FlashCard self-assessment. The selected result pane becomes Session review, with Questions as the primary section. Each Question starts collapsed, shows the prompt first, keeps a visible expand affordance, and displays the FlashCard self-rating as a trailing pill using the existing Forgot/Hard/Good/Easy vocabulary. Expanding a Question reveals Your answer, the repeated self-rating, and the Reference note snapshot used during the RecallSession. Per-Question FlashCard score is removed. At the session level, the existing score slot becomes Session self rating using the same percentage and icon progression, while not-reached targeted Notes only appear in a lightweight Not reached notes section when the session ended early.

## User Stories

1. As a learner reviewing a SessionResult, I want Session review to focus on Questions first, so that I can revisit what I was actually asked and how I performed.
2. As a learner reviewing a FlashCard SessionResult, I want duplicate note and question sections removed, so that the review pane feels concise.
3. As a learner reviewing a single-note single-question SessionResult, I want the Note snapshot to stop appearing as a separate full section, so that I do not see the same information twice.
4. As a learner reviewing a multi-question SessionResult, I want each Question to start collapsed, so that I can scan the whole session before diving into details.
5. As a learner reviewing Questions, I want the Question prompt to be the main collapsed-row text, so that I can quickly remember what I was trying to answer.
6. As a learner reviewing FlashCard Questions, I want the self-rating word to stay visible in the collapsed row, so that I can judge performance at a glance.
7. As a learner reviewing FlashCard Questions, I want the self-rating shown as Forgot, Hard, Good, or Easy, so that the wording matches how I rated myself during the RecallSession.
8. As a learner reviewing FlashCard Questions, I want the self-rating shown as a subtle pill on the right, so that the prompt remains visually dominant.
9. As a learner reviewing a collapsed Question row, I want the expand affordance visible all the time, so that I know the row contains deeper historical detail.
10. As a learner reviewing Session review, I want no answer preview shown in collapsed rows, so that the list stays compact and question-first.
11. As a learner reviewing a Question, I want only one row expanded at a time, so that the page does not turn into a long dump of Note bodies.
12. As a learner opening a SessionResult, I want all Question rows collapsed by default, so that the review starts in scan mode rather than detail mode.
13. As a learner expanding a Question, I want to see Your answer first, so that the review starts with my attempt.
14. As a learner expanding a Question, I want to see the Reference note immediately after my answer, so that I can compare my attempt with the historical answer key.
15. As a learner expanding a Question, I want the full Note body shown immediately, so that I do not need a second reveal step.
16. As a learner who typed an answer, I want the full answer text preserved exactly as written, so that the historical review is faithful.
17. As a learner who did not type an answer, I want Session review to say No typed answer recorded, so that absence is explicit rather than ambiguous.
18. As a learner who did not type an answer, I still want the Question row to expand, so that I can review the Reference note even when my answer area is empty.
19. As a learner expanding a FlashCard Question, I want the self-rating repeated in expanded detail, so that I can review the full context without looking back to the collapsed header.
20. As a learner reviewing a FlashCard SessionResult, I want per-Question score removed, so that the UI does not imply an objective grade where none exists.
21. As a learner reviewing a FlashCard SessionResult, I want the session summary metric to be Session self rating instead of Score, so that the meaning is accurate.
22. As a learner reviewing a FlashCard SessionResult, I want Session self rating to stay in the current score slot with the current progress iconography, so that the layout still feels familiar.
23. As a learner reviewing a FlashCard SessionResult list, I want the result row to keep its compact bare percentage, so that the master list stays dense and scannable.
24. As a learner reviewing a selected FlashCard SessionResult, I want the header label to say Session self rating, so that it is clearly different from per-Question self-rating.
25. As a learner reviewing a FlashCard SessionResult on a larger layout, I want self-rating distribution to appear when it fits, so that I can understand how the aggregate was formed.
26. As a learner reviewing a FlashCard SessionResult on a tighter layout, I want only the aggregate Session self rating shown, so that the stat area does not become bloated.
27. As a learner reviewing an early-ended SessionResult, I want the compact summary line to make partial coverage explicit, so that I know not all targeted Notes were reached.
28. As a learner reviewing a fully attempted SessionResult, I want the compact summary line to stay simple, so that ordinary sessions remain easy to scan.
29. As a learner reviewing the stat strip, I want the label Questions instead of Questions attempted, so that the header stays compact.
30. As a learner reviewing the selected result pane, I want the heading Session review, so that the purpose of the pane is clearer than Result details.
31. As a learner reviewing the main body section, I want the heading Questions, so that the collapsed default state is described honestly.
32. As a learner reviewing an early-ended SessionResult, I want not-reached targeted Notes surfaced separately, so that I can see what the RecallSession never reached.
33. As a learner reviewing a completed SessionResult, I do not want attempted Notes repeated in a second note list, so that Questions remain the primary evidence.
34. As a learner reviewing an early-ended SessionResult, I want the fallback note section titled Not reached notes, so that I immediately understand why it exists.
35. As a learner reviewing Not reached notes, I want only note titles shown, so that the exception section stays lightweight.
36. As a learner reviewing a fully reached SessionResult, I do not want an empty Not reached notes section, so that the pane does not include meaningless placeholders.
37. As a learner using the Recall Section, I want Start Recall to stay in the master panel rather than the selected result footer, so that starting a new RecallSession stays in one place.
38. As a learner reviewing a SessionResult, I do not want Back to selection and Start another recall duplicated in the selected result footer, so that the detail pane remains read-only review.
39. As a learner using Recall results on desktop, I want the redesigned review surface to stay scannable in the existing master-detail layout, so that the left result list and right review pane still work together.
40. As a learner using Recall results on smaller layouts, I want the new review content to degrade gracefully without stat overflow or duplicated note content, so that the page remains usable on tighter screens.
41. As a keyboard-only learner, I want collapsed and expanded Question rows to remain operable and understandable, so that reviewing SessionResults does not require a mouse.
42. As a learner trusting historical review, I want the Reference note to come from the stored SessionResult snapshot rather than the current live Note, so that later Note edits do not rewrite history.
43. As a learner reviewing a SessionResult created after ending a RecallSession early, I want Questions and Not reached notes together to explain exactly what I attempted and what I never reached, so that the record is trustworthy.
44. As a learner reviewing a FlashCard SessionResult with mixed self-ratings, I want the aggregate Session self rating to reflect the derived average of those self-ratings, so that the top-line percentage matches the underlying Question outcomes.
45. As a learner reviewing Results over time, I want the FlashCard list rows and selected Session review to use the same aggregate meaning, so that percentages do not change interpretation between master and detail.

## Implementation Decisions

- The Recall results master-detail workspace remains the canonical SessionResult review surface inside the Recall Section.
- SessionResult review is question-first. Targeted Notes are supporting context and should not compete visually with Questions.
- The selected-result pane is renamed from Result details to Session review.
- The primary review section is renamed from Questions and answers to Questions.
- The selected-result footer actions are removed. Starting a new RecallSession remains the responsibility of the master-panel Start Recall action.
- FlashCard SessionResult review removes per-Question numeric score from the Questions list and expanded detail.
- FlashCard SessionResult review keeps a session-level aggregate percentage in the current score slot, but relabels it as Session self rating and treats it as a derived self-assessment metric rather than an independent grade.
- The Results list row for FlashCard keeps the compact bare percentage value for density, but that percentage still means average Session self rating.
- The selected-result stat strip keeps FlashCard as the mode pill label and shortens Questions attempted to Questions.
- Fully attempted SessionResults keep the simpler compact summary line. Early-ended SessionResults explicitly call out attempted Question coverage against the broader targeted Note set.
- The Questions list becomes a single-open-row accordion and starts with all rows collapsed.
- Each collapsed Question row shows the Question prompt as primary content, a visible expand affordance, and a trailing self-rating pill using Forgot, Hard, Good, and Easy.
- Collapsed Question rows omit answer preview text entirely.
- Expanded Question detail repeats the self-rating and presents content in this order: Your answer, then Reference note.
- If a typed answer exists, expanded detail shows it in full as written. If none exists, expanded detail says No typed answer recorded.
- Expanded Question detail always shows the full Reference note body immediately, with no second reveal step.
- Even when no typed answer was recorded, the attempted Question row remains expandable so the Reference note is still reviewable.
- A separate note section is never used to repeat attempted Notes already represented by Questions.
- The only supporting note section allowed in Session review is Not reached notes, and it appears only when targeted Notes were not reached before the RecallSession ended.
- Not reached notes lists only note titles and stays absent when every targeted Note was reached.
- No schema changes are required. Existing SessionResult, Question, attempts, and Note snapshot data are sufficient for the redesign.
- No server contract changes are required. The redesign is driven by presentation logic and projection of existing SessionResult data into review-specific UI state.
- The implementation should favor extracting a deep review-presentation module that derives review rows, Session self rating summary, early-ended summary language, and not-reached Note projection from SessionResult. The route component should render those projections rather than embedding all decision logic inline.
- The styling update should preserve the established Recall Section look while removing duplicated note cards, clarifying hierarchy, and preventing bloated layouts on tighter screens.

## Testing Decisions

- Good tests should assert external behavior and visible review outcomes, not internal state shape or helper implementation details.
- The Recall results review projection module should be tested in isolation for FlashCard aggregate self-rating derivation, early-ended session coverage rules, collapsed/expanded Question row data, and not-reached Note projection.
- The Recall results workspace behavior should be tested through route-level UI tests that cover Session review headings, stat labels, collapsed-by-default Questions, single-open-row accordion behavior, expanded Your answer and Reference note ordering, No typed answer recorded copy, and conditional Not reached notes rendering.
- FlashCard-specific review semantics should be tested to confirm per-Question score disappears while Session self rating remains in the header slot and the compact result row percentage still renders.
- Responsive review presentation should be tested where practical by asserting behavior that does not depend on brittle styling internals, especially around keeping optional self-rating distribution secondary to the required aggregate metric.
- Existing Recall results and app-shell Recall interaction tests provide prior art for route-level workspace assertions.
- Existing result-summary-style tests provide prior art for isolated derivation logic around SessionResult summaries and partial completion.
- Existing Recall service and persistence tests already prove the underlying SessionResult snapshots and FlashCard attempt data; those tests should remain focused on persistence behavior rather than absorb UI review responsibilities.

## Out of Scope

- Changing RecallSession persistence, SessionResult storage schema, or Recall service contracts.
- Renaming FlashCard itself to alternate learner-facing wording.
- Reworking Recall selection flow, RecallSession question progression, or the Start Recall entry point outside the selected-result footer removal.
- Introducing note-level editing, deletion, or mutation actions inside Session review.
- Adding new scoring models, spacing logic, or Learning State behavior.
- Expanding AI Assisted or AI Graded review semantics beyond what is necessary to keep the Recall results workspace coherent.
- Adding a second-level Note reveal inside expanded Question detail.
- Turning the Results list into a route-per-result experience.

## Further Notes

- The domain glossary in CONTEXT.md has already been updated with the durable language decisions behind this redesign, including Session review, Questions, Session self rating, Reference note, No typed answer recorded, and Not reached notes.
- The most important implementation risk is letting view logic stay scattered inside the route component. The redesign has enough presentation rules that a dedicated review-projection module is justified.
- The product intent is to make SessionResult review feel like trustworthy recall evidence, not like a generic analytics pane. Question-first hierarchy is the central constraint that should break ties when design tradeoffs appear during implementation.
