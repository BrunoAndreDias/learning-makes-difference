import { describe, expect, it } from "vitest";

import { createAppLabelsContext } from "../src/lib/labels";
import { createAppNotesContext } from "../src/lib/notes";
import { createAppRecallContext } from "../src/lib/recall";

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
  it("resolves descendant notes once per note, excludes unlabeled notes, and shuffles the session order", () => {
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
      labels,
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes].reverse(),
      storage,
    });
    const userId = "user-1";

    const science = labels.createLabel({ name: "Science", userId });
    const biology = labels.createLabel({ name: "Biology", userId });
    const chemistry = labels.createLabel({ name: "Chemistry", userId });
    const biochemistry = labels.createLabel({ name: "Biochemistry", userId });

    labels.addParent({ labelId: biology.id, parentId: science.id, userId });
    labels.addParent({ labelId: chemistry.id, parentId: science.id, userId });
    labels.addParent({
      labelId: biochemistry.id,
      parentId: biology.id,
      userId,
    });
    labels.addParent({
      labelId: biochemistry.id,
      parentId: chemistry.id,
      userId,
    });

    notes.createNote(userId, {
      acronyms: [],
      body: "Broad topic note",
      labelIds: [science.id],
      metaphors: [],
      title: "Science note",
    });
    notes.createNote(userId, {
      acronyms: [],
      body: "Biology note",
      labelIds: [biology.id],
      metaphors: [],
      title: "Biology note",
    });
    notes.createNote(userId, {
      acronyms: [],
      body: "Overlap note",
      labelIds: [biology.id, chemistry.id],
      metaphors: [],
      title: "Overlap note",
    });
    notes.createNote(userId, {
      acronyms: [],
      body: "Descendant note",
      labelIds: [biochemistry.id],
      metaphors: [],
      title: "Biochemistry note",
    });
    notes.createNote(userId, {
      acronyms: [],
      body: "Should not be recallable without a label",
      labelIds: [],
      metaphors: [],
      title: "Unlabeled note",
    });

    const session = recall.startFlashCardSession({
      labelId: science.id,
      userId,
    });

    expect(session).toMatchObject({
      id: "session-1-1-1-1",
      labelId: science.id,
      labelName: "Science",
      mode: "FlashCard",
    });
    expect(session.notes.map((note) => note.title)).toEqual([
      "Science note",
      "Overlap note",
      "Biology note",
      "Biochemistry note",
    ]);
  });

  it("only allows session setup from a label owned by the signed-in account", () => {
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
      labels,
      notes,
      storage,
    });

    const privateLabel = labels.createLabel({
      name: "Private topic",
      userId: "owner",
    });

    expect(() =>
      recall.startFlashCardSession({
        labelId: privateLabel.id,
        userId: "other-user",
      }),
    ).toThrowError(expect.objectContaining({ code: "not_found" }));
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
      labels,
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
    });
    const userId = "user-1";
    const science = labels.createLabel({ name: "Science", userId });

    notes.createNote(userId, {
      acronyms: [],
      body: "Answer one",
      labelIds: [science.id],
      metaphors: [],
      title: "Question one",
    });
    notes.createNote(userId, {
      acronyms: [],
      body: "Answer two",
      labelIds: [science.id],
      metaphors: [],
      title: "Question two",
    });

    const session = recall.startFlashCardSession({
      labelId: science.id,
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
      labels,
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
      labelId: science.id,
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
      labels,
      notes,
      storage,
    });

    expect(reloadedRecall.listSessionResults({ userId })).toMatchObject([
      {
        attempts: [{ noteId: note.id, rating: "nailed" }],
        id: attemptedSession.id,
        labelId: science.id,
        labelName: "Science",
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
      labelId: science.id,
      userId,
    });

    reloadedRecall.endFlashCardSession({
      sessionId: zeroAttemptSession.id,
      userId,
    });

    expect(reloadedRecall.listSessionResults({ userId })).toHaveLength(1);
  });

  it("filters session results by target label and account", () => {
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
      labels,
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

    notes.createNote(userId, {
      acronyms: [],
      body: "Science answer",
      labelIds: [science.id],
      metaphors: [],
      title: "Science question",
    });
    notes.createNote(userId, {
      acronyms: [],
      body: "History answer",
      labelIds: [history.id],
      metaphors: [],
      title: "History question",
    });
    notes.createNote("user-2", {
      acronyms: [],
      body: "Private answer",
      labelIds: [otherScience.id],
      metaphors: [],
      title: "Private question",
    });

    for (const [labelId, owner] of [
      [science.id, userId],
      [history.id, userId],
      [otherScience.id, "user-2"],
    ] as const) {
      const session = recall.startFlashCardSession({
        labelId,
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
    ).toEqual(["Science"]);
    expect(recall.listSessionResults({ userId })).toHaveLength(2);
    expect(recall.listSessionResults({ userId: "user-2" })).toHaveLength(1);
  });
});
