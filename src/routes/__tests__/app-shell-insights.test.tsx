// @vitest-environment jsdom

import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionResult } from "../../modules/recall";
import type { PracticeRepairIntent } from "../../modules/recall/recall-practice-repair";
import {
  createDeterministicRecallTestContexts,
  renderRoute,
} from "./app-shell-test-support";

type DeterministicRecallTestContexts = ReturnType<
  typeof createDeterministicRecallTestContexts
>;

afterEach(() => {
  vi.useRealTimers();
});

function createRecallableStudyNote(
  contexts: DeterministicRecallTestContexts,
  input: {
    expectedAnswer: string;
    labelIds: string[];
    prompt: string;
    sourceBody: string;
    sourceTitle: string;
    userId: string;
  },
) {
  const studyNote = contexts.studyNotesContext.createStudyNote(input.userId, {
    sourceBody: input.sourceBody,
    sourceTitle: input.sourceTitle,
  });

  return contexts.studyNotesContext.updateStudyNote(
    input.userId,
    studyNote.id,
    {
      acronyms: [],
      expectedAnswer: input.expectedAnswer,
      labelIds: input.labelIds,
      metaphors: [],
      prompt: input.prompt,
      sourceBody: input.sourceBody,
      sourceTitle: input.sourceTitle,
    },
  );
}

function completeStudyNoteRecall(
  contexts: DeterministicRecallTestContexts,
  input: {
    rating: "easy" | "forgot" | "good" | "hard";
    studyNoteId: string;
    timestamp: string;
    userId: string;
  },
) {
  act(() => {
    vi.setSystemTime(new Date(input.timestamp));

    const session = contexts.recallContext.startFlashCardSession({
      studyNoteIds: [input.studyNoteId],
      userId: input.userId,
    });

    contexts.recallContext.revealFlashCardAnswer({
      sessionId: session.id,
      userId: input.userId,
    });
    contexts.recallContext.rateFlashCardAnswer({
      rating: input.rating,
      sessionId: session.id,
      userId: input.userId,
    });
  });
}

function confirmStudyNotePracticeRepair(
  contexts: DeterministicRecallTestContexts,
  input: {
    correction: string;
    intent: PracticeRepairIntent;
    studyNoteId: string;
    userId: string;
  },
): SessionResult {
  const questionReference = findStudyNoteQuestionResult({
    results: contexts.recallContext.listSessionResults({
      userId: input.userId,
    }),
    studyNoteId: input.studyNoteId,
  });

  if (questionReference === null) {
    throw new Error("Expected a stored weak-recall result with a question id.");
  }

  let updatedResult: SessionResult | null = null;

  act(() => {
    updatedResult = contexts.recallContext.confirmPracticeRepairEntry({
      correction: input.correction,
      intent: input.intent,
      reference: {
        questionIndex: questionReference.questionIndex,
        questionResultId: questionReference.questionResultId,
        sessionResultId: questionReference.result.id,
        studyNoteId: input.studyNoteId,
      },
      userId: input.userId,
    });
  });

  if (updatedResult === null) {
    throw new Error("Expected a confirmed Practice Repair result.");
  }

  return updatedResult;
}

function findStudyNoteQuestionResult(input: {
  results: readonly SessionResult[];
  studyNoteId: string;
}): {
  questionIndex: number;
  questionResultId: string;
  result: SessionResult;
} | null {
  for (const result of input.results) {
    const questionIndex = result.questions.findIndex(
      (question) => question.noteId === input.studyNoteId,
    );

    if (questionIndex < 0) {
      continue;
    }

    const questionResultId = result.questions[questionIndex]?.questionResultId;

    if (questionResultId !== undefined) {
      return {
        questionIndex,
        questionResultId,
        result,
      };
    }
  }

  return null;
}

