import { collectLabelDescendantIds, sortLabelsByName } from "../label-graph";

export type AppLabel = {
  id: string;
  name: string;
  parentIds: string[];
};

type StoredLabelRecord = AppLabel & {
  userId: string;
};

type LabelStorageAdapter = Pick<Storage, "getItem" | "removeItem" | "setItem">;

type LabelCrypto = Pick<Crypto, "randomUUID">;

type CreateAppLabelsContextOptions = {
  crypto?: LabelCrypto;
  keyPrefix?: string;
  storage?: LabelStorageAdapter;
};

type LabelListener = () => void;

type UserScopedLabelInput = {
  userId: string;
};

type CreateLabelInput = UserScopedLabelInput & {
  name: string;
  parentIds?: string[];
};

type UpdateLabelInput = UserScopedLabelInput & {
  labelId: string;
  name: string;
};

type LabelRelationshipInput = UserScopedLabelInput & {
  labelId: string;
  parentId: string;
};

export class AppLabelError extends Error {
  readonly code: "cycle_detected" | "invalid_input" | "not_found";

  constructor(
    code: "cycle_detected" | "invalid_input" | "not_found",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

export type AppLabelsContext = {
  subscribe: (listener: LabelListener) => () => void;
  getLabelsForUser: (userId: string) => AppLabel[];
  getDescendantIds: (
    input: UserScopedLabelInput & { labelId: string },
  ) => string[];
  createLabel: (input: CreateLabelInput) => AppLabel;
  renameLabel: (input: UpdateLabelInput) => AppLabel;
  deleteLabel: (input: UserScopedLabelInput & { labelId: string }) => void;
  addParent: (input: LabelRelationshipInput) => AppLabel;
  removeParent: (input: LabelRelationshipInput) => AppLabel;
};

const DEFAULT_STORAGE_KEY_PREFIX = "learning-makes-difference-labels";

function getDefaultStorage(): LabelStorageAdapter | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

function getDefaultCrypto(): LabelCrypto {
  return globalThis.crypto;
}

function getLabelsStorageKey(prefix: string): string {
  return `${prefix}:records`;
}

function parseStoredLabels(value: string | null): StoredLabelRecord[] {
  if (value === null) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter((record): record is StoredLabelRecord => {
      return (
        typeof record === "object" &&
        record !== null &&
        typeof record.id === "string" &&
        typeof record.name === "string" &&
        typeof record.userId === "string" &&
        Array.isArray(record.parentIds) &&
        record.parentIds.every(
          (parentId: unknown) => typeof parentId === "string",
        )
      );
    });
  } catch {
    return [];
  }
}

function toAppLabel(record: StoredLabelRecord): AppLabel {
  return {
    id: record.id,
    name: record.name,
    parentIds: [...record.parentIds],
  };
}

function normalizeLabelName(name: string): string {
  const trimmedName = name.trim();

  if (trimmedName.length < 1) {
    throw new AppLabelError("invalid_input", "Label name is required.");
  }

  return trimmedName;
}

function normalizeParentIds(
  parentIds: readonly string[] | undefined,
): string[] {
  return [...new Set(parentIds ?? [])].sort();
}

function getOwnedLabelIndex(
  records: StoredLabelRecord[],
  userId: string,
  labelId: string,
): number {
  return records.findIndex(
    (record) => record.userId === userId && record.id === labelId,
  );
}

function getOwnedLabelEntry(
  records: StoredLabelRecord[],
  userId: string,
  labelId: string,
): {
  index: number;
  record: StoredLabelRecord;
} {
  const index = getOwnedLabelIndex(records, userId, labelId);

  if (index === -1) {
    throw new AppLabelError("not_found", "Label not found.");
  }

  return {
    index,
    record: records[index],
  };
}

export function createAppLabelsContext(
  options: CreateAppLabelsContextOptions = {},
): AppLabelsContext {
  const storage = options.storage ?? getDefaultStorage();
  const cryptoProvider = options.crypto ?? getDefaultCrypto();
  const keyPrefix = options.keyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX;
  const listeners = new Set<LabelListener>();

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function readRecords(): StoredLabelRecord[] {
    return parseStoredLabels(
      storage?.getItem(getLabelsStorageKey(keyPrefix)) ?? null,
    );
  }

  function writeRecords(records: StoredLabelRecord[]) {
    storage?.setItem(getLabelsStorageKey(keyPrefix), JSON.stringify(records));
  }

  function getOwnedLabelRecord(
    records: StoredLabelRecord[],
    userId: string,
    labelId: string,
  ): StoredLabelRecord {
    return getOwnedLabelEntry(records, userId, labelId).record;
  }

  return {
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    getLabelsForUser: (userId) => {
      return sortLabelsByName(
        readRecords()
          .filter((record) => record.userId === userId)
          .map(toAppLabel),
      );
    },
    getDescendantIds: ({ labelId, userId }) => {
      const records = readRecords().filter(
        (record) => record.userId === userId,
      );

      getOwnedLabelRecord(records, userId, labelId);

      return collectLabelDescendantIds(records, labelId);
    },
    createLabel: ({ name, parentIds, userId }) => {
      const records = readRecords();
      const id = cryptoProvider.randomUUID();
      const normalizedParentIds = normalizeParentIds(parentIds);

      if (normalizedParentIds.includes(id)) {
        throw new AppLabelError(
          "cycle_detected",
          "A label cannot be its own parent.",
        );
      }

      for (const parentId of normalizedParentIds) {
        getOwnedLabelRecord(records, userId, parentId);
      }

      const nextRecord: StoredLabelRecord = {
        id,
        name: normalizeLabelName(name),
        parentIds: normalizedParentIds,
        userId,
      };

      writeRecords([...records, nextRecord]);
      notifyListeners();

      return toAppLabel(nextRecord);
    },
    renameLabel: ({ labelId, name, userId }) => {
      const records = readRecords();
      const { index: labelIndex, record: label } = getOwnedLabelEntry(
        records,
        userId,
        labelId,
      );

      const nextRecord = {
        ...label,
        name: normalizeLabelName(name),
      };

      records[labelIndex] = nextRecord;
      writeRecords(records);
      notifyListeners();

      return toAppLabel(nextRecord);
    },
    deleteLabel: ({ labelId, userId }) => {
      const records = readRecords();

      getOwnedLabelEntry(records, userId, labelId);

      const nextRecords = records
        .filter(
          (record) => !(record.userId === userId && record.id === labelId),
        )
        .map((record) => {
          if (record.userId !== userId || !record.parentIds.includes(labelId)) {
            return record;
          }

          return {
            ...record,
            parentIds: record.parentIds.filter(
              (parentId) => parentId !== labelId,
            ),
          };
        });

      writeRecords(nextRecords);
      notifyListeners();
    },
    addParent: ({ labelId, parentId, userId }) => {
      if (labelId === parentId) {
        throw new AppLabelError(
          "cycle_detected",
          "A label cannot be its own parent.",
        );
      }

      const records = readRecords();
      const { index: labelIndex, record: label } = getOwnedLabelEntry(
        records,
        userId,
        labelId,
      );

      getOwnedLabelRecord(records, userId, parentId);

      if (label.parentIds.includes(parentId)) {
        return toAppLabel(label);
      }

      if (collectLabelDescendantIds(records, labelId).includes(parentId)) {
        throw new AppLabelError(
          "cycle_detected",
          "This relationship would create a cycle.",
        );
      }

      const nextRecord = {
        ...label,
        parentIds: [...label.parentIds, parentId].sort(),
      };

      records[labelIndex] = nextRecord;
      writeRecords(records);
      notifyListeners();

      return toAppLabel(nextRecord);
    },
    removeParent: ({ labelId, parentId, userId }) => {
      const records = readRecords();
      const { index: labelIndex, record: label } = getOwnedLabelEntry(
        records,
        userId,
        labelId,
      );

      const nextRecord = {
        ...label,
        parentIds: label.parentIds.filter(
          (candidateId) => candidateId !== parentId,
        ),
      };

      records[labelIndex] = nextRecord;
      writeRecords(records);
      notifyListeners();

      return toAppLabel(nextRecord);
    },
  };
}
