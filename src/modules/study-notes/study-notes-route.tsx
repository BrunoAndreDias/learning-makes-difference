import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { Button } from "../../design-system/button";
import { FloatingTextarea } from "../../design-system/floating-textarea";
import { ListCard } from "../../design-system/list-card";
import { PageHeader } from "../../design-system/page-header";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import { FocusSessionStartControl } from "../focus";
import type { AppLabel } from "../labels/label-management/labels";
import "../notes/notes-workspace/notes-editor-route.css";
import "../notes/notes-workspace/notes-form-foundation.css";
import "../notes/notes-workspace/notes-foundation.css";
import "../notes/notes-workspace/notes-responsive.css";
import "../notes/notes-workspace/notes-toolbar.css";
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
  listStudyNotesForUser,
  type StudyNoteLearningState,
  toStudyNoteRecallHistories,
  type UpdateStudyNoteInput,
} from ".";

export const Route = createFileRoute("/_protected/study-notes")({
  component: StudyNotesWorkspace,
});

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
const learningStateDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const STUDY_NOTE_EDITOR_FORM_ID = "study-note-editor-form";
const STUDY_NOTE_GUIDANCE_COPY = {
  expectedAnswerPlaceholder:
    "Explain the reason, steps, limits, and one example or non-example.",
  memoryAids:
    "Optional. Add one only when it would make this answer easier to recall.",
  prompt:
    "Ask why, how, when it works, when it does not, or what a worked example shows.",
  promptPlaceholder:
    "Why does this work? How would I use it? What example proves it?",
  referenceExplanation: "Worked examples belong here as source material.",
} as const;

function formatLastRecalledLabel(lastRecalledAt: string | null) {
  if (lastRecalledAt === null) {
    return null;
  }

  const recalledAt = new Date(lastRecalledAt);

  if (Number.isNaN(recalledAt.getTime())) {
    return null;
  }

  return `Last recalled ${learningStateDateFormatter.format(recalledAt)}`;
}

type StudyNoteLearningLabels = {
  compact: string;
  due: string | null;
  lastRecalled: string | null;
  practice: string | null;
};

type StudyNoteListDescriptionLine = {
  id: "due" | "last-recalled" | "practice";
  text: string;
};

function getStudyNoteLearningLabels(
  learningState: StudyNoteLearningState,
): StudyNoteLearningLabels {
  return {
    compact: formatStudyNoteLearningStateCompactLabel(learningState),
    due: formatStudyNoteDueLabel(learningState),
    lastRecalled: formatLastRecalledLabel(learningState.lastRecalledAt),
    practice: formatStudyNotePracticeSignalLabel(learningState),
  };
}

function getStudyNoteListDescriptionLines(
  learningLabels: StudyNoteLearningLabels | null,
): StudyNoteListDescriptionLine[] {
  const lines: StudyNoteListDescriptionLine[] = [
    { id: "last-recalled", text: learningLabels?.lastRecalled ?? "" },
    { id: "due", text: learningLabels?.due ?? "" },
    { id: "practice", text: learningLabels?.practice ?? "" },
  ];

  return lines.filter((line) => line.text !== "");
}

function getAttachedLabels(
  labels: readonly AppLabel[],
  labelIds: readonly string[],
) {
  const attachedLabelIds = new Set(labelIds);

  return labels.filter((label) => attachedLabelIds.has(label.id));
}

function formatPromptList(prompts: readonly string[]) {
  if (prompts.length <= 1) {
    return prompts[0] ?? "";
  }

  const leadingPrompts = prompts.slice(0, -1).join(", ");
  const finalPrompt = prompts[prompts.length - 1];

  return `${leadingPrompts} and ${finalPrompt}`;
}

function formatSharedSourceEditMessage(prompts: readonly string[]) {
  if (prompts.length <= 1) {
    return null;
  }

  return `Editing this explanation updates ${prompts.length} sibling Study Notes: ${formatPromptList(
    prompts,
  )}.`;
}

