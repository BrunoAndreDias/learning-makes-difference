# Learning Makes Difference

A personal study app inspired by Barbara Oakley's learning research. Users capture knowledge as Notes, attach Metaphors and Acronyms as memory aids, test recall through RecallSessions, and structure focused study time through FocusSessions.

## Language

### Core Knowledge Units

**Note**:
A single concept or idea — small enough to have one coherent metaphor. Not a page summary or chapter dump.
If a concept has distinct sub-parts that need separate recall prompts or separate memory aids, those sub-parts should be captured as separate Notes and related through shared Labels.
_Avoid_: Card, entry, document, record

**Metaphor**:
A title + explanation that maps a Note's concept onto something familiar. A Note can have many Metaphors; a Metaphor cannot exist without its Note.
Having several Metaphors can be useful, but an excessive number is usually a sign that the Note is too broad and should be split into separate Notes.
_Avoid_: Analogy (use Metaphor), description

**Acronym**:
A memory-aid mnemonic created by the user — a short word or phrase where each letter stands for something, attached to a Note. A Note can have many Acronyms; an Acronym cannot exist without its Note.
Having several Acronyms can be useful, but an excessive number is usually a sign that the Note is too broad and should be split into separate Notes.
_Avoid_: Abbreviation, term definition

**Label**:
A named concept used to group Notes. Labels form a DAG — a Label can have multiple parent Labels and multiple child Labels. A Note can belong to multiple Labels directly.
_Avoid_: Tag, category, folder, topic, study field

### Recall

**RecallSession**:
A user-initiated event where the user is tested on Notes belonging to a chosen Label (and all its descendants). The Note content starts hidden; depending on the RecallMode, the user may reveal it later to self-assess or review the answer.
When the chosen Label reaches the same Note through multiple Label paths, that Note is included only once in the RecallSession.
For `AiAssisted` and `AiGraded`, the User chooses the question style for the session up front: `open-ended`, `multiple-choice`, or `mixed`.
Notes are presented in random order within the RecallSession.
A RecallSession snapshots its target Notes and generated Questions at the moment the session starts, so later edits or deletions do not change that in-progress session.
_Avoid_: Review session, quiz, test

**RecallMode**:
The style of a RecallSession. One of three values:
- `FlashCard` — Note is hidden; user toggles to reveal, then self-rates their recall. No AI. Free.
- `AiAssisted` — AI generates a question; user answers; user self-assesses by toggling the Note. Premium.
- `AiGraded` — AI generates a question; user answers; AI grades the answer against the Note and suggests fixes. Premium.
If the AI provider fails for a Note during `AiAssisted` or `AiGraded`, that Note falls back to `FlashCard` behaviour for the current RecallSession and the session continues.
_Avoid_: Mode, difficulty, tier

**Question**:
A prompt generated for a Note during a RecallSession. Can be open-ended or multiple choice. Stores the user's answer and a score. Belongs to exactly one RecallSession and one Note.
In `FlashCard`, the score is a user self-rating rather than an AI grade.
In `AiGraded`, the score is the AI-generated system score for v1. User overrides are out of scope for now, but can be added later as a separate final score without changing the meaning of the Question itself.
For multiple-choice Questions, distractors should be context-bound and plausible within the selected study area rather than arbitrary invented wrong answers.

**SessionResult**:
The persistent record of a completed RecallSession — when it happened, which Label was targeted, how many Notes were covered, and the full list of Questions with answers and scores.
_Avoid_: History, log, summary
A RecallSession is considered completed and gets a SessionResult when the user has attempted at least one Question, even if they end the session early before covering every Note. A session with zero attempted Questions is discarded.
Each stored Question in a SessionResult preserves the Note title and Note body snapshot used at the time of the session, so later Note edits do not change historical results.

### Focus

**FocusSession**:
A user-initiated block of focused study time that can run while the user is taking Notes, reviewing Notes, or doing a RecallSession.
_Avoid_: Pomodoro session, timer, recall timer

**FocusMethod**:
The timing pattern used by a FocusSession, with `Pomodoro` as the default method in v1.
_Avoid_: Timer type, mode

