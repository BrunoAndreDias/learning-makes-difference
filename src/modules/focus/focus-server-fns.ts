import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";
import { z } from "zod";
import { AppFocusError, type FocusRecord, type FocusSession } from "./focus";
import type { AppPersistentFocusService } from "./persistent-focus";

const SESSION_COOKIE_NAME = "learning-makes-difference-session";

const labelSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const noteSchema = z.object({
  acronyms: z.array(
    z.object({
      description: z.string(),
    }),
  ),
  body: z.string(),
  createdAt: z.string(),
  id: z.string(),
  labelIds: z.array(z.string()),
  metaphors: z.array(
    z.object({
      description: z.string(),
    }),
  ),
  title: z.string(),
  updatedAt: z.string(),
});

const sourceNoteSchema = z.object({
  body: z.string(),
  id: z.string(),
  title: z.string(),
  updatedAt: z.string(),
});

const studyActivityNoteSchema = noteSchema.extend({
  expectedAnswer: z.string().optional(),
  labels: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    )
    .optional(),
  prompt: z.string().optional(),
  source: sourceNoteSchema.optional(),
  sourceNoteId: z.string().optional(),
});

const studyNoteSchema = z.object({
  acronyms: z.array(
    z.object({
      description: z.string(),
    }),
  ),
  createdAt: z.string(),
  expectedAnswer: z.string(),
  id: z.string(),
  labelIds: z.array(z.string()),
  metaphors: z.array(
    z.object({
      description: z.string(),
    }),
  ),
  prompt: z.string(),
  source: sourceNoteSchema,
  sourceNoteId: z.string(),
  updatedAt: z.string(),
});

const startFocusSessionInputSchema = z.object({
  breakIntervalMinutes: z.number().int().min(1).optional(),
  focusIntervalMinutes: z.number().int().min(1).optional(),
  plannedFocusIntervalCount: z.number().int().min(1).nullable().optional(),
});

const captureNoteStudyActivityInputSchema = z.object({
  labels: z.array(labelSchema),
  note: noteSchema,
});

const captureRecallSessionStudyActivityInputSchema = z.object({
  recallSession: z.object({
    createdAt: z.string(),
    id: z.string(),
    mode: z.enum(["AiAssisted", "AiGraded", "FlashCard"]),
    notes: z.array(studyActivityNoteSchema),
  }),
});

const captureStudyNoteStudyActivityInputSchema = z.object({
  labels: z.array(labelSchema),
  studyNote: studyNoteSchema,
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
    throw new AppFocusError("invalid_input", "A signed-in user is required.");
  }

  return userId;
}

async function createRequestFocusService() {
  const [{ createFocusService }, { getFocusDb }] = await Promise.all([
    import("./focus-service"),
    import("./focus-db.server"),
  ]);

  return createFocusService({
    db: getFocusDb(),
  });
}

const getActiveSessionServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  const userId = await getOptionalRequestUserId();

  if (userId === null) {
    return null;
  }

  const focus = await createRequestFocusService();

  return focus.getActiveSession({
    userId,
  });
});

const listFocusRecordsServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  const userId = await getOptionalRequestUserId();

  if (userId === null) {
    return [];
  }

  const focus = await createRequestFocusService();

  return focus.listFocusRecords({
    userId,
  });
});

const startFocusSessionServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(startFocusSessionInputSchema)
  .handler(async ({ data }) => {
    const [userId, focus] = await Promise.all([
      requireRequestUserId(),
      createRequestFocusService(),
    ]);

    return focus.startFocusSession({
      ...data,
      userId,
    });
  });

const startNextFocusIntervalServerFn = createServerFn({
  method: "POST",
}).handler(async () => {
  const [userId, focus] = await Promise.all([
    requireRequestUserId(),
    createRequestFocusService(),
  ]);

  return focus.startNextFocusInterval({
    userId,
  });
});

const endFocusSessionServerFn = createServerFn({
  method: "POST",
}).handler(async () => {
  const [userId, focus] = await Promise.all([
    requireRequestUserId(),
    createRequestFocusService(),
  ]);

  return focus.endFocusSession({
    userId,
  });
});

const captureNoteStudyActivityServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(captureNoteStudyActivityInputSchema)
  .handler(async ({ data }) => {
    const [userId, focus] = await Promise.all([
      requireRequestUserId(),
      createRequestFocusService(),
    ]);

    await focus.captureNoteStudyActivity({
      ...data,
      userId,
    });
  });

const captureRecallSessionStudyActivityServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(captureRecallSessionStudyActivityInputSchema)
  .handler(async ({ data }) => {
    const [userId, focus] = await Promise.all([
      requireRequestUserId(),
      createRequestFocusService(),
    ]);

    await focus.captureRecallSessionStudyActivity({
      ...data,
      userId,
    });
  });

const captureStudyNoteStudyActivityServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(captureStudyNoteStudyActivityInputSchema)
  .handler(async ({ data }) => {
    const [userId, focus] = await Promise.all([
      requireRequestUserId(),
      createRequestFocusService(),
    ]);

    await focus.captureStudyNoteStudyActivity({
      ...data,
      userId,
    });
  });

export function createServerFocusService(): AppPersistentFocusService {
  return {
    captureNoteStudyActivity: (input) =>
      captureNoteStudyActivityServerFn({
        data: {
          labels: input.labels.map((label) => ({ ...label })),
          note: {
            ...input.note,
            acronyms: input.note.acronyms.map((acronym) => ({ ...acronym })),
            labelIds: [...input.note.labelIds],
            metaphors: input.note.metaphors.map((metaphor) => ({
              ...metaphor,
            })),
          },
        },
      }),
    captureRecallSessionStudyActivity: (input) =>
      captureRecallSessionStudyActivityServerFn({
        data: {
          recallSession: {
            ...input.recallSession,
            notes: input.recallSession.notes.map((note) => ({
              ...note,
              acronyms: note.acronyms.map((acronym) => ({ ...acronym })),
              labelIds: [...note.labelIds],
              labels: note.labels?.map((label) => ({ ...label })),
              metaphors: note.metaphors.map((metaphor) => ({ ...metaphor })),
              source:
                note.source === undefined ? undefined : { ...note.source },
            })),
          },
        },
      }),
    captureStudyNoteStudyActivity: (input) =>
      captureStudyNoteStudyActivityServerFn({
        data: {
          labels: input.labels.map((label) => ({ ...label })),
          studyNote: {
            ...input.studyNote,
            acronyms: input.studyNote.acronyms.map((acronym) => ({
              ...acronym,
            })),
            labelIds: [...input.studyNote.labelIds],
            metaphors: input.studyNote.metaphors.map((metaphor) => ({
              ...metaphor,
            })),
            source: { ...input.studyNote.source },
          },
        },
      }),
    endFocusSession: (): Promise<FocusRecord | null> =>
      endFocusSessionServerFn(),
    getActiveSession: (): Promise<FocusSession | null> =>
      getActiveSessionServerFn(),
    listFocusRecords: (): Promise<readonly FocusRecord[]> =>
      listFocusRecordsServerFn(),
    startFocusSession: (input): Promise<FocusSession> =>
      startFocusSessionServerFn({
        data: input,
      }),
    startNextFocusInterval: (): Promise<FocusSession> =>
      startNextFocusIntervalServerFn(),
  };
}
