# Note Creation, Mnemonics, AI, And Settings

## Creation Flow

Blueprint ideal:

```text
User writes Note
-> app suggests title
-> app suggests Labels
-> app suggests Study Items
-> app suggests Metaphor if useful
-> app suggests Acronym if useful
-> user accepts, edits, or rejects
-> accepted Study Items enter recall
```

Recommended MVP flow:

```text
User writes Note
-> app creates default Study Item
-> user can add manual Study Items
-> user can add manual cloze item
-> user can add manual Mnemonics
```

AI suggestions should come later.

## Manual Study Item Creation

Candidate manual item types:

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

## Mnemonics

Recommended domain language:

```text
Mnemonic = memory aid attached to a Note or Study Item
Metaphor = structured Mnemonic with mapping and limitation
Acronym = Mnemonic for lists, steps, categories, or sequences
```

Candidate Metaphor structure:

```ts
type Metaphor = {
  id: string;
  noteId: string;
  studyItemId?: string;
  title: string;
  metaphorText: string;
  mappings: {
    source: string;
    target: string;
    relation?: string;
  }[];
  limitation?: string;
  userRating?: 1 | 2 | 3 | 4 | 5;
};
```

Recommended rule:

Use Mnemonics as hints, not as substitutes for recall.

## AI Policy

Core without AI:

- Notes
- manual Study Items
- cloze creation
- active recall
- scheduler
- weak items
- labels
- dashboards
- Focus integration

AI improves:

- question generation
- metaphor generation
- acronym generation
- semantic label suggestions
- answer feedback
- splitting long Notes

Recommended policy:

- user can create everything manually
- AI suggestions are optional
- AI outputs are editable
- AI outputs do not enter recall without user acceptance
- privacy controls are explicit

## Settings Areas

Candidate settings groups:

- Account
- Recall
- Notes
- Metaphors and Acronyms
- Labels
- Notifications
- Appearance
- Data and Privacy

Recommended MVP settings:

- User Language
- User Time Zone
- Study Objective
- Study Intensity
- max items per recall session
- new Notes enter recall automatically

## Decisions To Grill

1. Should creating a Note automatically create Study Items?

Recommended answer: Yes, exactly one default Study Item. Extra Study Items are manual or suggested.

2. Should AI-generated Study Items be saved automatically?

Recommended answer: No. They should be suggestions until accepted.

3. Should Metaphors and Acronyms belong to Notes, Study Items, or both?

Recommended answer: Keep them Note-owned by default, allow optional Study Item association later.

4. Should the app support multiple Metaphors and Acronyms per Note?

Recommended answer: Yes eventually, but MVP can keep the current single-memory-aid constraint until the Study Item model is stable.

5. Should cloze deletion mutate the original Note body?

Recommended answer: No. Cloze creates a Study Item with a prompt and expected answer.

6. Should settings be broad now or introduced only when features exist?

Recommended answer: Introduce settings only when they change real behavior.

## Session Outcome To Capture

After grilling, update domain docs with:

- accepted Mnemonic language
- default Study Item creation behavior
- AI acceptance rule
- whether current single Metaphor/Acronym constraints remain temporary
