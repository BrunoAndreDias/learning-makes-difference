import { describe, expect, it } from "vitest";
import {
  deriveLearningState,
  deriveLearningStates,
  formatLearningStateCompactLabel,
  formatLearningStateScoreLabel,
  type NoteRecallHistory,
} from "./learning-state";
import type { AppNote } from "./notes-workspace/notes";

function buildNote(overrides: Partial<AppNote> & Pick<AppNote, "id">): AppNote {
  const { id, ...rest } = overrides;

  return {
    acronyms: [],
    body: "Body",
    createdAt: "2026-04-01T00:00:00.000Z",
    id,
    labelIds: [],
    metaphors: [],
    title: "Title",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...rest,
  };
}

function buildHistory(
  noteId: string,
  attempts: NoteRecallHistory["attempts"],
): NoteRecallHistory {
  return {
    attempts,
    noteId,
  };
}

describe("learning state", () => {
  it("marks saved notes without recall evidence as not recalled yet", () => {
    const note = buildNote({
      acronyms: [{ description: "FIFO means first in, first out." }],
      id: "note-not-recalled",
      metaphors: [{ description: "Queue: packets line up." }],
    });

    const learningState = deriveLearningState({ history: null, note });

    expect(learningState).toEqual({
      lastRecalledAt: null,
      latestScore: null,
      noteId: note.id,
    });
    expect(formatLearningStateCompactLabel(learningState)).toBe(
      "Not recalled yet",
    );
  });

  it("uses only the latest recall score and timestamp", () => {
    const note = buildNote({ id: "note-recalled" });

    const learningState = deriveLearningState({
      history: buildHistory(note.id, [
        {
          completedAt: "2026-04-10T09:00:00.000Z",
          rating: "forgot",
        },
        {
          completedAt: "2026-04-11T09:00:00.000Z",
          rating: "good",
        },
      ]),
      note,
    });

    expect(learningState).toEqual({
      lastRecalledAt: "2026-04-11T09:00:00.000Z",
      latestScore: "good",
      noteId: note.id,
    });
    expect(formatLearningStateCompactLabel(learningState)).toBe(
      "Last score: Good",
    );
  });

  it("keeps the score even when the latest recall timestamp is invalid", () => {
    const note = buildNote({ id: "note-invalid-date" });

    expect(
      deriveLearningState({
        history: buildHistory(note.id, [
          {
            completedAt: "",
            rating: "easy",
          },
        ]),
        note,
      }),
    ).toEqual({
      lastRecalledAt: null,
      latestScore: "easy",
      noteId: note.id,
    });
  });

  it("formats FlashCard self-ratings as scores", () => {
    expect(formatLearningStateScoreLabel(null)).toBeNull();
    expect(formatLearningStateScoreLabel("forgot")).toBe("Forgot");
    expect(formatLearningStateScoreLabel("hard")).toBe("Hard");
    expect(formatLearningStateScoreLabel("good")).toBe("Good");
    expect(formatLearningStateScoreLabel("easy")).toBe("Easy");
  });

  it("derives states for each note from recall history lookup", () => {
    const notes = [buildNote({ id: "note-1" }), buildNote({ id: "note-2" })];

    expect(
      deriveLearningStates({
        histories: [
          buildHistory("note-2", [
            {
              completedAt: "2026-04-15T10:00:00.000Z",
              rating: "hard",
            },
          ]),
        ],
        notes,
      }),
    ).toEqual([
      { lastRecalledAt: null, latestScore: null, noteId: "note-1" },
      {
        lastRecalledAt: "2026-04-15T10:00:00.000Z",
        latestScore: "hard",
        noteId: "note-2",
      },
    ]);
  });
});
