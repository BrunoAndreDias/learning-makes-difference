import { describe, expect, it } from "vitest";

import type { AppStudyNote } from "../study-notes";
import type { StudyNoteRecallHistory } from "../study-notes/learning-state";
import { getInterleavedRecallRecommendation } from "./interleaved-recall";

const timestamp = "2026-05-01T09:00:00.000Z";

function buildStudyNote(
  overrides: Partial<AppStudyNote> & Pick<AppStudyNote, "id" | "prompt">,
): AppStudyNote {
  const { id, prompt, ...rest } = overrides;

  return {
    acceptedVariants: [],
    acronyms: [],
    createdAt: timestamp,
    expectedAnswer: "Expected answer",
    id,
    keyIdeas: [],
    labelIds: [],
    metaphors: [],
    prompt,
    prohibitedPhrases: [],
    source: {
      body: "Source body",
      id: `source-${id}`,
      title: "Source title",
      updatedAt: timestamp,
    },
    sourceNoteId: `source-${id}`,
    updatedAt: timestamp,
    ...rest,
  };
}

function buildStudyNoteFromSource(
  overrides: Partial<AppStudyNote> & Pick<AppStudyNote, "id" | "prompt">,
  source: AppStudyNote["source"],
) {
  return buildStudyNote({
    ...overrides,
    source,
    sourceNoteId: source.id,
  });
}

function buildHistory(
  studyNoteId: string,
  ratings: readonly StudyNoteRecallHistory["attempts"][number]["rating"][],
): StudyNoteRecallHistory {
  return {
    attempts: ratings.map((rating, index) => ({
      completedAt: `2026-05-${String(index + 10).padStart(2, "0")}T09:00:00.000Z`,
      rating,
    })),
    studyNoteId,
  };
}

describe("Interleaved Recall recommendations", () => {
  it("recommends a normal RecallSession after two successful recalls and four related eligible Study Notes", () => {
    const labelId = "label-biology";
    const anchor = buildStudyNote({
      id: "study-note-anchor",
      labelIds: [labelId],
      prompt: "Anchor prompt",
    });
    const relatedByLabel = buildStudyNote({
      id: "study-note-related-1",
      labelIds: [labelId],
      prompt: "Related prompt 1",
    });
    const relatedBySourceA = buildStudyNoteFromSource(
      {
        id: "study-note-related-2",
        prompt: "Related prompt 2",
      },
      anchor.source,
    );
    const relatedBySourceB = buildStudyNoteFromSource(
      {
        id: "study-note-related-3",
        prompt: "Related prompt 3",
      },
      anchor.source,
    );
    const unrelated = buildStudyNote({
      id: "study-note-unrelated",
      prompt: "Unrelated prompt",
    });

    const recommendation = getInterleavedRecallRecommendation({
      histories: [
        buildHistory(anchor.id, ["good", "easy"]),
        buildHistory(relatedByLabel.id, ["easy", "good"]),
        buildHistory(relatedBySourceA.id, ["good", "easy"]),
        buildHistory(relatedBySourceB.id, ["easy", "easy"]),
        buildHistory(unrelated.id, ["easy", "easy"]),
      ],
      studyNote: anchor,
      studyNotes: [
        unrelated,
        relatedByLabel,
        anchor,
        relatedBySourceA,
        relatedBySourceB,
      ],
    });

    expect(recommendation).toEqual({
      actionLabel: "Start Interleaved Recall",
      studyNoteIds: [
        anchor.id,
        relatedByLabel.id,
        relatedBySourceA.id,
        relatedBySourceB.id,
      ],
      summary:
        "At least two recent Good or Easy recalls make this Study Note eligible for mixed practice with 4 related Study Notes.",
      title: "Interleaved Recall",
    });
  });

  it("excludes Study Notes whose latest recall evidence returns to Hard or Forgot", () => {
    const labelId = "label-history";
    const anchor = buildStudyNote({
      id: "study-note-anchor-reset",
      labelIds: [labelId],
      prompt: "Anchor reset prompt",
    });
    const peerOne = buildStudyNote({
      id: "study-note-peer-1",
      labelIds: [labelId],
      prompt: "Peer prompt 1",
    });
    const peerTwo = buildStudyNote({
      id: "study-note-peer-2",
      labelIds: [labelId],
      prompt: "Peer prompt 2",
    });
    const peerThree = buildStudyNote({
      id: "study-note-peer-3",
      labelIds: [labelId],
      prompt: "Peer prompt 3",
    });

    expect(
      getInterleavedRecallRecommendation({
        histories: [
          buildHistory(anchor.id, ["good", "easy", "hard"]),
          buildHistory(peerOne.id, ["good", "easy"]),
          buildHistory(peerTwo.id, ["easy", "good"]),
          buildHistory(peerThree.id, ["easy", "easy"]),
        ],
        studyNote: anchor,
        studyNotes: [anchor, peerOne, peerTwo, peerThree],
      }),
    ).toBeNull();
  });

  it("counts sibling source Study Notes toward the related pool without requiring Labels", () => {
    const anchor = buildStudyNote({
      id: "study-note-sibling-anchor",
      prompt: "Sibling anchor prompt",
      source: {
        body: "Shared source body",
        id: "source-sibling-group",
        title: "Shared source title",
        updatedAt: timestamp,
      },
      sourceNoteId: "source-sibling-group",
    });
    const siblingOne = buildStudyNoteFromSource(
      {
        id: "study-note-sibling-1",
        prompt: "Sibling source prompt 1",
      },
      anchor.source,
    );
    const siblingTwo = buildStudyNoteFromSource(
      {
        id: "study-note-sibling-2",
        prompt: "Sibling source prompt 2",
      },
      anchor.source,
    );
    const siblingThree = buildStudyNoteFromSource(
      {
        id: "study-note-sibling-3",
        prompt: "Sibling source prompt 3",
      },
      anchor.source,
    );

    const recommendation = getInterleavedRecallRecommendation({
      histories: [
        buildHistory(anchor.id, ["good", "easy"]),
        buildHistory(siblingOne.id, ["good", "easy"]),
        buildHistory(siblingTwo.id, ["easy", "easy"]),
        buildHistory(siblingThree.id, ["easy", "good"]),
      ],
      studyNote: anchor,
      studyNotes: [anchor, siblingOne, siblingTwo, siblingThree],
    });

    expect(recommendation?.studyNoteIds).toEqual([
      anchor.id,
      siblingOne.id,
      siblingTwo.id,
      siblingThree.id,
    ]);
  });

  it("requires at least four eligible related Study Notes before recommending interleaving", () => {
    const labelId = "label-math";
    const anchor = buildStudyNote({
      id: "study-note-threshold-anchor",
      labelIds: [labelId],
      prompt: "Threshold anchor prompt",
    });
    const peerOne = buildStudyNote({
      id: "study-note-threshold-1",
      labelIds: [labelId],
      prompt: "Threshold prompt 1",
    });
    const peerTwo = buildStudyNote({
      id: "study-note-threshold-2",
      labelIds: [labelId],
      prompt: "Threshold prompt 2",
    });

    expect(
      getInterleavedRecallRecommendation({
        histories: [
          buildHistory(anchor.id, ["good", "easy"]),
          buildHistory(peerOne.id, ["easy", "good"]),
          buildHistory(peerTwo.id, ["good", "good"]),
        ],
        studyNote: anchor,
        studyNotes: [anchor, peerOne, peerTwo],
      }),
    ).toBeNull();
  });
});
