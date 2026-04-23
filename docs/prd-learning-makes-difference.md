# PRD: Learning Makes Difference

## Problem Statement

Studying effectively is hard. Most note-taking tools capture information but do nothing to help you actually retain it. Barbara Oakley's research shows that recall practice, chunking concepts into small units, and anchoring ideas to metaphors are among the most effective techniques for deep learning — yet no app combines all of these in a single focused tool. Learners who study across diverse domains (software engineering, sleep, nutrition, etc.) also lack a flexible way to organize knowledge that mirrors how concepts actually relate to each other.

## Solution

A web app that lets users capture knowledge as small, focused Notes, enrich each Note with Metaphors and Acronyms as memory aids, organize Notes under a flexible DAG of Labels, and test their recall through FlashCard-style Recall Sessions where the Note content starts hidden and can be revealed later for review and self-assessment. The app supports multiple users and is designed to be accessible (WCAG 2.1 AA) and multi-language from day one. AI-assisted recall is explicitly deferred to a later version.

## User Stories

### Notes & Knowledge Capture

1. As a learner, I want to create a Note for a single concept, so that I can capture ideas in focused, retrievable chunks.
2. As a learner, I want to give my Note a title and a body, so that I can describe the concept clearly.
3. As a learner, I want to edit an existing Note, so that I can refine my understanding over time.
4. As a learner, I want to delete a Note I no longer need, so that my knowledge base stays relevant.
5. As a learner, I want to search my Notes by Note title/body and attached Metaphors/Acronyms, so that I can quickly find what I'm looking for even when I remember the memory aid better than the Note text.
6. As a learner, I want to see all Notes belonging to a Label, so that I can browse by topic.

### Metaphors

7. As a learner, I want to add a Metaphor to a Note, so that I can anchor the concept to something familiar.
8. As a learner, I want each Metaphor to have a title and an explanation, so that I can describe both what the metaphor is and why it maps to the concept.
9. As a learner, I want to add multiple Metaphors to a single Note, so that I can capture different angles of understanding without broadening the Note beyond one retrievable idea.
10. As a learner, I want to edit a Metaphor, so that I can improve it as my understanding deepens.
11. As a learner, I want to delete a Metaphor, so that I can remove ones that no longer resonate.
12. As a learner, I want to see all Metaphors for a Note in one place, so that I can review all my mental anchors together.

### Acronyms

13. As a learner, I want to add an Acronym to a Note, so that I have a mnemonic to trigger recall.
14. As a learner, I want to define what each letter of the Acronym stands for, so that the mnemonic is fully documented.
15. As a learner, I want to add multiple Acronyms to a single Note, so that I can try different mnemonics without turning the Note into a bundle of separate concepts.
16. As a learner, I want to edit an Acronym, so that I can refine it.
17. As a learner, I want to delete an Acronym, so that I can remove ones I no longer use.

### Labels & Organisation

18. As a learner, I want to create a Label, so that I can group related Notes together.
19. As a learner, I want to assign a Note to one or more Labels, so that a concept can belong to multiple domains simultaneously.
20. As a learner, I want to nest Labels under other Labels, so that I can build a hierarchy like "Software Engineering → Frontend → React".
21. As a learner, I want a Label to have multiple parent Labels, so that cross-cutting concepts (e.g. "React" under both "Frontend" and "JavaScript") are represented accurately.
22. As a learner, I want to rename a Label, so that I can improve my taxonomy over time.
23. As a learner, I want to delete a Label, so that I can remove topics I no longer study.
24. As a learner, I want to browse the Label graph visually, so that I can see how my domains relate to each other.
25. As a learner, I want to see all Notes under a Label including Notes from child Labels, so that I get a complete view of a topic.

### Recall Sessions

26. As a learner, I want to start a Recall Session on a Label, so that I can test my memory across all Notes in that topic.
27. As a learner, I want the session to cover Notes from all descendant Labels automatically, so that choosing "Frontend" also tests me on "React" and "CSS".
28. As a learner, I want to start a FlashCard Recall Session without configuring any AI provider, so that recall practice works out of the box in v1.
29. As a learner, I want the session to include each matching Note only once even when it is reachable through multiple Label paths, so that cross-cutting Notes are not over-tested.
30. As a learner, I want FlashCard mode to show only the Note title and hide the content at first, so that I can attempt recall before revealing the answer.
31. As a learner, I want to reveal the Note content in FlashCard mode and then self-rate my recall, so that the session history remains useful.
32. As a learner, I want Notes to appear in random order during a session, so that I do not memorize sequence instead of concepts.
33. As a learner, I want to move through Notes one at a time during a session, so that I focus on one concept at a time.
34. As a learner, I want to see how many Notes remain in the session, so that I know my progress.
35. As a learner, I want to end a session early, so that I'm not forced to complete it if I run out of time.
36. As a learner, I want a partially completed session to still be saved when I have answered at least one question, so that my practice history is not lost.

