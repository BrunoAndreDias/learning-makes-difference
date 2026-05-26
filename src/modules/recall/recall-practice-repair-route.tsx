import {
  createFileRoute,
  Navigate,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { z } from "zod";

import { Button, ButtonLink } from "../../design-system/button";
import { PageLayout } from "../../design-system/page-layout";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import { useAppTranslation } from "../language";
import {
  type AppPersistentStudyNotesContext,
  type AppStudyNote,
  type AppStudyNotesContext,
  AppStudyNotesError,
  listStudyNotesForUser,
  type UpdateStudyNoteInput,
} from "../study-notes";
import { useProtectedWorkspaceRefreshState } from "../workspace-shell/app-shell/protected-route";
import { appRoutePaths } from "../workspace-shell/app-shell/route-paths";
import {
  getRecallRatingTone,
  getRecallRatingTranslationKey,
} from "./learner-copy";
import type { AppPersistentRecallContext } from "./persistent-recall";
import {
  type AppRecallContext,
  AppRecallError,
  type FlashCardSessionResult,
  type RecallQuestion,
} from "./recall";
import {
  getPracticeRepairEntryId,
  getPracticeRepairEntryLifecycleKind,
  getPracticeRepairQuestionExpectedAnswer,
  getPracticeRepairQuestionPrompt,
  getPracticeRepairQuestionReferenceText,
  getPracticeRepairQuestionReferenceTitle,
  getPracticeRepairRecordedAnswer,
  type PracticeRepairEntry,
  type PracticeRepairEntryLifecycleKind,
  type PracticeRepairIntent,
  type PracticeRepairMemoryAidKind,
} from "./recall-practice-repair";

const practiceRepairModes = [
  "edit-answer",
  "split-note",
  "create-sibling",
  "memory-aid",
] as const;

type PracticeRepairMode = (typeof practiceRepairModes)[number];

const practiceRepairSearchSchema = z.object({
  mode: z.enum(practiceRepairModes).catch("edit-answer").optional(),
});

export const Route = createFileRoute(
  "/_protected/practice-repair/$practiceRepairEntryId",
)({
  validateSearch: practiceRepairSearchSchema,
  component: RecallPracticeRepairRoute,
});

export type PracticeRepairWorkspace = {
  entry: PracticeRepairEntry;
  question: RecallQuestion;
  result: FlashCardSessionResult;
};

type PracticeRepairWorkspaceActionCard = {
  description: string;
  intent: PracticeRepairIntent;
  mode: PracticeRepairMode;
  title: string;
};

const workspaceActionCards = [
  {
    description:
      "Refine or expand the answer so the recall target is clearer and easier to judge.",
    intent: "tighten-expected-answer",
    mode: "edit-answer",
    title: "Edit expected answer",
  },
  {
    description:
      "Break a broad concept into smaller Study Notes you can train one at a time.",
    intent: "split-study-note",
    mode: "split-note",
    title: "Split this Study Note",
  },
  {
    description:
      "Add a related concept or contrast from the same source explanation.",
    intent: "create-sibling-study-note",
    mode: "create-sibling",
    title: "Create a sibling Study Note",
  },
  {
    description:
      "Add a Metaphor or Acronym only when it would make the answer easier to retrieve.",
    intent: "add-memory-aid",
    mode: "memory-aid",
    title: "Add a memory aid",
  },
] as const satisfies readonly PracticeRepairWorkspaceActionCard[];

function getDefaultPracticeRepairActionCard(): PracticeRepairWorkspaceActionCard {
  const [defaultActionCard] = workspaceActionCards;

  if (defaultActionCard === undefined) {
    throw new Error("Practice Repair requires at least one repair option.");
  }

  return defaultActionCard;
}

type PracticeRepairLifecycleAction = "complete" | "dismiss";

type RecallResultsStore = Pick<
  AppRecallContext,
  "getSessionResultsSnapshot" | "subscribe"
>;
type StudyNotesStore = Pick<AppStudyNotesContext, "getSnapshot" | "subscribe">;

type PracticeRepairCurrentStudyNoteDraft = Pick<
  UpdateStudyNoteInput,
  "expectedAnswer" | "prompt"
>;

type PracticeRepairSplitStudyNoteDraft = {
  originalExpectedAnswer: string;
  originalPrompt: string;
  splitExpectedAnswer: string;
  splitPrompt: string;
};

type PracticeRepairSiblingStudyNoteDraft = {
  expectedAnswer: string;
  prompt: string;
};

type PracticeRepairMemoryAidDraft = {
  description: string;
  kind: PracticeRepairMemoryAidKind;
};

function findPracticeRepairWorkspace(input: {
  practiceRepairEntryId: string;
  sessionResults: readonly FlashCardSessionResult[];
}): PracticeRepairWorkspace | null {
  const { practiceRepairEntryId, sessionResults } = input;

  for (const result of sessionResults) {
    for (const question of result.questions) {
      const entry = question.practiceRepairEntry;

      if (
        entry !== undefined &&
        getPracticeRepairEntryId(entry) === practiceRepairEntryId
      ) {
        return {
          entry,
          question,
          result,
        };
      }
    }
  }

  return null;
}

function getStudyNoteMeta(question: Pick<RecallQuestion, "noteSnapshot">) {
  const labels = question.noteSnapshot.labels
    ?.map((label) => label.name.trim())
    .filter((label) => label.length > 0);

  if (labels !== undefined && labels.length > 0) {
    return labels.join(" · ");
  }

  const sourceTitle = question.noteSnapshot.source?.title?.trim();

  if (sourceTitle !== undefined && sourceTitle.length > 0) {
    return sourceTitle;
  }

  return "Results evidence";
}

function createCurrentStudyNoteDraft(
  studyNote: AppStudyNote | null,
): PracticeRepairCurrentStudyNoteDraft {
  return {
    expectedAnswer: studyNote?.expectedAnswer ?? "",
    prompt: studyNote?.prompt ?? "",
  };
}

function createSplitStudyNoteDraft(
  studyNote: AppStudyNote | null,
): PracticeRepairSplitStudyNoteDraft {
  return {
    originalExpectedAnswer: studyNote?.expectedAnswer ?? "",
    originalPrompt: studyNote?.prompt ?? "",
    splitExpectedAnswer: studyNote?.source.body ?? "",
    splitPrompt: "",
  };
}

function createSiblingStudyNoteDraft(
  studyNote: AppStudyNote | null,
): PracticeRepairSiblingStudyNoteDraft {
  return {
    expectedAnswer: studyNote?.source.body ?? "",
    prompt: "",
  };
}

function getMemoryAidDescription(input: {
  kind: PracticeRepairMemoryAidKind;
  studyNote: AppStudyNote | null;
}) {
  if (input.studyNote === null) {
    return "";
  }

  const supportDescriptions =
    input.kind === "Metaphor"
      ? input.studyNote.metaphors
      : input.studyNote.acronyms;

  return supportDescriptions[0]?.description ?? "";
}

function createMemoryAidDraft(
  studyNote: AppStudyNote | null,
): PracticeRepairMemoryAidDraft {
  return {
    description: getMemoryAidDescription({
      kind: "Metaphor",
      studyNote,
    }),
    kind: "Metaphor",
  };
}

function hasCurrentStudyNoteDraftChanges(input: {
  draft: PracticeRepairCurrentStudyNoteDraft;
  studyNote: AppStudyNote | null;
}) {
  if (input.studyNote === null) {
    return false;
  }

  return (
    input.draft.prompt.trim() !== input.studyNote.prompt.trim() ||
    input.draft.expectedAnswer.trim() !== input.studyNote.expectedAnswer.trim()
  );
}

function hasSplitStudyNoteDraftChanges(input: {
  draft: PracticeRepairSplitStudyNoteDraft;
  studyNote: AppStudyNote | null;
}) {
  if (input.studyNote === null) {
    return false;
  }

  return (
    input.draft.originalPrompt.trim() !== input.studyNote.prompt.trim() ||
    input.draft.originalExpectedAnswer.trim() !==
      input.studyNote.expectedAnswer.trim() ||
    input.draft.splitPrompt.trim().length > 0 ||
    input.draft.splitExpectedAnswer.trim() !==
      input.studyNote.source.body.trim()
  );
}

function hasSiblingStudyNoteDraftChanges(
  draft: PracticeRepairSiblingStudyNoteDraft,
) {
  return (
    draft.prompt.trim().length > 0 || draft.expectedAnswer.trim().length > 0
  );
}

function hasMemoryAidDraftChanges(input: {
  draft: PracticeRepairMemoryAidDraft;
  studyNote: AppStudyNote | null;
}) {
  return (
    input.draft.description.trim() !==
    getMemoryAidDescription({
      kind: input.draft.kind,
      studyNote: input.studyNote,
    }).trim()
  );
}

function createPracticeRepairStudyNoteUpdate(input: {
  acronyms?: AppStudyNote["acronyms"];
  expectedAnswer: string;
  metaphors?: AppStudyNote["metaphors"];
  prompt: string;
  studyNote: AppStudyNote;
}): UpdateStudyNoteInput {
  return {
    acceptedVariants: input.studyNote.acceptedVariants.map((variant) => ({
      ...variant,
    })),
    acronyms:
      input.acronyms ??
      input.studyNote.acronyms.map((acronym) => ({ ...acronym })),
    expectedAnswer: input.expectedAnswer,
    keyIdeas: input.studyNote.keyIdeas.map((keyIdea) => ({
      ...keyIdea,
      acceptedPhrases: [...keyIdea.acceptedPhrases],
      prohibitedPhrases: [...keyIdea.prohibitedPhrases],
    })),
    labelIds: [...input.studyNote.labelIds],
    metaphors:
      input.metaphors ??
      input.studyNote.metaphors.map((metaphor) => ({ ...metaphor })),
    prompt: input.prompt,
    prohibitedPhrases: input.studyNote.prohibitedPhrases.map((phrase) => ({
      ...phrase,
    })),
    sourceBody: input.studyNote.source.body,
    sourceTitle: input.studyNote.source.title,
  };
}

function createQuickRepairStudyNoteUpdate(input: {
  draft: PracticeRepairCurrentStudyNoteDraft;
  studyNote: AppStudyNote;
}): UpdateStudyNoteInput {
  return createPracticeRepairStudyNoteUpdate({
    expectedAnswer: input.draft.expectedAnswer,
    prompt: input.draft.prompt,
    studyNote: input.studyNote,
  });
}

function findSupersedingPracticeRepairEntryId(input: {
  entry: PracticeRepairEntry;
  sessionResults: readonly FlashCardSessionResult[];
}): string | null {
  const currentEntryId = getPracticeRepairEntryId(input.entry);

  for (const result of input.sessionResults) {
    for (const question of result.questions) {
      const candidateEntry = question.practiceRepairEntry;

      if (
        candidateEntry === undefined ||
        getPracticeRepairEntryLifecycleKind(candidateEntry) !== "active" ||
        candidateEntry.intent !== input.entry.intent ||
        candidateEntry.reference.studyNoteId !==
          input.entry.reference.studyNoteId
      ) {
        continue;
      }

      const candidateEntryId = getPracticeRepairEntryId(candidateEntry);

      if (candidateEntryId !== currentEntryId) {
        return candidateEntryId;
      }
    }
  }

  return null;
}

function getPracticeRepairNextStepCopy(input: {
  hasSupersedingEntry: boolean;
  lifecycleKind: PracticeRepairEntryLifecycleKind;
}) {
  const { hasSupersedingEntry, lifecycleKind } = input;

  switch (lifecycleKind) {
    case "completed":
      return "Use Recall again soon after the repair work is complete to test this Study Note again.";
    case "active":
      return "Make the repair in Study Notes, then mark this Practice Repair complete or dismiss it here when it no longer belongs in the active queue.";
    case "dismissed":
      return "Dismissed repairs stay out of the active queue while Results keeps the original historical evidence.";
    case "follow-up-satisfied":
      return "A later recall attempt closed this repair loop, so this entry stays available as history only.";
    case "study-note-deleted":
      return "Use Results for the historical evidence because this Study Note is no longer available for active repair.";
    case "superseded":
      return hasSupersedingEntry
        ? "A newer active Practice Repair replaced this one. Open the newer entry to continue the current repair."
        : "A newer Practice Repair replaced this one, so this entry stays historical only.";
  }
}

function getPracticeRepairSupportCopy(input: {
  hasSupersedingEntry: boolean;
  lifecycleKind: PracticeRepairEntryLifecycleKind;
}) {
  const { hasSupersedingEntry, lifecycleKind } = input;

  switch (lifecycleKind) {
    case "active":
      return "Results keeps the historical evidence. This workspace keeps the active repair in view.";
    case "completed":
      return "Results keeps the historical evidence. The follow-up closes only after you attempt recall again.";
    case "dismissed":
      return "Dismissed repairs stay out of the active queue but remain available as historical evidence.";
    case "follow-up-satisfied":
      return "Results keeps the historical evidence that led to this repair and the later recall that closed it.";
    case "study-note-deleted":
      return "Results keeps the historical evidence even though the original Study Note no longer exists.";
    case "superseded":
      return hasSupersedingEntry
        ? "Use the newer active Practice Repair for current work. This entry remains available as history."
        : "This superseded entry remains available as history even if the newer active repair is no longer open here.";
  }
}

function getPracticeRepairFeedbackMessage(
  action: PracticeRepairLifecycleAction,
) {
  switch (action) {
    case "complete":
      return "Practice Repair completed";
    case "dismiss":
      return "Practice Repair dismissed";
  }
}

function getPracticeRepairErrorMessage(action: PracticeRepairLifecycleAction) {
  switch (action) {
    case "complete":
      return "Practice Repair could not be completed.";
    case "dismiss":
      return "Practice Repair could not be dismissed.";
  }
}

function getPracticeRepairFollowUpStartErrorMessage() {
  return "Recall again soon could not be started.";
}

async function startPracticeRepairFollowUpRecall(input: {
  persistentRecallContext: AppPersistentRecallContext | undefined;
  recallContext: AppRecallContext;
  studyNoteId: string;
  userId: string;
}) {
  const sessionInput = {
    mode: "FlashCard" as const,
    studyNoteIds: [input.studyNoteId],
  };

  if (input.persistentRecallContext !== undefined) {
    await input.persistentRecallContext.startFlashCardSession(
      input.userId,
      sessionInput,
    );
    return;
  }

  input.recallContext.startFlashCardSession({
    ...sessionInput,
    userId: input.userId,
  });
}

async function mutatePracticeRepairLifecycle(input: {
  action: PracticeRepairLifecycleAction;
  persistentRecallContext: AppPersistentRecallContext | undefined;
  reference: PracticeRepairEntry["reference"];
  recallContext: AppRecallContext;
  userId: string | null;
}) {
  const { persistentRecallContext, reference, recallContext, userId } = input;

  if (userId === null) {
    return;
  }

  if (persistentRecallContext !== undefined) {
    switch (input.action) {
      case "complete":
        await persistentRecallContext.completePracticeRepairEntry(userId, {
          reference,
        });
        return;
      case "dismiss":
        await persistentRecallContext.dismissPracticeRepairEntry(userId, {
          reference,
        });
        return;
    }
  }

  switch (input.action) {
    case "complete":
      recallContext.completePracticeRepairEntry({
        reference,
        userId,
      });
      return;
    case "dismiss":
      recallContext.dismissPracticeRepairEntry({
        reference,
        userId,
      });
      return;
  }
}

async function updatePracticeRepairStudyNote(input: {
  draft: PracticeRepairCurrentStudyNoteDraft;
  persistentStudyNotesContext: AppPersistentStudyNotesContext | undefined;
  studyNote: AppStudyNote;
  studyNotesContext: AppStudyNotesContext;
  userId: string | null;
}) {
  const updateInput = createQuickRepairStudyNoteUpdate({
    draft: input.draft,
    studyNote: input.studyNote,
  });

  if (input.persistentStudyNotesContext !== undefined) {
    return input.persistentStudyNotesContext.updateStudyNote(
      input.userId,
      input.studyNote.id,
      updateInput,
    );
  }

  return input.studyNotesContext.updateStudyNote(
    input.userId,
    input.studyNote.id,
    updateInput,
  );
}

async function createPracticeRepairSiblingStudyNote(input: {
  draft: PracticeRepairSiblingStudyNoteDraft;
  persistentStudyNotesContext: AppPersistentStudyNotesContext | undefined;
  sourceStudyNote: AppStudyNote;
  studyNotesContext: AppStudyNotesContext;
  userId: string | null;
}) {
  const studyNotesMutation =
    input.persistentStudyNotesContext ?? input.studyNotesContext;
  const createdStudyNote = await studyNotesMutation.createStudyNoteFromSource(
    input.userId,
    {
      sourceNoteId: input.sourceStudyNote.sourceNoteId,
    },
  );
  const updateInput = createPracticeRepairStudyNoteUpdate({
    expectedAnswer: input.draft.expectedAnswer,
    prompt: input.draft.prompt,
    studyNote: createdStudyNote,
  });

  return studyNotesMutation.updateStudyNote(
    input.userId,
    createdStudyNote.id,
    updateInput,
  );
}

async function updatePracticeRepairMemoryAid(input: {
  draft: PracticeRepairMemoryAidDraft;
  persistentStudyNotesContext: AppPersistentStudyNotesContext | undefined;
  studyNote: AppStudyNote;
  studyNotesContext: AppStudyNotesContext;
  userId: string | null;
}) {
  const description = input.draft.description.trim();
  const updateInput = createPracticeRepairStudyNoteUpdate({
    acronyms:
      input.draft.kind === "Acronym"
        ? [{ description }]
        : input.studyNote.acronyms.map((acronym) => ({ ...acronym })),
    expectedAnswer: input.studyNote.expectedAnswer,
    metaphors:
      input.draft.kind === "Metaphor"
        ? [{ description }]
        : input.studyNote.metaphors.map((metaphor) => ({ ...metaphor })),
    prompt: input.studyNote.prompt,
    studyNote: input.studyNote,
  });

  if (input.persistentStudyNotesContext !== undefined) {
    return input.persistentStudyNotesContext.updateStudyNote(
      input.userId,
      input.studyNote.id,
      updateInput,
    );
  }

  return input.studyNotesContext.updateStudyNote(
    input.userId,
    input.studyNote.id,
    updateInput,
  );
}

async function savePracticeRepairSplitStudyNote(input: {
  draft: PracticeRepairSplitStudyNoteDraft;
  persistentStudyNotesContext: AppPersistentStudyNotesContext | undefined;
  studyNote: AppStudyNote;
  studyNotesContext: AppStudyNotesContext;
  userId: string | null;
}) {
  const studyNotesMutation =
    input.persistentStudyNotesContext ?? input.studyNotesContext;
  const originalUpdate = createPracticeRepairStudyNoteUpdate({
    expectedAnswer: input.draft.originalExpectedAnswer,
    prompt: input.draft.originalPrompt,
    studyNote: input.studyNote,
  });

  await studyNotesMutation.updateStudyNote(
    input.userId,
    input.studyNote.id,
    originalUpdate,
  );

  return createPracticeRepairSiblingStudyNote({
    draft: {
      expectedAnswer: input.draft.splitExpectedAnswer,
      prompt: input.draft.splitPrompt,
    },
    persistentStudyNotesContext: input.persistentStudyNotesContext,
    sourceStudyNote: input.studyNote,
    studyNotesContext: input.studyNotesContext,
    userId: input.userId,
  });
}

function useSessionResultsSubscription(recallResultsStore: RecallResultsStore) {
  useSyncExternalStore(
    recallResultsStore.subscribe,
    recallResultsStore.getSessionResultsSnapshot,
    recallResultsStore.getSessionResultsSnapshot,
  );
}

function useStudyNotesSubscription(studyNotesStore: StudyNotesStore) {
  useSyncExternalStore(
    studyNotesStore.subscribe,
    studyNotesStore.getSnapshot,
    studyNotesStore.getSnapshot,
  );
}

function PracticeRepairWorkspaceActions({
  isFollowUpRecallPending,
  isMutationPending,
  lifecycleKind,
  onComplete,
  onDismiss,
  onStartFollowUpRecall,
  supersedingPracticeRepairEntryId,
}: Readonly<{
  isFollowUpRecallPending: boolean;
  isMutationPending: boolean;
  lifecycleKind: PracticeRepairEntryLifecycleKind;
  onComplete: () => void;
  onDismiss: () => void;
  onStartFollowUpRecall: () => void;
  supersedingPracticeRepairEntryId: string | null;
}>) {
  switch (lifecycleKind) {
    case "active":
      return (
        <>
          <Button
            disabled={isMutationPending}
            onClick={onComplete}
            type="button"
            variant="primary"
          >
            Mark repair complete
          </Button>
          <Button
            disabled={isMutationPending}
            onClick={onDismiss}
            type="button"
            variant="secondary"
          >
            Dismiss repair
          </Button>
        </>
      );
    case "completed":
      return (
        <Button
          disabled={isFollowUpRecallPending}
          onClick={onStartFollowUpRecall}
          type="button"
          variant="primary"
        >
          Recall again soon
        </Button>
      );
    case "dismissed":
    case "follow-up-satisfied":
    case "study-note-deleted":
      return (
        <ButtonLink to="/recall/results" variant="secondary">
          Open Results
        </ButtonLink>
      );
    case "superseded":
      return (
        <>
          {supersedingPracticeRepairEntryId === null ? null : (
            <ButtonLink
              params={{
                practiceRepairEntryId: supersedingPracticeRepairEntryId,
              }}
              to="/practice-repair/$practiceRepairEntryId"
              variant="primary"
            >
              Open newer Practice Repair
            </ButtonLink>
          )}
          <ButtonLink to="/recall/results" variant="secondary">
            Open Results
          </ButtonLink>
        </>
      );
  }
}

export type StudyNotesPracticeRepairSearch = {
  practiceRepairAction?: PracticeRepairIntent;
  practiceRepairEntryId: string;
  practiceRepairQuestionResultId?: string;
  practiceRepairSessionResultId?: string;
};

export function createStudyNotesPracticeRepairSearch(
  input: StudyNotesPracticeRepairSearch,
): StudyNotesPracticeRepairSearch {
  const search: StudyNotesPracticeRepairSearch = {
    practiceRepairEntryId: input.practiceRepairEntryId,
  };

  if (input.practiceRepairAction !== undefined) {
    search.practiceRepairAction = input.practiceRepairAction;
  }

  if (input.practiceRepairQuestionResultId !== undefined) {
    search.practiceRepairQuestionResultId =
      input.practiceRepairQuestionResultId;
  }

  if (input.practiceRepairSessionResultId !== undefined) {
    search.practiceRepairSessionResultId = input.practiceRepairSessionResultId;
  }

  return search;
}

function isActionSelectionKey(key: string) {
  return key === "Enter" || key === " ";
}

function PracticeRepairWorkspaceDetail({
  children,
  label,
}: Readonly<{
  children: ReactNode;
  label: string;
}>) {
  return (
    <section className="recall-practice-repair-workspace__detail">
      <p className="recall-practice-repair-workspace__detail-label">{label}</p>
      <div className="recall-practice-repair-workspace__detail-copy">
        {children}
      </div>
    </section>
  );
}

function PracticeRepairInlineEditor({
  activeActionCard,
  canEditCurrentStudyNote,
  hasStudyNoteDraftChanges,
  isStudyNoteSavePending,
  memoryAidDraft,
  mode,
  onCreateSiblingStudyNote,
  onMemoryAidDescriptionChange,
  onMemoryAidKindChange,
  onSaveSplitStudyNote,
  onSaveStudyNoteChanges,
  onSaveMemoryAid,
  onSiblingDraftChange,
  onSplitDraftChange,
  onStudyNoteDraftChange,
  siblingStudyNoteDraft,
  splitStudyNoteDraft,
  studyNote,
  studyNoteDraft,
}: Readonly<{
  activeActionCard: PracticeRepairWorkspaceActionCard;
  canEditCurrentStudyNote: boolean;
  hasStudyNoteDraftChanges: boolean;
  isStudyNoteSavePending: boolean;
  memoryAidDraft: PracticeRepairMemoryAidDraft;
  mode: PracticeRepairMode;
  onCreateSiblingStudyNote: (event: FormEvent<HTMLFormElement>) => void;
  onMemoryAidDescriptionChange: (
    event: ChangeEvent<HTMLTextAreaElement>,
  ) => void;
  onMemoryAidKindChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onSaveMemoryAid: (event: FormEvent<HTMLFormElement>) => void;
  onSaveSplitStudyNote: (event: FormEvent<HTMLFormElement>) => void;
  onSaveStudyNoteChanges: () => void;
  onSiblingDraftChange: (
    field: keyof PracticeRepairSiblingStudyNoteDraft,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onSplitDraftChange: (
    field: keyof PracticeRepairSplitStudyNoteDraft,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onStudyNoteDraftChange: (
    field: keyof PracticeRepairCurrentStudyNoteDraft,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  siblingStudyNoteDraft: PracticeRepairSiblingStudyNoteDraft;
  splitStudyNoteDraft: PracticeRepairSplitStudyNoteDraft;
  studyNote: AppStudyNote | null;
  studyNoteDraft: PracticeRepairCurrentStudyNoteDraft;
}>) {
  const isUnavailable = studyNote === null || !canEditCurrentStudyNote;
  const splitSubmitDisabled =
    isUnavailable ||
    isStudyNoteSavePending ||
    splitStudyNoteDraft.splitPrompt.trim().length === 0 ||
    splitStudyNoteDraft.splitExpectedAnswer.trim().length === 0;
  const siblingSubmitDisabled =
    isUnavailable ||
    isStudyNoteSavePending ||
    siblingStudyNoteDraft.prompt.trim().length === 0 ||
    siblingStudyNoteDraft.expectedAnswer.trim().length === 0;
  const memoryAidSubmitDisabled =
    isUnavailable ||
    isStudyNoteSavePending ||
    memoryAidDraft.description.trim().length === 0;

  return (
    <section
      aria-label="Current repair"
      className="recall-practice-repair-workspace__current-editor"
    >
      <div className="recall-practice-repair-workspace__current-editor-copy">
        <p>Current repair</p>
        <h3>{activeActionCard.title}</h3>
        <span>{activeActionCard.description}</span>
      </div>

      {studyNote === null ? (
        <p className="recall-practice-repair-workspace__current-editor-unavailable">
          This Study Note is not available for inline repair.
        </p>
      ) : null}

      {mode === "edit-answer" ? (
        <div className="recall-practice-repair-workspace__current-fields">
          <label className="recall-practice-repair-workspace__current-field">
            <span>Current prompt</span>
            <input
              disabled={isUnavailable}
              maxLength={500}
              onChange={(event) => onStudyNoteDraftChange("prompt", event)}
              value={studyNoteDraft.prompt}
            />
          </label>

          <label className="recall-practice-repair-workspace__current-field">
            <span>Expected answer</span>
            <textarea
              disabled={isUnavailable}
              maxLength={1000}
              onChange={(event) =>
                onStudyNoteDraftChange("expectedAnswer", event)
              }
              rows={5}
              value={studyNoteDraft.expectedAnswer}
            />
          </label>

          {hasStudyNoteDraftChanges ? (
            <div className="recall-practice-repair-workspace__editor-actions">
              <Button
                disabled={isUnavailable || isStudyNoteSavePending}
                onClick={onSaveStudyNoteChanges}
                type="button"
                variant="secondary"
              >
                {isStudyNoteSavePending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "split-note" ? (
        <form
          className="recall-practice-repair-workspace__current-fields"
          onSubmit={onSaveSplitStudyNote}
        >
          <label className="recall-practice-repair-workspace__current-field">
            <span>Original prompt</span>
            <input
              disabled={isUnavailable}
              maxLength={500}
              onChange={(event) => onSplitDraftChange("originalPrompt", event)}
              value={splitStudyNoteDraft.originalPrompt}
            />
          </label>

          <label className="recall-practice-repair-workspace__current-field">
            <span>Original expected answer</span>
            <textarea
              disabled={isUnavailable}
              maxLength={1000}
              onChange={(event) =>
                onSplitDraftChange("originalExpectedAnswer", event)
              }
              rows={4}
              value={splitStudyNoteDraft.originalExpectedAnswer}
            />
          </label>

          <label className="recall-practice-repair-workspace__current-field">
            <span>New Study Note prompt</span>
            <input
              disabled={isUnavailable}
              maxLength={500}
              onChange={(event) => onSplitDraftChange("splitPrompt", event)}
              value={splitStudyNoteDraft.splitPrompt}
            />
          </label>

          <label className="recall-practice-repair-workspace__current-field">
            <span>New expected answer</span>
            <textarea
              disabled={isUnavailable}
              maxLength={1000}
              onChange={(event) =>
                onSplitDraftChange("splitExpectedAnswer", event)
              }
              rows={4}
              value={splitStudyNoteDraft.splitExpectedAnswer}
            />
          </label>

          <div className="recall-practice-repair-workspace__editor-actions">
            <Button
              disabled={splitSubmitDisabled}
              type="submit"
              variant="secondary"
            >
              {isStudyNoteSavePending ? "Saving..." : "Save split"}
            </Button>
          </div>
        </form>
      ) : null}

      {mode === "create-sibling" ? (
        <form
          className="recall-practice-repair-workspace__current-fields"
          onSubmit={onCreateSiblingStudyNote}
        >
          <label className="recall-practice-repair-workspace__current-field">
            <span>Sibling prompt</span>
            <input
              disabled={isUnavailable}
              maxLength={500}
              onChange={(event) => onSiblingDraftChange("prompt", event)}
              value={siblingStudyNoteDraft.prompt}
            />
          </label>

          <label className="recall-practice-repair-workspace__current-field">
            <span>Sibling expected answer</span>
            <textarea
              disabled={isUnavailable}
              maxLength={1000}
              onChange={(event) =>
                onSiblingDraftChange("expectedAnswer", event)
              }
              rows={5}
              value={siblingStudyNoteDraft.expectedAnswer}
            />
          </label>

          <div className="recall-practice-repair-workspace__editor-actions">
            <Button
              disabled={siblingSubmitDisabled}
              type="submit"
              variant="secondary"
            >
              {isStudyNoteSavePending
                ? "Creating..."
                : "Create sibling Study Note"}
            </Button>
          </div>
        </form>
      ) : null}

      {mode === "memory-aid" ? (
        <form
          className="recall-practice-repair-workspace__current-fields"
          onSubmit={onSaveMemoryAid}
        >
          <label className="recall-practice-repair-workspace__current-field">
            <span>Memory aid type</span>
            <select
              disabled={isUnavailable}
              onChange={onMemoryAidKindChange}
              value={memoryAidDraft.kind}
            >
              <option value="Metaphor">Metaphor</option>
              <option value="Acronym">Acronym</option>
            </select>
          </label>

          <label className="recall-practice-repair-workspace__current-field">
            <span>Memory aid</span>
            <textarea
              disabled={isUnavailable}
              maxLength={500}
              onChange={onMemoryAidDescriptionChange}
              rows={4}
              value={memoryAidDraft.description}
            />
          </label>

          <div className="recall-practice-repair-workspace__editor-actions">
            <Button
              disabled={memoryAidSubmitDisabled}
              type="submit"
              variant="secondary"
            >
              {isStudyNoteSavePending ? "Saving..." : "Save memory aid"}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function RecallPracticeRepairRoute() {
  const protectedWorkspaceRefreshState = useProtectedWorkspaceRefreshState();
  const { practiceRepairEntryId } = Route.useParams();
  const search = Route.useSearch();
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const persistentRecallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentRecall,
  });
  const studyNotesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.studyNotes,
  });
  const persistentStudyNotesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentStudyNotes,
  });
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected");
  const recallResultsStore = persistentRecallContext ?? recallContext;
  const recallResultsContext =
    persistentRecallContext?.readonlyContext ?? recallContext;
  const studyNotesStore = persistentStudyNotesContext ?? studyNotesContext;
  useSessionResultsSubscription(recallResultsStore);
  useStudyNotesSubscription(studyNotesStore);
  const userId = sessionSnapshot.user?.id ?? null;
  const sessionResults =
    userId === null ? [] : recallResultsContext.listSessionResults({ userId });
  const studyNotes =
    userId === null
      ? []
      : listStudyNotesForUser(studyNotesStore.getSnapshot(), userId);

  if (
    protectedWorkspaceRefreshState.recall ||
    protectedWorkspaceRefreshState.studyNotes
  ) {
    return null;
  }

  const workspace = findPracticeRepairWorkspace({
    practiceRepairEntryId,
    sessionResults,
  });

  if (workspace === null) {
    return <Navigate to="/practice-repair" />;
  }

  return (
    <RecallPracticeRepairWorkspacePage
      persistentRecallContext={persistentRecallContext}
      persistentStudyNotesContext={persistentStudyNotesContext}
      recallContext={recallContext}
      sessionResults={sessionResults}
      studyNote={
        studyNotes.find(
          (studyNote) => studyNote.id === workspace.entry.reference.studyNoteId,
        ) ?? null
      }
      studyNotesContext={studyNotesContext}
      userId={userId}
      selectedMode={search.mode ?? "edit-answer"}
      workspace={workspace}
    />
  );
}

export function RecallPracticeRepairWorkspacePage({
  persistentRecallContext,
  persistentStudyNotesContext,
  recallContext,
  sessionResults,
  selectedMode,
  studyNote,
  studyNotesContext,
  userId,
  workspace,
}: Readonly<{
  persistentRecallContext: AppPersistentRecallContext | undefined;
  persistentStudyNotesContext: AppPersistentStudyNotesContext | undefined;
  recallContext: AppRecallContext;
  sessionResults: readonly FlashCardSessionResult[];
  selectedMode: PracticeRepairMode;
  studyNote: AppStudyNote | null;
  studyNotesContext: AppStudyNotesContext;
  userId: string | null;
  workspace: PracticeRepairWorkspace;
}>) {
  const navigate = useNavigate();
  const { t } = useAppTranslation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isFollowUpRecallPending, setIsFollowUpRecallPending] = useState(false);
  const [isStudyNoteSavePending, setIsStudyNoteSavePending] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<PracticeRepairLifecycleAction | null>(null);
  const [splitStudyNoteDraft, setSplitStudyNoteDraft] =
    useState<PracticeRepairSplitStudyNoteDraft>(() =>
      createSplitStudyNoteDraft(studyNote),
    );
  const [siblingStudyNoteDraft, setSiblingStudyNoteDraft] =
    useState<PracticeRepairSiblingStudyNoteDraft>(() =>
      createSiblingStudyNoteDraft(studyNote),
    );
  const [memoryAidDraft, setMemoryAidDraft] =
    useState<PracticeRepairMemoryAidDraft>(() =>
      createMemoryAidDraft(studyNote),
    );
  const [studyNoteDraft, setStudyNoteDraft] =
    useState<PracticeRepairCurrentStudyNoteDraft>(() =>
      createCurrentStudyNoteDraft(studyNote),
    );
  const { entry, question } = workspace;
  const practiceRepairEntryId = getPracticeRepairEntryId(entry);
  const prompt = getPracticeRepairQuestionPrompt(question);
  const expectedAnswer = getPracticeRepairQuestionExpectedAnswer(question);
  const referenceTitle = getPracticeRepairQuestionReferenceTitle(question);
  const referenceText = getPracticeRepairQuestionReferenceText(question);
  const lifecycleKind = getPracticeRepairEntryLifecycleKind(entry);
  const cardTitle = lifecycleKind === "active" ? referenceTitle : prompt;
  const supersedingPracticeRepairEntryId =
    lifecycleKind === "superseded"
      ? findSupersedingPracticeRepairEntryId({
          entry,
          sessionResults,
        })
      : null;
  const hasSupersedingEntry = supersedingPracticeRepairEntryId !== null;
  const nextStepCopy = getPracticeRepairNextStepCopy({
    hasSupersedingEntry,
    lifecycleKind,
  });
  const supportCopy = getPracticeRepairSupportCopy({
    hasSupersedingEntry,
    lifecycleKind,
  });
  const ratingLabel =
    question.selfRating === null
      ? "Not rated"
      : t(getRecallRatingTranslationKey(question.selfRating));
  const ratingTone = getRecallRatingTone(question.selfRating);
  const recordedAnswer = getPracticeRepairRecordedAnswer(question);
  const hasRecordedAnswer = (question.typedAnswer?.trim() ?? "").length > 0;
  const canOpenStudyNotes = lifecycleKind !== "study-note-deleted";
  const isMutationPending = pendingAction !== null;
  const hasStudyNoteDraftChanges = hasCurrentStudyNoteDraftChanges({
    draft: studyNoteDraft,
    studyNote,
  });
  const hasSplitDraftChanges = hasSplitStudyNoteDraftChanges({
    draft: splitStudyNoteDraft,
    studyNote,
  });
  const hasSiblingDraftChanges = hasSiblingStudyNoteDraftChanges(
    siblingStudyNoteDraft,
  );
  const hasMemoryAidChanges = hasMemoryAidDraftChanges({
    draft: memoryAidDraft,
    studyNote,
  });
  const canEditCurrentStudyNote =
    lifecycleKind === "active" && canOpenStudyNotes && studyNote !== null;
  const showSuggestedRepairs = lifecycleKind === "active";
  const activeActionCard =
    workspaceActionCards.find((card) => card.mode === selectedMode) ??
    getDefaultPracticeRepairActionCard();

  useEffect(() => {
    if (hasStudyNoteDraftChanges) {
      return;
    }

    setStudyNoteDraft(createCurrentStudyNoteDraft(studyNote));
  }, [hasStudyNoteDraftChanges, studyNote]);

  useEffect(() => {
    if (hasSplitDraftChanges) {
      return;
    }

    setSplitStudyNoteDraft(createSplitStudyNoteDraft(studyNote));
  }, [hasSplitDraftChanges, studyNote]);

  useEffect(() => {
    if (hasSiblingDraftChanges) {
      return;
    }

    setSiblingStudyNoteDraft(createSiblingStudyNoteDraft(studyNote));
  }, [hasSiblingDraftChanges, studyNote]);

  useEffect(() => {
    if (hasMemoryAidChanges) {
      return;
    }

    setMemoryAidDraft(createMemoryAidDraft(studyNote));
  }, [hasMemoryAidChanges, studyNote]);

  function updateStudyNoteDraft(
    field: keyof PracticeRepairCurrentStudyNoteDraft,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const value = event.target.value;

    setStudyNoteDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateSplitStudyNoteDraft(
    field: keyof PracticeRepairSplitStudyNoteDraft,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const value = event.target.value;

    setSplitStudyNoteDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateSiblingStudyNoteDraft(
    field: keyof PracticeRepairSiblingStudyNoteDraft,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const value = event.target.value;

    setSiblingStudyNoteDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateMemoryAidKind(event: ChangeEvent<HTMLSelectElement>) {
    const kind = event.target.value as PracticeRepairMemoryAidKind;

    setMemoryAidDraft({
      description: getMemoryAidDescription({
        kind,
        studyNote,
      }),
      kind,
    });
  }

  function updateMemoryAidDescription(event: ChangeEvent<HTMLTextAreaElement>) {
    setMemoryAidDraft((current) => ({
      ...current,
      description: event.target.value,
    }));
  }

  function selectRepairMode(mode: PracticeRepairMode) {
    void navigate({
      params: {
        practiceRepairEntryId,
      },
      search: {
        mode,
      },
      to: "/practice-repair/$practiceRepairEntryId",
    });
  }

  async function handleSaveStudyNoteChanges() {
    if (
      studyNote === null ||
      !hasStudyNoteDraftChanges ||
      isStudyNoteSavePending
    ) {
      return;
    }

    setErrorMessage(null);
    setFeedbackMessage(null);
    setIsStudyNoteSavePending(true);

    try {
      await updatePracticeRepairStudyNote({
        draft: studyNoteDraft,
        persistentStudyNotesContext,
        studyNote,
        studyNotesContext,
        userId,
      });
      setFeedbackMessage("Study Note changes saved");
    } catch (error) {
      setErrorMessage(
        error instanceof AppStudyNotesError
          ? error.message
          : "Study Note changes could not be saved.",
      );
    } finally {
      setIsStudyNoteSavePending(false);
    }
  }

  async function handleSaveSplitStudyNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      studyNote === null ||
      isStudyNoteSavePending ||
      splitStudyNoteDraft.splitPrompt.trim().length === 0 ||
      splitStudyNoteDraft.splitExpectedAnswer.trim().length === 0
    ) {
      return;
    }

    setErrorMessage(null);
    setFeedbackMessage(null);
    setIsStudyNoteSavePending(true);

    try {
      await savePracticeRepairSplitStudyNote({
        draft: splitStudyNoteDraft,
        persistentStudyNotesContext,
        studyNote,
        studyNotesContext,
        userId,
      });
      setFeedbackMessage("Split Study Note saved");
      setSplitStudyNoteDraft(createSplitStudyNoteDraft(studyNote));
    } catch (error) {
      setErrorMessage(
        error instanceof AppStudyNotesError
          ? error.message
          : "Split Study Note could not be saved.",
      );
    } finally {
      setIsStudyNoteSavePending(false);
    }
  }

  async function handleCreateSiblingStudyNote(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      studyNote === null ||
      isStudyNoteSavePending ||
      siblingStudyNoteDraft.prompt.trim().length === 0 ||
      siblingStudyNoteDraft.expectedAnswer.trim().length === 0
    ) {
      return;
    }

    setErrorMessage(null);
    setFeedbackMessage(null);
    setIsStudyNoteSavePending(true);

    try {
      await createPracticeRepairSiblingStudyNote({
        draft: siblingStudyNoteDraft,
        persistentStudyNotesContext,
        sourceStudyNote: studyNote,
        studyNotesContext,
        userId,
      });
      setFeedbackMessage("Sibling Study Note created");
      setSiblingStudyNoteDraft(createSiblingStudyNoteDraft(studyNote));
    } catch (error) {
      setErrorMessage(
        error instanceof AppStudyNotesError
          ? error.message
          : "Sibling Study Note could not be created.",
      );
    } finally {
      setIsStudyNoteSavePending(false);
    }
  }

  async function handleSaveMemoryAid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      studyNote === null ||
      isStudyNoteSavePending ||
      memoryAidDraft.description.trim().length === 0
    ) {
      return;
    }

    setErrorMessage(null);
    setFeedbackMessage(null);
    setIsStudyNoteSavePending(true);

    try {
      await updatePracticeRepairMemoryAid({
        draft: memoryAidDraft,
        persistentStudyNotesContext,
        studyNote,
        studyNotesContext,
        userId,
      });
      setFeedbackMessage("Memory aid saved");
    } catch (error) {
      setErrorMessage(
        error instanceof AppStudyNotesError
          ? error.message
          : "Memory aid could not be saved.",
      );
    } finally {
      setIsStudyNoteSavePending(false);
    }
  }

  async function handleLifecycleMutation(
    action: PracticeRepairLifecycleAction,
  ) {
    if (
      action === "dismiss" &&
      !window.confirm(
        "Dismiss this Practice Repair? It will leave the active queue but stay in Results history.",
      )
    ) {
      return;
    }

    setErrorMessage(null);
    setFeedbackMessage(null);
    setPendingAction(action);

    try {
      await mutatePracticeRepairLifecycle({
        action,
        persistentRecallContext,
        recallContext,
        reference: entry.reference,
        userId,
      });
      setFeedbackMessage(getPracticeRepairFeedbackMessage(action));
    } catch (error) {
      setErrorMessage(
        error instanceof AppRecallError
          ? error.message
          : getPracticeRepairErrorMessage(action),
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleStartFollowUpRecall() {
    if (userId === null) {
      return;
    }

    setErrorMessage(null);
    setFeedbackMessage(null);
    setIsFollowUpRecallPending(true);

    try {
      await startPracticeRepairFollowUpRecall({
        persistentRecallContext,
        recallContext,
        studyNoteId: entry.reference.studyNoteId,
        userId,
      });
      await navigate({ to: "/recall/session" });
    } catch (error) {
      setErrorMessage(
        error instanceof AppRecallError
          ? error.message
          : getPracticeRepairFollowUpStartErrorMessage(),
      );
    } finally {
      setIsFollowUpRecallPending(false);
    }
  }

  return (
    <PageLayout
      actions={
        <ButtonLink to="/practice-repair" variant="secondary">
          Practice Repair Queue
        </ButtonLink>
      }
      aria-label="Practice Repair workspace"
      as="section"
      className="recall-workspace recall-surface recall-practice-repair-workspace"
      description="Keep the original Needs practice evidence visible while you finish one concrete repair from Recall."
      headerClassName="recall-surface__header"
      headingLevel={1}
      title="Practice Repair"
    >
      <div className="recall-practice-repair-workspace__layout">
        <div className="recall-practice-repair-workspace__main">
          <section
            aria-label="Practice Repair evidence"
            className={
              lifecycleKind === "active"
                ? "recall-panel recall-practice-repair-workspace__evidence recall-practice-repair-workspace__evidence--compact"
                : "recall-panel recall-practice-repair-workspace__evidence"
            }
          >
            <header className="recall-practice-repair-workspace__card-header">
              {lifecycleKind === "active" ? (
                <span
                  aria-hidden="true"
                  className="recall-practice-repair-workspace__note-icon"
                >
                  <StudyNoteDocumentIcon />
                </span>
              ) : null}

              <div className="recall-practice-repair-workspace__card-copy">
                {lifecycleKind === "active" ? null : (
                  <p className="recall-practice-repair-workspace__eyebrow">
                    Study Note
                  </p>
                )}
                <h2 className="recall-practice-repair-workspace__study-note-title">
                  {cardTitle}
                </h2>
                <p className="recall-practice-repair-workspace__study-note-meta">
                  {getStudyNoteMeta(question)}
                </p>
              </div>

              {canOpenStudyNotes ? (
                <ButtonLink
                  className={
                    lifecycleKind === "active"
                      ? "recall-practice-repair-workspace__view-note"
                      : undefined
                  }
                  params={{
                    studyNoteId: entry.reference.studyNoteId,
                  }}
                  search={createStudyNotesPracticeRepairSearch({
                    practiceRepairAction: entry.intent,
                    practiceRepairEntryId,
                  })}
                  to={appRoutePaths.studyNoteEditor}
                  variant="secondary"
                >
                  {lifecycleKind === "active" ? (
                    <>
                      <span>View full note</span>
                      <ExternalLinkIcon />
                    </>
                  ) : (
                    "View full note"
                  )}
                </ButtonLink>
              ) : null}
            </header>

            <PracticeRepairWorkspaceDetail label="Prompt">
              {prompt}
            </PracticeRepairWorkspaceDetail>

            <section className="recall-practice-repair-workspace__detail">
              <div className="recall-practice-repair-workspace__detail-header">
                <p className="recall-practice-repair-workspace__detail-label">
                  Your answer
                </p>
                {lifecycleKind === "active" ? null : (
                  <span
                    className="recall-selected-result__row-pill recall-practice-repair-workspace__rating"
                    data-rating-tone={ratingTone}
                  >
                    {ratingLabel}
                  </span>
                )}
              </div>
              <div
                className="recall-practice-repair-workspace__detail-copy"
                data-empty-answer={hasRecordedAnswer ? undefined : "true"}
              >
                {recordedAnswer}
              </div>
            </section>

            <PracticeRepairWorkspaceDetail label="Expected answer">
              {expectedAnswer}
            </PracticeRepairWorkspaceDetail>

            {lifecycleKind === "active" ? null : (
              <PracticeRepairWorkspaceDetail label="Reference explanation">
                <strong>{referenceTitle}</strong>
                <span>{referenceText}</span>
              </PracticeRepairWorkspaceDetail>
            )}

            <section className="recall-practice-repair-workspace__detail">
              <p className="recall-practice-repair-workspace__detail-label">
                Last score
              </p>
              <div className="recall-practice-repair-workspace__detail-copy">
                <strong className="recall-practice-repair-workspace__score-value">
                  {ratingLabel}
                </strong>
                <span>Weak recall is a signal to adjust and reinforce.</span>
              </div>
            </section>

            {lifecycleKind === "active" ? (
              <PracticeRepairInlineEditor
                activeActionCard={activeActionCard}
                canEditCurrentStudyNote={canEditCurrentStudyNote}
                hasStudyNoteDraftChanges={hasStudyNoteDraftChanges}
                isStudyNoteSavePending={isStudyNoteSavePending}
                memoryAidDraft={memoryAidDraft}
                mode={selectedMode}
                onCreateSiblingStudyNote={handleCreateSiblingStudyNote}
                onMemoryAidDescriptionChange={updateMemoryAidDescription}
                onMemoryAidKindChange={updateMemoryAidKind}
                onSaveMemoryAid={handleSaveMemoryAid}
                onSaveSplitStudyNote={handleSaveSplitStudyNote}
                onSaveStudyNoteChanges={() => void handleSaveStudyNoteChanges()}
                onSiblingDraftChange={updateSiblingStudyNoteDraft}
                onSplitDraftChange={updateSplitStudyNoteDraft}
                onStudyNoteDraftChange={updateStudyNoteDraft}
                siblingStudyNoteDraft={siblingStudyNoteDraft}
                splitStudyNoteDraft={splitStudyNoteDraft}
                studyNote={studyNote}
                studyNoteDraft={studyNoteDraft}
              />
            ) : null}
          </section>
        </div>

        <aside
          aria-label="Practice Repair actions"
          className="recall-practice-repair-workspace__sidebar"
        >
          <section className="recall-panel recall-practice-repair-workspace__panel">
            <div className="recall-practice-repair-workspace__panel-copy">
              <h2>{showSuggestedRepairs ? "Repair options" : "Next step"}</h2>
              <p>
                {showSuggestedRepairs
                  ? "Choose one exact improvement to make now. Do one thing well, not many."
                  : nextStepCopy}
              </p>
            </div>

            {showSuggestedRepairs ? (
              <div className="recall-practice-repair-workspace__repair-list">
                {workspaceActionCards.map((card) => (
                  <PracticeRepairWorkspaceActionButton
                    card={card}
                    isSelected={selectedMode === card.mode}
                    key={card.intent}
                    onSelect={selectRepairMode}
                  />
                ))}
              </div>
            ) : null}

            {feedbackMessage === null ? null : (
              <p className="recall-feedback" role="status">
                {feedbackMessage}
              </p>
            )}

            {errorMessage === null ? null : (
              <p
                className="recall-practice-repair-workspace__error"
                role="alert"
              >
                {errorMessage}
              </p>
            )}

            <div className="recall-practice-repair-workspace__actions">
              <PracticeRepairWorkspaceActions
                isFollowUpRecallPending={isFollowUpRecallPending}
                isMutationPending={isMutationPending}
                lifecycleKind={lifecycleKind}
                onComplete={() => void handleLifecycleMutation("complete")}
                onDismiss={() => void handleLifecycleMutation("dismiss")}
                onStartFollowUpRecall={() => void handleStartFollowUpRecall()}
                supersedingPracticeRepairEntryId={
                  supersedingPracticeRepairEntryId
                }
              />
            </div>

            <p className="recall-practice-repair-workspace__support">
              {supportCopy}
            </p>
          </section>
        </aside>
      </div>
    </PageLayout>
  );
}

function PracticeRepairWorkspaceActionButton({
  card,
  isSelected,
  onSelect,
}: Readonly<{
  card: PracticeRepairWorkspaceActionCard;
  isSelected: boolean;
  onSelect: (mode: PracticeRepairMode) => void;
}>) {
  const titleId = `practice-repair-workspace-card-title-${card.mode}`;
  const descriptionId = `practice-repair-workspace-card-description-${card.mode}`;

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!isActionSelectionKey(event.key)) {
      return;
    }

    event.preventDefault();
    onSelect(card.mode);
  }

  return (
    <article
      className="recall-practice-repair-workspace__repair-card"
      data-selected={isSelected ? "true" : "false"}
    >
      <button
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-pressed={isSelected}
        className="recall-practice-repair-workspace__repair-button"
        onClick={() => onSelect(card.mode)}
        onKeyDown={handleKeyDown}
        type="button"
      >
        <span className="recall-practice-repair-workspace__repair-copy">
          <span
            className="recall-practice-repair-workspace__repair-title"
            id={titleId}
          >
            {card.title}
          </span>
          <span
            className="recall-practice-repair-workspace__repair-description"
            id={descriptionId}
          >
            {card.description}
          </span>
        </span>

        <span
          aria-hidden="true"
          className="recall-practice-repair-workspace__repair-chevron"
        >
          <SuggestionChevronIcon />
        </span>
      </button>
    </article>
  );
}

export function SuggestionChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="18"
      viewBox="0 0 18 18"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 4.5 11.5 9 7 13.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function StudyNoteDocumentIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M6 3h9l3 3v15H6V3Z" />
      <path d="M14 3v4h4" />
      <path d="M9 11h6" />
      <path d="M9 15h5" />
    </svg>
  );
}

export function ExternalLinkIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M14 5h5v5" />
      <path d="m10 14 9-9" />
      <path d="M19 14v5H5V5h5" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="m5 19 4.5-1 9-9a2.1 2.1 0 0 0-3-3l-9 9L5 19Z" />
      <path d="m14 7 3 3" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M20 12a8 8 0 0 1-13.3 6" />
      <path d="M4 12a8 8 0 0 1 13.3-6" />
      <path d="M17 2v4h-4" />
      <path d="M7 22v-4h4" />
    </svg>
  );
}

export function WarningIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v7" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function InfoIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </svg>
  );
}
