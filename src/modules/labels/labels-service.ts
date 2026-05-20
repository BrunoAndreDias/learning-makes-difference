import { eq } from "drizzle-orm";

import type { AppLabel } from "./label-management/labels";
import { AppLabelError } from "./label-management/labels";
import { sortLabelsByName } from "./label-sorting";
import { labelsTable } from "./labels-schema";

type LabelsCrypto = Pick<Crypto, "randomUUID">;
type Awaitable<T> = PromiseLike<T> | T;

type StoredLabelRow = {
  id: string;
  name: string;
};

type LabelsDatabaseRuntime = {
  delete: (table: typeof labelsTable) => {
    where: (condition: unknown) => Awaitable<unknown>;
  };
  insert: (table: typeof labelsTable) => {
    values: (values: {
      createdAt: Date;
      id: string;
      name: string;
      updatedAt: Date;
      userId: string;
    }) => Awaitable<unknown>;
  };
  select: () => {
    from: (table: typeof labelsTable) => {
      where: (condition: unknown) => Awaitable<StoredLabelRow[]>;
    };
  };
  update: (table: typeof labelsTable) => {
    set: (values: { name: string; updatedAt: Date }) => {
      where: (condition: unknown) => Awaitable<unknown>;
    };
  };
};

type CreateLabelsServiceOptions = {
  crypto?: LabelsCrypto;
  db: unknown;
  now?: () => Date;
};

function getDefaultCrypto(): LabelsCrypto {
  return globalThis.crypto;
}

function normalizeLabelName(name: string): string {
  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    throw new AppLabelError("invalid_input", "Label name is required.");
  }

  return trimmedName;
}

async function readOwnedLabels(
  db: LabelsDatabaseRuntime,
  userId: string,
): Promise<AppLabel[]> {
  const storedLabels = await db
    .select()
    .from(labelsTable)
    .where(eq(labelsTable.userId, userId));

  return sortLabelsByName(
    storedLabels.map((label) => ({
      id: label.id,
      name: label.name,
    })),
  );
}

function assertOwnedLabelExists(
  labels: readonly Pick<AppLabel, "id">[],
  labelId: string,
) {
  if (!labels.some((candidate) => candidate.id === labelId)) {
    throw new AppLabelError("not_found", "Label not found.");
  }
}

export function createLabelsService({
  crypto = getDefaultCrypto(),
  db,
  now = () => new Date(),
}: CreateLabelsServiceOptions) {
  const database = db as LabelsDatabaseRuntime;

  return {
    async createLabel(input: { name: string; userId: string }) {
      const timestamp = now();
      const label = {
        id: crypto.randomUUID(),
        name: normalizeLabelName(input.name),
      } satisfies AppLabel;

      await database.insert(labelsTable).values({
        id: label.id,
        userId: input.userId,
        name: label.name,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      return label;
    },
    async deleteLabel(input: { labelId: string; userId: string }) {
      assertOwnedLabelExists(
        await readOwnedLabels(database, input.userId),
        input.labelId,
      );

      await database
        .delete(labelsTable)
        .where(eq(labelsTable.id, input.labelId));
    },
    async listLabels(input: { userId: string }) {
      return readOwnedLabels(database, input.userId);
    },
    async renameLabel(input: {
      labelId: string;
      name: string;
      userId: string;
    }) {
      assertOwnedLabelExists(
        await readOwnedLabels(database, input.userId),
        input.labelId,
      );
      const name = normalizeLabelName(input.name);

      await database
        .update(labelsTable)
        .set({
          name,
          updatedAt: now(),
        })
        .where(eq(labelsTable.id, input.labelId));

      return {
        id: input.labelId,
        name,
      } satisfies AppLabel;
    },
  };
}
