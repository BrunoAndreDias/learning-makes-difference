# Learning Makes Difference

A personal study app inspired by Barbara Oakley's learning research. Users capture knowledge as Notes, turn Notes into Study Notes, attach Metaphors and Acronyms to Study Notes as memory aids, test recall through RecallSessions, and structure focused study time through FocusSessions.

## Language

### Core Knowledge Units

**Note**:
A source explanation or context for one concept or a cohesive small set of closely related Study Notes. Not a page summary or chapter dump.
A Note is the durable source material behind Study Notes; recall targets are Study Notes, not Notes directly.
One Note may support several Study Notes when the source explanation is cohesive and the Study Notes are closely related.
Every saved Note has at least one Study Note so the Note can enter recall without extra setup.
Users do not create source-only Notes directly; creating a Study Note creates or uses the source Note behind it.
New Study Note creates a new source Note by default, but the User may explicitly create another Study Note from an existing source Note.
When a Note has multiple Study Notes, editing the source Note from any linked Study Note updates the shared source Note for all linked Study Notes.
When a source Note is shared by multiple Study Notes, the UI makes that shared-source context clear before source Note edits, but it does not block normal editing.
In v1, a source Note title is optional; the required Study Note prompt is the recall-facing label.
When an untitled source Note needs a display name, the UI derives it live from the oldest created linked Study Note prompt; the empty source title field itself uses neutral copy such as "Untitled source".
Users do not directly delete source Notes; source Note deletion only happens through confirmed deletion of the last linked Study Note.
Split into separate Notes only when the source context no longer reads as one coherent explanation.
_Avoid_: Card, entry, document, record

**Study Note**:
An atomic trainable unit extracted from exactly one Note and targeted by RecallSessions.
A Study Note cannot exist without its source Note.
A Study Note does not combine multiple source Notes; if a recall target needs several contexts, use one cohesive Note explanation or split it into sibling Study Notes.
Study Notes are the durable recall targets used for practice, scoring, scheduling, and improvement.
The default Study Note for a Note preserves the simple path from saving a Note to recalling it.
The default Study Note may start with the source Note title as its prompt when a source Note title exists.
A Study Note owns its own title or prompt, which may be more specific than the source Note title.
A Study Note owns its own expected answer or reference focus so recall can target a precise answer inside broader source material.
In v1, Study Notes are untyped; templates may help create prompts and expected answers later, but they do not define stored Study Note types.
In v1, self-explanation should be encouraged through prompt guidance and templates, not required as a separate Study Note field.
Worked examples may guide source Notes and Study Note templates, but they do not become a stored Study Note type in v1.
A Study Note cannot be saved without a prompt.
A saved Study Note may be incomplete while editing, but it is recallable only when it has a non-empty expected answer.
A Study Note with a non-empty expected answer is recallable even if its source Note body is empty.
After a Study Note is created, later source Note edits do not automatically rewrite the Study Note prompt or expected answer.
Deleting a Study Note deletes only that Study Note; it does not automatically delete its source Note.
Deleting the last Study Note for a source Note requires explicit confirmation to delete both the Study Note and source Note.
_Avoid_: Card, flashcard, quiz item

**Metaphor**:
One optional support description that maps a Study Note's recall target onto something familiar. A Study Note can have at most one Metaphor description in v1; a Metaphor cannot exist without its Study Note.
Needing several Metaphors is usually a sign that the Study Note is too broad and should be split into separate Study Notes.
In v1, a Metaphor is support material only; it is not automatically turned into a practiced Study Note.
Metaphors should not be encouraged for every Study Note by default; suggest them only when a Study Note is abstract, stubborn, or repeatedly Needs practice.
_Avoid_: Analogy (use Metaphor), description

**Acronym**:
A memory-aid support description created by the user, attached to a Study Note. A Study Note can have at most one Acronym description in v1; an Acronym cannot exist without its Study Note.
Needing several Acronyms is usually a sign that the Study Note is too broad and should be split into separate Study Notes.
In v1, an Acronym is support material only; it is not automatically turned into a practiced Study Note.
Acronyms should not be encouraged for every Study Note by default; suggest them only when they help a specific recall problem.
_Avoid_: Abbreviation, term definition

**Learning Loop**:
The core study cycle where the User captures knowledge as Notes, extracts Study Notes, and reinforces those Study Notes through RecallSessions.
The core Learning Loop must work without AI: the User can manually create Study Notes, expected answers, recall, self-rate, and see what needs practice.
By default, the app should encourage the Core Learning Loop: create an atomic Study Note, attempt recall before reveal, compare and correct gaps, self-rate, schedule future recall, and surface Needs practice.
The Core Learning Loop is not a broad checklist of study techniques; supporting techniques should enter only when they strengthen this loop.
AI is optional support for the Learning Loop, not a default study technique or requirement.
_Avoid_: Content workflow, study menu

**Learning State**:
A per-Study Note study signal based on recall score and recency.
Learning State is based on the latest recall for the Study Note, not recall trends over time.
The Learning State score is the latest FlashCard self-rating for the Study Note, shown as plain user-facing copy such as "Last score: Good".
If a Study Note has not been recalled yet, its Learning State is "Not recalled yet".
User-facing UI uses "Needs practice" for low-performing Study Notes rather than "Weak".
In v1, "Needs practice" is derived from recall evidence rather than stored as a durable Study Note status.
In v1, Learning State avoids harsh or broad labels such as "Weak", "Ready for review", or "Recently easy"; it prefers recall facts and soft action-oriented copy.
In v1, Learning State avoids mastery percentages because they imply false precision.
Learning State does not itself name due states; scheduled recall belongs to **Due for Recall**.
In v1, Learning State uses recall language in user-facing copy, such as "Last recalled"; it avoids "review" language.
In v1, Learning State does not include Metaphor or Acronym counts; memory aids remain Study Note support material, not recall evidence.
Unsaved draft Notes do not have visible Learning State list metadata because they have not produced a saved Study Note yet.
Incomplete Study Notes do not show normal Learning State copy; they show completion-oriented copy such as "Add expected answer" until they become recallable.
Every saved Study Note has a Learning State; a saved Study Note with no recall evidence has the Learning State "Not recalled yet".
Learning State uses simple compact language in Study Notes list rows, such as "Not recalled yet" or "Last score: Good".
In v1, Learning State should not appear as a standalone selected-Study Note inspector panel.
When the Study Note editor needs to show recall-facing guidance, Learning State may be presented together with Recall Schedule as compact recall insight copy without merging the underlying signals.
In v1, Learning State does not own recall actions; actions in editor guidance should still be framed as Recall Today or Study Note repair paths.
Passive study activity such as rereading, highlighting, watching videos, or copying notes is not Learning State evidence unless it produces or reinforces Study Notes through recall evidence or correction.
_Avoid_: Report card, spaced-repetition engine, analytics widget, card state

**Practice Repair**:
A lightweight first-class repair flow after weak recall evidence that helps the User improve a Study Note before or alongside future recall.
Practice Repair may suggest editing the expected answer, splitting a broad Study Note, adding a Metaphor or Acronym, creating a sibling Study Note, or recalling the Study Note again soon through Recall Today.
In v1, Practice Repair may persist queryable Practice Repair Entries so mistakes can become future practice.
In v1, Practice Repair has two entry points: a Practice Repair Queue for repair-focused work and Results repair candidates tied to weak Questions.
In v1, Practice Repair is not a full error log or mistake taxonomy.
_Avoid_: Error log, remediation system, weakness workflow

**Practice Repair Entry**:
A persisted, queryable record of what the User plans to change after weak recall evidence.
In v1, every Practice Repair Entry has a Practice Repair Intent and a free-text correction.
In v1, a Practice Repair Entry may capture an optional next-practice idea without forcing a fixed mistake type.
In v1, Practice Repair Entries are created from Results review only, based on weak recall evidence from stored Questions.
Results review may show draft Practice Repair suggestions for Forgot or Hard Questions, but draft suggestions are not persisted Practice Repair Entries.
The User must explicitly confirm the Practice Repair Intent and correction before a draft suggestion becomes a persisted Practice Repair Entry.
Before confirmation, a draft Practice Repair uses a question-scoped Results route so the weak Question evidence stays visible while the User chooses the repair.
The Practice Repair Draft View owns the full weak-question review layout, including the prompt, answer comparison, latest score, and suggested repairs.
Selecting a suggested repair in the Practice Repair Draft View opens an intent-specific confirmation panel on the same page; it does not create a Practice Repair Entry by itself.
Confirming a draft Practice Repair creates a durable Practice Repair Entry, then moves the User to the Practice Repair Workspace for that entry.
The Study Note editor may display active Practice Repair Entries and offer linked repair actions or completion, but it does not create new Practice Repair Entries without recall evidence.
A Practice Repair Entry belongs to exactly one durable Study Note.
A confirmed Practice Repair Entry has a durable identity independent from its originating Question reference.
In v1, every Practice Repair Entry references the SessionResult and stored Question that prompted it.
Going forward, a Practice Repair Entry references a stored Question by stable questionResultId together with the SessionResult and Study Note.
Question index references are legacy fallback only for older SessionResults without stable stored Question identifiers.
Practice Repair Entries rely on SessionResult snapshots for historical recall context rather than duplicating those snapshots.
After confirmation, the canonical active workspace for a Practice Repair Entry is the Practice Repair Workspace; the Results Question remains its origin evidence.
Optional historical references are reserved for future non-Results creation paths.
When its Study Note is deleted, a Practice Repair Entry becomes a read-only historical repair record.
Practice Repair Entries for deleted Study Notes are removed from active planning and Recall Today, and remain accessible only through Results review or other historical context.
A Study Note may have multiple historical Practice Repair Entries.
In v1, a Study Note has at most one active Practice Repair Entry for the same Practice Repair Intent.
When the User confirms a draft Practice Repair suggestion with the same Practice Repair Intent as an existing active Practice Repair Entry for the same Study Note, the new Practice Repair Entry becomes active and the old active entry is superseded by it.
Supersession preserves repeated weak-recall history while keeping one active Practice Repair Entry per Study Note and Practice Repair Intent.
Distinct Practice Repair Intents may have active Practice Repair Entries for the same Study Note at the same time.
A Practice Repair Entry is active while its Practice Repair Intent remains unresolved or its Practice Follow-up is pending.
A Practice Repair Entry becomes historical when completed, dismissed, superseded, or satisfied by follow-up evidence, as applicable.
A Practice Repair Entry's free-text correction is editable while the entry is active and read-only once the entry becomes historical.
A Practice Repair Entry tied to a deleted Study Note is read-only even if its previous lifecycle facts were unresolved.
A Practice Repair Entry is completed only when the User marks the repair complete or performs the matching linked repair action from that entry.
Arbitrary edits to a Study Note, expected answer, memory aid, or sibling Study Note do not complete a Practice Repair Entry by inference.
Lifecycle facts such as completion, dismissal, supersession, and follow-up satisfaction are the source of truth for whether a Practice Repair Entry is active or historical.
Any stored lifecycle status is only a query or uniqueness-enforcement projection of those lifecycle facts.
Practice Repair Entries are future-practice evidence, not recall evidence; they do not change Learning State or Recall Schedule by themselves.
A confirmed Practice Repair Entry creates a Practice Follow-up by default.
When the Practice Repair Intent requires content repair, the Practice Follow-up becomes actionable only after that repair is completed.
A Practice Follow-up may be explicitly dismissed or waived to avoid unnecessary pending follow-up work.
_Avoid_: Error log entry, mistake record, remediation ticket

