import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";
import { z } from "zod";
import type { AppPersistentRecallService } from "./persistent-recall";
import {
  AppRecallError,
  type RecallSession,
  type SessionResult,
} from "./recall";
import { practiceRepairIntents } from "./recall-practice-repair";
import type { RecallSchedule } from "./recall-schedule";

const SESSION_COOKIE_NAME = "learning-makes-difference-session";

const startFlashCardSessionInputSchema = z.object({
  noteIds: z.array(z.string()).optional(),
  studyNoteIds: z.array(z.string()).optional(),
});

const updateRecallSessionInputSchema = z.object({
  sessionId: z.string(),
});

const answerQuestionInputSchema = updateRecallSessionInputSchema.extend({
  rating: z.enum(["forgot", "hard", "good", "easy"]),
});

const updateAttemptTextInputSchema = updateRecallSessionInputSchema.extend({
  text: z.string(),
});

const confirmPracticeRepairEntryInputSchema = z.object({
  correction: z.string(),
  intent: z.enum(practiceRepairIntents),
  nextPracticeIdea: z.string().optional(),
  reference: z.object({
    questionIndex: z.number().int().nonnegative(),
    questionResultId: z.string().optional(),
    sessionResultId: z.string(),
    studyNoteId: z.string(),
  }),
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
    throw new AppRecallError("not_found", "A signed-in user is required.");
  }

  return userId;
}

async function createRequestRecallService() {
  const [{ createRecallService }, { getRecallDb }] = await Promise.all([
    import("./recall-service"),
    import("./recall-db.server"),
  ]);

  return createRecallService({
    db: getRecallDb(),
  });
}

const getActiveSessionServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  const userId = await getOptionalRequestUserId();

  if (userId === null) {
    return null;
  }

  const recall = await createRequestRecallService();

  return recall.getActiveSession({
    userId,
  });
});

const listSessionResultsServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  const userId = await getOptionalRequestUserId();

  if (userId === null) {
    return [];
  }

  const recall = await createRequestRecallService();

  return recall.listSessionResults({
    userId,
  });
});

const listRecallSchedulesServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  const userId = await getOptionalRequestUserId();

  if (userId === null) {
    return [];
  }

  const recall = await createRequestRecallService();

  return recall.listRecallSchedules({
    userId,
  });
});

const startFlashCardSessionServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(startFlashCardSessionInputSchema)
  .handler(async ({ data }) => {
    const [userId, recall] = await Promise.all([
      requireRequestUserId(),
      createRequestRecallService(),
    ]);

    return recall.startFlashCardSession({
      noteIds: data.noteIds,
      studyNoteIds: data.studyNoteIds,
      userId,
    });
  });

const revealFlashCardAnswerServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(updateRecallSessionInputSchema)
  .handler(async ({ data }) => {
    const [userId, recall] = await Promise.all([
      requireRequestUserId(),
      createRequestRecallService(),
    ]);

    return recall.revealFlashCardAnswer({
      sessionId: data.sessionId,
      userId,
    });
  });

const rateFlashCardAnswerServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(answerQuestionInputSchema)
  .handler(async ({ data }) => {
    const [userId, recall] = await Promise.all([
      requireRequestUserId(),
      createRequestRecallService(),
    ]);

    return recall.rateFlashCardAnswer({
      rating: data.rating,
      sessionId: data.sessionId,
      userId,
    });
  });

const skipFlashCardQuestionServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(updateRecallSessionInputSchema)
  .handler(async ({ data }) => {
    const [userId, recall] = await Promise.all([
      requireRequestUserId(),
      createRequestRecallService(),
    ]);

    return recall.skipFlashCardQuestion({
      sessionId: data.sessionId,
      userId,
    });
  });

const updateFlashCardAttemptTextServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(updateAttemptTextInputSchema)
  .handler(async ({ data }) => {
    const [userId, recall] = await Promise.all([
      requireRequestUserId(),
      createRequestRecallService(),
    ]);

    return recall.updateFlashCardAttemptText({
      sessionId: data.sessionId,
      text: data.text,
      userId,
    });
  });

const endFlashCardSessionServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(updateRecallSessionInputSchema)
  .handler(async ({ data }) => {
    const [userId, recall] = await Promise.all([
      requireRequestUserId(),
      createRequestRecallService(),
    ]);

    return recall.endFlashCardSession({
      sessionId: data.sessionId,
      userId,
    });
  });

const confirmPracticeRepairEntryServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(confirmPracticeRepairEntryInputSchema)
  .handler(async ({ data }) => {
    const [userId, recall] = await Promise.all([
      requireRequestUserId(),
      createRequestRecallService(),
    ]);

    return recall.confirmPracticeRepairEntry({
      correction: data.correction,
      intent: data.intent,
      reference: data.reference,
      userId,
    });
  });

export function createServerRecallService(): AppPersistentRecallService {
  return {
    confirmPracticeRepairEntry: (
      input: z.infer<typeof confirmPracticeRepairEntryInputSchema>,
    ): Promise<SessionResult> =>
      confirmPracticeRepairEntryServerFn({ data: input }),
    endRecallSession: (input): Promise<RecallSession> =>
      endFlashCardSessionServerFn({ data: input }),
    getActiveSession: () => getActiveSessionServerFn(),
    listRecallSchedules: (): Promise<RecallSchedule[]> =>
      listRecallSchedulesServerFn(),
    listSessionResults: (): Promise<SessionResult[]> =>
      listSessionResultsServerFn(),
    rateFlashCardAnswer: (input) =>
      rateFlashCardAnswerServerFn({ data: input }),
    revealFlashCardAnswer: (input): Promise<RecallSession> =>
      revealFlashCardAnswerServerFn({ data: input }),
    skipFlashCardQuestion: (input): Promise<RecallSession | null> =>
      skipFlashCardQuestionServerFn({ data: input }),
    startFlashCardSession: (input): Promise<RecallSession> =>
      startFlashCardSessionServerFn({ data: input }),
    updateFlashCardAttemptText: (input): Promise<RecallSession> =>
      updateFlashCardAttemptTextServerFn({ data: input }),
  };
}
