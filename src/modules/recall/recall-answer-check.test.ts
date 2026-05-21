import { describe, expect, it } from "vitest";

import { scoreRecallAnswerCheck } from "./recall-answer-check";

describe("scoreRecallAnswerCheck", () => {
  it("returns likely_correct guidance for exact expected-answer matches", () => {
    expect(
      scoreRecallAnswerCheck({
        expectedAnswer:
          "Retrieval practice strengthens access to long-term memory.",
        typedAnswer:
          "Retrieval practice strengthens access to long-term memory.",
      }),
    ).toMatchObject({
      algorithmVersion: "baseline_expected_answer_v1",
      confidence: "high",
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
      confidence: "high",
      primaryReason: "expected_answer_close_match",
      status: "likely_correct",
      suggestedSelfRating: "good",
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