describe("authenticated Study Guidance workspace", () => {
  it("refreshes factual guidance when recall evidence changes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-study-guidance-refresh";
    const biology = contexts.labelsContext.createLabel({
      name: "Biology",
      userId,
    });
    const photosynthesis = createRecallableStudyNote(contexts, {
      expectedAnswer:
        "Photosynthesis converts light, carbon dioxide, and water into glucose.",
      labelIds: [biology.id],
      prompt: "Photosynthesis inputs and output",
      sourceBody: "Biology source explanation.",
      sourceTitle: "Biology source",
      userId,
    });

    vi.setSystemTime(new Date("2026-05-15T12:00:00.000Z"));

    renderRoute("/insights", {
      ...contexts,
      session: {
        user: {
          displayName: "Jordan Guidance",
          email: "jordan.guidance@example.com",
          id: userId,
          userLanguage: "en",
          userTimeZone: "America/New_York",
        },
      },
    });

    expect(
      await screen.findByText(
        "Photosynthesis inputs and output is ready for Recall Today. Next recall: Recall today.",
      ),
    ).toBeInTheDocument();

    completeStudyNoteRecall(contexts, {
      rating: "hard",
      studyNoteId: photosynthesis.id,
      timestamp: "2026-05-15T12:05:00.000Z",
      userId,
    });

    expect(
      await screen.findByRole("heading", { name: "Practice Repair" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 new repair candidate is waiting in Recall."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open Practice Repair" }),
    ).toHaveAttribute("href", "/recall/repair");
    expect(
      screen.getByText(
        "1 new repair candidate is waiting for Biology. Open Practice Repair before repeating generic Needs practice work.",
      ),
    ).toBeInTheDocument();
  });

  it("shows factual guidance from Study Notes and Labels without mastery or passive-progress rewards", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-study-guidance";
    const biology = contexts.labelsContext.createLabel({
      name: "Biology",
      userId,
    });
    const chemistry = contexts.labelsContext.createLabel({
      name: "Chemistry",
      userId,
    });

    const weakBiology = createRecallableStudyNote(contexts, {
      expectedAnswer:
        "Diffusion moves particles down a concentration gradient.",
      labelIds: [biology.id],
      prompt: "Diffusion vs. osmosis",
      sourceBody: "Biology source explanation.",
      sourceTitle: "Biology source",
      userId,
    });
    createRecallableStudyNote(contexts, {
      expectedAnswer: "Mitosis creates two matching daughter cells.",
      labelIds: [biology.id],
      prompt: "Phases of mitosis",
      sourceBody: "Another biology source explanation.",
      sourceTitle: "Cell division source",
      userId,
    });

    const chemistryStudyNotes = Array.from({ length: 4 }, (_, index) =>
      createRecallableStudyNote(contexts, {
        expectedAnswer: `Chemistry answer ${index + 1}.`,
        labelIds: [chemistry.id],
        prompt: `Chemistry prompt ${index + 1}`,
        sourceBody: `Chemistry source ${index + 1}.`,
        sourceTitle: "Chemistry source",
        userId,
      }),
    );

    completeStudyNoteRecall(contexts, {
      rating: "hard",
      studyNoteId: weakBiology.id,
      timestamp: "2026-05-14T09:00:00.000Z",
      userId,
    });

    chemistryStudyNotes.forEach((studyNote) => {
      completeStudyNoteRecall(contexts, {
        rating: "good",
        studyNoteId: studyNote.id,
        timestamp: "2026-05-10T09:00:00.000Z",
        userId,
      });
      completeStudyNoteRecall(contexts, {
        rating: "easy",
        studyNoteId: studyNote.id,
        timestamp: "2026-05-12T09:00:00.000Z",
        userId,
      });
    });

    vi.setSystemTime(new Date("2026-05-15T12:00:00.000Z"));

    renderRoute("/insights", {
      ...contexts,
      session: {
        user: {
          displayName: "Jordan Guidance",
          email: "jordan.guidance@example.com",
          id: userId,
          userLanguage: "en",
          userTimeZone: "America/New_York",
        },
      },
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Study Guidance",
      }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("navigation", { name: "App sections" }),
      ).getByRole("link", { name: "Insights" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Manual selection" }),
    ).toHaveAttribute("href", "/recall/select");
    expect(
      screen.getByRole("link", { name: "Open Practice Repair" }),
    ).toHaveAttribute("href", "/recall/repair");

    expect(screen.getAllByText("Recall Today").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Needs practice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not recalled yet").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Interleaved Recall").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 notes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 note").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4 notes").length).toBeGreaterThan(0);

    expect(
      screen.getByText("Passive activity does not count as learning evidence."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Biology" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Chemistry" }),
    ).toBeInTheDocument();

    expect(screen.queryByText(/mastery/i)).toBeNull();
    expect(screen.queryByText(/beginner/i)).toBeNull();
    expect(screen.queryByText(/intermediate/i)).toBeNull();
    expect(screen.queryByText(/advanced/i)).toBeNull();
  });

  it("surfaces active Practice Repair work and new repair candidates before generic needs-practice guidance", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-study-guidance-practice-repair";
    const biology = contexts.labelsContext.createLabel({
      name: "Biology",
      userId,
    });

    const activeRepairStudyNote = createRecallableStudyNote(contexts, {
      expectedAnswer: "Active transport uses ATP to move substances uphill.",
      labelIds: [biology.id],
      prompt: "Explain active transport",
      sourceBody: "Cell transport source.",
      sourceTitle: "Cell transport",
      userId,
    });
    const repairCandidateStudyNote = createRecallableStudyNote(contexts, {
      expectedAnswer: "Osmosis moves water across a semipermeable membrane.",
      labelIds: [biology.id],
      prompt: "Explain osmosis",
      sourceBody: "Membrane transport source.",
      sourceTitle: "Membrane transport",
      userId,
    });

    completeStudyNoteRecall(contexts, {
      rating: "hard",
      studyNoteId: activeRepairStudyNote.id,
      timestamp: "2026-05-14T09:00:00.000Z",
      userId,
    });
    completeStudyNoteRecall(contexts, {
      rating: "forgot",
      studyNoteId: repairCandidateStudyNote.id,
      timestamp: "2026-05-15T08:00:00.000Z",
      userId,
    });
    confirmStudyNotePracticeRepair(contexts, {
      correction: "Call out ATP directly in the expected answer.",
      intent: "tighten-expected-answer",
      studyNoteId: activeRepairStudyNote.id,
      userId,
    });

    vi.setSystemTime(new Date("2026-05-15T12:00:00.000Z"));

    renderRoute("/insights", {
      ...contexts,
      session: {
        user: {
          displayName: "Jordan Guidance",
          email: "jordan.guidance@example.com",
          id: userId,
          userLanguage: "en",
          userTimeZone: "America/New_York",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Practice Repair" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "1 active Practice Repair entry and 1 new repair candidate are waiting in Recall.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open Practice Repair" }),
    ).toHaveAttribute("href", "/recall/repair");
    expect(
      screen.getByText(
        "1 active Practice Repair entry and 1 new repair candidate are waiting for Biology. Open Practice Repair before repeating generic Needs practice work.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        /Explain active transport needs practice\. Last score: Hard\./,
      ),
    ).toBeNull();
  });

  it("uses the four agreed factual signal labels in the Study Guidance summary", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-study-guidance-signal-labels";

    renderRoute("/insights", {
      ...contexts,
      session: {
        user: {
          displayName: "Jordan Guidance",
          email: "jordan.guidance@example.com",
          id: userId,
          userLanguage: "en",
          userTimeZone: "America/New_York",
        },
      },
    });

    const summary = await screen.findByRole("region", {
      name: "Study Guidance summary",
    });

    for (const label of [
      "Recall Today",
      "Needs practice",
      "Not recalled yet",
      "Interleaved Recall",
    ]) {
      expect(within(summary).getByText(label)).toBeInTheDocument();
    }
    expect(within(summary).queryByText("Interleaving ready")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Open Practice Repair" }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Practice Repair" }),
    ).toBeNull();
  });
});
