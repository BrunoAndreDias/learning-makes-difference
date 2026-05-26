import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "../../lib/db/migrate";
import {
  closePostgresIntegrationDatabases,
  createPostgresIntegrationDatabase,
  type PostgresIntegrationDatabase,
} from "../../lib/db/postgres-integration-test-db";
import { authSchema, usersTable } from "../access/session/auth-schema";
import {
  labelsSchema,
  labelsTable,
  noteLabelsTable,
  studyNoteLabelsTable,
} from "../labels/labels-schema";
import {
  noteAcronymsTable,
  noteMetaphorsTable,
  notesSchema,
  notesTable,
} from "../notes/notes-schema";
import {
  studyNoteAcronymsTable,
  studyNoteMetaphorsTable,
  studyNotesSchema,
  studyNotesTable,
} from "../study-notes/study-notes-schema";
import { recallSchema } from "./recall-schema";
import { createRecallService } from "./recall-service";
import {
  createInitialRecallSchedule,
  getUpdatedRecallSchedule,
} from "./recall-schedule";

describe("createRecallService PostgreSQL integration", () => {
  const databases = new Set<PostgresIntegrationDatabase>();

  afterEach(async () => {
    await closePostgresIntegrationDatabases(databases);
  });

  it("persists one active session and preserves result snapshots across service reloads", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    const db = drizzle(database.client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
        ...notesSchema,
        ...recallSchema,
        ...studyNotesSchema,
      },
    });
    await migrateDatabase(db, database.client);
    await db.insert(usersTable).values({
      id: "user-casey",
      displayName: "Casey Learner",
      email: "casey@example.com",
      passwordHash: "hash",
      userLanguage: "en",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(labelsTable).values({
      id: "label-science",
      userId: "user-casey",
      name: "Science",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(notesTable).values([
      {
        id: "note-1",
        userId: "user-casey",
        title: "Stored title",
        body: "Stored body",
        labelIds: ["label-science"],
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
      {
        id: "note-2",
        userId: "user-casey",
        title: "Replacement title",
        body: "Replacement body",
        labelIds: [],
        createdAt: new Date("2026-05-02T12:05:00.000Z"),
        updatedAt: new Date("2026-05-02T12:05:00.000Z"),
      },
    ]);
    await db.insert(noteLabelsTable).values({
      noteId: "note-1",
      labelId: "label-science",
    });
    await db.insert(noteMetaphorsTable).values({
      noteId: "note-1",
      description: "Orbit metaphor",
    });
    await db.insert(noteAcronymsTable).values({
      noteId: "note-1",
      description: "S.T.O.R.E.D.",
    });

    let sessionCounter = 0;
    const service = createRecallService({
      crypto: {
        randomUUID: () =>
          `session-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      db,
      shuffleNotes: (notes) => [...notes],
    });

    const firstSession = await service.startFlashCardSession({
      noteIds: ["note-1"],
      userId: "user-casey",
    });

    await expect(
      service.getActiveSession({
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      id: firstSession.id,
      notes: [
        {
          acronyms: [{ description: "S.T.O.R.E.D." }],
          body: "Stored body",
          labels: [{ id: "label-science", name: "Science" }],
          metaphors: [{ description: "Orbit metaphor" }],
          title: "Stored title",
        },
      ],
    });

    await db
      .update(notesTable)
      .set({
        title: "Edited title",
        body: "Edited body",
        updatedAt: new Date("2026-05-02T12:20:00.000Z"),
      })
      .where(eq(notesTable.id, "note-1"));
    await db
      .delete(noteLabelsTable)
      .where(eq(noteLabelsTable.noteId, "note-1"));
    await db
      .update(labelsTable)
      .set({
        name: "Edited science",
        updatedAt: new Date("2026-05-02T12:21:00.000Z"),
      })
      .where(eq(labelsTable.id, "label-science"));

    await expect(
      service.getActiveSession({
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      id: firstSession.id,
      notes: [
        {
          body: "Stored body",
          labels: [{ id: "label-science", name: "Science" }],
          title: "Stored title",
        },
      ],
    });

    const replacementSession = await service.startFlashCardSession({
      noteIds: ["note-2"],
      userId: "user-casey",
    });

    expect(replacementSession.id).toBe("session-2");
    await expect(
      service.getActiveSession({
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      id: "session-2",
      notes: [{ id: "note-2", title: "Replacement title" }],
    });

    await service.endFlashCardSession({
      sessionId: "session-2",
      userId: "user-casey",
    });
    await expect(
      service.listSessionResults({
        userId: "user-casey",
      }),
    ).resolves.toEqual([]);

    const attemptedSession = await service.startFlashCardSession({
      noteIds: ["note-1"],
      userId: "user-casey",
    });
    await service.updateFlashCardAttemptText({
      sessionId: attemptedSession.id,
      text: "Casey typed this.",
      userId: "user-casey",
    });
    await service.revealFlashCardAnswer({
      sessionId: attemptedSession.id,
      userId: "user-casey",
    });
    await expect(
      service.rateFlashCardAnswer({
        rating: "hard",
        sessionId: attemptedSession.id,
        userId: "user-casey",
      }),
    ).resolves.toBeNull();

    const reloadedService = createRecallService({
      db,
      shuffleNotes: (notes) => [...notes],
    });

    await expect(
      reloadedService.getActiveSession({
        userId: "user-casey",
      }),
    ).resolves.toBeNull();
    await expect(
      reloadedService.listSessionResults({
        userId: "user-casey",
      }),
    ).resolves.toMatchObject([
      {
        attempts: [
          {
            noteId: "note-1",
            rating: "hard",
            text: "Casey typed this.",
          },
        ],
        id: "session-3",
        notes: [
          {
            acronyms: [{ description: "S.T.O.R.E.D." }],
            body: "Edited body",
            labels: [],
            metaphors: [{ description: "Orbit metaphor" }],
            title: "Edited title",
          },
        ],
        questions: [
          {
            noteId: "note-1",
            selfRating: "hard",
            typedAnswer: "Casey typed this.",
          },
        ],
      },
    ]);
  });

  it("starts persistent FlashCard sessions from Study Note IDs with source snapshots", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    const db = drizzle(database.client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
        ...notesSchema,
        ...recallSchema,
        ...studyNotesSchema,
      },
    });
    await migrateDatabase(db, database.client);
    await db.insert(usersTable).values({
      id: "user-casey",
      displayName: "Casey Learner",
      email: "casey@example.com",
      passwordHash: "hash",
      userLanguage: "en",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(labelsTable).values({
      id: "label-biology",
      userId: "user-casey",
      name: "Biology",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(notesTable).values({
      id: "source-note-1",
      userId: "user-casey",
      title: "Cell respiration source",
      body: "",
      labelIds: [],
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(studyNotesTable).values({
      id: "study-note-1",
      sourceNoteId: "source-note-1",
      prompt: "What stores transferable energy?",
      expectedAnswer: "ATP stores transferable energy.",
      createdAt: new Date("2026-05-02T12:05:00.000Z"),
      updatedAt: new Date("2026-05-02T12:05:00.000Z"),
    });
    await db.insert(studyNoteLabelsTable).values({
      studyNoteId: "study-note-1",
      labelId: "label-biology",
    });
    await db.insert(studyNoteMetaphorsTable).values({
      studyNoteId: "study-note-1",
      description: "ATP is a rechargeable battery.",
    });
    await db.insert(studyNoteAcronymsTable).values({
      studyNoteId: "study-note-1",
      description: "ATP",
    });

    const service = createRecallService({
      crypto: {
        randomUUID: () =>
          "session-study-note-db" as `${string}-${string}-${string}-${string}-${string}`,
      },
      db,
      shuffleNotes: (notes) => [...notes],
    });

    await expect(
      service.startFlashCardSession({
        studyNoteIds: ["study-note-1"],
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      id: "session-study-note-db",
      notes: [
        {
          body: "ATP stores transferable energy.",
          expectedAnswer: "ATP stores transferable energy.",
          id: "study-note-1",
          labels: [{ id: "label-biology", name: "Biology" }],
          prompt: "What stores transferable energy?",
          source: {
            body: "",
            id: "source-note-1",
            title: "Cell respiration source",
          },
          title: "What stores transferable energy?",
        },
      ],
    });
  });

  it("persists active-session-only FlashCard mutations across service reloads", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    const db = drizzle(database.client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
        ...notesSchema,
        ...recallSchema,
        ...studyNotesSchema,
      },
    });
    await migrateDatabase(db, database.client);
    await db.insert(usersTable).values({
      id: "user-casey",
      displayName: "Casey Learner",
      email: "casey@example.com",
      passwordHash: "hash",
      userLanguage: "en",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(notesTable).values({
      id: "note-active-only",
      userId: "user-casey",
      title: "Stored title",
      body: "Stored body",
      labelIds: [],
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });

    const service = createRecallService({
      crypto: {
        randomUUID: () =>
          "session-active-only" as `${string}-${string}-${string}-${string}-${string}`,
      },
      db,
      shuffleNotes: (notes) => [...notes],
    });

    await service.startFlashCardSession({
      noteIds: ["note-active-only"],
      userId: "user-casey",
    });
    await service.updateFlashCardAttemptText({
      sessionId: "session-active-only",
      text: "Casey is drafting an answer.",
      userId: "user-casey",
    });
    await service.revealFlashCardAnswer({
      sessionId: "session-active-only",
      userId: "user-casey",
    });

    const reloadedService = createRecallService({
      db,
      shuffleNotes: (notes) => [...notes],
    });

    await expect(
      reloadedService.getActiveSession({
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      draftAnswer: "Casey is drafting an answer.",
      id: "session-active-only",
      isAnswerRevealed: true,
      questions: [
        {
          isAnswerRevealed: true,
          noteId: "note-active-only",
          typedAnswer: "Casey is drafting an answer.",
        },
      ],
    });
    await expect(
      reloadedService.listSessionResults({
        userId: "user-casey",
      }),
    ).resolves.toEqual([]);
  });

  it("persists confirmed Practice Repair entries on weak Study Note results across service reloads", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    const db = drizzle(database.client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
        ...notesSchema,
        ...recallSchema,
        ...studyNotesSchema,
      },
    });
    await migrateDatabase(db, database.client);
    await db.insert(usersTable).values({
      id: "user-casey",
      displayName: "Casey Learner",
      email: "casey@example.com",
      passwordHash: "hash",
      userLanguage: "en",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(notesTable).values({
      id: "source-note-practice-repair",
      userId: "user-casey",
      title: "Cell respiration source",
      body: "ATP helps transfer energy in cells.",
      labelIds: [],
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(studyNotesTable).values({
      id: "study-note-practice-repair",
      sourceNoteId: "source-note-practice-repair",
      prompt: "What stores transferable energy?",
      expectedAnswer: "ATP stores transferable energy.",
      createdAt: new Date("2026-05-02T12:05:00.000Z"),
      updatedAt: new Date("2026-05-02T12:05:00.000Z"),
    });

    const service = createRecallService({
      crypto: {
        randomUUID: () =>
          "session-practice-repair" as `${string}-${string}-${string}-${string}-${string}`,
      },
      db,
      shuffleNotes: (notes) => [...notes],
    });

    await service.startFlashCardSession({
      studyNoteIds: ["study-note-practice-repair"],
      userId: "user-casey",
    });
    await service.revealFlashCardAnswer({
      sessionId: "session-practice-repair",
      userId: "user-casey",
    });
    await expect(
      service.rateFlashCardAnswer({
        rating: "hard",
        sessionId: "session-practice-repair",
        userId: "user-casey",
      }),
    ).resolves.toBeNull();
    await expect(
      service.confirmPracticeRepairEntry({
        correction: "State ATP and explain that it stores transferable energy.",
        intent: "tighten-expected-answer",
        reference: {
          questionIndex: 0,
          questionResultId: "session-practice-repair-question-0",
          sessionResultId: "session-practice-repair",
          studyNoteId: "study-note-practice-repair",
        },
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      id: "session-practice-repair",
      questions: [
        {
          noteId: "study-note-practice-repair",
          practiceRepairEntry: {
            correction:
              "State ATP and explain that it stores transferable energy.",
            intent: "tighten-expected-answer",
            intentMetadata: {
              updatedExpectedAnswer: null,
            },
            practiceRepairEntryId:
              "practice-repair-entry-session-practice-repair-question-0",
            reference: {
              questionResultId: "session-practice-repair-question-0",
              sessionResultId: "session-practice-repair",
              studyNoteId: "study-note-practice-repair",
            },
          },
          selfRating: "hard",
        },
      ],
    });

    const reloadedService = createRecallService({
      db,
      shuffleNotes: (notes) => [...notes],
    });

    await expect(
      reloadedService.listSessionResults({
        userId: "user-casey",
      }),
    ).resolves.toMatchObject([
      {
        id: "session-practice-repair",
        questions: [
          {
            noteId: "study-note-practice-repair",
            practiceRepairEntry: {
              correction:
                "State ATP and explain that it stores transferable energy.",
              intent: "tighten-expected-answer",
              intentMetadata: {
                updatedExpectedAnswer: null,
              },
              practiceRepairEntryId:
                "practice-repair-entry-session-practice-repair-question-0",
              reference: {
                questionResultId: "session-practice-repair-question-0",
              },
            },
            selfRating: "hard",
          },
        ],
      },
    ]);
  });

  it("persists session-ending FlashCard mutations across service reloads", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    const db = drizzle(database.client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
        ...notesSchema,
        ...recallSchema,
        ...studyNotesSchema,
      },
    });
    await migrateDatabase(db, database.client);
    await db.insert(usersTable).values({
      id: "user-casey",
      displayName: "Casey Learner",
      email: "casey@example.com",
      passwordHash: "hash",
      userLanguage: "en",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(notesTable).values([
      {
        id: "note-ending-1",
        userId: "user-casey",
        title: "First note",
        body: "First body",
        labelIds: [],
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
      {
        id: "note-ending-2",
        userId: "user-casey",
        title: "Second note",
        body: "Second body",
        labelIds: [],
        createdAt: new Date("2026-05-02T12:05:00.000Z"),
        updatedAt: new Date("2026-05-02T12:05:00.000Z"),
      },
    ]);

    let sessionCounter = 0;
    const service = createRecallService({
      crypto: {
        randomUUID: () =>
          `session-ending-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      db,
      shuffleNotes: (notes) => [...notes],
    });

    await service.startFlashCardSession({
      noteIds: ["note-ending-1", "note-ending-2"],
      userId: "user-casey",
    });
    await service.revealFlashCardAnswer({
      sessionId: "session-ending-1",
      userId: "user-casey",
    });
    await expect(
      service.rateFlashCardAnswer({
        rating: "hard",
        sessionId: "session-ending-1",
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      currentQuestionIndex: 1,
      id: "session-ending-1",
    });
    await service.endFlashCardSession({
      sessionId: "session-ending-1",
      userId: "user-casey",
    });

    await service.startFlashCardSession({
      noteIds: ["note-ending-1", "note-ending-2"],
      userId: "user-casey",
    });
    await service.revealFlashCardAnswer({
      sessionId: "session-ending-2",
      userId: "user-casey",
    });
    await expect(
      service.rateFlashCardAnswer({
        rating: "good",
        sessionId: "session-ending-2",
        userId: "user-casey",
      }),
    ).resolves.toMatchObject({
      currentQuestionIndex: 1,
      id: "session-ending-2",
    });
    await expect(
      service.skipFlashCardQuestion({
        sessionId: "session-ending-2",
        userId: "user-casey",
      }),
    ).resolves.toBeNull();

    const reloadedService = createRecallService({
      db,
      shuffleNotes: (notes) => [...notes],
    });
    const reloadedResults = await reloadedService.listSessionResults({
      userId: "user-casey",
    });
    const endedEarlyResult = reloadedResults.find(
      (result) => result.id === "session-ending-1",
    );
    const terminalSkipResult = reloadedResults.find(
      (result) => result.id === "session-ending-2",
    );

    expect(endedEarlyResult).toMatchObject({
      attempts: [
        {
          noteId: "note-ending-1",
          rating: "hard",
        },
      ],
      id: "session-ending-1",
    });
    expect(terminalSkipResult).toMatchObject({
      attempts: [
        {
          noteId: "note-ending-1",
          rating: "good",
        },
      ],
      id: "session-ending-2",
    });
    await expect(
      reloadedService.getActiveSession({
        userId: "user-casey",
      }),
    ).resolves.toBeNull();
  });

  it("persists later recall satisfaction for completed Practice Follow-ups across service reloads", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    const db = drizzle(database.client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
        ...notesSchema,
        ...recallSchema,
        ...studyNotesSchema,
      },
    });
    await migrateDatabase(db, database.client);
    await db.insert(usersTable).values({
      id: "user-casey",
      displayName: "Casey Learner",
      email: "casey@example.com",
      passwordHash: "hash",
      userLanguage: "en",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(notesTable).values({
      id: "source-note-practice-follow-up",
      userId: "user-casey",
      title: "Cell respiration source",
      body: "ATP helps transfer energy in cells.",
      labelIds: [],
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(studyNotesTable).values({
      id: "study-note-practice-follow-up",
      sourceNoteId: "source-note-practice-follow-up",
      prompt: "What stores transferable energy?",
      expectedAnswer: "ATP stores transferable energy.",
      createdAt: new Date("2026-05-02T12:05:00.000Z"),
      updatedAt: new Date("2026-05-02T12:05:00.000Z"),
    });

    let sessionCounter = 0;
    const service = createRecallService({
      crypto: {
        randomUUID: () =>
          `practice-follow-up-session-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      db,
      shuffleNotes: (notes) => [...notes],
    });

    await service.startFlashCardSession({
      studyNoteIds: ["study-note-practice-follow-up"],
      userId: "user-casey",
    });
    await service.revealFlashCardAnswer({
      sessionId: "practice-follow-up-session-1",
      userId: "user-casey",
    });
    await expect(
      service.rateFlashCardAnswer({
        rating: "hard",
        sessionId: "practice-follow-up-session-1",
        userId: "user-casey",
      }),
    ).resolves.toBeNull();
    await service.confirmPracticeRepairEntry({
      correction: "State ATP and explain that it stores transferable energy.",
      intent: "tighten-expected-answer",
      reference: {
        questionIndex: 0,
        questionResultId: "practice-follow-up-session-1-question-0",
        sessionResultId: "practice-follow-up-session-1",
        studyNoteId: "study-note-practice-follow-up",
      },
      userId: "user-casey",
    });
    await service.completePracticeRepairEntry({
      reference: {
        questionIndex: 0,
        questionResultId: "practice-follow-up-session-1-question-0",
        sessionResultId: "practice-follow-up-session-1",
        studyNoteId: "study-note-practice-follow-up",
      },
      userId: "user-casey",
    });

    await service.startFlashCardSession({
      studyNoteIds: ["study-note-practice-follow-up"],
      userId: "user-casey",
    });
    await service.revealFlashCardAnswer({
      sessionId: "practice-follow-up-session-2",
      userId: "user-casey",
    });
    await expect(
      service.rateFlashCardAnswer({
        rating: "good",
        sessionId: "practice-follow-up-session-2",
        userId: "user-casey",
      }),
    ).resolves.toBeNull();

    const reloadedService = createRecallService({
      db,
      shuffleNotes: (notes) => [...notes],
    });
    const reloadedResults = await reloadedService.listSessionResults({
      userId: "user-casey",
    });
    const originalResult = reloadedResults.find(
      (result) => result.id === "practice-follow-up-session-1",
    );

    expect(originalResult).toMatchObject({
      id: "practice-follow-up-session-1",
      questions: [
        {
          noteId: "study-note-practice-follow-up",
          practiceRepairEntry: {
            followUpSatisfaction: {
              questionReference: {
                questionIndex: 0,
                questionResultId: "practice-follow-up-session-2-question-0",
                sessionResultId: "practice-follow-up-session-2",
                studyNoteId: "study-note-practice-follow-up",
              },
              rating: "good",
              satisfiedAt: expect.any(String),
            },
            lifecycle: {
              completedAt: expect.any(String),
              followUpSatisfiedAt: expect.any(String),
            },
          },
        },
      ],
    });
  });

  it("rejects persistent FlashCard sessions from incomplete Study Note IDs", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    const db = drizzle(database.client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
        ...notesSchema,
        ...recallSchema,
        ...studyNotesSchema,
      },
    });
    await migrateDatabase(db, database.client);
    await db.insert(usersTable).values({
      id: "user-casey",
      displayName: "Casey Learner",
      email: "casey@example.com",
      passwordHash: "hash",
      userLanguage: "en",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(notesTable).values({
      id: "source-note-incomplete",
      userId: "user-casey",
      title: "",
      body: "Draft source context.",
      labelIds: [],
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(studyNotesTable).values({
      id: "study-note-incomplete",
      sourceNoteId: "source-note-incomplete",
      prompt: "What still needs an expected answer?",
      expectedAnswer: "",
      createdAt: new Date("2026-05-02T12:05:00.000Z"),
      updatedAt: new Date("2026-05-02T12:05:00.000Z"),
    });

    const service = createRecallService({
      db,
      shuffleNotes: (notes) => [...notes],
    });

    await expect(
      service.startFlashCardSession({
        studyNoteIds: ["study-note-incomplete"],
        userId: "user-casey",
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "Add expected answer before recall.",
    });
    await expect(
      service.getActiveSession({
        userId: "user-casey",
      }),
    ).resolves.toBeNull();
  });

  it("persists Practice Repair result mutations across service reloads", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    const db = drizzle(database.client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
        ...notesSchema,
        ...recallSchema,
        ...studyNotesSchema,
      },
    });
    await migrateDatabase(db, database.client);
    await db.insert(usersTable).values({
      id: "user-casey",
      displayName: "Casey Learner",
      email: "casey@example.com",
      passwordHash: "hash",
      userLanguage: "en",
      createdAt: new Date("2026-05-02T12:00:00.000Z"),
      updatedAt: new Date("2026-05-02T12:00:00.000Z"),
    });
    await db.insert(notesTable).values([
      {
        id: "source-note-complete",
        userId: "user-casey",
        title: "Complete source",
        body: "Complete body",
        labelIds: [],
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        updatedAt: new Date("2026-05-02T12:00:00.000Z"),
      },
      {
        id: "source-note-dismiss",
        userId: "user-casey",
        title: "Dismiss source",
        body: "Dismiss body",
        labelIds: [],
        createdAt: new Date("2026-05-02T12:05:00.000Z"),
        updatedAt: new Date("2026-05-02T12:05:00.000Z"),
      },
      {
        id: "source-note-linked",
        userId: "user-casey",
        title: "Linked source",
        body: "Linked body",
        labelIds: [],
        createdAt: new Date("2026-05-02T12:10:00.000Z"),
        updatedAt: new Date("2026-05-02T12:10:00.000Z"),
      },
    ]);
    await db.insert(studyNotesTable).values([
      {
        id: "study-note-complete",
        sourceNoteId: "source-note-complete",
        prompt: "What completes the repair?",
        expectedAnswer: "The repair is completed by saving the improved answer.",
        createdAt: new Date("2026-05-02T12:01:00.000Z"),
        updatedAt: new Date("2026-05-02T12:01:00.000Z"),
      },
      {
        id: "study-note-dismiss",
        sourceNoteId: "source-note-dismiss",
        prompt: "What can be dismissed?",
        expectedAnswer: "An unnecessary Practice Repair entry.",
        createdAt: new Date("2026-05-02T12:06:00.000Z"),
        updatedAt: new Date("2026-05-02T12:06:00.000Z"),
      },
      {
        id: "study-note-linked",
        sourceNoteId: "source-note-linked",
        prompt: "What uses linked completion?",
        expectedAnswer: "A linked completion records the saved repair details.",
        createdAt: new Date("2026-05-02T12:11:00.000Z"),
        updatedAt: new Date("2026-05-02T12:11:00.000Z"),
      },
    ]);

    let sessionCounter = 0;
    const service = createRecallService({
      crypto: {
        randomUUID: () =>
          `repair-session-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      db,
      shuffleNotes: (notes) => [...notes],
    });

    async function createWeakResult(studyNoteId: string, sessionId: string) {
      await service.startFlashCardSession({
        studyNoteIds: [studyNoteId],
        userId: "user-casey",
      });
      await service.revealFlashCardAnswer({
        sessionId,
        userId: "user-casey",
      });

      await expect(
        service.rateFlashCardAnswer({
          rating: "hard",
          sessionId,
          userId: "user-casey",
        }),
      ).resolves.toBeNull();
    }

    await createWeakResult("study-note-complete", "repair-session-1");
    await createWeakResult("study-note-dismiss", "repair-session-2");
    await createWeakResult("study-note-linked", "repair-session-3");

    await service.confirmPracticeRepairEntry({
      correction: "First correction.",
      intent: "tighten-expected-answer",
      reference: {
        questionIndex: 0,
        questionResultId: "repair-session-1-question-0",
        sessionResultId: "repair-session-1",
        studyNoteId: "study-note-complete",
      },
      userId: "user-casey",
    });
    await service.confirmPracticeRepairEntry({
      correction: "Second correction.",
      intent: "tighten-expected-answer",
      reference: {
        questionIndex: 0,
        questionResultId: "repair-session-2-question-0",
        sessionResultId: "repair-session-2",
        studyNoteId: "study-note-dismiss",
      },
      userId: "user-casey",
    });
    await service.confirmPracticeRepairEntry({
      correction: "Third correction.",
      intent: "tighten-expected-answer",
      reference: {
        questionIndex: 0,
        questionResultId: "repair-session-3-question-0",
        sessionResultId: "repair-session-3",
        studyNoteId: "study-note-linked",
      },
      userId: "user-casey",
    });

    const reloadedService = createRecallService({
      db,
      shuffleNotes: (notes) => [...notes],
    });

    await reloadedService.updatePracticeRepairEntryCorrection({
      correction: "Updated first correction.",
      reference: {
        questionIndex: 0,
        questionResultId: "repair-session-1-question-0",
        sessionResultId: "repair-session-1",
        studyNoteId: "study-note-complete",
      },
      userId: "user-casey",
    });
    await reloadedService.completePracticeRepairEntry({
      reference: {
        questionIndex: 0,
        questionResultId: "repair-session-1-question-0",
        sessionResultId: "repair-session-1",
        studyNoteId: "study-note-complete",
      },
      userId: "user-casey",
    });
    await reloadedService.dismissPracticeRepairEntry({
      reference: {
        questionIndex: 0,
        questionResultId: "repair-session-2-question-0",
        sessionResultId: "repair-session-2",
        studyNoteId: "study-note-dismiss",
      },
      userId: "user-casey",
    });
    await reloadedService.completeLinkedPracticeRepairEntry({
      intent: "tighten-expected-answer",
      intentMetadata: {
        updatedExpectedAnswer: "The saved linked answer is now clearer.",
      },
      reference: {
        questionIndex: 0,
        questionResultId: "repair-session-3-question-0",
        sessionResultId: "repair-session-3",
        studyNoteId: "study-note-linked",
      },
      userId: "user-casey",
    });

    const finalService = createRecallService({
      db,
      shuffleNotes: (notes) => [...notes],
    });
    const finalResults = await finalService.listSessionResults({
      userId: "user-casey",
    });
    const completedResult = finalResults.find(
      (result) => result.id === "repair-session-1",
    );
    const dismissedResult = finalResults.find(
      (result) => result.id === "repair-session-2",
    );
    const linkedResult = finalResults.find(
      (result) => result.id === "repair-session-3",
    );

    expect(completedResult).toMatchObject({
      id: "repair-session-1",
      questions: [
        {
          practiceRepairEntry: {
            correction: "Updated first correction.",
            lifecycle: {
              completedAt: expect.any(String),
            },
          },
        },
      ],
    });
    expect(dismissedResult).toMatchObject({
      id: "repair-session-2",
      questions: [
        {
          practiceRepairEntry: {
            correction: "Second correction.",
            lifecycle: {
              dismissedAt: expect.any(String),
            },
          },
        },
      ],
    });
    expect(linkedResult).toMatchObject({
      id: "repair-session-3",
      questions: [
        {
          practiceRepairEntry: {
            correction: "Third correction.",
            intentMetadata: {
              updatedExpectedAnswer: "The saved linked answer is now clearer.",
            },
            lifecycle: {
              completedAt: expect.any(String),
            },
          },
        },
      ],
    });
  });

  it("persists Recall Schedule updates after FlashCard self-rating", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    const db = drizzle(database.client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
        ...notesSchema,
        ...recallSchema,
        ...studyNotesSchema,
      },
    });
    await migrateDatabase(db, database.client);
    await db.insert(usersTable).values({
      id: "user-casey",
      displayName: "Casey Learner",
      email: "casey@example.com",
      passwordHash: "hash",
      userLanguage: "en",
      createdAt: new Date("2026-05-15T08:00:00.000Z"),
      updatedAt: new Date("2026-05-15T08:00:00.000Z"),
    });
    await db.insert(notesTable).values({
      id: "source-note-schedule",
      userId: "user-casey",
      title: "Schedule source",
      body: "",
      labelIds: [],
      createdAt: new Date("2026-05-15T08:00:00.000Z"),
      updatedAt: new Date("2026-05-15T08:00:00.000Z"),
    });
    await db.insert(studyNotesTable).values({
      id: "study-note-schedule",
      sourceNoteId: "source-note-schedule",
      prompt: "What should be scheduled?",
      expectedAnswer: "The Study Note recall target.",
      createdAt: new Date("2026-05-15T08:05:00.000Z"),
      updatedAt: new Date("2026-05-15T08:05:00.000Z"),
    });

    const service = createRecallService({
      crypto: {
        randomUUID: () =>
          "session-schedule-db" as `${string}-${string}-${string}-${string}-${string}`,
      },
      db,
      now: () => new Date("2026-05-15T09:00:00.000Z"),
      shuffleNotes: (notes) => [...notes],
    });
    const session = await service.startFlashCardSession({
      studyNoteIds: ["study-note-schedule"],
      userId: "user-casey",
    });
    await service.revealFlashCardAnswer({
      sessionId: session.id,
      userId: "user-casey",
    });
    await service.rateFlashCardAnswer({
      rating: "good",
      sessionId: session.id,
      userId: "user-casey",
    });

    const reloadedService = createRecallService({
      db,
      shuffleNotes: (notes) => [...notes],
    });

    await expect(
      reloadedService.listRecallSchedules({
        userId: "user-casey",
      }),
    ).resolves.toEqual([
      {
        ease: 2.5,
        intervalDays: 3,
        lastRecalledAt: "2026-05-15T09:00:00.000Z",
        nextRecallAt: "2026-05-18T09:00:00.000Z",
        repetitionCount: 1,
        studyNoteId: "study-note-schedule",
      },
    ]);
  });

  it("persists Recall Schedule updates across multiple Study Note ratings", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    const db = drizzle(database.client, {
      schema: {
        ...authSchema,
        ...labelsSchema,
        ...notesSchema,
        ...recallSchema,
        ...studyNotesSchema,
      },
    });
    await migrateDatabase(db, database.client);
    await db.insert(usersTable).values({
      id: "user-casey",
      displayName: "Casey Learner",
      email: "casey@example.com",
      passwordHash: "hash",
      userLanguage: "en",
      createdAt: new Date("2026-05-15T08:00:00.000Z"),
      updatedAt: new Date("2026-05-15T08:00:00.000Z"),
    });
    await db.insert(notesTable).values({
      id: "source-note-schedule-repeat",
      userId: "user-casey",
      title: "Schedule source",
      body: "",
      labelIds: [],
      createdAt: new Date("2026-05-15T08:00:00.000Z"),
      updatedAt: new Date("2026-05-15T08:00:00.000Z"),
    });
    await db.insert(studyNotesTable).values({
      id: "study-note-schedule-repeat",
      sourceNoteId: "source-note-schedule-repeat",
      prompt: "What should be scheduled twice?",
      expectedAnswer: "The Study Note should keep its updated Recall Schedule.",
      createdAt: new Date("2026-05-15T08:05:00.000Z"),
      updatedAt: new Date("2026-05-15T08:05:00.000Z"),
    });

    let sessionCounter = 0;
    const firstNow = "2026-05-15T09:00:00.000Z";
    const secondNow = "2026-05-18T09:00:00.000Z";
    const firstService = createRecallService({
      crypto: {
        randomUUID: () =>
          `session-schedule-repeat-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      db,
      now: () => new Date(firstNow),
      shuffleNotes: (notes) => [...notes],
    });

    await firstService.startFlashCardSession({
      studyNoteIds: ["study-note-schedule-repeat"],
      userId: "user-casey",
    });
    await firstService.revealFlashCardAnswer({
      sessionId: "session-schedule-repeat-1",
      userId: "user-casey",
    });
    await firstService.rateFlashCardAnswer({
      rating: "good",
      sessionId: "session-schedule-repeat-1",
      userId: "user-casey",
    });

    const secondService = createRecallService({
      crypto: {
        randomUUID: () =>
          `session-schedule-repeat-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      db,
      now: () => new Date(secondNow),
      shuffleNotes: (notes) => [...notes],
    });

    await secondService.startFlashCardSession({
      studyNoteIds: ["study-note-schedule-repeat"],
      userId: "user-casey",
    });
    await secondService.revealFlashCardAnswer({
      sessionId: "session-schedule-repeat-2",
      userId: "user-casey",
    });
    await secondService.rateFlashCardAnswer({
      rating: "easy",
      sessionId: "session-schedule-repeat-2",
      userId: "user-casey",
    });

    const expectedAfterFirstRating = getUpdatedRecallSchedule({
      now: firstNow,
      rating: "good",
      schedule: createInitialRecallSchedule({
        now: firstNow,
        studyNoteId: "study-note-schedule-repeat",
      }),
    });
    const expectedAfterSecondRating = getUpdatedRecallSchedule({
      now: secondNow,
      rating: "easy",
      schedule: expectedAfterFirstRating,
    });
    const reloadedService = createRecallService({
      db,
      shuffleNotes: (notes) => [...notes],
    });

    await expect(
      reloadedService.listRecallSchedules({
        userId: "user-casey",
      }),
    ).resolves.toEqual([expectedAfterSecondRating]);
  });
});
