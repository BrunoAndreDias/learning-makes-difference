import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
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
        sourceBody: "Expected answer",
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
      !window.confirm("Delete this last Study Note and its source Note?")
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
      } else {
        await storeMutation.updateStudyNote(
          userId,
          selectedStudyNote.id,
          draft,
        );
      }

      setSaveStatus("Saved");
    } catch (error) {
      handleError(error);
    }
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
      <header className="notes-toolbar">
        <div>
          <p className="section-label">Workspace</p>
          <h1>Study Notes</h1>
          <p className="notes-toolbar__copy">
            Practice targets with source context underneath.
          </p>
        </div>
        <button
          className="notes-action notes-action-primary"
          onClick={() => void handleNewStudyNote()}
          type="button"
        >
          New Study Note
        </button>
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
              <ul>
                {studyNotes.map((studyNote) => {
                  const learningState = learningStateByStudyNoteId.get(
                    studyNote.id,
                  );
                  const learningLabels =
                    learningState === undefined
                      ? null
                      : getStudyNoteLearningLabels(learningState);

                  return (
                    <li key={studyNote.id}>
                      <button
                        aria-label={studyNote.prompt}
                        aria-current={
                          studyNote.id === selectedStudyNote?.id
                            ? "page"
                            : undefined
                        }
                        className="notes-list__item"
                        onClick={() => {
                          setSelectedStudyNoteId(studyNote.id);
                          setSaveStatus(null);
                        }}
                        type="button"
                      >
                        <strong>{studyNote.prompt}</strong>
                        <span>{studyNote.source.title}</span>
                        {learningLabels === null ? null : (
                          <span className="notes-list__item-status">
                            <span>{learningLabels.compact}</span>
                            {learningLabels.lastRecalled === null ? null : (
                              <span>{learningLabels.lastRecalled}</span>
                            )}
                            {learningLabels.due === null ? null : (
                              <span>{learningLabels.due}</span>
                            )}
                            {learningLabels.practice === null ? null : (
                              <span>{learningLabels.practice}</span>
                            )}
                          </span>
                        )}
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
          className="notes-editor study-notes-editor"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <fieldset className="notes-editor__study-surface">
            <legend className="sr-only">Study Note</legend>
            <div className="notes-editor__header">
              <div className="notes-editor__title-stack">
                <p className="section-label">Study Note</p>
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
              <button
                className="notes-action notes-action-primary"
                type="submit"
              >
                Save
              </button>
              <button
                className="notes-action"
                disabled={selectedStudyNote === null}
                onClick={() => void handleAddStudyNoteFromSource()}
                type="button"
              >
                Add Study Note from this source
              </button>
              <button
                className="notes-action notes-action-danger"
                disabled={selectedStudyNote === null}
                onClick={() => void handleDeleteStudyNote()}
                type="button"
              >
                Delete Study Note
              </button>
            </div>

            <div className="study-notes-editor__fields">
              <label className="notes-form__field">
                <span>Expected answer</span>
                <textarea
                  aria-label="Expected answer"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      expectedAnswer: event.target.value,
                    }))
                  }
                  rows={9}
                  value={draft.expectedAnswer}
                />
              </label>

              <section aria-label="Study Note labels">
                <p className="section-label">Labels</p>
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
                <div>
                  <p className="section-label">Memory hooks</p>
                  <h2>Memory hooks</h2>
                </div>
                <label className="notes-form__field">
                  <span>Metaphor</span>
                  <textarea
                    aria-label="Metaphor"
                    onChange={(event) => {
                      updateDraftMemoryHook("metaphors", event.target.value);
                    }}
                    rows={3}
                    value={draft.metaphors[0]?.description ?? ""}
                  />
                </label>
                <label className="notes-form__field">
                  <span>Acronym</span>
                  <textarea
                    aria-label="Acronym"
                    onChange={(event) => {
                      updateDraftMemoryHook("acronyms", event.target.value);
                    }}
                    rows={3}
                    value={draft.acronyms[0]?.description ?? ""}
                  />
                </label>
              </section>

              <section
                aria-label="Source Note"
                className="study-notes-editor__source"
              >
                <div>
                  <p className="section-label">Source Note</p>
                  <h2>Source Note</h2>
                  {selectedSourceStudyNotes.length > 1 ? (
                    <p className="muted study-notes-editor__shared-source">
                      {`Shared source: ${selectedSourceStudyNotes.length} Study Notes`}
                    </p>
                  ) : null}
                </div>
                <label className="notes-form__field">
                  <span>Source title</span>
                  <input
                    aria-label="Source title"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        sourceTitle: event.target.value,
                      }))
                    }
                    value={draft.sourceTitle}
                  />
                </label>
                <label className="notes-form__field">
                  <span>Source body</span>
                  <textarea
                    aria-label="Source body"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        sourceBody: event.target.value,
                      }))
                    }
                    rows={8}
                    value={draft.sourceBody}
                  />
                </label>
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
