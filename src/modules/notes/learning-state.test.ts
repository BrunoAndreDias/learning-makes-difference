import { describe, expect, it } from "vitest";
import {
  deriveLearningState,
  deriveLearningStates,
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
  it("marks unpracticed notes and counts hooks", () => {
    const note = buildNote({
      acronyms: [{ description: "FIFO means first in, first out." }],
      id: "note-unpracticed",
      metaphors: [{ description: "Queue: packets line up." }],
    });

    expect(deriveLearningState({ history: null, note })).toMatchObject({
      hookCount: 2,
      isWeak: false,
      lastPracticedAt: null,
      latestRating: null,
      nextReviewAt: null,
      practiced: false,
      recommendedAction: "practice_now",
      status: "unpracticed",
    });
  });

  it("marks hard and forgot notes as weak review targets", () => {
    const note = buildNote({ id: "note-weak" });

    expect(
      deriveLearningState({
        history: buildHistory(note.id, [
          {
            completedAt: "2026-04-10T09:00:00.000Z",
            rating: "forgot",
          },
          {
            completedAt: "2026-04-11T09:00:00.000Z",
            rating: "hard",
          },
        ]),
        note,
      }),
    ).toMatchObject({
      isWeak: true,
      lastPracticedAt: "2026-04-11T09:00:00.000Z",
      latestRating: "hard",
      nextReviewAt: "2026-04-14T09:00:00.000Z",
      practiced: true,
      recommendedAction: "review_now",
      status: "weak",
    });
  });

  it("marks easy notes as ready for review once the next review date passes", () => {
    const note = buildNote({ id: "note-ready" });

    expect(
      deriveLearningState({
        history: buildHistory(note.id, [
          {
            completedAt: "2026-04-10T09:00:00.000Z",
            rating: "easy",
          },
        ]),
        note,
        now: "2026-04-18T09:00:00.000Z",
      }),
    ).toMatchObject({
      isWeak: false,
      latestRating: "easy",
      nextReviewAt: "2026-04-17T09:00:00.000Z",
      recommendedAction: "review_now",
      status: "ready_for_review",
    });
  });

  it("marks recently easy notes as review later", () => {
    const note = buildNote({ id: "note-easy" });

    expect(
      deriveLearningState({
        history: buildHistory(note.id, [
          {
            completedAt: "2026-04-10T09:00:00.000Z",
            rating: "easy",
          },
        ]),
        note,
        now: "2026-04-12T09:00:00.000Z",
      }),
    ).toMatchObject({
      latestRating: "easy",
      recommendedAction: "review_later",
      status: "recently_easy",
    });
  });

  it.each([
    ["empty", ""],
    ["overflowing", "+275760-09-13T00:00:00.000Z"],
  ])("marks notes with %s recall dates as ready for review", (_name, completedAt) => {
    const note = buildNote({ id: "note-overflow-date" });

    expect(
      deriveLearningState({
        history: buildHistory(note.id, [
          {
            completedAt,
            rating: "easy",
          },
        ]),
        note,
        now: "2026-04-12T09:00:00.000Z",
      }),
    ).toMatchObject({
      isWeak: false,
      lastPracticedAt: null,
      latestRating: "easy",
      nextReviewAt: null,
      practiced: true,
      recommendedAction: "review_now",
      status: "ready_for_review",
    });
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
      }).map((state) => ({
        noteId: state.noteId,
        status: state.status,
      })),
    ).toEqual([
      { noteId: "note-1", status: "unpracticed" },
      { noteId: "note-2", status: "weak" },
    ]);
  });
});
