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

**Learning Loop**:
The core study cycle where the User captures knowledge as Notes and reinforces it through RecallSessions.
_Avoid_: Content workflow, study menu

**Study Layer**:
The app-based transformation of source study material into Notes, memory aids, RecallSessions, and FocusSessions.
In the exam-support pilot, the Study Layer is used alongside external exam material rather than replacing it.
The future product direction is for the app to become the User's primary study workspace when the User trusts it enough for long-term study.
_Avoid_: Source notes, exam notebook

**Persistent Study Data**:
Authenticated study data that remains available to the same User across browsers, devices, sign-outs, and app restarts.
_Avoid_: Local cache, browser storage

**Label**:
A named concept used to group Notes. Labels form a DAG — a Label can have multiple parent Labels and multiple child Labels. A Note can belong to multiple Labels directly.
_Avoid_: Tag, category, folder, topic, study field

### Recall

**RecallSession**:
A user-initiated event where the user is tested on a selected set of Notes. The Note content starts hidden; depending on the RecallMode, the user may reveal it later to self-assess or review the answer.
In v1, the User chooses Notes for a RecallSession through search/filter and explicit selection.
In v1, the selected set is temporary and exists only to start that RecallSession; it is not saved as a reusable grouping.
For `AiAssisted` and `AiGraded`, the User chooses the question style for the session up front: `open-ended`, `multiple-choice`, or `mixed`.
Notes are presented in random order within the RecallSession.
A RecallSession snapshots its target Notes and generated Questions at the moment the session starts, so later edits or deletions do not change that in-progress session.
An in-progress RecallSession is Persistent Study Data so the User can recover it after refresh or app reopen.
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
The persistent record of a completed RecallSession — when it happened, which Notes were targeted, and the full list of Questions with answers and scores.
_Avoid_: History, log, summary
Use "Results" for user-facing UI copy that refers to completed recall work.
A selectable Results list item represents one SessionResult, not a Note, Label, or saved recall set.
A RecallSession is considered completed and gets a SessionResult when the user has attempted at least one Question, even if they end the session early before covering every Note. A session with zero attempted Questions is discarded.
Each stored Question in a SessionResult preserves the Note title and Note body snapshot used at the time of the session, so later Note edits do not change historical results.

### Focus

**FocusSession**:
A user-initiated block of focused study time that can run while the user is taking Notes, reviewing Notes, or doing a RecallSession.
_Avoid_: Pomodoro session, timer, recall timer

**FocusMethod**:
The timing pattern used by a FocusSession, with `Pomodoro` as the default method in v1.
In v1, configurable `Pomodoro` timing settings are limited to FocusInterval duration, BreakInterval duration, and an optional planned number of FocusIntervals.
In v1, the Focus Section setup defaults to 25 FocusInterval minutes, 5 BreakInterval minutes, and 4 planned FocusIntervals.
_Avoid_: Timer type, mode

**FocusInterval**:
A completed timed work round inside a FocusSession.
_Avoid_: Pomodoro session, round, streak

**BreakInterval**:
A timed rest period between FocusIntervals inside a FocusSession.
_Avoid_: Pause, idle time

**IntervalTransitionWindow**:
A short decision window after a FocusInterval completes where the User may skip the next BreakInterval and immediately start another FocusInterval. If the User takes no action, the FocusSession enters the BreakInterval automatically.
In v1, the IntervalTransitionWindow lasts 30 seconds.
_Avoid_: Pause, idle time, blocked screen

**FocusRecord**:
The persistent record of a completed FocusSession, including its time boundaries and the study context the User says they worked on.
In v1, FocusRecords are read-only after creation.
_Avoid_: Log, history, timer log

**FocusTarget**:
A study context associated with a FocusSession, such as a Label, a RecallSession, or unlabeled Note work.
When Note work creates a FocusTarget in v1, the FocusRecord snapshots both the touched Note and the Labels attached to that Note at the time. Unlabeled Note work remains a valid FocusTarget.
When RecallSession work creates a FocusTarget in v1, the FocusRecord snapshots the RecallSession plus the Note snapshots and Label snapshots used inside that RecallSession.
_Avoid_: Goal, task, bucket

**StudyActivity**:
An interaction that counts as meaningful work during a FocusSession and can produce or reinforce a FocusTarget.
In v1, StudyActivity includes creating or editing a Note, adding or editing Metaphors or Acronyms, reviewing an existing Note for at least 30 seconds while the app is visible during an active FocusInterval, starting or answering inside a RecallSession, and working inside a Label-filtered Notes or Recall context.
In v1, StudyActivity excludes opening settings, navigating between pages, typing search text by itself, briefly selecting a Note, and idle time.
_Avoid_: Click, page view, navigation event

