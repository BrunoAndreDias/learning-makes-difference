import { Link, Outlet, useRouteContext } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";

import type { AppSessionSnapshot } from "../../../features/session/session";
import { listNotesForUser } from "../domain/notes";
import { summarizeAttempts } from "../domain/recall";

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

export function RecallRouteShell() {
  return <Outlet />;
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
        <article className="card stack">
          <p className="section-label">Start</p>
          <h4>Start Recall</h4>
          {hasRecallableNotes ? (
            <>
              <p>
                Open the new Recall route flow and choose the notes for your
                next session.
              </p>
              <Link
                className="notes-action notes-action-primary"
                to="/recall/select"
              >
                Start Recall
              </Link>
            </>
          ) : (
            <>
              <p>Create notes first, then start your first recall session.</p>
              <Link
                className="notes-action notes-action-primary"
                to="/notes"
              >
                Go to Notes
              </Link>
            </>
          )}
        </article>

        <article className="card stack">
          <p className="section-label">Review</p>
          <h4>Results</h4>
          <p>Inspect completed sessions by session or by note.</p>
          <Link className="notes-action" to="/recall/results">
            Open Results
          </Link>
        </article>

        <article className="card stack">
          <p className="section-label">Recent Results</p>
          {notes.length === 0 ? (
            <>
              <h4>No notes yet</h4>
              <p className="muted">
                Create notes first, then come back to start recall.
              </p>
              <Link className="notes-action" to="/notes">
                Go to Notes
              </Link>
            </>
          ) : recentResults.length === 0 ? (
            <>
              <h4>No recent results yet</h4>
              <p className="muted">
                Your completed and attempted recall sessions will appear here.
              </p>
            </>
          ) : (
            <div className="stack">
              {recentResults.map((result) => {
                const summary = summarizeAttempts(result.attempts);

                return (
                  <article
                    className="recall-session-card stack"
                    key={result.id}
                  >
                    <p className="section-label">{result.labelName}</p>
                    <p>{formatCompletedAt(result.completedAt)}</p>
                    <div className="tag-row">
                      <span className="tag">
                        {formatAttemptCount(result.attempts.length)}
                      </span>
                    </div>
                    <p className="muted">
                      Nailed {summary.nailed} · Partial {summary.partial} ·
                      Missed {summary.missed}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

export function RecallSelectionPage() {
  return (
    <section className="recall-page">
      <article className="card stack panel-protected">
        <p className="section-label">Recall</p>
        <h3>Select Notes</h3>
        <p>
          Recall now owns this route. Full selection mode lands in a follow-up
          issue.
        </p>
        <div className="tag-row">
          <span className="tag">Route shell ready</span>
          <span className="tag">Selection next</span>
        </div>
        <Link className="notes-action" to="/notes">
          Open Notes for now
        </Link>
      </article>
    </section>
  );
}
