# PRD: Learning Makes Difference

## Problem Statement

Studying effectively is harder than merely collecting information. Most tools are good at storing notes but weak at helping a learner retain, organize, and actively retrieve what they studied. Learning Makes Difference needs to support a study workflow centered on small Notes, memory aids, topic organization through a Label DAG, and RecallSessions that turn saved knowledge into deliberate retrieval practice.

The product also needs to stay disciplined about language and scope. FocusSessions are part of the broader product, but they are already specified separately and should not blur the main knowledge-and-recall workflow captured here.

## Solution

Learning Makes Difference is a multi-user web app where each User captures one concept per Note, enriches Notes with Metaphors and Acronyms, organizes Notes through Labels that can have multiple parents, and starts RecallSessions from any Label to practice retrieval across that Label and its descendants.

The v1 experience should feel like one coherent study workspace rather than a collection of disconnected CRUD screens. The authenticated shell should support Notes, Labels, Recall, History, and Settings as first-class product areas, with accessibility and future internationalization built in from the start. Recall in this PRD is `FlashCard`-first; AI-powered recall modes remain deferred.

## User Stories

1. As a learner, I want to create a Note for one concept, so that my knowledge stays focused and recallable.
2. As a learner, I want each Note to have a title and body, so that I can capture both the label and the explanation of the concept.
3. As a learner, I want to edit a Note, so that I can refine my understanding over time.
4. As a learner, I want to delete a Note, so that I can remove stale or mistaken material.
5. As a learner, I want to browse my Notes in the authenticated workspace, so that my study material feels organized instead of scattered.
6. As a learner, I want to search Notes by their own content, so that I can find concepts quickly.
7. As a learner, I want Note search to include attached Metaphors and Acronyms, so that I can find a concept from the memory aid I remember first.
8. As a learner, I want a Note to belong to multiple Labels, so that one concept can live in multiple study contexts.
9. As a learner, I want Notes to be allowed without Labels initially, so that I can capture ideas quickly before organizing them.
10. As a learner, I want unlabeled Notes excluded from RecallSessions, so that recall stays grounded in intentional study areas.
11. As a learner, I want to add a Metaphor to a Note, so that I can anchor the concept to something familiar.
12. As a learner, I want a Metaphor to have both a title and explanation, so that the mapping to the concept is explicit.
13. As a learner, I want multiple Metaphors on a Note, so that I can keep alternative memory hooks for the same concept.
14. As a learner, I want to edit and delete Metaphors, so that weak memory aids can be improved or removed.
15. As a learner, I want to add an Acronym to a Note, so that I can create a compact mnemonic for recall.
16. As a learner, I want each Acronym to preserve what its letters stand for, so that the mnemonic remains useful later.
17. As a learner, I want multiple Acronyms on a Note, so that I can try different mnemonic approaches.
18. As a learner, I want to edit and delete Acronyms, so that they evolve with my understanding.
19. As a learner, I want to create a Label, so that I can group related Notes.
20. As a learner, I want to rename and delete Labels, so that my study taxonomy can evolve.
21. As a learner, I want Labels to support parent-child relationships, so that I can model broad and narrow study areas.
22. As a learner, I want a Label to have multiple parents, so that cross-cutting subjects are represented accurately.
23. As a learner, I want the Label graph to remain a DAG, so that the organization model stays valid and traversable.
24. As a learner, I want to see Notes directly attached to a Label, so that I can inspect a topic’s immediate material.
25. As a learner, I want to see Notes reachable through descendant Labels, so that broader topic views feel complete.
26. As a learner, I want to start a RecallSession from a Label, so that I can practice a chosen study area deliberately.
27. As a learner, I want a RecallSession to include Notes from descendant Labels automatically, so that broader Labels work as study launch points.
28. As a learner, I want each reachable Note included only once per RecallSession, so that DAG overlaps do not cause duplicate practice.
29. As a learner, I want RecallSession Notes randomized, so that I am recalling concepts rather than memorizing order.
30. As a learner, I want `FlashCard` mode to hide the Note body at first, so that I attempt retrieval before seeing the answer.
31. As a learner, I want to reveal the Note content when I am ready, so that I can review the correct material.
32. As a learner, I want to self-rate my recall after revealing the Note, so that the session result captures how well I remembered it.
33. As a learner, I want to move through one Question at a time, so that recall stays focused.
34. As a learner, I want to see progress during a RecallSession, so that I know how much remains.
35. As a learner, I want to end a RecallSession early, so that I am not forced to finish every session.
36. As a learner, I want a session with at least one attempted Question saved as a SessionResult, so that partial practice still contributes to my history.
37. As a learner, I want a session with zero attempts discarded, so that accidental starts do not pollute my history.
38. As a learner, I want SessionResults to preserve Note snapshots, so that later edits do not rewrite what happened in past study sessions.
39. As a learner, I want to review past SessionResults, so that I can understand my study history.
40. As a learner, I want History to show when a session happened, which Label it targeted, and how many Questions I attempted, so that the past session list is useful at a glance.
41. As a learner, I want to open a past SessionResult and inspect the stored Questions, answers, scores, and Note snapshots, so that the historical review is trustworthy.
42. As a learner, I want to filter study history by Label, so that I can evaluate a particular area of study.
43. As a new User, I want to register securely, so that my data is private to my account.
44. As a returning User, I want to log in and resume the authenticated workspace, so that I can continue studying where I left off.
45. As a User, I want server-managed authenticated sessions, so that protected routes are enforced consistently.
46. As a User, I want my password stored securely, so that a database leak does not expose plain credentials.
47. As a User, I want all Notes, Labels, RecallSessions, and history scoped to my account, so that users cannot cross-access each other’s data.
48. As a User, I want to update my display name, so that the workspace reflects my identity.
49. As a User, I want interface language settings prepared from the start, so that internationalization does not become a retrofit.
50. As a User, I want study language settings prepared from the start, so that the product can support multilingual study workflows later.
51. As a keyboard-only user, I want to navigate the workspace and RecallSession flow without a mouse, so that the product is accessible.
52. As a screen-reader user, I want landmarks, labels, and control names to be explicit, so that study workflows remain independently usable.
53. As a low-vision user, I want the interface to meet WCAG 2.1 AA contrast and focus requirements, so that long study sessions remain readable.
54. As a learner, I want the main product areas to feel consistent inside the authenticated shell, so that Notes, Labels, Recall, History, and Settings behave like parts of one study system.