### Users & Access

**User**:
A person with an account. In v1, a User signs in with email and password.
_Avoid_: Account, member, profile

**Session**:
A server-managed authenticated access period for a User, represented in the browser only by an HTTP-only cookie.
_Avoid_: Local login state, browser account

**BYOK** (Bring Your Own Key):
The current premium access model. A User supplies their own AI provider API key; the app uses it for AiAssisted and AiGraded RecallModes. Future model: per-use credits. BYOK key persistence is deferred until AiAssisted or AiGraded is in scope.

**Pilot Registration Code**:
A shared invitation code required to create a User during the v1 exam-support pilot.
_Avoid_: Admin approval, public signup

### Workspace Navigation

**Notes Workspace**:
The primary authenticated workspace where the User captures, searches, selects, and edits Notes.
In the Notes Workspace, the User may assign existing Labels to a Note, but creating Labels and managing Label graph relationships belongs to the Labels workspace.
_Avoid_: Product menu, notes page

**Recall Section**:
The primary authenticated section that acts as the base entry point for recall capabilities, including starting RecallSessions and reviewing SessionResults.
_Avoid_: Recall dashboard, Recall home, Practice (possible future user-facing label), Recall history, quiz area

**Focus Section**:
The authenticated workspace section for running FocusSessions, reviewing FocusRecords, and seeing focus analytics. Compact active FocusSession controls remain globally available across the authenticated workspace.
In v1, the Focus Section shows the active FocusSession when present, supported Pomodoro timing configuration, completed FocusRecords newest first, completed FocusInterval time, BreakInterval count and duration as secondary detail, touched FocusTargets, and basic cross-study analytics derived only from existing Notes, Recall SessionResults, and FocusRecords.
In v1, FocusSession timing controls in the Focus Section are visible but disabled while a FocusSession is active; timing changes apply only when no FocusSession is running.
In v1, the Focus Section setup can be reset to the standard 25/5 Pomodoro setup with 4 planned FocusIntervals.
In v1, the primary navigation label for the Focus Section is "Focus".
In v1, the Focus Section route is `/focus`.
_Avoid_: Timer page, Pomodoro page, focus history

**Focus Dock**:
A compact global workspace utility for starting and controlling the active FocusSession without navigating away from the current workspace.
In v1, the expanded sidebar footer card label is "Focus now" to distinguish the active utility from the Focus Section.
In v1, Pomodoro timing settings are hidden behind a "Configure" disclosure by default.
In v1, active-session actions appear only when relevant to the current FocusSession state, such as keeping focus during an IntervalTransitionWindow, skipping a BreakInterval, or starting the next FocusInterval.
_Avoid_: Timer page, Focus page control, sidebar nav item

**Account Dock**:
A fixed bottom utility area for User/account actions such as logout and settings access.
_Avoid_: Product menu, primary navigation

**Recall Selection Mode**:
A temporary Recall Section route, such as `/recall/select`, with a dedicated recall picker where the User searches/filters Notes and selects the Notes for a new RecallSession.
_Avoid_: Bulk edit mode, saved set builder, deck builder

**Recall Session View**:
The focused current-session route shown after a RecallSession starts, such as `/recall/session`.
_Avoid_: Quiz page

**Workspace Breadcrumb**:
A small navigational trail that shows where the User is inside a workspace section.
_Avoid_: Product menu, sidebar navigation

## Relationships