**Practice Repair Intent**:
The structured action the User plans to take when repairing a Study Note after weak recall evidence.
In v1, Practice Repair Intent describes content repair only: tightening the expected answer, splitting a Study Note, adding a memory aid, or creating a sibling Study Note.
The `split-study-note` intent uses a lightweight split flow that creates one or more sibling Study Notes from the same source Note and requires narrowing the original Study Note.
Completing a `split-study-note` Practice Repair Entry requires at least one sibling Study Note from the same source Note and explicit narrowing of the original Study Note through the split flow.
Additional split targets may be added later without blocking completion of the original `split-study-note` Practice Repair Entry.
The `split-study-note` intent remains distinct from `create-sibling-study-note`, which creates another Study Note from the same source without requiring the original Study Note to be narrowed.
The `add-memory-aid` intent stays broad; the User chooses Metaphor or Acronym during the linked repair action.
Completing an `add-memory-aid` Practice Repair Entry requires creating either a Metaphor or Acronym through the linked repair action and recording which aid type and aid reference satisfied it.
Practicing again is not a Practice Repair Intent; it is modeled separately as a Practice Follow-up action attached to a Practice Repair Entry.
Practice Repair Intent does not classify the mistake type.
_Avoid_: Error type, mistake category, diagnosis

**Practice Follow-up**:
An action attached to a Practice Repair Entry that asks the User to test the repaired Study Note again.
In v1, every confirmed Practice Repair Entry creates a Practice Follow-up by default unless the User explicitly dismisses or waives it.
When the attached Practice Repair Entry still has unresolved content repair, the Practice Follow-up is not actionable yet.
When a Practice Follow-up becomes actionable, it enters Recall Today as an explicit recall reason and remains visible in Study Note and Results contexts.
In v1, a Practice Follow-up stays pending until any later attempted RecallSession Question for the same Study Note satisfies it, regardless of rating.
Starting a RecallSession from a completed Practice Repair Workspace expresses intent only; the Practice Follow-up is satisfied only after the User attempts the Question.
The later Question rating remains separate evidence for Learning State; Forgot or Hard keeps Needs practice active and may create a new Practice Repair Entry or Practice Follow-up rather than keeping the original follow-up pending.
A Forgot or Hard targeted follow-up attempt becomes new weak recall evidence and may surface a new unconfirmed repair candidate; it does not reopen or keep the previous Practice Follow-up pending.
Practice Follow-up completion is not modeled through Practice Repair Entry status transitions.
_Avoid_: Repair status, practice status, workflow step

**Due for Recall**:
A per-Study Note scheduling state meaning the Study Note's recall due date is today or earlier in the User's User Time Zone.
Incomplete Study Notes are not Due for Recall.
In v1, Due for Recall is assigned by the Study Note's Recall Schedule rather than inferred only from the latest recall score.
The User does not manually assign Due for Recall; the app updates it from recall evidence.
_Avoid_: Review Today, ready for review, due review, due card

**Recall Schedule**:
A per-Study Note spaced-recall plan that determines when the Study Note should next be recalled.
In v1, the app manages Recall Schedules internally from RecallSession evidence while the User sees simple recall timing copy such as Recall Today or next recall date.
In v1, the Recall Schedule should behave like a simple spaced-repetition scheduler: forgotten or hard recall keeps the Study Note close, while good or easy recall pushes the next recall further away.
The Recall Schedule may use an internal spaced-repetition algorithm, but the domain language should not expose algorithm names such as SM-2 to the User.
_Avoid_: Spaced-repetition engine, SM-2 card state, review interval

**Recall Today**:
A user-facing prioritized recall queue for recallable Study Notes the app recommends now.
Recall Today may include Study Notes with Needs practice evidence, actionable Practice Follow-ups, or Due for Recall schedules, but those remain separate domain signals.
By default, Recall Today prioritizes Needs practice and actionable Practice Follow-ups first, then recallable Study Notes with no recall evidence, then Study Notes that are Due for Recall by schedule.
When Recall Today includes a Study Note because of an actionable Practice Follow-up, it shows that as an explicit recall reason.
When a Study Note has both Needs practice evidence and an actionable Practice Follow-up, Recall Today shows one high-priority row, uses Practice Follow-up as the primary displayed reason, and shows Needs practice as supporting context.
_Avoid_: Review Today, due review queue, weak notes queue

**Interleaved Recall**:
A RecallSession recommendation that mixes related Study Notes after the User has enough successful recall evidence to benefit from strategy discrimination.
Interleaved Recall should not be automatic for brand-new or struggling Study Notes.
By default, a Study Note becomes eligible for automatic Interleaved Recall after two successful recall attempts, where successful means self-rated Good or Easy.
Automatic Interleaved Recall should wait until there are at least four eligible related Study Notes, usually connected by the same Label or sibling source concepts.
If a Study Note is later rated Forgot or Hard, it returns to Needs practice before automatic Interleaved Recall.
_Avoid_: Random quiz, mixed review, shuffle mode

**Study Layer**:
The app-based transformation of source study material into Notes, Study Notes, memory aids, RecallSessions, and FocusSessions.
In the exam-support pilot, the Study Layer is used alongside external exam material rather than replacing it.
The future product direction is for the app to become the User's primary study workspace when the User trusts it enough for long-term study.
_Avoid_: Source notes, exam notebook

**Source Import**:
A future workflow that brings external study material, such as content from another notes platform, into the Study Layer as source material for Notes and Study Notes.
Source Import does not make external pages the practiced object; RecallSessions, Recall Schedules, Learning State, and Needs practice remain attached to Study Notes.
_Avoid_: Note sync, Notion recall, external deck

**Persistent Study Data**:
Authenticated study data that remains available to the same User across browsers, devices, sign-outs, and app restarts.
_Avoid_: Local cache, browser storage

**Label**:
A named concept used to group Study Notes. Labels form a DAG — a Label can have multiple parent Labels and multiple child Labels. A Study Note can belong to multiple Labels directly.
_Avoid_: Tag, category, folder, topic, study field

### Recall

**RecallSession**:
A user-initiated event where the user is tested on a selected set of Study Notes. The source Note reference starts hidden; depending on the RecallMode, the user may reveal it later to self-assess or review the answer.
In v1, the User chooses Study Notes for a RecallSession through search/filter and explicit selection.
In v1, only Study Notes with non-empty expected answers can enter a RecallSession.
In v1, the selected set is temporary and exists only to start that RecallSession; it is not saved as a reusable grouping.
For `AiAssisted` and `AiGraded`, the User chooses the question style for the session up front: `open-ended`, `multiple-choice`, or `mixed`.
Study Notes are presented in random order within the RecallSession.
A RecallSession snapshots its target Study Notes, their source Note references, and generated Questions at the moment the session starts, so later edits or deletions do not change that in-progress session.
After the User reveals the answer, the RecallSession shows the Study Note expected answer first and the source Note second as supporting context.
An in-progress RecallSession is Persistent Study Data so the User can recover it after refresh or app reopen.
_Avoid_: Review session, quiz, test

**RecallMode**:
The style of a RecallSession. One of three values:
- `FlashCard` — Study Note reference material is hidden; user toggles to reveal, then self-rates their recall. No AI. Free.
- `AiAssisted` — AI generates a question for a Study Note; user answers; user self-assesses by toggling the source Note reference. Premium.
- `AiGraded` — AI generates a question for a Study Note; user answers; AI grades the answer against the Study Note and source Note reference and suggests fixes. Premium.
If the AI provider fails for a Study Note during `AiAssisted` or `AiGraded`, that Study Note falls back to `FlashCard` behaviour for the current RecallSession and the session continues.
_Avoid_: Mode, difficulty, tier

**Question**:
A prompt generated for a Study Note during a RecallSession. Can be open-ended or multiple choice. Stores the user's answer and a score. Belongs to exactly one RecallSession and one Study Note.
Going forward, each stored Question in a SessionResult has a stable questionResultId for historical references such as Practice Repair Entries.
In `FlashCard`, the meaningful learner-facing judgment is the user self-rating; any numeric score is only a derived internal projection of that self-rating, not a separate grade.
In `AiGraded`, the score is the AI-generated system score for v1. User overrides are out of scope for now, but can be added later as a separate final score without changing the meaning of the Question itself.
For multiple-choice Questions, distractors should be context-bound and plausible within the selected study area rather than arbitrary invented wrong answers.

**SessionResult**:
The persistent record of a completed RecallSession — when it happened, which Study Notes were targeted, and the full list of Questions with answers and scores.
_Avoid_: History, log, summary
Use "Results" for user-facing UI copy that refers to completed recall work.
A selectable Results list item represents one SessionResult, not a Note, Label, or saved recall set.
A RecallSession is considered completed and gets a SessionResult when the user has attempted at least one Question, even if they end the session early before covering every Study Note. A session with zero attempted Questions is discarded.
Each stored Question in a SessionResult preserves the Study Note prompt, expected answer or reference focus, and source Note snapshot used at the time of the session, so later Note or Study Note edits do not change historical results.
In v1, Questions stored inside SessionResults are the recall evidence source; there is no separate recall-attempt domain object or table.
In v1, SessionResult review is question-first: stored Questions are the primary review evidence, while targeted Study Notes and source Notes are supporting context about what was practiced.
In v1, revealed or historical answer review shows the Study Note expected answer before the source Note.
In `FlashCard`, a SessionResult shows a session-level aggregate self-rating percentage derived from the stored self-ratings, using the familiar progress iconography in the place where score would otherwise appear, labeled as **Session self rating** rather than score.
In `FlashCard`, a SessionResult may also show the self-rating distribution as supporting detail when space allows, but on tighter layouts the aggregate self-rating percentage remains the only summary shown.

### Focus

**FocusSession**:
A user-initiated block of focused study time that can run while the user is taking Notes, reviewing Notes, or doing a RecallSession.
A FocusSession supports attention and recovery, but Focus time is not recall evidence or proof of learning by itself.
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
A study context associated with a FocusSession, such as a Label, a RecallSession, or unlabeled Study Note work.
When Note work creates a FocusTarget in v1, the FocusRecord snapshots the touched Note, its Study Notes, and the Labels attached to those Study Notes at the time. Unlabeled Study Note work remains a valid FocusTarget.
When RecallSession work creates a FocusTarget in v1, the FocusRecord snapshots the RecallSession plus the Study Note, source Note, and Label snapshots used inside that RecallSession.
_Avoid_: Goal, task, bucket