**FocusInterval**:
A completed timed work round inside a FocusSession.
_Avoid_: Pomodoro session, round, streak

**BreakInterval**:
A timed rest period between FocusIntervals inside a FocusSession.
_Avoid_: Pause, idle time

**FocusRecord**:
The persistent record of a completed FocusSession, including its time boundaries and the study context the User says they worked on.
_Avoid_: Log, history, timer log

**FocusTarget**:
A study context associated with a FocusSession, such as a Label, a RecallSession, or unlabeled Note work.
_Avoid_: Goal, task, bucket

**StudyActivity**:
An interaction that counts as meaningful work during a FocusSession and can produce or reinforce a FocusTarget.
_Avoid_: Click, page view, navigation event

### Users & Access

**User**:
A person with an account. Has email, hashed password, display name, interface language, study language, and an encrypted API key for BYOK premium features.
_Avoid_: Account, member, profile

**BYOK** (Bring Your Own Key):
The current premium access model. A User supplies their own AI provider API key; the app uses it for AiAssisted and AiGraded RecallModes. Future model: per-use credits.

### Workspace Navigation

**App Sidebar**:
The primary workspace navigation surface shown beside authenticated study screens.
_Avoid_: Menu rail, icon rail

**Collapsed App Sidebar**:
A hidden App Sidebar state where the workspace content reclaims the sidebar area.
_Avoid_: Mini sidebar, icon-only sidebar

**Sidebar Reopen Control**:
An icon-only frame header control that restores a Collapsed App Sidebar.
_Avoid_: Menu text button, secondary navigation button

## Relationships

- A **Label** can have zero or more parent **Labels** and zero or more child **Labels** (DAG, not a tree)
- A **Note** can belong to zero or more **Labels**
- A **Note** has zero or more **Metaphors** (cannot exist without their Note)
- A **Note** has zero or more **Acronyms** (cannot exist without their Note)
- Searching for a **Note** includes its own title and body plus the titles/content of its attached **Metaphors** and **Acronyms**, but the search result is still the **Note**.
- A **RecallSession** targets one **Label** and covers all **Notes** in that Label and its descendants
- In v1, only **Notes** reachable from the targeted **Label** are included in a **RecallSession**. Unlabeled **Notes** are not recallable until they are assigned to at least one **Label**.
- A **RecallSession** has exactly one **RecallMode**
- A **RecallSession** has a **SessionResult** — date, label, note count, and the full list of Questions with answers and scores
- A **Question** belongs to exactly one **RecallSession** and one **Note**
- A **Question** stores the user's answer and a score (self-rated or AI-graded depending on RecallMode)
- A **FocusSession** is separate from a **RecallSession** and may overlap with Note-taking, Note review, or a **RecallSession**
- A **FocusSession** has exactly one **FocusMethod**
- A **FocusSession** may contain multiple completed **FocusIntervals** and **BreakIntervals**
- A **FocusSession** may exist without a linked **RecallSession**, **Note**, or **Label**
- A **FocusSession** may have multiple **FocusTargets**
- A **FocusTarget** may refer to a **Label**, a **RecallSession**, or unlabeled Note work
- In v1, **FocusTargets** are captured automatically from the User's observed study activity during the **FocusSession**
- A **StudyActivity** must reflect meaningful study engagement, not incidental navigation
- A **FocusSession** may include study work done outside the app, but in v1 only in-app **StudyActivity** creates automatic **FocusTargets**
- A completed **FocusSession** has a **FocusRecord**
- In v1, a **FocusRecord** snapshots its **FocusTargets** as they were during the **FocusSession**; later Note or Label changes do not rewrite past focus history
- In v1, a **FocusRecord** is created only when the User completes at least one full focus interval; abandoned or early-stopped sessions are discarded
- In v1, a **FocusSession** ends only when the User explicitly ends it; automatic ending after long inactivity or long breaks is deferred
- Analytics primarily measure completed **FocusInterval** time; **BreakIntervals** are stored for secondary analysis
- A **RecallSession** that happens during a **FocusSession** counts as study activity inside that **FocusSession**, not as separate extra time on top of it
- In v1, analytics record which **FocusTargets** appeared in a **FocusSession**, but do not assign exact minutes to each target
- A **User** owns all their **Notes**, **Labels**, **Metaphors**, **Acronyms**, **RecallSessions**, and **FocusSessions**
- All relationships are ownership-local to a single **User**. A **Note** can only be assigned to **Labels** owned by the same **User**, and a **RecallSession** can only traverse that User's own Label graph.
- In v1, deleting active **Notes**, **Labels**, **Metaphors**, and **Acronyms** is a hard delete. Historical study records remain available only through the snapshots stored in **SessionResult**.
- The **App Sidebar** can be collapsed into a **Collapsed App Sidebar**, which is hidden rather than reduced to an icon-only rail.
- A **Sidebar Reopen Control** appears at the leading edge of the authenticated frame header only while the **App Sidebar** is collapsed.
- The **Sidebar Reopen Control** is workspace-wide and appears consistently across authenticated screens.
- The authenticated frame header owns workspace navigation affordances and page identity; individual routes own page-specific controls such as Note search, focus mode, view mode, and sorting.