- A **Label** can have zero or more parent **Labels** and zero or more child **Labels** (DAG, not a tree)
- Label graph cycles are invalid; v1 prevents them in application logic and relies on database constraints only for duplicate edges and self-parent edges.
- A **Note** can belong to zero or more **Labels**
- A **Note** has zero or more **Metaphors** (cannot exist without their Note)
- A **Note** has zero or more **Acronyms** (cannot exist without their Note)
- The **Learning Loop** is centered on **Notes** and **RecallSessions**; **Metaphors** and **Acronyms** support Notes but are not standalone workspace destinations.
- The **Study Layer** turns external source material into **Notes**, **Metaphors**, **Acronyms**, **RecallSessions**, and **FocusSessions**.
- During the exam-support pilot, the **Study Layer** must not be the only place where irreplaceable exam material exists.
- The exam-support pilot starts with no pre-seeded **Notes**, **Labels**, **RecallSessions**, **SessionResults**, **FocusSessions**, or **FocusRecords** for Test Participants.
- The long-term product direction is for the **Study Layer** to become the **User**'s primary study workspace.
- **Persistent Study Data** belongs to a **User** and must survive sign-out, browser changes, and app restarts.
- In v1, authenticated study work requires the app server and database; offline study writes are not supported.
- In v1, the **Learning Loop** has two primary sections: the **Notes Workspace** and the **Recall Section**.
- Searching for a **Note** includes its own title and body plus the titles/content of its attached **Metaphors** and **Acronyms**, but the search result is still the **Note**.
- Searching/filtering Notes for a **RecallSession** includes the Note title/body and attached **Metaphors** and **Acronyms**, but selecting a result always selects the owning **Note**.
- A **RecallSession** targets one or more **Notes** selected by the **User**
- In v1, a **User** can have at most one active **RecallSession** at a time.
- The selected Notes used to start a **RecallSession** are a temporary one-off selection, not a saved set, collection, deck, or Label.
- In v1, **Labels** may help filter or group **Notes**, but **Labels** are not the foundation of **RecallSession** targeting.
- Unlabeled **Notes** are recallable in v1 because **RecallSessions** target selected **Notes** directly.
- A **RecallSession** has exactly one **RecallMode**
- A **RecallSession** has a **SessionResult** — date, targeted Notes, and the full list of Questions with answers and scores
- A **Question** belongs to exactly one **RecallSession** and one **Note**
- A **Question** stores the user's answer and a score (self-rated or AI-graded depending on RecallMode)
- A **FocusSession** is separate from a **RecallSession** and may overlap with Note-taking, Note review, or a **RecallSession**
- A **FocusSession** is available across the authenticated workspace rather than belonging to a single workspace screen
- A **User** can have at most one active **FocusSession** at a time
- A **FocusSession** has exactly one **FocusMethod**
- A **FocusSession** may contain multiple completed **FocusIntervals** and **BreakIntervals**
- In v1, **BreakIntervals** are intentional rest periods only; pausing an in-progress **FocusInterval** is not supported
- In v1, an active **FocusSession** resumes from persisted active session state after browser refresh or app reopen
- When resuming an active **FocusSession**, v1 uses real elapsed wall-clock time rather than freezing the timer while the app was closed
- In v1, active **FocusSession** timing is reconstructed from persisted timestamps; the app does not persist timer ticks every second.
- In v1, after a **FocusInterval** completes, the **FocusSession** enters a 30-second **IntervalTransitionWindow** before the next **BreakInterval**
- During an **IntervalTransitionWindow**, the **User** may skip the next **BreakInterval** and immediately start another **FocusInterval**
- If the **User** takes no action during the **IntervalTransitionWindow**, the **FocusSession** enters the **BreakInterval** automatically
- If the **FocusSession** has reached its planned number of **FocusIntervals**, no action during the **IntervalTransitionWindow** completes the **FocusSession** instead of starting a **BreakInterval**
- A **User** may extend a **FocusSession** beyond its planned number of **FocusIntervals** by choosing to start another **FocusInterval** during the **IntervalTransitionWindow**
- When a **BreakInterval** completes, the next **FocusInterval** starts only when the **User** explicitly starts it
- Time after a completed **BreakInterval** and before the next **FocusInterval** is waiting time, not focus time or break time
- In v1, the app strongly presents the **BreakInterval** as rest time, but the **User** may explicitly skip the break
- Skipping a **BreakInterval** immediately starts the next **FocusInterval**; study work after skipping counts as **StudyActivity**
- Study edits should not be counted as **StudyActivity** while the **FocusSession** is still in a **BreakInterval**
- A **FocusSession** may exist without a linked **RecallSession**, **Note**, or **Label**
- A **FocusSession** may have multiple **FocusTargets**
- A **FocusTarget** may refer to a **Label**, a **RecallSession**, or unlabeled Note work
- In v1, **FocusTargets** are captured automatically from the User's observed study activity during the **FocusSession**
- In v1, the app stores the resulting **FocusTargets** for a **FocusSession** rather than a full **StudyActivity** event log.
- In v1, starting a **FocusSession** uses the default **FocusMethod** quickly, but the User may adjust supported timing settings before starting
- In v1, **FocusSession** configuration does not include manual **FocusTarget** selection or additional **FocusMethods**
- A **StudyActivity** must reflect meaningful study engagement, not incidental navigation
- A **FocusSession** may include study work done outside the app, but in v1 only in-app **StudyActivity** creates automatic **FocusTargets**
- A completed **FocusSession** has a **FocusRecord**
- In v1, a **FocusRecord** snapshots its **FocusTargets** as they were during the **FocusSession**; later Note or Label changes do not rewrite past focus history
- In v1, Note-based **FocusTargets** preserve both the touched **Note** snapshot and the **Label** snapshots attached to that **Note** during the **FocusSession**
- In v1, Recall-based **FocusTargets** preserve the **RecallSession** plus the **Note** snapshots and **Label** snapshots used inside that **RecallSession**
- In v1, a **FocusRecord** is created only when the User completes at least one full focus interval; abandoned or early-stopped sessions are discarded
- A **FocusRecord** cannot contain only **BreakIntervals**; at least one completed **FocusInterval** is required
- If a **User** ends a **FocusSession** after at least one completed **FocusInterval**, the **FocusRecord** includes completed **FocusIntervals** and completed **BreakIntervals** only; any in-progress interval is discarded
- In v1, a **FocusSession** ends only when the User explicitly ends it; automatic ending after long inactivity or long breaks is deferred
- In v1, long inactivity may produce a stale-session prompt, but it must not automatically end the **FocusSession**
- In v1, FocusSession interval changes use minimal in-app visual state changes only; browser notifications and sounds are out of scope
- Analytics primarily measure completed **FocusInterval** time; **BreakIntervals** are stored for secondary analysis
- A **RecallSession** that happens during a **FocusSession** counts as study activity inside that **FocusSession**, not as separate extra time on top of it
- In v1, analytics record which **FocusTargets** appeared in a **FocusSession**, but do not assign exact minutes to each target
- A **User** owns all their **Notes**, **Labels**, **Metaphors**, **Acronyms**, **RecallSessions**, and **FocusSessions**
- A **Session** belongs to exactly one **User**.
- During the v1 exam-support pilot, creating a **User** requires the **Pilot Registration Code**.
- All relationships are ownership-local to a single **User**. A **Note** can only be assigned to **Labels** owned by the same **User**, and a **RecallSession** can only target Notes owned by that User.
- In v1, deleting active **Notes**, **Labels**, **Metaphors**, and **Acronyms** is a hard delete. Historical study records remain available only through the snapshots stored in **SessionResult**.
- In v1, authenticated study work happens through the **Notes Workspace** and the **Recall Section** rather than a generic product-menu sidebar.
- In v1, active **FocusSessions**, **FocusRecords**, and focus analytics are surfaced in the **Focus Section**, separate from the **Notes Workspace** and **Recall Section**
- In v1, **Focus Section** analytics may include cross-study metrics, but only when derived from existing **Notes**, **SessionResults**, and **FocusRecords** rather than a separate analytics event log
- In v1, per-record rows in the **Focus Section** show only facts directly supported by the **FocusRecord**
- In v1, **FocusSession** timing configuration is not saved as next-session defaults while a **FocusSession** is active
- In v1, the **Focus Section** starts from the standard 25/5 Pomodoro setup with 4 planned **FocusIntervals**
- In v1, resetting **FocusSession** setup restores the standard 25/5 Pomodoro setup with 4 planned **FocusIntervals**
- Compact active **FocusSession** controls remain globally available across the authenticated workspace through the **Focus Dock**
- In v1, the **Focus Dock** is primarily a sidebar footer card when the app sidebar has enough space, with a compact text-pill workspace-header fallback when the sidebar is collapsed or unavailable
- Starting a **FocusSession** from the **Focus Dock** does not navigate the **User** away from their current workspace screen
- Route-local FocusSession start and control buttons are used in the **Focus Section**; the **Focus Dock** remains the compact active FocusSession control surface on other authenticated workspace routes
- In v1, the **Focus Section** does not need chart-based analytics
- In v1, the primary navigation label for the **Focus Section** is "Focus"
- In v1, the **Focus Section** route is `/focus`
- In v1, **FocusRecords** are not editable or deletable
- The "Focus" sidebar navigation item opens the **Focus Section** for active FocusSessions, completed FocusRecords, and focus analytics, while the "Focus now" **Focus Dock** provides compact active FocusSession controls elsewhere
- The **Notes Workspace** owns Note search/filter, Note selection, and Note editing.
- The **Recall Section** owns starting **RecallSessions** and reviewing **SessionResults**.
- The **Notes Workspace** may provide a lightweight "Start Recall" entry point for convenience, but it only opens the **Recall Section**; Note selection happens inside Recall.
- In v1, the primary navigation label for the **Recall Section** is "Recall".
- The default `/recall` screen does not need a separate domain term; it is the base **Recall Section**.
- The base **Recall Section** presents completed **SessionResults** in a master-detail layout by default, similar to the **Notes Workspace**.
- The base **Recall Section** includes a persistent selectable list of **SessionResults**, sorted newest first.
- The base **Recall Section** does not use separate choice cards for Start Recall, Results, or Recent Results in this version.
- Selecting a **SessionResult** in the base **Recall Section** opens its details in the main review area.
- Selecting a **SessionResult** does not change the route in v1; selected result state is local to the base **Recall Section**.
- When **SessionResults** exist, the newest **SessionResult** is selected by default.
- After a **RecallSession** creates a **SessionResult**, returning to the base **Recall Section** shows that newest **SessionResult** selected.
- In the first version of the base **Recall Section** master-detail layout, the selectable list is by **SessionResult** only; note-level performance review is deferred.
- A **SessionResult** list item shows the completion date/time, attempted Question count, and score summary.
- The selected **SessionResult** detail shows the stored Note snapshots used in that RecallSession.
- In this version, stored Notes inside a selected **SessionResult** are shown as a summary section only; nested Note selection inside Results is deferred.
- The selected **SessionResult** detail is read-only historical review; editing or deleting past Results is out of scope for this change.
- Starting a new **RecallSession** remains a prominent action in the base **Recall Section**.
- The base **Recall Section** places **Start Recall** above the **SessionResult** list, mirroring the **Notes Workspace** list action placement while keeping recall-specific wording.
- **Start Recall** opens **Recall Selection Mode**.
- The base **Recall Section** supports filtering **SessionResults** by **Label**, but **Labels** remain grouping/filtering aids rather than the foundation of **RecallSession** targeting.
- The base **Recall Section** remains available when there are no **SessionResults** and shows an empty Results workspace with **Start Recall** prominent.
- If the **Recall Section** has no recallable **Notes**, it owns the empty state and provides a path to the **Notes Workspace** to create Notes.
- User-facing copy for completed recall work should say "Results", not "History".
- The old `/history` route should be removed rather than redirected; v1 does not preserve a standalone history route.
- The active **Recall Session View** uses a current-session route, such as `/recall/session`, rather than a per-session addressable route.
- The **Account Dock** owns utility account actions and should not contain product destinations.
- The **Recall Section** enters **Recall Selection Mode** when the User chooses to select Notes for recall.
- **Recall Selection Mode** has its own route inside the **Recall Section**, such as `/recall/select`, rather than being an in-page mode on `/recall`.
- **Recall Selection Mode** reuses Note search/filter semantics but does not include Note editing.
- In **Recall Selection Mode**, selecting a Note toggles it into the temporary RecallSession selection instead of opening it for editing.
- Exiting **Recall Selection Mode** clears the temporary selected Notes unless a **RecallSession** has already been started.
- Cancelling **Recall Selection Mode** returns the User to the base **Recall Section** and clears the temporary selected Notes.
- Starting a **RecallSession** takes the User from the **Recall Section** to a **Recall Session View**.
- Ending or completing a **RecallSession** returns the User to the base **Recall Section**.
- A completed **RecallSession** creates a **SessionResult** and appears in the base **Recall Section** after returning there.
- A **RecallSession** ended early after at least one attempted Question creates a **SessionResult** and appears in the base **Recall Section** like any completed session.
- The **Recall Session View** is only valid while there is an active **RecallSession**; without one, the User returns to the **Recall Section**.
- The **Workspace Breadcrumb** shows the User whether they are in the **Notes Workspace**, the base **Recall Section**, or an active **Recall Session View**.
- The **Workspace Breadcrumb** is structural, such as Recall / Session; RecallSession progress belongs inside the **Recall Session View**, not in the breadcrumb.