**StudyActivity**:
An interaction that counts as meaningful work during a FocusSession and can produce or reinforce a FocusTarget.
In v1, StudyActivity includes creating or editing a Note, creating or editing a Study Note, adding or editing Metaphors or Acronyms, reviewing an existing Note for at least 30 seconds while the app is visible during an active FocusInterval, starting or answering inside a RecallSession, and working inside a Label-filtered Study Notes or Recall context.
In v1, StudyActivity excludes opening settings, navigating between pages, typing search text by itself, briefly selecting a Note, and idle time.
_Avoid_: Click, page view, navigation event

### Users & Access

**User**:
A person with an account. In v1, a User signs in with email and password.
_Avoid_: Account, member, profile

**Session**:
A server-managed authenticated access period for a User, represented in the browser only by an HTTP-only cookie.
_Avoid_: Local login state, browser account

**User Language**:
The User's single preferred language for app chrome and language-aware study defaults in v1.
In v1, supported User Languages are English, Portuguese (Portugal), and Spanish.
In v1, changing User Language translates app chrome such as navigation, controls, validation messages, empty states, and settings copy.
For a new User, initial User Language is detected from the browser on first visit and stored when the User registers; unsupported browser languages fall back to English.
After registration, Settings is the only place where the User changes User Language.
Anonymous pages use the detected User Language before registration or login; authenticated pages use the stored User Language.
Changing User Language does not translate or mutate existing Notes, Study Notes, Labels, Metaphors, Acronyms, RecallSessions, SessionResults, FocusSessions, or FocusRecords.
_Avoid_: Interface language, Study Language, Note Language, app language, translation mode, Portuguese (Brazil)

**User Time Zone**:
The User's required IANA time zone preference for displaying and grouping time-based study records.
For a new User, initial User Time Zone is detected from the browser and stored when the User registers; if detection is unavailable, the app falls back to UTC.
After registration, Settings is the only place where the User changes User Time Zone.
Existing Users without a stored User Time Zone receive UTC rather than being blocked from Settings.
_Avoid_: Locale, region, timezone string, device time zone

**Study Objective**:
An optional User preference that captures the User's broad reason for using the app, such as university study, self study, or a specific exam.
In v1, Study Objective is selected from fixed options: University study, Self study, Specific exam, Professional learning, or Other.
In v1, Study Objective is profile context only; it does not affect RecallSession targeting, FocusTargets, analytics, or Labels.
In v1, Settings is the only place where the User sets or changes Study Objective.
_Avoid_: Main objective, goal, FocusTarget, Label

**Study Intensity**:
An optional User preference that describes the User's intended study cadence or commitment level.
In v1, Study Intensity is selected from fixed options: Light, Regular, or Intensive.
In v1, Study Intensity is profile context only; it does not affect FocusSession timing defaults, RecallSession difficulty, analytics, scheduling, or notifications.
In v1, Settings is the only place where the User sets or changes Study Intensity.
_Avoid_: Difficulty, RecallMode, FocusMethod, streak target

**Study Guidance**:
The app's contextual recommendation for what the User should do next in the Learning Loop.
In v1, Study Guidance should adapt from local Study Note and Label evidence rather than a broad beginner, intermediate, or advanced User profile.
In v1, daily Study Guidance should center on Recall Today and Practice Repair; a full weekly planning or weekly review feature is deferred.
_Avoid_: Learner level, study persona, difficulty profile

**BYOK** (Bring Your Own Key):
The current premium access model. A User supplies their own AI provider API key; the app uses it for AiAssisted and AiGraded RecallModes. Future model: per-use credits. BYOK key persistence is deferred until AiAssisted or AiGraded is in scope.

**Pilot Registration Code**:
A shared invitation code required to create a User during the v1 exam-support pilot.
_Avoid_: Admin approval, public signup

### Workspace Navigation

**Study Notes Workspace**:
The primary authenticated workspace where the User creates Study Notes, captures or edits their source Notes, and edits Study Note prompts, expected answers, Labels, Metaphors, and Acronyms.
In the Study Notes Workspace, the User may assign existing Labels to a Study Note, but creating Labels and managing Label graph relationships belongs to the Labels workspace.
The primary navigation label for the Study Notes Workspace is "Study Notes".
The Study Notes Workspace route is `/study-notes`.
The old `/notes` route is removed rather than redirected.
After login or registration, the User lands on `/study-notes`.
The Study Notes Workspace has a Study Notes list, not a separate source Notes list.
New Study Note is the primary creation action; it creates a new supporting source Note by default.
Add Study Note from this source is the explicit action for creating another Study Note tied to an existing source Note.
The Study Note editor shows Study Note fields first and the source Note title/body below them, visible by default.
The Study Note editor may show compact recall insight copy that combines Learning State and Recall Schedule for the User while keeping those concepts separate in the domain model.
The Study Notes Workspace protects unsaved Study Note edits before replacing the selected Study Note or abandoning a new Study Note draft.
When a selected Study Note shares its source Note with other Study Notes, the editor should make that shared source context clear before the User edits it.
Shared source Note editing should not require confirmation; confirmation is reserved for destructive actions such as deleting the last Study Note and its source Note.
_Avoid_: Product menu, notes page, Notes Workspace

**Recall Section**:
The primary authenticated section that acts as the base entry point for recall capabilities, including starting RecallSessions and reviewing SessionResults.
In v1, the Recall Section should open on Recall Today by default when the User has recommended recall work.
The User may still enter Recall Selection Mode to search, filter, and manually select Study Notes for a RecallSession.
_Avoid_: Recall dashboard, Recall home, Practice (possible future user-facing label), Recall history, quiz area

**Results Workspace**:
A Recall Section subroute, `/recall/results`, where the User reviews completed SessionResults and starts Practice Repair from weak Questions.
_Avoid_: History, recall log, base Recall screen

**Focus Section**:
The authenticated workspace section for running FocusSessions, reviewing FocusRecords, and seeing focus analytics. Compact active FocusSession controls remain globally available across the authenticated workspace.
In v1, the Focus Section shows the active FocusSession when present, supported Pomodoro timing configuration, completed FocusRecords newest first, completed FocusInterval time, BreakInterval count and duration as secondary detail, touched FocusTargets, and basic cross-study analytics derived only from existing Notes, Recall SessionResults, and FocusRecords.
In v1, FocusSession timing controls in the Focus Section are visible but disabled while a FocusSession is active; timing changes apply only when no FocusSession is running.
In v1, the Focus Section setup can be reset to the standard 25/5 Pomodoro setup with 4 planned FocusIntervals.
Focus should suggest Learning Loop actions only when relevant, such as creating Study Notes from touched material, starting Recall Today, or repairing Needs practice.
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
A temporary Recall Section route, such as `/recall/select`, with a dedicated recall picker where the User searches/filters Notes and selects Study Notes for a new RecallSession.
_Avoid_: Bulk edit mode, saved set builder, deck builder

**Practice Repair Workspace**:
A Recall Section subroute, such as `/recall/repair/:practiceRepairEntryId`, where the User works through one confirmed Practice Repair Entry from correction through completion or follow-up.
The Practice Repair Workspace explains the active repair and links to the relevant Study Notes Workspace repair action for content changes.
The Practice Repair Workspace does not duplicate Study Note editing, split, sibling creation, Metaphor, or Acronym editing flows.
When the Practice Repair Workspace deep-links to a Study Notes Workspace repair action, it carries the Practice Repair Entry identity as an explicit return target.
After the linked Study Notes action completes, the UI shows a visible return action to the originating Practice Repair Workspace rather than automatically navigating away.
When the Practice Repair Entry is completed, the Practice Repair Workspace shows a completion state and makes "Recall again soon" the primary next step.
From the completed Practice Repair Workspace, the User may start a targeted single-Study-Note RecallSession for the repaired Study Note or return to the Practice Repair Queue.
_Avoid_: Results panel, repair toggle, error-log detail

**Practice Repair Queue**:
A Recall Section subroute, `/recall/repair`, where the User sees repair-focused work across Study Notes without first opening a specific SessionResult.
The Practice Repair Queue is discoverable as a secondary action inside the Recall Section, not as a primary sidebar navigation item.
The Practice Repair Queue contains both unconfirmed repair candidates from Forgot or Hard Questions and active Practice Repair Entries.
For unconfirmed repair candidates, the Practice Repair Queue shows only the newest candidate per Study Note.
Repeated weak Questions for the same Study Note may be summarized in the Practice Repair Queue as recent failed attempts, while full evidence remains in Results.
When a Study Note already has an active Practice Repair Entry, the Practice Repair Queue suppresses unconfirmed repair candidates for that Study Note.
Newer weak Questions for a Study Note with an active Practice Repair Entry may appear as supporting context for the active repair or remain available in Results history.
Unconfirmed repair candidates open Practice Repair Draft Views; active Practice Repair Entries open Practice Repair Workspaces.
The Practice Repair Queue prioritizes active Practice Repair Entries before unconfirmed repair candidates, with newest weak recall evidence first inside each group.
The Practice Repair Queue is not a timed or recorded repair session.
_Avoid_: Repair session, weak notes page, error log

**Practice Repair Draft View**:
A question-scoped Results route, such as `/recall/results/:sessionResultId/questions/:questionResultId/repair`, where the User reviews weak Question evidence and confirms a Practice Repair Entry.
The Practice Repair Draft View is the full-page choose-one-repair surface; it is not an inline Results toggle.
Suggested repair cards in the Practice Repair Draft View only choose the intended repair path; persistence still requires explicit confirmation of the Practice Repair Intent and correction.
_Avoid_: Repair entry, active repair workspace, inline results toggle

**Recall Session View**:
The focused current-session route shown after a RecallSession starts, such as `/recall/session`.
_Avoid_: Quiz page

**Workspace Breadcrumb**:
A small navigational trail that shows where the User is inside a workspace section.
_Avoid_: Product menu, sidebar navigation

## Relationships

