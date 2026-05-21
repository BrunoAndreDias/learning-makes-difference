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

function createRecallableStudyNote() {
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
    acronyms: [],
    expectedAnswer:
      "Retrieval practice strengthens access to long-term memory.",
    labelIds: [],
    metaphors: [],
    prompt: "What does retrieval practice strengthen?",
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
      algorithmVersion: "baseline_expected_answer_v1",
      confidence: "high",
      status: "likely_correct",
      suggestedSelfRating: "good",
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
      acronyms: [],
      expectedAnswer: "Active recall strengthens durable memory access.",
      labelIds: [],
      metaphors: [],
      prompt: "What does active recall strengthen?",
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
