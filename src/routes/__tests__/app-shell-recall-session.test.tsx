// @vitest-environment jsdom

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AppPersistentRecallService,
  RecallNoteSnapshot,
  RecallQuestion,
  RecallSelfRating,
  SessionResult,
} from "../../modules/recall";
import type { AppStudyNote } from "../../modules/study-notes";
import {
  createDeterministicRecallTestContexts,
  createRecallNote,
  renderRoute,
} from "./app-shell-test-support";

const testUser = {
  displayName: "Jordan Recall",
  email: "jordan.recall@example.com",
  id: "user-recall",
  userLanguage: "en",
} as const;

type DeterministicRecallTestContexts = ReturnType<
  typeof createDeterministicRecallTestContexts
>;
type RecallableStudyNoteInput = {
  acceptedVariants?: AppStudyNote["acceptedVariants"];
  expectedAnswer: string;
  keyIdeas?: AppStudyNote["keyIdeas"];
  prompt: string;
  sourceBody: string;
  sourceTitle: string;
};

function createSession() {
  return { user: testUser };
}

function createRecallableStudyNote(
  contexts: DeterministicRecallTestContexts,
  input: RecallableStudyNoteInput,
): AppStudyNote {
  const source = {
    sourceBody: input.sourceBody,
    sourceTitle: input.sourceTitle,
  };
  const studyNote = contexts.studyNotesContext.createStudyNote(
    testUser.id,
    source,
  );

  return contexts.studyNotesContext.updateStudyNote(testUser.id, studyNote.id, {
    acceptedVariants: input.acceptedVariants ?? [],
    acronyms: [],
    expectedAnswer: input.expectedAnswer,
    keyIdeas: input.keyIdeas ?? [],
    labelIds: [],
    metaphors: [],
    prompt: input.prompt,
    prohibitedPhrases: [],
    ...source,
  });
}

function completeRecallAt(input: {
  noteId: string;
  rating: RecallSelfRating;
  recallContext: DeterministicRecallTestContexts["recallContext"];
  timestamp: string;
}) {
  vi.setSystemTime(new Date(input.timestamp));
  const session = input.recallContext.startFlashCardSession({
    noteIds: [input.noteId],
    userId: testUser.id,
  });

  input.recallContext.revealFlashCardAnswer({
    sessionId: session.id,
    userId: testUser.id,
  });
  input.recallContext.rateFlashCardAnswer({
    rating: input.rating,
    sessionId: session.id,
    userId: testUser.id,
  });
}

function _createPersistentRecallService(
  overrides: Partial<AppPersistentRecallService>,
): AppPersistentRecallService {
  return Object.assign(
    {
      completePracticeRepairEntry: vi.fn(async () => {
        throw new Error("not used");
      }),
      completeLinkedPracticeRepairEntry: vi.fn(async () => {
        throw new Error("not used");
      }),
      confirmPracticeRepairEntry: vi.fn(async () => {
        throw new Error("not used");
      }),
      dismissPracticeRepairEntry: vi.fn(async () => {
        throw new Error("not used");
      }),
      endRecallSession: vi.fn(async () => {
        throw new Error("not used");
      }),
      getActiveSession: vi.fn(async () => null),
      listRecallSchedules: vi.fn(async () => []),
      listSessionResults: vi.fn(async () => []),
      rateFlashCardAnswer: vi.fn(async () => null),
      revealFlashCardAnswer: vi.fn(async () => {
        throw new Error("not used");
      }),
      startFlashCardSession: vi.fn(async () => {
        throw new Error("not used");
      }),
      updatePracticeRepairEntryCorrection: vi.fn(async () => {
        throw new Error("not used");
      }),
      updateFlashCardAttemptText: vi.fn(async () => {
        throw new Error("not used");
      }),
    } satisfies AppPersistentRecallService,
    overrides,
  );
}

function createStoredRecallNote(
  overrides: Partial<RecallNoteSnapshot> = {},
): RecallNoteSnapshot {
  return {
    acronyms: [],
    body: "Stored answer body.",
    createdAt: "2026-05-07T08:50:00.000Z",
    id: "note-restored",
    labelIds: [],
    metaphors: [],
    title: "Stored prompt title",
    updatedAt: "2026-05-07T08:50:00.000Z",
    ...overrides,
  };
}

function createStoredRecallQuestion(input: {
  note: RecallNoteSnapshot;
  score: number | null;
  selfRating: RecallSelfRating | null;
}): RecallQuestion {
  return {
    isAnswerRevealed: true,
    noteId: input.note.id,
    noteSnapshot: input.note,
    score: input.score,
    selfRating: input.selfRating,
    typedAnswer: "",
  };
}