- A **Label** can have zero or more parent **Labels** and zero or more child **Labels** (DAG, not a tree)
- Label graph cycles are invalid; v1 prevents them in application logic and relies on database constraints only for duplicate edges and self-parent edges.
- A **Study Note** can belong to zero or more **Labels**
- A **Study Note** belongs to exactly one **Note**
- A **Study Note** never belongs to multiple source **Notes**
- A **Note** may produce multiple **Study Notes**
- Every saved **Note** has at least one default **Study Note**
- A **Study Note** owns its own title or prompt independently from its source **Note** title
- A **Study Note** owns its own expected answer or reference focus
- Editing a source **Note** does not automatically rewrite existing **Study Notes**
- Deleting a **Study Note** does not automatically delete its source **Note**
- Deleting the last **Study Note** for a source **Note** requires explicit confirmation to delete both the Study Note and source Note
- Source **Notes** are not directly deleted through a separate source Note delete action
- A **Study Note** has zero or more **Metaphors** (cannot exist without their Study Note)
- A **Study Note** has zero or more **Acronyms** (cannot exist without their Study Note)
- The **Learning Loop** is centered on **Notes**, **Study Notes**, and **RecallSessions**; **Metaphors** and **Acronyms** support Study Notes but are not standalone workspace destinations.
- The core **Learning Loop** does not require AI.
- A **Learning State** belongs to exactly one **Study Note**
- Passive study activity can support the **Study Layer**, but it is not learning progress unless it produces or reinforces **Study Notes** or recall evidence.
- **Practice Repair** follows weak recall evidence and helps the User improve or split Study Notes without introducing a full error-log concept in v1.
- **Practice Repair** may persist **Practice Repair Entries** for future practice planning.
- The **Recall Section** exposes **Practice Repair** through two entry points: the **Practice Repair Queue** at `/recall/repair` and repair candidates shown inside the **Results Workspace**.
- **Practice Repair** is exposed as a Recall subroute and secondary Recall Section action, not as a primary sidebar navigation item.
- Results repair candidates are based on Forgot or Hard **Questions**; user-facing copy should avoid calling Study Notes "weak notes".
- The **Practice Repair Queue** includes both unconfirmed repair candidates and active **Practice Repair Entries**.
- The **Practice Repair Queue** deduplicates unconfirmed repair candidates to the newest candidate per **Study Note**.
- Repeated weak **Questions** for the same **Study Note** may be summarized in the **Practice Repair Queue**, while the full historical evidence remains in **Results**.
- If a **Study Note** already has an active **Practice Repair Entry**, the **Practice Repair Queue** suppresses unconfirmed repair candidates for that **Study Note**.
- Newer weak **Questions** for a **Study Note** with active repair work may be supporting context for the active repair, while full evidence remains in **Results**.
- Unconfirmed repair candidates in the **Practice Repair Queue** open **Practice Repair Draft Views** rather than creating **Practice Repair Entries** directly.
- Active **Practice Repair Entries** in the **Practice Repair Queue** open their canonical **Practice Repair Workspaces**.
- The **Practice Repair Queue** prioritizes active **Practice Repair Entries** before unconfirmed repair candidates, with newest weak recall evidence first inside each group.
- **Practice Repair Entries** are queryable future-practice evidence, not recall evidence by themselves.
- In v1, **Practice Repair Entries** are created from Results review only, based on weak recall evidence from stored **Questions**.
- Results review may show draft **Practice Repair** suggestions for Forgot or Hard **Questions**, but persistence requires explicit User confirmation of the **Practice Repair Intent** and correction.
- A **Practice Repair Draft View** is question-scoped to preserve the weak **Question** evidence before confirmation.
- The **Practice Repair Draft View** owns the full weak-question review layout and suggested repair selection before any **Practice Repair Entry** exists.
- Selecting a suggested repair in the **Practice Repair Draft View** opens an intent-specific confirmation panel on the same page rather than creating workflow state immediately.
- Confirming from a **Practice Repair Draft View** creates a durable **Practice Repair Entry** and redirects to that entry's **Practice Repair Workspace**.
- A **Practice Repair Entry** has exactly one **Practice Repair Intent** and one free-text correction.
- The `split-study-note` **Practice Repair Intent** creates one or more sibling **Study Notes** from the same source **Note** and requires narrowing the original **Study Note**.
- Completing a `split-study-note` **Practice Repair Entry** requires at least one sibling **Study Note** from the same source **Note** and explicit narrowing of the original **Study Note** through the split flow.
- The `create-sibling-study-note` **Practice Repair Intent** creates another **Study Note** from the same source **Note** without requiring the original **Study Note** to be narrowed.
- The `add-memory-aid` **Practice Repair Intent** is satisfied by creating either a **Metaphor** or **Acronym** through the linked repair action and recording which aid satisfied it.
- A **Practice Repair Entry** belongs to exactly one **Study Note**.
- A confirmed **Practice Repair Entry** has a durable identity used by the canonical **Practice Repair Workspace**.
- In v1, every **Practice Repair Entry** references the **SessionResult** and stored **Question** that prompted it.
- Going forward, **Practice Repair Entries** reference stored **Questions** by stable questionResultId; question index references are legacy fallback only.
- **Practice Repair Entries** rely on **SessionResult** snapshots for historical recall context rather than duplicating those snapshots.
- Results review is the creation surface for **Practice Repair Entries**; the **Practice Repair Workspace** is the active workspace after confirmation.
- The **Practice Repair Workspace** orchestrates active repair work and deep-links to the **Study Notes Workspace** for content changes.
- Study Note editing, split repair, sibling Study Note creation, and memory-aid creation remain owned by the **Study Notes Workspace**.
- Deep links from the **Practice Repair Workspace** to the **Study Notes Workspace** carry the originating **Practice Repair Entry** identity as an explicit return target.
- After the matching linked Study Notes action completes, the UI shows a visible "Return to Practice Repair" action rather than automatically navigating away.
- When a **Practice Repair Entry** is completed, the **Practice Repair Workspace** shows a completion state and makes "Recall again soon" the primary next step.
- From completed repair, "Start recall now" starts a targeted single-**Study Note** **RecallSession** for the repaired **Study Note**, not the full **Recall Today** queue.
- Starting that targeted **RecallSession** does not satisfy the **Practice Follow-up**; satisfaction requires an attempted **Question** for the repaired **Study Note**.
- If that targeted follow-up attempt is rated Forgot or Hard, the old **Practice Follow-up** is still satisfied and the failed attempt becomes new weak recall evidence for a future repair candidate.
- From completed repair, the User may return to the **Practice Repair Queue** instead of starting recall immediately.
- When a **Study Note** is deleted, its **Practice Repair Entries** become read-only historical repair records and are removed from active planning and **Recall Today**.
- A **Study Note** may have multiple historical **Practice Repair Entries**, but at most one active **Practice Repair Entry** per **Practice Repair Intent**.
- Confirming a same-intent draft **Practice Repair** suggestion supersedes the existing active **Practice Repair Entry** and makes the new **Practice Repair Entry** active.
- Distinct **Practice Repair Intents** may have active **Practice Repair Entries** for the same **Study Note** at the same time.
- A **Practice Repair Entry** is active while its **Practice Repair Intent** remains unresolved or its **Practice Follow-up** is pending.
- A **Practice Repair Entry** becomes historical when completed, dismissed, superseded, or satisfied by follow-up evidence, as applicable.
- A **Practice Repair Entry** correction is editable while active and read-only once historical, including deleted-Study Note history.
- A **Practice Repair Entry** is completed only by explicit User completion or by the User performing the matching linked repair action from that entry.
- Arbitrary edits do not complete **Practice Repair Entries** by inference.
- Lifecycle facts are the source of truth for whether a **Practice Repair Entry** is active or historical; any stored lifecycle status is only a projection.
- A confirmed **Practice Repair Entry** creates a **Practice Follow-up** by default unless the User explicitly dismisses or waives it.
- A **Practice Follow-up** becomes actionable only after required content repair is completed, and later **RecallSession** evidence can satisfy it.
- A saved **Study Note** has one **Recall Schedule**
- A saved **Study Note** may be **Due for Recall** based on its **Recall Schedule**
- **Recall Today** may include **Due for Recall** Study Notes, Study Notes with **Needs practice** evidence, and Study Notes with actionable **Practice Follow-ups**, while preserving those as separate signals.
- **Recall Today** shows actionable **Practice Follow-ups** as an explicit recall reason.
- When both signals apply, **Recall Today** shows one high-priority Study Note row with **Practice Follow-up** as the primary displayed reason and **Needs practice** as supporting context.
- **Interleaved Recall** uses related eligible **Study Notes** and should wait for successful recall evidence before becoming automatic.
- The **Study Layer** turns external source material into **Notes**, **Study Notes**, **Metaphors**, **Acronyms**, **RecallSessions**, and **FocusSessions**.
- A future **Source Import** may bring external study material into the **Study Layer**, but the practiced memory unit remains the **Study Note**.
- During the exam-support pilot, the **Study Layer** must not be the only place where irreplaceable exam material exists.
- The exam-support pilot starts with no pre-seeded **Notes**, **Study Notes**, **Labels**, **RecallSessions**, **SessionResults**, **FocusSessions**, or **FocusRecords** for Test Participants.
- The long-term product direction is for the **Study Layer** to become the **User**'s primary study workspace.
- **Persistent Study Data** belongs to a **User** and must survive sign-out, browser changes, and app restarts.
- In v1, authenticated study work requires the app server and database; offline study writes are not supported.
- During the Study Note migration, existing Note label assignments may be copied to each Note's default Study Note; because current data is disposable, resetting the database is also acceptable if it keeps the migration simpler.
- In v1, the **Learning Loop** has two primary sections: the **Study Notes Workspace** and the **Recall Section**.
- In v1, the **Study Notes Workspace** route is `/study-notes`.
- The old `/notes` route is removed rather than redirected.
- After login or registration, the **User** lands on `/study-notes`.
- Searching for a **Note** includes its own title and body plus the titles/content of **Metaphors** and **Acronyms** attached to its Study Notes, but the search result is still the **Note**.
- Searching/filtering Notes for a **RecallSession** includes the Note title/body and the titles/content of **Metaphors** and **Acronyms** attached to its Study Notes, but the RecallSession target is a **Study Note** extracted from the owning **Note**.
- A **RecallSession** targets one or more **Study Notes** selected by the **User**
- The **Recall Section** opens on **Recall Today** by default when recommended recall work exists.
- **Study Notes** are the durable recall targets used by **RecallSessions**
- In **RecallSessions**, answer reveal shows the Study Note expected answer before the source **Note**
- In v1, a **User** can have at most one active **RecallSession** at a time.
- The selected Study Notes used to start a **RecallSession** are a temporary one-off selection, not a saved set, collection, deck, or Label.
- In v1, **Labels** may help filter or group **Study Notes**, but **Labels** are not the foundation of **RecallSession** targeting.
- Unlabeled **Study Notes** are recallable because **RecallSessions** target selected **Study Notes** directly.
- A **RecallSession** has exactly one **RecallMode**
- A **RecallSession** has a **SessionResult** — date, targeted Study Notes, and the full list of Questions with answers and scores
- A **Question** belongs to exactly one **RecallSession** and one **Study Note**
- A **Question** stores the user's answer and a score (self-rated or AI-graded depending on RecallMode)
- A **FocusSession** is separate from a **RecallSession** and may overlap with Note-taking, Note review, or a **RecallSession**
- A **FocusSession** supports the **Learning Loop**, but Focus time is not learning evidence unless it includes recall or StudyActivity that produces or reinforces Study Notes.
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
- A **User** has exactly one **User Language**
- **User Language** controls translated app chrome and v1 language-aware study defaults.
- A new **User**'s initial **User Language** is detected from the browser on first visit, with English as the fallback for unsupported browser languages.
- After registration, **User Language** is changed only in Settings.
- Anonymous pages use the detected **User Language**.
- Authenticated pages use the stored **User Language**.
- Changing **User Language** does not translate or mutate the User's **Persistent Study Data**.
- A **User** has exactly one **User Time Zone**.
- **User Time Zone** controls how time-based study records are displayed and grouped.
- A new **User**'s initial **User Time Zone** is detected from the browser on registration, with UTC as the fallback when detection is unavailable.
- After registration, **User Time Zone** is changed only in Settings.
- A **User** may have zero or one **Study Objective**.
- **Study Objective** is User profile context only and does not create or modify **FocusTargets**, **RecallSessions**, or **Labels**.
- **Study Objective** is set or changed only in Settings.
- A **User** may have zero or one **Study Intensity**.
- **Study Intensity** is User profile context only and does not change **FocusSession** timing, **RecallMode**, scheduling, analytics, or notifications.
- **Study Intensity** is set or changed only in Settings.
- **Study Guidance** adapts from local **Study Note** and **Label** evidence, not from a broad learner-level setting.
- In v1, **Study Guidance** does not include a full weekly planning workspace.
- A **FocusTarget** may refer to a **Label**, a **RecallSession**, or unlabeled Study Note work
- In v1, **FocusTargets** are captured automatically from the User's observed study activity during the **FocusSession**
- In v1, the app stores the resulting **FocusTargets** for a **FocusSession** rather than a full **StudyActivity** event log.
- In v1, starting a **FocusSession** uses the default **FocusMethod** quickly, but the User may adjust supported timing settings before starting
- In v1, **FocusSession** configuration does not include manual **FocusTarget** selection or additional **FocusMethods**
- A **StudyActivity** must reflect meaningful study engagement, not incidental navigation
- A **FocusSession** may include study work done outside the app, but in v1 only in-app **StudyActivity** creates automatic **FocusTargets**
- A completed **FocusSession** has a **FocusRecord**
- In v1, a **FocusRecord** snapshots its **FocusTargets** as they were during the **FocusSession**; later Note, Study Note, or Label changes do not rewrite past focus history
- In v1, Note-based **FocusTargets** preserve the touched **Note** snapshot, its **Study Note** snapshots, and the **Label** snapshots attached to those Study Notes during the **FocusSession**
- In v1, Recall-based **FocusTargets** preserve the **RecallSession** plus the **Study Note**, source **Note**, and **Label** snapshots used inside that **RecallSession**
- In v1, a **FocusRecord** is created only when the User completes at least one full focus interval; abandoned or early-stopped sessions are discarded
- A **FocusRecord** cannot contain only **BreakIntervals**; at least one completed **FocusInterval** is required
- If a **User** ends a **FocusSession** after at least one completed **FocusInterval**, the **FocusRecord** includes completed **FocusIntervals** and completed **BreakIntervals** only; any in-progress interval is discarded
- In v1, a **FocusSession** ends only when the User explicitly ends it; automatic ending after long inactivity or long breaks is deferred
- In v1, long inactivity may produce a stale-session prompt, but it must not automatically end the **FocusSession**
- In v1, FocusSession interval changes use minimal in-app visual state changes only; browser notifications and sounds are out of scope
- Analytics primarily measure completed **FocusInterval** time; **BreakIntervals** are stored for secondary analysis
- A **RecallSession** that happens during a **FocusSession** counts as study activity inside that **FocusSession**, not as separate extra time on top of it
- In v1, analytics record which **FocusTargets** appeared in a **FocusSession**, but do not assign exact minutes to each target
- A **User** owns all their **Notes**, **Study Notes**, **Labels**, **Metaphors**, **Acronyms**, **RecallSessions**, **Practice Repair Entries**, and **FocusSessions**
- A **Session** belongs to exactly one **User**.
- During the v1 exam-support pilot, creating a **User** requires the **Pilot Registration Code**.
- All relationships are ownership-local to a single **User**. A **Study Note** can only be assigned to **Labels** owned by the same **User**, and a **RecallSession** can only target Study Notes extracted from Notes owned by that User.
- In v1, deleting active **Notes**, **Study Notes**, **Labels**, **Metaphors**, and **Acronyms** is a hard delete. Historical recall records remain available through the snapshots stored in **SessionResult**; historical **Practice Repair Entries** for deleted **Study Notes** remain available only through Results review or other historical context.
- In v1, authenticated study work happens through the **Study Notes Workspace** and the **Recall Section** rather than a generic product-menu sidebar.
- In v1, active **FocusSessions**, **FocusRecords**, and focus analytics are surfaced in the **Focus Section**, separate from the **Study Notes Workspace** and **Recall Section**
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
- The **Study Notes Workspace** owns Study Note search/filter, Study Note selection, Study Note editing, source Note editing, and source Note creation through the New Study Note flow.
- The **Study Notes Workspace** supports adding another **Study Note** from an existing source **Note** when the User splits a source into multiple recall targets.
- A linked split repair flow in the **Study Notes Workspace** creates one or more sibling **Study Notes** from the same source **Note** and requires narrowing the original **Study Note**.
- The linked split repair flow can complete after one sibling **Study Note** is created and the original **Study Note** is narrowed; additional split targets can be added later.
- The **Study Notes Workspace** allows editing a shared source **Note** from any linked **Study Note**, with clear copy that the source is shared.
- The **Study Note** editor shows Study Note prompt, expected answer, Labels, Metaphors, and Acronyms before the source **Note** title/body.
- The **Study Note** editor may show active **Practice Repair Entries** for the selected **Study Note** and provide linked repair actions or explicit completion.
- The **Study Note** editor does not create **Practice Repair Entries** without recall evidence in v1.
- The source **Note** title/body is visible by default in the Study Note editor.
- The **Recall Section** owns starting **RecallSessions** and reviewing **SessionResults**.
- The **Study Notes Workspace** may provide a lightweight "Start Recall" entry point for convenience, but it only opens the **Recall Section**; Study Note selection happens inside Recall.
- In v1, the primary navigation label for the **Recall Section** is "Recall".
- The default `/recall` screen does not need a separate domain term; it is the base **Recall Section**.
- The base **Recall Section** may open on **Recall Today** when recommended recall work exists; completed recall work has its own **Results Workspace**.
- The **Results Workspace** route is `/recall/results`.
- The **Results Workspace** presents completed **SessionResults** in a master-detail layout, similar to the **Study Notes Workspace**.
- The **Results Workspace** includes a persistent selectable list of **SessionResults**, sorted newest first.
- Selecting a **SessionResult** in the **Results Workspace** opens its details in the main review area.
- Selecting a **SessionResult** does not change the route in v1; selected result state is local to the **Results Workspace**.
- When **SessionResults** exist in the **Results Workspace**, the newest **SessionResult** is selected by default.
- After a **RecallSession** creates a **SessionResult**, that newest **SessionResult** appears in the **Results Workspace**.
- In the first version of the **Results Workspace** master-detail layout, the selectable list is by **SessionResult** only; note-level performance review is deferred.
- A **SessionResult** list item shows the completion date/time, attempted Question count, and the session's primary summary metric for that RecallMode.
- In `FlashCard`, a **SessionResult** list item shows the session's average self-rating percentage, rendered compactly as the percentage value alone in the row.
- The selected **SessionResult** detail shows the stored Study Note and source Note snapshots used in that RecallSession.
- The selected **SessionResult** detail centers stored **Questions** and their answers/scores as the primary review content.
- Results review is the only v1 creation surface for **Practice Repair Entries**.
- Results review may show draft **Practice Repair** suggestions for Forgot or Hard **Questions**, but it persists a **Practice Repair Entry** only after the User confirms the **Practice Repair Intent** and correction.
- The selected **SessionResult** detail surface is presented as **Session review** in user-facing heading copy.
- In this version, stored Study Notes and source Notes inside a selected **SessionResult** are shown as summary context only; nested Note selection inside Results is deferred.
- In v1, when a selected **SessionResult** has exactly one targeted **Study Note** and one stored **Question** for that same Study Note, the stored Study Note and source Note are reduced to compact summary metadata instead of a separate context section.
- In v1, a selected **SessionResult** only shows a supporting **Not reached items** section when some targeted **Study Notes** were not reached and therefore have no stored answer in the Questions review.
- In v1, when that supporting **Not reached items** section appears, it lists only the not-reached targeted **Study Notes** rather than repeating attempted Study Notes already covered by the Questions review, and each row shows only the Study Note title.
- In v1, if no targeted **Study Notes** were left unreached, the **Not reached items** section does not appear at all.
- In v1, the selected **SessionResult** question-review list starts with all rows collapsed; each stored **Question** begins as a compact summary row and expands for deeper historical detail.
- In v1, the selected **SessionResult** question-review list behaves as a single-open-row accordion rather than allowing many expanded rows at once.
- In v1, each collapsed stored **Question** row leads with the Question prompt as its primary text.
- In v1, each collapsed stored **Question** row omits answer preview text entirely.
- In v1, each collapsed stored **Question** row keeps its expand affordance visible at all times.
- In v1, the question-review section is labeled **Questions** in user-facing copy because answers and note-reference detail are revealed per row on expansion rather than shown by default.
- In v1, `FlashCard` Question review shows the learner-facing self-rating rather than a separate per-Question numeric score.
- In v1, the canonical `FlashCard` self-rating display in Question review is the explicit rating word, paired with a subtle existing-tone visual treatment and placed as a trailing pill on the right side of the collapsed row.
- In v1, the `FlashCard` self-rating words in Question review stay **Forgot**, **Hard**, **Good**, and **Easy**.
- In v1, expanded `FlashCard` Question detail repeats the self-rating so the full review context stays visible alongside **Your answer** and **Reference note**.
- In v1, expanding a stored **Question** in a selected **SessionResult** shows **Your answer** first and the full stored source **Note** snapshot second, labeled **Reference note**, with the full Note body visible immediately so the historical reference reads as the answer key for that attempt. If a typed answer exists, it is shown in full as written; if none was stored, the answer area says **No typed answer recorded**.
- In v1, an attempted `FlashCard` **Question** remains expandable even when no typed answer was recorded, so the stored source **Note** snapshot reference stays available through the same interaction pattern.
- In v1, a `FlashCard` selected **SessionResult** always shows a header-level aggregate self-rating percentage across attempted Questions in the current score slot, labeled **Session self rating** rather than **Score**.
- In v1, a `FlashCard` selected **SessionResult** may show the self-rating distribution near the aggregate only when layout space stays calm; otherwise it keeps just the aggregate self-rating percentage.
- In v1, the selected **SessionResult** summary line keeps the simpler compact style for fully attempted sessions, but explicitly calls out attempted Question count against the broader session-note set when the session ended early.
- In v1, the selected **SessionResult** stat label uses **Questions** rather than **Questions attempted**.
- In v1, the selected **SessionResult** mode pill keeps the `FlashCard` label in user-facing copy.
- The selected **SessionResult** detail is read-only historical review; editing or deleting past Results is out of scope for this change.
- Starting a new **RecallSession** remains a prominent action in the **Recall Section** and **Results Workspace**.
- The **Results Workspace** places **Start Recall** above the **SessionResult** list, mirroring the **Study Notes Workspace** list action placement while keeping recall-specific wording.
- In v1, starting a new **RecallSession** from the **Results Workspace** happens from the master-panel **Start Recall** action, not from selected-result footer actions.
- **Start Recall** opens **Recall Selection Mode**.
- The **Results Workspace** supports filtering **SessionResults** by **Label**, but **Labels** remain grouping/filtering aids rather than the foundation of **RecallSession** targeting.
- The **Results Workspace** remains available when there are no **SessionResults** and shows an empty Results state with **Start Recall** prominent.
- If the **Recall Section** has no recallable **Study Notes**, it owns the empty state and provides a path to the **Study Notes Workspace** to create Study Notes.
- User-facing copy for completed recall work should say "Results", not "History".
- The old `/history` route should be removed rather than redirected; v1 does not preserve a standalone history route.
- The active **Recall Session View** uses a current-session route, such as `/recall/session`, rather than a per-session addressable route.
- The **Account Dock** owns utility account actions and should not contain product destinations.
- The **Recall Section** enters **Recall Selection Mode** when the User chooses to select Study Notes for recall.
- **Recall Selection Mode** has its own route inside the **Recall Section**, such as `/recall/select`, rather than being an in-page mode on `/recall`.
- **Recall Selection Mode** reuses Note search/filter semantics but does not include Note editing.
- In **Recall Selection Mode**, selecting a Note toggles it into the temporary RecallSession selection instead of opening it for editing.
- Exiting **Recall Selection Mode** clears the temporary selected Study Notes unless a **RecallSession** has already been started.
- Cancelling **Recall Selection Mode** returns the User to the base **Recall Section** and clears the temporary selected Study Notes.
- Starting a **RecallSession** takes the User from the **Recall Section** to a **Recall Session View**.
- Ending or completing a **RecallSession** returns the User to the base **Recall Section**.
- A completed **RecallSession** creates a **SessionResult** and appears in the base **Recall Section** after returning there.
- A **RecallSession** ended early after at least one attempted Question creates a **SessionResult** and appears in the base **Recall Section** like any completed session.
- The **Recall Session View** is only valid while there is an active **RecallSession**; without one, the User returns to the **Recall Section**.
- The **Workspace Breadcrumb** shows the User whether they are in the **Study Notes Workspace**, the base **Recall Section**, or an active **Recall Session View**.
- The **Workspace Breadcrumb** is structural, such as Recall / Session; RecallSession progress belongs inside the **Recall Session View**, not in the breadcrumb.

