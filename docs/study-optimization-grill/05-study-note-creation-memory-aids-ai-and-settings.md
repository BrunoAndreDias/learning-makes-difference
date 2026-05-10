# Study Note Creation, Memory Aids, AI, And Settings

## Current CONTEXT.md Baseline

- Users do not create source-only Notes directly.
- New Study Note creates a new source Note by default.
- The User may explicitly add another Study Note from an existing source Note.
- Every saved Note has at least one Study Note.
- The default Study Note starts with the source Note title as its prompt and the full source Note body as its expected answer.
- After creation, source Note edits do not automatically rewrite Study Note prompts or expected answers.
- Metaphors and Acronyms attach to Study Notes and cannot exist without their Study Note.
- A Study Note can have many Metaphors and many Acronyms.
- Metaphors and Acronyms are memory aids, not standalone workspace destinations.
- User Language, User Time Zone, Study Objective, and Study Intensity are accepted Settings concepts.
- Study Objective and Study Intensity are profile context only in v1; they do not affect scheduling, analytics, Labels, FocusTargets, or RecallSessions.

## Creation Flow

Blueprint ideal, translated into current language:

```text
User creates or edits a Study Note and source Note
-> app suggests title or prompt improvements
-> app suggests Labels
-> app suggests additional Study Notes
-> app suggests Metaphor if useful
-> app suggests Acronym if useful
-> User accepts, edits, or rejects
-> accepted Study Notes enter recall
```

Recommended MVP flow:

```text
User chooses New Study Note
-> app creates a new source Note by default
-> app creates one default Study Note
-> User edits Study Note prompt and expected answer
-> User edits source Note title and body below the Study Note fields
-> User can add Labels, Metaphors, and Acronyms
-> User can add another Study Note from the same source Note
```

AI suggestions should come later.

## Manual Study Note Creation

Candidate manual Study Note types:

- Question and answer
- Definition
- Explanation
- Application
- Comparison
- Cloze
- Metaphor prompt
- Acronym prompt

Recommended first manual types:

- Question and answer
- Cloze

These give most value with low implementation complexity.

## Templates Without AI

Templates can reduce friction before AI exists.

Definition template:

```text
Concept:
Definition:

Generated prompts:
- What is [concept]?
- Explain [concept] in your own words.
```

Process template:

```text
Process:
Steps:

Generated prompts:
- What are the steps?
- What happens after [step]?
- What comes before [step]?
```

Comparison template:

```text
A:
B:
Difference:

Generated prompts:
- What is the difference between A and B?
- When would A be preferable?
- When would B be preferable?
```

## Memory Aids

Accepted domain terms:

```text
Metaphor = title + explanation that maps a Study Note's recall target onto something familiar
Acronym = memory-aid mnemonic attached to a Study Note
```

Candidate umbrella language:

```text
Memory aid = general product copy for Metaphors and Acronyms
Mnemonic = technical or descriptive shorthand only; not yet an accepted top-level domain term
```

Candidate Metaphor structure:

```ts
type Metaphor = {
  id: string;
  studyNoteId: string;
  title: string;
  explanation: string;
  mappings?: {
    source: string;
    target: string;
    relation?: string;
  }[];
  limitation?: string;
  userRating?: 1 | 2 | 3 | 4 | 5;
};
```

Recommended rule:

Use Metaphors and Acronyms as Study Note support material and possible hints, not as substitutes for recall.

## AI Policy

Core without AI:

- Notes
- manual Study Notes
- expected answers
- Metaphors and Acronyms
- active recall
- Learning State
- Due for Recall and scheduler
- Labels
- Focus integration

AI improves:

- question generation
- Study Note splitting
- Metaphor generation
- Acronym generation
- semantic Label suggestions
- answer feedback
- long source Note refinement

Recommended policy:

- User can create everything manually.
- AI suggestions are optional.
- AI outputs are editable.
- AI outputs do not enter recall without User acceptance.
- Privacy controls are explicit.
- Current premium access is BYOK; key persistence is deferred until AiAssisted or AiGraded is in scope.

## Settings Areas

Accepted Settings concepts:

- User Language
- User Time Zone
- Study Objective
- Study Intensity

Candidate future settings:

- max Study Notes per RecallSession
- confidence-before-answer prompt
- hint ladder behavior
- Recall Today size
- notifications
- BYOK provider configuration
- data and privacy controls

Do not add "new Notes enter recall automatically" as a setting under current language. Every saved Note has a default Study Note, and source-only Note creation is not a direct User flow.

## Resolved Baseline

1. Creating a New Study Note creates or uses the source Note behind it.
2. Every saved Note has at least one default Study Note.
3. Metaphors and Acronyms belong to Study Notes.
4. A Study Note can have many Metaphors and many Acronyms.
5. Cloze creates a Study Note prompt and expected answer; it does not mutate the original source Note body.

## Decisions To Grill

1. Should AI-generated Study Notes be saved automatically?

Recommended answer: No. They should be suggestions until accepted.

2. Which manual Study Note templates should ship first?

Recommended answer: Question and answer, then Cloze. Add definition, process, and comparison templates later.

3. Should a Metaphor or Acronym support multiple sibling Study Notes from the same source Note?

Recommended answer: Not initially. Keep each memory aid attached to one Study Note; duplicate or recreate when another Study Note needs its own aid.

4. Should Metaphors and Acronyms have user ratings?

Recommended answer: Defer until they affect hint selection or improvement suggestions.

5. Should settings be broad now or introduced only when features exist?

Recommended answer: Introduce settings only when they change real behavior.

6. Should BYOK key persistence ship with the first AI feature?

Recommended answer: Defer until AiAssisted or AiGraded is in scope; keep manual creation first.

## Session Outcome To Capture

After grilling, update domain docs with:

- accepted memory-aid umbrella language, if any
- first manual Study Note template set
- AI acceptance rule
- whether Metaphors and Acronyms can support multiple Study Notes
- any new Settings concept that changes real behavior
