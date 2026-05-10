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

function createSingleHookDraft(description: string) {
  if (description.trim().length === 0) {
    return [];
  }

  return [{ description }];
}
const learningStateDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});

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
  id: "due" | "last-recalled" | "practice" | "source";
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
  studyNote: AppStudyNote,
  learningLabels: StudyNoteLearningLabels | null,
): StudyNoteListDescriptionLine[] {
  const lines: StudyNoteListDescriptionLine[] = [
    { id: "source", text: studyNote.source.title },
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
        studyNotes,
      }),
    [recallContext, recallResultsSnapshot, studyNotes, userId],
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
  const activeFocusSession =
    userId === null ? null : focusContext.getActiveSession({ userId });
  const [draft, setDraft] = useState<UpdateStudyNoteInput>(() =>
    createDraftFromStudyNote(selectedStudyNote),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const storeMutation = persistentStudyNotesContext ?? studyNotesContext;

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
        sourceBody: "",
        sourceTitle: "New Study Note",
      });
      setSelectedStudyNoteId(createdStudyNote.id);
    } catch (error) {
      handleError(error);
    }
  }

  async function handleAddStudyNoteFromSource() {
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSaveStatus(null);

    try {
      let savedStudyNote: AppStudyNote;

      if (selectedStudyNote === null) {
        const createdStudyNote = await storeMutation.createStudyNote(userId, {
          sourceBody: draft.sourceBody,
          sourceTitle: draft.sourceTitle || draft.prompt,
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

  function updateDraftMemoryHook(
    field: "acronyms" | "metaphors",
    description: string,
  ) {
    setDraft((current) => ({
      ...current,
      [field]: createSingleHookDraft(description),
    }));
  }

  return (
    <section className="notes-workspace study-notes-workspace">
      <header className="notes-workspace__page-header">
        <div className="notes-workspace__header-copy">
          <p className="section-label">Workspace</p>
          <div className="notes-workspace__identity">
            <h1>Study Notes</h1>
            <p>Practice targets with reference explanations underneath.</p>
          </div>
        </div>
        <div className="notes-workspace__quick-actions">
          <Button
            onClick={() => void handleNewStudyNote()}
            type="button"
            variant="primary"
          >
            New Study Note
          </Button>
          <FocusSessionStartControl
            activeFocusSession={activeFocusSession}
            focus={focusContext}
            persistentFocus={persistentFocusContext}
            userId={userId}
          />
        </div>
      </header>

      <div className="notes-layout study-notes-layout">
        <aside aria-label="Study Notes catalog" className="notes-list-panel">
          <div className="notes-list-panel__header">
            <div>
              <p className="section-label">Study Notes</p>
              <h2>Study Notes</h2>
            </div>
            <span className="tag">{`${studyNotes.length} Study Notes`}</span>
          </div>
          <label className="notes-form__field study-notes-filter">
            <span>Filter by label</span>
            <select
              aria-label="Filter Study Notes by label"
              onChange={(event) => setSelectedLabelId(event.target.value)}
              value={selectedLabelId}
            >
              <option value="">All Study Notes</option>
              {availableLabels.map((label) => (
                <option key={label.id} value={label.id}>
                  {label.name}
                </option>
              ))}
            </select>
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
                  const descriptionLines = getStudyNoteListDescriptionLines(
                    studyNote,
                    learningLabels,
                  );

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
                    placeholder="Prompt"
                    value={draft.prompt}
                  />
                </label>
              </div>
              <Button type="submit" variant="primary">
                Save
              </Button>
              <Button
                disabled={selectedStudyNote === null}
                onClick={() => void handleAddStudyNoteFromSource()}
                type="button"
              >
                Add Study Note from this explanation
              </Button>
              <Button
                disabled={selectedStudyNote === null}
                onClick={() => void handleDeleteStudyNote()}
                type="button"
                variant="danger"
              >
                Delete Study Note
              </Button>
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
                aria-label="Memory hooks"
                className="study-notes-editor__memory-hooks"
              >
                <p className="study-notes-editor__group-label">Memory hooks</p>
                <FloatingTextarea
                  label="Metaphor"
                  onChange={(event) => {
                    updateDraftMemoryHook("metaphors", event.target.value);
                  }}
                  rows={3}
                  value={draft.metaphors[0]?.description ?? ""}
                />
                <FloatingTextarea
                  label="Acronym"
                  onChange={(event) => {
                    updateDraftMemoryHook("acronyms", event.target.value);
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
                  {selectedSourceStudyNotes.length > 1 ? (
                    <p className="muted study-notes-editor__shared-source">
                      {`Shared explanation: ${selectedSourceStudyNotes.length} Study Notes`}
                    </p>
                  ) : null}
                </div>
                <label className="notes-form__field">
                  <span className="sr-only">Explanation title</span>
                  <input
                    aria-label="Explanation title"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        sourceTitle: event.target.value,
                      }))
                    }
                    placeholder="Explanation title"
                    value={draft.sourceTitle}
                  />
                </label>
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