## Example dialogue

> **Dev:** "When a **User** starts a **RecallSession**, do they have to choose a **Label** first?"
> **Domain expert:** "No — in v1 they search/filter Notes and explicitly select the Study Notes they want to recall."

> **Dev:** "Is **Recall** a separate primary destination beside **Study Notes** in v1?"
> **Domain expert:** "Yes — **Study Notes Workspace** and **Recall Section** are the two primary parts of the **Learning Loop**."

> **Dev:** "Should the **Study Notes Workspace** keep the old `/notes` route?"
> **Domain expert:** "No — use `/study-notes` so routing matches the primary product language."

> **Dev:** "Should old `/notes` links redirect to `/study-notes`?"
> **Domain expert:** "No — remove `/notes`; **Study Notes Workspace** is canonical at `/study-notes`."

> **Dev:** "After login or registration, where should the **User** land?"
> **Domain expert:** "On `/study-notes`, because Study Notes are the primary workspace and prerequisite for recall."

> **Dev:** "Can the User create a source **Note** without creating a **Study Note**?"
> **Domain expert:** "No — source Notes are created or edited inside the **Study Notes Workspace** as supporting material for Study Notes."

> **Dev:** "When the User creates a new **Study Note**, does it always need a new source **Note**?"
> **Domain expert:** "Default to a new source **Note**, but allow an explicit Add Study Note from this source action when splitting one source into several Study Notes."