### Session History

37. As a learner, I want every completed Recall Session to be saved, so that I have a full history of my practice.
38. As a learner, I want to see when a session happened, which Label I tested, and how many Notes I covered, so that I can track my study habits.
39. As a learner, I want to see every Question from a past session along with my answer, score, and the Note snapshot used at the time, so that later Note edits do not make old results confusing.
40. As a learner, I want to filter session history by Label, so that I can track progress in a specific domain.

### Users & Authentication

41. As a new user, I want to register with email and password, so that I can access the app securely.
42. As a returning user, I want to log in with my email and password, so that I can access my Notes.
43. As a user, I want my password stored securely, so that my account is safe if there is a data breach.
44. As a user, I want to update my display name, so that the app feels personal.
45. As a user, I want to update my email or password, so that I can maintain my account.
46. As a user, I want to set my interface language, so that the app UI matches how I prefer to navigate software.
47. As a user, I want to set my study language, so that the content I write and review can reflect the language I am studying in.

### Accessibility & Internationalisation

48. As a user with a keyboard-only workflow, I want to navigate the entire app without a mouse, so that I can use it accessibly.
49. As a user with a screen reader, I want all interactive elements to have appropriate ARIA labels, so that I can use the app independently.
50. As a user with low vision, I want the app to meet WCAG 2.1 AA color contrast requirements, so that content is always readable.
51. As a non-English speaker, I want the UI to eventually support my language, so that the app is accessible to me.

## Implementation Decisions

### Modules

**Auth Module**
- Handles registration, login, session management, and password hashing (argon2).
- Uses server-managed sessions with secure HTTP-only cookies.

**User Module**
- Manages User profiles: display name, interface language, and study language.
- Thin CRUD over the User entity.

**Label Module**
- Manages the Label DAG: create, rename, delete, parent/child relationships.
- Provides a query to resolve all descendant Note IDs for a given Label (used by Recall), deduplicated by `note_id`, using recursive database queries over the adjacency list in v1.
- Validates that adding a parent edge does not create a cycle.

**Note Module**
- Manages Notes: create, edit, delete, and simple substring search by Note title/body plus attached Metaphors and Acronyms.
- Owns Metaphors and Acronyms as child entities (cascade delete with Note).
- Manages Note↔Label assignments.
- Allows unlabeled Notes in v1, but those Notes are not recallable until assigned to at least one Label.

**Recall Module**
- Orchestrates RecallSessions: start, progress through Questions, end.
- Resolves which Notes to include (Label + descendants via Label Module), deduplicates them, randomizes order, and snapshots the selected Notes at session start.
- Persists SessionResult with full Question/answer/score history plus Note snapshots.
- Treats a session ended after at least one attempted Question as completed; discards sessions with zero attempts.

### Architecture

- Web app: React frontend, REST API backend.
- V1 is a single deployable full-stack web app rather than separately deployed frontend and backend services.
- The implementation target is an SSR-capable TypeScript full-stack framework; the exact framework will be chosen in a follow-up stack decision.
- PostgreSQL is the v1 system of record.
- Use an ORM or query builder for routine CRUD, but write explicit SQL for recursive label traversal and any query that becomes awkward or opaque through the abstraction.
- V1 uses no separate blob or object storage; all persisted application data lives in PostgreSQL.
- Multi-user from day one — all data is scoped to a User.
- All relationships are ownership-local to a single User; Notes can only be assigned to Labels owned by the same User.
- All server-side data access must scope by authenticated `user_id` at query time; v1 should avoid any fetch-first-authorize-later pattern.
- Label relationships stored as an adjacency list (label_id, parent_label_id) with cycle detection on write.
- Use foreign keys and `ON DELETE CASCADE` for true dependent records, while keeping business rules about whether a delete is allowed in application code.
- Passwords hashed with argon2id.
- HTTPS enforced; no secrets in client-side code.
- V1 includes basic structured server logging for auth events, RecallSession lifecycle events, and unexpected errors.
- i18n library integrated from day one (e.g. i18next); all UI strings externalised.
- In v1, deleting active Notes, Labels, Metaphors, and Acronyms is a hard delete. History is preserved only through SessionResult snapshots.
- In v1, Note edits overwrite the current Note in place; separate Note version history is out of scope.
- In v1, search is simple substring matching rather than full-text search with ranking.
- Environment configuration should use a schema-driven approach such as Varlock instead of relying on a plain committed `.env.example` plus ad hoc local `.env` conventions.
- AI-assisted recall, AI grading, provider integration, and BYOK are deferred to v1.1 or later.

