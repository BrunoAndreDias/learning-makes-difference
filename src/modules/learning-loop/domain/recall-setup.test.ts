import { describe, expect, it } from "vitest";

import type { AppLabel } from "../../labels/domain/labels";
import type { AppNote } from "./notes";
import type { SessionResult } from "./recall";
import { deriveRecallSetupState } from "./recall-setup";

function buildNote(
  overrides: Partial<AppNote> & Pick<AppNote, "id" | "title">,
): AppNote {
  const { id, title, ...rest } = overrides;

  return {
    acronyms: [],
    body: "Body",
    createdAt: "2026-04-01T00:00:00.000Z",
    id,
    labelIds: [],
    metaphors: [],
    title,
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...rest,
  };
}

function buildLabel(
  overrides: Partial<AppLabel> & Pick<AppLabel, "id" | "name">,
): AppLabel {
  const { id, name, ...rest } = overrides;

  return {
    id,
    name,
    parentIds: [],
    ...rest,
  };
}

function buildSessionResult(
  overrides: Partial<SessionResult> &
    Pick<
      SessionResult,
      "attempts" | "completedAt" | "createdAt" | "id" | "notes"
    >,
): SessionResult {
  const { attempts, completedAt, createdAt, id, notes, ...rest } = overrides;

  return {
    attempts,
    completedAt,
    createdAt,
    id,
    mode: "FlashCard",
    notes,
    questions: [],
    ...rest,
  };
}

describe("recall setup", () => {
  it("derives visible candidates, selected summaries, empty states, and estimates", () => {
    const biology = buildLabel({ id: "label-bio", name: "Biology" });
    const chemistry = buildLabel({ id: "label-chem", name: "Chemistry" });
    const notes = [
      buildNote({
        body: "ATP stores transferable energy.",
        id: "note-1",
        labelIds: [biology.id],
        title: "ATP",
        updatedAt: "2026-04-30T09:00:00.000Z",
      }),
      buildNote({
        body: "Mitochondria generate ATP.",
        id: "note-2",
        labelIds: [biology.id],
        title: "Mitochondria",
        updatedAt: "2026-03-01T09:00:00.000Z",
      }),
      buildNote({
        body: "Catalysts lower activation energy.",
        id: "note-3",
        labelIds: [chemistry.id],
        title: "Catalysts",
        updatedAt: "2026-04-28T09:00:00.000Z",
      }),
    ];
    const sessionResults = [
      buildSessionResult({
        attempts: [{ noteId: "note-2", rating: "partial" }],
        completedAt: "2026-04-29T10:00:00.000Z",
        createdAt: "2026-04-29T09:50:00.000Z",
        id: "session-1",
        notes: [notes[1]],
      }),
      buildSessionResult({
        attempts: [{ noteId: "note-3", rating: "nailed" }],
        completedAt: "2026-04-30T10:00:00.000Z",
        createdAt: "2026-04-30T09:50:00.000Z",
        id: "session-2",
        notes: [notes[2]],
      }),
    ];

    const state = deriveRecallSetupState({
      labels: [biology, chemistry],
      notes,
      now: "2026-05-01T12:00:00.000Z",
      searchQuery: "at",
      selectedFilter: { kind: "all" },
      selectedNoteIds: ["note-2", "note-1"],
      sessionResults,
    });

    expect(
      state.visibleCandidates.map((candidate) => candidate.note.id),
    ).toEqual(["note-1", "note-2", "note-3"]);
    expect(state.selectedSummaries).toEqual([
      expect.objectContaining({
        id: "note-2",
        labelNames: ["Biology"],
        latestRating: "partial",
        title: "Mitochondria",
      }),
      expect.objectContaining({
        id: "note-1",
        labelNames: ["Biology"],
        latestRating: null,
        title: "ATP",
      }),
    ]);
    expect(state.availableEmptyState).toBe("none");
    expect(state.selectedEmptyState).toBe("none");
    expect(state.summary).toMatchObject({
      difficultyLabel: "Challenging mix",
      practiceTypeLabel: "General recall",
      selectedCount: 2,
      startDisabledReason: null,
    });
    expect(state.summary.estimatedTimeLabel).toBe("4 min");
    expect(state.filterSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ count: 3, kind: "all" }),
        expect.objectContaining({ count: 2, kind: "recent" }),
        expect.objectContaining({ count: 1, kind: "weak" }),
        expect.objectContaining({ count: 2, kind: "due" }),
        expect.objectContaining({
          count: 2,
          kind: "label",
          labelId: biology.id,
        }),
      ]),
    );
  });
});