> **Dev:** "If a source **Note** has several **Study Notes**, can the User edit that source from any linked Study Note?"
> **Domain expert:** "Yes, but the editor must make it clear that the source Note is shared by those Study Notes."

> **Dev:** "If the User deletes one **Study Note**, do we delete its source **Note** too?"
> **Domain expert:** "No — deleting a **Study Note** deletes only that Study Note."

> **Dev:** "What if that was the last **Study Note** for the source **Note**?"
> **Domain expert:** "Require explicit confirmation to delete both the **Study Note** and source **Note**."

> **Dev:** "Can the User directly delete a source **Note**?"
> **Domain expert:** "No — source **Note** deletion only happens through confirmed deletion of the last linked **Study Note**."

> **Dev:** "Should source **Note** content be hidden behind a disclosure in the **Study Note** editor?"
> **Domain expert:** "No — show the source **Note** title and body by default below the Study Note fields."

> **Dev:** "When a User reveals an answer in recall, do they see the expected answer or source **Note** first?"
> **Domain expert:** "Show the **Study Note** expected answer first, then the source **Note** as supporting context."

> **Dev:** "Does the core **Learning Loop** require AI?"
> **Domain expert:** "No — manual Study Note creation, expected answers, recall, self-rating, scheduling, and Needs practice signals are enough for the core loop."

> **Dev:** "Should **Metaphors** and **Acronyms** have their own main workspace screens?"
> **Domain expert:** "No — they help a **Study Note** stick in memory, but the primary learning work is capturing **Notes**, shaping **Study Notes**, and doing **RecallSessions**."

> **Dev:** "If a search match is inside an **Acronym**, does the **RecallSession** target that **Acronym**?"
> **Domain expert:** "No — the **Acronym** helps find the owning **Study Note**, and the selected target is that **Study Note**."

> **Dev:** "Can the User save a selected group of **Study Notes** and reuse it for later **RecallSessions**?"
> **Domain expert:** "Not in v1 — the selection is temporary and only snapshots the Study Notes and their source Note references for the session being started."

> **Dev:** "Should the scheduled recall surface be called Review Today?"
> **Domain expert:** "No — the domain state is **Due for Recall**, and the UI may say Recall Today so it stays aligned with recall language."

> **Dev:** "Should low-performing Study Notes be called weak?"
> **Domain expert:** "No — use **Needs practice** in user-facing UI."

> **Dev:** "Do we need a separate card model for scheduled recall?"
> **Domain expert:** "No — use **Study Note** as the durable recall target. If one Note contains multiple independently scheduled prompts, extract multiple Study Notes from that Note."

> **Dev:** "Does saving a **Note** require the User to manually create the first **Study Note** before recall works?"
> **Domain expert:** "No — every saved **Note** gets a default **Study Note**, and the User may split it into more precise Study Notes later."

> **Dev:** "What does the default **Study Note** use as its first expected answer?"
> **Domain expert:** "It starts with the source **Note** title as the prompt and the full source **Note** body as the expected answer."

> **Dev:** "If the User edits the source **Note**, should existing **Study Notes** silently update?"
> **Domain expert:** "No — once created, a **Study Note** owns its prompt and expected answer. Refreshing from source can be an explicit action later."

> **Dev:** "Can different **Study Notes** point back to the same source **Note**?"
> **Domain expert:** "Yes — one source **Note** can produce multiple **Study Notes**, each with its own title or prompt."

> **Dev:** "Does a **Study Note** only point at a source **Note**, or does it define the answer the User should recall?"
> **Domain expert:** "It defines its own expected answer or reference focus, while the source **Note** remains broader context."

> **Dev:** "Can a **Metaphor** be reused across multiple **Study Notes**?"
> **Domain expert:** "No — a **Metaphor** is always tied to exactly one **Study Note**. If something works for two Study Notes, write it twice."

> **Dev:** "When migrating existing Notes, what happens to their Labels?"
> **Domain expert:** "Copy existing Note Labels to each default **Study Note** if preserving data matters; otherwise a database reset is acceptable at this stage."

> **Dev:** "What's the difference between **AiAssisted** and **AiGraded**?"
> **Domain expert:** "In AiAssisted, the User decides if their answer was right by reading the source Note reference themselves. In AiGraded, the AI compares the answer against the Study Note and source Note reference."

> **Dev:** "Is a pomodoro just a timer inside a **RecallSession**?"
> **Domain expert:** "No — that's a separate **FocusSession** that can happen during recall, note-taking, or other study work."

> **Dev:** "Is `Pomodoro` the domain concept?"
> **Domain expert:** "No — `Pomodoro` is the default **FocusMethod** used by a **FocusSession**."

> **Dev:** "Does every **FocusSession** have to belong to a **RecallSession** or a **Note**?"
> **Domain expert:** "No — it can stand alone, but once completed it should still produce a **FocusRecord** so time can be analyzed later."

> **Dev:** "If a 50-minute **FocusSession** starts in one **Label**, includes a **RecallSession**, and ends with new unlabeled **Notes**, do we force the User to pick one?"
> **Domain expert:** "No — the session can accumulate multiple **FocusTargets**, including unlabeled Study Note work, without interrupting focus."

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

> **Dev:** "If one **FocusSession** touches `React`, `CSS`, and unlabeled Study Note work, how many minutes does each one get?"
> **Domain expert:** "In v1 we only record that those **FocusTargets** appeared in the **FocusSession**; exact per-target minute splitting is deferred."

> **Dev:** "If the **Focus Dock** lives in the sidebar, is focus just another navigation destination?"
> **Domain expert:** "No — the **Focus Dock** is a persistent utility for the active **FocusSession**. The **Focus Section** remains the destination for reviewing **FocusRecords**."

> **Dev:** "Does v1 need a product-menu sidebar with Study Notes, Recall, Labels, History, and Settings?"
> **Domain expert:** "No — v1 has **Study Notes Workspace** and **Recall Section** as primary Learning Loop sections. Account utilities belong in the **Account Dock**, not in primary product navigation."

> **Dev:** "Should Recall checkboxes always be visible in the **Study Notes Workspace**?"
> **Domain expert:** "No — the User enters **Recall Selection Mode** from the **Recall Section**, then searches/filters Study Notes for the new **RecallSession**."

> **Dev:** "Can the **Study Notes Workspace** still offer a way to start recall?"
> **Domain expert:** "Yes — it can provide a lightweight Start Recall entry point, but it only opens the **Recall Section**; the User selects Study Notes for recall there."

> **Dev:** "Should Start Recall from Study Notes carry the currently selected Study Note into Recall?"
> **Domain expert:** "No — starting from Study Notes opens Recall without preselection. Selection happens in the **Recall Section**."

> **Dev:** "Should **Recall Selection Mode** show the full Note editor?"
> **Domain expert:** "No — it is a dedicated recall picker. It can reuse Note search/filter behaviour, but selection means adding a Study Note to the RecallSession target set."

