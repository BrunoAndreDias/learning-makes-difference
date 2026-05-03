import { and, eq, inArray } from "drizzle-orm";
import { collectLabelDescendantIds, sortLabelsByName } from "./label-graph";
import type { AppLabel } from "./label-management/labels";
import { AppLabelError } from "./label-management/labels";
import { labelEdgesTable, labelsTable } from "./labels-schema";

type LabelsCrypto = Pick<Crypto, "randomUUID">;
type Awaitable<T> = PromiseLike<T> | T;

type LabelsDatabaseRuntime = {
  delete: {
    (
      table: typeof labelEdgesTable,
    ): {
      where: (condition: unknown) => Awaitable<unknown>;
    };
    (
      table: typeof labelsTable,
    ): {
      where: (condition: unknown) => Awaitable<unknown>;
    };
  };
  insert: {
    (
      table: typeof labelEdgesTable,
    ): {
      values: (
        values:
          | {
              childLabelId: string;
              parentLabelId: string;
            }
          | Array<{
              childLabelId: string;
              parentLabelId: string;
            }>,
      ) => Awaitable<unknown>;
    };
    (
      table: typeof labelsTable,
    ): {
      values: (values: {
        createdAt: Date;
        id: string;
        name: string;
        updatedAt: Date;
        userId: string;
      }) => Awaitable<unknown>;
    };
  };
  select: () => {
    from: {
      (
        table: typeof labelEdgesTable,
      ): {
        where: (condition: unknown) => Awaitable<
          Array<{
            childLabelId: string;
            parentLabelId: string;
          }>
        >;
      };
      (
        table: typeof labelsTable,
      ): {
        where: (condition: unknown) => Awaitable<
          Array<{
            id: string;
            name: string;
          }>
        >;
      };
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

function normalizeParentIds(
  parentIds: readonly string[] | undefined,
): string[] {
  return [...new Set(parentIds ?? [])].sort();
}

async function readOwnedLabels(db: LabelsDatabaseRuntime, userId: string) {
  const storedLabels = (await db
    .select()
    .from(labelsTable)
    .where(eq(labelsTable.userId, userId))) as Array<{
    id: string;
    name: string;
  }>;

  if (storedLabels.length === 0) {
    return [];
  }

  const labelIds = storedLabels.map((label) => label.id);
  const storedEdges = (await db
    .select()
    .from(labelEdgesTable)
    .where(inArray(labelEdgesTable.childLabelId, labelIds))) as Array<{
    childLabelId: string;
    parentLabelId: string;
  }>;
  const parentIdsByChildId = new Map<string, string[]>();

  for (const edge of storedEdges) {
    const parentIds = parentIdsByChildId.get(edge.childLabelId) ?? [];
    parentIds.push(edge.parentLabelId);
    parentIdsByChildId.set(edge.childLabelId, parentIds);
  }

  return sortLabelsByName(
    storedLabels.map((label) => ({
      id: label.id,
      name: label.name,
      parentIds: [...(parentIdsByChildId.get(label.id) ?? [])].sort(),
    })),
  );
}

function getOwnedLabel(labels: readonly AppLabel[], labelId: string): AppLabel {
  const label = labels.find((candidate) => candidate.id === labelId);

  if (label === undefined) {
    throw new AppLabelError("not_found", "Label not found.");
  }

  return label;
}

export function createLabelsService({
  crypto = getDefaultCrypto(),
  db,
  now = () => new Date(),
}: CreateLabelsServiceOptions) {
  const database = db as LabelsDatabaseRuntime;

  return {
    async addParent(input: {
      labelId: string;
      parentId: string;
      userId: string;
    }) {
      if (input.labelId === input.parentId) {
        throw new AppLabelError(
          "cycle_detected",
          "A label cannot be its own parent.",
        );
      }

      const labels = await readOwnedLabels(database, input.userId);
      const label = getOwnedLabel(labels, input.labelId);

      getOwnedLabel(labels, input.parentId);

      if (label.parentIds.includes(input.parentId)) {
        return label;
      }

      if (
        collectLabelDescendantIds(labels, input.labelId).includes(
          input.parentId,
        )
      ) {
        throw new AppLabelError(
          "cycle_detected",
          "This relationship would create a cycle.",
        );
      }

      await database.insert(labelEdgesTable).values({
        childLabelId: input.labelId,
        parentLabelId: input.parentId,
      });

      return {
        ...label,
        parentIds: [...label.parentIds, input.parentId].sort(),
      };
    },
    async createLabel(input: {
      name: string;
      parentIds?: string[];
      userId: string;
    }) {
      const id = crypto.randomUUID();
      const parentIds = normalizeParentIds(input.parentIds);

      if (parentIds.includes(id)) {
        throw new AppLabelError(
          "cycle_detected",
          "A label cannot be its own parent.",
        );
      }

      const ownedLabels = await readOwnedLabels(database, input.userId);

      for (const parentId of parentIds) {
        getOwnedLabel(ownedLabels, parentId);
      }

      const timestamp = now();
      const label = {
        id,
        name: normalizeLabelName(input.name),
        parentIds,
      } satisfies AppLabel;

      await database.insert(labelsTable).values({
        id: label.id,
        userId: input.userId,
        name: label.name,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      if (label.parentIds.length > 0) {
        await database.insert(labelEdgesTable).values(
          label.parentIds.map((parentId) => ({
            childLabelId: label.id,
            parentLabelId: parentId,
          })),
        );
      }

      return label;
    },
    async deleteLabel(input: { labelId: string; userId: string }) {
      getOwnedLabel(
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
    async removeParent(input: {
      labelId: string;
      parentId: string;
      userId: string;
    }) {
      const labels = await readOwnedLabels(database, input.userId);
      const label = getOwnedLabel(labels, input.labelId);

      await database
        .delete(labelEdgesTable)
        .where(
          and(
            eq(labelEdgesTable.childLabelId, input.labelId),
            eq(labelEdgesTable.parentLabelId, input.parentId),
          ),
        );

      return {
        ...label,
        parentIds: label.parentIds.filter(
          (parentId) => parentId !== input.parentId,
        ),
      };
    },
    async renameLabel(input: {
      labelId: string;
      name: string;
      userId: string;
    }) {
      getOwnedLabel(
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
        parentIds: getOwnedLabel(
          await readOwnedLabels(database, input.userId),
          input.labelId,
        ).parentIds,
      };
    },
  };
}
