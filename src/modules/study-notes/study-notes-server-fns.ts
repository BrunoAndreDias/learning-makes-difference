import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";
import { z } from "zod";
import type { AppPersistentStudyNotesService } from "./persistent-study-notes";
import { AppStudyNotesError } from "./study-notes";

const SESSION_COOKIE_NAME = "learning-makes-difference-session";

const createStudyNoteInputSchema = z.object({
  sourceBody: z.string(),
  sourceTitle: z.string(),
});

const updateStudyNoteInputSchema = z.object({
  expectedAnswer: z.string(),
  prompt: z.string(),
  sourceBody: z.string(),
  sourceTitle: z.string(),
  studyNoteId: z.string(),
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

  return sessionSnapshot.user?.id ?? null;
}

async function requireRequestUserId(): Promise<string> {
  const userId = await getOptionalRequestUserId();

  if (userId === null) {
    throw new AppStudyNotesError(
      "unauthorized",
      "A signed-in user is required.",
    );
  }

  return userId;
}

async function createRequestStudyNotesService() {
  const [{ createStudyNotesService }, { getNotesDb }] = await Promise.all([
    import("./study-notes-service"),
    import("../notes/notes-db.server"),
  ]);

  return createStudyNotesService({
    db: getNotesDb(),
  });
}

const listStudyNotesServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  const userId = await getOptionalRequestUserId();

  if (userId === null) {
    return [];
  }

  const studyNotes = await createRequestStudyNotesService();

  return studyNotes.listStudyNotes({
    userId,
  });
});

const createStudyNoteServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(createStudyNoteInputSchema)
  .handler(async ({ data }) => {
    const [userId, studyNotes] = await Promise.all([
      requireRequestUserId(),
      createRequestStudyNotesService(),
    ]);

    return studyNotes.createStudyNote({
      input: data,
      userId,
    });
  });

const updateStudyNoteServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(updateStudyNoteInputSchema)
  .handler(async ({ data }) => {
    const [userId, studyNotes] = await Promise.all([
      requireRequestUserId(),
      createRequestStudyNotesService(),
    ]);

    return studyNotes.updateStudyNote({
      input: data,
      userId,
    });
  });

export function createServerStudyNotesService(): AppPersistentStudyNotesService {
  return {
    createStudyNote: (input: z.infer<typeof createStudyNoteInputSchema>) =>
      createStudyNoteServerFn({ data: input }),
    listStudyNotes: () => listStudyNotesServerFn(),
    updateStudyNote: (input: z.infer<typeof updateStudyNoteInputSchema>) =>
      updateStudyNoteServerFn({ data: input }),
  };
}