> **Dev:** "After the User starts a **RecallSession**, does the session stay on the same Study Notes screen?"
> **Domain expert:** "No — the active session opens in a **Recall Session View**, and ending the session returns to the **Recall Section**."

> **Dev:** "After a **RecallSession** completes, should the User go directly to full **Results**?"
> **Domain expert:** "Return to the **Recall Section**; the completed session appears as a **SessionResult** in the **Results Workspace**."

> **Dev:** "If the User ends a **RecallSession** early after one attempted Question, does it appear in **Results**?"
> **Domain expert:** "Yes — it created a **SessionResult**, so it appears anywhere SessionResults are shown."

> **Dev:** "Can the User open the **Recall Session View** directly when no **RecallSession** is active?"
> **Domain expert:** "No — without an active **RecallSession**, they return to the **Recall Section**."

> **Dev:** "Should an active **RecallSession** use a route like `/recall/sessions/:sessionId`?"
> **Domain expert:** "No — in v1 the active session uses a current-session route such as `/recall/session`; per-session routes are deferred until sessions are resumable or otherwise addressable."

> **Dev:** "Should the **Workspace Breadcrumb** show RecallSession progress like '3 of 10'?"
> **Domain expert:** "No — the breadcrumb stays structural, such as Recall / Session, while progress belongs in the **Recall Session View**."

> **Dev:** "Where does broader **SessionResult** history live in v1 navigation?"
> **Domain expert:** "It belongs in the **Results Workspace** inside the **Recall Section** because reviewing completed recall work is part of the core recall workflow."

> **Dev:** "When the User opens the **Recall Section**, is it mainly for starting recall or reviewing old results?"
> **Domain expert:** "It opens on **Recall Today** by default when recommended recall work exists; completed recall work lives in the **Results Workspace**."

> **Dev:** "Should the base **Recall Section** immediately enter **Recall Selection Mode**?"
> **Domain expert:** "No — the User enters **Recall Selection Mode** only when they choose to start a RecallSession."

> **Dev:** "Should **Recall Selection Mode** live inside `/recall`?"
> **Domain expert:** "No — use a dedicated route such as `/recall/select` so the base **Recall Section** remains the entry point."

> **Dev:** "What happens when the User cancels **Recall Selection Mode**?"
> **Domain expert:** "They return to the base **Recall Section**, and the temporary selected Study Notes are cleared."

> **Dev:** "Should the **Results Workspace** support filtering by **Label**?"
> **Domain expert:** "Yes — **Labels** are useful for filtering Results through the targeted Study Notes, but they do not define RecallSession targets."

> **Dev:** "Should **Results** be hidden when there are no **SessionResults**?"
> **Domain expert:** "No — keep **Results** available and show an empty Results state."

> **Dev:** "If there are no **Study Notes**, should Recall redirect to Study Notes?"
> **Domain expert:** "No — stay in the **Recall Section**, explain that recall needs Study Notes, and provide a path to the **Study Notes Workspace**."

> **Dev:** "Should the **Results Workspace** show every **SessionResult** immediately?"
> **Domain expert:** "Yes — it uses a Notes-like master-detail layout with a selectable **SessionResult** list and a detail review pane."

> **Dev:** "Is full **SessionResult** review a mode on the base `/recall` route?"
> **Domain expert:** "No — `/recall/results` is the canonical **Results Workspace** for reviewing **SessionResults**."

> **Dev:** "Should old `/history` links redirect to `/recall`?"
> **Domain expert:** "No — remove `/history`; completed recall work is reviewed through the **Results Workspace**."

> **Dev:** "Should the UI still say 'history' for completed recall work?"
> **Domain expert:** "No — use 'Results' in UI copy. The domain term is **SessionResult**."

> **Dev:** "Do we need a separate term like Recall Dashboard for `/recall`?"
> **Domain expert:** "No — `/recall` is just the base **Recall Section**."

> **Dev:** "Should the primary navigation label say 'Recall' or 'Practice'?"
> **Domain expert:** "Use 'Recall' in v1 because it matches the domain language, but revisit 'Practice' if general users do not recognize active recall terminology."

> **Dev:** "In v1, should a User choose separate languages for app chrome, Notes, and translation?"
> **Domain expert:** "No — v1 has one **User Language** for app chrome and language-aware study defaults; translation is a later explicit feature."

> **Dev:** "Should Portuguese mean Brazilian Portuguese?"
> **Domain expert:** "No — v1 supports Portuguese (Portugal), alongside English and Spanish."

> **Dev:** "If a User changes **User Language** to Portuguese, should buttons and validation messages still be English until later?"
> **Domain expert:** "No — v1 must translate app chrome for every supported **User Language**, but User-created study data stays as written."

> **Dev:** "How does a new User get their first **User Language**?"
> **Domain expert:** "Detect it from the browser on first visit, fall back to English if unsupported, and store it when the User registers."

> **Dev:** "Should registration and login stay English until the User has an account?"
> **Domain expert:** "No — anonymous pages use the detected **User Language**; after login, the stored **User Language** wins."

## Flagged ambiguities

