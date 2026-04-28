import {
  Link,
  Outlet,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useState, useSyncExternalStore } from "react";

import type { AppSessionSnapshot } from "../../../features/session/session";
import { listNotesForUser } from "../domain/notes";
import {
  filterNotesByQuery,
  searchNoteResults,
  type AppNoteSearchResult,
} from "../domain/note-search";
import {
  AppRecallError,
  type FlashCardSessionResult,
  summarizeAttempts,
} from "../domain/recall";

function formatCompletedAt(timestamp: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

function formatAttemptCount(count: number) {
  return `${count} attempted ${count === 1 ? "question" : "questions"}`;
}

function formatNoteDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatSelectedCount(count: number) {
  return `${count} ${count === 1 ? "note" : "notes"} selected`;
}

function getSearchResultLabel(result: AppNoteSearchResult) {
  return `${result.note.title} ${result.matchChip} Updated ${formatNoteDate(result.note.updatedAt)}`;
}

export function RecallRouteShell() {
  return <Outlet />;
}

function StartRecallCard({
  hasRecallableNotes,
}: {
  hasRecallableNotes: boolean;
}) {
  if (!hasRecallableNotes) {
    return (
      <article className="card stack">
        <p className="section-label">Start</p>
        <h4>Start Recall</h4>
        <p>Create notes first, then start your first recall session.</p>
        <Link className="notes-action notes-action-primary" to="/notes">
          Go to Notes
        </Link>
      </article>
    );
  }

  return (
    <article className="card stack">
      <p className="section-label">Start</p>
      <h4>Start Recall</h4>
      <p>
        Open the new Recall route flow and choose the notes for your next
        session.
      </p>
      <Link className="notes-action notes-action-primary" to="/recall/select">
        Start Recall
      </Link>
    </article>
  );
}

function RecentResultsPreview({
  hasRecallableNotes,
  recentResults,
}: {
  hasRecallableNotes: boolean;
  recentResults: FlashCardSessionResult[];
}) {
  if (!hasRecallableNotes) {
    return (
      <article className="card stack">
        <p className="section-label">Recent Results</p>
        <h4>No notes yet</h4>
        <p className="muted">
          Create notes first, then come back to start recall.
        </p>
        <Link className="notes-action" to="/notes">
          Go to Notes
        </Link>
      </article>
    );
  }

  if (recentResults.length === 0) {
    return (
      <article className="card stack">
        <p className="section-label">Recent Results</p>
        <h4>No recent results yet</h4>
        <p className="muted">
          Your completed and attempted recall sessions will appear here.
        </p>
      </article>
    );
  }

  return (
    <article className="card stack">
      <p className="section-label">Recent Results</p>
      <div className="stack">
        {recentResults.map((result) => {
          const summary = summarizeAttempts(result.attempts);

          return (
            <article className="recall-session-card stack" key={result.id}>
              <p className="section-label">{result.labelName}</p>
              <p>{formatCompletedAt(result.completedAt)}</p>
              <div className="tag-row">
                <span className="tag">
                  {formatAttemptCount(result.attempts.length)}
                </span>
              </div>
              <p className="muted">
                Nailed {summary.nailed} · Partial {summary.partial} · Missed{" "}
                {summary.missed}
              </p>
            </article>
          );
        })}
      </div>
    </article>
  );
}

export function RecallHomePage() {
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
  useSyncExternalStore(
    recallContext.subscribe,
    recallContext.getSessionResultsSnapshot,
    recallContext.getSessionResultsSnapshot,
  );
  const notesSnapshot = useSyncExternalStore(
    notesContext.subscribe,
    notesContext.getSnapshot,
    notesContext.getSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const notes = listNotesForUser(notesSnapshot, userId);
  const hasRecallableNotes = notes.length > 0;
  const recentResults =
    userId === null
      ? []
      : recallContext.listSessionResults({ userId }).slice(0, 3);

  return (
    <section className="recall-page">
      <article className="card stack panel-protected">
        <p className="section-label">Recall</p>
        <h3>Recall</h3>
        <p>Start recall, review results, and pick up your latest study work.</p>
        <div className="tag-row">
          <span className="tag">Primary section</span>
          <span className="tag">Start recall</span>
          <span className="tag">Recent results</span>
        </div>
      </article>

      <div className="placeholder-grid recall-layout">
        <StartRecallCard hasRecallableNotes={hasRecallableNotes} />

        <article className="card stack">
          <p className="section-label">Review</p>
          <h4>Results</h4>
          <p>Inspect completed sessions by session or by note.</p>
          <Link className="notes-action" to="/recall/results">
            Open Results
          </Link>
        </article>

        <RecentResultsPreview
          hasRecallableNotes={hasRecallableNotes}
          recentResults={recentResults}
        />
      </div>
    </section>
  );
}

export function RecallSelectionPage() {
  const navigate = useNavigate();
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const filteredNotes = filterNotesByQuery(notes, searchQuery);
  const searchResults = searchNoteResults(notes, searchQuery);
  const selectedCountLabel = formatSelectedCount(selectedNoteIds.length);
  const hasSearchQuery = searchQuery.trim().length > 0;
  const selectedNoteIdSet = new Set(selectedNoteIds);

  function toggleSelectedNote(noteId: string) {
    setSelectedNoteIds((currentNoteIds) =>
      currentNoteIds.includes(noteId)
        ? currentNoteIds.filter((currentNoteId) => currentNoteId !== noteId)
        : [...currentNoteIds, noteId],
    );
    setErrorMessage(null);
  }

  async function handleCancel() {
    setSelectedNoteIds([]);
    setSearchQuery("");
    setErrorMessage(null);
    await navigate({ to: "/recall" });
  }

  async function handleStartRecall() {
    if (userId === null || selectedNoteIds.length === 0) {
      return;
    }

    try {
      recallContext.startFlashCardSession({
        noteIds: selectedNoteIds,
        userId,
      });
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

  if (notes.length === 0) {
    return (
      <section className="recall-page">
        <article className="card stack panel-protected">
          <p className="section-label">Recall</p>
          <h3>Select Notes</h3>
          <p>Create notes first, then come back to build a recall session.</p>
          <Link className="notes-action notes-action-primary" to="/notes">
            Go to Notes
          </Link>
        </article>
      </section>
    );
  }

  return (
    <section className="recall-page">
      <article className="card stack panel-protected">
        <p className="section-label">Recall</p>
        <h3>Select Notes</h3>
        <p>
          Search recallable notes, toggle the ones you want, then start a
          focused session without opening the editor.
        </p>
        <div className="tag-row">
          <span className="tag">Dedicated selection mode</span>
          <span className="tag">{selectedCountLabel}</span>
        </div>
      </article>

      <div className="placeholder-grid recall-layout recall-selection-layout">
        <article className="card stack">
          <div className="notes-list__header">
            <div className="stack">
              <p className="section-label">Search</p>
              <h4>Find recall targets</h4>
              <p className="muted">
                Search titles, bodies, metaphors, and acronyms. Selecting a
                match toggles the owning note.
              </p>
            </div>
            <fieldset
              aria-label="Recall selection controls"
              className="tag-row recall-selection-controls"
            >
              <span className="tag">{selectedCountLabel}</span>
              <button
                className="notes-action"
                onClick={() => void handleCancel()}
                type="button"
              >
                Cancel
              </button>
              <button
                className="notes-action notes-action-primary"
                disabled={selectedNoteIds.length === 0}
                onClick={() => void handleStartRecall()}
                type="button"
              >
                Start recall
              </button>
            </fieldset>
          </div>

          <label className="notes-form__field">
            <span>Search notes</span>
            <input
              aria-label="Search notes"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search notes"
              type="search"
              value={searchQuery}
            />
          </label>

          {hasSearchQuery ? (
            searchResults.length === 0 ? (
              <p className="notes-search__empty" role="status">
                No notes found
              </p>
            ) : (
              <div
                aria-label="Recall selection matches"
                className="notes-search__results"
                role="listbox"
              >
                {searchResults.map((result) => (
                  <button
                    aria-label={getSearchResultLabel(result)}
                    aria-selected={selectedNoteIdSet.has(result.note.id)}
                    className="notes-search__option"
                    key={`${result.note.id}-${result.matchChip}`}
                    onClick={() => toggleSelectedNote(result.note.id)}
                    role="option"
                    type="button"
                  >
                    <span className="notes-search__option-title">
                      <strong>{result.note.title}</strong>
                      <span className="notes-search__match-chip">
                        {result.matchChip}
                      </span>
                    </span>
                    <span>{`Updated ${formatNoteDate(result.note.updatedAt)}`}</span>
                  </button>
                ))}
              </div>
            )
          ) : null}
        </article>

        <article className="card stack">
          <div className="notes-list__header">
            <div className="stack">
              <p className="section-label">Notes</p>
              <h4>Selectable notes</h4>
            </div>
            <span className="tag">{`${filteredNotes.length} shown`}</span>
          </div>
          <ul aria-label="Recallable notes" className="notes-list__items">
            {filteredNotes.map((note) => {
              const isSelected = selectedNoteIdSet.has(note.id);

              return (
                <li key={note.id}>
                  <button
                    aria-pressed={isSelected}
                    className="notes-list__item"
                    data-active={isSelected ? "true" : undefined}
                    onClick={() => toggleSelectedNote(note.id)}
                    type="button"
                  >
                    <strong>{note.title}</strong>
                    <span>{note.body}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </article>
      </div>

      {errorMessage !== null ? (
        <p className="auth-form__error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
