import { describe, expect, it } from "vitest";

import type { AppLabel } from "../labels/label-management/labels";
import type { FlashCardSessionResult } from "./recall";
import { searchRecallSessionResults } from "./recall-session-search";

const baseSessionResult = {
  attempts: [{ noteId: "note-1", rating: "nailed" }],
  createdAt: "2026-04-30T10:00:00.000Z",
  mode: "FlashCard",
  questions: [],
} satisfies Partial<FlashCardSessionResult>;

function createSessionResult(
  override: Partial<FlashCardSessionResult>,
): FlashCardSessionResult {
  return {
    ...baseSessionResult,
    completedAt: "2026-04-30T10:05:00.000Z",
    id: "session-1",
    notes: [
      {
        acronyms: [],
        body: "Stored note body.",
        createdAt: "2026-04-30T09:00:00.000Z",
        id: "note-1",
        labelIds: [],
        metaphors: [],
        title: "Stored note",
        updatedAt: "2026-04-30T09:30:00.000Z",
      },
    ],
    ...override,
  };
}

describe("recall session search", () => {
  it("returns sessions where stored note snapshots match note content or memory aids", () => {
    const sessionResults = [
      createSessionResult({
        completedAt: "2026-04-30T10:10:00.000Z",
        id: "metaphor-session",
        notes: [
          {
            acronyms: [],
            body: "Neurons that fire together wire together.",
            createdAt: "2026-04-30T09:00:00.000Z",
            id: "neuro-note",
            labelIds: [],
            metaphors: [
              {
                description:
                  "Forest trail: a forest trail gets easier to follow after use.",
              },
            ],
            title: "Synaptic plasticity",
            updatedAt: "2026-04-30T09:30:00.000Z",
          },
        ],
      }),
      createSessionResult({
        id: "unmatched-session",
        notes: [
          {
            acronyms: [],
            body: "Unrelated material.",
            createdAt: "2026-04-30T09:00:00.000Z",
            id: "other-note",
            labelIds: [],
            metaphors: [],
            title: "Working memory",
            updatedAt: "2026-04-30T09:30:00.000Z",
          },
        ],
      }),
    ];

    expect(
      searchRecallSessionResults({
        labels: [],
        query: "forest trail",
        sessionResults,
      }),
    ).toMatchObject([
      {
        matchChip: "Metaphor",
        matchedNoteTitle: "Synaptic plasticity",
        sessionResult: { id: "metaphor-session" },
      },
    ]);
  });

  it("returns sessions where stored note label names match the query", () => {
    const labels: AppLabel[] = [
      {
        id: "biology",
        name: "Biology",
        parentIds: [],
      },
    ];
    const sessionResults = [
      createSessionResult({
        id: "biology-session",
        notes: [
          {
            acronyms: [],
            body: "Mitochondria generate ATP.",
            createdAt: "2026-04-30T09:00:00.000Z",
            id: "cell-note",
            labelIds: ["biology"],
            metaphors: [],
            title: "Cell respiration",
            updatedAt: "2026-04-30T09:30:00.000Z",
          },
        ],
      }),
    ];

    expect(
      searchRecallSessionResults({
        labels,
        query: "biology",
        sessionResults,
      }),
    ).toMatchObject([
      {
        matchChip: "Label",
        matchedNoteTitle: "Cell respiration",
        sessionResult: { id: "biology-session" },
      },
    ]);
  });

  it("matches stored label snapshots when live labels are no longer available", () => {
    const sessionResults = [
      createSessionResult({
        id: "biology-session",
        notes: [
          {
            acronyms: [],
            body: "Mitochondria generate ATP.",
            createdAt: "2026-04-30T09:00:00.000Z",
            id: "cell-note",
            labelIds: ["biology"],
            labels: [{ id: "biology", name: "Biology" }],
            metaphors: [],
            title: "Cell respiration",
            updatedAt: "2026-04-30T09:30:00.000Z",
          },
        ],
      }),
    ];

    expect(
      searchRecallSessionResults({
        labels: [],
        query: "biology",
        sessionResults,
      }),
    ).toMatchObject([
      {
        matchChip: "Label",
        matchedNoteTitle: "Cell respiration",
        sessionResult: { id: "biology-session" },
      },
    ]);
  });

  it("ranks matches by matched field priority and then newest completed session", () => {
    const sessionResults = [
      createSessionResult({
        completedAt: "2026-04-30T10:20:00.000Z",
        id: "acronym-newer",
        notes: [
          {
            acronyms: [{ description: "SC means Shared Cue." }],
            body: "Only acronym match.",
            createdAt: "2026-04-30T09:00:00.000Z",
            id: "acronym-note",
            labelIds: [],
            metaphors: [],
            title: "Acronym note",
            updatedAt: "2026-04-30T09:30:00.000Z",
          },
        ],
      }),
      createSessionResult({
        completedAt: "2026-04-30T10:05:00.000Z",
        id: "title-older",
        notes: [
          {
            acronyms: [],
            body: "Body also mentions shared cue.",
            createdAt: "2026-04-30T09:00:00.000Z",
            id: "title-note",
            labelIds: [],
            metaphors: [],
            title: "Shared cue title",
            updatedAt: "2026-04-30T09:30:00.000Z",
          },
        ],
      }),
      createSessionResult({
        completedAt: "2026-04-30T10:15:00.000Z",
        id: "body-newer",
        notes: [
          {
            acronyms: [],
            body: "The shared cue appears here.",
            createdAt: "2026-04-30T09:00:00.000Z",
            id: "body-note",
            labelIds: [],
            metaphors: [],
            title: "Body note",
            updatedAt: "2026-04-30T09:30:00.000Z",
          },
        ],
      }),
    ];

    expect(
      searchRecallSessionResults({
        labels: [],
        query: "shared cue",
        sessionResults,
      }).map((result) => result.sessionResult.id),
    ).toEqual(["title-older", "body-newer", "acronym-newer"]);
  });
});
