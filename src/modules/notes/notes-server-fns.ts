import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";
import { z } from "zod";
import { AppNotesError } from "./notes-workspace/notes";
import type { AppPersistentNotesService } from "./persistent-notes";

const SESSION_COOKIE_NAME = "learning-makes-difference-session";

const memoryHookSchema = z.object({
  description: z.string(),
});

const createNoteInputSchema = z.object({
  acronyms: z.array(memoryHookSchema),
  body: z.string(),
  labelIds: z.array(z.string()),
  metaphors: z.array(memoryHookSchema),
  title: z.string(),
});

const updateNoteInputSchema = createNoteInputSchema.extend({
  noteId: z.string(),
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
    throw new AppNotesError("unauthorized", "A signed-in user is required.");
  }

  return userId;
}

async function createRequestNotesService() {
  const [{ createNotesService }, { getNotesDb }] = await Promise.all([
    import("./notes-service"),
    import("./notes-db.server"),
  ]);

  return createNotesService({
    db: getNotesDb(),
  });
}

const listNotesServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  const userId = await getOptionalRequestUserId();

  if (userId === null) {
    return [];
  }

  const notes = await createRequestNotesService();

  return notes.listNotes({
    userId,
  });
});

const createNoteServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(createNoteInputSchema)
  .handler(async ({ data }) => {
    const [userId, notes] = await Promise.all([
      requireRequestUserId(),
      createRequestNotesService(),
    ]);

    return notes.createNote({
      input: data,
      userId,
    });
  });

const updateNoteServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(updateNoteInputSchema)
  .handler(async ({ data }) => {
    const [userId, notes] = await Promise.all([
      requireRequestUserId(),
      createRequestNotesService(),
    ]);

    return notes.updateNote({
      input: data,
      userId,
    });
  });

const deleteNoteServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      noteId: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const [userId, notes] = await Promise.all([
      requireRequestUserId(),
      createRequestNotesService(),
    ]);

    await notes.deleteNote({
      noteId: data.noteId,
      userId,
    });
  });

export function createServerNotesService(): AppPersistentNotesService {
  return {
    createNote: (input: z.infer<typeof createNoteInputSchema>) =>
      createNoteServerFn({ data: input }),
    deleteNote: (input: { noteId: string }) =>
      deleteNoteServerFn({ data: input }),
    listNotes: () => listNotesServerFn(),
    updateNote: (input: z.infer<typeof updateNoteInputSchema>) =>
      updateNoteServerFn({ data: input }),
  };
}
