import { describe, expect, it } from "vitest";

import {
  areStudyNoteDraftsEqual,
  cloneStudyNoteDraft,
  createBlankStudyNoteDraft,
  createSingleStudyNoteDraftSupportDescription,
  createStudyNoteDraftFromStudyNote,
  didSplitStudyNoteDraftChange,
  hasStudyNoteDraftAnswerCheckContent,
  hasStudyNoteDraftMemoryAidContent,
  hasStudyNoteDraftReferenceContent,
  removeStudyNoteDraftLabel,
  setStudyNoteDraftLabelSelection,
} from "./study-note-draft";
import type { AppStudyNote, UpdateStudyNoteInput } from "./study-notes";

const timestamp = "2026-05-01T00:00:00.000Z";

function buildStudyNote(overrides: Partial<AppStudyNote> = {}): AppStudyNote {
  return {
    acceptedVariants: [{ id: "variant-1", text: "Accepted answer" }],
    acronyms: [{ description: "AID" }],
    createdAt: timestamp,
    expectedAnswer: "Expected answer",
    id: "study-note-1",
    keyIdeas: [
      {
        acceptedPhrases: ["core"],
        id: "key-idea-1",
        importance: "required",
        prohibitedPhrases: ["wrong"],
        text: "Core idea",
      },
    ],
    labelIds: ["label-1"],
    metaphors: [{ description: "Memory bridge" }],
    prompt: "Prompt",
    prohibitedPhrases: [{ id: "phrase-1", text: "Wrong answer" }],
    source: {
      body: "Source body",
      id: "source-1",
      title: "Source title",
      updatedAt: timestamp,
    },
    sourceNoteId: "source-1",
    updatedAt: timestamp,
    ...overrides,
  };
}

function buildDraft(
  overrides: Partial<UpdateStudyNoteInput> = {},
): UpdateStudyNoteInput {
  return {
    ...createBlankStudyNoteDraft(),
    expectedAnswer: "Expected answer",
    prompt: "Prompt",
    sourceBody: "Source body",
    sourceTitle: "Source title",
    ...overrides,
  };
}

describe("Study Note draft", () => {
  it("creates blank and Study Note-backed drafts", () => {
    expect(createBlankStudyNoteDraft()).toMatchObject({
      acceptedVariants: [],
      expectedAnswer: "",
      prompt: "",
      sourceBody: "",
      sourceTitle: "",
    });

    expect(createStudyNoteDraftFromStudyNote(buildStudyNote())).toMatchObject({
      acceptedVariants: [{ id: "variant-1", text: "Accepted answer" }],
      expectedAnswer: "Expected answer",
      labelIds: ["label-1"],
      prompt: "Prompt",
      sourceBody: "Source body",
      sourceTitle: "Source title",
    });
  });

  it("clones nested draft values", () => {
    const original = createStudyNoteDraftFromStudyNote(buildStudyNote());
    const clone = cloneStudyNoteDraft(original);
    const clonedKeyIdea = clone.keyIdeas[0];
    const clonedAcceptedVariant = clone.acceptedVariants[0];

    expect(clonedKeyIdea).toBeDefined();
    expect(clonedAcceptedVariant).toBeDefined();
    clonedKeyIdea?.acceptedPhrases.push("mutated");
    if (clonedAcceptedVariant !== undefined) {
      clonedAcceptedVariant.text = "Mutated";
    }

    expect(original.keyIdeas[0]?.acceptedPhrases).toEqual(["core"]);
    expect(original.acceptedVariants[0]?.text).toBe("Accepted answer");
  });

  it("compares drafts using persisted-save semantics", () => {
    const left = buildDraft({
      labelIds: ["label-1", "label-2"],
      metaphors: [{ description: "  bridge  " }],
    });
    const right = buildDraft({
      labelIds: ["label-2", "label-1"],
      metaphors: [{ description: "bridge" }],
    });

    expect(areStudyNoteDraftsEqual(left, right)).toBe(true);
    expect(
      areStudyNoteDraftsEqual(left, {
        ...right,
        expectedAnswer: "Changed",
      }),
    ).toBe(false);
  });

  it("tracks labels and support descriptions without route state", () => {
    const draft = buildDraft({ labelIds: ["label-1"] });

    expect(
      setStudyNoteDraftLabelSelection(draft, "label-2", true).labelIds,
    ).toEqual(["label-1", "label-2"]);
    expect(
      setStudyNoteDraftLabelSelection(draft, "label-1", false).labelIds,
    ).toEqual([]);
    expect(removeStudyNoteDraftLabel(draft, "label-1").labelIds).toEqual([]);
    expect(createSingleStudyNoteDraftSupportDescription("  ")).toEqual([]);
    expect(
      createSingleStudyNoteDraftSupportDescription("Memory bridge"),
    ).toEqual([{ description: "Memory bridge" }]);
  });

  it("detects visible draft section content", () => {
    expect(hasStudyNoteDraftReferenceContent(buildDraft())).toBe(true);
    expect(
      hasStudyNoteDraftAnswerCheckContent(
        buildDraft({
          keyIdeas: [
            {
              acceptedPhrases: [],
              id: "key-idea-1",
              importance: "required",
              prohibitedPhrases: [],
              text: "Important point",
            },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      hasStudyNoteDraftMemoryAidContent(
        buildDraft({ metaphors: [{ description: "Bridge" }] }),
      ),
    ).toBe(true);
  });

  it("detects split narrowing changes", () => {
    const studyNote = buildStudyNote();

    expect(
      didSplitStudyNoteDraftChange({
        draft: createStudyNoteDraftFromStudyNote(studyNote),
        studyNote,
      }),
    ).toBe(false);
    expect(
      didSplitStudyNoteDraftChange({
        draft: buildDraft({ prompt: "Narrowed prompt" }),
        studyNote,
      }),
    ).toBe(true);
  });
});
