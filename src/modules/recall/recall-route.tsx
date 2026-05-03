import {
  createFileRoute,
  Link,
  Navigate,
  Outlet,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { formatCount } from "../../lib/format-count";
import type { AppSessionSnapshot } from "../access/session/session";
import type { AppLabel } from "../labels/label-management/labels";
import { type AppNote, listNotesForUser } from "../notes";
import { formatSearchMatchLabel } from "../notes/learner-copy";
import {
  formatNoteSearchResultPreview,
  searchNoteResults,
} from "../notes/notes-workspace/note-search";
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
  const sessionSnapshot = useSyncExternalStore<AppSessionSnapshot>(
    sessionContext.subscribe,
    sessionContext.getSnapshot,
    sessionContext.getSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
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

function getMemoryAidCountLabel(note: AppNote) {
  return [
    formatCount(note.metaphors.length, "Metaphor"),
    formatCount(note.acronyms.length, "Acronym"),
  ].join(" · ");
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

  async function cancelSelection() {
    await navigate({ to: "/recall" });
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
        <header className="recall-surface__header">
          <div className="notes-editor__title-stack">
            <p className="section-label">Recall / Select</p>
            <h3>Start Recall</h3>
            <p className="muted notes-editor__meta">
              Choose Notes for this temporary RecallSession.
            </p>
          </div>
          <button
            className="notes-action"
            onClick={cancelSelection}
            type="button"
          >
            Cancel
          </button>
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
              className="recall-panel recall-note-picker"
            >
              <label className="recall-field" htmlFor="recall-note-search">
                <span className="sr-only">Search Notes</span>
                <input
                  id="recall-note-search"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search Notes..."
                  type="search"
                  value={searchQuery}
                />
              </label>

              {searchQuery.trim().length > 0 ? (
                <SearchMatchSummary notes={notes} query={searchQuery} />
              ) : null}

              <ol className="recall-note-picker__list">
                {visibleNotes.map((note) => (
                  <li key={note.id}>
                    <label
                      className="recall-note-row"
                      data-selected={selectedNoteIdSet.has(note.id)}
                    >
                      <span className="recall-note-row__check">
                        <input
                          checked={selectedNoteIdSet.has(note.id)}
                          onChange={() => toggleNote(note.id)}
                          type="checkbox"
                        />
                      </span>
                      <span className="recall-note-row__content">
                        <strong>{note.title}</strong>
                        <span>{getNotePreview(note)}</span>
                        <span className="recall-note-row__meta">
                          {getLabelNames(note, labelsById).length > 0
                            ? getLabelNames(note, labelsById).join(", ")
                            : "No labels"}
                        </span>
                        <span className="recall-note-row__meta">
                          {getMemoryAidCountLabel(note)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ol>

              {visibleNotes.length === 0 ? (
                <p className="notes-search__empty" role="status">
                  No Notes match this search.
                </p>
              ) : null}

              <footer className="recall-note-picker__footer">
                <span>
                  {formatCount(selectedNotes.length, "Note")} selected
                </span>
                <span>{formatCount(visibleNotes.length, "Note")} shown</span>
              </footer>
            </section>

            <SessionSetupPanel
              disabledStartReason={disabledStartReason}
              onCancel={cancelSelection}
              onClearSelection={() => setSelectedNoteIds([])}
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

function SearchMatchSummary({
  notes,
  query,
}: {
  notes: readonly AppNote[];
  query: string;
}) {
  const firstMatch = searchNoteResults(notes, query)[0];

  if (firstMatch === undefined) {
    return null;
  }

  const preview = formatNoteSearchResultPreview(firstMatch);

  return (
    <p className="muted recall-search-match-summary">
      {formatSearchMatchLabel(firstMatch.matchChip)}
      {preview === null ? "" : ` · ${preview}`}
    </p>
  );
}

function SessionSetupPanel({
  disabledStartReason,
  onCancel,
  onClearSelection,
  onRecallTypeChange,
  onStartRecall,
  selectedNotes,
  selectedRecallType,
}: {
  disabledStartReason: string | null;
  onCancel: () => void;
  onClearSelection: () => void;
  onRecallTypeChange: (mode: RecallMode) => void;
  onStartRecall: () => void;
  selectedNotes: readonly AppNote[];
  selectedRecallType: RecallMode;
}) {
  const selectedRecallOption = recallTypeOptions.find(
    (option) => option.mode === selectedRecallType,
  );

  return (
    <aside
      aria-label="Session setup"
      className="recall-panel recall-session-setup"
    >
      <div className="notes-editor__title-stack">
        <p className="section-label">Session setup</p>
        <h4>{formatCount(selectedNotes.length, "Note")} selected</h4>
        <p className="muted">
          This selection is temporary and is used only for the next
          RecallSession.
        </p>
      </div>

      <button
        className="notes-action"
        disabled={selectedNotes.length === 0}
        onClick={onClearSelection}
        type="button"
      >
        Clear selection
      </button>

      <fieldset className="recall-type-selector">
        <legend>Recall type</legend>
        {recallTypeOptions.map((option) => (
          <label
            className="recall-type-option"
            data-disabled={option.disabled}
            data-selected={option.mode === selectedRecallType}
            key={option.mode}
          >
            <input
              checked={option.mode === selectedRecallType}
              onChange={() => onRecallTypeChange(option.mode)}
              type="radio"
              value={option.mode}
            />
            <span>
              <strong>{formatRecallModeLabel(option.mode)}</strong>
              <span>{option.helper}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {selectedRecallOption?.disabled ? (
        <p className="muted" role="status">
          Connect API key to start {formatRecallModeLabel(selectedRecallType)}.
        </p>
      ) : null}

      <div className="recall-session-setup__selected">
        {selectedNotes.length === 0 ? (
          <p className="muted">No Notes selected.</p>
        ) : (
          <ol>
            {selectedNotes.map((note) => (
              <li key={note.id}>{note.title}</li>
            ))}
          </ol>
        )}
      </div>

      <div className="recall-session-setup__actions">
        <button className="notes-action" onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          aria-describedby={
            disabledStartReason === null ? undefined : "recall-start-reason"
          }
          className="notes-action notes-action-primary"
          disabled={disabledStartReason !== null}
          onClick={onStartRecall}
          type="button"
        >
          Start recall
        </button>
      </div>

      {disabledStartReason !== null ? (
        <p className="muted" id="recall-start-reason">
          {disabledStartReason}
        </p>
      ) : null}
    </aside>
  );
}