## Example dialogue

> **Dev:** "When a **User** starts a **RecallSession**, do they have to choose a **Label** first?"
> **Domain expert:** "No — in v1 they search/filter Notes and explicitly select the Notes they want to recall."

> **Dev:** "Is **Recall** a separate primary destination beside **Notes** in v1?"
> **Domain expert:** "Yes — **Notes Workspace** and **Recall Section** are the two primary parts of the **Learning Loop**."

> **Dev:** "Should **Metaphors** and **Acronyms** have their own main workspace screens?"
> **Domain expert:** "No — they help a **Note** stick in memory, but the primary learning work is capturing **Notes** and doing **RecallSessions**."

> **Dev:** "If a search match is inside an **Acronym**, does the **RecallSession** target that **Acronym**?"
> **Domain expert:** "No — the **Acronym** helps find the owning **Note**, and the selected target is still that **Note**."

> **Dev:** "Can the User save a selected group of **Notes** and reuse it for later **RecallSessions**?"
> **Domain expert:** "Not in v1 — the selection is temporary and only snapshots the Notes for the session being started."

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

> **Dev:** "If the **Focus Dock** lives in the sidebar, is focus just another navigation destination?"
> **Domain expert:** "No — the **Focus Dock** is a persistent utility for the active **FocusSession**. The **Focus Section** remains the destination for reviewing **FocusRecords**."

