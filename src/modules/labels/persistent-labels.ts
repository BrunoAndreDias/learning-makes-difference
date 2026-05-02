import {
  type AppLabel,
  AppLabelError,
  type AppLabelsContext,
} from "./label-management/labels";

type PersistentLabelsListener = () => void;

type CreateLabelInput = {
  name: string;
};

type RenameLabelInput = {
  labelId: string;
  name: string;
};

type LabelRelationshipInput = {
  labelId: string;
  parentId: string;
};

type StoredLabel = AppLabel & {
  userId: string;
};

export type AppPersistentLabelsService = {
  addParent: (input: LabelRelationshipInput) => Promise<AppLabel>;
  createLabel: (input: CreateLabelInput) => Promise<AppLabel>;
  deleteLabel: (input: { labelId: string }) => Promise<void>;
  listLabels: () => Promise<AppLabel[]>;
  removeParent: (input: LabelRelationshipInput) => Promise<AppLabel>;
  renameLabel: (input: RenameLabelInput) => Promise<AppLabel>;
};

export type AppPersistentLabelsContext = {
  addParent: (
    userId: string | null,
    input: LabelRelationshipInput,
  ) => Promise<AppLabel>;
  createLabel: (
    userId: string | null,
    input: CreateLabelInput,
  ) => Promise<AppLabel>;
  deleteLabel: (userId: string | null, labelId: string) => Promise<void>;
  getSnapshot: () => readonly StoredLabel[];
  refresh: (userId: string | null) => Promise<readonly StoredLabel[]>;
  removeParent: (
    userId: string | null,
    input: LabelRelationshipInput,
  ) => Promise<AppLabel>;
  renameLabel: (
    userId: string | null,
    labelId: string,
    name: string,
  ) => Promise<AppLabel>;
  subscribe: (listener: PersistentLabelsListener) => () => void;
};

type CreatePersistentLabelsContextOptions = {
  service?: AppPersistentLabelsService;
};

function createNotAuthenticatedError() {
  return new AppLabelError("not_found", "A signed-in user is required.");
}

function createMissingServiceError() {
  return new Error("Persistent labels service is not configured.");
}

function toStoredLabel(label: AppLabel, userId: string): StoredLabel {
  return {
    ...label,
    userId,
  };
}

function sortLabels(labels: readonly StoredLabel[]) {
  return [...labels].sort((left, right) => left.name.localeCompare(right.name));
}

function getChildrenByParent(labels: readonly AppLabel[]) {
  const childrenByParent = new Map<string, string[]>();

  for (const label of labels) {
    for (const parentId of label.parentIds) {
      const children = childrenByParent.get(parentId) ?? [];
      children.push(label.id);
      childrenByParent.set(parentId, children);
    }
  }

  return childrenByParent;
}

function collectDescendantIds(
  labels: readonly AppLabel[],
  labelId: string,
): string[] {
  const childrenByParent = getChildrenByParent(labels);
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

export function createReadonlyLabelsContext(
  persistentLabels: Pick<
    AppPersistentLabelsContext,
    "getSnapshot" | "subscribe"
  >,
): AppLabelsContext {
  return {
    addParent: () => {
      throw new Error(
        "Readonly labels context cannot add parents. Use persistentLabels instead.",
      );
    },
    createLabel: () => {
      throw new Error(
        "Readonly labels context cannot create labels. Use persistentLabels instead.",
      );
    },
    deleteLabel: () => {
      throw new Error(
        "Readonly labels context cannot delete labels. Use persistentLabels instead.",
      );
    },
    getDescendantIds: ({ labelId, userId }) => {
      const labels = persistentLabels
        .getSnapshot()
        .filter((label) => label.userId === userId)
        .map(({ userId: _userId, ...label }) => label);
      const label = labels.find((candidate) => candidate.id === labelId);

      if (label === undefined) {
        throw new AppLabelError("not_found", "Label not found.");
      }

      return collectDescendantIds(labels, label.id);
    },
    getLabelsForUser: (userId) =>
      persistentLabels
        .getSnapshot()
        .filter((label) => label.userId === userId)
        .map(({ userId: _userId, ...label }) => label)
        .sort((left, right) => left.name.localeCompare(right.name)),
    removeParent: () => {
      throw new Error(
        "Readonly labels context cannot remove parents. Use persistentLabels instead.",
      );
    },
    renameLabel: () => {
      throw new Error(
        "Readonly labels context cannot rename labels. Use persistentLabels instead.",
      );
    },
    subscribe: persistentLabels.subscribe,
  };
}

export function createPersistentLabelsContext(
  options: CreatePersistentLabelsContextOptions = {},
): AppPersistentLabelsContext {
  const service = options.service;
  const listeners = new Set<PersistentLabelsListener>();
  let snapshot: readonly StoredLabel[] = [];

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function writeSnapshot(nextSnapshot: readonly StoredLabel[]) {
    snapshot = sortLabels(nextSnapshot);
    notifyListeners();
    return snapshot;
  }

  function requireService(): AppPersistentLabelsService {
    if (service === undefined) {
      throw createMissingServiceError();
    }

    return service;
  }

  function requireUserId(userId: string | null): string {
    if (userId === null) {
      throw createNotAuthenticatedError();
    }

    return userId;
  }

  return {
    async addParent(userId, input) {
      const validatedUserId = requireUserId(userId);
      const updatedLabel = await requireService().addParent(input);

      writeSnapshot([
        toStoredLabel(updatedLabel, validatedUserId),
        ...snapshot.filter((label) => label.id !== updatedLabel.id),
      ]);

      return updatedLabel;
    },
    async createLabel(userId, input) {
      const validatedUserId = requireUserId(userId);
      const createdLabel = await requireService().createLabel(input);

      writeSnapshot([
        toStoredLabel(createdLabel, validatedUserId),
        ...snapshot,
      ]);

      return createdLabel;
    },
    async deleteLabel(userId, labelId) {
      requireUserId(userId);
      await requireService().deleteLabel({
        labelId,
      });

      writeSnapshot(
        snapshot
          .filter((label) => label.id !== labelId)
          .map((label) => ({
            ...label,
            parentIds: label.parentIds.filter(
              (parentId) => parentId !== labelId,
            ),
          })),
      );
    },
    getSnapshot() {
      return snapshot;
    },
    async refresh(userId) {
      if (userId === null) {
        return writeSnapshot([]);
      }

      const labels = await requireService().listLabels();

      return writeSnapshot(labels.map((label) => toStoredLabel(label, userId)));
    },
    async removeParent(userId, input) {
      const validatedUserId = requireUserId(userId);
      const updatedLabel = await requireService().removeParent(input);

      writeSnapshot([
        toStoredLabel(updatedLabel, validatedUserId),
        ...snapshot.filter((label) => label.id !== updatedLabel.id),
      ]);

      return updatedLabel;
    },
    async renameLabel(userId, labelId, name) {
      const validatedUserId = requireUserId(userId);
      const updatedLabel = await requireService().renameLabel({
        labelId,
        name,
      });

      writeSnapshot([
        toStoredLabel(updatedLabel, validatedUserId),
        ...snapshot.filter((label) => label.id !== updatedLabel.id),
      ]);

      return updatedLabel;
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
