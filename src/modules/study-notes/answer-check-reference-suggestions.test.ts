import { describe, expect, it } from "vitest";
import type { SessionResult } from "../recall";
import { inferStudyNoteAnswerCheckReferenceSuggestions } from "./answer-check-reference-suggestions";

const retrievalPracticeExpectedAnswer =
  "Retrieval practice strengthens memory access. It exposes gaps before review.";

function createReferenceIdGenerator() {
  let counter = 0;

  return () => `draft-reference-${++counter}`;
}

function createSessionResultNote(input: {
  completedAt: string;
  noteId: string;
}): SessionResult["notes"][number] {
  return {
    acronyms: [],
    acceptedVariants: [],
    body: "Study Note source context.",
    createdAt: input.completedAt,
    expectedAnswer: retrievalPracticeExpectedAnswer,
    id: input.noteId,
    keyIdeas: [],
    labelIds: [],
    metaphors: [],
    prompt: "Why does retrieval practice help learning?",
    prohibitedPhrases: [],
    source: {
      body: "Study Note source context.",
      id: "source-1",
      title: "Retrieval practice source",
      updatedAt: input.completedAt,
    },
    sourceNoteId: "source-1",
    title: "Why does retrieval practice help learning?",
    updatedAt: input.completedAt,
  };
}

function createSessionResult(input: {
  completedAt: string;
  noteId: string;
  rating: "forgot" | "hard" | "good" | "easy";
  typedAnswer: string;
}): SessionResult {
  const noteSnapshot = createSessionResultNote(input);

  return {
    attempts: [
      {
        noteId: input.noteId,
        rating: input.rating,
        text: input.typedAnswer,
      },
    ],
    completedAt: input.completedAt,
    createdAt: input.completedAt,
    id: `${input.noteId}-${input.completedAt}`,
    mode: "FlashCard",
    notes: [noteSnapshot],
    questions: [
      {
        isAnswerRevealed: true,
        noteId: input.noteId,
        noteSnapshot,
        selfRating: input.rating,
        typedAnswer: input.typedAnswer,
      },
    ],
  };
}

describe("answer-check reference suggestions", () => {
  it("infers draft key ideas, Accepted Variants, and repeated weak-answer Prohibited Phrases without AI", () => {
    const suggestions = inferStudyNoteAnswerCheckReferenceSuggestions({
      createId: createReferenceIdGenerator(),
      draft: {
        acceptedVariants: [],
        expectedAnswer: retrievalPracticeExpectedAnswer,
        keyIdeas: [],
        prohibitedPhrases: [],
      },
      sessionResults: [
        createSessionResult({
          completedAt: "2026-05-20T09:00:00.000Z",
          noteId: "study-note-1",
          rating: "good",
          typedAnswer:
            "Testing yourself strengthens access to memory before review.",
        }),
        createSessionResult({
          completedAt: "2026-05-19T09:00:00.000Z",
          noteId: "study-note-1",
          rating: "hard",
          typedAnswer: "Passive review is enough.",
        }),
        createSessionResult({
          completedAt: "2026-05-18T09:00:00.000Z",
          noteId: "study-note-1",
          rating: "forgot",
          typedAnswer: "Passive review is enough.",
        }),
        createSessionResult({
          completedAt: "2026-05-17T09:00:00.000Z",
          noteId: "study-note-2",
          rating: "good",
          typedAnswer: "Other Study Note answer.",
        }),
      ],
      studyNoteId: "study-note-1",
    });

    expect(suggestions.keyIdeas).toMatchObject([
      {
        importance: "required",
        text: "Retrieval practice strengthens memory access.",
      },
      {
        importance: "required",
        text: "It exposes gaps before review.",
      },
    ]);
    expect(suggestions.acceptedVariants).toMatchObject([
      {
        text: "Testing yourself strengthens access to memory before review.",
      },
    ]);
    expect(suggestions.prohibitedPhrases).toMatchObject([
      {
        text: "Passive review is enough.",
      },
    ]);
  });
});