## Example dialogue

> **Dev:** "When a **User** starts a **RecallSession** on the 'Frontend' **Label**, do we include **Notes** from child **Labels** like 'React'?"
> **Domain expert:** "Yes — the session covers the chosen Label and all its descendants in the DAG."

> **Dev:** "Can a **Metaphor** be reused across multiple **Notes**?"
> **Domain expert:** "No — a **Metaphor** is always tied to exactly one **Note**. If something works for two Notes, write it twice."

> **Dev:** "What's the difference between **AiAssisted** and **AiGraded**?"
> **Domain expert:** "In AiAssisted, the User decides if their answer was right by reading the Note themselves. In AiGraded, the AI reads the Note and tells them."

> **Dev:** "Is a pomodoro just a timer inside a **RecallSession**?"
> **Domain expert:** "No — that's a separate **FocusSession** that can happen during recall, note-taking, or other study work."

> **Dev:** "Is `Pomodoro` the domain concept?"
> **Domain expert:** "No — `Pomodoro` is the default **FocusMethod** used by a **FocusSession**."

> **Dev:** "Does every **FocusSession** have to belong to a **RecallSession** or a **Note**?"
> **Domain expert:** "No — it can stand alone, but once completed it should still produce a **FocusRecord** so time can be analyzed later."

> **Dev:** "If a 50-minute **FocusSession** starts in one **Label**, includes a **RecallSession**, and ends with new unlabeled **Notes**, do we force the User to pick one?"
> **Domain expert:** "No — the session can accumulate multiple **FocusTargets**, including unlabeled Note work, without interrupting focus."

> **Dev:** "Do Users have to tag **FocusTargets** manually while the timer is running?"
> **Domain expert:** "No — in v1 the app captures **FocusTargets** automatically from what the User actually does."

> **Dev:** "If the User spends a full **FocusSession** reading within the `React` **Label** and researching a hard concept without editing a **Note**, does that count?"
> **Domain expert:** "Yes — that is still **StudyActivity** and should produce a **FocusTarget** for that **Label**."

> **Dev:** "If unlabeled work later gets assigned to `React`, do old **FocusRecords** change too?"
> **Domain expert:** "Not in v1 — **FocusRecord** keeps the study context as it was during the original **FocusSession**."

> **Dev:** "What if the User stops after 18 minutes of a 25-minute interval?"
> **Domain expert:** "In v1 that does not produce a **FocusRecord** — only completed focus intervals are saved."

> **Dev:** "If the User does `50 focus + 10 break + 50 focus`, is that one timer history item or two?"
> **Domain expert:** "That is one **FocusSession** containing multiple **FocusIntervals** and **BreakIntervals**."

> **Dev:** "Does a long break automatically end the **FocusSession**?"
> **Domain expert:** "Not in v1 — the **FocusSession** ends only when the User explicitly ends it."

