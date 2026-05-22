import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";
import { z } from "zod";
import type { AppPersistentStudyNotesService } from "./persistent-study-notes";
import {
  AppStudyNotesError,
  MAX_STUDY_NOTE_SUPPORT_DESCRIPTIONS_PER_KIND,
} from "./study-notes";

const SESSION_COOKIE_NAME = "learning-makes-difference-session";

const supportDescriptionSchema = z.object({
  description: z.string(),
});

const answerCheckTextReferenceSchema = z.object({
  id: z.string(),
  text: z.string(),
});

const keyIdeaSchema = z.object({
  acceptedPhrases: z.array(z.string()),
  id: z.string(),
  importance: z.enum(["required", "supporting"]),
  prohibitedPhrases: z.array(z.string()),
  text: z.string(),
});

const createStudyNoteInputSchema = z.object({
  acceptedVariants: z.array(answerCheckTextReferenceSchema).optional(),
  acronyms: z
    .array(supportDescriptionSchema)
    .max(MAX_STUDY_NOTE_SUPPORT_DESCRIPTIONS_PER_KIND)
    .optional(),
  expectedAnswer: z.string().optional(),
  keyIdeas: z.array(keyIdeaSchema).optional(),
  labelIds: z.array(z.string()).optional(),
  metaphors: z
    .array(supportDescriptionSchema)
    .max(MAX_STUDY_NOTE_SUPPORT_DESCRIPTIONS_PER_KIND)
    .optional(),
  prompt: z.string().optional(),
  prohibitedPhrases: z.array(answerCheckTextReferenceSchema).optional(),
  sourceBody: z.string(),
  sourceTitle: z.string(),
});

const createStudyNoteFromSourceInputSchema = z.object({
  sourceNoteId: z.string(),
});

const deleteStudyNoteInputSchema = z.object({
  deleteSource: z.boolean(),
  studyNoteId: z.string(),
});

const updateStudyNoteInputSchema = z.object({
  acceptedVariants: z.array(answerCheckTextReferenceSchema),
  acronyms: z
    .array(supportDescriptionSchema)
    .max(MAX_STUDY_NOTE_SUPPORT_DESCRIPTIONS_PER_KIND),
  expectedAnswer: z.string(),
  keyIdeas: z.array(keyIdeaSchema),
  labelIds: z.array(z.string()),
  metaphors: z
    .array(supportDescriptionSchema)
    .max(MAX_STUDY_NOTE_SUPPORT_DESCRIPTIONS_PER_KIND),
  prompt: z.string(),
  prohibitedPhrases: z.array(answerCheckTextReferenceSchema),
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

const createStudyNoteFromSourceServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(createStudyNoteFromSourceInputSchema)
  .handler(async ({ data }) => {
    const [userId, studyNotes] = await Promise.all([
      requireRequestUserId(),
      createRequestStudyNotesService(),
    ]);

    return studyNotes.createStudyNoteFromSource({
      input: data,
      userId,
    });
  });

const deleteStudyNoteServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(deleteStudyNoteInputSchema)
  .handler(async ({ data }) => {
    const [userId, studyNotes] = await Promise.all([
      requireRequestUserId(),
      createRequestStudyNotesService(),
    ]);

    await studyNotes.deleteStudyNote({
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
    createStudyNoteFromSource: (
      input: z.infer<typeof createStudyNoteFromSourceInputSchema>,
    ) => createStudyNoteFromSourceServerFn({ data: input }),
    deleteStudyNote: (input: z.infer<typeof deleteStudyNoteInputSchema>) =>
      deleteStudyNoteServerFn({ data: input }),
    listStudyNotes: () => listStudyNotesServerFn(),
    updateStudyNote: (input: z.infer<typeof updateStudyNoteInputSchema>) =>
      updateStudyNoteServerFn({ data: input }),
  };
}
