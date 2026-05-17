import {
  createFileRoute,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { z } from "zod";

import { Button, ButtonLink } from "../../design-system/button";
import { PageHeader } from "../../design-system/page-header";
import { defaultUserTimeZone } from "../access/session/session-contract";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import type { AppLabel } from "../labels/label-management/labels";
import "../notes/notes-workspace/notes-editor-route.css";
import "../notes/notes-workspace/notes-form-foundation.css";
import "../notes/notes-workspace/notes-foundation.css";
import "../notes/notes-workspace/notes-responsive.css";
import "../notes/notes-workspace/notes-toolbar.css";
import {
  AppRecallError,
  deriveRecallGuidance,
  formatNextRecallTiming,
  type RecallQuestion,
  type RecallSchedule,
  resolveSessionResultQuestion,
  type SessionResult,
} from "../recall";
import { getInterleavedRecallRecommendation } from "../recall/interleaved-recall";
import {
  formatPracticeRepairIntentLabel,
  getPracticeRepairEntryId,
  isPracticeRepairEntryForIntent,
  listActionablePracticeFollowUpsForStudyNote,
  type PracticeRepairEntry,
  type PracticeRepairEntryForIntent,
  type PracticeRepairIntent,
  type PracticeRepairLinkedCompletionInput,
  type PracticeRepairMemoryAidKind,
  type PracticeRepairQuestionReference,
  practiceRepairIntents,
} from "../recall/recall-practice-repair";
import "./study-notes.css";
import {
  type AppPersistentStudyNotesContext,
  type AppStudyNote,
  type AppStudyNotesContext,
  AppStudyNotesError,
  deriveStudyNoteLearningStates,
  formatStudyNoteDueLabel,
  formatStudyNoteLearningStateCompactLabel,
  formatStudyNotePracticeSignalLabel,
  getStudyNoteReadiness,
  listStudyNotesForUser,
  type StudyNoteLearningState,
  toStudyNoteRecallHistories,
  type UpdateStudyNoteInput,
} from ".";
import { getStudyNotePracticeRepair } from "./practice-repair";
import {
  deriveStudyNoteRecallInsight,
  formatRecallSelfRatingResultLabel,
} from "./study-note-recall-insight";

const studyNotesSearchSchema = z.object({
  practiceRepairAction: z.enum(practiceRepairIntents).optional(),
  practiceRepairEntryId: z.string().optional(),
});

export const Route = createFileRoute("/_protected/study-notes")({
  validateSearch: studyNotesSearchSchema,
  component: StudyNotesWorkspace,
});

type StudyNotesSearch = z.infer<typeof studyNotesSearchSchema>;
type LinkedPracticeRepairContext = {
  action: PracticeRepairIntent;
  entry: PracticeRepairEntry;
  practiceRepairEntryId: string;
};

function createBlankDraft(): UpdateStudyNoteInput {
  return {
    acronyms: [],
    expectedAnswer: "",
    labelIds: [],
    metaphors: [],
    prompt: "",
    sourceBody: "",
    sourceTitle: "",
  };
}

function findLinkedPracticeRepairContext(input: {
  practiceRepairAction: StudyNotesSearch["practiceRepairAction"];
  practiceRepairEntryId: string | undefined;
  sessionResults: readonly SessionResult[];
}): LinkedPracticeRepairContext | null {
  const { practiceRepairAction, practiceRepairEntryId, sessionResults } = input;

  if (practiceRepairEntryId === undefined) {
    return null;
  }

  for (const result of sessionResults) {
    for (const question of result.questions) {
      const entry = question.practiceRepairEntry;

      if (
        entry !== undefined &&
        getPracticeRepairEntryId(entry) === practiceRepairEntryId
      ) {
        return {
          action: practiceRepairAction ?? entry.intent,
          entry,
          practiceRepairEntryId,
        };
      }
    }
  }

  return null;
}

function getLinkedPracticeRepairKey(
  context: Pick<
    LinkedPracticeRepairContext,
    "action" | "practiceRepairEntryId"
  >,
) {
  return `${context.practiceRepairEntryId}:${context.action}`;
}

function createDraftFromStudyNote(
  studyNote: AppStudyNote | null,
): UpdateStudyNoteInput {
  if (studyNote === null) {
    return createBlankDraft();
  }

  return {
    acronyms: studyNote.acronyms.map((acronym) => ({ ...acronym })),
    expectedAnswer: studyNote.expectedAnswer,
    labelIds: [...studyNote.labelIds],
    metaphors: studyNote.metaphors.map((metaphor) => ({ ...metaphor })),
    prompt: studyNote.prompt,
    sourceBody: studyNote.source.body,
    sourceTitle: studyNote.source.title,
  };
}

function normalizeSupportDescriptionsForComparison(
  supportDescriptions: readonly { description: string }[],
) {
  return supportDescriptions
    .map((supportDescription) => supportDescription.description.trim())
    .filter((description) => description.length > 0);
}

function haveSameStringSet(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightValues = new Set(right);

  return left.every((value) => rightValues.has(value));
}

function haveSameStringSequence(
  left: readonly string[],
  right: readonly string[],
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function areStudyNoteDraftsEqual(
  left: UpdateStudyNoteInput,
  right: UpdateStudyNoteInput,
) {
  return (
    left.prompt.trim() === right.prompt.trim() &&
    left.expectedAnswer.trim() === right.expectedAnswer.trim() &&
    left.sourceBody.trim() === right.sourceBody.trim() &&
    left.sourceTitle.trim() === right.sourceTitle.trim() &&
    haveSameStringSet(left.labelIds, right.labelIds) &&
    haveSameStringSequence(
      normalizeSupportDescriptionsForComparison(left.metaphors),
      normalizeSupportDescriptionsForComparison(right.metaphors),
    ) &&
    haveSameStringSequence(
      normalizeSupportDescriptionsForComparison(left.acronyms),
      normalizeSupportDescriptionsForComparison(right.acronyms),
    )
  );
}

function didSplitStudyNoteDraftChange(input: {
  draft: UpdateStudyNoteInput;
  studyNote: AppStudyNote;
}) {
  return (
    input.draft.prompt.trim() !== input.studyNote.prompt.trim() ||
    input.draft.expectedAnswer.trim() !==
      input.studyNote.expectedAnswer.trim() ||
    input.draft.sourceBody.trim() !== input.studyNote.source.body.trim() ||
    input.draft.sourceTitle.trim() !== input.studyNote.source.title.trim()
  );
}

function StudyNotesTextField({
  label,
  maxLength,
  onChange,
  optional = false,
  placeholder,
  value,
}: Readonly<{
  label: string;
  maxLength: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  optional?: boolean;
  placeholder?: string;
  value: string;
}>) {
  return (
    <label className="study-notes-field">
      <span className="study-notes-field__label">
        {label}
        {optional ? <span aria-hidden="true"> (optional)</span> : null}
      </span>
      <input
        aria-label={label}
        maxLength={maxLength}
        onChange={onChange}
        placeholder={placeholder ?? label}
        value={value}
      />
      <span className="study-notes-field__count">
        {value.length}/{maxLength}
      </span>
    </label>
  );
}

function StudyNotesTextarea({
  label,
  maxLength,
  onChange,
  optional = false,
  placeholder,
  rows,
  value,
}: Readonly<{
  label: string;
  maxLength: number;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  optional?: boolean;
  placeholder?: string;
  rows: number;
  value: string;
}>) {
  return (
    <label className="study-notes-field">
      <span className="study-notes-field__label">
        {label}
        {optional ? <span aria-hidden="true"> (optional)</span> : null}
      </span>
      <textarea
        aria-label={label}
        maxLength={maxLength}
        onChange={onChange}
        placeholder={placeholder ?? label}
        rows={rows}
        value={value}
      />
      <span className="study-notes-field__count">
        {value.length}/{maxLength}
      </span>
    </label>
  );
}

function StudyNoteFact({
  icon,
  label,
  value,
  valueClassName,
}: Readonly<{
  icon: ReactNode;
  label: string;
  value: ReactNode;
  valueClassName?: string;
}>) {
  return (
    <div className="study-notes-fact">
      <dt>
        <span aria-hidden="true" className="study-notes-fact__icon">
          {icon}
        </span>
        <span>{label}</span>
      </dt>
      <dd
        className={["study-notes-fact__value", valueClassName]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7-11-7Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M4 7h7" />
      <path d="M15 7h5" />
      <path d="M13 5v4" />
      <path d="M4 17h5" />
      <path d="M13 17h7" />
      <path d="M11 15v4" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

function StudyNoteDocumentIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M6 3h9l3 3v15H6V3Z" />
      <path d="M14 3v4h4" />
      <path d="M9 11h6" />
      <path d="M9 15h5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="m5 19 4.5-1 9-9a2.1 2.1 0 0 0-3-3l-9 9L5 19Z" />
      <path d="m14 7 3 3" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M8 8h10v12H8V8Z" />
      <path d="M6 16H4V4h10v2" />
    </svg>
  );
}

function MoreVerticalIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M12 6h.01" />
      <path d="M12 12h.01" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function CalendarCheckIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M7 3v4" />
      <path d="M17 3v4" />
      <path d="M4 8h16" />
      <path d="M5 5h14v15H5V5Z" />
      <path d="m8 14 2 2 5-5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="m4 16 5-5 4 4 7-8" />
      <path d="M15 7h5v5" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M4 5h9l7 7-7 7H4V5Z" />
      <path d="M9 12h.01" />
    </svg>
  );
}

function setLabelIdSelection(
  labelIds: readonly string[],
  labelId: string,
  isSelected: boolean,
): string[] {
  if (isSelected) {
    return [...labelIds, labelId];
  }

  return labelIds.filter((currentLabelId) => currentLabelId !== labelId);
}

function createSingleSupportDescriptionDraft(description: string) {
  if (description.trim().length === 0) {
    return [];
  }

  return [{ description }];
}
const STUDY_NOTE_EDITOR_FORM_ID = "study-note-editor-form";
const STUDY_NOTE_GUIDANCE_COPY = {
  acronymPlaceholder: "Initials that cue the answer.",
  expectedAnswerPlaceholder:
    "Explain the reason, steps, limits, and one example or non-example.",
  metaphorPlaceholder: "Compare it to something familiar.",
  prompt:
    "Ask why, how, when it works, when it does not, or what a worked example shows.",
  promptPlaceholder:
    "Why does this work? How would I use it? What example proves it?",
} as const;

type StudyNoteLearningLabels = {
  compact: string;
  due: string | null;
  practice: string | null;
};

type StudyNoteStatusKind = "attention" | "complete" | "neutral" | "practice";
type StudyNoteEditorTarget =
  | {
      studyNoteId: string;
      type: "study-note";
    }
  | {
      type: "new";
    };

type PracticeRepairMutationAction =
  | "complete"
  | "dismiss"
  | "edit"
  | "linked-action";
type SplitStudyNotePracticeRepairEntry =
  PracticeRepairEntryForIntent<"split-study-note">;
type PracticeRepairOriginSnapshot = {
  prompt: string;
  ratingLabel: string;
  sourceTitle: string;
};
type PracticeRepairEntryView = {
  entry: PracticeRepairEntry;
  origin: PracticeRepairOriginSnapshot | null;
};
type ActivePracticeRepairEntryReader = {
  listActivePracticeRepairEntriesForStudyNote(input: {
    studyNoteId: string;
    userId: string;
  }): PracticeRepairEntry[];
};
type PendingPracticeRepairMemoryAidAction = {
  memoryAidKind: PracticeRepairMemoryAidKind;
  reference: PracticeRepairQuestionReference;
} | null;
type PracticeRepairEntryViewInput = {
  sessionResults: readonly SessionResult[];
  studyNoteId: string | null;
};
type ActivePracticeRepairEntryViewInput = PracticeRepairEntryViewInput & {
  recallContext: ActivePracticeRepairEntryReader;
  userId: string | null;
};

const practiceRepairMutationActions = [
  "edit",
  "linked-action",
  "complete",
  "dismiss",
] as const satisfies readonly PracticeRepairMutationAction[];

const selectedStudyNoteDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function getStudyNoteStatusKind(
  learningState: StudyNoteLearningState | null,
): StudyNoteStatusKind {
  if (learningState === null || learningState.latestScore === null) {
    return "attention";
  }

  if (learningState.needsPractice) {
    return "practice";
  }

  if (learningState.dueForRecall) {
    return "complete";
  }

  return "neutral";
}

function formatRelativeUpdatedLabel(timestamp: string) {
  const updatedAt = new Date(timestamp).getTime();

  if (Number.isNaN(updatedAt)) {
    return "";
  }

  const elapsedMs = Date.now() - updatedAt;
  const dayMs = 24 * 60 * 60 * 1000;

  if (elapsedMs < 60 * 1000) {
    return "Just now";
  }

  if (elapsedMs < dayMs) {
    return "Today";
  }

  const days = Math.max(1, Math.round(elapsedMs / dayMs));

  if (days === 1) {
    return "1 day ago";
  }

  if (days <= 6) {
    return `${days} days ago`;
  }

  return selectedStudyNoteDateFormatter.format(new Date(timestamp));
}

function getPracticeRepairEntryKey(reference: PracticeRepairQuestionReference) {
  return [
    reference.sessionResultId,
    reference.questionResultId ?? reference.questionIndex.toString(),
  ].join(":");
}

function getPracticeRepairMutationKey(
  action: PracticeRepairMutationAction,
  reference: PracticeRepairQuestionReference,
) {
  return `${action}:${getPracticeRepairEntryKey(reference)}`;
}

function getPracticeRepairOriginPrompt(question: RecallQuestion) {
  const prompt = (
    question.noteSnapshot.prompt ?? question.noteSnapshot.title
  ).trim();

  if (prompt.length > 0) {
    return prompt;
  }

  return question.noteSnapshot.body;
}

function getPracticeRepairOriginSourceTitle(question: RecallQuestion) {
  const displayName = question.noteSnapshot.source?.displayName?.trim();

  if (displayName !== undefined && displayName.length > 0) {
    return displayName;
  }

  const sourceTitle = question.noteSnapshot.source?.title.trim() ?? "";

  if (sourceTitle.length > 0) {
    return sourceTitle;
  }

  const prompt = question.noteSnapshot.prompt?.trim() ?? "";

  if (prompt.length > 0) {
    return prompt;
  }

  const noteTitle = question.noteSnapshot.title.trim();

  if (noteTitle.length > 0) {
    return noteTitle;
  }

  return "Untitled source";
}

function getPracticeRepairOriginSnapshot(input: {
  entry: PracticeRepairEntry;
  sessionResults: readonly SessionResult[];
}): PracticeRepairOriginSnapshot | null {
  const result = input.sessionResults.find(
    (candidate) => candidate.id === input.entry.reference.sessionResultId,
  );

  if (result === undefined) {
    return null;
  }

  const question = resolveSessionResultQuestion({
    reference: input.entry.reference,
    result,
  });

  if (question === null) {
    return null;
  }

  return {
    prompt: getPracticeRepairOriginPrompt(question),
    ratingLabel: formatRecallSelfRatingResultLabel(question.selfRating),
    sourceTitle: getPracticeRepairOriginSourceTitle(question),
  };
}

function getActivePracticeRepairEntryViews({
  recallContext,
  sessionResults,
  studyNoteId,
  userId,
}: ActivePracticeRepairEntryViewInput): PracticeRepairEntryView[] {
  if (studyNoteId === null || userId === null || sessionResults.length === 0) {
    return [];
  }

  return recallContext
    .listActivePracticeRepairEntriesForStudyNote({
      studyNoteId,
      userId,
    })
    .map((entry) => ({
      entry,
      origin: getPracticeRepairOriginSnapshot({
        entry,
        sessionResults,
      }),
    }));
}

function getActionablePracticeFollowUpEntryViews({
  sessionResults,
  studyNoteId,
}: PracticeRepairEntryViewInput): PracticeRepairEntryView[] {
  if (studyNoteId === null || sessionResults.length === 0) {
    return [];
  }

  return listActionablePracticeFollowUpsForStudyNote({
    results: sessionResults,
    studyNoteId,
  }).map((entry) => ({
    entry,
    origin: getPracticeRepairOriginSnapshot({
      entry,
      sessionResults,
    }),
  }));
}

function getStudyNoteLabelNames(
  labels: readonly AppLabel[],
  labelIds: readonly string[],
) {
  const attachedLabels = getAttachedLabels(labels, labelIds);

  if (attachedLabels.length === 0) {
    return ["General"];
  }

  return attachedLabels.map((label) => label.name);
}

function getSupportDescriptionValue(
  supportDescriptions: readonly { description: string }[],
) {
  return supportDescriptions[0]?.description ?? "";
}

function getSupportDescriptionValueByKind(input: {
  memoryAidKind: PracticeRepairMemoryAidKind;
  studyNote: AppStudyNote;
}) {
  return input.memoryAidKind === "Metaphor"
    ? getSupportDescriptionValue(input.studyNote.metaphors)
    : getSupportDescriptionValue(input.studyNote.acronyms);
}

function getPracticeRepairMemoryAidReference(input: {
  memoryAidKind: PracticeRepairMemoryAidKind;
  studyNoteId: string;
}) {
  return `${input.studyNoteId}:${input.memoryAidKind.toLowerCase()}`;
}

function findSplitStudyNotePracticeRepairEntry(
  entries: readonly PracticeRepairEntryView[],
): SplitStudyNotePracticeRepairEntry | null {
  for (const { entry } of entries) {
    if (isPracticeRepairEntryForIntent(entry, "split-study-note")) {
      return entry;
    }
  }

  return null;
}

function formatSplitTargetCreatedStatus(
  entry: SplitStudyNotePracticeRepairEntry,
) {
  return entry.intentMetadata.narrowedOriginalStudyNoteAt === null
    ? "Split target created. Narrow the original Study Note and save changes to complete Practice Repair."
    : "Practice Repair completed";
}

function formatOriginalNarrowedStatus(
  entry: SplitStudyNotePracticeRepairEntry,
) {
  return entry.intentMetadata.createdStudyNoteIds.length === 0
    ? "Original narrowed. Create a split target to complete Practice Repair."
    : "Practice Repair completed";
}

function getLinkedPracticeRepairSummary(action: PracticeRepairIntent) {
  switch (action) {
    case "tighten-expected-answer":
      return "Edit the expected answer here, then return to Practice Repair when the Study Note feels clearer.";
    case "split-study-note":
      return "Narrow the original Study Note and add focused siblings here when the source is doing too much at once.";
    case "create-sibling-study-note":
      return "Create another Study Note from the same source explanation when this repair belongs in a separate recall target.";
    case "add-memory-aid":
      return "Add a Metaphor or Acronym here only when it makes the answer easier to retrieve. Opening this route does not complete Practice Repair.";
  }
}

function formatSelectedNextRecall(input: {
  now: string;
  schedule: RecallSchedule | null;
  userTimeZone: string;
}) {
  const timing = formatNextRecallTiming({
    now: input.now,
    schedule: input.schedule,
    userTimeZone: input.userTimeZone,
  });

  if (timing === null) {
    return "On schedule";
  }

  if (timing === "Recall today") {
    return "Today";
  }

  if (timing === "Next recall tomorrow") {
    return "Tomorrow";
  }

  return timing.replace(/^Next recall /, "");
}

function hasDraftReferenceContent(draft: UpdateStudyNoteInput) {
  return (
    draft.sourceTitle.trim().length > 0 || draft.sourceBody.trim().length > 0
  );
}

function hasDraftMemoryAidContent(draft: UpdateStudyNoteInput) {
  return [...draft.metaphors, ...draft.acronyms].some(
    (supportDescription) => supportDescription.description.trim().length > 0,
  );
}

function getStudyNoteLearningLabels(
  learningState: StudyNoteLearningState,
): StudyNoteLearningLabels {
  return {
    compact: formatStudyNoteLearningStateCompactLabel(learningState),
    due: formatStudyNoteDueLabel(learningState),
    practice: formatStudyNotePracticeSignalLabel(learningState),
  };
}

function getAttachedLabels(
  labels: readonly AppLabel[],
  labelIds: readonly string[],
) {
  const attachedLabelIds = new Set(labelIds);

  return labels.filter((label) => attachedLabelIds.has(label.id));
}

function filterStudyNotesBySelectedLabel(
  studyNotes: readonly AppStudyNote[],
  selectedLabelId: string,
) {
  if (selectedLabelId === "") {
    return studyNotes;
  }

  return studyNotes.filter((studyNote) =>
    studyNote.labelIds.includes(selectedLabelId),
  );
}

function PracticeRepairOriginDetails({
  origin,
}: Readonly<{
  origin: PracticeRepairOriginSnapshot | null;
}>) {
  return (
    <div className="study-notes-practice-repair-entry__origin">
      <span className="study-notes-editor__group-label">Results origin</span>
      {origin === null ? (
        <p className="study-notes-practice-repair-entry__origin-fallback">
          Results snapshot unavailable.
        </p>
      ) : (
        <dl className="study-notes-practice-repair-entry__origin-list">
          <div>
            <dt>Weak recall</dt>
            <dd>{origin.ratingLabel}</dd>
          </div>
          <div>
            <dt>Prompt snapshot</dt>
            <dd>{origin.prompt}</dd>
          </div>
          <div>
            <dt>Source snapshot</dt>
            <dd>{origin.sourceTitle}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function getPracticeFollowUpCompletedAt(entry: PracticeRepairEntry) {
  return entry.lifecycle?.completedAt ?? entry.confirmedAt;
}

function PracticeFollowUpSection({
  entries,
  onCreateSiblingStudyNote,
}: Readonly<{
  entries: readonly PracticeRepairEntryView[];
  onCreateSiblingStudyNote: () => void;
}>) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Practice Follow-up"
      className="study-notes-practice-repair"
    >
      <div className="study-notes-practice-repair__header">
        <div className="study-notes-practice-repair__title-row">
          <h2 className="study-notes-practice-repair__title">
            Practice Follow-up
          </h2>
          <span className="study-notes-practice-repair__signal">
            Recall Today
          </span>
        </div>
        <p className="muted study-notes-editor__guidance">
          This repair is complete. Retry the Study Note from Recall Today while
          the correction is still fresh.
        </p>
      </div>
      <div className="study-notes-practice-repair__entries">
        {entries.map(({ entry, origin }) => {
          const intentLabel = formatPracticeRepairIntentLabel(entry.intent);

          return (
            <article
              aria-label={`${intentLabel} Practice Follow-up`}
              className="study-notes-practice-repair-entry"
              key={getPracticeRepairEntryKey(entry.reference)}
            >
              <div className="study-notes-practice-repair-entry__header">
                <div className="study-notes-practice-repair-entry__title-group">
                  <h3 className="study-notes-practice-repair-entry__title">
                    {intentLabel}
                  </h3>
                  <p className="study-notes-practice-repair-entry__meta">
                    Repair completed{" "}
                    {formatRelativeUpdatedLabel(
                      getPracticeFollowUpCompletedAt(entry),
                    )}
                  </p>
                </div>
              </div>
              <PracticeRepairOriginDetails origin={origin} />
              <div className="study-notes-practice-repair-entry__next-practice">
                <span className="study-notes-editor__group-label">
                  Correction
                </span>
                <p>{entry.correction}</p>
              </div>
              {entry.nextPracticeIdea === undefined ? null : (
                <div className="study-notes-practice-repair-entry__next-practice">
                  <span className="study-notes-editor__group-label">
                    Next-practice idea
                  </span>
                  <p>{entry.nextPracticeIdea}</p>
                </div>
              )}
              <div className="study-notes-practice-repair__actions">
                {entry.intent === "split-study-note" ? (
                  <Button
                    onClick={onCreateSiblingStudyNote}
                    size="compact"
                    type="button"
                    variant="secondary"
                  >
                    <CopyIcon />
                    <span>Create sibling Study Note</span>
                  </Button>
                ) : null}
                <ButtonLink size="compact" to="/recall" variant="secondary">
                  <CalendarCheckIcon />
                  <span>Open Recall Today</span>
                </ButtonLink>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function StudyNotesWorkspace() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const studyNotesContext = useRouteContext({
    from: "/_protected/study-notes",
    select: (context) => context.studyNotes,
  });
  const persistentStudyNotesContext = useRouteContext({
    from: "/_protected/study-notes",
    select: (context) => context.persistentStudyNotes,
  });
  const labelsContext = useRouteContext({
    from: "/_protected/study-notes",
    select: (context) => context.labels,
  });
  const recallContext = useRouteContext({
    from: "/_protected/study-notes",
    select: (context) => context.recall,
  });
  const persistentRecallContext = useRouteContext({
    from: "/_protected/study-notes",
    select: (context) => context.persistentRecall,
  });
  const focusContext = useRouteContext({
    from: "/_protected/study-notes",
    select: (context) => context.focus,
  });
  const persistentFocusContext = useRouteContext({
    from: "/_protected/study-notes",
    select: (context) => context.persistentFocus,
  });
  const { sessionSnapshot } = useResolvedProtectedSession(
    "/_protected/study-notes",
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const now = new Date().toISOString();
  const userTimeZone =
    sessionSnapshot.user?.userTimeZone ?? defaultUserTimeZone;
  const studyNotesStore:
    | Pick<AppStudyNotesContext, "getSnapshot" | "subscribe">
    | Pick<AppPersistentStudyNotesContext, "getSnapshot" | "subscribe"> =
    persistentStudyNotesContext ?? studyNotesContext;
  const studyNotesSnapshot = useSyncExternalStore(
    studyNotesStore.subscribe,
    studyNotesStore.getSnapshot,
    studyNotesStore.getSnapshot,
  );
  const recallResultsSnapshot = useSyncExternalStore(
    recallContext.subscribe,
    recallContext.getSessionResultsSnapshot,
    recallContext.getSessionResultsSnapshot,
  );
  const recallSchedulesSnapshot = useSyncExternalStore(
    recallContext.subscribe,
    recallContext.getRecallSchedulesSnapshot,
    recallContext.getRecallSchedulesSnapshot,
  );
  const linkedPracticeRepair = useMemo(
    () =>
      findLinkedPracticeRepairContext({
        practiceRepairAction: search.practiceRepairAction,
        practiceRepairEntryId: search.practiceRepairEntryId,
        sessionResults: recallResultsSnapshot,
      }),
    [
      recallResultsSnapshot,
      search.practiceRepairAction,
      search.practiceRepairEntryId,
    ],
  );
  useSyncExternalStore(
    focusContext.subscribe,
    focusContext.getSnapshot,
    focusContext.getSnapshot,
  );
  const [availableLabels, setAvailableLabels] = useState<AppLabel[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLabelId, setSelectedLabelId] = useState("");
  const allStudyNotes = useMemo(
    () => listStudyNotesForUser(studyNotesSnapshot, userId),
    [studyNotesSnapshot, userId],
  );
  const labelFilteredStudyNotes = useMemo(
    () => filterStudyNotesBySelectedLabel(allStudyNotes, selectedLabelId),
    [allStudyNotes, selectedLabelId],
  );
  const studyNotes = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

    if (normalizedQuery.length === 0) {
      return labelFilteredStudyNotes;
    }

    return labelFilteredStudyNotes.filter((studyNote) => {
      const labelNames = getStudyNoteLabelNames(
        availableLabels,
        studyNote.labelIds,
      ).join(" ");
      const searchableText = [
        studyNote.prompt,
        studyNote.expectedAnswer,
        studyNote.source.title,
        studyNote.source.body,
        labelNames,
      ]
        .join(" ")
        .toLocaleLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [availableLabels, labelFilteredStudyNotes, searchQuery]);
  const recallAttemptsByNote = useMemo(
    () =>
      userId === null || recallResultsSnapshot.length === 0
        ? []
        : recallContext.listAttemptsByNote({ userId }),
    [recallContext, recallResultsSnapshot, userId],
  );
  const recallHistories = useMemo(
    () => toStudyNoteRecallHistories(recallAttemptsByNote),
    [recallAttemptsByNote],
  );
  const recallGuidanceEntries = useMemo(
    () =>
      deriveRecallGuidance({
        attemptsByNote: recallAttemptsByNote,
        now,
        recallSchedules: recallSchedulesSnapshot,
        sessionResults: recallResultsSnapshot,
        studyNotes: allStudyNotes,
        userTimeZone,
      }),
    [
      allStudyNotes,
      now,
      recallAttemptsByNote,
      recallResultsSnapshot,
      recallSchedulesSnapshot,
      userTimeZone,
    ],
  );
  const learningStates = useMemo(
    () =>
      deriveStudyNoteLearningStates({
        histories: recallHistories,
        now,
        recallSchedules: recallSchedulesSnapshot,
        studyNotes,
      }),
    [now, recallHistories, recallSchedulesSnapshot, studyNotes],
  );
  const recallScheduleByStudyNoteId = useMemo(
    () =>
      new Map(
        recallSchedulesSnapshot.map((recallSchedule) => [
          recallSchedule.studyNoteId,
          recallSchedule,
        ]),
      ),
    [recallSchedulesSnapshot],
  );
  const learningStateByStudyNoteId = useMemo(
    () =>
      new Map(
        learningStates.map((learningState) => [
          learningState.studyNoteId,
          learningState,
        ]),
      ),
    [learningStates],
  );
  const recallGuidanceByStudyNoteId = useMemo(
    () =>
      new Map(
        recallGuidanceEntries.map((entry) => [entry.studyNote.id, entry]),
      ),
    [recallGuidanceEntries],
  );
  const [selectedStudyNoteId, setSelectedStudyNoteId] = useState<string | null>(
    studyNotes[0]?.id ?? null,
  );
  const [appliedLinkedPracticeRepairKey, setAppliedLinkedPracticeRepairKey] =
    useState<string | null>(null);
  const [isCreatingStudyNote, setCreatingStudyNote] = useState(false);
  const selectedStudyNote = isCreatingStudyNote
    ? null
    : (studyNotes.find((studyNote) => studyNote.id === selectedStudyNoteId) ??
      studyNotes[0] ??
      null);
  const selectedDisclosureKey =
    selectedStudyNote?.id ?? (isCreatingStudyNote ? "new" : "empty");
  const selectedSourceStudyNotes =
    selectedStudyNote === null
      ? []
      : allStudyNotes.filter(
          (studyNote) =>
            studyNote.sourceNoteId === selectedStudyNote.sourceNoteId,
        );
  const selectedLearningState =
    selectedStudyNote === null
      ? null
      : (learningStateByStudyNoteId.get(selectedStudyNote.id) ?? null);
  const selectedRecallSchedule =
    selectedStudyNote === null
      ? null
      : (recallScheduleByStudyNoteId.get(selectedStudyNote.id) ?? null);
  const selectedRecallGuidance =
    selectedStudyNote === null
      ? null
      : (recallGuidanceByStudyNoteId.get(selectedStudyNote.id) ?? null);
  const selectedPracticeRepairStudyNoteId = selectedStudyNote?.id ?? null;
  const activePracticeRepairEntries = useMemo<PracticeRepairEntryView[]>(
    () =>
      getActivePracticeRepairEntryViews({
        recallContext,
        sessionResults: recallResultsSnapshot,
        studyNoteId: selectedPracticeRepairStudyNoteId,
        userId,
      }),
    [
      recallContext,
      recallResultsSnapshot,
      selectedPracticeRepairStudyNoteId,
      userId,
    ],
  );
  const actionablePracticeFollowUps = useMemo<PracticeRepairEntryView[]>(
    () =>
      getActionablePracticeFollowUpEntryViews({
        sessionResults: recallResultsSnapshot,
        studyNoteId: selectedPracticeRepairStudyNoteId,
      }),
    [recallResultsSnapshot, selectedPracticeRepairStudyNoteId],
  );
  const practiceRepair = useMemo(
    () =>
      actionablePracticeFollowUps.length > 0
        ? null
        : getStudyNotePracticeRepair(selectedLearningState),
    [actionablePracticeFollowUps.length, selectedLearningState],
  );
  const interleavedRecallRecommendation = useMemo(
    () =>
      getInterleavedRecallRecommendation({
        histories: recallHistories,
        studyNote: selectedStudyNote,
        studyNotes: allStudyNotes,
      }),
    [allStudyNotes, recallHistories, selectedStudyNote],
  );
  const [draft, setDraft] = useState<UpdateStudyNoteInput>(() =>
    createDraftFromStudyNote(selectedStudyNote),
  );
  const selectedLabels = getAttachedLabels(availableLabels, draft.labelIds);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [practiceRepairMutationKey, setPracticeRepairMutationKey] = useState<
    string | null
  >(null);
  const [practiceRepairCorrectionDrafts, setPracticeRepairCorrectionDrafts] =
    useState<Record<string, string>>({});
  const [
    pendingPracticeRepairMemoryAidAction,
    setPendingPracticeRepairMemoryAidAction,
  ] = useState<PendingPracticeRepairMemoryAidAction>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const [pendingEditorTarget, setPendingEditorTarget] =
    useState<StudyNoteEditorTarget | null>(null);
  const [isNewDiscardDialogOpen, setNewDiscardDialogOpen] = useState(false);
  const [isReferenceOpenOverride, setReferenceOpenOverride] = useState<
    boolean | null
  >(null);
  const [isMemoryAidsOpenOverride, setMemoryAidsOpenOverride] = useState<
    boolean | null
  >(null);
  const [isLabelManagerOpen, setLabelManagerOpen] = useState(false);
  const storeMutation = persistentStudyNotesContext ?? studyNotesContext;
  const hasDraftChanges = !areStudyNoteDraftsEqual(
    draft,
    createDraftFromStudyNote(selectedStudyNote),
  );
  const isSaveBarVisible =
    hasDraftChanges || isSaving || pendingEditorTarget !== null;

  useEffect(() => {
    if (persistentStudyNotesContext === undefined) {
      return;
    }

    void persistentStudyNotesContext.refresh(userId).catch((error: unknown) => {
      if (error instanceof AppStudyNotesError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    });
  }, [persistentStudyNotesContext, userId]);

  useEffect(() => {
    function syncLabels() {
      if (userId === null) {
        setAvailableLabels([]);
        return;
      }

      setAvailableLabels(labelsContext.getLabelsForUser(userId));
    }

    syncLabels();

    return labelsContext.subscribe(syncLabels);
  }, [labelsContext, userId]);

  useEffect(() => {
    if (
      selectedLabelId === "" ||
      availableLabels.some((label) => label.id === selectedLabelId)
    ) {
      return;
    }

    setSelectedLabelId("");
  }, [availableLabels, selectedLabelId]);

  useEffect(() => {
    if (isCreatingStudyNote) {
      return;
    }

    if (
      selectedStudyNoteId !== null &&
      studyNotes.some((studyNote) => studyNote.id === selectedStudyNoteId)
    ) {
      return;
    }

    setSelectedStudyNoteId(studyNotes[0]?.id ?? null);
  }, [isCreatingStudyNote, selectedStudyNoteId, studyNotes]);

  useEffect(() => {
    if (linkedPracticeRepair === null) {
      return;
    }

    const nextLinkedPracticeRepairKey =
      getLinkedPracticeRepairKey(linkedPracticeRepair);

    if (appliedLinkedPracticeRepairKey === nextLinkedPracticeRepairKey) {
      return;
    }

    setCreatingStudyNote(false);
    setSelectedStudyNoteId(linkedPracticeRepair.entry.reference.studyNoteId);
    setAppliedLinkedPracticeRepairKey(nextLinkedPracticeRepairKey);
  }, [appliedLinkedPracticeRepairKey, linkedPracticeRepair]);

  useEffect(() => {
    const nextDraft = createDraftFromStudyNote(selectedStudyNote);

    setDraft(nextDraft);
    setPendingEditorTarget(null);
    setPendingPracticeRepairMemoryAidAction(null);
  }, [selectedStudyNote]);

  useEffect(() => {
    if (selectedDisclosureKey.length === 0) {
      return;
    }

    setReferenceOpenOverride(null);
    setMemoryAidsOpenOverride(null);
    setLabelManagerOpen(false);
  }, [selectedDisclosureKey]);

  useEffect(() => {
    if (
      linkedPracticeRepair?.action !== "add-memory-aid" ||
      selectedStudyNote?.id !== linkedPracticeRepair.entry.reference.studyNoteId
    ) {
      return;
    }

    setMemoryAidsOpenOverride(true);
  }, [linkedPracticeRepair, selectedStudyNote?.id]);

  useEffect(() => {
    if (saveStatus === null || hasDraftChanges || isSaving) {
      return;
    }

    const timeoutId = window.setTimeout(() => setSaveStatus(null), 1800);

    return () => window.clearTimeout(timeoutId);
  }, [hasDraftChanges, isSaving, saveStatus]);

  function updateDraft(
    updater: (current: UpdateStudyNoteInput) => UpdateStudyNoteInput,
  ) {
    setDraft(updater);
    setErrorMessage(null);
    setSaveStatus(null);
    setNewDiscardDialogOpen(false);
  }

  function applyEditorTarget(target: StudyNoteEditorTarget) {
    setErrorMessage(null);
    setSaveStatus(null);
    setPendingEditorTarget(null);
    setNewDiscardDialogOpen(false);

    if (target.type === "new") {
      setDraft(createBlankDraft());
      setCreatingStudyNote(true);
      return;
    }

    setCreatingStudyNote(false);
    setSelectedStudyNoteId(target.studyNoteId);
  }

  function requestEditorTarget(target: StudyNoteEditorTarget) {
    if (
      target.type === "study-note" &&
      !isCreatingStudyNote &&
      target.studyNoteId === selectedStudyNote?.id
    ) {
      return;
    }

    if (hasDraftChanges) {
      setErrorMessage(null);
      setSaveStatus(null);
      setNewDiscardDialogOpen(false);
      setPendingEditorTarget(target);
      return;
    }

    applyEditorTarget(target);
  }

  function handleNewStudyNote() {
    requestEditorTarget({ type: "new" });
  }

  function discardDraft() {
    setErrorMessage(null);
    setSaveStatus(null);

    if (pendingEditorTarget !== null) {
      applyEditorTarget(pendingEditorTarget);
      return;
    }

    if (selectedStudyNote === null && hasDraftChanges) {
      setNewDiscardDialogOpen(true);
      return;
    }

    setPendingEditorTarget(null);

    if (selectedStudyNote === null) {
      abandonNewDraft();
      return;
    }

    const selectedDraft = createDraftFromStudyNote(selectedStudyNote);

    setDraft(selectedDraft);
  }

  function abandonNewDraft() {
    setErrorMessage(null);
    setSaveStatus(null);
    setPendingEditorTarget(null);
    setNewDiscardDialogOpen(false);

    if (selectedStudyNote === null) {
      setCreatingStudyNote(false);
      setDraft(createDraftFromStudyNote(selectedStudyNote));
      return;
    }
  }

  function stayOnCurrentDraft() {
    setErrorMessage(null);
    setPendingEditorTarget(null);
    setNewDiscardDialogOpen(false);
  }

  async function handleDeleteStudyNote() {
    if (selectedStudyNote === null) {
      return;
    }

    const hasSiblingStudyNotes = selectedSourceStudyNotes.length > 1;

    if (
      !hasSiblingStudyNotes &&
      !window.confirm(
        "Delete this last Study Note and its reference explanation?",
      )
    ) {
      return;
    }

    setErrorMessage(null);
    setSaveStatus(null);

    try {
      await storeMutation.deleteStudyNote(userId, selectedStudyNote.id, {
        deleteSource: !hasSiblingStudyNotes,
      });
      setCreatingStudyNote(false);
      setSelectedStudyNoteId(
        studyNotes.find((studyNote) => studyNote.id !== selectedStudyNote.id)
          ?.id ?? null,
      );
    } catch (error) {
      handleError(error);
    }
  }

  async function completeLinkedPracticeRepairEntry(
    input: PracticeRepairLinkedCompletionInput,
    successMessage = "Practice Repair completed",
  ) {
    await mutatePracticeRepairEntry({
      action: "linked-action",
      mutation: (validatedUserId) => {
        if (persistentRecallContext === undefined) {
          recallContext.completeLinkedPracticeRepairEntry({
            ...input,
            userId: validatedUserId,
          });
          return;
        }

        return persistentRecallContext.completeLinkedPracticeRepairEntry(
          validatedUserId,
          input,
        );
      },
      reference: input.reference,
      successMessage,
    });
  }

  async function handleCreateSiblingStudyNote(input?: {
    practiceRepairReference?: PracticeRepairQuestionReference;
  }) {
    if (selectedStudyNote === null) {
      return;
    }

    setErrorMessage(null);
    setSaveStatus(null);

    try {
      const createdStudyNote = await storeMutation.createStudyNoteFromSource(
        userId,
        {
          sourceNoteId: selectedStudyNote.sourceNoteId,
        },
      );

      if (input?.practiceRepairReference !== undefined) {
        await completeLinkedPracticeRepairEntry({
          intent: "create-sibling-study-note",
          intentMetadata: {
            createdStudyNoteId: createdStudyNote.id,
          },
          reference: input.practiceRepairReference,
        });
      }

      setCreatingStudyNote(false);
      setSelectedStudyNoteId(createdStudyNote.id);
    } catch (error) {
      if (error instanceof AppRecallError) {
        setErrorMessage(error.message);
        return;
      }

      handleError(error);
    }
  }

  async function handleSplitStudyNote(
    entry: SplitStudyNotePracticeRepairEntry,
  ) {
    if (selectedStudyNote === null) {
      return;
    }

    setErrorMessage(null);
    setSaveStatus(null);

    try {
      const createdStudyNote = await storeMutation.createStudyNoteFromSource(
        userId,
        {
          sourceNoteId: selectedStudyNote.sourceNoteId,
        },
      );

      await completeLinkedPracticeRepairEntry(
        {
          intent: "split-study-note",
          intentMetadata: {
            createdStudyNoteIds: [createdStudyNote.id],
            narrowedOriginalStudyNoteAt: null,
          },
          reference: entry.reference,
        },
        formatSplitTargetCreatedStatus(entry),
      );
    } catch (error) {
      if (error instanceof AppRecallError) {
        setErrorMessage(error.message);
        return;
      }

      handleError(error);
    }
  }

  function handleStartMemoryAidPracticeRepair(input: {
    memoryAidKind: PracticeRepairMemoryAidKind;
    reference: PracticeRepairQuestionReference;
  }) {
    setErrorMessage(null);
    setSaveStatus(null);
    setMemoryAidsOpenOverride(true);
    setPendingPracticeRepairMemoryAidAction({
      memoryAidKind: input.memoryAidKind,
      reference: input.reference,
    });
  }

  async function mutatePracticeRepairEntry(input: {
    action: PracticeRepairMutationAction;
    mutation: (validatedUserId: string) => Promise<unknown> | undefined;
    onSuccess?: () => void;
    reference: PracticeRepairQuestionReference;
    successMessage: string;
  }) {
    if (userId === null) {
      return;
    }

    setErrorMessage(null);
    setSaveStatus(null);
    setPracticeRepairMutationKey(
      getPracticeRepairMutationKey(input.action, input.reference),
    );

    try {
      const mutationResult = input.mutation(userId);

      if (mutationResult !== undefined) {
        await mutationResult;
      }

      input.onSuccess?.();
      setSaveStatus(input.successMessage);
    } catch (error) {
      if (error instanceof AppRecallError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    } finally {
      setPracticeRepairMutationKey(null);
    }
  }

  async function updatePracticeRepairEntryCorrection(input: {
    correction: string;
    reference: PracticeRepairQuestionReference;
  }) {
    const correction = input.correction.trim();
    const entryKey = getPracticeRepairEntryKey(input.reference);

    await mutatePracticeRepairEntry({
      action: "edit",
      mutation: (validatedUserId) => {
        if (persistentRecallContext === undefined) {
          recallContext.updatePracticeRepairEntryCorrection({
            correction,
            reference: input.reference,
            userId: validatedUserId,
          });
          return;
        }

        return persistentRecallContext.updatePracticeRepairEntryCorrection(
          validatedUserId,
          {
            correction,
            reference: input.reference,
          },
        );
      },
      onSuccess: () =>
        setPracticeRepairCorrectionDrafts((current) => ({
          ...current,
          [entryKey]: correction,
        })),
      reference: input.reference,
      successMessage: "Practice Repair updated",
    });
  }

  async function completePracticeRepairEntry(
    reference: PracticeRepairQuestionReference,
  ) {
    await mutatePracticeRepairEntry({
      action: "complete",
      mutation: (validatedUserId) => {
        if (persistentRecallContext === undefined) {
          recallContext.completePracticeRepairEntry({
            reference,
            userId: validatedUserId,
          });
          return;
        }

        return persistentRecallContext.completePracticeRepairEntry(
          validatedUserId,
          {
            reference,
          },
        );
      },
      reference,
      successMessage: "Practice Repair completed",
    });
  }

  async function dismissPracticeRepairEntry(
    reference: PracticeRepairQuestionReference,
  ) {
    await mutatePracticeRepairEntry({
      action: "dismiss",
      mutation: (validatedUserId) => {
        if (persistentRecallContext === undefined) {
          recallContext.dismissPracticeRepairEntry({
            reference,
            userId: validatedUserId,
          });
          return;
        }

        return persistentRecallContext.dismissPracticeRepairEntry(
          validatedUserId,
          {
            reference,
          },
        );
      },
      reference,
      successMessage: "Practice Repair dismissed",
    });
  }

  function isPracticeRepairMutationPending(
    reference: PracticeRepairQuestionReference,
  ) {
    return practiceRepairMutationActions.some(
      (action) =>
        practiceRepairMutationKey ===
        getPracticeRepairMutationKey(action, reference),
    );
  }

  async function handleStartRecallSession() {
    if (userId === null) {
      return;
    }

    const recallableStudyNoteIds = studyNotes
      .filter((studyNote) => {
        const learningState = learningStateByStudyNoteId.get(studyNote.id);

        return (
          getStudyNoteReadiness(studyNote).dueForRecallEligible &&
          learningState?.dueForRecall === true
        );
      })
      .map((studyNote) => studyNote.id);

    if (recallableStudyNoteIds.length === 0) {
      await navigate({ to: "/recall" });
      return;
    }

    setErrorMessage(null);
    setSaveStatus(null);

    try {
      await startFlashCardRecallForStudyNotes({
        studyNoteIds: recallableStudyNoteIds,
        userId,
      });
      await navigate({ to: "/recall/session" });
    } catch (error) {
      if (error instanceof AppRecallError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  async function handleStartInterleavedRecall() {
    if (userId === null || interleavedRecallRecommendation === null) {
      return;
    }

    setErrorMessage(null);
    setSaveStatus(null);

    try {
      await startFlashCardRecallForStudyNotes({
        studyNoteIds: interleavedRecallRecommendation.studyNoteIds,
        userId,
      });
      await navigate({ to: "/recall/session" });
    } catch (error) {
      if (error instanceof AppRecallError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  async function startFlashCardRecallForStudyNotes(input: {
    studyNoteIds: readonly string[];
    userId: string;
  }) {
    const studyNoteIds = [...input.studyNoteIds];

    if (persistentRecallContext === undefined) {
      recallContext.startFlashCardSession({
        mode: "FlashCard",
        studyNoteIds,
        userId: input.userId,
      });
      return;
    }

    await persistentRecallContext.startFlashCardSession(input.userId, {
      mode: "FlashCard",
      studyNoteIds,
    });
  }

  async function maybeCompletePendingPracticeRepairMemoryAidAction(
    savedStudyNote: AppStudyNote,
  ) {
    if (
      pendingPracticeRepairMemoryAidAction === null ||
      savedStudyNote.id !==
        pendingPracticeRepairMemoryAidAction.reference.studyNoteId
    ) {
      return false;
    }

    const description = getSupportDescriptionValueByKind({
      memoryAidKind: pendingPracticeRepairMemoryAidAction.memoryAidKind,
      studyNote: savedStudyNote,
    }).trim();

    if (description.length === 0) {
      setSaveStatus(
        `Saved. Add a ${pendingPracticeRepairMemoryAidAction.memoryAidKind} to complete Practice Repair.`,
      );
      return true;
    }

    await completeLinkedPracticeRepairEntry({
      intent: "add-memory-aid",
      intentMetadata: {
        memoryAidId: getPracticeRepairMemoryAidReference({
          memoryAidKind: pendingPracticeRepairMemoryAidAction.memoryAidKind,
          studyNoteId: savedStudyNote.id,
        }),
        memoryAidKind: pendingPracticeRepairMemoryAidAction.memoryAidKind,
      },
      reference: pendingPracticeRepairMemoryAidAction.reference,
    });
    setPendingPracticeRepairMemoryAidAction(null);
    return true;
  }

  async function maybeRecordSplitStudyNoteNarrowing(input: {
    entry: SplitStudyNotePracticeRepairEntry | null;
    savedStudyNote: AppStudyNote;
    shouldRecordNarrowing: boolean;
  }) {
    if (
      input.entry === null ||
      !input.shouldRecordNarrowing ||
      input.savedStudyNote.id !== input.entry.reference.studyNoteId
    ) {
      return false;
    }

    await completeLinkedPracticeRepairEntry(
      {
        intent: "split-study-note",
        intentMetadata: {
          createdStudyNoteIds: [],
          narrowedOriginalStudyNoteAt: input.savedStudyNote.updatedAt,
        },
        reference: input.entry.reference,
      },
      formatOriginalNarrowedStatus(input.entry),
    );

    return true;
  }

  async function saveDraft(): Promise<AppStudyNote | null> {
    if (!hasDraftChanges) {
      return selectedStudyNote;
    }

    setErrorMessage(null);
    setSaveStatus(null);
    setSaving(true);

    try {
      const activeSplitPracticeRepairEntry =
        selectedStudyNote === null
          ? null
          : findSplitStudyNotePracticeRepairEntry(activePracticeRepairEntries);
      const shouldRecordSplitStudyNoteNarrowing =
        selectedStudyNote !== null &&
        activeSplitPracticeRepairEntry !== null &&
        didSplitStudyNoteDraftChange({
          draft,
          studyNote: selectedStudyNote,
        });
      let savedStudyNote: AppStudyNote;

      if (selectedStudyNote === null) {
        const createdStudyNote = await storeMutation.createStudyNote(userId, {
          expectedAnswer: draft.expectedAnswer,
          prompt: draft.prompt,
          sourceBody: draft.sourceBody,
          sourceTitle: draft.sourceTitle,
        });
        const updatedStudyNote = await storeMutation.updateStudyNote(
          userId,
          createdStudyNote.id,
          draft,
        );
        setSelectedStudyNoteId(updatedStudyNote.id);
        setCreatingStudyNote(false);
        savedStudyNote = updatedStudyNote;
      } else {
        savedStudyNote = await storeMutation.updateStudyNote(
          userId,
          selectedStudyNote.id,
          draft,
        );
      }

      await captureFocusStudyNoteActivity(savedStudyNote);

      if (
        !(
          (await maybeRecordSplitStudyNoteNarrowing({
            entry: activeSplitPracticeRepairEntry,
            savedStudyNote,
            shouldRecordNarrowing: shouldRecordSplitStudyNoteNarrowing,
          })) ||
          (await maybeCompletePendingPracticeRepairMemoryAidAction(
            savedStudyNote,
          ))
        )
      ) {
        setSaveStatus("Saved just now");
      }

      return savedStudyNote;
    } catch (error) {
      handleError(error);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await saveDraft();
  }

  async function saveDraftAndApplyPendingTarget() {
    if (pendingEditorTarget === null) {
      await saveDraft();
      return;
    }

    const target = pendingEditorTarget;
    const savedStudyNote = await saveDraft();

    if (savedStudyNote === null) {
      return;
    }

    applyEditorTarget(target);
  }

  async function captureFocusStudyNoteActivity(studyNote: AppStudyNote) {
    if (userId === null) {
      return;
    }

    const input = {
      labels: getAttachedLabels(
        labelsContext.getLabelsForUser(userId),
        studyNote.labelIds,
      ),
      studyNote,
    };

    if (persistentFocusContext !== undefined) {
      await persistentFocusContext.captureStudyNoteStudyActivity(userId, input);
      return;
    }

    focusContext.captureStudyNoteStudyActivity({
      ...input,
      userId,
    });
  }

  function handleError(error: unknown) {
    if (error instanceof AppStudyNotesError) {
      setErrorMessage(error.message);
      return;
    }

    throw error;
  }

  function updateDraftSupportDescription(
    field: "acronyms" | "metaphors",
    description: string,
  ) {
    updateDraft((current) => ({
      ...current,
      [field]: createSingleSupportDescriptionDraft(description),
    }));
  }

  const selectedNextRecall = formatSelectedNextRecall({
    now,
    schedule: selectedRecallSchedule,
    userTimeZone,
  });
  const selectedRecallInsight = deriveStudyNoteRecallInsight({
    draft,
    nextRecall: selectedNextRecall,
    recallGuidance: selectedRecallGuidance,
  });
  const referenceHasContent = hasDraftReferenceContent(draft);
  const referenceDisclosureDefaultOpen = referenceHasContent;
  const isReferenceOpen =
    isReferenceOpenOverride ?? referenceDisclosureDefaultOpen;
  const memoryAidsHasContent = hasDraftMemoryAidContent(draft);
  const isMemoryAidsOpen = isMemoryAidsOpenOverride ?? memoryAidsHasContent;
  const saveBarStatusText = isSaving
    ? "Saving changes..."
    : pendingEditorTarget === null
      ? (saveStatus ?? "You have unsaved changes.")
      : pendingEditorTarget.type === "new"
        ? "Save or discard changes before starting a new Study Note"
        : "Save or discard changes before switching Study Notes";
  const saveBarPrimaryAction =
    pendingEditorTarget === null
      ? "Save changes"
      : pendingEditorTarget.type === "new"
        ? "Save and start new"
        : "Save and switch";
  const saveBarDiscardAction =
    pendingEditorTarget === null
      ? "Discard changes"
      : pendingEditorTarget.type === "new"
        ? "Discard and start new"
        : "Discard and switch";
  const visibleSelectedLabels =
    selectedLabels.length === 0
      ? [{ id: "general", name: "General" }]
      : selectedLabels;

  return (
    <section className="notes-workspace study-notes-workspace">
      <PageHeader
        actions={
          <>
            <Button
              className="study-notes-start-recall"
              onClick={() => void handleStartRecallSession()}
              type="button"
              variant="primary"
            >
              <PlayIcon />
              <span>Start Recall Session</span>
            </Button>
            <Button
              aria-label="New Study Note"
              className="study-notes-new-note"
              onClick={handleNewStudyNote}
              type="button"
              variant="secondary"
            >
              <PlusIcon />
              <span>New Study Note</span>
            </Button>
          </>
        }
        actionsClassName="study-notes-hero__actions"
        className="study-notes-hero"
        description="Your study notes and their recall schedules. Factual recall timing is tracked automatically."
        headingLevel={1}
        title="Study Notes"
      />

      <div
        className="notes-layout study-notes-layout"
        data-save-bar-visible={isSaveBarVisible ? "true" : "false"}
      >
        <aside aria-label="Study Notes catalog" className="notes-list-panel">
          <div className="study-notes-catalog-tools">
            <label className="study-notes-search">
              <span className="sr-only">Search notes</span>
              <SearchIcon />
              <input
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search notes"
                type="search"
                value={searchQuery}
              />
            </label>
            <label className="study-notes-filter">
              <span className="sr-only">Filter by label</span>
              <SlidersIcon />
              <select
                aria-label="Filter Study Notes by label"
                onChange={(event) => setSelectedLabelId(event.target.value)}
                value={selectedLabelId}
              >
                <option value="">All labels</option>
                {availableLabels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="study-notes-catalog-meta">
            <span>{studyNotes.length} notes</span>
            <button className="study-notes-sort" type="button">
              Recently updated
              <ChevronDownIcon />
            </button>
          </div>
          <nav aria-label="Study Notes list" className="notes-list">
            {studyNotes.length === 0 ? (
              <p className="muted notes-list__empty">
                Create a Study Note to start practicing.
              </p>
            ) : (
              <ul className="notes-list__items">
                {studyNotes.map((studyNote) => {
                  const learningState = learningStateByStudyNoteId.get(
                    studyNote.id,
                  );
                  const learningLabels =
                    learningState === undefined
                      ? null
                      : getStudyNoteLearningLabels(learningState);
                  const labelNames = getStudyNoteLabelNames(
                    availableLabels,
                    studyNote.labelIds,
                  );
                  const schedule =
                    recallScheduleByStudyNoteId.get(studyNote.id) ?? null;
                  const timingLabel = formatNextRecallTiming({
                    now,
                    schedule,
                    userTimeZone,
                  });
                  const rowStatus =
                    learningLabels?.practice ??
                    (learningLabels?.due
                      ? timingLabel
                      : learningLabels?.compact) ??
                    "Study Note";
                  const statusKind = getStudyNoteStatusKind(
                    learningState ?? null,
                  );

                  return (
                    <li key={studyNote.id}>
                      <button
                        aria-label={studyNote.prompt}
                        aria-current={
                          studyNote.id === selectedStudyNote?.id
                            ? "page"
                            : undefined
                        }
                        className="study-note-row"
                        data-selected={
                          studyNote.id === selectedStudyNote?.id
                            ? "true"
                            : undefined
                        }
                        data-status-kind={statusKind}
                        onClick={() =>
                          requestEditorTarget({
                            studyNoteId: studyNote.id,
                            type: "study-note",
                          })
                        }
                        type="button"
                      >
                        <span className="study-note-row__icon">
                          <StudyNoteDocumentIcon />
                        </span>
                        <span className="study-note-row__content">
                          <strong>{studyNote.prompt}</strong>
                          <span>{labelNames.slice(0, 2).join(" · ")}</span>
                          {rowStatus === null ? null : (
                            <span className="study-note-row__status">
                              {rowStatus}
                            </span>
                          )}
                        </span>
                        <span className="study-note-row__updated">
                          {formatRelativeUpdatedLabel(studyNote.updatedAt)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
        </aside>

        <form
          aria-label="Study Note editor surface"
          aria-busy={isSaving ? "true" : undefined}
          className="notes-editor study-notes-editor"
          data-save-bar-visible={isSaveBarVisible ? "true" : "false"}
          id={STUDY_NOTE_EDITOR_FORM_ID}
          onSubmit={(event) => void handleSubmit(event)}
        >
          <fieldset className="notes-editor__study-surface">
            <legend className="sr-only">Study Note</legend>
            <div className="study-notes-editor__masthead">
              <div className="study-notes-editor__title">
                <span className="study-notes-editor__title-icon">
                  <StudyNoteDocumentIcon />
                </span>
                <h2>{draft.prompt.trim() || "New Study Note"}</h2>
              </div>
              <div className="study-notes-editor__toolbar">
                <Button
                  aria-label="Edit Study Note"
                  iconOnly
                  size="compact"
                  type="button"
                >
                  <EditIcon />
                </Button>
                <Button
                  aria-label="Add Study Note from this explanation"
                  disabled={selectedStudyNote === null}
                  iconOnly
                  onClick={() => void handleCreateSiblingStudyNote()}
                  size="compact"
                  type="button"
                >
                  <CopyIcon />
                </Button>
                <Button
                  aria-label="Delete Study Note"
                  disabled={selectedStudyNote === null}
                  iconOnly
                  onClick={() => void handleDeleteStudyNote()}
                  size="compact"
                  type="button"
                  variant="danger"
                >
                  <MoreVerticalIcon />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            </div>

            <div className="study-notes-editor__label-row">
              <div className="study-notes-editor__chips">
                {visibleSelectedLabels.map((label) => (
                  <span className="study-notes-chip" key={label.id}>
                    {label.name}
                  </span>
                ))}
              </div>
              <Button
                aria-expanded={isLabelManagerOpen}
                className="study-notes-label-manager-toggle"
                onClick={() => setLabelManagerOpen((value) => !value)}
                size="compact"
                type="button"
                variant="secondary"
              >
                <TagIcon />
                <span>Manage labels</span>
              </Button>
            </div>

            <section
              aria-label="Study Note labels"
              className="study-notes-label-manager"
              data-open={isLabelManagerOpen ? "true" : "false"}
            >
              {availableLabels.length === 0 ? (
                isLabelManagerOpen ? (
                  <p className="muted">No Labels yet.</p>
                ) : null
              ) : (
                <div className="study-notes-labels">
                  {availableLabels.map((label) => (
                    <label key={label.id} className="study-notes-label">
                      <input
                        checked={draft.labelIds.includes(label.id)}
                        onChange={(event) =>
                          updateDraft((current) => ({
                            ...current,
                            labelIds: setLabelIdSelection(
                              current.labelIds,
                              label.id,
                              event.target.checked,
                            ),
                          }))
                        }
                        tabIndex={isLabelManagerOpen ? undefined : -1}
                        type="checkbox"
                      />
                      <span>{label.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </section>

            <div className="study-notes-editor__fields">
              <StudyNotesTextField
                label="Prompt"
                maxLength={500}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    prompt: event.target.value,
                  }))
                }
                placeholder={STUDY_NOTE_GUIDANCE_COPY.promptPlaceholder}
                value={draft.prompt}
              />

              <StudyNotesTextarea
                label="Expected answer"
                maxLength={1000}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    expectedAnswer: event.target.value,
                  }))
                }
                placeholder={STUDY_NOTE_GUIDANCE_COPY.expectedAnswerPlaceholder}
                rows={4}
                value={draft.expectedAnswer}
              />

              <section
                aria-label="Memory aids"
                className="study-notes-editor__memory-aids study-notes-editor__info-section"
              >
                <details
                  className="study-notes-editor__disclosure"
                  key={`memory-aids-${selectedDisclosureKey}`}
                  onToggle={(event) =>
                    setMemoryAidsOpenOverride(event.currentTarget.open)
                  }
                  open={isMemoryAidsOpen}
                >
                  <summary className="study-notes-editor__disclosure-summary">
                    <span>
                      <span className="study-notes-editor__group-label">
                        Memory aids
                      </span>
                      <span className="study-notes-editor__summary-copy">
                        {memoryAidsHasContent
                          ? "Support content available"
                          : "Optional recall support"}
                      </span>
                    </span>
                    <ChevronDownIcon />
                  </summary>
                  <div className="study-notes-editor__disclosure-body">
                    <StudyNotesTextarea
                      label="Metaphor"
                      maxLength={500}
                      onChange={(event) => {
                        updateDraftSupportDescription(
                          "metaphors",
                          event.target.value,
                        );
                      }}
                      optional
                      placeholder={STUDY_NOTE_GUIDANCE_COPY.metaphorPlaceholder}
                      rows={2}
                      value={getSupportDescriptionValue(draft.metaphors)}
                    />
                    <StudyNotesTextField
                      label="Acronym"
                      maxLength={200}
                      onChange={(event) => {
                        updateDraftSupportDescription(
                          "acronyms",
                          event.target.value,
                        );
                      }}
                      optional
                      placeholder={STUDY_NOTE_GUIDANCE_COPY.acronymPlaceholder}
                      value={getSupportDescriptionValue(draft.acronyms)}
                    />
                  </div>
                </details>
              </section>

              {linkedPracticeRepair === null ? null : (
                <section
                  aria-label="Linked Practice Repair"
                  className="study-notes-practice-repair study-notes-practice-repair--linked"
                >
                  <div className="study-notes-practice-repair__header">
                    <div className="study-notes-practice-repair__title-row">
                      <h2 className="study-notes-practice-repair__title">
                        {formatPracticeRepairIntentLabel(
                          linkedPracticeRepair.action,
                        )}
                      </h2>
                      <span className="study-notes-practice-repair__signal">
                        Return target
                      </span>
                    </div>
                    <p className="muted study-notes-editor__guidance">
                      {getLinkedPracticeRepairSummary(
                        linkedPracticeRepair.action,
                      )}
                    </p>
                  </div>
                  <div className="study-notes-practice-repair__actions">
                    <ButtonLink
                      size="compact"
                      to="/recall/repair/$practiceRepairEntryId"
                      params={{
                        practiceRepairEntryId:
                          linkedPracticeRepair.practiceRepairEntryId,
                      }}
                      variant="secondary"
                    >
                      Return to Practice Repair
                    </ButtonLink>
                  </div>
                </section>
              )}

              {activePracticeRepairEntries.length === 0 ? null : (
                <section
                  aria-label="Active Practice Repair"
                  className="study-notes-practice-repair study-notes-practice-repair--active"
                >
                  <div className="study-notes-practice-repair__header">
                    <div className="study-notes-practice-repair__title-row">
                      <h2 className="study-notes-practice-repair__title">
                        Active Practice Repair
                      </h2>
                      <span className="study-notes-practice-repair__signal">
                        Active
                      </span>
                    </div>
                    <p className="muted study-notes-editor__guidance">
                      Edit the correction while this entry is active. Mark it
                      complete or dismiss it explicitly when the repair no
                      longer belongs in active planning work.
                    </p>
                  </div>
                  <div className="study-notes-practice-repair__entries">
                    {activePracticeRepairEntries.map(({ entry, origin }) => {
                      const entryKey = getPracticeRepairEntryKey(
                        entry.reference,
                      );
                      const correctionDraft =
                        practiceRepairCorrectionDrafts[entryKey] ??
                        entry.correction;
                      const isMutationPending = isPracticeRepairMutationPending(
                        entry.reference,
                      );

                      return (
                        <article
                          aria-label={formatPracticeRepairIntentLabel(
                            entry.intent,
                          )}
                          className="study-notes-practice-repair-entry"
                          key={entryKey}
                        >
                          <div className="study-notes-practice-repair-entry__header">
                            <div className="study-notes-practice-repair-entry__title-group">
                              <h3 className="study-notes-practice-repair-entry__title">
                                {formatPracticeRepairIntentLabel(entry.intent)}
                              </h3>
                              <p className="study-notes-practice-repair-entry__meta">
                                Confirmed{" "}
                                {formatRelativeUpdatedLabel(entry.confirmedAt)}
                              </p>
                            </div>
                          </div>
                          <PracticeRepairOriginDetails origin={origin} />
                          <StudyNotesTextarea
                            label="Correction"
                            maxLength={1000}
                            onChange={(event) =>
                              setPracticeRepairCorrectionDrafts((current) => ({
                                ...current,
                                [entryKey]: event.target.value,
                              }))
                            }
                            rows={3}
                            value={correctionDraft}
                          />
                          {entry.nextPracticeIdea === undefined ? null : (
                            <div className="study-notes-practice-repair-entry__next-practice">
                              <span className="study-notes-editor__group-label">
                                Next-practice idea
                              </span>
                              <p>{entry.nextPracticeIdea}</p>
                            </div>
                          )}
                          <div className="study-notes-practice-repair__actions">
                            {isPracticeRepairEntryForIntent(
                              entry,
                              "split-study-note",
                            ) ? (
                              <Button
                                disabled={isMutationPending}
                                onClick={() => void handleSplitStudyNote(entry)}
                                size="compact"
                                type="button"
                                variant="secondary"
                              >
                                <CopyIcon />
                                <span>Split Study Note</span>
                              </Button>
                            ) : null}
                            {entry.intent === "create-sibling-study-note" ? (
                              <Button
                                disabled={isMutationPending}
                                onClick={() =>
                                  void handleCreateSiblingStudyNote({
                                    practiceRepairReference: entry.reference,
                                  })
                                }
                                size="compact"
                                type="button"
                                variant="secondary"
                              >
                                <CopyIcon />
                                <span>Create sibling Study Note</span>
                              </Button>
                            ) : null}
                            {entry.intent === "add-memory-aid" ? (
                              <>
                                <Button
                                  disabled={isMutationPending}
                                  onClick={() =>
                                    handleStartMemoryAidPracticeRepair({
                                      memoryAidKind: "Metaphor",
                                      reference: entry.reference,
                                    })
                                  }
                                  size="compact"
                                  type="button"
                                  variant="secondary"
                                >
                                  <span>Add Metaphor</span>
                                </Button>
                                <Button
                                  disabled={isMutationPending}
                                  onClick={() =>
                                    handleStartMemoryAidPracticeRepair({
                                      memoryAidKind: "Acronym",
                                      reference: entry.reference,
                                    })
                                  }
                                  size="compact"
                                  type="button"
                                  variant="secondary"
                                >
                                  <span>Add Acronym</span>
                                </Button>
                              </>
                            ) : null}
                            <Button
                              disabled={
                                isMutationPending ||
                                correctionDraft.trim().length === 0 ||
                                correctionDraft.trim() === entry.correction
                              }
                              onClick={() =>
                                void updatePracticeRepairEntryCorrection({
                                  correction: correctionDraft,
                                  reference: entry.reference,
                                })
                              }
                              size="compact"
                              type="button"
                              variant="secondary"
                            >
                              Save correction
                            </Button>
                            <Button
                              disabled={isMutationPending}
                              onClick={() =>
                                void completePracticeRepairEntry(
                                  entry.reference,
                                )
                              }
                              size="compact"
                              type="button"
                              variant="secondary"
                            >
                              Mark complete
                            </Button>
                            <Button
                              disabled={isMutationPending}
                              onClick={() =>
                                void dismissPracticeRepairEntry(entry.reference)
                              }
                              size="compact"
                              type="button"
                              variant="danger"
                            >
                              Dismiss
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

              <PracticeFollowUpSection
                entries={actionablePracticeFollowUps}
                onCreateSiblingStudyNote={() =>
                  void handleCreateSiblingStudyNote()
                }
              />

              {practiceRepair === null ? null : (
                <section
                  aria-label={practiceRepair.title}
                  className="study-notes-practice-repair"
                >
                  <div className="study-notes-practice-repair__header">
                    <div className="study-notes-practice-repair__title-row">
                      <h2 className="study-notes-practice-repair__title">
                        {practiceRepair.title}
                      </h2>
                      <span className="study-notes-practice-repair__signal">
                        Needs repair
                      </span>
                    </div>
                    <p className="muted study-notes-editor__guidance">
                      {practiceRepair.summary}
                    </p>
                  </div>
                  <ul
                    aria-label="Practice Repair checklist"
                    className="study-notes-practice-repair__list"
                  >
                    {practiceRepair.suggestions.map((suggestion) => (
                      <li
                        className="study-notes-practice-repair__item"
                        key={suggestion.id}
                      >
                        <span
                          aria-hidden="true"
                          className="study-notes-practice-repair__marker"
                        />
                        <span>{suggestion.text}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="study-notes-practice-repair__actions">
                    <Button
                      onClick={() => void handleCreateSiblingStudyNote()}
                      size="compact"
                      type="button"
                      variant="secondary"
                    >
                      <CopyIcon />
                      <span>Create sibling Study Note</span>
                    </Button>
                    <ButtonLink to="/recall" size="compact" variant="secondary">
                      <CalendarCheckIcon />
                      <span>{practiceRepair.recallTodayActionLabel}</span>
                    </ButtonLink>
                  </div>
                </section>
              )}

              {interleavedRecallRecommendation === null ? null : (
                <section
                  aria-label={interleavedRecallRecommendation.title}
                  className="study-notes-interleaved-recall"
                >
                  <div className="study-notes-interleaved-recall__header">
                    <p className="section-label">
                      {interleavedRecallRecommendation.title}
                    </p>
                    <h2 className="study-notes-interleaved-recall__title">
                      {interleavedRecallRecommendation.title}
                    </h2>
                    <p className="muted study-notes-editor__guidance">
                      {interleavedRecallRecommendation.summary}
                    </p>
                  </div>
                  <div className="study-notes-interleaved-recall__actions">
                    <Button
                      onClick={() => void handleStartInterleavedRecall()}
                      size="compact"
                      type="button"
                      variant="secondary"
                    >
                      {interleavedRecallRecommendation.actionLabel}
                    </Button>
                  </div>
                </section>
              )}

              <section
                aria-label="Recall insights"
                className="study-notes-summary-card study-notes-recall-insights"
                data-insight-kind={selectedRecallInsight.kind}
              >
                <div className="study-notes-summary-card__header">
                  <span className="study-notes-summary-card__icon">
                    <TrendIcon />
                  </span>
                  <div>
                    <h3>{selectedRecallInsight.statusLabel}</h3>
                    <p>{selectedRecallInsight.description}</p>
                  </div>
                </div>
                <dl className="study-notes-summary-card__facts">
                  <StudyNoteFact
                    icon={<ClockIcon />}
                    label="Next recall"
                    value={selectedRecallInsight.nextRecall}
                  />
                  <StudyNoteFact
                    icon={<CalendarCheckIcon />}
                    label="Last result"
                    value={selectedRecallInsight.lastResult}
                  />
                  <StudyNoteFact
                    icon={<StudyNoteDocumentIcon />}
                    label="Suggested action"
                    value={selectedRecallInsight.suggestedAction}
                  />
                </dl>
              </section>

              <section
                aria-label="Reference explanation"
                className="study-notes-editor__source study-notes-editor__info-section"
              >
                <details
                  className="study-notes-editor__disclosure"
                  key={`reference-${selectedDisclosureKey}`}
                  onToggle={(event) =>
                    setReferenceOpenOverride(event.currentTarget.open)
                  }
                  open={isReferenceOpen}
                >
                  <summary className="study-notes-editor__disclosure-summary">
                    <span>
                      <span className="study-notes-editor__group-label">
                        Reference explanation
                      </span>
                      <span className="study-notes-editor__summary-copy">
                        {referenceHasContent
                          ? "Source material available"
                          : "Secondary source material"}
                      </span>
                    </span>
                    <ChevronDownIcon />
                  </summary>
                  <div className="study-notes-editor__disclosure-body">
                    <StudyNotesTextarea
                      label="Note title"
                      maxLength={200}
                      onChange={(event) =>
                        updateDraft((current) => ({
                          ...current,
                          sourceTitle: event.target.value,
                        }))
                      }
                      rows={1}
                      value={draft.sourceTitle}
                    />
                    <StudyNotesTextarea
                      label="Explanation"
                      maxLength={1000}
                      onChange={(event) =>
                        updateDraft((current) => ({
                          ...current,
                          sourceBody: event.target.value,
                        }))
                      }
                      rows={6}
                      value={draft.sourceBody}
                    />
                  </div>
                </details>
              </section>
            </div>
          </fieldset>

          {errorMessage === null || isSaveBarVisible ? null : (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
          {saveStatus === null || isSaveBarVisible ? null : (
            <p className="sr-only" aria-live="polite" role="status">
              {saveStatus}
            </p>
          )}
        </form>

        {isSaveBarVisible ? (
          <section
            aria-label="Unsaved Study Note changes"
            className="study-notes-save-bar"
          >
            <div className="study-notes-save-bar__message">
              <span className="study-notes-save-bar__icon">
                <WarningIcon />
              </span>
              <p
                aria-live={
                  isSaving || saveStatus !== null ? "polite" : undefined
                }
                role={isSaving || saveStatus !== null ? "status" : undefined}
              >
                {saveBarStatusText}
              </p>
              {errorMessage === null ? null : (
                <p className="study-notes-save-bar__error" role="alert">
                  {errorMessage}
                </p>
              )}
            </div>
            <div className="study-notes-save-bar__actions">
              {pendingEditorTarget === null ? null : (
                <Button
                  disabled={isSaving}
                  onClick={stayOnCurrentDraft}
                  size="compact"
                  type="button"
                >
                  Stay
                </Button>
              )}
              {hasDraftChanges || pendingEditorTarget !== null ? (
                <>
                  <Button
                    disabled={isSaving}
                    onClick={discardDraft}
                    size="compact"
                    type="button"
                    variant={
                      pendingEditorTarget === null ? "secondary" : "danger"
                    }
                  >
                    {saveBarDiscardAction}
                  </Button>
                  <Button
                    disabled={isSaving}
                    onClick={() => void saveDraftAndApplyPendingTarget()}
                    size="compact"
                    type="button"
                    variant="primary"
                  >
                    {isSaving ? "Saving..." : saveBarPrimaryAction}
                  </Button>
                </>
              ) : null}
            </div>
          </section>
        ) : null}

        {isNewDiscardDialogOpen ? (
          <div className="study-notes-discard-dialog-backdrop">
            <section
              aria-labelledby="study-notes-discard-dialog-title"
              aria-modal="true"
              className="study-notes-discard-dialog"
              role="dialog"
            >
              <h2 id="study-notes-discard-dialog-title">
                Discard this new Study Note?
              </h2>
              <p>This note has not been saved yet.</p>
              <p>Your changes will be lost.</p>
              <div className="study-notes-discard-dialog__actions">
                <Button
                  onClick={() => setNewDiscardDialogOpen(false)}
                  type="button"
                  variant="secondary"
                >
                  Keep editing
                </Button>
                <Button
                  onClick={abandonNewDraft}
                  type="button"
                  variant="danger"
                >
                  Discard draft
                </Button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </section>
  );
}
