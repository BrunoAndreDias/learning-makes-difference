import { describe, expect, it, vi } from "vitest";

import type { AppLabel } from "./label-management/labels";
import {
  type AppPersistentLabelsService,
  createPersistentLabelsContext,
  createReadonlyLabelsContext,
} from "./persistent-labels";

describe("createPersistentLabelsContext", () => {
  it("refreshes and mutates the in-memory snapshot from the async labels service", async () => {
    const labelsById = new Map<string, AppLabel>([
      [
        "label-1",
        {
          id: "label-1",
          name: "Science",
          parentIds: [],
        },
      ],
    ]);
    const service: AppPersistentLabelsService = {
      addParent: vi.fn(async ({ labelId, parentId }) => {
        const label = labelsById.get(labelId);

        if (label === undefined) {
          throw new Error("Missing label");
        }

        const updatedLabel = {
          ...label,
          parentIds: [...new Set([...label.parentIds, parentId])].sort(),
        };

        labelsById.set(labelId, updatedLabel);

        return updatedLabel;
      }),
      createLabel: vi.fn(async ({ name, parentIds }) => {
        const createdLabel = {
          id: "label-2",
          name,
          parentIds: [...(parentIds ?? [])].sort(),
        };

        labelsById.set(createdLabel.id, createdLabel);

        return createdLabel;
      }),
      deleteLabel: vi.fn(async ({ labelId }) => {
        labelsById.delete(labelId);
      }),
      listLabels: vi.fn(async () =>
        [...labelsById.values()].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      ),
      removeParent: vi.fn(async ({ labelId, parentId }) => {
        const label = labelsById.get(labelId);

        if (label === undefined) {
          throw new Error("Missing label");
        }

        const updatedLabel = {
          ...label,
          parentIds: label.parentIds.filter(
            (candidateId) => candidateId !== parentId,
          ),
        };

        labelsById.set(labelId, updatedLabel);

        return updatedLabel;
      }),
      renameLabel: vi.fn(async ({ labelId, name }) => {
        const label = labelsById.get(labelId);

        if (label === undefined) {
          throw new Error("Missing label");
        }

        const updatedLabel = {
          ...label,
          name,
        };

        labelsById.set(labelId, updatedLabel);

        return updatedLabel;
      }),
    };
    const persistentLabels = createPersistentLabelsContext({
      service,
    });
    const labels = createReadonlyLabelsContext(persistentLabels);

    await expect(persistentLabels.refresh("user-casey")).resolves.toMatchObject(
      [
        {
          id: "label-1",
          userId: "user-casey",
        },
      ],
    );

    await expect(
      persistentLabels.createLabel("user-casey", {
        name: "Biology",
        parentIds: ["label-1"],
      }),
    ).resolves.toMatchObject({
      id: "label-2",
      name: "Biology",
      parentIds: ["label-1"],
    });
    expect(service.createLabel).toHaveBeenCalledWith({
      name: "Biology",
      parentIds: ["label-1"],
    });
    await expect(
      persistentLabels.renameLabel("user-casey", "label-1", "Natural Science"),
    ).resolves.toMatchObject({
      id: "label-1",
      name: "Natural Science",
    });
    await expect(
      persistentLabels.addParent("user-casey", {
        labelId: "label-2",
        parentId: "label-1",
      }),
    ).resolves.toMatchObject({
      id: "label-2",
      parentIds: ["label-1"],
    });
    await expect(
      persistentLabels.removeParent("user-casey", {
        labelId: "label-2",
        parentId: "label-1",
      }),
    ).resolves.toMatchObject({
      id: "label-2",
      parentIds: [],
    });

    await persistentLabels.deleteLabel("user-casey", "label-2");

    expect(labels.getLabelsForUser("user-casey")).toEqual([
      {
        id: "label-1",
        name: "Natural Science",
        parentIds: [],
      },
    ]);
  });
});
