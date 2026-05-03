type LabelGraphNode = {
  id: string;
  parentIds: readonly string[];
};

export function normalizeLabelParentIds(
  parentIds: readonly string[],
): string[] {
  return [...new Set(parentIds)].sort();
}

export function collectLabelDescendantIds(
  labels: readonly LabelGraphNode[],
  labelId: string,
): string[] {
  const childrenByParent = new Map<string, string[]>();

  for (const label of labels) {
    for (const parentId of label.parentIds) {
      const children = childrenByParent.get(parentId) ?? [];
      children.push(label.id);
      childrenByParent.set(parentId, children);
    }
  }

  const queue = [...(childrenByParent.get(labelId) ?? [])].sort();
  const visited = new Set<string>();
  const descendants: string[] = [];

  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index];

    if (currentId === undefined || visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    descendants.push(currentId);

    const childIds = [...(childrenByParent.get(currentId) ?? [])].sort();

    for (const childId of childIds) {
      if (!visited.has(childId)) {
        queue.push(childId);
      }
    }
  }

  return descendants;
}

export function sortLabelsByName<TLabel extends { name: string }>(
  labels: readonly TLabel[],
): TLabel[] {
  return [...labels].sort((left, right) => left.name.localeCompare(right.name));
}