> **Dev:** "Does v1 need a product-menu sidebar with Notes, Recall, Labels, History, and Settings?"
> **Domain expert:** "No — v1 has **Notes Workspace** and **Recall Section** as primary Learning Loop sections. Account utilities belong in the **Account Dock**, not in primary product navigation."

> **Dev:** "Should Recall checkboxes always be visible in the **Notes Workspace**?"
> **Domain expert:** "No — the User enters **Recall Selection Mode** from the **Recall Section**, then searches/filters and selects the Notes for the new **RecallSession**."

> **Dev:** "Can the **Notes Workspace** still offer a way to start recall?"
> **Domain expert:** "Yes — it can provide a lightweight Start Recall entry point, but it only opens the **Recall Section**; the User selects Notes for recall there."

> **Dev:** "Should Start Recall from Notes carry the currently selected Note into Recall?"
> **Domain expert:** "No — starting from Notes opens Recall without preselection. Selection happens in the **Recall Section**."

> **Dev:** "Should **Recall Selection Mode** show the full Note editor?"
> **Domain expert:** "No — it is a dedicated recall picker. It can reuse Note search/filter behaviour, but selection means adding a Note to the RecallSession target set."

> **Dev:** "After the User starts a **RecallSession**, does the session stay on the same Notes screen?"
> **Domain expert:** "No — the active session opens in a **Recall Session View**, and ending the session returns to the **Recall Section**."