> **Dev:** "When we report study time, do breaks count the same as focus?"
> **Domain expert:** "No — analytics primarily measure completed **FocusInterval** time, while **BreakIntervals** remain available for secondary analysis."

> **Dev:** "What if the User starts a **FocusSession** and then studies from a physical book or another app?"
> **Domain expert:** "That still counts as the **FocusSession**, but in v1 only in-app **StudyActivity** produces automatic **FocusTargets**."

> **Dev:** "If a **RecallSession** runs during a **FocusSession**, do we count that time twice?"
> **Domain expert:** "No — the **RecallSession** is study activity inside the **FocusSession**, not extra time on top of it."

> **Dev:** "If one **FocusSession** touches `React`, `CSS`, and unlabeled Note work, how many minutes does each one get?"
> **Domain expert:** "In v1 we only record that those **FocusTargets** appeared in the **FocusSession**; exact per-target minute splitting is deferred."

> **Dev:** "When the **App Sidebar** is collapsed, do we keep a small navigation rail visible?"
> **Domain expert:** "No — a **Collapsed App Sidebar** is hidden, and the workspace content reclaims that space."

> **Dev:** "Where does the User reopen a **Collapsed App Sidebar**?"
> **Domain expert:** "From a compact **Sidebar Reopen Control** at the leading edge of the frame header, before the active page title."

> **Dev:** "Is the **Sidebar Reopen Control** a Notes-only control?"
> **Domain expert:** "No — it belongs to the shared authenticated workspace frame and appears consistently across authenticated screens."

> **Dev:** "Should Note search and sort controls move into the shared authenticated frame header?"
> **Domain expert:** "No — the frame header identifies the current workspace screen, while Notes-specific controls stay inside the Notes route."

## Flagged ambiguities

- "Study field" was used in early discussion to mean the top-level organizer — resolved: this is just a **Label** with no parent.
- "Premium" was initially vague — resolved: premium features require **BYOK** now; per-use credits in the future.
- "Pomodoro" was used as if it were part of **RecallSession** — resolved: the canonical term is **FocusSession**, which is a separate concept.
- "Pomodoro" was used as the root timer concept — resolved: it is the default **FocusMethod**, not the umbrella term.
- "Log" was used for persisted focus history — resolved: the canonical term is **FocusRecord**.
- "FocusSession target" was initially treated as singular — resolved: a **FocusSession** may accumulate multiple **FocusTargets**.
- "FocusTargets" could have been user-entered metadata — resolved: in v1 they are captured automatically from observed activity.
- "Observed activity" could have meant any UI event — resolved: only **StudyActivity** counts, excluding incidental navigation such as settings or stray page visits.
- "Past focus analytics" could have been rewritten by later taxonomy changes — resolved: in v1, **FocusRecord** is snapshot-based and not retroactively reclassified.
- "Partial focus time" could have counted as persisted history — resolved: in v1, only completed focus intervals create a **FocusRecord**.
- "Pomodoro session" could have meant either the whole study block or a single timed round — resolved: **FocusSession** is the larger study block; **FocusInterval** is one completed work round inside it.
- "Long breaks or inactivity" could have auto-ended the study block — resolved: in v1, **FocusSession** ends explicitly, not automatically.
- "Study time" could have mixed focus and breaks equally — resolved: completed **FocusInterval** time is the primary analytic metric.
- "Automatic focus classification" could have covered all study time everywhere — resolved: in v1, only in-app **StudyActivity** creates automatic **FocusTargets**.
- "Recall time" could have been added on top of focus time — resolved: recall is nested study activity inside a **FocusSession**, not double-counted extra time.
- "Per-target analytics" could have implied exact time allocation — resolved: in v1, target presence is recorded without minute-level attribution.
- "Collapsed sidebar" could have meant a narrow icon-only rail — resolved: **Collapsed App Sidebar** means the sidebar is hidden and the workspace content reclaims the area.
- "Menu button" was too vague for the collapsed state affordance — resolved: use **Sidebar Reopen Control** for the icon-only frame header control that restores the sidebar.
