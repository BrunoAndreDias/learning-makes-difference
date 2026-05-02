import { describe, expect, it, vi } from "vitest";

import {
  type AppPersistentNotesService,
  createPersistentNotesContext,
} from "./persistent-notes";

describe("createPersistentNotesContext", () => {
  it("refreshes and mutates the in-memory snapshot from the async notes service", async () => {
    const notesById = new Map([
      [
        "note-1",
        {
          acronyms: [],
          body: "Body 1",
          createdAt: "2026-05-02T12:00:00.000Z",
          id: "note-1",
          labelIds: [],
          metaphors: [],
          title: "First note",
          updatedAt: "2026-05-02T12:00:00.000Z",
        },
      ],
    ]);
    const service: AppPersistentNotesService = {
      createNote: vi.fn(async (input) => {
        const createdNote = {
          ...input,
          createdAt: "2026-05-02T12:05:00.000Z",
          id: "note-2",
          updatedAt: "2026-05-02T12:05:00.000Z",
        };

        notesById.set(createdNote.id, createdNote);

        return createdNote;
      }),
      deleteNote: vi.fn(async ({ noteId }) => {
        notesById.delete(noteId);
      }),
      listNotes: vi.fn(async () =>
        [...notesById.values()].sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt),
        ),
      ),
      updateNote: vi.fn(async (input) => {
        const existingNote = notesById.get(input.noteId);

        if (existingNote === undefined) {
          throw new Error("Missing note");
        }

        const updatedNote = {
          ...existingNote,
          id: input.noteId,
          acronyms: input.acronyms,
          body: input.body,
          labelIds: input.labelIds,
          metaphors: input.metaphors,
          title: input.title,
          updatedAt: "2026-05-02T12:10:00.000Z",
        };

        notesById.set(updatedNote.id, updatedNote);

        return updatedNote;
      }),
    };
    const notes = createPersistentNotesContext({
      service,
    });

    await expect(notes.refresh("user-casey")).resolves.toMatchObject([
      {
        id: "note-1",
        userId: "user-casey",
      },
    ]);

    await expect(
      notes.createNote("user-casey", {
        acronyms: [],
        body: "Body 2",
        labelIds: ["label-2"],
        metaphors: [],
        title: "Second note",
      }),
    ).resolves.toMatchObject({
      id: "note-2",
      title: "Second note",
    });
    await expect(
      notes.updateNote("user-casey", "note-1", {
        acronyms: [],
        body: "Updated body 1",
        labelIds: ["label-1"],
        metaphors: [
          {
            description: "Hook 1",
          },
        ],
        title: "Updated first note",
      }),
    ).resolves.toMatchObject({
      id: "note-1",
      title: "Updated first note",
      updatedAt: "2026-05-02T12:10:00.000Z",
    });

    await notes.deleteNote("user-casey", "note-2");

    expect(notes.getSnapshot()).toEqual([
      {
        acronyms: [],
        body: "Updated body 1",
        createdAt: "2026-05-02T12:00:00.000Z",
        id: "note-1",
        labelIds: ["label-1"],
        metaphors: [
          {
            description: "Hook 1",
          },
        ],
        title: "Updated first note",
        updatedAt: "2026-05-02T12:10:00.000Z",
        userId: "user-casey",
      },
    ]);
  });
});
