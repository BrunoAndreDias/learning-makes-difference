import { describe, expect, it } from "vitest";

import type { AppLabel } from "../labels/label-management/labels";
import type {
  FlashCardRecallAttemptsByNote,
  RecallSchedule,
  SessionResult,
} from "../recall";
import { deriveStudyGuidance } from "./study-guidance";

const timestamp = "2026-05-01T09:00:00.000Z";

function buildStudyNote(
  overrides: Partial<SessionResult["notes"][number]> & {
    expectedAnswer?: string;
    id: string;
    labelIds: string[];
    prompt: string;
    sourceBody?: string;
    sourceTitle?: string;
  },
) {
  return {
    acronyms: [],
    createdAt: timestamp,
    expectedAnswer: overrides.expectedAnswer ?? "Expected answer",
    id: overrides.id,
    labelIds: overrides.labelIds,
    metaphors: [],
    prompt: overrides.prompt,
    source: {
      body: overrides.sourceBody ?? "Source body",
      id: `source-${overrides.id}`,
      title: overrides.sourceTitle ?? "Source title",
      updatedAt: timestamp,
    },
    sourceNoteId: `source-${overrides.id}`,
    updatedAt: timestamp,
  };
}

function buildAttempts(
  noteId: string,
  attempts: FlashCardRecallAttemptsByNote["attempts"],
): FlashCardRecallAttemptsByNote {
  const summary = attempts.reduce(
    (totals, attempt) => ({
      easy: totals.easy + (attempt.rating === "easy" ? 1 : 0),
      forgot: totals.forgot + (attempt.rating === "forgot" ? 1 : 0),
      good: totals.good + (attempt.rating === "good" ? 1 : 0),
      hard: totals.hard + (attempt.rating === "hard" ? 1 : 0),
    }),
    {
      easy: 0,
      forgot: 0,
      good: 0,
      hard: 0,
    },
  );

  return {
    attempts,
    currentTitle: null,
    ...summary,
    noteId,
    snapshotTitle: "Snapshot title",
    totalAttempts: attempts.length,
  };
}

function buildSchedule(
  studyNoteId: string,
  overrides: Partial<RecallSchedule>,
): RecallSchedule {
  return {
    ease: 2.5,
    intervalDays: 1,
    lastRecalledAt: "2026-05-14T09:00:00.000Z",
    nextRecallAt: "2026-05-15T09:00:00.000Z",
    repetitionCount: 1,
    studyNoteId,
    ...overrides,
  };
}

function buildRecallQuestionSnapshot(
  studyNote: ReturnType<typeof buildStudyNote>,
) {
  return {
    acronyms: [],
    body: studyNote.source.body,
    createdAt: studyNote.createdAt,
    expectedAnswer: studyNote.expectedAnswer,
    id: studyNote.id,
    labelIds: studyNote.labelIds,
    metaphors: [],
    prompt: studyNote.prompt,
    source: {
      body: studyNote.source.body,
      id: studyNote.source.id,
      title: studyNote.source.title,
      updatedAt: studyNote.source.updatedAt,
    },
    sourceNoteId: studyNote.sourceNoteId,
    title: studyNote.prompt,
    updatedAt: studyNote.updatedAt,
  };
}

function buildPracticeRepairEntry(input: {
  confirmedAt: string;
  correction: string;
  lifecycle?: {
    completedAt?: string | null;
    dismissedAt?: string | null;
    followUpSatisfiedAt?: string | null;
    studyNoteDeletedAt?: string | null;
    supersededAt?: string | null;
  };
  questionResultId: string;
  resultId: string;
  studyNoteId: string;
}) {
  return {
    confirmedAt: input.confirmedAt,
    correction: input.correction,
    intent: "tighten-expected-answer" as const,
    intentMetadata: {
      updatedExpectedAnswer: null,
    },
    lifecycle: input.lifecycle,
    reference: {
      questionIndex: 0,
      questionResultId: input.questionResultId,
      sessionResultId: input.resultId,
      studyNoteId: input.studyNoteId,
    },
  };
}

