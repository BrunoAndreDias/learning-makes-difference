import { describe, expect, it } from "vitest";

import { scoreRecallAnswerCheck } from "./recall-answer-check";

describe("scoreRecallAnswerCheck", () => {
  it("blocks likely_correct when a required Key Idea is missing", () => {
    expect(
      scoreRecallAnswerCheck({
        expectedAnswer:
          "Retrieval practice strengthens long-term memory through effortful recall.",
        keyIdeas: [
          {
            acceptedPhrases: [],
            id: "key-idea-memory",
            importance: "required",
            prohibitedPhrases: [],
            text: "strengthens long-term memory",
          },
          {
            acceptedPhrases: [],
            id: "key-idea-effortful",
            importance: "required",
            prohibitedPhrases: [],
            text: "effortful recall",
          },
        ],
        typedAnswer: "Retrieval practice strengthens long-term memory.",
      }),
    ).toMatchObject({
      status: "likely_incomplete",
      suggestedSelfRating: "hard",
      evidence: {
        coveredConcepts: [
          {
            id: "key-idea-memory",
            importance: "required",
            text: "strengthens long-term memory",
          },
        ],
        missingConcepts: [
          {
            id: "key-idea-effortful",
            importance: "required",
            text: "effortful recall",
          },
        ],
      },
    });
  });

  it("returns likely_correct guidance for exact expected-answer matches", () => {
    expect(
      scoreRecallAnswerCheck({
        expectedAnswer:
          "Retrieval practice strengthens access to long-term memory.",
        typedAnswer:
          "Retrieval practice strengthens access to long-term memory.",
      }),
    ).toMatchObject({
      algorithmVersion: "key_idea_coverage_v1",
      confidence: "medium",
      primaryReason: "expected_answer_exact_match",
      status: "likely_correct",
      suggestedSelfRating: "good",
    });
  });

  it("accepts close wording matches without requiring identical punctuation", () => {
    expect(
      scoreRecallAnswerCheck({
        expectedAnswer: "Retrieval practice strengthens access to memory.",
        typedAnswer: "Retrieval practise strengthens access to memory.",
      }),
    ).toMatchObject({
      confidence: "medium",
      primaryReason: "expected_answer_close_match",
      status: "likely_correct",
      suggestedSelfRating: "good",
    });
  });

  it("returns likely_correct when all required Key Ideas are covered", () => {
    expect(
      scoreRecallAnswerCheck({
        expectedAnswer:
          "Retrieval practice strengthens long-term memory through effortful recall.",
        keyIdeas: [
          {
            acceptedPhrases: [],
            id: "key-idea-memory",
            importance: "required",
            prohibitedPhrases: [],
            text: "long-term memory",
          },
          {
            acceptedPhrases: [],
            id: "key-idea-effortful",
            importance: "required",
            prohibitedPhrases: [],
            text: "effortful recall",
          },
        ],
        typedAnswer:
          "Retrieval practice strengthens long-term memory through effortful recall.",
      }),
    ).toMatchObject({
      confidence: "high",
      primaryReason: "key_idea_concepts_covered",
      status: "likely_correct",
      suggestedSelfRating: "good",
      evidence: {
        coveredConcepts: [
          {
            id: "key-idea-memory",
            importance: "required",
            text: "long-term memory",
          },
          {
            id: "key-idea-effortful",
            importance: "required",
            text: "effortful recall",
          },
        ],
        missingConcepts: [],
        partialConcepts: [],
      },
    });
  });

  it("keeps likely_correct conservative when a supporting Key Idea is only partly covered", () => {
    expect(
      scoreRecallAnswerCheck({
        expectedAnswer:
          "Retrieval practice strengthens long-term memory and improves transfer to new problems.",
        keyIdeas: [
          {
            acceptedPhrases: [],
            id: "key-idea-memory",
            importance: "required",
            prohibitedPhrases: [],
            text: "long-term memory",
          },
          {
            acceptedPhrases: [],
            id: "key-idea-transfer",
            importance: "supporting",
            prohibitedPhrases: [],
            text: "transfer to new problems",
          },
        ],
        typedAnswer:
          "Retrieval practice strengthens long-term memory and helps transfer to problems.",
      }),
    ).toMatchObject({
      confidence: "medium",
      primaryReason: "key_idea_supporting_partial",
      status: "likely_correct",
      evidence: {
        coveredConcepts: [
          {
            id: "key-idea-memory",
            importance: "required",
            text: "long-term memory",
          },
        ],
        partialConcepts: [
          {
            id: "key-idea-transfer",
            importance: "supporting",
            text: "transfer to new problems",
          },
        ],
      },
    });
  });

  it("uses Key Idea accepted phrases for concept coverage", () => {
    expect(
      scoreRecallAnswerCheck({
        expectedAnswer: "Retrieval practice strengthens long-term memory.",
        keyIdeas: [
          {
            acceptedPhrases: ["durable memory"],
            id: "key-idea-memory",
            importance: "required",
            prohibitedPhrases: [],
            text: "long-term memory",
          },
        ],
        typedAnswer: "Retrieval practice builds durable memory.",
      }),
    ).toMatchObject({
      primaryReason: "key_idea_concepts_covered",
      status: "likely_correct",
      evidence: {
        coveredConcepts: [
          {
            id: "key-idea-memory",
            importance: "required",
            text: "long-term memory",
          },
        ],
      },
    });
  });

  it("returns likely_incomplete guidance for extremely low-coverage answers", () => {
    expect(
      scoreRecallAnswerCheck({
        expectedAnswer:
          "Mitochondria produce ATP through cellular respiration.",
        typedAnswer: "Chlorophyll reflects green light.",
      }),
    ).toMatchObject({
      confidence: "low",
      primaryReason: "expected_answer_low_coverage",
      status: "likely_incomplete",
      suggestedSelfRating: "forgot",
    });
  });

  it("treats short but meaningful attempts conservatively", () => {
    expect(
      scoreRecallAnswerCheck({
        expectedAnswer:
          "Photosynthesis converts light energy into chemical energy stored in glucose.",
        typedAnswer: "Light into glucose energy.",
      }),
    ).toMatchObject({
      primaryReason: "expected_answer_short_attempt",
      status: "likely_incomplete",
      suggestedSelfRating: "hard",
    });
  });

  it("never suggests Easy", () => {
    const cases = [
      {
        expectedAnswer: "Retrieval practice strengthens access to memory.",
        typedAnswer: "Retrieval practice strengthens access to memory.",
      },
      {
        expectedAnswer: "ATP stores transferable energy for the cell.",
        typedAnswer: "ATP energy.",
      },
      {
        expectedAnswer:
          "Mitochondria produce ATP through cellular respiration.",
        typedAnswer: "Chlorophyll reflects green light.",
      },
    ] as const;

    for (const input of cases) {
      expect(scoreRecallAnswerCheck(input)?.suggestedSelfRating).not.toBe(
        "easy",
      );
    }
  });
});