function _createStoredSessionResult(
  overrides: {
    completedAt?: string;
    createdAt?: string;
    id?: string;
    note?: RecallNoteSnapshot;
    rating?: RecallSelfRating;
    score?: number | null;
  } = {},
): SessionResult {
  const note = overrides.note ?? createStoredRecallNote();
  const rating = overrides.rating ?? "good";
  const score = overrides.score === undefined ? 75 : overrides.score;

  return {
    attempts: [
      {
        noteId: note.id,
        rating,
      },
    ],
    completedAt: overrides.completedAt ?? "2026-05-07T09:10:00.000Z",
    createdAt: overrides.createdAt ?? "2026-05-07T09:00:00.000Z",
    id: overrides.id ?? "session-restored-result",
    mode: "FlashCard",
    notes: [note],
    questions: [
      createStoredRecallQuestion({
        note,
        score,
        selfRating: rating,
      }),
    ],
    score,
  };
}

function completeMultiQuestionRecall(input: {
  questions: ReadonlyArray<{
    noteId: string;
    rating: RecallSelfRating;
    typedAnswer?: string;
  }>;
  recallContext: DeterministicRecallTestContexts["recallContext"];
  timestamp: string;
}) {
  vi.setSystemTime(new Date(input.timestamp));
  const sessionId = input.recallContext.startFlashCardSession({
    noteIds: input.questions.map((question) => question.noteId),
    userId: testUser.id,
  }).id;

  input.questions.forEach((question) => {
    if (question.typedAnswer !== undefined) {
      input.recallContext.updateFlashCardAttemptText({
        sessionId,
        text: question.typedAnswer,
        userId: testUser.id,
      });
    }

    input.recallContext.revealFlashCardAnswer({
      sessionId,
      userId: testUser.id,
    });
    input.recallContext.rateFlashCardAnswer({
      rating: question.rating,
      sessionId,
      userId: testUser.id,
    });
  });
}

function completeStudyNoteRecallAt(input: {
  rating: RecallSelfRating;
  recallContext: DeterministicRecallTestContexts["recallContext"];
  studyNoteId: string;
  timestamp: string;
}) {
  vi.setSystemTime(new Date(input.timestamp));
  const session = input.recallContext.startFlashCardSession({
    studyNoteIds: [input.studyNoteId],
    userId: testUser.id,
  });

  input.recallContext.revealFlashCardAnswer({
    sessionId: session.id,
    userId: testUser.id,
  });
  input.recallContext.rateFlashCardAnswer({
    rating: input.rating,
    sessionId: session.id,
    userId: testUser.id,
  });
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

function confirmStudyNotePracticeRepair(input: {
  correction: string;
  contexts: Pick<DeterministicRecallTestContexts, "recallContext">;
  studyNoteId: string;
}) {
  const questionReference = findStudyNoteQuestionResult({
    results: input.contexts.recallContext.listSessionResults({
      userId: testUser.id,
    }),
    studyNoteId: input.studyNoteId,
  });

  if (questionReference === null) {
    throw new Error("Expected a stored weak-recall result with a question id.");
  }

  return input.contexts.recallContext.confirmPracticeRepairEntry({
    correction: input.correction,
    intent: "tighten-expected-answer",
    reference: {
      questionIndex: questionReference.questionIndex,
      questionResultId: questionReference.questionResultId,
      sessionResultId: questionReference.result.id,
      studyNoteId: input.studyNoteId,
    },
    userId: testUser.id,
  });
}

function getConfirmedPracticeRepairReference(result: SessionResult) {
  const reference = result.questions[0]?.practiceRepairEntry?.reference;

  if (reference === undefined) {
    throw new Error("Expected a confirmed Practice Repair reference.");
  }

  return reference;
}

function getControlledPanel(control: HTMLElement) {
  const panelId = control.getAttribute("aria-controls");

  if (panelId === null) {
    throw new Error("Expected control to reference a detail panel.");
  }

  const panel = document.getElementById(panelId);

  if (panel === null) {
    throw new Error(`Expected detail panel "${panelId}" to exist.`);
  }

  return panel;
}

function getDetailBlockByLabel(panel: HTMLElement, label: string) {
  const labelElement = within(panel).getByText(label);
  const block = labelElement.closest(
    ".recall-selected-result__question-detail-block",
  );

  if (!(block instanceof HTMLElement)) {
    throw new Error(`Expected "${label}" to be inside a detail block.`);
  }

  return block;
}

function getDetailBlockCopy(block: HTMLElement) {
  const copy = block.querySelector(
    ".recall-selected-result__question-detail-copy",
  );

  if (!(copy instanceof HTMLElement)) {
    throw new Error("Expected detail block to include copy text.");
  }

  return copy;
}

const defaultViewportWidth = window.innerWidth;

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
    writable: true,
  });
  fireEvent(window, new Event("resize"));
}

