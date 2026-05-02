import { describe, expect, it, vi } from "vitest";

import { createAppLabelsContext } from "../../labels/domain/labels";
import { createAppFocusContext } from "../focus/focus";
import { createAppNotesContext } from "../notes-workspace/notes";
import { createAppRecallContext, summarizeAttempts } from "./recall";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("recall attempt summaries", () => {
  it("returns zero counts for empty input", () => {
    expect(summarizeAttempts([])).toEqual({
      missed: 0,
      nailed: 0,
      partial: 0,
    });
  });

  it("returns explicit zeros for ratings outside a single bucket", () => {
    expect(
      summarizeAttempts([
        { noteId: "note-1", rating: "missed" },
        { noteId: "note-2", rating: "missed" },
        { noteId: "note-3", rating: "missed" },
      ]),
    ).toEqual({
      missed: 3,
      nailed: 0,
      partial: 0,
    });
  });

  it("counts mixed rating buckets", () => {
    expect(
      summarizeAttempts([
        { noteId: "note-1", rating: "nailed" },
        { noteId: "note-2", rating: "partial" },
        { noteId: "note-3", rating: "missed" },
        { noteId: "note-4", rating: "partial" },
      ]),
    ).toEqual({
      missed: 1,
      nailed: 1,
      partial: 2,
    });
  });

  it("handles large counts", () => {
    const attempts = [
      ...Array.from({ length: 125 }, (_, index) => ({
        noteId: `nailed-${index}`,
        rating: "nailed" as const,
      })),
      ...Array.from({ length: 75 }, (_, index) => ({
        noteId: `partial-${index}`,
        rating: "partial" as const,
      })),
      ...Array.from({ length: 50 }, (_, index) => ({
        noteId: `missed-${index}`,
        rating: "missed" as const,
      })),
    ];

    expect(summarizeAttempts(attempts)).toEqual({
      missed: 50,
      nailed: 125,
      partial: 75,
    });
  });
});

