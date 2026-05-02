import { describe, expect, it } from "vitest";
import type { FlashCardSessionResult } from "./recall";
import { listRecallResultLabels } from "./recall-result-labels";

const baseSessionResult = {
  attempts: [],
  completedAt: "2026-04-30T10:05:00.000Z",
  createdAt: "2026-04-30T10:00:00.000Z",
  id: "session-1",
  mode: "FlashCard",
  questions: [],
} satisfies Partial<FlashCardSessionResult>;

function createSessionResult(
  override: Partial<FlashCardSessionResult>,
): FlashCardSessionResult {
  return {
    ...baseSessionResult,
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

describe("recall result labels", () => {
  it("combines current labels with stored result label snapshots", () => {
    expect(
      listRecallResultLabels({
        currentLabels: [
          {
            id: "science",
            name: "Current Science",
            parentIds: ["stem"],
          },
        ],
        sessionResults: [
          createSessionResult({
            notes: [
              {
                acronyms: [],
                body: "Stored science note.",
                createdAt: "2026-04-30T09:00:00.000Z",
                id: "science-note",
                labelIds: ["science"],
                labels: [{ id: "science", name: "Old Science" }],
                metaphors: [],
                title: "Science",
                updatedAt: "2026-04-30T09:30:00.000Z",
              },
              {
                acronyms: [],
                body: "Stored archive note.",
                createdAt: "2026-04-30T09:00:00.000Z",
                id: "archive-note",
                labelIds: ["archive"],
                labels: [{ id: "archive", name: "Archive" }],
                metaphors: [],
                title: "Archive",
                updatedAt: "2026-04-30T09:30:00.000Z",
              },
            ],
          }),
        ],
      }),
    ).toEqual([
      {
        id: "archive",
        name: "Archive",
        parentIds: [],
      },
      {
        id: "science",
        name: "Current Science",
        parentIds: ["stem"],
      },
    ]);
  });

  it("returns independent current label parent id arrays", () => {
    const currentLabels = [
      {
        id: "science",
        name: "Science",
        parentIds: ["stem"],
      },
    ];
    const labels = listRecallResultLabels({
      currentLabels,
      sessionResults: [],
    });

    labels[0].parentIds.push("mutated");

    expect(currentLabels).toEqual([
      {
        id: "science",
        name: "Science",
        parentIds: ["stem"],
      },
    ]);
  });

  it("does not let stored label snapshots replace matching current labels", () => {
    expect(
      listRecallResultLabels({
        currentLabels: [
          {
            id: "science",
            name: "Current Science",
            parentIds: ["stem"],
          },
        ],
        sessionResults: [
          createSessionResult({
            notes: [
              {
                acronyms: [],
                body: "Stored science note.",
                createdAt: "2026-04-30T09:00:00.000Z",
                id: "science-note",
                labelIds: ["science"],
                labels: [{ id: "science", name: "Old Science" }],
                metaphors: [],
                title: "Science",
                updatedAt: "2026-04-30T09:30:00.000Z",
              },
            ],
          }),
        ],
      }),
    ).toEqual([
      {
        id: "science",
        name: "Current Science",
        parentIds: ["stem"],
      },
    ]);
  });
});