### Schema (logical)

Logical schema shown here is intended for PostgreSQL.

- `users`: id, email, password_hash, display_name, interface_language, study_language
- `labels`: id, user_id, name
- `label_edges`: parent_label_id, child_label_id (adjacency list for DAG)
- `notes`: id, user_id, title, body
- `note_labels`: note_id, label_id
- `metaphors`: id, note_id, title, explanation
- `acronyms`: id, note_id, letters, expansion (each letter + meaning)
- `recall_sessions`: id, user_id, label_id, mode, started_at, ended_at, attempted_count, completed_count
- `session_questions`: id, session_id, note_id, note_title_snapshot, note_body_snapshot, prompt_type, user_answer, score, score_source

## Testing Decisions

A good test verifies observable behaviour from the outside — what goes in, what comes out, what side effects are produced — without caring how the internals achieve it. Tests should not assert on private methods, implementation details, or internal state that isn't externally visible.

### Modules to test

**Label Module** — highest priority. The DAG traversal (find all descendants) and cycle detection are non-trivial logic with clear inputs/outputs. Unit test with an in-memory graph.

**Recall Module** — test session creation (correct Notes selected for a Label + descendants, deduplicated, randomized, and snapshotted), session progression, FlashCard self-rating, partial-session persistence, and result persistence. Integration test against a real database.

**Auth Module** — test registration (duplicate email rejection, password hashing) and login (correct/incorrect password).

**Note Module** — test CRUD operations, unlabeled Note behaviour, and search across Note/Metaphor/Acronym content. Integration tests against a real database.

## Out of Scope

- Spaced repetition scheduling / automated reminders (future)
- FocusSession / pomodoro tracking is specified separately in `docs/prd-focus-sessions.md`
- Per-use credit billing and payment infrastructure
- Mobile app or Electron wrapper (future)
- Sharing Notes or Labels between Users
- Collaborative or social features
- Offline-first / local storage mode
- Image or file attachments on Notes
- Rich text / markdown rendering in Note body (plain text first)
- UI translations (i18n infrastructure is in scope; actual translated strings are not)
- AI-assisted recall and AI grading
- BYOK / premium access model

## Further Notes

- The app is named **Learning Makes Difference**.
- Domain language is fully defined in `CONTEXT.md` — use those terms precisely throughout the codebase.
- FocusSession / pomodoro requirements are tracked in the separate PRD `docs/prd-focus-sessions.md` so the study-timer domain can evolve independently.
- WCAG 2.1 AA compliance is a hard requirement recorded in `docs/adr/0001-wcag2-accessibility.md`.
- Tech stack has not yet been decided — a follow-up session will cover this before implementation begins.
- The initial user base is two people (Bruno and his girlfriend); the architecture must support multi-tenancy from day one for future public release.

## Proposed V1 Scope

### Must-Have For V1

- User registration, login, logout, and authenticated sessions
- User profile management for display name and interface language
- Create, edit, delete, and search Notes
- Create, edit, delete, and assign Labels, including parent/child Label relationships
- Create, edit, and delete Metaphors and Acronyms attached to a Note
- Browse Notes by Label, including descendant Labels
- Start a FlashCard RecallSession from a Label
- Deduplicated, randomized RecallSession note selection
- Reveal answer and self-rate recall in FlashCard sessions
- End sessions early and persist partial SessionResults after at least one attempted Question
- Session history with stored Note snapshots
- Ownership-safe multi-user data scoping
- WCAG 2.1 AA compliance for the implemented UI surfaces

### Nice-To-Have If Time Allows In V1

- Visual Label graph browser
- Profile setting for study language before AI features exist
- More polished session-history filtering and review UX
- Strong empty states and onboarding hints for unlabeled Notes

### Explicitly Deferred To V1.1+

- AiAssisted RecallMode
- AiGraded RecallMode
- BYOK / premium access model
- AI provider integration and prompt contracts
- Richer search relevance or full-text search
- Note version history
- Recall of unlabeled Notes
- UI translations beyond the base language

## Stack Selection Criteria

- Must work well as a single deployable SSR-capable TypeScript full-stack app
- Must support server-managed cookie sessions cleanly
- Must fit PostgreSQL well
- Must allow pragmatic use of ORM/query-builder plus explicit SQL
- Must not force a separate backend service for v1
- Must be straightforward to deploy and maintain for a small initial user base
