// @vitest-environment jsdom

import { act, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  createDeterministicRecallTestContexts,
  renderRoute,
} from "./app-shell-test-support";

type DeterministicRecallTestContexts = ReturnType<
  typeof createDeterministicRecallTestContexts
>;

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

describe("authenticated Study Guidance workspace", () => {
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

    expect(screen.getAllByText("Recall today").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Needs practice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not recalled yet").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Interleaving ready").length).toBeGreaterThan(0);
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
});
