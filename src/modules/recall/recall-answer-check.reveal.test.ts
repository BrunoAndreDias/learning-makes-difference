import { describe, expect, it } from "vitest";

import { createAppNotesContext } from "../notes";
import { createAppStudyNotesContext } from "../study-notes";
import { createAppRecallContext } from "./recall";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function createRecallableStudyNote(input?: {
  expectedAnswer?: string;
  keyIdeas?: Parameters<
    ReturnType<typeof createAppStudyNotesContext>["updateStudyNote"]
  >[2]["keyIdeas"];
  prohibitedPhrases?: Parameters<
    ReturnType<typeof createAppStudyNotesContext>["updateStudyNote"]
  >[2]["prohibitedPhrases"];
}) {
  const storage = createMemoryStorage();
  const notes = createAppNotesContext({
    keyPrefix: "recall-answer-check-source-notes",
    storage,
  });
  const studyNotes = createAppStudyNotesContext({
    keyPrefix: "recall-answer-check-study-notes",
    storage,
  });
  const recall = createAppRecallContext({
    keyPrefix: "recall-answer-check-session",
    notes,
    shuffleNotes: (sessionNotes) => [...sessionNotes],
    storage,
    studyNotes,
  });
  const userId = "user-answer-check";
  const created = studyNotes.createStudyNote(userId, {
    sourceBody: "Retrieval practice source context.",
    sourceTitle: "Retrieval practice",
  });
  const studyNote = studyNotes.updateStudyNote(userId, created.id, {
    acceptedVariants: [],
    acronyms: [],
    expectedAnswer:
      input?.expectedAnswer ??
      "Retrieval practice strengthens access to long-term memory.",
    keyIdeas: input?.keyIdeas ?? [],
    labelIds: [],
    metaphors: [],
    prompt: "What does retrieval practice strengthen?",
    prohibitedPhrases: input?.prohibitedPhrases ?? [],
    sourceBody: "Retrieval practice source context.",
    sourceTitle: "Retrieval practice",
  });

  return {
    recall,
    storage,
    studyNote,
    userId,
  };
}

describe("FlashCard Answer Check on reveal", () => {
  it("runs Answer Check automatically when a Study Note has a typed answer", () => {
    const { recall, studyNote, userId } = createRecallableStudyNote();
    const session = recall.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId,
    });

    recall.updateFlashCardAttemptText({
      sessionId: session.id,
      text: "Retrieval practice strengthens access to long term memory.",
      userId,
    });

    const revealedSession = recall.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });

    expect(revealedSession.questions[0]?.answerCheck).toMatchObject({
      algorithmVersion: "key_idea_accepted_variant_and_prohibited_phrase_v4",
      confidence: "medium",
      status: "likely_correct",
      suggestedSelfRating: "good",
    });
  });

  it("returns Key Idea concept coverage on reveal when the Study Note defines it", () => {
    const { recall, studyNote, userId } = createRecallableStudyNote({
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
    });
    const session = recall.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId,
    });

    recall.updateFlashCardAttemptText({
      sessionId: session.id,
      text: "Retrieval practice strengthens long-term memory.",
      userId,
    });

    const revealedSession = recall.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });

    expect(revealedSession.questions[0]?.answerCheck).toMatchObject({
      confidence: "medium",
      primaryReason: "key_idea_required_missing",
      status: "likely_incomplete",
      evidence: {
        coveredConcepts: [
          {
            id: "key-idea-memory",
            importance: "required",
            text: "long-term memory",
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

  it("blocks likely_correct guidance when a Study Note prohibited phrase matches on reveal", () => {
    const { recall, studyNote, userId } = createRecallableStudyNote({
      prohibitedPhrases: [
        {
          id: "prohibited-passive-review",
          text: "retrieval practice is passive review",
        },
      ],
    });
    const session = recall.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId,
    });

    recall.updateFlashCardAttemptText({
      sessionId: session.id,
      text: "Retrieval practice strengthens access to long-term memory, but retrieval practice is passive review.",
      userId,
    });

    const revealedSession = recall.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });

    expect(revealedSession.questions[0]?.answerCheck).toMatchObject({
      confidence: "low",
      primaryReason: "study_note_prohibited_phrase_match",
      status: "uncertain",
      suggestedSelfRating: "hard",
      evidence: {
        matchedProhibitedPhrases: [
          {
            scope: "study_note",
            text: "retrieval practice is passive review",
          },
        ],
      },
    });
  });

  it("skips Answer Check for empty or whitespace-only typed answers", () => {
    const { recall, studyNote, userId } = createRecallableStudyNote();
    const session = recall.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId,
    });

    recall.updateFlashCardAttemptText({
      sessionId: session.id,
      text: "   ",
      userId,
    });

    const revealedSession = recall.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });

    expect(revealedSession.questions[0]?.answerCheck).toBeUndefined();
  });

  it("still reveals the answer if Answer Check throws", () => {
    const storage = createMemoryStorage();
    const notes = createAppNotesContext({
      keyPrefix: "recall-answer-check-failing-source-notes",
      storage,
    });
    const studyNotes = createAppStudyNotesContext({
      keyPrefix: "recall-answer-check-failing-study-notes",
      storage,
    });
    const recall = createAppRecallContext({
      keyPrefix: "recall-answer-check-failing-session",
      notes,
      scoreAnswerCheck: () => {
        throw new Error("Answer Check unavailable");
      },
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes,
    });
    const userId = "user-answer-check";
    const created = studyNotes.createStudyNote(userId, {
      sourceBody: "Active recall source context.",
      sourceTitle: "Active recall",
    });
    const studyNote = studyNotes.updateStudyNote(userId, created.id, {
      acceptedVariants: [],
      acronyms: [],
      expectedAnswer: "Active recall strengthens durable memory access.",
      keyIdeas: [],
      labelIds: [],
      metaphors: [],
      prompt: "What does active recall strengthen?",
      prohibitedPhrases: [],
      sourceBody: "Active recall source context.",
      sourceTitle: "Active recall",
    });
    const session = recall.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId,
    });

    recall.updateFlashCardAttemptText({
      sessionId: session.id,
      text: "Active recall helps memory.",
      userId,
    });

    const revealedSession = recall.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });

    expect(revealedSession.isAnswerRevealed).toBe(true);
    expect(revealedSession.questions[0]?.answerCheck).toBeUndefined();
  });

  it("restores Answer Check guidance from the active-session snapshot", () => {
    const { recall, storage, studyNote, userId } = createRecallableStudyNote();
    const session = recall.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId,
    });

    recall.updateFlashCardAttemptText({
      sessionId: session.id,
      text: "Retrieval practice strengthens access to long term memory.",
      userId,
    });
    recall.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });

    const reloadedRecall = createAppRecallContext({
      keyPrefix: "recall-answer-check-session",
      notes: createAppNotesContext({
        keyPrefix: "recall-answer-check-source-notes",
        storage,
      }),
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
      studyNotes: createAppStudyNotesContext({
        keyPrefix: "recall-answer-check-study-notes",
        storage,
      }),
    });

    expect(
      reloadedRecall.getSnapshot()?.questions[0]?.answerCheck,
    ).toMatchObject({
      status: "likely_correct",
      suggestedSelfRating: "good",
    });
  });
});
