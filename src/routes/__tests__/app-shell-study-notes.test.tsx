// @vitest-environment jsdom

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppFocusContext } from "../../modules/focus";
import {
  type AppLabel,
  createAppLabelsContext,
} from "../../modules/labels/label-management/labels";
import {
  type AppPersistentLabelsService,
  createPersistentLabelsContext,
  createReadonlyLabelsContext,
} from "../../modules/labels/persistent-labels";
import { createAppNotesContext } from "../../modules/notes";
import {
  createAppRecallContext,
  type RecallSelfRating,
  type SessionResult,
} from "../../modules/recall";
import {
  createPracticeRepairEntryId,
  type PracticeRepairIntent,
} from "../../modules/recall/recall-practice-repair";
import {
  createAppStudyNotesContext,
  unlabeledStudyNotesFilterValue,
} from "../../modules/study-notes";
import {
  type AppSessionSnapshot,
  createDeterministicRecallTestContexts,
  renderRoute,
} from "./app-shell-test-support";

function createUnusedPersistentLabelMutation() {
  return async () => {
    throw new Error("This persistent label mutation should not be called.");
  };
}

const studyNoteExpectedAnswerPlaceholder =
  "Explain the reason, steps, limits, and one example or non-example.";
const studyNoteMetaphorPlaceholder = "Compare it to something familiar.";
const studyNoteAcronymPlaceholder = "Initials that cue the answer.";
const studyNotePromptPlaceholder =
  "Why does this work? How would I use it? What example proves it?";

function getDisclosureDetails(region: HTMLElement) {
  const details = region.querySelector("details");

  if (!(details instanceof HTMLDetailsElement)) {
    throw new Error("Expected region to contain disclosure details.");
  }

  return details;
}

type DeterministicRecallTestContexts = ReturnType<
  typeof createDeterministicRecallTestContexts
>;
type StudyNotesRouteTestRouter = ReturnType<typeof renderRoute>["router"];

type StudyNoteSnapshotInput = {
  expectedAnswer: string;
  labelIds?: string[];
  prompt: string;
  sourceBody: string;
  sourceTitle: string;
};

function updateStudyNoteSnapshot(
  contexts: DeterministicRecallTestContexts,
  input: StudyNoteSnapshotInput & {
    studyNoteId: string;
    userId: string;
  },
) {
  return contexts.studyNotesContext.updateStudyNote(
    input.userId,
    input.studyNoteId,
    {
      acceptedVariants: [],
      acronyms: [],
      expectedAnswer: input.expectedAnswer,
      keyIdeas: [],
      labelIds: input.labelIds ?? [],
      metaphors: [],
      prompt: input.prompt,
      prohibitedPhrases: [],
      sourceBody: input.sourceBody,
      sourceTitle: input.sourceTitle,
    },
  );
}

function createStudyNoteSnapshot(
  contexts: DeterministicRecallTestContexts,
  input: StudyNoteSnapshotInput & {
    userId: string;
  },
) {
  const studyNote = contexts.studyNotesContext.createStudyNote(input.userId, {
    sourceBody: input.sourceBody,
    sourceTitle: input.sourceTitle,
  });

  return updateStudyNoteSnapshot(contexts, {
    ...input,
    studyNoteId: studyNote.id,
  });
}

function createSiblingStudyNoteSnapshot(
  contexts: DeterministicRecallTestContexts,
  input: StudyNoteSnapshotInput & {
    sourceNoteId: string;
    userId: string;
  },
) {
  const studyNote = contexts.studyNotesContext.createStudyNoteFromSource(
    input.userId,
    {
      sourceNoteId: input.sourceNoteId,
    },
  );

  return updateStudyNoteSnapshot(contexts, {
    ...input,
    studyNoteId: studyNote.id,
  });
}

