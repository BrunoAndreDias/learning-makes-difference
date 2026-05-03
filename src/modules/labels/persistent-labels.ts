import { collectLabelDescendantIds, sortLabelsByName } from "./label-graph";
import {
  type AppLabel,
  AppLabelError,
  type AppLabelsContext,
} from "./label-management/labels";

type PersistentLabelsListener = () => void;

type CreateLabelInput = {
  name: string;
  parentIds?: string[];
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

function toAppLabel({ userId: _userId, ...label }: StoredLabel): AppLabel {
  return label;
}

function getUserLabels(
  snapshot: readonly StoredLabel[],
  userId: string,
): AppLabel[] {
  return sortLabelsByName(
    snapshot.filter((label) => label.userId === userId).map(toAppLabel),
  );
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
      const labels = getUserLabels(persistentLabels.getSnapshot(), userId);
      const label = labels.find((candidate) => candidate.id === labelId);

      if (label === undefined) {
        throw new AppLabelError("not_found", "Label not found.");
      }

      return collectLabelDescendantIds(labels, label.id);
    },
    getLabelsForUser: (userId) =>
      getUserLabels(persistentLabels.getSnapshot(), userId),
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
    snapshot = sortLabelsByName(nextSnapshot);
    notifyListeners();
    return snapshot;
  }

  function replaceSnapshotLabel(label: AppLabel, userId: string) {
    writeSnapshot([
      toStoredLabel(label, userId),
      ...snapshot.filter((storedLabel) => storedLabel.id !== label.id),
    ]);
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

      replaceSnapshotLabel(updatedLabel, validatedUserId);

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

      replaceSnapshotLabel(updatedLabel, validatedUserId);

      return updatedLabel;
    },
    async renameLabel(userId, labelId, name) {
      const validatedUserId = requireUserId(userId);
      const updatedLabel = await requireService().renameLabel({
        labelId,
        name,
      });

      replaceSnapshotLabel(updatedLabel, validatedUserId);

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
