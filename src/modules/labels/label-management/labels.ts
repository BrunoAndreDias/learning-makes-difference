import { sortLabelsByName } from "../label-graph";

export type AppLabel = {
  id: string;
  name: string;
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
};

type RenameLabelInput = UserScopedLabelInput & {
  labelId: string;
  name: string;
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
  createLabel: (input: CreateLabelInput) => AppLabel;
  renameLabel: (input: RenameLabelInput) => AppLabel;
  deleteLabel: (input: UserScopedLabelInput & { labelId: string }) => void;
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
        typeof record.userId === "string"
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
  };
}

function normalizeLabelName(name: string): string {
  const trimmedName = name.trim();

  if (trimmedName.length < 1) {
    throw new AppLabelError("invalid_input", "Label name is required.");
  }

  return trimmedName;
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
    createLabel: ({ name, userId }) => {
      const records = readRecords();
      const nextRecord: StoredLabelRecord = {
        id: cryptoProvider.randomUUID(),
        name: normalizeLabelName(name),
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

      writeRecords(
        records.filter(
          (record) => !(record.userId === userId && record.id === labelId),
        ),
      );
      notifyListeners();
    },
  };
}