function buildSessionResult(input: {
  completedAt: string;
  id: string;
  practiceRepairCorrection?: string;
  practiceRepairLifecycle?: {
    completedAt?: string | null;
    dismissedAt?: string | null;
    followUpSatisfiedAt?: string | null;
    studyNoteDeletedAt?: string | null;
    supersededAt?: string | null;
  };
  questionResultId: string;
  selfRating: "easy" | "forgot" | "good" | "hard";
  studyNote: ReturnType<typeof buildStudyNote>;
}): SessionResult {
  const noteSnapshot = buildRecallQuestionSnapshot(input.studyNote);

  return {
    attempts: [],
    completedAt: input.completedAt,
    createdAt: input.completedAt,
    id: input.id,
    mode: "FlashCard",
    notes: [noteSnapshot],
    questions: [
      {
        isAnswerRevealed: true,
        noteId: input.studyNote.id,
        noteSnapshot,
        practiceRepairEntry:
          input.practiceRepairCorrection === undefined
            ? undefined
            : buildPracticeRepairEntry({
                confirmedAt: input.completedAt,
                correction: input.practiceRepairCorrection,
                lifecycle: input.practiceRepairLifecycle,
                questionResultId: input.questionResultId,
                resultId: input.id,
                studyNoteId: input.studyNote.id,
              }),
        questionResultId: input.questionResultId,
        selfRating: input.selfRating,
      },
    ],
  };
}

