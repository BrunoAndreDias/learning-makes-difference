import {
  createFileRoute,
  Link,
  Navigate,
  Outlet,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  type AppSessionSnapshot,
  resolveProtectedSessionSnapshot,
} from "../access/session/session";
import type { AppLabel } from "../labels/label-management/labels";
import { type AppNote, listNotesForUser } from "../notes";
import { searchNoteResults } from "../notes/notes-workspace/note-search";
import { formatRecallModeLabel } from "./learner-copy";
import { AppRecallError, type RecallMode } from "./recall";

export const Route = createFileRoute("/_protected/recall")({
  component: RecallRouteShell,
  notFoundComponent: RecallRouteNotFoundRedirect,
});

function RecallRouteNotFoundRedirect() {
  return <Navigate to="/recall" />;
}

function RecallRouteShell() {
  const persistentRecallContext = useRouteContext({
    from: "/_protected/recall",
    select: (context) => context.persistentRecall,
  });
  const sessionContext = useRouteContext({
    from: "/_protected/recall",
    select: (context) => context.session,
  });
  const routedSessionSnapshot = useRouteContext({
    from: "/_protected/recall",
    select: (context) => context.sessionSnapshot,
  });
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    sessionContext.subscribe,
    sessionContext.getSnapshot,
    sessionContext.getSnapshot,
  );
  const effectiveSessionSnapshot = resolveProtectedSessionSnapshot({
    routedSessionSnapshot,
    sessionSnapshot,
  });
  const userId = effectiveSessionSnapshot.user?.id ?? null;
  const [isReady, setIsReady] = useState(persistentRecallContext === undefined);

  useEffect(() => {
    let cancelled = false;

    if (persistentRecallContext === undefined) {
      setIsReady(true);
      return () => {
        cancelled = true;
      };
    }

    setIsReady(false);
    void persistentRecallContext
      .refresh(userId)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [persistentRecallContext, userId]);

  if (!isReady) {
    return null;
  }

  return <Outlet />;
}

type RecallTypeOption = {
  disabled: boolean;
  helper: string;
  mode: RecallMode;
};

const recallTypeOptions = [
  {
    disabled: false,
    helper: "Reveal each Note and rate your recall.",
    mode: "FlashCard",
  },
  {
    disabled: true,
    helper: "Connect API key to use AI Assisted recall.",
    mode: "AiAssisted",
  },
  {
    disabled: true,
    helper: "Connect API key to use AI Graded recall.",
    mode: "AiGraded",
  },
] as const satisfies readonly RecallTypeOption[];

const recallQuestionStylePlaceholderFields = [
  "Question format",
  "Difficulty",
  "Number of questions",
] as const;

function getNotePreview(note: AppNote) {
  const body = note.body.trim();

  if (body.length === 0) {
    return "No body saved.";
  }

  return body.length > 150 ? `${body.slice(0, 147)}...` : body;
}

function getLabelNames(
  note: AppNote,
  labelsById: ReadonlyMap<string, AppLabel>,
) {
  return note.labelIds
    .map((labelId) => labelsById.get(labelId)?.name)
    .filter((labelName): labelName is string => labelName !== undefined);
}

function filterNotes(notes: readonly AppNote[], query: string) {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length === 0) {
    return [...notes];
  }

  return searchNoteResults(notes, normalizedQuery).map((result) => result.note);
}

function getSelectedNotes(input: {
  notesById: ReadonlyMap<string, AppNote>;
  selectedNoteIds: readonly string[];
}) {
  return input.selectedNoteIds
    .map((noteId) => input.notesById.get(noteId))
    .filter((note): note is AppNote => note !== undefined);
}

function getDisabledStartReason(input: {
  selectedCount: number;
  selectedRecallType: RecallMode;
}) {
  if (input.selectedCount === 0) {
    return "Select at least one Note.";
  }

  if (input.selectedRecallType !== "FlashCard") {
    return "Connect API key to start this Recall type.";
  }

  return null;
}