afterEach(() => {
  setViewportWidth(defaultViewportWidth);
  vi.useRealTimers();
});

describe("authenticated recall workspace", () => {
  it("runs the FlashCard reveal and self-rating flow, then saves to Results", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const note = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Saved result body.",
      title: "Saved result note",
    });
    contexts.recallContext.startFlashCardSession({
      noteIds: [note.id],
      userId: testUser.id,
    });

    const { router } = renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    expect(
      await screen.findByText(
        "Try to recall this Study Note before revealing it.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Saved result body.")).toBeNull();
    expect(screen.queryByText("elapsed")).toBeNull();
    expect(
      screen.queryByRole("complementary", { name: "Session overview" }),
    ).toBeNull();
    expect(
      screen.getByText("Study Notes are shown in a randomized order."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Write answer" }));
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: { value: "Typed learner recall." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reveal Study Note" }));
    expect(screen.getByText("Saved result body.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Study Note" }));

    expect(router.state.location.pathname).toBe("/recall/results");
    expect(
      await screen.findByText("Recall session saved to results"),
    ).toBeInTheDocument();
    const selectedResult = await screen.findByRole("region", {
      name: "Selected result",
    });
    const savedQuestion = within(selectedResult).getByRole("button", {
      name: /Saved result note/i,
    });

    fireEvent.click(savedQuestion);

    expect(
      within(getControlledPanel(savedQuestion)).getByText(
        "Typed learner recall.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("75%").length).toBeGreaterThan(0);
  });

  it("reveals Study Note expected answer before source Note context", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const studyNote = createRecallableStudyNote(contexts, {
      expectedAnswer: "Specific expected answer comes first.",
      prompt: "Practice prompt",
      sourceBody: "Broader source context comes second.",
      sourceTitle: "Source context title",
    });
    contexts.recallContext.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId: testUser.id,
    });

    renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    fireEvent.click(await screen.findByRole("button", { name: /Reveal/ }));

    const expectedAnswer = screen.getByText(
      "Specific expected answer comes first.",
    );
    const sourceContext = screen.getByText(
      "Broader source context comes second.",
    );

    expect(
      expectedAnswer.compareDocumentPosition(sourceContext) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("Expected answer")).toBeInTheDocument();
    expect(screen.getByText("Source context")).toBeInTheDocument();
  });

  it("shows baseline Answer Check guidance alongside the expected answer on Study Note reveal", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const studyNote = createRecallableStudyNote(contexts, {
      expectedAnswer: "Retrieval practice strengthens access to memory.",
      prompt: "What does retrieval practice strengthen?",
      sourceBody: "Broader retrieval practice source context.",
      sourceTitle: "Retrieval practice source",
    });
    contexts.recallContext.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId: testUser.id,
    });

    renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Write answer" }),
    );
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: {
        value: "Retrieval practise strengthens access to memory.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reveal Study Note" }));

    expect(screen.getByText("Answer Check")).toBeInTheDocument();
    expect(screen.getByText("Likely correct")).toBeInTheDocument();
    expect(screen.getByText("Medium confidence")).toBeInTheDocument();
    expect(
      screen.getByText("Guidance only. Keep your own self-rating."),
    ).toBeInTheDocument();
    expect(screen.getByText("Suggested self-rating")).toBeInTheDocument();
    expect(screen.getAllByText("Good").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Forgot" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hard" })).toBeInTheDocument();
  });

  it("shows Key Idea concept coverage alongside the expected answer on Study Note reveal", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const studyNote = createRecallableStudyNote(contexts, {
      expectedAnswer:
        "Retrieval practice strengthens long-term memory through effortful recall and transfer.",
      keyIdeas: [
        {
          acceptedPhrases: [],
          id: "key-idea-memory",
          importance: "required",
          prohibitedPhrases: [],
          text: "long-term memory",
        },
        {
          acceptedPhrases: [],
          id: "key-idea-effortful",
          importance: "required",
          prohibitedPhrases: [],
          text: "effortful recall",
        },
        {
          acceptedPhrases: [],
          id: "key-idea-transfer",
          importance: "supporting",
          prohibitedPhrases: [],
          text: "transfer to problems",
        },
      ],
      prompt: "What does retrieval practice strengthen?",
      sourceBody: "Broader retrieval practice source context.",
      sourceTitle: "Retrieval practice source",
    });
    contexts.recallContext.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId: testUser.id,
    });

    renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Write answer" }),
    );
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: {
        value:
          "Retrieval practice strengthens long-term memory and helps transfer to problems.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reveal Study Note" }));

    expect(screen.getByText("Likely incomplete")).toBeInTheDocument();
    expect(screen.getByText("Covered concepts")).toBeInTheDocument();
    expect(screen.getByText("long-term memory")).toBeInTheDocument();
    expect(screen.getByText("Still missing")).toBeInTheDocument();
    expect(screen.getByText("effortful recall")).toBeInTheDocument();
  });

  it("shows prohibited phrase contradictions alongside the expected answer on Study Note reveal", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const studyNote = createRecallableStudyNote(contexts, {
      expectedAnswer:
        "Retrieval practice strengthens long-term memory through effortful recall.",
      keyIdeas: [
        {
          acceptedPhrases: [],
          id: "key-idea-memory",
          importance: "required",
          prohibitedPhrases: [],
          text: "long-term memory",
        },
        {
          acceptedPhrases: [],
          id: "key-idea-effortful",
          importance: "required",
          prohibitedPhrases: ["passive review"],
          text: "effortful recall",
        },
      ],
      prompt: "What does retrieval practice strengthen?",
      sourceBody: "Broader retrieval practice source context.",
      sourceTitle: "Retrieval practice source",
    });
    contexts.recallContext.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId: testUser.id,
    });

    renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Write answer" }),
    );
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: {
        value:
          "Retrieval practice strengthens long-term memory through passive review.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reveal Study Note" }));

    expect(screen.getByText("Uncertain")).toBeInTheDocument();
    expect(screen.getByText("Contradicted concepts")).toBeInTheDocument();
    expect(screen.getByText("effortful recall")).toBeInTheDocument();
    expect(screen.getByText("Matched Prohibited Phrases")).toBeInTheDocument();
    expect(screen.getByText("passive review")).toBeInTheDocument();
  });

  it("shows built-in contradiction evidence alongside the expected answer on Study Note reveal", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const studyNote = createRecallableStudyNote(contexts, {
      expectedAnswer:
        "Retrieval practice strengthens long-term memory through effortful recall.",
      prompt: "What does retrieval practice strengthen?",
      sourceBody: "Broader retrieval practice source context.",
      sourceTitle: "Retrieval practice source",
    });
    contexts.recallContext.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId: testUser.id,
    });

    renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Write answer" }),
    );
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: {
        value:
          "Retrieval practice does not strengthen long-term memory through effortful recall.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reveal Study Note" }));

    expect(screen.getByText("Uncertain")).toBeInTheDocument();
    expect(screen.getByText("Detected contradictions")).toBeInTheDocument();
    expect(
      screen.getByText("strengthens -> not strengthen"),
    ).toBeInTheDocument();
  });

  it("shows the matched Accepted Variant and undetected expected terms when variant matching is used", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const studyNote = createRecallableStudyNote(contexts, {
      acceptedVariants: [
        {
          id: "variant-retrieval",
          text: "Repeated retrieval makes long-term memory easier to access.",
        },
      ],
      expectedAnswer:
        "Retrieval practice strengthens access to long-term memory.",
      prompt: "What does retrieval practice strengthen?",
      sourceBody: "Broader retrieval practice source context.",
      sourceTitle: "Retrieval practice source",
    });
    contexts.recallContext.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId: testUser.id,
    });

    renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Write answer" }),
    );
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: {
        value: "Repeated retrieval makes long term memory easier to access.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reveal Study Note" }));

    expect(screen.getByText("Matched Accepted Variant")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Repeated retrieval makes long-term memory easier to access.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Not detected by heuristics")).toBeInTheDocument();
    expect(screen.getByText("practice")).toBeInTheDocument();
    expect(screen.getByText("strengthens")).toBeInTheDocument();
  });
  it("saves an eligible typed answer as an Accepted Variant only after explicit confirmation", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const studyNote = createRecallableStudyNote(contexts, {
      expectedAnswer:
        "Retrieval practice strengthens access to long-term memory.",
      prompt: "What does retrieval practice strengthen?",
      sourceBody: "Broader retrieval practice source context.",
      sourceTitle: "Retrieval practice source",
    });
    contexts.recallContext.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId: testUser.id,
    });

    renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Write answer" }),
    );
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: {
        value: "Repeated retrieval makes long-term memory easier to access.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reveal Study Note" }));

    expect(
      screen.queryByText("Save this answer as an Accepted Variant?"),
    ).toBeNull();
    expect(
      contexts.studyNotesContext.getSnapshot()[0]?.acceptedVariants,
    ).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Good" }));

    expect(
      await screen.findByText("Save this answer as an Accepted Variant?"),
    ).toBeInTheDocument();
    expect(
      contexts.studyNotesContext.getSnapshot()[0]?.acceptedVariants,
    ).toEqual([]);

    fireEvent.click(
      screen.getByRole("button", { name: "Save Accepted Variant" }),
    );

    expect(
      contexts.studyNotesContext.getSnapshot()[0]?.acceptedVariants,
    ).toEqual([
      expect.objectContaining({
        text: "Repeated retrieval makes long-term memory easier to access.",
      }),
    ]);
  });

  it("does not auto-save an eligible answer when the user continues without confirming", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const studyNote = createRecallableStudyNote(contexts, {
      expectedAnswer:
        "Retrieval practice strengthens access to long-term memory.",
      prompt: "What does retrieval practice strengthen?",
      sourceBody: "Broader retrieval practice source context.",
      sourceTitle: "Retrieval practice source",
    });
    contexts.recallContext.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId: testUser.id,
    });

    const { router } = renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Write answer" }),
    );
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: {
        value: "Repeated retrieval makes long-term memory easier to access.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reveal Study Note" }));
    fireEvent.click(screen.getByRole("button", { name: "Good" }));

    expect(
      await screen.findByText("Save this answer as an Accepted Variant?"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next Study Note" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/recall/results");
    });
    expect(
      contexts.studyNotesContext.getSnapshot()[0]?.acceptedVariants,
    ).toEqual([]);
  });

  it("does not offer Accepted Variant saving when a too-similar variant already exists", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const studyNote = createRecallableStudyNote(contexts, {
      acceptedVariants: [
        {
          id: "variant-retrieval",
          text: "Repeated retrieval makes long-term memory easier to access.",
        },
      ],
      expectedAnswer:
        "Retrieval practice strengthens access to long-term memory.",
      prompt: "What does retrieval practice strengthen?",
      sourceBody: "Broader retrieval practice source context.",
      sourceTitle: "Retrieval practice source",
    });
    contexts.recallContext.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId: testUser.id,
    });

    renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Write answer" }),
    );
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: {
        value: "Repeated retrieval makes long term memory easier to access.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reveal Study Note" }));
    fireEvent.click(screen.getByRole("button", { name: "Good" }));

    expect(
      screen.queryByText("Save this answer as an Accepted Variant?"),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Save Accepted Variant" }),
    ).toBeNull();
  });

  it("satisfies a completed Practice Follow-up only after the targeted recall attempt is rated", async () => {
    vi.useFakeTimers();

    const contexts = createDeterministicRecallTestContexts();
    const studyNote = contexts.studyNotesContext.createStudyNote(testUser.id, {
      expectedAnswer: "ATP stores transferable energy for cells.",
      prompt: "What stores transferable energy?",
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration source",
    });

    completeStudyNoteRecallAt({
      rating: "hard",
      recallContext: contexts.recallContext,
      studyNoteId: studyNote.id,
      timestamp: "2026-05-16T09:00:00.000Z",
    });

    const confirmedResult = confirmStudyNotePracticeRepair({
      contexts,
      correction:
        "State ATP directly and anchor the answer to energy transfer.",
      studyNoteId: studyNote.id,
    });
    const originalReference =
      getConfirmedPracticeRepairReference(confirmedResult);

    vi.setSystemTime(new Date("2026-05-16T09:05:00.000Z"));

    contexts.recallContext.completePracticeRepairEntry({
      reference: originalReference,
      userId: testUser.id,
    });

    vi.setSystemTime(new Date("2026-05-16T09:10:00.000Z"));

    contexts.recallContext.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId: testUser.id,
    });

    vi.useRealTimers();

    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: originalReference,
        userId: testUser.id,
      })[0]?.followUpSatisfaction,
    ).toBeUndefined();

    const { router } = renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Reveal Study Note",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Hard" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Study Note" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/recall/results");
    });
    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: originalReference,
        userId: testUser.id,
      })[0],
    ).toMatchObject({
      followUpSatisfaction: {
        questionReference: {
          studyNoteId: studyNote.id,
        },
        rating: "hard",
        satisfiedAt: expect.any(String),
      },
      lifecycle: {
        completedAt: "2026-05-16T09:05:00.000Z",
        followUpSatisfiedAt: expect.any(String),
      },
    });
  });

  it("uses FlashCard session self-rating semantics in selected Results review", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const note = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Reference answer body.",
      title: "Self rating result note",
    });
    contexts.recallContext.startFlashCardSession({
      noteIds: [note.id],
      userId: testUser.id,
    });

    const { router } = renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    expect(
      await screen.findByText(
        "Try to recall this Study Note before revealing it.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reveal Study Note" }));
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Study Note" }));

    expect(router.state.location.pathname).toBe("/recall/results");
    const selectedResult = await screen.findByRole("region", {
      name: "Selected result",
    });

    expect(
      within(selectedResult).getByText("Session self rating"),
    ).toBeInTheDocument();
    expect(within(selectedResult).getByText("75%")).toBeInTheDocument();
    expect(within(selectedResult).queryByText("Score")).toBeNull();
  });

  it("keeps Session self rating visible on tight layouts while only showing rating distribution when space stays calm", async () => {
    setViewportWidth(960);

    const contexts = createDeterministicRecallTestContexts();
    const notes = [
      createRecallNote(contexts.notesContext, testUser.id, {
        body: "Reference body for forgot.",
        title: "Forgot prompt",
      }),
      createRecallNote(contexts.notesContext, testUser.id, {
        body: "Reference body for hard.",
        title: "Hard prompt",
      }),
      createRecallNote(contexts.notesContext, testUser.id, {
        body: "Reference body for good.",
        title: "Good prompt",
      }),
      createRecallNote(contexts.notesContext, testUser.id, {
        body: "Reference body for easy.",
        title: "Easy prompt",
      }),
    ];

    completeMultiQuestionRecall({
      questions: [
        { noteId: notes[0].id, rating: "forgot" },
        { noteId: notes[1].id, rating: "hard" },
        { noteId: notes[2].id, rating: "good" },
        { noteId: notes[3].id, rating: "easy" },
      ],
      recallContext: contexts.recallContext,
      timestamp: "2026-04-05T09:00:00.000Z",
    });

    renderRoute("/recall/results", {
      ...contexts,
      session: createSession(),
    });

    const detail = await screen.findByRole("region", {
      name: "Selected result",
    });
    const detailScope = within(detail);
    const distributionLabel = "Easy 1 · Good 1 · Hard 1 · Forgot 1";

    expect(detailScope.getByText("Session self rating")).toBeInTheDocument();
    expect(detailScope.getByText("56%")).toBeInTheDocument();
    expect(detailScope.getByText(distributionLabel)).toBeInTheDocument();

    setViewportWidth(640);

    await waitFor(() => {
      expect(detailScope.getByText("Session self rating")).toBeInTheDocument();
      expect(detailScope.getByText("56%")).toBeInTheDocument();
      expect(detailScope.queryByText(distributionLabel)).toBeNull();
    });
  });

  it("returns a zero-attempt session to Recall Today after confirmation", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const studyNote = createRecallableStudyNote(contexts, {
      expectedAnswer: "Expected answer stays recallable.",
      prompt: "Discarded session prompt",
      sourceBody: "Source context stays available for Recall Today.",
      sourceTitle: "Discarded session source",
    });
    contexts.recallContext.startFlashCardSession({
      studyNoteIds: [studyNote.id],
      userId: testUser.id,
    });

    const { router } = renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Recall session",
      }),
    ).toHaveClass("page-header__title");
    fireEvent.click(screen.getAllByRole("button", { name: "End session" })[0]);
    expect(
      screen.getByRole("dialog", { name: "Discard recall session?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard session" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/recall");
    });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Recall Today",
      }),
    ).toBeInTheDocument();
    const recallTodayQueue = screen.getByRole("region", {
      name: "Recall Today queue",
    });
    expect(recallTodayQueue).toHaveTextContent("Discarded session prompt");
    expect(recallTodayQueue).toHaveTextContent("Not recalled yet");
    expect(
      screen.getByRole("link", { name: "Manual selection" }),
    ).toHaveAttribute("href", "/recall/select");
    expect(
      contexts.recallContext.listSessionResults({ userId: testUser.id }),
    ).toEqual([]);
  });

  it("routes an early-ended attempted session to Results", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const firstNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "First routed result body.",
      title: "First routed result prompt",
    });
    const secondNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Second unreached body.",
      title: "Second unreached prompt",
    });
    contexts.recallContext.startFlashCardSession({
      noteIds: [firstNote.id, secondNote.id],
      userId: testUser.id,
    });

    const { router } = renderRoute("/recall/session", {
      ...contexts,
      session: createSession(),
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Reveal Study Note" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Study Note" }));

    fireEvent.click(screen.getAllByRole("button", { name: "End session" })[0]);
    const endDialog = screen.getByRole("dialog", {
      name: "End recall session?",
    });
    expect(endDialog).toBeInTheDocument();
    fireEvent.click(
      within(endDialog).getByRole("button", { name: "End session" }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/recall/results");
    });
    expect(
      await screen.findByText("Recall session saved to results"),
    ).toBeInTheDocument();
    expect(
      contexts.recallContext.listSessionResults({ userId: testUser.id }),
    ).toHaveLength(1);
  });

  it("shows session review headings and keeps recall restart actions in the master panel only", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const note = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Historical answer body.",
      title: "Historical prompt",
    });

    completeRecallAt({
      noteId: note.id,
      rating: "good",
      recallContext: contexts.recallContext,
      timestamp: "2026-04-04T09:00:00.000Z",
    });

    renderRoute("/recall/results", {
      ...contexts,
      session: createSession(),
    });

    const detail = await screen.findByRole("region", {
      name: "Selected result",
    });
    const detailScope = within(detail);

    expect(
      detailScope.getByRole("heading", { level: 4, name: "Session review" }),
    ).toBeInTheDocument();
    expect(
      detailScope.getByRole("heading", { level: 4, name: "Questions" }),
    ).toBeInTheDocument();
    expect(
      detailScope.getByText("Questions", { selector: "span" }),
    ).toBeInTheDocument();
    expect(detailScope.queryByText("Notes used")).toBeNull();
    expect(detailScope.queryByText("Not reached Study Notes")).toBeNull();
    expect(detailScope.getByText("1 Study Note")).toBeInTheDocument();
    expect(detailScope.getByText("1 question")).toBeInTheDocument();
    expect(detailScope.queryByText(/targeted Study Notes/i)).toBeNull();
    expect(
      detailScope.queryByRole("link", { name: "Back to selection" }),
    ).not.toBeInTheDocument();
    expect(
      detailScope.queryByRole("link", { name: "Start another recall" }),
    ).not.toBeInTheDocument();

    const restartLinks = screen.getAllByRole("link", {
      name: "Custom recall",
    });
    expect(restartLinks).toHaveLength(1);
  });

  it("shows early-ended coverage and only unreached note titles in Not reached Study Notes", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const firstNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "First historical answer.",
      title: "First targeted note",
    });
    const secondNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Second unreached answer.",
      title: "Second targeted note",
    });
    const thirdNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Third unreached answer.",
      title: "Third targeted note",
    });

    vi.setSystemTime(new Date("2026-04-06T09:00:00.000Z"));
    const session = contexts.recallContext.startFlashCardSession({
      noteIds: [firstNote.id, secondNote.id, thirdNote.id],
      userId: testUser.id,
    });
    contexts.recallContext.revealFlashCardAnswer({
      sessionId: session.id,
      userId: testUser.id,
    });
    contexts.recallContext.rateFlashCardAnswer({
      rating: "good",
      sessionId: session.id,
      userId: testUser.id,
    });
    contexts.recallContext.endFlashCardSession({
      sessionId: session.id,
      userId: testUser.id,
    });

    renderRoute("/recall/results", {
      ...contexts,
      session: createSession(),
    });

    const detail = await screen.findByRole("region", {
      name: "Selected result",
    });
    const detailScope = within(detail);
    const notReachedSection = detailScope
      .getByRole("heading", {
        level: 4,
        name: "Not reached Study Notes",
      })
      .closest("section");

    expect(detailScope.getByText("3 targeted Study Notes")).toBeInTheDocument();
    expect(
      detailScope.getByText("1 of 3 questions attempted"),
    ).toBeInTheDocument();
    expect(detailScope.queryByText("Notes used")).toBeNull();
    if (!(notReachedSection instanceof HTMLElement)) {
      throw new Error("Expected Not reached Study Notes section to exist.");
    }

    const notReachedScope = within(notReachedSection);

    expect(
      notReachedScope.getByText("Second targeted note"),
    ).toBeInTheDocument();
    expect(
      notReachedScope.getByText("Third targeted note"),
    ).toBeInTheDocument();
    expect(notReachedScope.queryByText("First targeted note")).toBeNull();
    expect(notReachedScope.queryByText("Second unreached answer.")).toBeNull();
    expect(notReachedScope.queryByText("Third unreached answer.")).toBeNull();
  });

  it("shows FlashCard Questions as a collapsed single-open-row accordion with self-rating pills", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const firstNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Reference answer for the first question.",
      title: "First historical prompt",
    });
    const secondNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Reference answer for the second question.",
      title: "Second historical prompt",
    });

    completeMultiQuestionRecall({
      questions: [
        {
          noteId: firstNote.id,
          rating: "hard",
          typedAnswer: "Learner answer for the first question.",
        },
        {
          noteId: secondNote.id,
          rating: "easy",
          typedAnswer: "Learner answer for the second question.",
        },
      ],
      recallContext: contexts.recallContext,
      timestamp: "2026-04-05T09:00:00.000Z",
    });

    renderRoute("/recall/results", {
      ...contexts,
      session: createSession(),
    });

    const detail = await screen.findByRole("region", {
      name: "Selected result",
    });
    const detailScope = within(detail);
    const firstQuestion = detailScope.getByRole("button", {
      name: /First historical prompt/i,
    });
    const secondQuestion = detailScope.getByRole("button", {
      name: /Second historical prompt/i,
    });

    expect(firstQuestion).toHaveAttribute("aria-expanded", "false");
    expect(secondQuestion).toHaveAttribute("aria-expanded", "false");
    expect(
      detailScope.queryByText("Reference answer for the first question."),
    ).toBeNull();
    expect(detailScope.getByText("Hard")).toBeInTheDocument();
    expect(detailScope.getByText("Easy")).toBeInTheDocument();

    fireEvent.click(firstQuestion);

    expect(
      (await screen.findAllByText("Reference answer for the first question."))
        .length,
    ).toBeGreaterThan(0);
    expect(
      detailScope.getByRole("button", { name: /First historical prompt/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(detailScope.getByText("Your answer")).toBeInTheDocument();

    fireEvent.click(secondQuestion);

    expect(
      detailScope.getByRole("button", { name: /First historical prompt/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      detailScope.getByRole("button", { name: /Second historical prompt/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      detailScope.queryByText("Reference answer for the first question."),
    ).toBeNull();
    expect(
      detailScope.getAllByText("Reference answer for the second question.")
        .length,
    ).toBeGreaterThan(0);
  });

  it("shows expanded historical detail with repeated self-rating, exact typed text, and empty-answer fallback", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const firstNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Historical reference body line one.\nHistorical reference body line two.",
      title: "Exact answer prompt",
    });
    const secondNote = createRecallNote(contexts.notesContext, testUser.id, {
      body: "Reference note for empty typed answer.",
      title: "Empty answer prompt",
    });

    completeMultiQuestionRecall({
      questions: [
        {
          noteId: firstNote.id,
          rating: "good",
          typedAnswer:
            "  Learner line one.\nLearner line two with spaces preserved.  ",
        },
        {
          noteId: secondNote.id,
          rating: "forgot",
          typedAnswer: "   ",
        },
      ],
      recallContext: contexts.recallContext,
      timestamp: "2026-04-05T09:00:00.000Z",
    });

    renderRoute("/recall/results", {
      ...contexts,
      session: createSession(),
    });

    const detail = await screen.findByRole("region", {
      name: "Selected result",
    });
    const detailScope = within(detail);
    const exactAnswerQuestion = detailScope.getByRole("button", {
      name: /Exact answer prompt/i,
    });
    const emptyAnswerQuestion = detailScope.getByRole("button", {
      name: /Empty answer prompt/i,
    });

    fireEvent.click(exactAnswerQuestion);

    const detailPanel = getControlledPanel(exactAnswerQuestion);
    const selfRatingBlock = getDetailBlockByLabel(detailPanel, "Self rating");
    const answerBlock = getDetailBlockByLabel(detailPanel, "Your answer");
    const expectedAnswerBlock = getDetailBlockByLabel(
      detailPanel,
      "Expected answer",
    );
    const referenceBlock = getDetailBlockByLabel(
      detailPanel,
      "Reference explanation",
    );

    expect(selfRatingBlock).toHaveTextContent("Good");
    expect(
      selfRatingBlock.compareDocumentPosition(answerBlock) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      answerBlock.compareDocumentPosition(expectedAnswerBlock) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      expectedAnswerBlock.compareDocumentPosition(referenceBlock) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(getDetailBlockCopy(answerBlock).textContent).toBe(
      "  Learner line one.\nLearner line two with spaces preserved.  ",
    );
    expect(getDetailBlockCopy(expectedAnswerBlock).textContent).toBe(
      "Historical reference body line one.\nHistorical reference body line two.",
    );

    fireEvent.click(emptyAnswerQuestion);

    const emptyDetailPanel = getControlledPanel(emptyAnswerQuestion);
    expect(emptyAnswerQuestion).toHaveAttribute("aria-expanded", "true");
    expect(emptyDetailPanel).toHaveTextContent("No typed answer recorded");
    expect(emptyDetailPanel).toHaveTextContent(
      "Reference note for empty typed answer.",
    );
  });

  it("redirects direct /recall/session visits without an active session", async () => {
    const { router } = renderRoute("/recall/session", {
      session: createSession(),
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Recall Today",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
  });
});
