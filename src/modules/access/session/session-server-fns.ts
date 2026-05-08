import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";
import { z } from "zod";

import type { AppSessionService } from "./session";
import {
  AppAuthError,
  type AppAuthErrorCode,
  type AppSessionSnapshot,
  defaultUserTimeZone,
  fallbackUserLanguage,
  getAppAuthError,
  isUserTimeZonePreference,
  type LoginInput,
  type RegisterInput,
  studyObjectivePreferences,
  type UpdatePreferencesInput,
  userLanguagePreferences,
} from "./session-contract";

const SESSION_COOKIE_NAME = "learning-makes-difference-session";
const userTimeZoneSchema = z.string().refine(isUserTimeZonePreference);

const registerInputSchema = z.object({
  displayName: z.string(),
  email: z.string(),
  password: z.string(),
  pilotRegistrationCode: z.string(),
  userLanguage: z
    .enum(userLanguagePreferences)
    .optional()
    .default(fallbackUserLanguage),
  userTimeZone: userTimeZoneSchema.optional().default(defaultUserTimeZone),
});

const loginInputSchema = z.object({
  email: z.string(),
  password: z.string(),
});

const updatePreferencesInputSchema = z.object({
  displayName: z.string(),
  userLanguage: z.enum(userLanguagePreferences),
  studyObjective: z.enum(studyObjectivePreferences).nullable(),
  userTimeZone: userTimeZoneSchema,
});

type SessionMutationResult =
  | {
      ok: true;
      snapshot: AppSessionSnapshot;
    }
  | {
      error: {
        code: AppAuthErrorCode;
        message: string;
      };
      ok: false;
    };

async function handleSessionMutation(
  operation: () => Promise<AppSessionSnapshot>,
): Promise<SessionMutationResult> {
  try {
    return {
      ok: true,
      snapshot: await operation(),
    };
  } catch (error) {
    const appAuthError = getAppAuthError(error);

    if (appAuthError !== null) {
      return {
        error: {
          code: appAuthError.code,
          message: appAuthError.message,
        },
        ok: false,
      };
    }

    throw error;
  }
}

function unwrapSessionMutation(
  result: SessionMutationResult,
): AppSessionSnapshot {
  if (result.ok) {
    return result.snapshot;
  }

  throw new AppAuthError(result.error.code, result.error.message);
}

async function createRequestAuthService() {
  const [{ createAuthService }, { loadAppEnv }, { getAuthDb }] =
    await Promise.all([
      import("./auth-service"),
      import("../../../lib/env"),
      import("./auth-db.server"),
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

const getSessionSnapshotServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  const auth = await createRequestAuthService();
  return auth.getSessionSnapshot();
});

const registerServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(registerInputSchema)
  .handler(async ({ data }) => {
    const auth = await createRequestAuthService();
    return handleSessionMutation(() => auth.register(data as RegisterInput));
  });

const loginServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(loginInputSchema)
  .handler(async ({ data }) => {
    const auth = await createRequestAuthService();
    return handleSessionMutation(() => auth.login(data as LoginInput));
  });

const logoutServerFn = createServerFn({
  method: "POST",
}).handler(async () => {
  const auth = await createRequestAuthService();
  return auth.logout();
});

const updatePreferencesServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(updatePreferencesInputSchema)
  .handler(async ({ data }) => {
    const auth = await createRequestAuthService();
    return handleSessionMutation(() =>
      auth.updatePreferences(data as UpdatePreferencesInput),
    );
  });

export function createServerSessionService(): AppSessionService {
  return {
    getSessionSnapshot: () => getSessionSnapshotServerFn(),
    login: async (input) =>
      unwrapSessionMutation(await loginServerFn({ data: input })),
    logout: () => logoutServerFn(),
    register: async (input) =>
      unwrapSessionMutation(await registerServerFn({ data: input })),
    updatePreferences: async (input) =>
      unwrapSessionMutation(await updatePreferencesServerFn({ data: input })),
  };
}
