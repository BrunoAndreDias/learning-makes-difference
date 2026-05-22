import { describe, expect, it } from "vitest";

import {
  isRecallAnswerCheckResult,
  scoreRecallAnswerCheck,
} from "./recall-answer-check";

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
      algorithmVersion: "expected_answer_and_accepted_variant_v2",
      confidence: "high",
      primaryReason: "expected_answer_exact_match",
      status: "likely_correct",
      suggestedSelfRating: "good",
    });
  });

  it("accepts close wording matches without requiring identical punctuation", () => {
    expect(
      scoreRecallAnswerCheck({
        acceptedVariants: [],
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
        acceptedVariants: [],
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
        acceptedVariants: [],
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
        acceptedVariants: [],
        expectedAnswer: "Retrieval practice strengthens access to memory.",
        typedAnswer: "Retrieval practice strengthens access to memory.",
      },
      {
        acceptedVariants: [],
        expectedAnswer: "ATP stores transferable energy for the cell.",
        typedAnswer: "ATP energy.",
      },
      {
        acceptedVariants: [],
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

  it("treats close Accepted Variant matches as likely_correct and reports the matched variant", () => {
    expect(
      scoreRecallAnswerCheck({
        acceptedVariants: [
          {
            id: "variant-retrieval",
            text: "Repeated retrieval makes long-term memory easier to access.",
          },
        ],
        expectedAnswer:
          "Retrieval practice strengthens access to long-term memory.",
        typedAnswer:
          "Repeated retrieval makes long term memory easier to access.",
      }),
    ).toMatchObject({
      confidence: "high",
      matchedAcceptedVariant: {
        id: "variant-retrieval",
        text: "Repeated retrieval makes long-term memory easier to access.",
      },
      primaryReason: "accepted_variant_close_match",
      status: "likely_correct",
      suggestedSelfRating: "good",
    });
    expect(
      scoreRecallAnswerCheck({
        acceptedVariants: [
          {
            id: "variant-retrieval",
            text: "Repeated retrieval makes long-term memory easier to access.",
          },
        ],
        expectedAnswer:
          "Retrieval practice strengthens access to long-term memory.",
        typedAnswer:
          "Repeated retrieval makes long term memory easier to access.",
      }),
    ).toMatchObject({
      evidence: {
        missingExpectedTerms: [],
        notDetectedExpectedTerms: ["practice", "strengthens"],
      },
    });
  });

  it("does not use distant Accepted Variants as a likely_correct shortcut", () => {
    const result = scoreRecallAnswerCheck({
      acceptedVariants: [
        {
          id: "variant-retrieval",
          text: "Repeated retrieval makes long-term memory easier to access.",
        },
      ],
      expectedAnswer:
        "Retrieval practice strengthens access to long-term memory.",
      typedAnswer: "Chlorophyll reflects green light.",
    });

    expect(result).toMatchObject({
      confidence: "low",
      primaryReason: "expected_answer_low_coverage",
      status: "likely_incomplete",
      suggestedSelfRating: "forgot",
    });
    expect(result?.matchedAcceptedVariant).toBeUndefined();
  });

  it("keeps previously stored v1 Answer Check results readable", () => {
    expect(
      isRecallAnswerCheckResult({
        algorithmVersion: "baseline_expected_answer_v1",
        confidence: "high",
        evidence: {
          matchedExpectedTerms: ["Retrieval", "practice"],
          missingExpectedTerms: [],
          phraseCoverage: 1,
          tfidfCosineSimilarity: 1,
          tokenCoverage: 1,
        },
        primaryReason: "expected_answer_exact_match",
        status: "likely_correct",
        suggestedSelfRating: "good",
      }),
    ).toBe(true);
  });
});