function StudyNotesWorkspace() {
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
  useSyncExternalStore(
    focusContext.subscribe,
    focusContext.getSnapshot,
    focusContext.getSnapshot,
  );
  const [availableLabels, setAvailableLabels] = useState<AppLabel[]>([]);
  const [selectedLabelId, setSelectedLabelId] = useState("");
  const studyNotes = useMemo(
    () =>
      listStudyNotesForUser(
        studyNotesSnapshot,
        userId,
        selectedLabelId === "" ? {} : { labelId: selectedLabelId },
      ),
    [selectedLabelId, studyNotesSnapshot, userId],
  );
  const learningStates = useMemo(
    () =>
      deriveStudyNoteLearningStates({
        histories:
          userId === null || recallResultsSnapshot.length === 0
            ? []
            : toStudyNoteRecallHistories(
                recallContext.listAttemptsByNote({ userId }),
              ),
        now: new Date().toISOString(),
        recallSchedules: recallSchedulesSnapshot,
        studyNotes,
      }),
    [
      recallContext,
      recallResultsSnapshot,
      recallSchedulesSnapshot,
      studyNotes,
      userId,
    ],
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
  const [selectedStudyNoteId, setSelectedStudyNoteId] = useState<string | null>(
    studyNotes[0]?.id ?? null,
  );
  const selectedStudyNote =
    studyNotes.find((studyNote) => studyNote.id === selectedStudyNoteId) ??
    studyNotes[0] ??
    null;
  const selectedSourceStudyNotes =
    selectedStudyNote === null
      ? []
      : studyNotes.filter(
          (studyNote) =>
            studyNote.sourceNoteId === selectedStudyNote.sourceNoteId,
        );
  const sharedSourceEditMessage = formatSharedSourceEditMessage(
    selectedSourceStudyNotes.map((studyNote) => studyNote.prompt),
  );
  const activeFocusSession =
    userId === null ? null : focusContext.getActiveSession({ userId });
  const [draft, setDraft] = useState<UpdateStudyNoteInput>(() =>
    createDraftFromStudyNote(selectedStudyNote),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const storeMutation = persistentStudyNotesContext ?? studyNotesContext;
  const hasDraftChanges = !areStudyNoteDraftsEqual(
    draft,
    createDraftFromStudyNote(selectedStudyNote),
  );

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
    if (
      selectedStudyNoteId !== null &&
      studyNotes.some((studyNote) => studyNote.id === selectedStudyNoteId)
    ) {
      return;
    }

    setSelectedStudyNoteId(studyNotes[0]?.id ?? null);
  }, [selectedStudyNoteId, studyNotes]);

  useEffect(() => {
    setDraft(createDraftFromStudyNote(selectedStudyNote));
  }, [selectedStudyNote]);

  async function handleNewStudyNote() {
    setErrorMessage(null);
    setSaveStatus(null);

    try {
      const createdStudyNote = await storeMutation.createStudyNote(userId, {
        expectedAnswer: "",
        prompt: "New Study Note",
        sourceBody: "",
        sourceTitle: "",
      });
      setSelectedStudyNoteId(createdStudyNote.id);
    } catch (error) {
      handleError(error);
    }
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
      setSelectedStudyNoteId(
        studyNotes.find((studyNote) => studyNote.id !== selectedStudyNote.id)
          ?.id ?? null,
      );
    } catch (error) {
      handleError(error);
    }
  }

  async function saveDraft() {
    if (!hasDraftChanges) {
      return;
    }

    setErrorMessage(null);
    setSaveStatus(null);

    try {
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
        savedStudyNote = updatedStudyNote;
      } else {
        savedStudyNote = await storeMutation.updateStudyNote(
          userId,
          selectedStudyNote.id,
          draft,
        );
      }

      await captureFocusStudyNoteActivity(savedStudyNote);
      setSaveStatus("Saved");
    } catch (error) {
      handleError(error);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await saveDraft();
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
    setDraft((current) => ({
      ...current,
      [field]: createSingleSupportDescriptionDraft(description),
    }));
  }

  return (
    <section className="notes-workspace study-notes-workspace">
      <PageHeader
        actions={
          <FocusSessionStartControl
            activeFocusSession={activeFocusSession}
            focus={focusContext}
            persistentFocus={persistentFocusContext}
            userId={userId}
          />
        }
        actionsClassName="notes-workspace__quick-actions"
        className="notes-workspace__page-header study-notes-workspace__page-header"
        description="Practice targets with reference explanations underneath."
        headingLevel={1}
        title="Study Notes"
      />

      <div className="notes-layout study-notes-layout">
        <aside aria-label="Study Notes catalog" className="notes-list-panel">
          <div className="notes-list-panel__header">
            <h2 className="study-notes-list-heading">
              <span>Study Notes</span>
              <span className="tag study-notes-list-heading__count">
                {studyNotes.length}
              </span>
            </h2>
            <Button
              aria-label="New Study Note"
              className="study-notes-list-new"
              onClick={() => void handleNewStudyNote()}
              size="compact"
              type="button"
            >
              New
            </Button>
          </div>
          <fieldset className="study-notes-list-actions">
            <legend className="sr-only">Study Note actions</legend>
            <Button
              disabled={!hasDraftChanges}
              onClick={() => void saveDraft()}
              size="compact"
              type="button"
              variant="primary"
            >
              Save
            </Button>
            <Button
              aria-label="Delete Study Note"
              disabled={selectedStudyNote === null}
              onClick={() => void handleDeleteStudyNote()}
              size="compact"
              type="button"
              variant="danger"
            >
              Delete
            </Button>
          </fieldset>
          <label className="notes-form__field study-notes-filter">
            <span>Filter by label</span>
            <span className="study-notes-filter__select-shell">
              <select
                aria-label="Filter Study Notes by label"
                onChange={(event) => setSelectedLabelId(event.target.value)}
                value={selectedLabelId}
              >
                <option value="">All</option>
                {availableLabels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
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
                  const descriptionLines =
                    getStudyNoteListDescriptionLines(learningLabels);

                  return (
                    <li key={studyNote.id}>
                      <ListCard
                        aria-label={studyNote.prompt}
                        aria-current={
                          studyNote.id === selectedStudyNote?.id
                            ? "page"
                            : undefined
                        }
                        chip={learningLabels?.compact ?? "Study Note"}
                        description={descriptionLines.map((line) => (
                          <span key={line.id}>{line.text}</span>
                        ))}
                        onClick={() => {
                          setSelectedStudyNoteId(studyNote.id);
                          setSaveStatus(null);
                        }}
                        selected={studyNote.id === selectedStudyNote?.id}
                        title={studyNote.prompt}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
        </aside>

        <form
          aria-label="Study Note editor surface"
          className="notes-editor study-notes-editor"
          id={STUDY_NOTE_EDITOR_FORM_ID}
          onSubmit={(event) => void handleSubmit(event)}
        >
          <fieldset className="notes-editor__study-surface">
            <legend className="sr-only">Study Note</legend>
            <div className="notes-editor__header">
              <div className="notes-editor__title-stack">
                <label className="notes-title-editor">
                  <span className="sr-only">Prompt</span>
                  <input
                    aria-label="Prompt"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        prompt: event.target.value,
                      }))
                    }
                    placeholder={STUDY_NOTE_GUIDANCE_COPY.promptPlaceholder}
                    value={draft.prompt}
                  />
                </label>
                <p className="muted study-notes-editor__guidance">
                  {STUDY_NOTE_GUIDANCE_COPY.prompt}
                </p>
              </div>
            </div>

            <div className="study-notes-editor__fields">
              <FloatingTextarea
                label="Expected answer"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    expectedAnswer: event.target.value,
                  }))
                }
                placeholder={STUDY_NOTE_GUIDANCE_COPY.expectedAnswerPlaceholder}
                rows={9}
                value={draft.expectedAnswer}
              />

              <section
                aria-label="Study Note labels"
                className="study-notes-editor__label-section"
              >
                <p className="study-notes-editor__group-label">Labels</p>
                {availableLabels.length === 0 ? (
                  <p className="muted">No Labels yet.</p>
                ) : (
                  <div className="study-notes-labels">
                    {availableLabels.map((label) => (
                      <label key={label.id} className="study-notes-label">
                        <input
                          checked={draft.labelIds.includes(label.id)}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              labelIds: setLabelIdSelection(
                                current.labelIds,
                                label.id,
                                event.target.checked,
                              ),
                            }))
                          }
                          type="checkbox"
                        />
                        <span>{label.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </section>

              <section
                aria-label="Memory aid support descriptions"
                className="study-notes-editor__memory-aids"
              >
                <div>
                  <p className="section-label">Memory aids</p>
                  <p className="muted study-notes-editor__guidance">
                    {STUDY_NOTE_GUIDANCE_COPY.memoryAids}
                  </p>
                </div>
                <FloatingTextarea
                  label="Metaphor"
                  onChange={(event) => {
                    updateDraftSupportDescription(
                      "metaphors",
                      event.target.value,
                    );
                  }}
                  rows={3}
                  value={draft.metaphors[0]?.description ?? ""}
                />
                <FloatingTextarea
                  label="Acronym"
                  onChange={(event) => {
                    updateDraftSupportDescription(
                      "acronyms",
                      event.target.value,
                    );
                  }}
                  rows={3}
                  value={draft.acronyms[0]?.description ?? ""}
                />
              </section>

              <section
                aria-label="Reference explanation"
                className="study-notes-editor__source"
              >
                <div>
                  <p className="study-notes-editor__group-label">
                    Reference explanation
                  </p>
                  <p className="muted study-notes-editor__guidance">
                    {STUDY_NOTE_GUIDANCE_COPY.referenceExplanation}
                  </p>
                  {sharedSourceEditMessage === null ? null : (
                    <p className="muted study-notes-editor__shared-source">
                      {sharedSourceEditMessage}
                    </p>
                  )}
                </div>
                <FloatingTextarea
                  containerClassName="study-notes-editor__source-title"
                  label="Note title"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      sourceTitle: event.target.value,
                    }))
                  }
                  rows={1}
                  value={draft.sourceTitle}
                />
                <FloatingTextarea
                  label="Explanation"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      sourceBody: event.target.value,
                    }))
                  }
                  rows={8}
                  value={draft.sourceBody}
                />
              </section>
            </div>
          </fieldset>

          {errorMessage === null ? null : (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
          {saveStatus === null ? null : (
            <p className="muted" role="status">
              {saveStatus}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
