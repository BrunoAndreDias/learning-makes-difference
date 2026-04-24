import { describe, expect, it } from "vitest";

import { createAppLabelsContext } from "../src/lib/labels";

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
  it("returns descendants across a DAG and rejects relationship cycles", () => {
    const labels = createAppLabelsContext({
      keyPrefix: "labels-test-dag",
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
    const chemistry = labels.createLabel({
      name: "Chemistry",
      userId,
    });
    const biochemistry = labels.createLabel({
      name: "Biochemistry",
      userId,
    });

    labels.addParent({
      labelId: biology.id,
      parentId: science.id,
      userId,
    });
    labels.addParent({
      labelId: chemistry.id,
      parentId: science.id,
      userId,
    });
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

    expect(
      [...labels.getDescendantIds({ labelId: science.id, userId })].sort(),
    ).toEqual([biology.id, biochemistry.id, chemistry.id].sort());

    expect(() =>
      labels.addParent({
        labelId: science.id,
        parentId: biochemistry.id,
        userId,
      }),
    ).toThrowError(expect.objectContaining({ code: "cycle_detected" }));
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
});
