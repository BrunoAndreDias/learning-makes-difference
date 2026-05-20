import { describe, expect, it } from "vitest";

import { createAppLabelsContext } from "./labels";

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

describe("label management", () => {
  it("creates, renames, lists, and deletes flat labels", () => {
    const labels = createAppLabelsContext({
      keyPrefix: "labels-test-flat-crud",
      storage: createMemoryStorage(),
    });
    const userId = "user-1";

    const science = labels.createLabel({
      name: "Science",
      userId,
    });
    const biology = labels.createLabel({
      name: "Biology",
      userId,
    });

    expect(labels.getLabelsForUser(userId)).toEqual([
      {
        id: biology.id,
        name: "Biology",
      },
      {
        id: science.id,
        name: "Science",
      },
    ]);

    expect(
      labels.renameLabel({
        labelId: biology.id,
        name: "  Life Science  ",
        userId,
      }),
    ).toEqual({
      id: biology.id,
      name: "Life Science",
    });

    labels.deleteLabel({
      labelId: biology.id,
      userId,
    });

    expect(labels.getLabelsForUser(userId)).toEqual([
      {
        id: science.id,
        name: "Science",
      },
    ]);
  });

  it("keeps label ownership scoped to the authenticated account", () => {
    const labels = createAppLabelsContext({
      keyPrefix: "labels-test-ownership",
      storage: createMemoryStorage(),
    });

    const ownerLabel = labels.createLabel({
      name: "Private topic",
      userId: "owner",
    });

    expect(() =>
      labels.renameLabel({
        labelId: ownerLabel.id,
        name: "Leaked topic",
        userId: "other-user",
      }),
    ).toThrowError(expect.objectContaining({ code: "not_found" }));

    expect(labels.getLabelsForUser("owner")).toHaveLength(1);
    expect(labels.getLabelsForUser("other-user")).toHaveLength(0);
  });

  it("loads legacy stored labels with hierarchy fields as flat labels", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      "labels-test-legacy:records",
      JSON.stringify([
        {
          id: "label-biology",
          name: "Biology",
          parentIds: ["label-science"],
          userId: "user-1",
        },
      ]),
    );
    const labels = createAppLabelsContext({
      keyPrefix: "labels-test-legacy",
      storage,
    });

    expect(labels.getLabelsForUser("user-1")).toEqual([
      {
        id: "label-biology",
        name: "Biology",
      },
    ]);
  });
});
