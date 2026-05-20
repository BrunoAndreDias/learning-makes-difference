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
        },
      ],
    ]);
    const service: AppPersistentLabelsService = {
      createLabel: vi.fn(async ({ name }) => {
        const createdLabel = {
          id: "label-2",
          name,
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
      }),
    ).resolves.toMatchObject({
      id: "label-2",
      name: "Biology",
    });
    expect(service.createLabel).toHaveBeenCalledWith({
      name: "Biology",
    });
    await expect(
      persistentLabels.renameLabel("user-casey", "label-1", "Natural Science"),
    ).resolves.toMatchObject({
      id: "label-1",
      name: "Natural Science",
    });

    await persistentLabels.deleteLabel("user-casey", "label-2");

    expect(labels.getLabelsForUser("user-casey")).toEqual([
      {
        id: "label-1",
        name: "Natural Science",
      },
    ]);
  });
});