## Implementation Decisions

- The product remains a single TanStack Start web application with SSR-capable routing, protected/public route areas, and one authenticated shell that hosts the main product modules.
- The Notes area should own Note CRUD, search, Note-to-Label assignment, and the dependent child entities Metaphor and Acronym.
- The Labels area should own Label CRUD, parent-child relationships, DAG validation, descendant traversal, and topic-centric browsing behavior.
- The Recall area should own RecallSession lifecycle: session setup, note resolution from a target Label, deduplication across DAG paths, random ordering, question progression, answer reveal, self-rating, and early termination.
- The History area should own SessionResult retrieval and review flows, including session summaries and question-level historical detail.
- The Settings area should own account profile editing, session/account controls, and future language preferences.
- Auth should be implemented with server-managed sessions and ownership-safe data access for every protected operation.
- All server-side data access must scope directly by authenticated `user_id`; business rules should not rely on fetch-first-authorize-later patterns.
- Labels must remain a DAG. Writes that would introduce a cycle should be rejected at the application boundary before persistence succeeds.
- RecallSession note selection should resolve the chosen Label plus all descendants, deduplicate by Note identity, and snapshot the selected material when the session starts.
- `FlashCard` is the only in-scope RecallMode for this PRD’s implementation target. `AiAssisted`, `AiGraded`, and BYOK remain deferred.
- SessionResult persistence should happen only after at least one attempted Question. Zero-attempt sessions should be discarded.
- Historical review should rely on stored snapshots, not live Note reads, so that later content edits do not mutate past results.
- Search in v1 should be pragmatic substring matching across Note text plus attached Metaphor and Acronym content rather than full-text ranking.
- Internationalization infrastructure should be wired from day one, but translated copy beyond the base language is not required in v1.
- Accessibility is a hard product requirement, not a polish task. The existing shell’s landmarks, focus handling, and navigation behavior set the baseline for future surfaces.
- The current route structure already reserves first-class product areas for `/notes`, `/labels`, `/recall`, `/history`, and `/settings`; implementation should deepen those routes rather than inventing parallel navigation.
- FocusSessions are explicitly separate from this PRD and remain governed by `docs/prd-focus-sessions.md`. This file should not absorb timer-domain behavior.

## Testing Decisions

- A good test verifies externally observable behavior: what the user or route boundary does, what data is returned or persisted, and what protected outcomes occur. Tests should avoid asserting on internal helpers, implementation-only state, or incidental DOM structure.
- The authenticated shell and route protection should continue to be tested as integration behavior, following existing tests that verify protected redirects, sidebar behavior, and accessible navigation.
- The Labels module should have strong tests around DAG rules, especially descendant traversal and cycle rejection, because this logic is central to both browsing and recall setup.
- The Recall module should be tested for note selection from a target Label, deduplication across multiple DAG paths, randomized ordering constraints, reveal/self-rating flow, partial session persistence, and zero-attempt discard behavior.
- The Notes module should be tested for CRUD behavior, search behavior across Notes plus child memory aids, and ownership-safe Label assignment.
- The History module should be tested for SessionResult summaries, question-level review, filtering behavior, and snapshot correctness after Note edits.
- The Auth and session boundary should be tested for registration, login, protected route access, and account-scoped data isolation.
- Testing prior art already exists in the repository around route-tree stability, environment contracts, design-system foundations, and authenticated shell behavior. New tests should follow that style: integration-oriented where route behavior matters, isolated domain tests where the logic is deep and stable.

## Out of Scope

- FocusSession timing, FocusRecord analytics, and timer-domain behavior covered by `docs/prd-focus-sessions.md`
- `AiAssisted` and `AiGraded` RecallModes
- BYOK and premium billing mechanics
- Rich text editing, markdown rendering, or file attachments on Notes
- Social sharing, collaboration, or multi-user shared workspaces
- Mobile-native apps or offline-first synchronization
- Automatic spaced repetition scheduling and reminder systems
- Full-text search relevance tuning beyond pragmatic substring matching
- Retroactive Note version history outside the snapshots preserved in SessionResults
- A visual Label graph explorer, unless later promoted from nice-to-have into committed scope

## Further Notes

- Canonical product language lives in `CONTEXT.md`. Terms such as Note, Label, RecallSession, Question, SessionResult, FocusSession, and FocusTarget should be used precisely and consistently.
- The existing UI foundation and layout references establish the intended product shell direction, but this PRD is primarily about product behavior and scope rather than pixel-perfect layout prescription.
- The current application already has the right top-level shell shape for the product. The main implementation task is to replace placeholders with domain behavior without breaking accessibility, route clarity, or the dense study-workspace feel already established in the foundation docs.