- "trained" was used while discussing **Learning State** — resolved: use "recalled" when referring to a **Study Note** being attempted in a **RecallSession**.
- "techniques the app should encourage by default" could have meant a broad study-technique menu — resolved: default encouragement means the **Core Learning Loop**, with supporting techniques introduced only when they strengthen recall, correction, spacing, or practice.
- "Weak" was considered for low-performing Study Notes — resolved: use **Needs practice** in user-facing UI.
- Mastery percentages could have represented learning progress — resolved for v1: avoid mastery percentages and use factual recall signals such as Not recalled yet, Recall Today, Needs practice, Last score, next recall date, and Interleaved Recall eligibility.
- "AI" could have been required for Study Note generation or grading — resolved: the core **Learning Loop** works without AI.
- AI could have been treated as a default encouraged study technique — resolved: AI is optional support for creating prompts, questions, grading, or Practice Repair, but the core **Learning Loop** remains manual and evidence-based.
- "Review Today" was used for scheduled recall work — resolved: use **Due for Recall** as the scheduling state and **Recall Today** as the user-facing prioritized recall queue.
- **Recall Today** could have been limited to only Study Notes that are **Due for Recall** — resolved: it may also include **Needs practice** Study Notes, with Needs practice first, while keeping the underlying signals separate.
- **Due for Recall** could have been inferred only from latest recall evidence — resolved: in v1 it is assigned by a per-Study Note **Recall Schedule** updated from recall evidence.
- "SM-2" could have leaked an implementation algorithm into product language — resolved: use **Recall Schedule** as the domain term and keep algorithm names internal.
- Full SM-2 could have been implemented exactly for v1 — resolved: use a simplified SM-2-shaped scheduler so the app gets spaced repetition while keeping the schedule explainable and testable.
- "RecallCard" was considered for spaced recall — resolved: use **Study Note** as the durable recall target; multiple independent schedules under one source concept become multiple Study Notes tied to the same **Note**.
- "Study Item" was considered for the trainable recall unit — resolved: use **Study Note** because Users are studying Notes rather than managing abstract items.
- "Study Note" could have meant an implementation-only card detached from Notes — resolved: a **Study Note** is a first-class recall target that belongs to exactly one **Note**.
- "Default Study Note" could have required extra setup before a saved **Note** becomes recallable — resolved: every saved **Note** gets one default **Study Note** automatically.
- "Default Study Note answer" could have started blank — resolved: copy the full source **Note** body initially so recall works immediately.
- "Study Note title" could have been forced to mirror the source **Note** title — resolved: each **Study Note** owns its own title or prompt.
- "Study Note answer" could have been only the whole source **Note** body — resolved: each **Study Note** owns an expected answer or reference focus inside the source material.
- Self-explanation could have required a separate field on every **Study Note** — resolved for v1: keep only prompt and expected answer required, and encourage why/how/example/non-example/limits through guidance and templates.
- Worked examples could have required a stored **Study Note** type — resolved for v1: treat them as source material guidance and optional template behavior while keeping Study Notes untyped.
- "Source Note edit" could have silently rewritten existing **Study Notes** — resolved: source changes do not automatically mutate Study Note prompts or expected answers.
- "Study Note deletion" could have cascaded to the source **Note** — resolved: deleting a **Study Note** deletes only that Study Note.
- "Last Study Note deletion" could have left hidden orphan source material or blocked the User — resolved: require explicit confirmation to delete both the Study Note and source Note.
- "Source Note delete" could have appeared as a direct action — resolved: source Note deletion only happens through confirmed deletion of the last linked **Study Note**.
- "Source Note visibility" could have hidden source material behind a disclosure — resolved: source Note title/body are visible by default below Study Note fields.
- "Recall reveal" could have shown the whole source **Note** before the targeted answer — resolved: show the **Study Note** expected answer first, then the source Note.
- "Labels" could have grouped source **Notes** or practiced **Study Notes** — resolved: Labels group **Study Notes**; source Note labels are optional and deferred.
- "Migrating Note Labels" could have required a careful production backfill — resolved: copy labels to default **Study Notes** if needed, but current data may be reset if simpler.
- "Notes" could have remained the primary navigation label after Study Notes became the practiced object — resolved: the primary workspace and navigation label is **Study Notes**.
- "`/notes`" could have remained the main workspace route or redirected after the product language shifted — resolved: use `/study-notes` and remove `/notes`.
- "Post-login destination" could have stayed on the old Notes route or a future dashboard — resolved: login and registration land on `/study-notes`.
- "Source Note creation" could have remained a separate source-only workflow — resolved: source Notes are created or edited inside the **New Study Note** flow.
- "New Study Note" could have always reused an existing source or always created a new source — resolved: create a new source **Note** by default and use an explicit action to add another Study Note from an existing source.
- "Shared source Note editing" could have looked local to one **Study Note** — resolved: source edits are allowed from any linked Study Note, but the UI must show that the source is shared.
- "Study field" was used in early discussion to mean the top-level organizer — resolved: this is just a **Label** with no parent.
- "Menu options" could have treated **Metaphors** and **Acronyms** as standalone destinations — resolved: they are Study Note-owned memory aids inside the **Learning Loop**, not primary workspace screens.
- "Recall target" previously meant a chosen **Label** and its descendants, then explicitly selected **Notes** — resolved: a **RecallSession** targets explicitly selected **Study Notes**.
- "Unlabeled Notes" were previously excluded from recall — resolved for v1: Study Notes remain recallable without Labels.
- "Saved recall set" could have introduced a new grouping concept — resolved for v1: Recall Study Note selection is temporary and not reusable.
- "Recall" could have meant only an action started from Study Notes — resolved for v1: the **Recall Section** is a primary Learning Loop section beside the **Study Notes Workspace**.
- The **Recall Section** could have required the User to manually select Study Notes for every **RecallSession** — resolved: it opens on **Recall Today** by default when recommended recall work exists, while **Recall Selection Mode** remains available.
- Automatic mixed recall could have started immediately for all **Study Notes** — resolved: **Interleaved Recall** waits for two Good/Easy recall attempts per Study Note and a related pool of at least four eligible Study Notes.
- "Start Recall" in the **Study Notes Workspace** could have meant Study Notes owns recall setup or passes selected Study Notes into Recall — resolved for v1: it only opens the **Recall Section** without preselection.
- "Recall" may be less familiar than "Practice" to general users — resolved for v1: keep "Recall" as the navigation label and revisit after user feedback.
- "Selecting Notes" could mean opening source material for editing or choosing practice material for recall — resolved: in the **Study Notes Workspace**, selection opens a Study Note for editing; in **Recall Selection Mode**, selection toggles Study Notes into the temporary RecallSession target set.
- "Recall view" could have meant the base **Recall Section**, the **Results Workspace**, a **Practice Repair Workspace**, or an active **Recall Session View** — resolved: `/recall` is the base entry route, `/recall/results` reviews SessionResults, `/recall/repair/:practiceRepairEntryId` handles confirmed Practice Repair work, and `/recall/session` only represents an active RecallSession.
- "Recall route" could have meant only an active session route — resolved: `/recall` is the base **Recall Section**, `/recall/results` is the canonical **Results Workspace**, `/recall/select` is **Recall Selection Mode**, `/recall/session` is the active **Recall Session View**, `/recall/results/:sessionResultId/questions/:questionResultId/repair` is the **Practice Repair Draft View**, and `/recall/repair/:practiceRepairEntryId` is the **Practice Repair Workspace**.
- "Different languages" could mean app chrome, study material, per-Note language, or automatic content translation — resolved for v1: use one **User Language** for app chrome and language-aware study defaults; translation is a later explicit feature.
- "Interface Language", "Study Language", and "Note Language" could have become separate v1 concepts — resolved for v1: avoid those terms and use **User Language**.
- "Portuguese" could mean Portuguese (Portugal) or Portuguese (Brazil) — resolved for v1: support Portuguese (Portugal), not Portuguese (Brazil).
- "Language selector" could have been a stored preference without visible translated UI — resolved for v1: **User Language** must translate app chrome for all supported languages.
- "Initial language" could have required a registration form choice — resolved for v1: detect from browser on first visit, fall back to English, and let the User change it later in Settings.
- "Anonymous language" could have stayed English until login — resolved for v1: anonymous pages use detected **User Language**, while authenticated pages use stored **User Language**.
- "Recall Dashboard" or "Recall Home" could have named the default `/recall` screen — resolved: use **Recall Section** only; it may open on **Recall Today** when recommended recall work exists, while completed recall work belongs to the **Results Workspace**.
- "Exam notes" could have meant the app is already the primary source of truth for exam material — resolved: for the exam-support pilot, the app is a **Study Layer** over material that remains available elsewhere, while the long-term direction is to become the **User**'s primary study workspace.
- "notes from other platforms" could have meant external pages become recall targets — resolved: future **Source Import** may bring external material into the **Study Layer**, but **Study Notes** remain the practiced memory unit.
- "Breadcrumb" could have acted like primary navigation — resolved: the **Workspace Breadcrumb** indicates position inside the current workspace section, not product sections.
- "History" could have stayed a separate product destination, compatibility route, or UI label — resolved for v1: remove `/history`; completed recall work is reviewed as **SessionResults** inside the **Recall Section**, with UI copy using "Results".
- "Result details" could have treated stored source **Notes** and stored **Questions** as equal primary review objects — resolved for v1: **Questions** are primary in SessionResult review; Study Notes and source Notes are supporting context.
- "Start Recall" could have appeared both in the Results master panel and again inside selected-result detail actions — resolved for v1: new recall starts from the master-panel action only; selected-result detail stays read-only.
- "Notes used" could have remained a full section even when a selected **SessionResult** contains only one targeted **Study Note** and one stored **Question** for that same Study Note — resolved for v1: collapse the Study Note and source Note into compact summary metadata and remove the separate context section.
- "Notes used" could have implied that every stored source **Note** in a selected **SessionResult** was actually attempted — resolved for v1: when separate supporting context is needed, avoid "Notes used" and use wording that reflects unattempted coverage instead.
- "Session notes" could have repeated attempted Study Notes already represented in the Questions review — resolved for v1: use **Not reached items** and show the section only for not-reached targeted Study Notes with no stored answer.
- The **Not reached items** section could have carried rich source Note metadata and competed with the Questions review — resolved for v1: show only the Study Note title in each row.
- The **Not reached items** section could have remained visible as an empty placeholder even when every targeted **Study Note** was reached — resolved for v1: omit the section entirely unless unreached Study Notes exist.
- "Questions and answers" could have shown every stored answer inline at once — resolved for v1: the selected **SessionResult** starts with collapsed Question summary rows and reveals deeper detail on expansion.
- A collapsed **Question** row could have hidden the historical answer key entirely — resolved for v1: expansion reveals the full stored source **Note** snapshot alongside the User's stored answer.
- A collapsed **Question** row could have emphasized the answer preview or score first — resolved for v1: the Question prompt is the primary line.
- A collapsed **Question** row could have included answer preview text and repeated expanded-detail content — resolved for v1: omit answer preview text entirely until expansion.
- A collapsed **Question** row could have hidden its expand affordance until hover or focus — resolved for v1: keep the affordance visible at all times.
- The selected **SessionResult** could have allowed many expanded Question rows to accumulate at once — resolved for v1: use a single-open-row accordion.
- The selected **SessionResult** could have auto-expanded the first Question row by default — resolved for v1: start with all Question rows collapsed.
- `FlashCard` Question review could have shown both numeric score and self-rating as if they were independent signals — resolved for v1: show the self-rating and remove the per-Question numeric score.
- `FlashCard` self-rating in Question review could have been rendered as stars alone — resolved for v1: use the explicit rating word as the canonical label, paired with subtle existing-tone visual treatment.
- The collapsed `FlashCard` self-rating could have sat inline under the prompt and diluted the question-first scan pattern — resolved for v1: place it as a trailing pill on the right.
- The collapsed `FlashCard` self-rating could have introduced alternate learner-facing wording — resolved for v1: keep **Forgot**, **Hard**, **Good**, and **Easy**.
- Expanded `FlashCard` Question detail could have omitted the self-rating and forced the user to look back at the collapsed row header — resolved for v1: repeat the self-rating in expanded detail.
- Expanded **Question** detail could have led with the stored source **Note** snapshot instead of the User's attempt — resolved for v1: show the User's stored answer first, then the stored source **Note** snapshot reference.
- Expanded **Question** detail could have added another reveal step before showing the stored source **Note** body — resolved for v1: once expanded, show the full stored source **Note** body immediately.
- Expanded **Question** detail could have left an empty answer area when no typed answer was stored — resolved for v1: state explicitly **No typed answer recorded**.
- Expanded **Question** detail could have normalized or truncated the stored typed answer for cleaner layout — resolved for v1: show the full answer text as written.
- Expanded **Question** detail could have used technical or unlabeled copy for the stored source **Note** snapshot — resolved for v1: label it **Reference note**.
- Expanded **Question** detail could have used heavier system wording like "Your recorded answer" — resolved for v1: use **Your answer**.
- A `FlashCard` **Question** with no typed answer could have lost expansion entirely — resolved for v1: keep the row expandable so the stored source **Note** snapshot reference stays accessible.
- A `FlashCard` selected **SessionResult** could still have shown "Score" in the header because the aggregate percentage reuses the same derived mapping — resolved for v1: keep the aggregate percentage and icon progression in the current score slot, but label it as **Session self rating** rather than **Score**.
- A `FlashCard` selected **SessionResult** header could have shown both aggregate and rating distribution even when space became cramped — resolved for v1: always keep the aggregate self-rating percentage in the score slot, and show the distribution only when it does not bloat the layout.
- A `FlashCard` **SessionResult** list row could have kept showing a bare percentage that looked like an objective score — resolved for v1: the metric still means average self-rating percentage, but the row keeps the compact bare percentage and relies on detail view for fuller explanation.
- The selected **SessionResult** summary line could have flattened targeted Study Notes and attempted Questions into parallel counts even when the session ended early — resolved for v1: make early-ended coverage explicit.
- The selected **SessionResult** summary line could have used heavier session-scope wording even for fully attempted sessions — resolved for v1: keep the simpler compact wording for fully attempted sessions.
- The selected **SessionResult** detail heading could have stayed as generic "Result details" — resolved for v1: use **Session review**.
- The selected **SessionResult** stat strip could have kept the longer label "Questions attempted" even after early-ended nuance moved into the summary line — resolved for v1: shorten it to **Questions**.
- The selected **SessionResult** mode pill could have shifted from `FlashCard` to alternate learner-facing wording — resolved for v1: keep `FlashCard`.
- The question-review section could have stayed titled "Questions and answers" even though answers are hidden until expansion — resolved for v1: use **Questions** and reveal answers within expanded rows.
- "App Sidebar" previously meant the primary authenticated product navigation — resolved for v1: use **Study Notes Workspace**, **Recall Section**, and an **Account Dock**.
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
- Focus time could have been treated as proof of learning — resolved: **FocusSessions** support attention and recovery, while learning evidence comes from recall and StudyActivity that produces or reinforces Study Notes.
- Passive work such as rereading, highlighting, videos, or copying notes could have been rewarded as learning progress — resolved: it may support source material preparation, but progress comes from Study Note creation, recall evidence, correction, Recall Schedule movement, and Needs practice repair.
- Weak recall could have created a full error-log workflow immediately — resolved for v1: use lightweight first-class **Practice Repair** and persisted **Practice Repair Entries** tied to **Needs practice** before introducing full error logs or mistake taxonomy.
- **Metaphors** and **Acronyms** could have been encouraged for every **Study Note** by default — resolved: they remain optional memory aids suggested only when useful for a specific recall problem.
- Beginner/intermediate/advanced could have been a User-level setting — resolved for v1: use local **Study Note** and **Label** evidence to drive **Study Guidance** instead.
- Weekly planning could have been part of the default product loop — resolved for v1: defer a full weekly planning feature and center default guidance on **Recall Today** and **Practice Repair**.
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
- "Study activity" could have counted incidental app usage — resolved: v1 counts meaningful Note, Study Note, Metaphor, Acronym, Recall, review, and Label-context work, while excluding settings, simple navigation, search typing alone, brief Note selection, and idle time.
- "Reviewing a Note" could have meant a brief selection — resolved: in v1, Note review counts as **StudyActivity** after 30 seconds with the Note selected while the app is visible during an active **FocusInterval**.
- "FocusTarget from Note work" could have meant only the Note or only Labels — resolved: v1 snapshots the touched **Note**, its **Study Notes**, and the Labels attached to those Study Notes, with unlabeled Study Note work remaining valid.
- "FocusTarget from Recall work" could have meant only the **RecallSession** — resolved: v1 snapshots the **RecallSession** plus its **Study Note**, source **Note**, and **Label** context.
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
