import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";
import { z } from "zod";

import { type AppLabel, AppLabelError } from "./label-management/labels";
import type { AppPersistentLabelsService } from "./persistent-labels";

const SESSION_COOKIE_NAME = "learning-makes-difference-session";

const createLabelInputSchema = z.object({
  name: z.string(),
  parentIds: z.array(z.string()).optional(),
});

const renameLabelInputSchema = z.object({
  labelId: z.string(),
  name: z.string(),
});

const updateLabelInputSchema = z.object({
  labelId: z.string(),
  name: z.string(),
  parentIds: z.array(z.string()),
});

const labelRelationshipInputSchema = z.object({
  labelId: z.string(),
  parentId: z.string(),
});

async function createRequestAuthService() {
  const [{ createAuthService }, { loadAppEnv }, { getAuthDb }] =
    await Promise.all([
      import("../access/session/auth-service"),
      import("../../lib/env"),
      import("../access/session/auth-db.server"),
    ]);
  const env = loadAppEnv();

  return createAuthService({
    cookie: {
      clear(options) {
        deleteCookie(SESSION_COOKIE_NAME, options);
      },
      get() {
        return getCookie(SESSION_COOKIE_NAME) ?? null;
      },
      set(value, options) {
        setCookie(SESSION_COOKIE_NAME, value, options);
      },
    },
    db: getAuthDb(),
    pilotRegistrationCode: env.PILOT_REGISTRATION_CODE,
    secureCookies: env.APP_ENV === "production",
    sessionSecret: env.SESSION_SECRET,
  });
}

async function getOptionalRequestUserId(): Promise<string | null> {
  const auth = await createRequestAuthService();
  const sessionSnapshot = await auth.getSessionSnapshot();

  if (sessionSnapshot.user !== null) {
    return sessionSnapshot.user.id;
  }

  return null;
}

async function requireRequestUserId(): Promise<string> {
  const userId = await getOptionalRequestUserId();

  if (userId === null) {
    throw new AppLabelError("not_found", "A signed-in user is required.");
  }

  return userId;
}

async function createRequestLabelsService() {
  const [{ createLabelsService }, { getLabelsDb }] = await Promise.all([
    import("./labels-service"),
    import("./labels-db.server"),
  ]);

  return createLabelsService({
    db: getLabelsDb(),
  });
}

const listLabelsServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  const userId = await getOptionalRequestUserId();

  if (userId === null) {
    return [];
  }

  const labels = await createRequestLabelsService();

  return labels.listLabels({
    userId,
  });
});

const createLabelServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(createLabelInputSchema)
  .handler(async ({ data }) => {
    const [userId, labels] = await Promise.all([
      requireRequestUserId(),
      createRequestLabelsService(),
    ]);

    return labels.createLabel({
      name: data.name,
      parentIds: data.parentIds,
      userId,
    });
  });

const renameLabelServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(renameLabelInputSchema)
  .handler(async ({ data }) => {
    const [userId, labels] = await Promise.all([
      requireRequestUserId(),
      createRequestLabelsService(),
    ]);

    return labels.renameLabel({
      labelId: data.labelId,
      name: data.name,
      userId,
    });
  });

const updateLabelServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(updateLabelInputSchema)
  .handler(async ({ data }) => {
    const [userId, labels] = await Promise.all([
      requireRequestUserId(),
      createRequestLabelsService(),
    ]);

    return labels.updateLabel({
      labelId: data.labelId,
      name: data.name,
      parentIds: data.parentIds,
      userId,
    });
  });

const deleteLabelServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      labelId: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const [userId, labels] = await Promise.all([
      requireRequestUserId(),
      createRequestLabelsService(),
    ]);

    await labels.deleteLabel({
      labelId: data.labelId,
      userId,
    });
  });

const addParentServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(labelRelationshipInputSchema)
  .handler(async ({ data }) => {
    const [userId, labels] = await Promise.all([
      requireRequestUserId(),
      createRequestLabelsService(),
    ]);

    return labels.addParent({
      labelId: data.labelId,
      parentId: data.parentId,
      userId,
    });
  });

const removeParentServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(labelRelationshipInputSchema)
  .handler(async ({ data }) => {
    const [userId, labels] = await Promise.all([
      requireRequestUserId(),
      createRequestLabelsService(),
    ]);

    return labels.removeParent({
      labelId: data.labelId,
      parentId: data.parentId,
      userId,
    });
  });

export function createServerLabelsService(): AppPersistentLabelsService {
  return {
    addParent: (
      input: z.infer<typeof labelRelationshipInputSchema>,
    ): Promise<AppLabel> => addParentServerFn({ data: input }),
    createLabel: (
      input: z.infer<typeof createLabelInputSchema>,
    ): Promise<AppLabel> => createLabelServerFn({ data: input }),
    deleteLabel: (input: { labelId: string }) =>
      deleteLabelServerFn({ data: input }),
    listLabels: () => listLabelsServerFn(),
    removeParent: (
      input: z.infer<typeof labelRelationshipInputSchema>,
    ): Promise<AppLabel> => removeParentServerFn({ data: input }),
    renameLabel: (
      input: z.infer<typeof renameLabelInputSchema>,
    ): Promise<AppLabel> => renameLabelServerFn({ data: input }),
    updateLabel: (
      input: z.infer<typeof updateLabelInputSchema>,
    ): Promise<AppLabel> => updateLabelServerFn({ data: input }),
  };
}
