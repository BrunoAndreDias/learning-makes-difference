import { describe, expect, it } from "vitest";

import { createAppLabelsContext } from "../src/features/labels/labels";
import { createAppNotesContext } from "../src/features/notes/notes";
import { createAppRecallContext } from "../src/features/recall/recall";

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

describe("recall session setup", () => {
  it("does not start FlashCard sessions from label targets", () => {
    const storage = createMemoryStorage();
    const labels = createAppLabelsContext({
      keyPrefix: "recall-test-label-targets-labels",
      storage,
    });
    const notes = createAppNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labels.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: "recall-test-label-targets-notes",
      storage,
    });
    const recall = createAppRecallContext({
      notes,
      storage,
    });
    const userId = "owner";
    const science = labels.createLabel({ name: "Science", userId });

    notes.createNote(userId, {
      acronyms: [],
      body: "Label assignment should not define v1 recall.",
      labelIds: [science.id],
      metaphors: [],
      title: "Label-targeted note",
    });

    expect(() =>
      recall.startFlashCardSession({
        labelId: science.id,
        userId,
      } as never),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_input",
        message: "Choose at least one note for recall.",
      }),
    );
  });

  it("starts from selected owned notes including unlabeled notes and shuffles the session order", () => {
    const storage = createMemoryStorage();
    const labels = createAppLabelsContext({
      keyPrefix: "recall-test-labels",
      storage,
    });
    const notes = createAppNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labels.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: "recall-test-notes",
      storage,
    });
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          "session-1-1-1-1" as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes].reverse(),
      storage,
    });
    const userId = "user-1";

    const science = labels.createLabel({ name: "Science", userId });
    const biology = labels.createLabel({ name: "Biology", userId });

    const scienceNote = notes.createNote(userId, {
      acronyms: [],
      body: "Broad topic note",
      labelIds: [science.id],
      metaphors: [],
      title: "Science note",
    });
    const biologyNote = notes.createNote(userId, {
      acronyms: [],
      body: "Biology note",
      labelIds: [biology.id],
      metaphors: [],
      title: "Biology note",
    });
    const unlabeledNote = notes.createNote(userId, {
      acronyms: [],
      body: "Should be recallable without a label",
      labelIds: [],
      metaphors: [],
      title: "Unlabeled note",
    });

    const session = recall.startFlashCardSession({
      noteIds: [scienceNote.id, biologyNote.id, unlabeledNote.id],
      userId,
    });

    expect(session).toMatchObject({
      id: "session-1-1-1-1",
      labelId: null,
      labelName: "Selected notes",
      mode: "FlashCard",
    });
    expect(session.notes.map((note) => note.title)).toEqual([
      "Unlabeled note",
      "Biology note",
      "Science note",
    ]);
  });

  it("requires at least one selected note to start a session", () => {
    const storage = createMemoryStorage();
    const labels = createAppLabelsContext({
      keyPrefix: "recall-test-ownership-labels",
      storage,
    });
    const notes = createAppNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labels.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: "recall-test-ownership-notes",
      storage,
    });
    const recall = createAppRecallContext({
      notes,
      storage,
    });

    expect(() =>
      recall.startFlashCardSession({
        noteIds: [],
        userId: "owner",
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_input" }));
  });

  it("starts a FlashCard session from one owned note without a label and snapshots the note", () => {
    const storage = createMemoryStorage();
    const notes = createAppNotesContext({
      keyPrefix: "recall-test-selected-note-notes",
      storage,
    });
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          "session-selected-note" as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-selected-note-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
    });
    const userId = "owner";
    const selectedNote = notes.createNote(userId, {
      acronyms: [],
      body: "Original selected-note answer",
      labelIds: [],
      metaphors: [],
      title: "Selected-note question",
    });
    const otherUsersNote = notes.createNote("other-user", {
      acronyms: [],
      body: "Private answer",
      labelIds: [],
      metaphors: [],
      title: "Private question",
    });

    expect(() =>
      recall.startFlashCardSession({
        noteIds: [otherUsersNote.id],
        userId,
      }),
    ).toThrowError(expect.objectContaining({ code: "not_found" }));

    const session = recall.startFlashCardSession({
      noteIds: [selectedNote.id],
      userId,
    });

    notes.updateNote(userId, selectedNote.id, {
      acronyms: [],
      body: "Updated selected-note answer",
      labelIds: [],
      metaphors: [],
      title: "Updated selected-note question",
    });

    expect(session).toMatchObject({
      id: "session-selected-note",
      labelId: null,
      labelName: "Selected notes",
      mode: "FlashCard",
      notes: [
        {
          body: "Original selected-note answer",
          id: selectedNote.id,
          title: "Selected-note question",
        },
      ],
    });
    expect(recall.getSnapshot()).toMatchObject({
      notes: [
        {
          body: "Original selected-note answer",
          id: selectedNote.id,
          title: "Selected-note question",
        },
      ],
    });
  });

  it("persists attempted selected-note sessions and discards zero-attempt selected-note exits", () => {
    const storage = createMemoryStorage();
    const notes = createAppNotesContext({
      keyPrefix: "recall-test-selected-note-history-notes",
      storage,
    });
    let sessionCounter = 0;
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `session-selected-note-history-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-selected-note-history-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
    });
    const userId = "owner";
    const note = notes.createNote(userId, {
      acronyms: [],
      body: "Selected-note answer",
      labelIds: [],
      metaphors: [],
      title: "Selected-note question",
    });

    const attemptedSession = recall.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });

    recall.revealFlashCardAnswer({
      sessionId: attemptedSession.id,
      userId,
    });
    expect(
      recall.rateFlashCardAnswer({
        rating: "partial",
        sessionId: attemptedSession.id,
        userId,
      }),
    ).toBeNull();

    expect(recall.listSessionResults({ userId })).toMatchObject([
      {
        attempts: [{ noteId: note.id, rating: "partial" }],
        id: attemptedSession.id,
        labelId: null,
        labelName: "Selected notes",
      },
    ]);

    const zeroAttemptSession = recall.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });

    recall.endFlashCardSession({
      sessionId: zeroAttemptSession.id,
      userId,
    });

    expect(recall.listSessionResults({ userId })).toHaveLength(1);
  });

  it("reveals answers, advances after rating, and clears the active session when ended", () => {
    const storage = createMemoryStorage();
    const labels = createAppLabelsContext({
      keyPrefix: "recall-test-progress-labels",
      storage,
    });
    const notes = createAppNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labels.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: "recall-test-progress-notes",
      storage,
    });
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          "session-2-2-2-2" as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-progress-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
    });
    const userId = "user-1";
    const science = labels.createLabel({ name: "Science", userId });

    const firstNote = notes.createNote(userId, {
      acronyms: [],
      body: "Answer one",
      labelIds: [science.id],
      metaphors: [],
      title: "Question one",
    });
    const secondNote = notes.createNote(userId, {
      acronyms: [],
      body: "Answer two",
      labelIds: [science.id],
      metaphors: [],
      title: "Question two",
    });

    const session = recall.startFlashCardSession({
      noteIds: [firstNote.id, secondNote.id],
      userId,
    });

    expect(() =>
      recall.rateFlashCardAnswer({
        rating: "partial",
        sessionId: session.id,
        userId,
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_input" }));

    const revealedSession = recall.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });

    expect(revealedSession.isAnswerRevealed).toBe(true);

    const advancedSession = recall.rateFlashCardAnswer({
      rating: "partial",
      sessionId: session.id,
      userId,
    });

    expect(advancedSession).toMatchObject({
      attempts: [{ noteId: session.notes[0].id, rating: "partial" }],
      currentIndex: 1,
      isAnswerRevealed: false,
    });

    const endedSession = recall.endFlashCardSession({
      sessionId: session.id,
      userId,
    });

    expect(endedSession.attempts).toHaveLength(1);
    expect(recall.getSnapshot()).toBeNull();
  });

  it("persists attempted sessions for history, preserves note snapshots, and discards zero-attempt exits", () => {
    const storage = createMemoryStorage();
    const labels = createAppLabelsContext({
      keyPrefix: "recall-test-history-labels",
      storage,
    });
    const notes = createAppNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labels.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: "recall-test-history-notes",
      storage,
    });
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          "session-3-3-3-3" as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-history-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
    });
    const userId = "user-1";
    const science = labels.createLabel({ name: "Science", userId });
    const note = notes.createNote(userId, {
      acronyms: [],
      body: "Original answer",
      labelIds: [science.id],
      metaphors: [],
      title: "Original question",
    });

    const attemptedSession = recall.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });

    recall.revealFlashCardAnswer({
      sessionId: attemptedSession.id,
      userId,
    });
    recall.rateFlashCardAnswer({
      rating: "nailed",
      sessionId: attemptedSession.id,
      userId,
    });

    notes.updateNote(userId, note.id, {
      acronyms: [],
      body: "Updated answer",
      labelIds: [science.id],
      metaphors: [],
      title: "Updated question",
    });

    const reloadedRecall = createAppRecallContext({
      keyPrefix: "recall-test-history-session",
      notes,
      storage,
    });

    expect(reloadedRecall.listSessionResults({ userId })).toMatchObject([
      {
        attempts: [{ noteId: note.id, rating: "nailed" }],
        id: attemptedSession.id,
        labelId: null,
        labelName: "Selected notes",
        notes: [
          {
            body: "Original answer",
            id: note.id,
            title: "Original question",
          },
        ],
      },
    ]);

    const zeroAttemptSession = reloadedRecall.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });

    reloadedRecall.endFlashCardSession({
      sessionId: zeroAttemptSession.id,
      userId,
    });

    expect(reloadedRecall.listSessionResults({ userId })).toHaveLength(1);
  });

  it("lists selected-note session results by account and leaves label filters empty", () => {
    const storage = createMemoryStorage();
    const labels = createAppLabelsContext({
      keyPrefix: "recall-test-filter-labels",
      storage,
    });
    const notes = createAppNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labels.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: "recall-test-filter-notes",
      storage,
    });
    let sessionCounter = 0;
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `session-4-4-4-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-filter-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
    });
    const userId = "user-1";
    const science = labels.createLabel({ name: "Science", userId });
    const history = labels.createLabel({ name: "History", userId });
    const otherScience = labels.createLabel({
      name: "Private science",
      userId: "user-2",
    });

    const scienceNote = notes.createNote(userId, {
      acronyms: [],
      body: "Science answer",
      labelIds: [science.id],
      metaphors: [],
      title: "Science question",
    });
    const historyNote = notes.createNote(userId, {
      acronyms: [],
      body: "History answer",
      labelIds: [history.id],
      metaphors: [],
      title: "History question",
    });
    const otherNote = notes.createNote("user-2", {
      acronyms: [],
      body: "Private answer",
      labelIds: [otherScience.id],
      metaphors: [],
      title: "Private question",
    });

    for (const [noteId, owner] of [
      [scienceNote.id, userId],
      [historyNote.id, userId],
      [otherNote.id, "user-2"],
    ] as const) {
      const session = recall.startFlashCardSession({
        noteIds: [noteId],
        userId: owner,
      });

      recall.revealFlashCardAnswer({
        sessionId: session.id,
        userId: owner,
      });
      recall.rateFlashCardAnswer({
        rating: "partial",
        sessionId: session.id,
        userId: owner,
      });
    }

    expect(
      recall
        .listSessionResults({ labelId: science.id, userId })
        .map((result) => {
          return result.labelName;
        }),
    ).toEqual([]);
    expect(recall.listSessionResults({ userId })).toHaveLength(2);
    expect(recall.listSessionResults({ userId: "user-2" })).toHaveLength(1);
  });
});
