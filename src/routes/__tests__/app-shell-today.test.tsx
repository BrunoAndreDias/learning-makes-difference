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

function createStudyNote(
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

function findStudyNoteQuestionResult(input: {
  results: readonly SessionResult[];
  studyNoteId: string;
}) {
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

function completePracticeRepair(
  contexts: DeterministicRecallTestContexts,
  input: {
    result: SessionResult;
    userId: string;
  },
) {
  const reference = input.result.questions[0]?.practiceRepairEntry?.reference;

  if (reference === undefined) {
    throw new Error("Expected a confirmed Practice Repair reference.");
  }

  act(() => {
    contexts.recallContext.completePracticeRepairEntry({
      reference,
      userId: input.userId,
    });
  });
}

function getPracticeRepairEntryId(result: SessionResult) {
  const entryId =
    result.questions[0]?.practiceRepairEntry?.practiceRepairEntryId;

  if (entryId === undefined) {
    throw new Error("Expected a durable Practice Repair entry id.");
  }

  return entryId;
}

function getTodayRow(name: string) {
  const heading = screen.getByRole("heading", { level: 2, name });
  const row = heading.closest("article");

  if (!(row instanceof HTMLElement)) {
    throw new Error(`Expected ${name} to render inside a Today row.`);
  }

  return row;
}

describe("authenticated Today workspace", () => {
  it("shows the new-user empty state with one obvious Study Notes action", async () => {
    renderRoute("/today", {
      session: {
        user: {
          displayName: "Jordan Today",
          email: "jordan.today@example.com",
          id: "user-today-empty-state",
          userLanguage: "en",
          userTimeZone: "America/New_York",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Today" }),
    ).toBeInTheDocument();

    const emptyState = screen.getByRole("status");
    expect(
      within(emptyState).getByRole("heading", {
        level: 2,
        name: "Create your first Study Note",
      }),
    ).toBeInTheDocument();
    expect(
      within(emptyState).getByText(/start the learning loop/i),
    ).toBeInTheDocument();
    expect(
      within(emptyState).getByRole("link", { name: "Create first Study Note" }),
    ).toHaveAttribute("href", "/study-notes");
    expect(screen.queryByRole("region", { name: "Today summary" })).toBeNull();
  });

  it("renders the prioritized Today rows and routes each bucket to the correct workspace", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-today-prioritized";
    const biology = contexts.labelsContext.createLabel({
      name: "Biology",
      userId,
    });
    const chemistry = contexts.labelsContext.createLabel({
      name: "Chemistry",
      userId,
    });
    const activeRepair = createStudyNote(contexts, {
      expectedAnswer: "Active transport uses ATP.",
      labelIds: [biology.id],
      prompt: "Explain active transport",
      sourceBody: "Cell membranes source.",
      sourceTitle: "Cell membranes",
      userId,
    });
    const practiceFollowUp = createStudyNote(contexts, {
      expectedAnswer: "Osmosis moves water across a semipermeable membrane.",
      labelIds: [biology.id],
      prompt: "Explain osmosis",
      sourceBody: "Cell membranes source.",
      sourceTitle: "Cell membranes",
      userId,
    });
    const dueRecall = createStudyNote(contexts, {
      expectedAnswer:
        "Diffusion moves particles down a concentration gradient.",
      labelIds: [biology.id],
      prompt: "Explain diffusion",
      sourceBody: "Cell membranes source.",
      sourceTitle: "Cell membranes",
      userId,
    });
    createStudyNote(contexts, {
      expectedAnswer: " ",
      labelIds: [biology.id],
      prompt: "Define mitochondria",
      sourceBody: "Cell energy source.",
      sourceTitle: "Cell energy",
      userId,
    });
    const firstRecall = createStudyNote(contexts, {
      expectedAnswer: "ATP stores transferable energy.",
      labelIds: [biology.id],
      prompt: "Describe ATP",
      sourceBody: "Cell energy source.",
      sourceTitle: "Cell energy",
      userId,
    });
    const interleavingStudyNotes = Array.from({ length: 4 }, (_, index) =>
      createStudyNote(contexts, {
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
      studyNoteId: activeRepair.id,
      timestamp: "2026-05-12T09:00:00.000Z",
      userId,
    });
    const activeRepairResult = confirmStudyNotePracticeRepair(contexts, {
      correction: "State ATP use directly in the expected answer.",
      intent: "tighten-expected-answer",
      studyNoteId: activeRepair.id,
      userId,
    });

    completeStudyNoteRecall(contexts, {
      rating: "hard",
      studyNoteId: practiceFollowUp.id,
      timestamp: "2026-05-11T09:00:00.000Z",
      userId,
    });
    const followUpResult = confirmStudyNotePracticeRepair(contexts, {
      correction: "Differentiate solvent movement from solute movement.",
      intent: "tighten-expected-answer",
      studyNoteId: practiceFollowUp.id,
      userId,
    });
    completePracticeRepair(contexts, {
      result: followUpResult,
      userId,
    });

    completeStudyNoteRecall(contexts, {
      rating: "good",
      studyNoteId: dueRecall.id,
      timestamp: "2026-05-15T09:00:00.000Z",
      userId,
    });

    interleavingStudyNotes.forEach((studyNote) => {
      completeStudyNoteRecall(contexts, {
        rating: "good",
        studyNoteId: studyNote.id,
        timestamp: "2026-05-13T09:00:00.000Z",
        userId,
      });
      completeStudyNoteRecall(contexts, {
        rating: "easy",
        studyNoteId: studyNote.id,
        timestamp: "2026-05-18T09:00:00.000Z",
        userId,
      });
    });

    vi.setSystemTime(new Date("2026-05-19T12:00:00.000Z"));

    renderRoute("/today", {
      ...contexts,
      session: {
        user: {
          displayName: "Jordan Today",
          email: "jordan.today@example.com",
          id: userId,
          userLanguage: "en",
          userTimeZone: "America/New_York",
        },
      },
    });

    const pageHeading = await screen.findByRole("heading", {
      level: 1,
      name: "Today",
    });
    expect(pageHeading).toBeInTheDocument();
    const pageHeader = pageHeading.closest("header");

    if (!(pageHeader instanceof HTMLElement)) {
      throw new Error("Expected Today heading to render inside a page header.");
    }

    expect(
      within(pageHeader).getByRole("link", {
        name: "Open Practice Repair",
      }),
    ).toHaveAttribute(
      "href",
      `/practice-repair/${getPracticeRepairEntryId(activeRepairResult)}`,
    );
    expect(
      within(pageHeader).queryByRole("link", {
        name: "Manual selection",
      }),
    ).toBeNull();

    const summary = screen.getByRole("region", { name: "Today summary" });
    expect(within(summary).getAllByRole("listitem")).toHaveLength(6);

    const nextActions = screen.getByRole("region", {
      name: "Today next actions",
    });
    expect(
      within(nextActions)
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual([
      "Explain active transport",
      "Explain osmosis",
      "Explain diffusion",
      "Define mitochondria",
      "Describe ATP",
      "Chemistry",
    ]);

    expect(
      within(getTodayRow("Explain active transport")).getByRole("link", {
        name: "Open Practice Repair",
      }),
    ).toHaveAttribute(
      "href",
      `/practice-repair/${getPracticeRepairEntryId(activeRepairResult)}`,
    );
    expect(
      within(getTodayRow("Explain osmosis")).getByRole("link", {
        name: "Open Practice Repair",
      }),
    ).toHaveAttribute(
      "href",
      `/practice-repair/${getPracticeRepairEntryId(followUpResult)}`,
    );
    expect(
      within(getTodayRow("Explain diffusion")).getByRole("link", {
        name: "Open Recall Due today",
      }),
    ).toHaveAttribute("href", "/recall/due-today");
    expect(
      within(getTodayRow("Define mitochondria")).getByRole("link", {
        name: "Open Study Notes",
      }),
    ).toHaveAttribute("href", "/study-notes");
    expect(
      within(getTodayRow("Describe ATP")).getByRole("link", {
        name: "Open Recall Selection",
      }),
    ).toHaveAttribute("href", `/recall/select?studyNoteIds=${firstRecall.id}`);
    const chemistryLink = within(getTodayRow("Chemistry")).getByRole("link", {
      name: "Open Recall Selection",
    });
    const chemistryHref = chemistryLink.getAttribute("href") ?? "";

    expect(chemistryHref).toContain("/recall/select?studyNoteIds=");
    interleavingStudyNotes.forEach((studyNote) => {
      expect(decodeURIComponent(chemistryHref)).toContain(studyNote.id);
    });
  });

  it("refreshes Today when weak recall evidence becomes Practice Repair work", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-today-refresh";
    const biology = contexts.labelsContext.createLabel({
      name: "Biology",
      userId,
    });
    const studyNote = createStudyNote(contexts, {
      expectedAnswer:
        "Photosynthesis converts light, carbon dioxide, and water into glucose.",
      labelIds: [biology.id],
      prompt: "Photosynthesis inputs and output",
      sourceBody: "Biology source explanation.",
      sourceTitle: "Biology source",
      userId,
    });

    vi.setSystemTime(new Date("2026-05-19T12:00:00.000Z"));

    renderRoute("/today", {
      ...contexts,
      session: {
        user: {
          displayName: "Jordan Today",
          email: "jordan.today@example.com",
          id: userId,
          userLanguage: "en",
          userTimeZone: "America/New_York",
        },
      },
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Today" }),
    ).toBeInTheDocument();
    expect(
      within(getTodayRow("Photosynthesis inputs and output")).getByRole(
        "link",
        {
          name: "Open Recall Selection",
        },
      ),
    ).toHaveAttribute("href", `/recall/select?studyNoteIds=${studyNote.id}`);

    completeStudyNoteRecall(contexts, {
      rating: "forgot",
      studyNoteId: studyNote.id,
      timestamp: "2026-05-19T12:05:00.000Z",
      userId,
    });

    const practiceRepairRow = await screen.findByRole("heading", {
      level: 2,
      name: "Photosynthesis inputs and output",
    });
    const row = practiceRepairRow.closest("article");

    if (!(row instanceof HTMLElement)) {
      throw new Error("Expected Practice Repair row to render as an article.");
    }

    expect(within(row).getByText("Practice Repair")).toBeInTheDocument();
    expect(
      within(row).getByRole("link", { name: "Open Practice Repair" }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/practice-repair/results/"),
    );
  });
});
