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
      body: "Broad topic note",
      labelIds: [science.id],
      title: "Science note",
    });
    notes.createNote(userId, {
      body: "Biology note",
      labelIds: [biology.id],
      title: "Biology note",
    });
    notes.createNote(userId, {
      body: "Overlap note",
      labelIds: [biology.id, chemistry.id],
      title: "Overlap note",
    });
    notes.createNote(userId, {
      body: "Descendant note",
      labelIds: [biochemistry.id],
      title: "Biochemistry note",
    });
    notes.createNote(userId, {
      body: "Should not be recallable without a label",
      labelIds: [],
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
});
