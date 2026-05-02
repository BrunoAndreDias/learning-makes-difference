import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";
import { z } from "zod";

import type { AppSessionService } from "./session";
import {
  appLanguagePreferences,
  type LoginInput,
  type RegisterInput,
  type UpdatePreferencesInput,
} from "./session-contract";

const SESSION_COOKIE_NAME = "learning-makes-difference-session";

const registerInputSchema = z.object({
  displayName: z.string(),
  email: z.string(),
  password: z.string(),
  pilotRegistrationCode: z.string(),
});

const loginInputSchema = z.object({
  email: z.string(),
  password: z.string(),
});

const updatePreferencesInputSchema = z.object({
  displayName: z.string(),
  interfaceLanguage: z.enum(appLanguagePreferences),
  studyLanguage: z.enum(appLanguagePreferences),
});

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
    return auth.register(data as RegisterInput);
  });

const loginServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(loginInputSchema)
  .handler(async ({ data }) => {
    const auth = await createRequestAuthService();
    return auth.login(data as LoginInput);
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
    return auth.updatePreferences(data as UpdatePreferencesInput);
  });

export function createServerSessionService(): AppSessionService {
  return {
    getSessionSnapshot: () => getSessionSnapshotServerFn(),
    login: (input) => loginServerFn({ data: input }),
    logout: () => logoutServerFn(),
    register: (input) => registerServerFn({ data: input }),
    updatePreferences: (input) => updatePreferencesServerFn({ data: input }),
  };
}
