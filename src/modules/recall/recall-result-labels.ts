import type { AppLabel } from "../labels/label-management/labels";
import type { FlashCardSessionResult } from "./recall";

export function listRecallResultLabels(input: {
  currentLabels: readonly AppLabel[];
  sessionResults: readonly FlashCardSessionResult[];
}): AppLabel[] {
  const labelsById = new Map(
    input.currentLabels.map((label) => [
      label.id,
      {
        ...label,
        parentIds: [...label.parentIds],
      },
    ]),
  );

  for (const result of input.sessionResults) {
    for (const note of result.notes) {
      for (const label of note.labels ?? []) {
        if (!labelsById.has(label.id)) {
          labelsById.set(label.id, {
            id: label.id,
            name: label.name,
            parentIds: [],
          });
        }
      }
    }
  }

  return [...labelsById.values()].sort((left, right) => {
    return (
      left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
    );
  });
}