export function RecallSelectionPage({
  initialSelectedNoteIds = [],
}: {
  initialSelectedNoteIds?: readonly string[];
}) {
  const navigate = useNavigate();
  const persistentRecallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.persistentRecall,
  });
  const labelsContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.labels,
  });
  const notesContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.notes,
  });
  const recallContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.recall,
  });
  const sessionContext = useRouteContext({
    from: "/_protected",
    select: (context) => context.session,
  });
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    sessionContext.subscribe,
    sessionContext.getSnapshot,
    sessionContext.getSnapshot,
  );
  const notesSnapshot = useSyncExternalStore(
    notesContext.subscribe,
    notesContext.getSnapshot,
    notesContext.getSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const notes = listNotesForUser(notesSnapshot, userId);
  const labels = userId === null ? [] : labelsContext.getLabelsForUser(userId);
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  const notesById = new Map(notes.map((note) => [note.id, note] as const));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>(() => [
    ...new Set(initialSelectedNoteIds),
  ]);
  const [selectedRecallType, setSelectedRecallType] =
    useState<RecallMode>("FlashCard");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const visibleNotes = useMemo(
    () => filterNotes(notes, searchQuery),
    [notes, searchQuery],
  );
  const selectedNotes = getSelectedNotes({ notesById, selectedNoteIds });
  const validSelectedNoteIds = selectedNotes.map((note) => note.id);
  const selectedNoteIdSet = new Set(validSelectedNoteIds);
  const disabledStartReason = getDisabledStartReason({
    selectedCount: selectedNotes.length,
    selectedRecallType,
  });
  const canStart = disabledStartReason === null;

  function toggleNote(noteId: string) {
    setSelectedNoteIds((currentNoteIds) =>
      currentNoteIds.includes(noteId)
        ? currentNoteIds.filter((currentNoteId) => currentNoteId !== noteId)
        : [...currentNoteIds, noteId],
    );
    setErrorMessage(null);
  }

  async function startRecall() {
    if (userId === null || !canStart) {
      return;
    }

    try {
      if (persistentRecallContext === undefined) {
        recallContext.startFlashCardSession({
          mode: selectedRecallType,
          noteIds: validSelectedNoteIds,
          userId,
        });
      } else {
        await persistentRecallContext.startFlashCardSession(userId, {
          mode: selectedRecallType,
          noteIds: validSelectedNoteIds,
        });
      }
      setErrorMessage(null);
      await navigate({ to: "/recall/session" });
    } catch (error) {
      if (error instanceof AppRecallError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  return (
    <section
      aria-label="Recall selection workspace"
      className="recall-workspace"
    >
      <article className="recall-surface">
        <header className="recall-surface__header recall-select__header">
          <div className="notes-editor__title-stack">
            <nav aria-label="Breadcrumb" className="recall-breadcrumb">
              <Link to="/recall">Recall</Link> / Select notes
            </nav>
            <h3>Select notes</h3>
            <p className="muted notes-editor__meta">
              Choose the notes for this recall session.
            </p>
          </div>
        </header>

        {notes.length === 0 ? (
          <section className="recall-panel recall-empty-state">
            <h4>Recall starts with notes</h4>
            <p className="muted">
              Create Notes first, then use Metaphors and Acronyms to reinforce
              each concept.
            </p>
            <Link className="notes-action notes-action-primary" to="/notes">
              Open Notes Workspace
            </Link>
          </section>
        ) : (
          <div className="recall-selection-layout recall-selection-layout--picker">
            <section
              aria-label="Available Notes"
              className="recall-panel recall-note-picker recall-select-note-picker"
            >
              <label
                className="recall-field recall-search-field"
                htmlFor="recall-note-search"
              >
                <span className="sr-only">Search Notes</span>
                <SearchIcon />
                <input
                  id="recall-note-search"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search notes"
                  type="search"
                  value={searchQuery}
                />
              </label>

              <ol className="recall-note-picker__list">
                {visibleNotes.map((note) => {
                  const labelNames = getLabelNames(note, labelsById);

                  return (
                    <li key={note.id}>
                      <label
                        className="recall-note-row recall-select-note-row"
                        data-selected={selectedNoteIdSet.has(note.id)}
                      >
                        <span className="recall-note-row__check">
                          <input
                            checked={selectedNoteIdSet.has(note.id)}
                            onChange={() => toggleNote(note.id)}
                            type="checkbox"
                          />
                        </span>
                        <span className="recall-select-note-row__main">
                          <span className="recall-select-note-row__content">
                            <strong>{note.title}</strong>
                            <span>{getNotePreview(note)}</span>
                            <span className="recall-select-note-row__labels">
                              {labelNames.length > 0 ? (
                                labelNames.slice(0, 2).map((labelName) => (
                                  <span
                                    className="recall-select-note-row__label"
                                    key={`${note.id}-${labelName}`}
                                  >
                                    {labelName}
                                  </span>
                                ))
                              ) : (
                                <span
                                  className="recall-select-note-row__label"
                                  data-tone="muted"
                                >
                                  No label
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="recall-select-note-row__counts">
                            <span className="recall-select-note-row__count">
                              <span>Metaphors</span>
                              <strong>{note.metaphors.length}</strong>
                            </span>
                            <span className="recall-select-note-row__count">
                              <span>Acronyms</span>
                              <strong>{note.acronyms.length}</strong>
                            </span>
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ol>

              {visibleNotes.length === 0 ? (
                <p className="notes-search__empty" role="status">
                  No Notes match this search.
                </p>
              ) : null}

              <footer className="recall-note-picker__footer">
                Showing {visibleNotes.length} of {notes.length} notes
              </footer>
            </section>

            <SessionSetupPanel
              disabledStartReason={disabledStartReason}
              onRecallTypeChange={setSelectedRecallType}
              onStartRecall={startRecall}
              selectedNotes={selectedNotes}
              selectedRecallType={selectedRecallType}
            />
          </div>
        )}

        {errorMessage !== null ? (
          <p className="auth-form__error" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </article>
    </section>
  );
}

function SessionSetupPanel({
  disabledStartReason,
  onRecallTypeChange,
  onStartRecall,
  selectedNotes,
  selectedRecallType,
}: {
  disabledStartReason: string | null;
  onRecallTypeChange: (mode: RecallMode) => void;
  onStartRecall: () => void;
  selectedNotes: readonly AppNote[];
  selectedRecallType: RecallMode;
}) {
  const selectedRecallOption = recallTypeOptions.find(
    (option) => option.mode === selectedRecallType,
  );
  const recallTypeWarning =
    selectedRecallOption?.disabled === true
      ? `Connect API key to start ${formatRecallModeLabel(selectedRecallType)}.`
      : null;

  return (
    <aside
      aria-label="Session setup"
      className="recall-panel recall-session-setup recall-select-session-setup"
    >
      <header className="recall-select-session-setup__header">
        <p className="section-label">Session setup</p>
        <PinIcon />
      </header>

      <div className="recall-select-session-setup__selected-notes">
        <p className="muted">Selected notes</p>
        <p className="recall-select-session-setup__selected-count">
          {selectedNotes.length}
        </p>
      </div>

      <div className="recall-select-session-setup__divider" />

      <fieldset className="recall-type-selector recall-select-type-selector">
        <legend>Recall type</legend>
        <div className="recall-select-type-selector__options">
          {recallTypeOptions.map((option) => (
            <label
              className="recall-type-option recall-select-type-option"
              data-disabled={option.disabled}
              data-mode={option.mode}
              data-selected={option.mode === selectedRecallType}
              key={option.mode}
            >
              <input
                checked={option.mode === selectedRecallType}
                onChange={() => onRecallTypeChange(option.mode)}
                type="radio"
                value={option.mode}
              />
              <span
                className="recall-select-type-option__icon"
                aria-hidden="true"
              >
                <RecallTypeIcon mode={option.mode} />
              </span>
              <span>
                <strong>{formatRecallModeLabel(option.mode)}</strong>
                <span>{option.helper}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="recall-select-session-setup__question-style">
        <h5 className="recall-select-session-setup__section-title">
          Question style
          <InfoIcon />
        </h5>
        {recallQuestionStylePlaceholderFields.map((field) => {
          const fieldId = `recall-${field.toLowerCase().replaceAll(" ", "-")}`;

          return (
            <label className="recall-field" htmlFor={fieldId} key={field}>
              <span className="sr-only">{field}</span>
              <select id={fieldId} disabled value={field}>
                <option value={field}>{field}</option>
              </select>
            </label>
          );
        })}
      </section>

      <p className="recall-select-session-setup__hint">
        <InfoIcon />
        <span>
          Your selection is temporary and used only for this recall session.
        </span>
      </p>

      <div className="recall-session-setup__actions">
        <button
          aria-describedby={
            recallTypeWarning === null ? undefined : "recall-start-reason"
          }
          className="notes-action notes-action-primary recall-select-session-setup__start"
          disabled={disabledStartReason !== null}
          onClick={onStartRecall}
          type="button"
        >
          Start recall
        </button>
      </div>

      {recallTypeWarning !== null ? (
        <p className="muted" id="recall-start-reason">
          {recallTypeWarning}
        </p>
      ) : null}
    </aside>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="17"
      viewBox="0 0 24 24"
      width="17"
    >
      <path
        d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 10v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="7.5" fill="currentColor" r="1.1" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M8 4h8m-1 0v5l3 3H6l3-3V4m3 8v8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function RecallTypeIcon({ mode }: { mode: RecallMode }) {
  if (mode === "FlashCard") {
    return (
      <svg
        aria-hidden="true"
        fill="none"
        height="14"
        viewBox="0 0 24 24"
        width="14"
      >
        <rect
          height="13"
          rx="2.2"
          stroke="currentColor"
          strokeWidth="1.8"
          width="16"
          x="4"
          y="5"
        />
        <path
          d="M8 10h8M8 13h5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (mode === "AiAssisted") {
    return (
      <svg
        aria-hidden="true"
        fill="none"
        height="14"
        viewBox="0 0 24 24"
        width="14"
      >
        <path
          d="m12 4 1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      viewBox="0 0 24 24"
      width="14"
    >
      <rect
        height="14"
        rx="2.3"
        stroke="currentColor"
        strokeWidth="1.8"
        width="14"
        x="5"
        y="5"
      />
      <path
        d="m9 12 2.2 2.2L15.5 10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