> **Dev:** "After a **RecallSession** completes, should the User go directly to full **Results**?"
> **Domain expert:** "Return to the base **Recall Section**, where the completed session appears as a **SessionResult** in the selectable Results list."

> **Dev:** "If the User ends a **RecallSession** early after one attempted Question, does it appear in **Results**?"
> **Domain expert:** "Yes — it created a **SessionResult**, so it appears anywhere SessionResults are shown."

> **Dev:** "Can the User open the **Recall Session View** directly when no **RecallSession** is active?"
> **Domain expert:** "No — without an active **RecallSession**, they return to the **Recall Section**."

> **Dev:** "Should an active **RecallSession** use a route like `/recall/sessions/:sessionId`?"
> **Domain expert:** "No — in v1 the active session uses a current-session route such as `/recall/session`; per-session routes are deferred until sessions are resumable or otherwise addressable."

> **Dev:** "Should the **Workspace Breadcrumb** show RecallSession progress like '3 of 10'?"
> **Domain expert:** "No — the breadcrumb stays structural, such as Recall / Session, while progress belongs in the **Recall Session View**."

> **Dev:** "Where does broader **SessionResult** history live in v1 navigation?"
> **Domain expert:** "It belongs in the **Recall Section** because reviewing completed recall work is part of the core recall workflow."

> **Dev:** "When the User opens the **Recall Section**, is it mainly for starting recall or reviewing old results?"
> **Domain expert:** "It opens on persistent **SessionResult** review by default, with starting a new **RecallSession** still prominent."

> **Dev:** "Should the base **Recall Section** immediately enter **Recall Selection Mode**?"
> **Domain expert:** "No — the base section presents **SessionResults**. The User enters **Recall Selection Mode** when they choose to start a RecallSession."

> **Dev:** "Should **Recall Selection Mode** live inside `/recall`?"
> **Domain expert:** "No — use a dedicated route such as `/recall/select` so the base **Recall Section** remains the entry point."

> **Dev:** "What happens when the User cancels **Recall Selection Mode**?"
> **Domain expert:** "They return to the base **Recall Section**, and the temporary selected Notes are cleared."

> **Dev:** "Should base **Results** support filtering by **Label**?"
> **Domain expert:** "Yes — **Labels** are useful for filtering Results, but they do not define RecallSession targets."

> **Dev:** "Should **Results** be hidden when there are no **SessionResults**?"
> **Domain expert:** "No — keep **Results** available and show an empty Results state."

> **Dev:** "If there are no **Notes**, should Recall redirect to Notes?"
> **Domain expert:** "No — stay in the **Recall Section**, explain that recall needs Notes, and provide a path to the **Notes Workspace**."

> **Dev:** "Should the base **Recall Section** show every **SessionResult** immediately?"
> **Domain expert:** "Yes — it uses a Notes-like master-detail layout with a selectable **SessionResult** list and a detail review pane."