function completeStudyNoteRecall(
  contexts: DeterministicRecallTestContexts,
  input: {
    rating: RecallSelfRating;
    studyNoteId: string;
    userId: string;
  },
) {
  act(() => {
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

function completeStudyNoteRecallAt(
  contexts: DeterministicRecallTestContexts,
  input: {
    rating: RecallSelfRating;
    studyNoteId: string;
    timestamp: string;
    userId: string;
  },
) {
  const { timestamp, ...recallInput } = input;

  vi.setSystemTime(new Date(timestamp));
  completeStudyNoteRecall(contexts, recallInput);
}

function completeTypedStudyNoteRecallAt(
  contexts: DeterministicRecallTestContexts,
  input: {
    rating: RecallSelfRating;
    studyNoteId: string;
    timestamp: string;
    typedAnswer: string;
    userId: string;
  },
) {
  vi.setSystemTime(new Date(input.timestamp));

  act(() => {
    const session = contexts.recallContext.startFlashCardSession({
      studyNoteIds: [input.studyNoteId],
      userId: input.userId,
    });

    contexts.recallContext.updateFlashCardAttemptText({
      sessionId: session.id,
      text: input.typedAnswer,
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
  const result = contexts.recallContext.listSessionResults({
    userId: input.userId,
  })[0];
  const questionResultId = result?.questions[0]?.questionResultId;

  if (result === undefined || questionResultId === undefined) {
    throw new Error("Expected a stored weak-recall result with a question id.");
  }

  let updatedResult: SessionResult | null = null;

  act(() => {
    updatedResult = contexts.recallContext.confirmPracticeRepairEntry({
      correction: input.correction,
      intent: input.intent,
      reference: {
        questionIndex: 0,
        questionResultId,
        sessionResultId: result.id,
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

function getConfirmedPracticeRepairReference(result: SessionResult) {
  const reference = result.questions[0]?.practiceRepairEntry?.reference;

  if (reference === undefined) {
    throw new Error(
      "Expected a confirmed Practice Repair reference in history.",
    );
  }

  return reference;
}

function getConfirmedPracticeRepairEntryId(result: SessionResult) {
  const entryId =
    result.questions[0]?.practiceRepairEntry?.practiceRepairEntryId;

  if (entryId === undefined) {
    throw new Error("Expected a durable Practice Repair Entry id.");
  }

  return entryId;
}

function getPracticeRepairEntryPath(
  reference: NonNullable<
    SessionResult["questions"][number]["practiceRepairEntry"]
  >["reference"],
) {
  return `/practice-repair/${createPracticeRepairEntryId(reference)}`;
}

function getStudyNoteEditorPath(studyNoteId: string) {
  return `/study-notes/${studyNoteId}`;
}

function expectPracticeRepairReturnLink(
  reference: NonNullable<
    SessionResult["questions"][number]["practiceRepairEntry"]
  >["reference"],
) {
  expect(
    screen.getByRole("link", { name: "Return to Practice Repair" }),
  ).toHaveAttribute("href", getPracticeRepairEntryPath(reference));
}

function _getActivePracticeRepairEntry(name: string) {
  const activePracticeRepair = screen.getByRole("region", {
    name: "Active Practice Repair",
  });

  return within(activePracticeRepair).getByRole("article", { name });
}

function getCreatedSiblingStudyNote(
  contexts: DeterministicRecallTestContexts,
  originalStudyNote: ReturnType<typeof createStudyNoteSnapshot>,
) {
  const createdSibling = contexts.studyNotesContext
    .getSnapshot()
    .find(
      (studyNote) =>
        studyNote.id !== originalStudyNote.id &&
        studyNote.sourceNoteId === originalStudyNote.sourceNoteId,
    );

  if (createdSibling === undefined) {
    throw new Error("Expected a sibling Study Note from the original source.");
  }

  return createdSibling;
}

function renderLinkedPracticeRepairRoute(input: {
  contexts: DeterministicRecallTestContexts;
  correction: string;
  displayName: string;
  email: string;
  intent: PracticeRepairIntent;
  otherExpectedAnswer?: string;
  rating: RecallSelfRating;
  sourceBody: string;
  sourceTitle: string;
  userId: string;
}) {
  createStudyNoteSnapshot(input.contexts, {
    expectedAnswer: input.otherExpectedAnswer ?? "Unrelated answer.",
    prompt: "Another Study Note",
    sourceBody: "Another source body.",
    sourceTitle: "Another source",
    userId: input.userId,
  });
  const studyNote = createStudyNoteSnapshot(input.contexts, {
    expectedAnswer: "Original expected answer.",
    prompt: "Original prompt",
    sourceBody: input.sourceBody,
    sourceTitle: input.sourceTitle,
    userId: input.userId,
  });

  completeStudyNoteRecall(input.contexts, {
    rating: input.rating,
    studyNoteId: studyNote.id,
    userId: input.userId,
  });
  const confirmedResult = confirmStudyNotePracticeRepair(input.contexts, {
    correction: input.correction,
    intent: input.intent,
    studyNoteId: studyNote.id,
    userId: input.userId,
  });
  const practiceRepairEntryId =
    getConfirmedPracticeRepairEntryId(confirmedResult);
  const { router } = renderRoute(
    `${getStudyNoteEditorPath(studyNote.id)}?practiceRepairEntryId=${practiceRepairEntryId}&practiceRepairAction=${input.intent}`,
    {
      ...input.contexts,
      session: {
        user: {
          displayName: input.displayName,
          email: input.email,
          id: input.userId,
          userLanguage: "en",
        },
      },
    },
  );

  return {
    confirmedReference: getConfirmedPracticeRepairReference(confirmedResult),
    practiceRepairEntryId,
    router,
    studyNote,
  };
}

async function returnToCompletedPracticeRepairWorkspace(
  router: StudyNotesRouteTestRouter,
  reference: NonNullable<
    SessionResult["questions"][number]["practiceRepairEntry"]
  >["reference"],
) {
  fireEvent.click(
    screen.getByRole("link", { name: "Return to Practice Repair" }),
  );

  await waitFor(() =>
    expect(router.state.location.pathname).toBe(
      getPracticeRepairEntryPath(reference),
    ),
  );
  expect(
    await screen.findByRole("complementary", {
      name: "Practice Repair actions",
    }),
  ).toHaveTextContent("Recall again soon");
}

function renderStudyNotesRouteForUser(
  contexts: DeterministicRecallTestContexts,
  user: NonNullable<AppSessionSnapshot["user"]>,
) {
  renderRoute("/study-notes", {
    ...contexts,
    session: { user },
  });
}

function renderStudyNotesRoutePathForUser(
  path: string,
  contexts: DeterministicRecallTestContexts,
  user: NonNullable<AppSessionSnapshot["user"]>,
) {
  renderRoute(path, {
    ...contexts,
    session: { user },
  });
}

function createRecallTodayStudyNotesScenario(
  contexts: DeterministicRecallTestContexts,
  userId: string,
) {
  const practiceFollowUpStudyNote = createStudyNoteSnapshot(contexts, {
    expectedAnswer: "ATP stores transferable energy for cells.",
    prompt: "What stores transferable energy?",
    sourceBody: "Cell respiration source context.",
    sourceTitle: "Cell respiration source",
    userId,
  });
  const needsPracticeStudyNote = createStudyNoteSnapshot(contexts, {
    expectedAnswer: "Mitochondria generate ATP.",
    prompt: "What organelle generates ATP?",
    sourceBody: "Cell organelles source context.",
    sourceTitle: "Cell organelles source",
    userId,
  });
  createStudyNoteSnapshot(contexts, {
    expectedAnswer: "Fresh recall answer.",
    prompt: "Not recalled prompt",
    sourceBody: "Fresh recall source.",
    sourceTitle: "Fresh recall source",
    userId,
  });
  const dueForRecallStudyNote = createStudyNoteSnapshot(contexts, {
    expectedAnswer: "Due answer.",
    prompt: "Due prompt",
    sourceBody: "Due source.",
    sourceTitle: "Due source",
    userId,
  });
  createStudyNoteSnapshot(contexts, {
    expectedAnswer: " ",
    prompt: "Selected incomplete prompt",
    sourceBody: "Incomplete source.",
    sourceTitle: "Incomplete source",
    userId,
  });

  completeStudyNoteRecallAt(contexts, {
    rating: "hard",
    studyNoteId: practiceFollowUpStudyNote.id,
    timestamp: "2024-05-14T09:00:00.000Z",
    userId,
  });
  const confirmedRepair = confirmStudyNotePracticeRepair(contexts, {
    correction: "State ATP and explain that it stores transferable energy.",
    intent: "tighten-expected-answer",
    studyNoteId: practiceFollowUpStudyNote.id,
    userId,
  });
  contexts.recallContext.completePracticeRepairEntry({
    reference: getConfirmedPracticeRepairReference(confirmedRepair),
    userId,
  });

  completeStudyNoteRecallAt(contexts, {
    rating: "hard",
    studyNoteId: needsPracticeStudyNote.id,
    timestamp: "2024-05-14T10:00:00.000Z",
    userId,
  });
  completeStudyNoteRecallAt(contexts, {
    rating: "good",
    studyNoteId: dueForRecallStudyNote.id,
    timestamp: "2024-05-11T11:00:00.000Z",
    userId,
  });
  vi.setSystemTime(new Date("2024-05-15T10:00:00.000Z"));

  return {
    queuePrompts: [
      "What stores transferable energy?",
      "What organelle generates ATP?",
      "Not recalled prompt",
      "Due prompt",
    ],
    selectedStudyNotePrompt: "Selected incomplete prompt",
  } as const;
}

function createTestPersistentLabelsService(
  initialLabels: readonly AppLabel[],
): AppPersistentLabelsService {
  return {
    createLabel: vi.fn<AppPersistentLabelsService["createLabel"]>(
      createUnusedPersistentLabelMutation(),
    ),
    deleteLabel: vi.fn<AppPersistentLabelsService["deleteLabel"]>(
      createUnusedPersistentLabelMutation(),
    ),
    listLabels: vi.fn<AppPersistentLabelsService["listLabels"]>(async () =>
      [...initialLabels].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    ),
    renameLabel: vi.fn<AppPersistentLabelsService["renameLabel"]>(
      createUnusedPersistentLabelMutation(),
    ),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("authenticated Study Notes workspace", () => {
  it("loads a Study Note from the dedicated editor URL and focuses the expected answer field", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const user = {
      displayName: "Study Notes User",
      email: "study-notes@example.com",
      id: "study-notes-url-focus-user",
      userLanguage: "en",
      userTimeZone: "UTC",
    } as const;
    createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Already complete.",
      prompt: "Complete Study Note",
      sourceBody: "Complete source.",
      sourceTitle: "Complete source",
      userId: user.id,
    });
    const incompleteStudyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "",
      prompt: "Incomplete Study Note",
      sourceBody: "Incomplete source.",
      sourceTitle: "Incomplete source",
      userId: user.id,
    });

    renderStudyNotesRoutePathForUser(
      `${getStudyNoteEditorPath(incompleteStudyNote.id)}?focus=expected-answer`,
      contexts,
      user,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Incomplete Study Note",
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("Expected answer")).toHaveFocus(),
    );
  });

  it("renders Study Notes as the primary workspace with source context below the Study Note fields", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    studyNotesContext.createStudyNote(userId, {
      acronyms: [{ description: "RP means Retrieval Practice." }],
      metaphors: [{ description: "A trail gets clearer with each walk." }],
      prompt: "Retrieval practice",
      sourceBody: "Testing retrieval strengthens durable recall.",
      sourceTitle: "Retrieval practice source",
    });

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    const pageHeading = await screen.findByRole("heading", {
      level: 1,
      name: "Study Notes",
    });
    expect(pageHeading).toHaveClass("page-header__title");
    expect(
      screen.queryByText("Workspace", {
        selector: ".study-notes-workspace *",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Write stronger recall prompts with guidance and templates—no extra required fields.",
      ),
    ).toHaveClass("page-header__description");
    const newStudyNoteButton = screen.getByRole("button", {
      name: "New Study Note",
    });
    expect(newStudyNoteButton).toHaveClass("study-notes-new-note");
    expect(newStudyNoteButton).toHaveClass("notes-action-secondary");
    expect(newStudyNoteButton).toHaveTextContent("New note");
    expect(
      screen.queryByRole("button", { name: "More actions" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start Recall Session" }),
    ).toHaveClass("study-notes-start-recall");

    const catalog = screen.getByRole("complementary", {
      name: "Study Notes catalog",
    });
    expect(
      within(catalog).getByPlaceholderText("Search notes"),
    ).toBeInTheDocument();
    expect(
      within(catalog).getByRole("combobox", {
        name: "Filter Study Notes by label",
      }),
    ).toBeInTheDocument();
    expect(within(catalog).getByText("1 notes")).toBeInTheDocument();
    expect(
      within(catalog).getByRole("button", { name: "Recently updated" }),
    ).toBeInTheDocument();
    expect(
      within(catalog).getByRole("navigation", { name: "Study Notes list" }),
    ).toBeInTheDocument();
    expect(
      within(catalog).getByRole("button", { name: "Retrieval practice" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(catalog).getByRole("button", { name: "Retrieval practice" }),
    ).not.toHaveTextContent("Retrieval practice source");
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Add Study Note from this explanation",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Delete Study Note",
      }),
    ).toBeInTheDocument();

    const editor = screen.getByRole("form", {
      name: "Study Note editor surface",
    });
    expect(editor).toHaveAttribute("id", "study-note-editor-form");
    expect(
      within(editor).getByRole("heading", {
        level: 2,
        name: "Retrieval practice",
      }),
    ).toBeInTheDocument();
    expect(
      within(editor).queryByRole("button", {
        name: "New Study Note",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(editor).queryByText("Quick start with a template (optional)"),
    ).not.toBeInTheDocument();
    expect(
      within(editor).queryByRole("button", { name: "Why" }),
    ).not.toBeInTheDocument();
    expect(
      within(editor).queryByRole("button", { name: "Cause & effect" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("complementary", { name: "Study Note guidance" }),
    ).not.toBeInTheDocument();

    expect(screen.getByLabelText("Prompt")).toHaveValue("Retrieval practice");
    expect(screen.getByLabelText("Expected answer")).toHaveValue(
      "Testing retrieval strengthens durable recall.",
    );
    expect(screen.getByLabelText("Metaphor")).toHaveValue(
      "A trail gets clearer with each walk.",
    );
    expect(screen.getByLabelText("Acronym")).toHaveValue(
      "RP means Retrieval Practice.",
    );
    const noteTitleField = screen.getByLabelText("Note title");
    expect(noteTitleField).toBeInstanceOf(HTMLTextAreaElement);
    expect(noteTitleField.closest("label")).toHaveClass("study-notes-field");
    expect(noteTitleField).toHaveValue("Retrieval practice source");
    expect(screen.getByLabelText("Explanation")).toHaveValue(
      "Testing retrieval strengthens durable recall.",
    );
    expect(
      screen.getByPlaceholderText(studyNotePromptPlaceholder),
    ).toHaveAccessibleName("Prompt");
    expect(
      screen.getByPlaceholderText(studyNoteExpectedAnswerPlaceholder),
    ).toHaveAccessibleName("Expected answer");
    expect(
      screen.getByPlaceholderText(studyNoteMetaphorPlaceholder),
    ).toHaveAccessibleName("Metaphor");
    expect(
      screen.getByPlaceholderText(studyNoteAcronymPlaceholder),
    ).toHaveAccessibleName("Acronym");
    expect(screen.getByPlaceholderText("Note title")).toHaveAccessibleName(
      "Note title",
    );
    expect(screen.getByPlaceholderText("Explanation")).toHaveAccessibleName(
      "Explanation",
    );
    expect(
      screen.queryByRole("heading", { level: 2, name: "Memory hooks" }),
    ).not.toBeInTheDocument();
    const memoryAids = screen.getByRole("region", { name: "Memory aids" });
    expect(within(memoryAids).getByLabelText("Metaphor")).toHaveValue(
      "A trail gets clearer with each walk.",
    );
    expect(within(memoryAids).getByLabelText("Acronym")).toHaveValue(
      "RP means Retrieval Practice.",
    );
    expect(getDisclosureDetails(memoryAids)).toHaveAttribute("open");
    expect(screen.getByText("Reference explanation")).toBeInTheDocument();
    expect(
      getDisclosureDetails(
        screen.getByRole("region", { name: "Reference explanation" }),
      ),
    ).toHaveAttribute("open");
    const recallInsights = screen.getByRole("region", {
      name: "Recall insights",
    });
    expect(
      within(recallInsights).getByRole("heading", { level: 3, name: "New" }),
    ).toBeInTheDocument();
    expect(
      within(recallInsights).getByText("Not enough recall data yet."),
    ).toBeInTheDocument();
    expect(within(recallInsights).getByText("Next recall")).toBeInTheDocument();
    expect(within(recallInsights).getByText("Today")).toBeInTheDocument();
    expect(within(recallInsights).getByText("Last result")).toBeInTheDocument();
    expect(
      within(recallInsights).getByText("Suggested action"),
    ).toBeInTheDocument();
    expect(
      within(recallInsights).getByText("Recall today"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Recall schedule" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Learning state" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: "Reference explanation",
      }),
    ).not.toBeInTheDocument();
  });

  it("hides Study Note prompt templates when the account preference is disabled", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-template-preference-${Math.random()
        .toString(36)
        .slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-template-preference";

    studyNotesContext.createStudyNote(userId, {
      expectedAnswer: "Testing retrieval strengthens durable recall.",
      prompt: "Retrieval practice",
      sourceBody: "Testing retrieval strengthens durable recall.",
      sourceTitle: "Retrieval practice source",
    });

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          showStudyNoteTemplates: false,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    const editor = await screen.findByRole("form", {
      name: "Study Note editor surface",
    });

    expect(
      within(editor).queryByText("Quick start with a template (optional)"),
    ).not.toBeInTheDocument();
    expect(
      within(editor).queryByRole("button", { name: "Why" }),
    ).not.toBeInTheDocument();
  });

  it("shows Study Note prompt templates only for an empty prompt draft", async () => {
    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: "user-empty-template-draft",
          showStudyNoteTemplates: true,
          userLanguage: "en",
        },
      },
    });

    const editor = await screen.findByRole("form", {
      name: "Study Note editor surface",
    });

    expect(
      within(editor).getByText("Quick start with a template (optional)"),
    ).toBeInTheDocument();
    expect(within(editor).getByRole("button", { name: "Why" })).toBeVisible();
    expect(
      within(editor).getByRole("button", { name: "Cause & effect" }),
    ).toBeVisible();
  });

  it("loads persistent Labels on first direct Study Notes entry", async () => {
    const persistentLabelsService = createTestPersistentLabelsService([
      {
        id: "label-biology",
        name: "Biology",
      },
    ]);
    const persistentLabelsContext = createPersistentLabelsContext({
      service: persistentLabelsService,
    });
    const labelsContext = createReadonlyLabelsContext(persistentLabelsContext);
    const studyNotesContext = createAppStudyNotesContext({
      getOwnedLabelIdsForUser: (ownerId) =>
        labelsContext.getLabelsForUser(ownerId).map((label) => label.id),
      keyPrefix: `test-study-notes-persistent-labels-${Math.random()
        .toString(36)
        .slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-direct-study-notes-labels";

    studyNotesContext.createStudyNote(userId, {
      sourceBody: "Labels should be ready on direct Study Notes entry.",
      sourceTitle: "Direct labels hydration",
    });

    renderRoute("/study-notes", {
      labelsContext,
      persistentLabelsContext,
      session: {
        user: {
          displayName: "Jordan Labels",
          email: "jordan.labels@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Manage labels" }),
    );

    expect(await screen.findByLabelText("Biology")).toBeInTheDocument();
    expect(screen.queryByText("No Labels yet.")).not.toBeInTheDocument();
    expect(persistentLabelsService.listLabels).toHaveBeenCalledOnce();
  });

  it("hides the Study Note label manager when clicking outside it", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-labels-outside-click-${Math.random()
        .toString(36)
        .slice(2)}`,
      storage: window.localStorage,
    });
    const studyNotesContext = createAppStudyNotesContext({
      getOwnedLabelIdsForUser: (ownerId) =>
        labelsContext.getLabelsForUser(ownerId).map((label) => label.id),
      keyPrefix: `test-study-notes-outside-click-${Math.random()
        .toString(36)
        .slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-study-notes-label-outside-click";

    labelsContext.createLabel({
      name: "Biology",
      userId,
    });
    studyNotesContext.createStudyNote(userId, {
      sourceBody: "Outside clicks should close the label manager.",
      sourceTitle: "Label manager",
    });

    renderRoute("/study-notes", {
      labelsContext,
      session: {
        user: {
          displayName: "Jordan Labels",
          email: "jordan.label-close@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Manage labels" }),
    );
    expect(
      screen.getByRole("region", { name: "Study Note labels" }),
    ).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByLabelText("Biology"));
    expect(
      screen.getByRole("region", { name: "Study Note labels" }),
    ).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(
      screen.queryByRole("region", { name: "Study Note labels" }),
    ).not.toBeInTheDocument();
  });

  it("confirms Label deletion with the affected Study Note count and removes active assignments", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-label-delete-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const studyNotesContext = createAppStudyNotesContext({
      getOwnedLabelIdsForUser: (ownerId) =>
        labelsContext.getLabelsForUser(ownerId).map((label) => label.id),
      keyPrefix: `test-study-notes-label-delete-${Math.random()
        .toString(36)
        .slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-study-notes-label-delete";
    const biology = labelsContext.createLabel({
      name: "Biology",
      userId,
    });
    const history = labelsContext.createLabel({
      name: "History",
      userId,
    });

    studyNotesContext.createStudyNote(userId, {
      labelIds: [biology.id],
      sourceBody: "Concept grouping should stay visible.",
      sourceTitle: "Biology one",
    });
    studyNotesContext.createStudyNote(userId, {
      labelIds: [biology.id, history.id],
      sourceBody: "Deleting one Label should keep the other.",
      sourceTitle: "Biology two",
    });

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderRoute("/study-notes", {
      labelsContext,
      session: {
        user: {
          displayName: "Jordan Labels",
          email: "jordan.label-delete@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Manage labels" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Biology label" }),
    );

    expect(confirmSpy).toHaveBeenCalledWith(
      'Delete "Biology"? This will remove it from 2 active Study Notes. Historical SessionResult snapshots stay unchanged.',
    );

    await waitFor(() =>
      expect(labelsContext.getLabelsForUser(userId)).toEqual([
        expect.objectContaining({
          id: history.id,
          name: "History",
        }),
      ]),
    );
    await waitFor(() =>
      expect(screen.queryByLabelText("Biology")).not.toBeInTheDocument(),
    );
    expect(studyNotesContext.getSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labelIds: [],
        }),
        expect.objectContaining({
          labelIds: [history.id],
        }),
      ]),
    );

    confirmSpy.mockRestore();
  });

  it("keeps the Label and Study Note assignments unchanged when deletion is cancelled", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-label-delete-cancel-${Math.random()
        .toString(36)
        .slice(2)}`,
      storage: window.localStorage,
    });
    const studyNotesContext = createAppStudyNotesContext({
      getOwnedLabelIdsForUser: (ownerId) =>
        labelsContext.getLabelsForUser(ownerId).map((label) => label.id),
      keyPrefix: `test-study-notes-label-delete-cancel-${Math.random()
        .toString(36)
        .slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-study-notes-label-delete-cancel";
    const biology = labelsContext.createLabel({
      name: "Biology",
      userId,
    });

    studyNotesContext.createStudyNote(userId, {
      labelIds: [biology.id],
      sourceBody: "Cancelled deletion should leave this assignment untouched.",
      sourceTitle: "Biology one",
    });

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderRoute("/study-notes", {
      labelsContext,
      session: {
        user: {
          displayName: "Jordan Labels",
          email: "jordan.label-cancel@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Manage labels" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Biology label" }),
    );

    expect(confirmSpy).toHaveBeenCalledWith(
      'Delete "Biology"? This will remove it from 1 active Study Note. Historical SessionResult snapshots stay unchanged.',
    );
    expect(labelsContext.getLabelsForUser(userId)).toEqual([
      expect.objectContaining({
        id: biology.id,
        name: "Biology",
      }),
    ]);
    expect(screen.getByLabelText("Biology")).toBeInTheDocument();
    expect(studyNotesContext.getSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labelIds: [biology.id],
        }),
      ]),
    );

    confirmSpy.mockRestore();
  });

  it("creates from the dedicated create route and preserves Study Note and source fields after redirecting to the dedicated editor route", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";
    const { router } = renderRoute("/study-notes/new", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    await waitFor(() =>
      expect(screen.getByLabelText("Prompt")).toHaveValue(""),
    );
    expect(
      screen.getByPlaceholderText(studyNoteExpectedAnswerPlaceholder),
    ).toHaveValue("");
    fireEvent.click(screen.getByText("Reference explanation"));
    expect(screen.getByPlaceholderText("Explanation")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "What should I recall first?" },
    });
    const saveButton = screen.getByRole("button", { name: "Save changes" });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "Recall before reading." },
    });
    fireEvent.change(screen.getByLabelText("Metaphor"), {
      target: { value: "A spotlight on the exact recall target." },
    });
    fireEvent.change(screen.getByLabelText("Acronym"), {
      target: { value: "RBR means Recall Before Reading." },
    });
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "Edited source title" },
    });
    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "Edited source body." },
    });
    fireEvent.click(saveButton);

    const savedStudyNote = studyNotesContext.getSnapshot()[0];

    if (savedStudyNote === undefined) {
      throw new Error("Expected a saved Study Note.");
    }

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        getStudyNoteEditorPath(savedStudyNote.id),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull(),
    );
    expect(screen.getByLabelText("Prompt")).toHaveValue(
      "What should I recall first?",
    );
    expect(screen.getByLabelText("Expected answer")).toHaveValue(
      "Recall before reading.",
    );
    expect(screen.getByLabelText("Metaphor")).toHaveValue(
      "A spotlight on the exact recall target.",
    );
    expect(screen.getByLabelText("Acronym")).toHaveValue(
      "RBR means Recall Before Reading.",
    );
    expect(screen.getByLabelText("Note title")).toHaveValue(
      "Edited source title",
    );
    expect(screen.getByLabelText("Explanation")).toHaveValue(
      "Edited source body.",
    );
  });

  it("keeps the contextual save bar available for bottom-field edits and discard", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-save-bar-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-study-note-save-bar";

    studyNotesContext.createStudyNote(userId, {
      expectedAnswer: "Recall before rereading.",
      prompt: "What improves durable recall?",
      sourceBody: "Original source explanation.",
      sourceTitle: "Retrieval source",
    });

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Save Bar",
          email: "jordan.savebar@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    const editor = await screen.findByRole("form", {
      name: "Study Note editor surface",
    });
    expect(editor).toHaveAttribute("data-save-bar-visible", "false");

    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "Edited from the bottom of the editor." },
    });

    expect(editor).toHaveAttribute("data-save-bar-visible", "true");
    expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(screen.getByLabelText("Explanation")).toHaveValue(
      "Original source explanation.",
    );
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
    expect(editor).toHaveAttribute("data-save-bar-visible", "false");
  });

  it("keeps memory aids visible and raises a workspace save bar for their edits", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-memory-save-bar-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-study-note-memory-save-bar";

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Memory Bar",
          email: "jordan.memorybar@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "New Study Note" }),
    );

    const memoryAids = screen.getByRole("region", { name: "Memory aids" });
    expect(getDisclosureDetails(memoryAids)).not.toHaveAttribute("open");
    fireEvent.click(within(memoryAids).getByText("Memory aids"));
    expect(within(memoryAids).getByLabelText("Metaphor")).toHaveValue("");
    expect(within(memoryAids).getByLabelText("Acronym")).toHaveValue("");
    expect(
      screen.queryByRole("region", { name: "Unsaved Study Note changes" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "What makes recall durable?" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "Testing yourself before review strengthens recall." },
    });
    fireEvent.change(within(memoryAids).getByLabelText("Metaphor"), {
      target: { value: "A trail that gets clearer with each walk." },
    });
    fireEvent.change(within(memoryAids).getByLabelText("Acronym"), {
      target: { value: "TBR means Test Before Review." },
    });

    const saveBar = screen.getByRole("region", {
      name: "Unsaved Study Note changes",
    });
    expect(saveBar).toHaveTextContent("You have unsaved changes.");
    expect(saveBar.closest("form")).toBeNull();
    expect(
      within(saveBar).getByRole("button", { name: "Discard changes" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(saveBar).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );
    expect(studyNotesContext.getSnapshot()[0]).toMatchObject({
      acronyms: [{ description: "TBR means Test Before Review." }],
      metaphors: [{ description: "A trail that gets clearer with each walk." }],
      prompt: "What makes recall durable?",
    });
  });

  it("adds and updates answer-check reference material in the Study Note editor with stable IDs", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-answer-check-editor-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-study-note-answer-check-editor";

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Answer Check",
          email: "jordan.answercheck@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "New Study Note" }),
    );
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Why does retrieval practice help learning?" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: {
        value: "Practice recalling before review strengthens access to memory.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );

    const answerCheck = screen.getByRole("region", {
      name: "Answer-check reference material",
    });
    fireEvent.click(
      within(answerCheck).getByText("Answer-check reference material"),
    );
    fireEvent.click(
      within(answerCheck).getByRole("button", { name: "Add Key Idea" }),
    );
    fireEvent.change(within(answerCheck).getByLabelText("Key Idea"), {
      target: { value: "Practice recalling before review." },
    });
    fireEvent.click(within(answerCheck).getByText("Advanced phrase rules"));
    fireEvent.change(within(answerCheck).getByLabelText("Accepted phrases"), {
      target: { value: "recall before reading" },
    });
    fireEvent.change(within(answerCheck).getByLabelText("Prohibited phrases"), {
      target: { value: "just reread it" },
    });
    fireEvent.click(
      within(answerCheck).getByRole("button", { name: "Add Accepted Variant" }),
    );
    fireEvent.change(within(answerCheck).getByLabelText("Accepted Variant"), {
      target: { value: "Test yourself before rereading." },
    });
    fireEvent.click(
      within(answerCheck).getByRole("button", {
        name: "Add Prohibited Phrase",
      }),
    );
    fireEvent.change(within(answerCheck).getByLabelText("Prohibited Phrase"), {
      target: { value: "Recognition is enough." },
    });

    const saveBar = screen.getByRole("region", {
      name: "Unsaved Study Note changes",
    });
    expect(saveBar).toHaveTextContent("You have unsaved changes.");
    fireEvent.click(
      within(saveBar).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );

    const firstSavedStudyNote = studyNotesContext.getSnapshot()[0];

    expect(firstSavedStudyNote).toMatchObject({
      acceptedVariants: [
        {
          text: "Test yourself before rereading.",
        },
      ],
      keyIdeas: [
        {
          acceptedPhrases: ["recall before reading"],
          importance: "required",
          prohibitedPhrases: ["just reread it"],
          text: "Practice recalling before review.",
        },
      ],
      prohibitedPhrases: [
        {
          text: "Recognition is enough.",
        },
      ],
    });

    const keyIdeaId = firstSavedStudyNote.keyIdeas[0]?.id;
    const acceptedVariantId = firstSavedStudyNote.acceptedVariants[0]?.id;
    const prohibitedPhraseId = firstSavedStudyNote.prohibitedPhrases[0]?.id;

    if (
      keyIdeaId === undefined ||
      acceptedVariantId === undefined ||
      prohibitedPhraseId === undefined
    ) {
      throw new Error("Expected saved answer-check reference IDs.");
    }

    fireEvent.change(within(answerCheck).getByLabelText("Key Idea"), {
      target: { value: "Practice recalling before review with effort." },
    });
    fireEvent.change(within(answerCheck).getByLabelText("Accepted Variant"), {
      target: { value: "Try to recall it before rereading." },
    });
    fireEvent.change(within(answerCheck).getByLabelText("Prohibited Phrase"), {
      target: { value: "Recognition alone is enough." },
    });
    fireEvent.change(within(answerCheck).getByLabelText("Importance"), {
      target: { value: "supporting" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );

    expect(studyNotesContext.getSnapshot()[0]).toMatchObject({
      acceptedVariants: [
        {
          id: acceptedVariantId,
          text: "Try to recall it before rereading.",
        },
      ],
      keyIdeas: [
        {
          acceptedPhrases: ["recall before reading"],
          id: keyIdeaId,
          importance: "supporting",
          prohibitedPhrases: ["just reread it"],
          text: "Practice recalling before review with effort.",
        },
      ],
      prohibitedPhrases: [
        {
          id: prohibitedPhraseId,
          text: "Recognition alone is enough.",
        },
      ],
    });
  });

  it("infers editable answer-check suggestions in Study Notes without auto-activating them before save", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-study-note-answer-check-suggestions";
    const studyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer:
        "Retrieval practice strengthens memory access. It exposes gaps before review.",
      prompt: "Why does retrieval practice help learning?",
      sourceBody: "Broader retrieval practice source context.",
      sourceTitle: "Retrieval practice source",
      userId,
    });

    completeTypedStudyNoteRecallAt(contexts, {
      rating: "good",
      studyNoteId: studyNote.id,
      timestamp: "2026-05-20T09:00:00.000Z",
      typedAnswer:
        "Testing yourself strengthens access to memory before review.",
      userId,
    });
    completeTypedStudyNoteRecallAt(contexts, {
      rating: "hard",
      studyNoteId: studyNote.id,
      timestamp: "2026-05-19T09:00:00.000Z",
      typedAnswer: "Passive review is enough.",
      userId,
    });
    completeTypedStudyNoteRecallAt(contexts, {
      rating: "forgot",
      studyNoteId: studyNote.id,
      timestamp: "2026-05-18T09:00:00.000Z",
      typedAnswer: "Passive review is enough.",
      userId,
    });

    renderRoute("/study-notes", {
      ...contexts,
      session: {
        user: {
          displayName: "Jordan Suggestions",
          email: "jordan.suggestions@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Why does retrieval practice help learning?",
      }),
    );

    const answerCheck = screen.getByRole("region", {
      name: "Answer-check reference material",
    });
    fireEvent.click(
      within(answerCheck).getByText("Answer-check reference material"),
    );

    expect(
      contexts.studyNotesContext
        .getSnapshot()
        .find((note) => note.id === studyNote.id),
    ).toMatchObject({
      acceptedVariants: [],
      keyIdeas: [],
      prohibitedPhrases: [],
    });

    fireEvent.click(
      within(answerCheck).getByRole("button", { name: "Infer suggestions" }),
    );

    expect(
      within(answerCheck)
        .getAllByLabelText("Key Idea")
        .map((input) => (input as HTMLTextAreaElement).value),
    ).toEqual([
      "Retrieval practice strengthens memory access.",
      "It exposes gaps before review.",
    ]);
    expect(within(answerCheck).getByLabelText("Accepted Variant")).toHaveValue(
      "Testing yourself strengthens access to memory before review.",
    );
    expect(within(answerCheck).getByLabelText("Prohibited Phrase")).toHaveValue(
      "Passive review is enough.",
    );
    expect(
      screen.getByRole("region", { name: "Unsaved Study Note changes" }),
    ).toBeInTheDocument();
    expect(
      contexts.studyNotesContext
        .getSnapshot()
        .find((note) => note.id === studyNote.id),
    ).toMatchObject({
      acceptedVariants: [],
      keyIdeas: [],
      prohibitedPhrases: [],
    });

    fireEvent.change(within(answerCheck).getByLabelText("Accepted Variant"), {
      target: {
        value: "Testing yourself strengthens long-term memory before review.",
      },
    });
    fireEvent.click(
      within(answerCheck).getByRole("button", { name: "Discard suggestions" }),
    );

    expect(
      within(answerCheck).queryByLabelText("Accepted Variant"),
    ).not.toBeInTheDocument();
    expect(
      within(answerCheck).queryByLabelText("Prohibited Phrase"),
    ).not.toBeInTheDocument();
    expect(within(answerCheck).queryByLabelText("Key Idea")).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Unsaved Study Note changes" }),
    ).toBeNull();
    expect(
      contexts.studyNotesContext
        .getSnapshot()
        .find((note) => note.id === studyNote.id),
    ).toMatchObject({
      acceptedVariants: [],
      keyIdeas: [],
      prohibitedPhrases: [],
    });

    fireEvent.click(
      within(answerCheck).getByRole("button", { name: "Infer suggestions" }),
    );
    fireEvent.change(within(answerCheck).getByLabelText("Accepted Variant"), {
      target: {
        value: "Testing yourself strengthens long-term memory before review.",
      },
    });

    expect(
      contexts.studyNotesContext
        .getSnapshot()
        .find((note) => note.id === studyNote.id),
    ).toMatchObject({
      acceptedVariants: [],
      keyIdeas: [],
      prohibitedPhrases: [],
    });

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );
    expect(
      contexts.studyNotesContext
        .getSnapshot()
        .find((note) => note.id === studyNote.id),
    ).toMatchObject({
      acceptedVariants: [
        {
          text: "Testing yourself strengthens long-term memory before review.",
        },
      ],
      keyIdeas: [
        {
          text: "Retrieval practice strengthens memory access.",
        },
        {
          text: "It exposes gaps before review.",
        },
      ],
      prohibitedPhrases: [
        {
          text: "Passive review is enough.",
        },
      ],
    });
  });

  it("guards Study Note switching and can discard or save before switching", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-switch-guard-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-study-note-switch-guard";
    const first = studyNotesContext.createStudyNote(userId, {
      expectedAnswer: "First answer.",
      prompt: "First Study Note",
      sourceBody: "First source.",
      sourceTitle: "First source",
    });
    const second = studyNotesContext.createStudyNote(userId, {
      expectedAnswer: "Second answer.",
      prompt: "Second Study Note",
      sourceBody: "Second source.",
      sourceTitle: "Second source",
    });

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Switch",
          email: "jordan.switch@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "First Study Note" }),
    );
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Unsaved first prompt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Second Study Note" }));

    expect(
      screen.getByText("Save or discard changes before switching Study Notes"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "First Study Note" }),
    ).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Second Study Note" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard and switch" }));

    expect(screen.getByLabelText("Prompt")).toHaveValue("Second Study Note");
    expect(studyNotesContext.getSnapshot()).toContainEqual(
      expect.objectContaining({
        id: first.id,
        prompt: "First Study Note",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "First Study Note" }));
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "Saved before switching." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Second Study Note" }));
    fireEvent.click(screen.getByRole("button", { name: "Save and switch" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Prompt")).toHaveValue("Second Study Note"),
    );
    expect(studyNotesContext.getSnapshot()).toContainEqual(
      expect.objectContaining({
        expectedAnswer: "Saved before switching.",
        id: first.id,
      }),
    );
    expect(studyNotesContext.getSnapshot()).toContainEqual(
      expect.objectContaining({
        id: second.id,
        prompt: "Second Study Note",
      }),
    );
  });

  it("abandons a new unsaved Study Note draft on discard", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-new-discard-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-study-note-new-discard";

    studyNotesContext.createStudyNote(userId, {
      expectedAnswer: "Existing answer.",
      prompt: "Existing Study Note",
      sourceBody: "Existing source.",
      sourceTitle: "Existing source",
    });

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan New Discard",
          email: "jordan.new.discard@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "New Study Note" }),
    );
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Temporary draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(
      screen.getByRole("dialog", { name: "Discard this new Study Note?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Prompt")).toHaveValue("Temporary draft");

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Prompt")).toHaveValue(
        "Existing Study Note",
      ),
    );
    expect(studyNotesContext.getSnapshot()).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
  });

  it("creates a Study Note from /study-notes/new and redirects to its dedicated editor route", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-new-route-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-study-note-new-route";
    const { router } = renderRoute("/study-notes/new", {
      session: {
        user: {
          displayName: "Jordan New Route",
          email: "jordan.new.route@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    expect(await screen.findByLabelText("Prompt")).toHaveValue("");
    expect(screen.getByLabelText("Expected answer")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "What stores transferable energy for cell work?" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "ATP stores transferable energy for cell work." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(studyNotesContext.getSnapshot()).toHaveLength(1),
    );

    const createdStudyNote = studyNotesContext.getSnapshot()[0];

    if (createdStudyNote === undefined) {
      throw new Error("Expected a created Study Note.");
    }

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        getStudyNoteEditorPath(createdStudyNote.id),
      ),
    );
    expect(screen.getByLabelText("Prompt")).toHaveValue(
      "What stores transferable energy for cell work?",
    );
    expect(screen.getByLabelText("Expected answer")).toHaveValue(
      "ATP stores transferable energy for cell work.",
    );
  });

  it("edits an existing Study Note from /study-notes/$studyNoteId and saves the updated fields", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const user = {
      displayName: "Jordan Direct Edit",
      email: "jordan.direct.edit@example.com",
      id: "user-study-note-direct-edit",
      userLanguage: "en",
    } as const;
    const studyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Original expected answer.",
      prompt: "Original prompt",
      sourceBody: "Original source body.",
      sourceTitle: "Original source title",
      userId: user.id,
    });
    const { router } = renderRoute(getStudyNoteEditorPath(studyNote.id), {
      ...contexts,
      session: { user },
    });

    expect(await screen.findByLabelText("Prompt")).toHaveValue(
      "Original prompt",
    );
    expect(screen.getByLabelText("Expected answer")).toHaveValue(
      "Original expected answer.",
    );

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Updated prompt" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "Updated expected answer." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );
    expect(router.state.location.pathname).toBe(
      getStudyNoteEditorPath(studyNote.id),
    );
    expect(contexts.studyNotesContext.getSnapshot()).toContainEqual(
      expect.objectContaining({
        expectedAnswer: "Updated expected answer.",
        id: studyNote.id,
        prompt: "Updated prompt",
      }),
    );
  });

  it("shows a clear missing state for an unknown dedicated Study Note editor URL", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const user = {
      displayName: "Jordan Missing Note",
      email: "jordan.missing.note@example.com",
      id: "user-study-note-missing",
      userLanguage: "en",
    } as const;

    renderStudyNotesRoutePathForUser(
      getStudyNoteEditorPath("missing-study-note"),
      contexts,
      user,
    );

    expect(
      await screen.findByRole("heading", { name: "Study Note not found" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Prompt")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Back to Study Notes" }),
    ).toHaveAttribute("href", "/study-notes");
  });

  it("keeps optional support sections quiet until the user edits their fields", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-guidance-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-study-guidance";

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Guidance",
          email: "jordan.guidance@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "New Study Note" }),
    );

    expect(
      screen.getByPlaceholderText(studyNotePromptPlaceholder),
    ).toHaveAccessibleName("Prompt");
    expect(
      screen.getByPlaceholderText(studyNoteExpectedAnswerPlaceholder),
    ).toHaveAccessibleName("Expected answer");
    const memoryAids = screen.getByRole("region", { name: "Memory aids" });
    expect(getDisclosureDetails(memoryAids)).not.toHaveAttribute("open");
    fireEvent.click(within(memoryAids).getByText("Memory aids"));
    expect(
      within(memoryAids).queryByText(
        "Optional. Add one only when it would make this answer easier to recall.",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(memoryAids).getByPlaceholderText(studyNoteMetaphorPlaceholder),
    ).toHaveAccessibleName("Metaphor");
    expect(
      within(memoryAids).getByPlaceholderText(studyNoteAcronymPlaceholder),
    ).toHaveAccessibleName("Acronym");
    expect(
      getDisclosureDetails(
        screen.getByRole("region", { name: "Reference explanation" }),
      ),
    ).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Reference explanation"));
    expect(
      screen.queryByText("Worked examples belong here as source material."),
    ).not.toBeInTheDocument();
    expect(
      getDisclosureDetails(
        screen.getByRole("region", { name: "Reference explanation" }),
      ),
    ).toHaveAttribute("open");

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Why does retrieval before review improve memory?" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: {
        value:
          "It forces a retrieval attempt, exposes gaps, and makes feedback more useful.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );
    expect(studyNotesContext.getSnapshot()[0]).toMatchObject({
      acronyms: [],
      expectedAnswer:
        "It forces a retrieval attempt, exposes gaps, and makes feedback more useful.",
      metaphors: [],
      prompt: "Why does retrieval before review improve memory?",
    });
  });

  it("saves incomplete Study Notes with completion copy and blocks blank prompts", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "New Study Note" }),
    );
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "What needs an answer later?" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: " " },
    });
    fireEvent.click(screen.getByText("Reference explanation"));
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull(),
    );
    const incompleteRecallInsights = screen.getByRole("region", {
      name: "Recall insights",
    });
    expect(
      within(incompleteRecallInsights).getByRole("heading", {
        level: 3,
        name: "New",
      }),
    ).toBeInTheDocument();
    expect(
      within(incompleteRecallInsights).getByText(
        "Complete the note to enable recall.",
      ),
    ).toBeInTheDocument();
    expect(
      within(incompleteRecallInsights).getByText("Add expected answer"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Due for Recall")).not.toBeInTheDocument();

    const promptInput = screen.getByLabelText("Prompt");
    fireEvent.change(promptInput, {
      target: { value: " " },
    });
    await waitFor(() => expect(promptInput).toHaveValue(" "));
    fireEvent.click(
      await screen.findByRole("button", { name: "Save changes" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Prompt is required.",
    );
  });

  it("presents Metaphor and Acronym under Memory aids without a duplicate title", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-memory-aids-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    studyNotesContext.createStudyNote(userId, {
      expectedAnswer: "Testing retrieval strengthens durable recall.",
      prompt: "What strengthens durable recall?",
      sourceBody: "Testing retrieval strengthens durable recall.",
      sourceTitle: "Retrieval practice",
    });

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    const memoryAids = await screen.findByRole("region", {
      name: "Memory aids",
    });
    expect(getDisclosureDetails(memoryAids)).not.toHaveAttribute("open");
    fireEvent.click(within(memoryAids).getByText("Memory aids"));
    expect(within(memoryAids).getByLabelText("Metaphor")).toBeInTheDocument();
    expect(within(memoryAids).getByLabelText("Acronym")).toBeInTheDocument();
    expect(
      getDisclosureDetails(
        await screen.findByRole("region", {
          name: "Reference explanation",
        }),
      ),
    ).toHaveAttribute("open");
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: "Support descriptions",
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Memory hooks")).toBeNull();
  });

  it("keeps blank source Note titles blank while using the Study Note prompt in the catalog", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "New Study Note" }),
    );
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Oldest fallback prompt" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "Recall answer." },
    });
    fireEvent.click(screen.getByText("Reference explanation"));
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );
    expect(screen.getByLabelText("Note title")).toHaveValue("");
    expect(screen.getByLabelText("Note title")).toHaveAttribute(
      "placeholder",
      "Note title",
    );
    expect(
      screen.getByRole("button", { name: "Oldest fallback prompt" }),
    ).toHaveTextContent("Oldest fallback prompt");
    expect(studyNotesContext.getSnapshot()[0]?.source.title).toBe("");
  });

  it("captures saved Study Note work as Focus activity with source Note and Label context", async () => {
    const storage = window.localStorage;
    const keySuffix = Math.random().toString(36).slice(2);
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-study-notes-focus-labels-${keySuffix}`,
      storage,
    });
    const studyNotesContext = createAppStudyNotesContext({
      getOwnedLabelIdsForUser: (ownerId) =>
        labelsContext.getLabelsForUser(ownerId).map((label) => label.id),
      keyPrefix: `test-study-notes-focus-study-notes-${keySuffix}`,
      storage,
    });
    const focusContext = createAppFocusContext({
      keyPrefix: `test-study-notes-focus-focus-${keySuffix}`,
      storage,
    });
    const userId = "user-study-notes-focus";
    const biology = labelsContext.createLabel({ name: "Biology", userId });
    const studyNote = studyNotesContext.createStudyNote(userId, {
      labelIds: [biology.id],
      sourceBody: "Cell respiration source context.",
      sourceTitle: "Cell respiration",
    });

    focusContext.startFocusSession({
      focusIntervalMinutes: 25,
      userId,
    });

    renderRoute("/study-notes", {
      focusContext,
      labelsContext,
      session: {
        user: {
          displayName: "Jordan Focus",
          email: "jordan.focus@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.change(await screen.findByLabelText("Prompt"), {
      target: { value: "What molecule stores transferable energy?" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "ATP stores transferable energy." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );
    expect(focusContext.getActiveSession({ userId })?.targets).toMatchObject([
      {
        kind: "StudyNote",
        labels: [{ id: biology.id, name: "Biology" }],
        sourceNote: {
          body: "Cell respiration source context.",
          id: studyNote.sourceNoteId,
          title: "Cell respiration",
        },
        studyNote: {
          expectedAnswer: "ATP stores transferable energy.",
          id: studyNote.id,
          labelIds: [biology.id],
          prompt: "What molecule stores transferable energy?",
          sourceNoteId: studyNote.sourceNoteId,
        },
      },
    ]);
  });

  it("collapses empty reference material and detaches legacy shared source edits", async () => {
    const storage = window.localStorage;
    const keyPrefix = `test-study-notes-${Math.random().toString(36).slice(2)}`;
    storage.setItem(
      `${keyPrefix}:records`,
      JSON.stringify([
        {
          acronyms: [],
          createdAt: "2025-01-01T00:00:00.000Z",
          expectedAnswer: "First answer.",
          id: "study-one",
          labelIds: [],
          metaphors: [],
          prompt: "Quem é o rei de PT?",
          source: {
            body: "",
            id: "source-shared",
            title: "",
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
          sourceNoteId: "source-shared",
          updatedAt: "2025-01-01T00:00:02.000Z",
          userId: "user-jordan",
        },
        {
          acronyms: [],
          createdAt: "2025-01-01T00:00:01.000Z",
          expectedAnswer: "Second answer.",
          id: "study-two",
          labelIds: [],
          metaphors: [],
          prompt: "Workout PPL",
          source: {
            body: "",
            id: "source-shared",
            title: "",
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
          sourceNoteId: "source-shared",
          updatedAt: "2025-01-01T00:00:01.000Z",
          userId: "user-jordan",
        },
      ]),
    );
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix,
      storage,
    });
    const userId = "user-jordan";

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    expect(await screen.findByLabelText("Prompt")).toHaveValue(
      "Quem é o rei de PT?",
    );
    expect(
      screen.queryByText(/^Editing this explanation updates/),
    ).not.toBeInTheDocument();
    const referenceExplanation = screen.getByRole("region", {
      name: "Reference explanation",
    });
    expect(getDisclosureDetails(referenceExplanation)).not.toHaveAttribute(
      "open",
    );

    fireEvent.click(
      within(referenceExplanation).getByText("Reference explanation"),
    );
    fireEvent.change(screen.getByLabelText("Explanation"), {
      target: { value: "Only the selected Study Note source." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );

    const listedStudyNotes = studyNotesContext.getSnapshot();
    expect(
      listedStudyNotes.find((studyNote) => studyNote.id === "study-one"),
    ).toMatchObject({
      source: {
        body: "Only the selected Study Note source.",
      },
      sourceNoteId: expect.not.stringMatching(/^source-shared$/),
    });
    expect(
      listedStudyNotes.find((studyNote) => studyNote.id === "study-two"),
    ).toMatchObject({
      source: {
        body: "",
      },
      sourceNoteId: "source-shared",
    });
    expect(
      await screen.findAllByRole("button", {
        name: /Quem é o rei de PT\?|Workout PPL/,
      }),
    ).toHaveLength(2);
  });

  it("assigns, removes, and filters labels on Study Notes instead of source Notes", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-labels-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const studyNotesContext = createAppStudyNotesContext({
      getOwnedLabelIdsForUser: (ownerId) =>
        labelsContext.getLabelsForUser(ownerId).map((label) => label.id),
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";
    const biology = labelsContext.createLabel({
      name: "Biology",
      userId,
    });
    const history = labelsContext.createLabel({
      name: "History",
      userId,
    });
    const first = studyNotesContext.createStudyNote(userId, {
      labelIds: [biology.id],
      sourceBody: "Shared source context.",
      sourceTitle: "Biology recall",
    });
    studyNotesContext.createStudyNote(userId, {
      labelIds: [history.id],
      sourceBody: "Shared source context.",
      sourceTitle: "History recall",
    });

    renderRoute("/study-notes", {
      labelsContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.change(
      await screen.findByLabelText("Filter Study Notes by label"),
      {
        target: { value: biology.id },
      },
    );

    const catalog = screen.getByRole("complementary", {
      name: "Study Notes catalog",
    });
    expect(
      within(catalog).getByRole("button", { name: "Biology recall" }),
    ).toBeInTheDocument();
    expect(
      within(catalog).queryByRole("button", { name: "History recall" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Manage labels" }));
    fireEvent.click(screen.getByLabelText("Biology"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );
    expect(studyNotesContext.getSnapshot()).toContainEqual(
      expect.objectContaining({
        id: first.id,
        labelIds: [],
        source: expect.objectContaining({
          title: "Biology recall",
        }),
      }),
    );
    expect(
      within(catalog).queryByRole("button", { name: "Biology recall" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter Study Notes by label"), {
      target: { value: "" },
    });
    expect(
      within(catalog).getByRole("button", { name: "Biology recall" }),
    ).toBeInTheDocument();
  });

  it("reads the Study Notes label filter from the route search, including the unlabeled fallback", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-label-route-filter-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const studyNotesContext = createAppStudyNotesContext({
      getOwnedLabelIdsForUser: (ownerId) =>
        labelsContext.getLabelsForUser(ownerId).map((label) => label.id),
      keyPrefix: `test-study-notes-route-filter-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan-route-filter";
    const biology = labelsContext.createLabel({
      name: "Biology",
      userId,
    });
    const history = labelsContext.createLabel({
      name: "History",
      userId,
    });

    studyNotesContext.createStudyNote(userId, {
      labelIds: [biology.id],
      prompt: "Biology recall",
      sourceBody: "Biology source context.",
      sourceTitle: "Biology source",
    });
    studyNotesContext.createStudyNote(userId, {
      labelIds: [history.id],
      prompt: "History recall",
      sourceBody: "History source context.",
      sourceTitle: "History source",
    });
    studyNotesContext.createStudyNote(userId, {
      labelIds: [],
      prompt: "Unlabeled recall",
      sourceBody: "Unlabeled source context.",
      sourceTitle: "Unlabeled source",
    });

    const { router } = renderRoute(`/study-notes?labelId=${biology.id}`, {
      labelsContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan.route-filter@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    const labelFilter = await screen.findByLabelText(
      "Filter Study Notes by label",
    );
    const catalog = screen.getByRole("complementary", {
      name: "Study Notes catalog",
    });

    expect(labelFilter).toHaveValue(biology.id);
    expect(
      within(catalog).getByRole("button", { name: "Biology recall" }),
    ).toBeInTheDocument();
    expect(
      within(catalog).queryByRole("button", { name: "History recall" }),
    ).toBeNull();
    expect(
      within(catalog).queryByRole("button", { name: "Unlabeled recall" }),
    ).toBeNull();

    await router.navigate({
      search: { labelId: unlabeledStudyNotesFilterValue },
      to: "/study-notes",
    });

    await waitFor(() =>
      expect(screen.getByLabelText("Filter Study Notes by label")).toHaveValue(
        unlabeledStudyNotesFilterValue,
      ),
    );
    expect(
      within(catalog).getByRole("button", { name: "Unlabeled recall" }),
    ).toBeInTheDocument();
    expect(
      within(catalog).queryByRole("button", { name: "Biology recall" }),
    ).toBeNull();
    expect(
      within(catalog).queryByRole("button", { name: "History recall" }),
    ).toBeNull();
  });

  it("creates a Label from the Study Note editor and assigns it to the draft", async () => {
    const labelsContext = createAppLabelsContext({
      keyPrefix: `test-label-create-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const studyNotesContext = createAppStudyNotesContext({
      getOwnedLabelIdsForUser: (ownerId) =>
        labelsContext.getLabelsForUser(ownerId).map((label) => label.id),
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan-label-create";

    studyNotesContext.createStudyNote(userId, {
      prompt: "What is active recall?",
      sourceBody: "Active recall means retrieving from memory.",
      sourceTitle: "Recall",
    });

    renderRoute("/study-notes", {
      labelsContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan.create-label@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Manage labels" }),
    );
    fireEvent.change(screen.getByPlaceholderText("Add label..."), {
      target: { value: "Exam Prep" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(labelsContext.getLabelsForUser(userId)).toContainEqual(
        expect.objectContaining({ name: "Exam Prep" }),
      ),
    );
    expect(screen.getAllByText("Exam Prep").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved just now"),
    );
    expect(studyNotesContext.getSnapshot()[0]?.labelIds).toEqual([
      labelsContext.getLabelsForUser(userId)[0]?.id,
    ]);
  });

  it("updates Study Note-owned Learning State, Due for Recall, and Needs practice copy", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const notesContext = createAppNotesContext({
      keyPrefix: `test-source-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    let sessionCounter = 0;
    const recallContext = createAppRecallContext({
      crypto: {
        randomUUID: () =>
          `study-note-learning-state-${++sessionCounter}` as `${string}-${string}-${string}-${string}-${string}`,
      },
      keyPrefix: `test-recall-${Math.random().toString(36).slice(2)}`,
      notes: notesContext,
      shuffleNotes: (sessionNotes) => [...sessionNotes],
      storage: window.localStorage,
      studyNotes: studyNotesContext,
    });
    const userId = "user-jordan";
    const first = studyNotesContext.createStudyNote(userId, {
      sourceBody: "Shared source context.",
      sourceTitle: "Shared source",
    });
    const second = studyNotesContext.createStudyNoteFromSource(userId, {
      sourceNoteId: first.sourceNoteId,
    });
    const updatedFirst = studyNotesContext.updateStudyNote(userId, first.id, {
      acceptedVariants: [],
      acronyms: [],
      expectedAnswer: "First expected answer.",
      keyIdeas: [],
      labelIds: [],
      metaphors: [],
      prompt: "First recall target",
      prohibitedPhrases: [],
      sourceBody: "Shared source context.",
      sourceTitle: "Shared source",
    });
    studyNotesContext.updateStudyNote(userId, second.id, {
      acceptedVariants: [],
      acronyms: [],
      expectedAnswer: "Second expected answer.",
      keyIdeas: [],
      labelIds: [],
      metaphors: [],
      prompt: "Second recall target",
      prohibitedPhrases: [],
      sourceBody: "Shared source context.",
      sourceTitle: "Shared source",
    });

    renderRoute("/study-notes", {
      notesContext,
      recallContext,
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    const catalog = await screen.findByRole("complementary", {
      name: "Study Notes catalog",
    });
    const firstRow = within(catalog).getByRole("button", {
      name: "First recall target",
    });
    const secondRow = within(catalog).getByRole("button", {
      name: "Second recall target",
    });

    expect(firstRow).toHaveTextContent("Recall today");
    expect(secondRow).toHaveTextContent("Recall today");

    act(() => {
      const session = recallContext.startFlashCardSession({
        studyNoteIds: [updatedFirst.id],
        userId,
      });
      recallContext.revealFlashCardAnswer({ sessionId: session.id, userId });
      recallContext.rateFlashCardAnswer({
        rating: "hard",
        sessionId: session.id,
        userId,
      });
    });

    const updatedFirstRow = within(catalog).getByRole("button", {
      name: "First recall target",
    });
    const unchangedSecondRow = within(catalog).getByRole("button", {
      name: "Second recall target",
    });

    expect(updatedFirstRow).toHaveTextContent("Needs practice");
    expect(updatedFirstRow).not.toHaveTextContent("Recall today");
    expect(updatedFirstRow).not.toHaveTextContent("Weak");
    expect(unchangedSecondRow).toHaveTextContent("Recall today");
    expect(unchangedSecondRow).not.toHaveTextContent("Needs practice");
  });

  it("shows Practice Repair guidance for Study Notes with weak recall evidence", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-practice-repair";
    const studyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Clearer expected answer.",
      prompt: "Why does this still feel shaky?",
      sourceBody:
        "Broad source context that still needs a clearer recall target.",
      sourceTitle: "Repair source",
      userId,
    });

    renderStudyNotesRouteForUser(contexts, {
      displayName: "Jordan Repair",
      email: "jordan.repair@example.com",
      id: userId,
      userLanguage: "en",
    });

    completeStudyNoteRecall(contexts, {
      rating: "hard",
      studyNoteId: studyNote.id,
      userId,
    });

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Practice Repair",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tighten the expected answer: name the reason, steps, limit, or one example.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open Recall Today" }),
    ).toHaveAttribute("href", "/recall");
    expect(screen.queryByText("Error log")).not.toBeInTheDocument();
  });

  it("starts the current Recall Today queue from Study Notes without preselecting the selected Study Note", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-study-notes-recall-today";
    const scenario = createRecallTodayStudyNotesScenario(contexts, userId);
    const { router } = renderRoute("/study-notes", {
      ...contexts,
      session: {
        user: {
          displayName: "Jordan Recall Today",
          email: "jordan.recall.today@example.com",
          id: userId,
          userLanguage: "en",
          userTimeZone: "America/New_York",
        },
      },
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: scenario.selectedStudyNotePrompt,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Start Recall Session" }),
    );

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Recall session",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall/session");
    expect(
      contexts.recallContext.getSnapshot()?.notes.map((note) => note.title),
    ).toEqual(scenario.queuePrompts);
    expect(
      contexts.recallContext
        .getSnapshot()
        ?.notes.some((note) => note.title === scenario.selectedStudyNotePrompt),
    ).toBe(false);
  });

  it("opens the base Recall section when Study Notes has no Recall Today work", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-study-notes-recall-empty";
    createStudyNoteSnapshot(contexts, {
      expectedAnswer: " ",
      prompt: "Selected incomplete prompt",
      sourceBody: "Incomplete source.",
      sourceTitle: "Incomplete source",
      userId,
    });
    const { router } = renderRoute("/study-notes", {
      ...contexts,
      session: {
        user: {
          displayName: "Jordan Empty Recall",
          email: "jordan.empty.recall@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Start Recall Session" }),
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Recall Today",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall");
    expect(screen.getByText("No Recall Today work")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Manual selection" }),
    ).toHaveAttribute("href", "/recall/select");
  });

  it("shows active Practice Repair entries in the editor, lets the user edit the correction, and moves completed repairs into Practice Follow-up", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-active-practice-repair";
    const studyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Clearer expected answer.",
      prompt: "Why does this still feel shaky?",
      sourceBody:
        "Broad source context that still needs a clearer recall target.",
      sourceTitle: "Repair source",
      userId,
    });

    completeStudyNoteRecall(contexts, {
      rating: "hard",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedResult = confirmStudyNotePracticeRepair(contexts, {
      correction: "State the specific molecule.",
      intent: "tighten-expected-answer",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedReference =
      getConfirmedPracticeRepairReference(confirmedResult);

    renderStudyNotesRouteForUser(contexts, {
      displayName: "Jordan Active Repair",
      email: "jordan.active.repair@example.com",
      id: userId,
      userLanguage: "en",
    });

    const activePracticeRepair = await screen.findByRole("region", {
      name: "Active Practice Repair",
    });
    const activeEntry = within(activePracticeRepair).getByRole("article", {
      name: "Tighten expected answer",
    });

    expect(within(activeEntry).getByLabelText("Correction")).toHaveValue(
      "State the specific molecule.",
    );

    fireEvent.change(within(activeEntry).getByLabelText("Correction"), {
      target: {
        value: "State ATP and explain that it stores transferable energy.",
      },
    });
    fireEvent.click(
      within(activeEntry).getByRole("button", { name: "Save correction" }),
    );

    expect(
      contexts.recallContext.listActivePracticeRepairEntriesForStudyNote({
        studyNoteId: studyNote.id,
        userId,
      }),
    ).toMatchObject([
      {
        correction: "State ATP and explain that it stores transferable energy.",
        intent: "tighten-expected-answer",
      },
    ]);

    fireEvent.click(
      within(activeEntry).getByRole("button", { name: "Mark complete" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Active Practice Repair" }),
      ).toBeNull(),
    );
    expect(
      contexts.recallContext.listActivePracticeRepairEntriesForStudyNote({
        studyNoteId: studyNote.id,
        userId,
      }),
    ).toHaveLength(0);
    expect(
      screen.queryByRole("region", {
        name: "Practice Follow-up",
      }),
    ).toBeNull();
    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: confirmedReference,
        userId,
      })[0],
    ).toMatchObject({
      correction: "State ATP and explain that it stores transferable energy.",
      lifecycle: {
        completedAt: expect.any(String),
      },
    });
  });

  it("shows Results-origin snapshot context for active Practice Repair entries, keeps editor-side creation unavailable, and allows dismissal", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-active-practice-repair-origin";
    const studyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Clearer expected answer.",
      prompt: "Why does this still feel shaky?",
      sourceBody:
        "Broad source context that still needs a clearer recall target.",
      sourceTitle: "Repair source",
      userId,
    });

    completeStudyNoteRecall(contexts, {
      rating: "hard",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedResult = confirmStudyNotePracticeRepair(contexts, {
      correction: "State the specific molecule.",
      intent: "tighten-expected-answer",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedReference =
      getConfirmedPracticeRepairReference(confirmedResult);

    updateStudyNoteSnapshot(contexts, {
      expectedAnswer: "Live expected answer changed later.",
      prompt: "Live prompt changed later.",
      sourceBody: "Live source body changed later.",
      sourceTitle: "Live source changed later.",
      studyNoteId: studyNote.id,
      userId,
    });

    renderStudyNotesRouteForUser(contexts, {
      displayName: "Jordan Origin Repair",
      email: "jordan.origin.repair@example.com",
      id: userId,
      userLanguage: "en",
    });

    const activePracticeRepair = await screen.findByRole("region", {
      name: "Active Practice Repair",
    });
    const activeEntry = within(activePracticeRepair).getByRole("article", {
      name: "Tighten expected answer",
    });

    expect(within(activeEntry).getByText("Results origin")).toBeInTheDocument();
    expect(
      within(activeEntry).getByText("Why does this still feel shaky?"),
    ).toBeInTheDocument();
    expect(within(activeEntry).getByText("Repair source")).toBeInTheDocument();
    expect(within(activeEntry).getByText("Hard (2/5)")).toBeInTheDocument();
    expect(
      within(activeEntry).queryByText("Live prompt changed later."),
    ).toBeNull();
    expect(
      within(activeEntry).queryByText("Live source changed later."),
    ).toBeNull();

    expect(
      screen.queryByRole("button", { name: "Confirm Practice Repair" }),
    ).toBeNull();
    expect(screen.queryByLabelText("Practice Repair intent")).toBeNull();

    fireEvent.click(
      within(activeEntry).getByRole("button", { name: "Dismiss" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("article", { name: "Tighten expected answer" }),
      ).toBeNull(),
    );
    expect(
      contexts.recallContext.listActivePracticeRepairEntriesForStudyNote({
        studyNoteId: studyNote.id,
        userId,
      }),
    ).toHaveLength(0);
    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: confirmedReference,
        userId,
      })[0],
    ).toMatchObject({
      lifecycle: {
        dismissedAt: expect.any(String),
      },
    });
  });

  it("starts Interleaved Recall from a successful related Study Note recommendation", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-interleaved-recall";
    const interleavedLabel = contexts.labelsContext.createLabel({
      name: "Interleaved",
      userId,
    });
    const sharedSourceInput = {
      sourceBody: "Shared source for interleaving.",
      sourceTitle: "Interleaved source",
    } satisfies Pick<StudyNoteSnapshotInput, "sourceBody" | "sourceTitle">;
    const anchor = createStudyNoteSnapshot(contexts, {
      ...sharedSourceInput,
      expectedAnswer: "Anchor expected answer.",
      labelIds: [interleavedLabel.id],
      prompt: "Anchor prompt",
      userId,
    });
    const siblingOne = createSiblingStudyNoteSnapshot(contexts, {
      ...sharedSourceInput,
      expectedAnswer: "Sibling expected answer 1.",
      labelIds: [interleavedLabel.id],
      prompt: "Sibling prompt 1",
      sourceNoteId: anchor.sourceNoteId,
      userId,
    });
    const siblingTwo = createSiblingStudyNoteSnapshot(contexts, {
      ...sharedSourceInput,
      expectedAnswer: "Sibling expected answer 2.",
      labelIds: [interleavedLabel.id],
      prompt: "Sibling prompt 2",
      sourceNoteId: anchor.sourceNoteId,
      userId,
    });
    const siblingThree = createSiblingStudyNoteSnapshot(contexts, {
      ...sharedSourceInput,
      expectedAnswer: "Sibling expected answer 3.",
      labelIds: [interleavedLabel.id],
      prompt: "Sibling prompt 3",
      sourceNoteId: anchor.sourceNoteId,
      userId,
    });

    [anchor, siblingOne, siblingTwo, siblingThree].forEach((studyNote) => {
      completeStudyNoteRecall(contexts, {
        rating: "good",
        studyNoteId: studyNote.id,
        userId,
      });
      completeStudyNoteRecall(contexts, {
        rating: "easy",
        studyNoteId: studyNote.id,
        userId,
      });
    });

    const { router } = renderRoute("/study-notes", {
      ...contexts,
      session: {
        user: {
          displayName: "Jordan Interleaved",
          email: "jordan.interleaved@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Anchor prompt",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Interleaved Recall",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Start Interleaved Recall" }),
    );

    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Recall session",
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/recall/session");
    expect(
      contexts.recallContext.getSnapshot()?.notes.map((note) => note.title),
    ).toEqual(
      expect.arrayContaining([
        "Anchor prompt",
        "Sibling prompt 1",
        "Sibling prompt 2",
        "Sibling prompt 3",
      ]),
    );
    expect(contexts.recallContext.getSnapshot()?.notes).toHaveLength(4);
    expect(screen.queryByText("Anchor expected answer.")).toBeNull();
  });

  it("creates a sibling Study Note from Practice Repair with the same source material", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-practice-repair-sibling";
    const originalStudyNote = contexts.studyNotesContext.createStudyNote(
      userId,
      {
        sourceBody: "Shared source body for sibling repair.",
        sourceTitle: "Sibling repair source",
      },
    );
    const updatedStudyNote = updateStudyNoteSnapshot(contexts, {
      expectedAnswer: "Original expected answer.",
      prompt: "Original prompt",
      sourceBody: "Shared source body for sibling repair.",
      sourceTitle: "Sibling repair source",
      studyNoteId: originalStudyNote.id,
      userId,
    });

    renderStudyNotesRouteForUser(contexts, {
      displayName: "Jordan Sibling Repair",
      email: "jordan.sibling.repair@example.com",
      id: userId,
      userLanguage: "en",
    });

    completeStudyNoteRecall(contexts, {
      rating: "forgot",
      studyNoteId: updatedStudyNote.id,
      userId,
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Create sibling Study Note",
      }),
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Prompt")).toHaveValue(
        "Sibling repair source",
      ),
    );

    const allStudyNotes = contexts.studyNotesContext.getSnapshot();
    expect(allStudyNotes).toHaveLength(2);
    const sourceNoteIds = allStudyNotes.map(
      (studyNote) => studyNote.sourceNoteId,
    );
    expect(sourceNoteIds).toContain(originalStudyNote.sourceNoteId);
    expect(new Set(sourceNoteIds)).toEqual(
      new Set([originalStudyNote.sourceNoteId]),
    );

    const promptField = screen.getByLabelText("Prompt");
    expect(promptField).toHaveValue("Sibling repair source");
    expect(screen.getByLabelText("Expected answer")).toHaveValue(
      "Shared source body for sibling repair.",
    );
  });

  it("completes an active create-sibling Practice Repair from the entry action and records the created sibling", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-practice-repair-active-sibling";
    const studyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Original expected answer.",
      prompt: "Original prompt",
      sourceBody: "Shared source body for sibling repair.",
      sourceTitle: "Sibling repair source",
      userId,
    });

    completeStudyNoteRecall(contexts, {
      rating: "forgot",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedResult = confirmStudyNotePracticeRepair(contexts, {
      correction: "Create a sibling Study Note for the transport detail.",
      intent: "create-sibling-study-note",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedReference =
      getConfirmedPracticeRepairReference(confirmedResult);

    renderStudyNotesRouteForUser(contexts, {
      displayName: "Jordan Active Sibling Repair",
      email: "jordan.active.sibling.repair@example.com",
      id: userId,
      userLanguage: "en",
    });

    const activePracticeRepair = await screen.findByRole("region", {
      name: "Active Practice Repair",
    });
    const activeEntry = within(activePracticeRepair).getByRole("article", {
      name: "Create sibling Study Note",
    });

    fireEvent.click(
      within(activeEntry).getByRole("button", {
        name: "Create sibling Study Note",
      }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("article", { name: "Create sibling Study Note" }),
      ).toBeNull(),
    );
    expect(await screen.findByLabelText("Prompt")).toHaveValue(
      "Sibling repair source",
    );
    expect(screen.getByLabelText("Expected answer")).toHaveValue(
      "Shared source body for sibling repair.",
    );

    const allStudyNotes = contexts.studyNotesContext.getSnapshot();
    expect(allStudyNotes).toHaveLength(2);
    expect(new Set(allStudyNotes.map((note) => note.sourceNoteId))).toEqual(
      new Set([studyNote.sourceNoteId]),
    );

    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: confirmedReference,
        userId,
      })[0],
    ).toMatchObject({
      intentMetadata: {
        createdStudyNoteId: expect.any(String),
      },
      lifecycle: {
        completedAt: expect.any(String),
      },
    });
  });

  it("keeps split-study-note active until the original Study Note is narrowed, then completes it with sibling evidence", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-practice-repair-active-split";
    const studyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Original expected answer.",
      prompt: "Original prompt",
      sourceBody: "Shared source body for split repair.",
      sourceTitle: "Split repair source",
      userId,
    });

    completeStudyNoteRecall(contexts, {
      rating: "forgot",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedResult = confirmStudyNotePracticeRepair(contexts, {
      correction: "Split out the transport detail and narrow the original.",
      intent: "split-study-note",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedReference =
      getConfirmedPracticeRepairReference(confirmedResult);

    renderStudyNotesRouteForUser(contexts, {
      displayName: "Jordan Active Split Repair",
      email: "jordan.active.split.repair@example.com",
      id: userId,
      userLanguage: "en",
    });

    const activePracticeRepair = await screen.findByRole("region", {
      name: "Active Practice Repair",
    });
    const activeEntry = within(activePracticeRepair).getByRole("article", {
      name: "Split Study Note",
    });

    fireEvent.click(
      within(activeEntry).getByRole("button", {
        name: "Split Study Note",
      }),
    );

    await waitFor(() =>
      expect(contexts.studyNotesContext.getSnapshot()).toHaveLength(2),
    );
    expect(screen.getByLabelText("Prompt")).toHaveValue("Original prompt");
    expect(screen.getByLabelText("Expected answer")).toHaveValue(
      "Original expected answer.",
    );
    expect(
      screen.getByRole("article", { name: "Split Study Note" }),
    ).toBeInTheDocument();

    const createdSibling = contexts.studyNotesContext
      .getSnapshot()
      .find((note) => note.id !== studyNote.id);

    expect(createdSibling?.sourceNoteId).toBe(studyNote.sourceNoteId);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: {
        value: "What stores transferable energy for cell work?",
      },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: {
        value: "ATP stores transferable energy for cell work.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("article", { name: "Split Study Note" }),
      ).toBeNull(),
    );

    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: confirmedReference,
        userId,
      })[0],
    ).toMatchObject({
      intentMetadata: {
        createdStudyNoteIds: [createdSibling?.id],
        narrowedOriginalStudyNoteAt: expect.any(String),
      },
      lifecycle: {
        completedAt: expect.any(String),
      },
    });

    expect(
      screen.queryByRole("article", { name: "Split Study Note" }),
    ).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Practice Follow-up" }),
    ).toBeNull();
    expect(contexts.studyNotesContext.getSnapshot()).toHaveLength(2);
    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: confirmedReference,
        userId,
      })[0],
    ).toMatchObject({
      intentMetadata: {
        createdStudyNoteIds: [createdSibling?.id],
      },
      lifecycle: {
        completedAt: expect.any(String),
      },
    });
  });

  it("completes an active add-memory-aid Practice Repair after the user chooses an Acronym and saves it", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-practice-repair-active-memory-aid";
    const studyNote = createStudyNoteSnapshot(contexts, {
      expectedAnswer: "Original expected answer.",
      prompt: "Original prompt",
      sourceBody: "Shared source body for memory-aid repair.",
      sourceTitle: "Memory-aid repair source",
      userId,
    });

    completeStudyNoteRecall(contexts, {
      rating: "hard",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedResult = confirmStudyNotePracticeRepair(contexts, {
      correction: "Add an acronym for the transport steps.",
      intent: "add-memory-aid",
      studyNoteId: studyNote.id,
      userId,
    });
    const confirmedReference =
      getConfirmedPracticeRepairReference(confirmedResult);

    renderStudyNotesRouteForUser(contexts, {
      displayName: "Jordan Active Memory Aid Repair",
      email: "jordan.active.memory.aid.repair@example.com",
      id: userId,
      userLanguage: "en",
    });

    const activePracticeRepair = await screen.findByRole("region", {
      name: "Active Practice Repair",
    });
    const activeEntry = within(activePracticeRepair).getByRole("article", {
      name: "Add memory aid",
    });

    fireEvent.click(
      within(activeEntry).getByRole("button", {
        name: "Add Acronym",
      }),
    );
    fireEvent.change(screen.getByLabelText("Acronym"), {
      target: {
        value: "ATP keeps the transfer pathway in order.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("article", { name: "Add memory aid" }),
      ).toBeNull(),
    );
    expect(screen.getByLabelText("Acronym")).toHaveValue(
      "ATP keeps the transfer pathway in order.",
    );

    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: confirmedReference,
        userId,
      })[0],
    ).toMatchObject({
      intentMetadata: {
        memoryAidId: expect.any(String),
        memoryAidKind: "Acronym",
      },
      lifecycle: {
        completedAt: expect.any(String),
      },
    });
  });

  it("completes a linked create-sibling Practice Repair in Study Notes, keeps the return target visible, and does not auto-return", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-practice-repair-linked-create-sibling";
    const { confirmedReference, router, studyNote } =
      renderLinkedPracticeRepairRoute({
        contexts,
        correction: "Create a sibling Study Note for the transport detail.",
        displayName: "Jordan Linked Sibling Repair",
        email: "jordan.linked.sibling.repair@example.com",
        intent: "create-sibling-study-note",
        rating: "forgot",
        sourceBody: "Shared source body for linked sibling repair.",
        sourceTitle: "Linked sibling source",
        userId,
      });

    expect(await screen.findByLabelText("Prompt")).toHaveValue(
      "Original prompt",
    );
    expectPracticeRepairReturnLink(confirmedReference);

    expect(
      screen.queryByRole("region", { name: "Active Practice Repair" }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Create sibling Study Note",
      }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Practice Repair completed",
      ),
    );
    const createdSibling = getCreatedSiblingStudyNote(contexts, studyNote);
    expect(router.state.location.pathname).toBe(
      getStudyNoteEditorPath(createdSibling.id),
    );
    expect(await screen.findByLabelText("Prompt")).toHaveValue(
      "Linked sibling source",
    );
    expectPracticeRepairReturnLink(confirmedReference);

    const allStudyNotes = contexts.studyNotesContext.getSnapshot();
    expect(allStudyNotes).toHaveLength(3);
    expect(createdSibling.sourceNoteId).toBe(studyNote.sourceNoteId);
    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: confirmedReference,
        userId,
      })[0],
    ).toMatchObject({
      intentMetadata: {
        createdStudyNoteId: createdSibling.id,
      },
      lifecycle: {
        completedAt: expect.any(String),
      },
    });

    await returnToCompletedPracticeRepairWorkspace(router, confirmedReference);
  });

  it("completes a linked split-study-note Practice Repair in Study Notes after creating a split target and narrowing the original", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-practice-repair-linked-split";
    const { confirmedReference, router, studyNote } =
      renderLinkedPracticeRepairRoute({
        contexts,
        correction: "Split out the transport detail and narrow the original.",
        displayName: "Jordan Linked Split Repair",
        email: "jordan.linked.split.repair@example.com",
        intent: "split-study-note",
        rating: "forgot",
        sourceBody: "Shared source body for linked split repair.",
        sourceTitle: "Linked split source",
        userId,
      });

    expect(await screen.findByLabelText("Prompt")).toHaveValue(
      "Original prompt",
    );
    expectPracticeRepairReturnLink(confirmedReference);
    expect(screen.getByLabelText("Prompt").closest("label")).toHaveAttribute(
      "data-practice-repair-focus",
      "true",
    );
    expect(
      screen.getByLabelText("Expected answer").closest("label"),
    ).not.toHaveAttribute("data-practice-repair-focus");

    expect(
      screen.queryByRole("region", { name: "Active Practice Repair" }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Create split target",
      }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Split target created. Narrow the original Study Note and save changes to complete Practice Repair.",
      ),
    );
    expect(screen.getByLabelText("Prompt")).toHaveValue("Original prompt");
    expect(screen.getByLabelText("Expected answer")).toHaveValue(
      "Original expected answer.",
    );

    const createdSibling = getCreatedSiblingStudyNote(contexts, studyNote);
    expect(createdSibling.sourceNoteId).toBe(studyNote.sourceNoteId);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: {
        value: "What stores transferable energy for cell work?",
      },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: {
        value: "ATP stores transferable energy for cell work.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Practice Repair completed",
      ),
    );
    expect(router.state.location.pathname).toBe(
      getStudyNoteEditorPath(studyNote.id),
    );
    expectPracticeRepairReturnLink(confirmedReference);
    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: confirmedReference,
        userId,
      })[0],
    ).toMatchObject({
      intentMetadata: {
        createdStudyNoteIds: [createdSibling.id],
        narrowedOriginalStudyNoteAt: expect.any(String),
      },
      lifecycle: {
        completedAt: expect.any(String),
      },
    });

    await returnToCompletedPracticeRepairWorkspace(router, confirmedReference);
  });

  it("completes a linked expected-answer Practice Repair on save, keeps the return target visible, and does not auto-return", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-practice-repair-linked-expected-answer";
    const { confirmedReference, router } = renderLinkedPracticeRepairRoute({
      contexts,
      correction: "State ATP directly and anchor the role.",
      displayName: "Jordan Linked Expected Answer",
      email: "jordan.linked.expected-answer@example.com",
      intent: "tighten-expected-answer",
      rating: "hard",
      sourceBody: "Shared source body for linked expected-answer repair.",
      sourceTitle: "Linked expected-answer source",
      userId,
    });

    expect(await screen.findByLabelText("Prompt")).toHaveValue(
      "Original prompt",
    );
    expect(screen.getByLabelText("Expected answer")).toHaveValue(
      "Original expected answer.",
    );
    expectPracticeRepairReturnLink(confirmedReference);
    expect(
      screen.queryByRole("region", { name: "Active Practice Repair" }),
    ).toBeNull();

    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: {
        value: "ATP stores transferable energy for cell work.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Practice Repair completed",
      ),
    );
    expect(router.state.location.pathname).toBe(
      getStudyNoteEditorPath(confirmedReference.studyNoteId),
    );
    expectPracticeRepairReturnLink(confirmedReference);
    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: confirmedReference,
        userId,
      })[0],
    ).toMatchObject({
      intentMetadata: {
        updatedExpectedAnswer: "ATP stores transferable energy for cell work.",
      },
      lifecycle: {
        completedAt: expect.any(String),
      },
    });

    await returnToCompletedPracticeRepairWorkspace(router, confirmedReference);
  });

  it("completes a linked add-memory-aid Practice Repair in Study Notes, keeps the return target visible, and does not auto-return", async () => {
    const contexts = createDeterministicRecallTestContexts();
    const userId = "user-practice-repair-deep-link";
    const { confirmedReference, router } = renderLinkedPracticeRepairRoute({
      contexts,
      correction: "Add a memory aid for the transport steps.",
      displayName: "Jordan Linked Repair",
      email: "jordan.linked.repair@example.com",
      intent: "add-memory-aid",
      otherExpectedAnswer: "Other answer.",
      rating: "hard",
      sourceBody: "Shared source body for linked Practice Repair.",
      sourceTitle: "Linked repair source",
      userId,
    });

    expect(await screen.findByLabelText("Prompt")).toHaveValue(
      "Original prompt",
    );
    expectPracticeRepairReturnLink(confirmedReference);
    expect(
      getDisclosureDetails(screen.getByRole("region", { name: "Memory aids" })),
    ).toHaveAttribute("open");
    expect(
      screen.queryByRole("region", { name: "Active Practice Repair" }),
    ).toBeNull();

    fireEvent.change(screen.getByLabelText("Acronym"), {
      target: {
        value: "ATP keeps the transfer pathway in order.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Practice Repair completed",
      ),
    );
    expect(router.state.location.pathname).toBe(
      getStudyNoteEditorPath(confirmedReference.studyNoteId),
    );
    expectPracticeRepairReturnLink(confirmedReference);
    expect(
      contexts.recallContext.listPracticeRepairEntriesForQuestion({
        reference: confirmedReference,
        userId,
      })[0],
    ).toMatchObject({
      intentMetadata: {
        memoryAidId: expect.any(String),
        memoryAidKind: "Acronym",
      },
      lifecycle: {
        completedAt: expect.any(String),
      },
    });

    await returnToCompletedPracticeRepairWorkspace(router, confirmedReference);
  });
});