describe("recall attempts by note", () => {
  it("returns an empty list when the user has no attempted notes", () => {
    const storage = createMemoryStorage();
    const notes = createAppNotesContext({
      keyPrefix: "recall-test-by-note-empty-notes",
      storage,
    });
    const recall = createAppRecallContext({
      keyPrefix: "recall-test-by-note-empty-session",
      notes,
      storage,
    });

    expect(recall.listAttemptsByNote({ userId: "owner" })).toEqual([]);
  });

  it("aggregates attempts for the same note across multiple sessions", () => {
    const storage = createMemoryStorage();
    const notes = createAppNotesContext({
      keyPrefix: "recall-test-by-note-aggregation-notes",
      storage,
    });
    let sessionCounter = 0;
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `session-by-note-aggregation-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-by-note-aggregation-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
    });
    const userId = "owner";
    const note = notes.createNote(userId, {
      acronyms: [],
      body: "Original body",
      labelIds: [],
      metaphors: [],
      title: "Original title",
    });

    const firstSession = recall.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });
    recall.revealFlashCardAnswer({ sessionId: firstSession.id, userId });
    recall.rateFlashCardAnswer({
      rating: "partial",
      sessionId: firstSession.id,
      userId,
    });

    notes.updateNote(userId, note.id, {
      acronyms: [],
      body: "Updated body",
      labelIds: [],
      metaphors: [],
      title: "Updated title",
    });

    const secondSession = recall.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });
    recall.revealFlashCardAnswer({ sessionId: secondSession.id, userId });
    recall.rateFlashCardAnswer({
      rating: "nailed",
      sessionId: secondSession.id,
      userId,
    });

    expect(recall.listAttemptsByNote({ userId })).toMatchObject([
      {
        currentTitle: "Updated title",
        missed: 0,
        nailed: 1,
        noteId: note.id,
        partial: 1,
        snapshotTitle: "Updated title",
        totalAttempts: 2,
        attempts: [
          {
            bodySnapshot: "Original body",
            rating: "partial",
            sessionId: firstSession.id,
            snapshotTitle: "Original title",
          },
          {
            bodySnapshot: "Updated body",
            rating: "nailed",
            sessionId: secondSession.id,
            snapshotTitle: "Updated title",
          },
        ],
      },
    ]);
  });

  it("sorts notes by attempts then most recent attempt and filters by stored note labels", () => {
    vi.useFakeTimers();

    try {
      const storage = createMemoryStorage();
      const labels = createAppLabelsContext({
        keyPrefix: "recall-test-by-note-filter-labels",
        storage,
      });
      const notes = createAppNotesContext({
        getOwnedLabelIdsForUser: (userId) =>
          labels.getLabelsForUser(userId).map((label) => label.id),
        keyPrefix: "recall-test-by-note-filter-notes",
        storage,
      });
      let sessionCounter = 0;
      const recall = createAppRecallContext({
        crypto: {
          randomUUID: () =>
            `session-by-note-filter-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
        },
        keyPrefix: "recall-test-by-note-filter-session",
        notes,
        shuffleNotes: (sessionNotes) => [...sessionNotes],
        storage,
      });
      const userId = "owner";
      const science = labels.createLabel({ name: "Science", userId });
      const history = labels.createLabel({ name: "History", userId });
      const highVolumeNote = notes.createNote(userId, {
        acronyms: [],
        body: "Science body",
        labelIds: [science.id],
        metaphors: [],
        title: "Science note",
      });
      const recentTieNote = notes.createNote(userId, {
        acronyms: [],
        body: "Recent body",
        labelIds: [history.id],
        metaphors: [],
        title: "Recent history note",
      });
      const olderTieNote = notes.createNote(userId, {
        acronyms: [],
        body: "Older body",
        labelIds: [history.id],
        metaphors: [],
        title: "Older history note",
      });
      const otherUsersNote = notes.createNote("other-user", {
        acronyms: [],
        body: "Private body",
        labelIds: [],
        metaphors: [],
        title: "Private note",
      });

      for (const [timestamp, noteId, rating, owner] of [
        ["2026-04-01T10:00:00.000Z", highVolumeNote.id, "partial", userId],
        ["2026-04-02T10:00:00.000Z", olderTieNote.id, "missed", userId],
        ["2026-04-03T10:00:00.000Z", highVolumeNote.id, "nailed", userId],
        ["2026-04-04T10:00:00.000Z", recentTieNote.id, "partial", userId],
        ["2026-04-05T10:00:00.000Z", otherUsersNote.id, "nailed", "other-user"],
      ] as const) {
        vi.setSystemTime(new Date(timestamp));
        const session = recall.startFlashCardSession({
          noteIds: [noteId],
          userId: owner,
        });
        recall.revealFlashCardAnswer({ sessionId: session.id, userId: owner });
        recall.rateFlashCardAnswer({
          rating,
          sessionId: session.id,
          userId: owner,
        });
      }

      expect(
        recall.listAttemptsByNote({ userId }).map((entry) => entry.noteId),
      ).toEqual([highVolumeNote.id, recentTieNote.id, olderTieNote.id]);
      expect(recall.listAttemptsByNote({ userId })[0]).toMatchObject({
        missed: 0,
        nailed: 1,
        partial: 1,
        totalAttempts: 2,
      });
      expect(
        recall
          .listAttemptsByNote({ labelId: history.id, userId })
          .map((entry) => entry.noteId),
      ).toEqual([recentTieNote.id, olderTieNote.id]);
      expect(
        recall
          .listAttemptsByNote({ userId })[0]
          .attempts.map((attempt) => attempt.completedAt),
      ).toEqual(["2026-04-01T10:00:00.000Z", "2026-04-03T10:00:00.000Z"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses null current titles and the latest snapshot title for deleted notes", () => {
    const storage = createMemoryStorage();
    const notes = createAppNotesContext({
      keyPrefix: "recall-test-by-note-deleted-notes",
      storage,
    });
    let sessionCounter = 0;
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `session-by-note-deleted-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-by-note-deleted-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
    });
    const userId = "owner";
    const note = notes.createNote(userId, {
      acronyms: [],
      body: "First deleted body",
      labelIds: [],
      metaphors: [],
      title: "First deleted title",
    });

    const firstSession = recall.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });
    recall.revealFlashCardAnswer({ sessionId: firstSession.id, userId });
    recall.rateFlashCardAnswer({
      rating: "missed",
      sessionId: firstSession.id,
      userId,
    });

    notes.updateNote(userId, note.id, {
      acronyms: [],
      body: "Latest deleted body",
      labelIds: [],
      metaphors: [],
      title: "Latest deleted title",
    });

    const secondSession = recall.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });
    recall.revealFlashCardAnswer({ sessionId: secondSession.id, userId });
    recall.rateFlashCardAnswer({
      rating: "partial",
      sessionId: secondSession.id,
      userId,
    });

    const emptyNotes = createAppNotesContext({
      keyPrefix: "recall-test-by-note-deleted-empty-notes",
      storage,
    });
    const reloadedRecall = createAppRecallContext({
      keyPrefix: "recall-test-by-note-deleted-session",
      notes: emptyNotes,
      storage,
    });

    expect(reloadedRecall.listAttemptsByNote({ userId })).toMatchObject([
      {
        currentTitle: null,
        noteId: note.id,
        snapshotTitle: "Latest deleted title",
        totalAttempts: 2,
      },
    ]);
  });
});

describe("recall focus target capture", () => {
  it("captures RecallSession study activity as a single FocusTarget snapshot", () => {
    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

      const storage = createMemoryStorage();
      const labels = createAppLabelsContext({
        keyPrefix: "recall-focus-target-labels",
        storage,
      });
      const notes = createAppNotesContext({
        getOwnedLabelIdsForUser: (userId) =>
          labels.getLabelsForUser(userId).map((label) => label.id),
        keyPrefix: "recall-focus-target-notes",
        storage,
      });
      const focus = createAppFocusContext({
        getLabelsForUser: (ownerId) => labels.getLabelsForUser(ownerId),
        keyPrefix: "recall-focus-target-focus",
        storage,
      });
      const recall = createAppRecallContext({
        keyPrefix: "recall-focus-target-recall",
        notes,
        onStudyActivity: focus.captureRecallSessionStudyActivity,
        shuffleNotes: (sessionNotes) => [...sessionNotes],
        storage,
      });
      const userId = "owner";
      const biology = labels.createLabel({ name: "Biology", userId });
      const note = notes.createNote(userId, {
        acronyms: [],
        body: "Mitochondria generate ATP.",
        labelIds: [biology.id],
        metaphors: [],
        title: "Cell respiration",
      });

      focus.startFocusSession({
        focusIntervalMinutes: 25,
        userId,
      });

      const session = recall.startRecallSession({
        noteIds: [note.id],
        userId,
      });

      recall.revealAnswer({ sessionId: session.id, userId });
      recall.answerQuestion({
        rating: "nailed",
        sessionId: session.id,
        userId,
      });

      vi.setSystemTime(new Date("2026-04-30T10:25:12.000Z"));

      const record = focus.endFocusSession({ userId });

      expect(record).toMatchObject({
        completedFocusIntervalCount: 1,
        focusTargets: [
          {
            kind: "RecallSession",
            recallSession: {
              id: session.id,
              mode: "FlashCard",
            },
            labels: [{ id: biology.id, name: "Biology" }],
            notes: [{ id: note.id, title: "Cell respiration" }],
          },
        ],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores RecallSession study activity during a BreakInterval", () => {
    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-04-30T10:00:00.000Z"));

      const storage = createMemoryStorage();
      const labels = createAppLabelsContext({
        keyPrefix: "recall-break-exclusion-labels",
        storage,
      });
      const notes = createAppNotesContext({
        getOwnedLabelIdsForUser: (userId) =>
          labels.getLabelsForUser(userId).map((label) => label.id),
        keyPrefix: "recall-break-exclusion-notes",
        storage,
      });
      const focus = createAppFocusContext({
        getLabelsForUser: (ownerId) => labels.getLabelsForUser(ownerId),
        keyPrefix: "recall-break-exclusion-focus",
        storage,
      });
      const recall = createAppRecallContext({
        keyPrefix: "recall-break-exclusion-recall",
        notes,
        onStudyActivity: focus.captureRecallSessionStudyActivity,
        shuffleNotes: (sessionNotes) => [...sessionNotes],
        storage,
      });
      const userId = "owner";
      const note = notes.createNote(userId, {
        acronyms: [],
        body: "Break work should not count.",
        labelIds: [],
        metaphors: [],
        title: "Break exclusion",
      });

      focus.startFocusSession({
        breakIntervalMinutes: 5,
        focusIntervalMinutes: 25,
        userId,
      });

      vi.setSystemTime(new Date("2026-04-30T10:25:31.000Z"));

      const session = recall.startRecallSession({
        noteIds: [note.id],
        userId,
      });

      recall.revealAnswer({ sessionId: session.id, userId });
      recall.answerQuestion({
        rating: "partial",
        sessionId: session.id,
        userId,
      });

      vi.setSystemTime(new Date("2026-04-30T10:30:31.000Z"));

      const record = focus.endFocusSession({ userId });

      expect(record).toMatchObject({
        completedBreakIntervalCount: 1,
        completedFocusIntervalCount: 1,
        focusTargets: [],
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("recall session setup", () => {
  it("does not start FlashCard sessions from label targets", () => {
    const storage = createMemoryStorage();
    const labels = createAppLabelsContext({
      keyPrefix: "recall-test-label-targets-labels",
      storage,
    });
    const notes = createAppNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labels.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: "recall-test-label-targets-notes",
      storage,
    });
    const recall = createAppRecallContext({
      notes,
      storage,
    });
    const userId = "owner";
    const science = labels.createLabel({ name: "Science", userId });

    notes.createNote(userId, {
      acronyms: [],
      body: "Label assignment should not define v1 recall.",
      labelIds: [science.id],
      metaphors: [],
      title: "Label-targeted note",
    });

    expect(() =>
      recall.startFlashCardSession({
        labelId: science.id,
        userId,
      } as never),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_input",
        message: "Choose at least one note for recall.",
      }),
    );
  });

  it("starts from selected owned notes including unlabeled notes and shuffles the session order", () => {
    const storage = createMemoryStorage();
    const labels = createAppLabelsContext({
      keyPrefix: "recall-test-labels",
      storage,
    });
    const notes = createAppNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labels.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: "recall-test-notes",
      storage,
    });
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          "session-1-1-1-1" as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes].reverse(),
      storage,
    });
    const userId = "user-1";

    const science = labels.createLabel({ name: "Science", userId });
    const biology = labels.createLabel({ name: "Biology", userId });

    const scienceNote = notes.createNote(userId, {
      acronyms: [],
      body: "Broad topic note",
      labelIds: [science.id],
      metaphors: [],
      title: "Science note",
    });
    const biologyNote = notes.createNote(userId, {
      acronyms: [],
      body: "Biology note",
      labelIds: [biology.id],
      metaphors: [],
      title: "Biology note",
    });
    const unlabeledNote = notes.createNote(userId, {
      acronyms: [],
      body: "Should be recallable without a label",
      labelIds: [],
      metaphors: [],
      title: "Unlabeled note",
    });

    const session = recall.startFlashCardSession({
      noteIds: [scienceNote.id, biologyNote.id, unlabeledNote.id],
      userId,
    });

    expect(session).toMatchObject({
      id: "session-1-1-1-1",
      mode: "FlashCard",
    });
    expect(session.notes.map((note) => note.title)).toEqual([
      "Unlabeled note",
      "Biology note",
      "Science note",
    ]);
  });

  it("exposes RecallSession questions through the mode-ready interface", () => {
    const storage = createMemoryStorage();
    const notes = createAppNotesContext({
      keyPrefix: "recall-test-question-interface-notes",
      storage,
    });
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          "session-question-interface" as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-question-interface-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
    });
    const userId = "owner";
    const note = notes.createNote(userId, {
      acronyms: [],
      body: "Question-shaped answer",
      labelIds: [],
      metaphors: [],
      title: "Question-shaped prompt",
    });

    const session = recall.startRecallSession({
      mode: "FlashCard",
      noteIds: [note.id],
      userId,
    });

    expect(session).toMatchObject({
      currentQuestionIndex: 0,
      mode: "FlashCard",
      questions: [
        {
          isAnswerRevealed: false,
          noteId: note.id,
          noteSnapshot: {
            body: "Question-shaped answer",
            title: "Question-shaped prompt",
          },
          selfRating: null,
        },
      ],
    });
    expect("labelId" in session).toBe(false);
    expect("labelName" in session).toBe(false);

    const revealedSession = recall.revealAnswer({
      sessionId: session.id,
      userId,
    });

    expect(revealedSession.questions[0]).toMatchObject({
      isAnswerRevealed: true,
      selfRating: null,
    });

    expect(
      recall.answerQuestion({
        rating: "nailed",
        sessionId: session.id,
        userId,
      }),
    ).toBeNull();

    expect(recall.listSessionResults({ userId })[0]).toMatchObject({
      mode: "FlashCard",
      questions: [
        {
          isAnswerRevealed: false,
          noteId: note.id,
          selfRating: "nailed",
        },
      ],
    });
    expect("labelId" in recall.listSessionResults({ userId })[0]).toBe(false);
    expect("labelName" in recall.listSessionResults({ userId })[0]).toBe(false);
  });

  it("requires at least one selected note to start a session", () => {
    const storage = createMemoryStorage();
    const labels = createAppLabelsContext({
      keyPrefix: "recall-test-ownership-labels",
      storage,
    });
    const notes = createAppNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labels.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: "recall-test-ownership-notes",
      storage,
    });
    const recall = createAppRecallContext({
      notes,
      storage,
    });

    expect(() =>
      recall.startFlashCardSession({
        noteIds: [],
        userId: "owner",
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_input" }));
  });

  it("starts a FlashCard session from one owned note without a label and snapshots the note", () => {
    const storage = createMemoryStorage();
    const notes = createAppNotesContext({
      keyPrefix: "recall-test-selected-note-notes",
      storage,
    });
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          "session-selected-note" as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-selected-note-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
    });
    const userId = "owner";
    const selectedNote = notes.createNote(userId, {
      acronyms: [],
      body: "Original selected-note answer",
      labelIds: [],
      metaphors: [],
      title: "Selected-note question",
    });
    const otherUsersNote = notes.createNote("other-user", {
      acronyms: [],
      body: "Private answer",
      labelIds: [],
      metaphors: [],
      title: "Private question",
    });

    expect(() =>
      recall.startFlashCardSession({
        noteIds: [otherUsersNote.id],
        userId,
      }),
    ).toThrowError(expect.objectContaining({ code: "not_found" }));

    const session = recall.startFlashCardSession({
      noteIds: [selectedNote.id],
      userId,
    });

    notes.updateNote(userId, selectedNote.id, {
      acronyms: [],
      body: "Updated selected-note answer",
      labelIds: [],
      metaphors: [],
      title: "Updated selected-note question",
    });

    expect(session).toMatchObject({
      id: "session-selected-note",
      mode: "FlashCard",
      notes: [
        {
          body: "Original selected-note answer",
          id: selectedNote.id,
          title: "Selected-note question",
        },
      ],
    });
    expect(recall.getSnapshot()).toMatchObject({
      notes: [
        {
          body: "Original selected-note answer",
          id: selectedNote.id,
          title: "Selected-note question",
        },
      ],
    });
  });

  it("persists attempted selected-note sessions and discards zero-attempt selected-note exits", () => {
    const storage = createMemoryStorage();
    const notes = createAppNotesContext({
      keyPrefix: "recall-test-selected-note-history-notes",
      storage,
    });
    let sessionCounter = 0;
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `session-selected-note-history-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-selected-note-history-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
    });
    const userId = "owner";
    const note = notes.createNote(userId, {
      acronyms: [],
      body: "Selected-note answer",
      labelIds: [],
      metaphors: [],
      title: "Selected-note question",
    });

    const attemptedSession = recall.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });

    recall.revealFlashCardAnswer({
      sessionId: attemptedSession.id,
      userId,
    });
    expect(
      recall.rateFlashCardAnswer({
        rating: "partial",
        sessionId: attemptedSession.id,
        userId,
      }),
    ).toBeNull();

    expect(recall.listSessionResults({ userId })).toMatchObject([
      {
        attempts: [{ noteId: note.id, rating: "partial" }],
        id: attemptedSession.id,
      },
    ]);

    const zeroAttemptSession = recall.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });

    recall.endFlashCardSession({
      sessionId: zeroAttemptSession.id,
      userId,
    });

    expect(recall.listSessionResults({ userId })).toHaveLength(1);
  });

  it("reveals answers, advances after rating, and clears the active session when ended", () => {
    const storage = createMemoryStorage();
    const labels = createAppLabelsContext({
      keyPrefix: "recall-test-progress-labels",
      storage,
    });
    const notes = createAppNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labels.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: "recall-test-progress-notes",
      storage,
    });
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          "session-2-2-2-2" as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-progress-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
    });
    const userId = "user-1";
    const science = labels.createLabel({ name: "Science", userId });

    const firstNote = notes.createNote(userId, {
      acronyms: [],
      body: "Answer one",
      labelIds: [science.id],
      metaphors: [],
      title: "Question one",
    });
    const secondNote = notes.createNote(userId, {
      acronyms: [],
      body: "Answer two",
      labelIds: [science.id],
      metaphors: [],
      title: "Question two",
    });

    const session = recall.startFlashCardSession({
      noteIds: [firstNote.id, secondNote.id],
      userId,
    });

    expect(() =>
      recall.rateFlashCardAnswer({
        rating: "partial",
        sessionId: session.id,
        userId,
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid_input" }));

    const revealedSession = recall.revealFlashCardAnswer({
      sessionId: session.id,
      userId,
    });

    expect(revealedSession.isAnswerRevealed).toBe(true);

    const advancedSession = recall.rateFlashCardAnswer({
      rating: "partial",
      sessionId: session.id,
      userId,
    });

    expect(advancedSession).toMatchObject({
      attempts: [{ noteId: session.notes[0].id, rating: "partial" }],
      currentIndex: 1,
      isAnswerRevealed: false,
    });

    const endedSession = recall.endFlashCardSession({
      sessionId: session.id,
      userId,
    });

    expect(endedSession.attempts).toHaveLength(1);
    expect(recall.getSnapshot()).toBeNull();
  });

  it("persists attempted sessions for history, preserves note snapshots, and discards zero-attempt exits", () => {
    const storage = createMemoryStorage();
    const labels = createAppLabelsContext({
      keyPrefix: "recall-test-history-labels",
      storage,
    });
    const notes = createAppNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labels.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: "recall-test-history-notes",
      storage,
    });
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          "session-3-3-3-3" as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-history-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
    });
    const userId = "user-1";
    const science = labels.createLabel({ name: "Science", userId });
    const note = notes.createNote(userId, {
      acronyms: [],
      body: "Original answer",
      labelIds: [science.id],
      metaphors: [],
      title: "Original question",
    });

    const attemptedSession = recall.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });

    recall.revealFlashCardAnswer({
      sessionId: attemptedSession.id,
      userId,
    });
    recall.rateFlashCardAnswer({
      rating: "nailed",
      sessionId: attemptedSession.id,
      userId,
    });

    notes.updateNote(userId, note.id, {
      acronyms: [],
      body: "Updated answer",
      labelIds: [science.id],
      metaphors: [],
      title: "Updated question",
    });

    const reloadedRecall = createAppRecallContext({
      keyPrefix: "recall-test-history-session",
      notes,
      storage,
    });

    expect(reloadedRecall.listSessionResults({ userId })).toMatchObject([
      {
        attempts: [{ noteId: note.id, rating: "nailed" }],
        id: attemptedSession.id,
        notes: [
          {
            body: "Original answer",
            id: note.id,
            title: "Original question",
          },
        ],
      },
    ]);

    const zeroAttemptSession = reloadedRecall.startFlashCardSession({
      noteIds: [note.id],
      userId,
    });

    reloadedRecall.endFlashCardSession({
      sessionId: zeroAttemptSession.id,
      userId,
    });

    expect(reloadedRecall.listSessionResults({ userId })).toHaveLength(1);
  });

  it("reloads attempted SessionResults with stored question reveal state intact", () => {
    const storage = createMemoryStorage();
    const notes = createAppNotesContext({
      keyPrefix: "recall-test-result-reveal-state-notes",
      storage,
    });
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          "session-result-reveal-state" as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-result-reveal-state-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
    });
    const userId = "owner";
    const firstNote = notes.createNote(userId, {
      acronyms: [],
      body: "First stored answer",
      labelIds: [],
      metaphors: [],
      title: "First stored question",
    });
    const secondNote = notes.createNote(userId, {
      acronyms: [],
      body: "Second stored answer",
      labelIds: [],
      metaphors: [],
      title: "Second stored question",
    });

    const session = recall.startFlashCardSession({
      noteIds: [firstNote.id, secondNote.id],
      userId,
    });

    recall.revealFlashCardAnswer({ sessionId: session.id, userId });
    recall.rateFlashCardAnswer({
      rating: "partial",
      sessionId: session.id,
      userId,
    });
    recall.revealFlashCardAnswer({ sessionId: session.id, userId });
    recall.endFlashCardSession({ sessionId: session.id, userId });

    const reloadedRecall = createAppRecallContext({
      keyPrefix: "recall-test-result-reveal-state-session",
      notes,
      storage,
    });

    expect(reloadedRecall.listSessionResults({ userId })).toMatchObject([
      {
        attempts: [{ noteId: firstNote.id, rating: "partial" }],
        questions: [
          {
            isAnswerRevealed: false,
            noteId: firstNote.id,
            selfRating: "partial",
          },
          {
            isAnswerRevealed: true,
            noteId: secondNote.id,
            selfRating: null,
          },
        ],
      },
    ]);
  });

  it("keeps saved selected-note SessionResult snapshots isolated from later reads and note edits", () => {
    const storage = createMemoryStorage();
    const notes = createAppNotesContext({
      keyPrefix: "recall-test-result-snapshot-isolation-notes",
      storage,
    });
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          "session-result-snapshot-isolation" as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-result-snapshot-isolation-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
    });
    const userId = "owner";
    const attemptedNote = notes.createNote(userId, {
      acronyms: [{ expansion: "Original Expansion", shortForm: "OE" }],
      body: "Original attempted answer",
      labelIds: [],
      metaphors: [
        {
          explanation: "Original attempted metaphor explanation",
          title: "Original attempted metaphor",
        },
      ],
      title: "Original attempted question",
    });
    const unattemptedNote = notes.createNote(userId, {
      acronyms: [{ expansion: "Original Second Expansion", shortForm: "OSE" }],
      body: "Original unattempted answer",
      labelIds: [],
      metaphors: [
        {
          explanation: "Original unattempted metaphor explanation",
          title: "Original unattempted metaphor",
        },
      ],
      title: "Original unattempted question",
    });

    const session = recall.startFlashCardSession({
      noteIds: [attemptedNote.id, unattemptedNote.id],
      userId,
    });

    recall.revealFlashCardAnswer({ sessionId: session.id, userId });
    recall.rateFlashCardAnswer({
      rating: "partial",
      sessionId: session.id,
      userId,
    });
    recall.endFlashCardSession({ sessionId: session.id, userId });

    notes.updateNote(userId, attemptedNote.id, {
      acronyms: [{ expansion: "Updated Expansion", shortForm: "UE" }],
      body: "Updated attempted answer",
      labelIds: [],
      metaphors: [
        {
          explanation: "Updated attempted metaphor explanation",
          title: "Updated attempted metaphor",
        },
      ],
      title: "Updated attempted question",
    });
    notes.updateNote(userId, unattemptedNote.id, {
      acronyms: [{ expansion: "Updated Second Expansion", shortForm: "USE" }],
      body: "Updated unattempted answer",
      labelIds: [],
      metaphors: [
        {
          explanation: "Updated unattempted metaphor explanation",
          title: "Updated unattempted metaphor",
        },
      ],
      title: "Updated unattempted question",
    });

    const listedResult = recall.listSessionResults({ userId })[0];
    listedResult.notes[0].title = "Mutated read result";
    listedResult.notes[0].metaphors[0].title = "Mutated read metaphor";
    listedResult.notes[0].acronyms[0].shortForm = "MR";

    expect(
      recall.getSessionResult({
        sessionResultId: session.id,
        userId,
      }),
    ).toMatchObject({
      attempts: [{ noteId: attemptedNote.id, rating: "partial" }],
      notes: [
        {
          acronyms: [{ expansion: "Original Expansion", shortForm: "OE" }],
          body: "Original attempted answer",
          id: attemptedNote.id,
          metaphors: [
            {
              explanation: "Original attempted metaphor explanation",
              title: "Original attempted metaphor",
            },
          ],
          title: "Original attempted question",
        },
        {
          acronyms: [
            { expansion: "Original Second Expansion", shortForm: "OSE" },
          ],
          body: "Original unattempted answer",
          id: unattemptedNote.id,
          metaphors: [
            {
              explanation: "Original unattempted metaphor explanation",
              title: "Original unattempted metaphor",
            },
          ],
          title: "Original unattempted question",
        },
      ],
    });
  });

  it("lists selected-note session results by account and stored note labels", () => {
    const storage = createMemoryStorage();
    const labels = createAppLabelsContext({
      keyPrefix: "recall-test-filter-labels",
      storage,
    });
    const notes = createAppNotesContext({
      getOwnedLabelIdsForUser: (userId) =>
        labels.getLabelsForUser(userId).map((label) => label.id),
      keyPrefix: "recall-test-filter-notes",
      storage,
    });
    let sessionCounter = 0;
    const recall = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `session-4-4-4-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: "recall-test-filter-session",
      notes,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage,
    });
    const userId = "user-1";
    const science = labels.createLabel({ name: "Science", userId });
    const history = labels.createLabel({ name: "History", userId });
    const otherScience = labels.createLabel({
      name: "Private science",
      userId: "user-2",
    });

    const scienceNote = notes.createNote(userId, {
      acronyms: [],
      body: "Science answer",
      labelIds: [science.id],
      metaphors: [],
      title: "Science question",
    });
    const historyNote = notes.createNote(userId, {
      acronyms: [],
      body: "History answer",
      labelIds: [history.id],
      metaphors: [],
      title: "History question",
    });
    const otherNote = notes.createNote("user-2", {
      acronyms: [],
      body: "Private answer",
      labelIds: [otherScience.id],
      metaphors: [],
      title: "Private question",
    });

    for (const [noteId, owner] of [
      [scienceNote.id, userId],
      [historyNote.id, userId],
      [otherNote.id, "user-2"],
    ] as const) {
      const session = recall.startFlashCardSession({
        noteIds: [noteId],
        userId: owner,
      });

      recall.revealFlashCardAnswer({
        sessionId: session.id,
        userId: owner,
      });
      recall.rateFlashCardAnswer({
        rating: "partial",
        sessionId: session.id,
        userId: owner,
      });
    }

    expect(
      recall
        .listSessionResults({ labelId: science.id, userId })
        .map((result) => result.mode),
    ).toEqual(["FlashCard"]);
    expect(recall.listSessionResults({ userId })).toHaveLength(2);
    expect(recall.listSessionResults({ userId: "user-2" })).toHaveLength(1);
  });
});