> **Dev:** "Is full **SessionResult** review a mode in the base **Recall Section**?"
> **Domain expert:** "Yes — the base **Recall Section** is the canonical **SessionResult** review workspace."

> **Dev:** "Should old `/history` links redirect to `/recall`?"
> **Domain expert:** "No — remove `/history`; completed recall work is reviewed only through the **Recall Section**."

> **Dev:** "Should the UI still say 'history' for completed recall work?"
> **Domain expert:** "No — use 'Results' in UI copy. The domain term is **SessionResult**."

> **Dev:** "Do we need a separate term like Recall Dashboard for `/recall`?"
> **Domain expert:** "No — `/recall` is just the base **Recall Section**."

> **Dev:** "Should the primary navigation label say 'Recall' or 'Practice'?"
> **Domain expert:** "Use 'Recall' in v1 because it matches the domain language, but revisit 'Practice' if general users do not recognize active recall terminology."

## Flagged ambiguities

- "Study field" was used in early discussion to mean the top-level organizer — resolved: this is just a **Label** with no parent.
- "Menu options" could have treated **Metaphors** and **Acronyms** as standalone destinations — resolved: they are Note-owned memory aids inside the **Learning Loop**, not primary workspace screens.
- "Recall target" previously meant a chosen **Label** and its descendants — resolved for v1: a **RecallSession** targets explicitly selected **Notes**.
- "Unlabeled Notes" were previously excluded from recall — resolved for v1: they are recallable because selection is Note-based.
- "Saved recall set" could have introduced a new grouping concept — resolved for v1: Recall note selection is temporary and not reusable.
- "Recall" could have meant only an action started from Notes — resolved for v1: the **Recall Section** is a primary Learning Loop section beside the **Notes Workspace**.
- "Start Recall" in the **Notes Workspace** could have meant Notes owns recall setup or passes selected Notes into Recall — resolved for v1: it only opens the **Recall Section** without preselection.
- "Recall" may be less familiar than "Practice" to general users — resolved for v1: keep "Recall" as the navigation label and revisit after user feedback.
- "Selecting Notes" could mean opening a Note for editing or choosing Notes for recall — resolved: in the **Notes Workspace**, selection opens a Note for editing; in **Recall Selection Mode**, selection toggles Notes into the temporary RecallSession target set.
- "Recall view" could have meant either the base **Recall Section** or an active **Recall Session View** — resolved: the base section reviews SessionResults and starts RecallSessions; the session view only represents an active RecallSession.
- "Recall route" could have meant only an active session route — resolved: `/recall` is the base **Recall Section** and canonical **SessionResult** review workspace, `/recall/select` is **Recall Selection Mode**, `/recall/session` is the active **Recall Session View**, and `/recall/results` is removed.
- "Recall Dashboard" or "Recall Home" could have named the default `/recall` screen — resolved: use **Recall Section** only; its default surface is the Results master-detail workspace.
- "Exam notes" could have meant the app is already the primary source of truth for exam material — resolved: for the exam-support pilot, the app is a **Study Layer** over material that remains available elsewhere, while the long-term direction is to become the **User**'s primary study workspace.
- "Breadcrumb" could have acted like primary navigation — resolved: the **Workspace Breadcrumb** indicates position inside the current workspace section, not product sections.
- "History" could have stayed a separate product destination, compatibility route, or UI label — resolved for v1: remove `/history`; completed recall work is reviewed as **SessionResults** inside the **Recall Section**, with UI copy using "Results".
- "App Sidebar" previously meant the primary authenticated product navigation — resolved for v1: use **Notes Workspace**, **Recall Section**, and an **Account Dock**.
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
- "Pause" could have meant freezing a **FocusInterval** — resolved: in v1, it means an intentional **BreakInterval** only, and pausing a running **FocusInterval** is not supported.
- "Focus timer placement" could have been scoped to Notes or Recall only — resolved: **FocusSessions** are available across the authenticated workspace.
- "Focus Section" could have meant only completed **FocusRecords** — resolved: the **Focus Section** also owns the full-page active **FocusSession** experience, while the **Focus Dock** stays as the compact cross-workspace control.
- "Focus analytics" could have meant a dedicated analytics tracking system — resolved: v1 **Focus Section** analytics are derived from existing **Notes**, **SessionResults**, and **FocusRecords** only.
- "Per-session analytics" could have implied exact Note creation or Recall answer counts inside a **FocusRecord** — resolved: v1 per-record rows show only facts the **FocusRecord** can prove.
- "Changes apply to next session" could have meant editing future defaults during an active **FocusSession** — resolved: v1 keeps timing controls visible but disabled while a **FocusSession** is active.
- "Default Pomodoro setup" could have meant open-ended timing everywhere — resolved: the **Focus Section** defaults to 4 planned **FocusIntervals**, while compact quick-start controls may remain default-first.
- "Multiple timers" could have meant overlapping **FocusSessions** — resolved: a **User** can have at most one active **FocusSession** at a time.
- "Minimal input" could have meant no configuration at all — resolved: starting should be default-first, while still allowing supported timing configuration before the **FocusSession** starts.
- "Configuration" could have included targets or alternate methods — resolved: v1 configuration is limited to `Pomodoro` timing values: **FocusInterval** duration, **BreakInterval** duration, and an optional planned number of **FocusIntervals**.
- "Automatic break" could have meant an immediate transition — resolved: in v1, a completed **FocusInterval** starts a 30-second **IntervalTransitionWindow** where the **User** can continue into another **FocusInterval**; otherwise the **BreakInterval** starts automatically.
- "Block the screen" is UI behavior for enforcing a **BreakInterval**, not a separate domain concept.
- "Planned intervals" could have forced a hard stop — resolved: the plan controls the no-action default after the final planned **FocusInterval**, but the **User** may continue and extend the same **FocusSession**.
- "Break completion" could have automatically resumed focus — resolved: after a **BreakInterval**, the next **FocusInterval** requires explicit **User** action.
- "Break blocking" could have made the app unusable — resolved: v1 strongly presents rest time but allows the **User** to skip the **BreakInterval**.
- "Studying during break" could have counted as break and work at once — resolved: study work counts only after the **User** skips the **BreakInterval** and starts the next **FocusInterval**.
- "Skip break" could have returned to waiting state — resolved: skipping a **BreakInterval** immediately starts the next **FocusInterval**.
- "Study activity" could have counted incidental app usage — resolved: v1 counts meaningful Note, Metaphor, Acronym, Recall, review, and Label-context work, while excluding settings, simple navigation, search typing alone, brief Note selection, and idle time.
- "Reviewing a Note" could have meant a brief selection — resolved: in v1, Note review counts as **StudyActivity** after 30 seconds with the Note selected while the app is visible during an active **FocusInterval**.
- "FocusTarget from Note work" could have meant only the Note or only its Labels — resolved: v1 snapshots both the touched **Note** and its attached **Labels**, with unlabeled Note work remaining valid.
- "FocusTarget from Recall work" could have meant only the **RecallSession** — resolved: v1 snapshots the **RecallSession** plus its **Note** and **Label** context.
- "Ending midway" could have discarded the whole **FocusSession** — resolved: if at least one **FocusInterval** was completed, v1 saves completed intervals and discards only the in-progress interval.
- "Break-only history" could have been allowed — resolved: a **FocusRecord** requires at least one completed **FocusInterval**.
- "Refresh" could have lost active focus work — resolved: v1 resumes an active **FocusSession** from persisted active session state after browser refresh or app reopen.
- "Resume timing" could have frozen while the app was closed — resolved: v1 uses real elapsed wall-clock time when resuming an active **FocusSession**.
- "Long inactivity" could have automatically ended the **FocusSession** — resolved: v1 may show a stale-session prompt, but ending remains explicit.
- "Interval notifications" could have meant sounds or browser notifications — resolved: v1 uses minimal in-app visual state changes only.
- "Focus history" could have been buried inside Notes or Recall — resolved: completed **FocusRecords** are reviewed in a lightweight **Focus Section**, while active controls remain global.
- "Focus analytics" could have required charts immediately — resolved: v1 starts with a list of **FocusRecords**, interval details, touched **FocusTargets**, and a basic recent completed-focus aggregate.
- "FocusRecord management" could have included editing or deletion — resolved: v1 **FocusRecords** are read-only after creation.
- "Focus Timer" could have been used as the section label — resolved: the primary navigation label is "Focus"; timer wording is reserved for compact active controls if needed.
- "Focus route" could have used timer or history wording — resolved: the **Focus Section** route is `/focus`.
- "Starting focus" could have navigated to the **Focus Section** — resolved: starting a **FocusSession** from the global control keeps the **User** on the current workspace screen.
- "Focus Section controls" could have diverged from the global controls — resolved: `/focus` may show the same active **FocusSession** state, but there is still one control model and one active **FocusSession**.
- "Per-target analytics" could have implied exact time allocation — resolved: in v1, target presence is recorded without minute-level attribution.
- "Side app menu" could have made the active **FocusSession** control disappear behind navigation or feel like a route — resolved: use a sidebar-first **Focus Dock** with a workspace-header fallback when the sidebar is collapsed or unavailable.