describe("Study Guidance", () => {
  it("builds one prioritized Today plan with the required action buckets and CTA targets", () => {
    const biology: AppLabel = {
      id: "label-biology",
      name: "Biology",
      parentIds: [],
    };
    const chemistry: AppLabel = {
      id: "label-chemistry",
      name: "Chemistry",
      parentIds: [],
    };
    const activeRepair = buildStudyNote({
      id: "study-note-active-repair",
      labelIds: [biology.id],
      prompt: "Explain active transport",
      sourceTitle: "Cell membranes",
    });
    const practiceFollowUp = buildStudyNote({
      id: "study-note-practice-follow-up",
      labelIds: [biology.id],
      prompt: "Explain osmosis",
      sourceTitle: "Cell membranes",
    });
    const overdueRecall = buildStudyNote({
      id: "study-note-overdue-recall",
      labelIds: [biology.id],
      prompt: "Explain diffusion",
      sourceTitle: "Cell membranes",
    });
    const completionBlocker = buildStudyNote({
      expectedAnswer: " ",
      id: "study-note-completion-blocker",
      labelIds: [biology.id],
      prompt: "Define mitochondria",
      sourceTitle: "Cell energy",
    });
    const firstRecall = buildStudyNote({
      id: "study-note-first-recall",
      labelIds: [biology.id],
      prompt: "Describe ATP",
      sourceTitle: "Cell energy",
    });
    const interleavingStudyNotes = Array.from({ length: 4 }, (_, index) =>
      buildStudyNote({
        id: `study-note-chemistry-${index + 1}`,
        labelIds: [chemistry.id],
        prompt: `Chemistry prompt ${index + 1}`,
        sourceTitle: "Chemistry source",
      }),
    );

    const guidance = deriveStudyGuidance({
      attemptsByNote: [
        buildAttempts(activeRepair.id, [
          {
            bodySnapshot: "Active repair answer",
            completedAt: "2026-05-12T09:00:00.000Z",
            rating: "hard",
            sessionId: "session-active-repair",
            snapshotTitle: activeRepair.prompt,
          },
        ]),
        buildAttempts(practiceFollowUp.id, [
          {
            bodySnapshot: "Practice follow-up answer",
            completedAt: "2026-05-11T09:00:00.000Z",
            rating: "hard",
            sessionId: "session-practice-follow-up",
            snapshotTitle: practiceFollowUp.prompt,
          },
        ]),
        buildAttempts(overdueRecall.id, [
          {
            bodySnapshot: "Overdue recall answer",
            completedAt: "2026-05-15T09:00:00.000Z",
            rating: "good",
            sessionId: "session-overdue-recall",
            snapshotTitle: overdueRecall.prompt,
          },
        ]),
        ...interleavingStudyNotes.map((studyNote, index) =>
          buildAttempts(studyNote.id, [
            {
              bodySnapshot: `Chemistry answer ${index + 1}`,
              completedAt: "2026-05-13T09:00:00.000Z",
              rating: "good",
              sessionId: `session-chemistry-good-${index + 1}`,
              snapshotTitle: studyNote.prompt,
            },
            {
              bodySnapshot: `Chemistry answer ${index + 1}`,
              completedAt: "2026-05-18T09:00:00.000Z",
              rating: "easy",
              sessionId: `session-chemistry-easy-${index + 1}`,
              snapshotTitle: studyNote.prompt,
            },
          ]),
        ),
      ],
      labels: [biology, chemistry],
      now: "2026-05-19T12:00:00.000Z",
      recallSchedules: [
        buildSchedule(activeRepair.id, {
          nextRecallAt: "2026-05-13T09:00:00.000Z",
        }),
        buildSchedule(practiceFollowUp.id, {
          nextRecallAt: "2026-05-14T09:00:00.000Z",
        }),
        buildSchedule(overdueRecall.id, {
          nextRecallAt: "2026-05-18T09:00:00.000Z",
        }),
        ...interleavingStudyNotes.map((studyNote) =>
          buildSchedule(studyNote.id, {
            ease: 2.65,
            intervalDays: 7,
            lastRecalledAt: "2026-05-18T09:00:00.000Z",
            nextRecallAt: "2026-05-25T09:00:00.000Z",
            repetitionCount: 2,
          }),
        ),
      ],
      sessionResults: [
        buildSessionResult({
          completedAt: "2026-05-12T09:00:00.000Z",
          id: "result-active-repair",
          practiceRepairCorrection:
            "State ATP use directly in the expected answer.",
          questionResultId: "result-active-repair-question-0",
          selfRating: "hard",
          studyNote: activeRepair,
        }),
        buildSessionResult({
          completedAt: "2026-05-11T09:00:00.000Z",
          id: "result-practice-follow-up",
          practiceRepairCorrection:
            "Differentiate solvent movement from solute movement.",
          practiceRepairLifecycle: {
            completedAt: "2026-05-12T09:30:00.000Z",
          },
          questionResultId: "result-practice-follow-up-question-0",
          selfRating: "hard",
          studyNote: practiceFollowUp,
        }),
      ],
      studyNotes: [
        activeRepair,
        practiceFollowUp,
        overdueRecall,
        completionBlocker,
        firstRecall,
        ...interleavingStudyNotes,
      ],
      userTimeZone: "America/New_York",
    });

    expect(guidance.emptyState).toBeNull();
    expect(guidance.summaryCards).toEqual([
      expect.objectContaining({ count: 1, id: "practice-repair" }),
      expect.objectContaining({ count: 1, id: "practice-follow-up" }),
      expect.objectContaining({ count: 1, id: "due-today" }),
      expect.objectContaining({ count: 1, id: "completion-blocker" }),
      expect.objectContaining({ count: 1, id: "first-recall" }),
      expect.objectContaining({ count: 1, id: "interleaving-ready" }),
    ]);
    expect(
      guidance.rows.map((row) => ({
        bucketId: row.bucketId,
        kind: row.action.kind,
        title: row.title,
      })),
    ).toEqual([
      {
        bucketId: "practice-repair",
        kind: "practice-repair-entry",
        title: "Explain active transport",
      },
      {
        bucketId: "practice-follow-up",
        kind: "practice-repair-entry",
        title: "Explain osmosis",
      },
      {
        bucketId: "due-today",
        kind: "recall-due-today",
        title: "Explain diffusion",
      },
      {
        bucketId: "completion-blocker",
        kind: "study-notes",
        title: "Define mitochondria",
      },
      {
        bucketId: "first-recall",
        kind: "recall-selection",
        title: "Describe ATP",
      },
      {
        bucketId: "interleaving-ready",
        kind: "recall-selection",
        title: "Chemistry",
      },
    ]);
    expect(guidance.rows[0]).toEqual(
      expect.objectContaining({
        metadata: ["Label: Biology", "Source: Cell membranes"],
      }),
    );
    expect(guidance.rows[4]?.action).toEqual({
      kind: "recall-selection",
      label: "Open Recall Selection",
      studyNoteIds: [firstRecall.id],
    });
    expect(guidance.rows[5]?.action).toEqual({
      kind: "recall-selection",
      label: "Open Recall Selection",
      studyNoteIds: interleavingStudyNotes.map((studyNote) => studyNote.id),
    });
  });

  it("returns a new-user empty state with one obvious Study Notes action", () => {
    const guidance = deriveStudyGuidance({
      attemptsByNote: [],
      labels: [],
      now: "2026-05-19T12:00:00.000Z",
      recallSchedules: [],
      sessionResults: [],
      studyNotes: [],
      userTimeZone: "America/New_York",
    });

    expect(guidance.rows).toEqual([]);
    expect(guidance.summaryCards.map((card) => card.count)).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
    expect(guidance.emptyState).toEqual({
      action: {
        kind: "study-notes",
        label: "Create first Study Note",
      },
      description:
        "Start the Learning Loop with one clear Study Note, then use recall and Practice Repair to strengthen it over time.",
      title: "Create your first Study Note",
    });
  });

  it("resolves due-plus-repair conflicts by keeping repair work ahead of scheduled recall", () => {
    const biology: AppLabel = {
      id: "label-biology",
      name: "Biology",
      parentIds: [],
    };
    const repairCandidate = buildStudyNote({
      id: "study-note-repair-candidate",
      labelIds: [biology.id],
      prompt: "Explain osmosis",
    });
    const followUp = buildStudyNote({
      id: "study-note-follow-up",
      labelIds: [biology.id],
      prompt: "Explain diffusion",
    });
    const cleanDue = buildStudyNote({
      id: "study-note-clean-due",
      labelIds: [biology.id],
      prompt: "Explain facilitated diffusion",
    });

    const guidance = deriveStudyGuidance({
      attemptsByNote: [
        buildAttempts(repairCandidate.id, [
          {
            bodySnapshot: "Repair candidate answer",
            completedAt: "2026-05-14T09:00:00.000Z",
            rating: "hard",
            sessionId: "session-repair-candidate",
            snapshotTitle: repairCandidate.prompt,
          },
        ]),
        buildAttempts(followUp.id, [
          {
            bodySnapshot: "Follow-up answer",
            completedAt: "2026-05-14T10:00:00.000Z",
            rating: "hard",
            sessionId: "session-follow-up",
            snapshotTitle: followUp.prompt,
          },
        ]),
        buildAttempts(cleanDue.id, [
          {
            bodySnapshot: "Clean due answer",
            completedAt: "2026-05-15T09:00:00.000Z",
            rating: "good",
            sessionId: "session-clean-due",
            snapshotTitle: cleanDue.prompt,
          },
        ]),
      ],
      labels: [biology],
      now: "2026-05-19T12:00:00.000Z",
      recallSchedules: [
        buildSchedule(repairCandidate.id, {
          nextRecallAt: "2026-05-18T09:00:00.000Z",
        }),
        buildSchedule(followUp.id, {
          nextRecallAt: "2026-05-18T09:00:00.000Z",
        }),
        buildSchedule(cleanDue.id, {
          nextRecallAt: "2026-05-18T09:00:00.000Z",
        }),
      ],
      sessionResults: [
        buildSessionResult({
          completedAt: "2026-05-14T09:00:00.000Z",
          id: "result-repair-candidate",
          questionResultId: "result-repair-candidate-question-0",
          selfRating: "hard",
          studyNote: repairCandidate,
        }),
        buildSessionResult({
          completedAt: "2026-05-14T10:00:00.000Z",
          id: "result-follow-up",
          practiceRepairCorrection: "State the solvent direction directly.",
          practiceRepairLifecycle: {
            completedAt: "2026-05-15T10:30:00.000Z",
          },
          questionResultId: "result-follow-up-question-0",
          selfRating: "hard",
          studyNote: followUp,
        }),
      ],
      studyNotes: [repairCandidate, followUp, cleanDue],
      userTimeZone: "America/New_York",
    });

    expect(
      guidance.rows.map((row) => ({
        bucketId: row.bucketId,
        kind: row.action.kind,
        title: row.title,
      })),
    ).toEqual([
      {
        bucketId: "practice-repair",
        kind: "practice-repair-draft",
        title: "Explain osmosis",
      },
      {
        bucketId: "practice-follow-up",
        kind: "practice-repair-entry",
        title: "Explain diffusion",
      },
      {
        bucketId: "due-today",
        kind: "recall-due-today",
        title: "Explain facilitated diffusion",
      },
    ]);
  });

  it("keeps interleaving-ready groups last and orders those topic rows alphabetically", () => {
    const biology: AppLabel = {
      id: "label-biology",
      name: "Biology",
      parentIds: [],
    };
    const chemistry: AppLabel = {
      id: "label-chemistry",
      name: "Chemistry",
      parentIds: [],
    };
    const firstRecall = buildStudyNote({
      id: "study-note-first-recall",
      labelIds: [biology.id],
      prompt: "Define ATP",
    });
    const biologyInterleaving = Array.from({ length: 4 }, (_, index) =>
      buildStudyNote({
        id: `study-note-biology-${index + 1}`,
        labelIds: [biology.id],
        prompt: `Biology prompt ${index + 1}`,
      }),
    );
    const chemistryInterleaving = Array.from({ length: 4 }, (_, index) =>
      buildStudyNote({
        id: `study-note-chemistry-${index + 1}`,
        labelIds: [chemistry.id],
        prompt: `Chemistry prompt ${index + 1}`,
      }),
    );

    const guidance = deriveStudyGuidance({
      attemptsByNote: [
        ...biologyInterleaving.map((studyNote, index) =>
          buildAttempts(studyNote.id, [
            {
              bodySnapshot: `Biology answer ${index + 1}`,
              completedAt: "2026-05-12T09:00:00.000Z",
              rating: "good",
              sessionId: `session-biology-good-${index + 1}`,
              snapshotTitle: studyNote.prompt,
            },
            {
              bodySnapshot: `Biology answer ${index + 1}`,
              completedAt: "2026-05-18T09:00:00.000Z",
              rating: "easy",
              sessionId: `session-biology-easy-${index + 1}`,
              snapshotTitle: studyNote.prompt,
            },
          ]),
        ),
        ...chemistryInterleaving.map((studyNote, index) =>
          buildAttempts(studyNote.id, [
            {
              bodySnapshot: `Chemistry answer ${index + 1}`,
              completedAt: "2026-05-11T09:00:00.000Z",
              rating: "good",
              sessionId: `session-chemistry-good-${index + 1}`,
              snapshotTitle: studyNote.prompt,
            },
            {
              bodySnapshot: `Chemistry answer ${index + 1}`,
              completedAt: "2026-05-18T09:00:00.000Z",
              rating: "easy",
              sessionId: `session-chemistry-easy-${index + 1}`,
              snapshotTitle: studyNote.prompt,
            },
          ]),
        ),
      ],
      labels: [biology, chemistry],
      now: "2026-05-19T12:00:00.000Z",
      recallSchedules: [
        ...biologyInterleaving.map((studyNote) =>
          buildSchedule(studyNote.id, {
            ease: 2.65,
            intervalDays: 7,
            lastRecalledAt: "2026-05-18T09:00:00.000Z",
            nextRecallAt: "2026-05-25T09:00:00.000Z",
            repetitionCount: 2,
          }),
        ),
        ...chemistryInterleaving.map((studyNote) =>
          buildSchedule(studyNote.id, {
            ease: 2.65,
            intervalDays: 7,
            lastRecalledAt: "2026-05-18T09:00:00.000Z",
            nextRecallAt: "2026-05-25T09:00:00.000Z",
            repetitionCount: 2,
          }),
        ),
      ],
      sessionResults: [],
      studyNotes: [
        firstRecall,
        ...chemistryInterleaving,
        ...biologyInterleaving,
      ],
      userTimeZone: "America/New_York",
    });

    expect(
      guidance.rows.map((row) => ({
        bucketId: row.bucketId,
        title: row.title,
      })),
    ).toEqual([
      {
        bucketId: "first-recall",
        title: "Define ATP",
      },
      {
        bucketId: "interleaving-ready",
        title: "Biology",
      },
      {
        bucketId: "interleaving-ready",
        title: "Chemistry",
      },
    ]);
  });
});
