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

**Notes Workspace**:
The primary authenticated workspace where the User captures, searches, selects, and edits Notes.
_Avoid_: Product menu, notes page

**Recall Section**:
The primary authenticated section that acts as the base entry point for recall capabilities, including starting RecallSessions and reviewing SessionResults.
_Avoid_: Recall dashboard, Recall home, Practice (possible future user-facing label), Recall history, quiz area

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
- A **Note** can belong to zero or more **Labels**
- A **Note** has zero or more **Metaphors** (cannot exist without their Note)
- A **Note** has zero or more **Acronyms** (cannot exist without their Note)
- The **Learning Loop** is centered on **Notes** and **RecallSessions**; **Metaphors** and **Acronyms** support Notes but are not standalone workspace destinations.
- In v1, the **Learning Loop** has two primary sections: the **Notes Workspace** and the **Recall Section**.
- Searching for a **Note** includes its own title and body plus the titles/content of its attached **Metaphors** and **Acronyms**, but the search result is still the **Note**.
- Searching/filtering Notes for a **RecallSession** includes the Note title/body and attached **Metaphors** and **Acronyms**, but selecting a result always selects the owning **Note**.
- A **RecallSession** targets one or more **Notes** selected by the **User**
- The selected Notes used to start a **RecallSession** are a temporary one-off selection, not a saved set, collection, deck, or Label.
- In v1, **Labels** may help filter or group **Notes**, but **Labels** are not the foundation of **RecallSession** targeting.
- Unlabeled **Notes** are recallable in v1 because **RecallSessions** target selected **Notes** directly.
- A **RecallSession** has exactly one **RecallMode**
- A **RecallSession** has a **SessionResult** — date, targeted Notes, and the full list of Questions with answers and scores
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
- All relationships are ownership-local to a single **User**. A **Note** can only be assigned to **Labels** owned by the same **User**, and a **RecallSession** can only target Notes owned by that User.
- In v1, deleting active **Notes**, **Labels**, **Metaphors**, and **Acronyms** is a hard delete. Historical study records remain available only through the snapshots stored in **SessionResult**.
- In v1, authenticated study work happens through the **Notes Workspace** and the **Recall Section** rather than a generic product-menu sidebar.
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
- "Per-target analytics" could have implied exact time allocation — resolved: in v1, target presence is recorded without minute-level attribution.
