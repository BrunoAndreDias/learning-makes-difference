import { describe, expect, it } from "vitest";

import {
  type AppNotesError,
  createAppNotesContext,
  listNotesForUser,
} from "../src/lib/notes";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("app notes context", () => {
  it("creates and updates notes for the active account", () => {
    const notes = createAppNotesContext({
      keyPrefix: "notes-test",
      storage: createMemoryStorage(),
    });

    const createdNote = notes.createNote("user-casey", {
      body: "Flash cards reveal the answer after an honest recall attempt.",
      labelIds: [],
      title: "Flash cards",
    });
    const updatedNote = notes.updateNote("user-casey", createdNote.id, {
      body: "Flash cards reveal the answer only after an honest recall attempt.",
      labelIds: [],
      title: "Flash cards",
    });

    expect(updatedNote.id).toBe(createdNote.id);
    expect(listNotesForUser(notes.getSnapshot(), "user-casey")[0]?.body).toBe(
      "Flash cards reveal the answer only after an honest recall attempt.",
    );
  });

  it("keeps notes scoped to the owning account", () => {
    const notes = createAppNotesContext({
      keyPrefix: "notes-test-scope",
      storage: createMemoryStorage(),
    });

    const caseyNote = notes.createNote("user-casey", {
      body: "Concepts can stay unlabeled until the learner is ready to organize.",
      labelIds: [],
      title: "Unlabeled notes",
    });

    notes.createNote("user-jordan", {
      body: "Start with the note, then connect it to labels later.",
      labelIds: [],
      title: "Capture first",
    });

    expect(listNotesForUser(notes.getSnapshot(), "user-casey")).toHaveLength(1);
    expect(listNotesForUser(notes.getSnapshot(), "user-jordan")).toHaveLength(
      1,
    );
    expect(listNotesForUser(notes.getSnapshot(), "user-jordan")[0]?.title).toBe(
      "Capture first",
    );

    expect(() =>
      notes.updateNote("user-jordan", caseyNote.id, {
        body: "This update should be rejected.",
        labelIds: [],
        title: "Cross-account edit",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "not_found",
      } satisfies Pick<AppNotesError, "code">),
    );
  });

  it("allows unlabeled notes and rejects label assignments outside the account scope", () => {
    const notes = createAppNotesContext({
      keyPrefix: "notes-test-labels",
      storage: createMemoryStorage(),
      getOwnedLabelIdsForUser: (userId) => {
        if (userId === "user-casey") {
          return ["label-science", "label-biology"];
        }

        return ["label-other"];
      },
    });

    const unlabeledNote = notes.createNote("user-casey", {
      body: "Capture first, organize later remains a valid study flow.",
      labelIds: [],
      title: "Unlabeled capture",
    });

    expect(unlabeledNote.labelIds).toEqual([]);

    const labeledNote = notes.updateNote("user-casey", unlabeledNote.id, {
      body: "Now this concept belongs to multiple study topics.",
      labelIds: ["label-science", "label-biology"],
      title: "Organized capture",
    });

    expect(labeledNote.labelIds).toEqual(["label-science", "label-biology"]);

    expect(() =>
      notes.updateNote("user-casey", unlabeledNote.id, {
        body: "Cross-account labels must be rejected.",
        labelIds: ["label-science", "label-other"],
        title: "Invalid labels",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_input",
      } satisfies Pick<AppNotesError, "code">),
    );
  });
});
