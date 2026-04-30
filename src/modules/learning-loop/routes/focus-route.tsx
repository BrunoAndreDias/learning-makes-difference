import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useSyncExternalStore } from "react";

import type { FocusRecord, FocusSession, FocusTarget } from "../domain/focus";

export const Route = createFileRoute("/_protected/focus")({
  component: FocusPage,
});

function FocusPage() {
  const focus = Route.useRouteContext({
    select: (context) => context.focus,
  });
  const session = Route.useRouteContext({
    select: (context) => context.session,
  });

  useSyncExternalStore(focus.subscribe, focus.getSnapshot, focus.getSnapshot);
  useSyncExternalStore(
    focus.subscribe,
    focus.getRecordSnapshot,
    focus.getRecordSnapshot,
  );
  const sessionSnapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const activeSession =
    userId === null ? null : focus.getActiveSession({ userId });
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const records =
    userId === null
      ? []
      : [...focus.getFocusRecords({ userId })].sort(
          (left, right) => Date.parse(right.endedAt) - Date.parse(left.endedAt),
        );
  const recentRecords = records.slice(0, 7);
  const recentFocusMinutes = recentRecords.reduce(
    (total, record) =>
      total + record.completedFocusIntervalCount * record.focusIntervalMinutes,
    0,
  );
  const recentBreakMinutes = recentRecords.reduce(
    (total, record) =>
      total + record.completedBreakIntervalCount * record.breakIntervalMinutes,
    0,
  );

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="settings-layout">
      <article className="card stack panel-protected">
        <p className="section-label">Focus review</p>
        <h3 ref={headingRef} tabIndex={-1}>
          Focus records
        </h3>
        <p>Review completed FocusRecords and recent completed-focus totals.</p>
        <div className="tag-row">
          <span className="tag">Read-only v1</span>
          <span className="tag">{records.length} completed records</span>
          <span className="tag">
            {recentFocusMinutes} focused minutes recent
          </span>
        </div>
        {activeSession === null ? null : (
          <p className="muted">
            Active session: {getActiveSessionSummary(activeSession)}
          </p>
        )}
      </article>

      <div className="placeholder-grid settings-grid">
        <article className="card stack">
          <p className="section-label">Recent completed focus</p>
          <dl className="settings-summary" aria-label="Recent completed focus">
            <div>
              <dt>Focus time</dt>
              <dd>{recentFocusMinutes} minutes</dd>
            </div>
            <div>
              <dt>Break time</dt>
              <dd>{recentBreakMinutes} minutes</dd>
            </div>
            <div>
              <dt>Completed records</dt>
              <dd>{recentRecords.length}</dd>
            </div>
          </dl>
        </article>

        <article className="card stack">
          <p className="section-label">History mode</p>
          <p>
            FocusRecords are read-only in v1. Use the global control to run
            sessions.
          </p>
        </article>
      </div>

      <section aria-label="Completed FocusRecords" className="labels-list">
        {records.length === 0 ? (
          <article className="card stack">
            <p className="section-label">No completed focus yet</p>
            <p>Complete a FocusSession to review it here.</p>
          </article>
        ) : (
          records.map((record) => {
            const targetDescriptions = getTargetDescriptions(record);

            return (
              <article className="card stack" key={record.id}>
                <p className="section-label">Completed {record.endedAt}</p>
                <h4>{getPrimaryMetricLabel(record)}</h4>
                <dl
                  className="settings-summary"
                  aria-label={`Focus record ${record.id}`}
                >
                  <div>
                    <dt>Break detail</dt>
                    <dd>{getBreakMetricLabel(record)}</dd>
                  </div>
                  <div>
                    <dt>Targets</dt>
                    <dd>{targetDescriptions.length}</dd>
                  </div>
                  <div>
                    <dt>Method</dt>
                    <dd>{record.method}</dd>
                  </div>
                </dl>
                <ul
                  className="placeholder-list"
                  aria-label={`Touched targets for ${record.id}`}
                >
                  {targetDescriptions.map((target) => (
                    <li key={target}>{target}</li>
                  ))}
                </ul>
              </article>
            );
          })
        )}
      </section>
    </section>
  );
}

function getPrimaryMetricLabel(record: FocusRecord) {
  const focusMinutes =
    record.completedFocusIntervalCount * record.focusIntervalMinutes;

  return `${focusMinutes} minutes focused`;
}

function getBreakMetricLabel(record: FocusRecord) {
  const breakMinutes =
    record.completedBreakIntervalCount * record.breakIntervalMinutes;
  const intervalLabel =
    record.completedBreakIntervalCount === 1 ? "break" : "breaks";

  return `${record.completedBreakIntervalCount} ${intervalLabel}, ${breakMinutes} minutes`;
}

function getActiveSessionSummary(session: FocusSession) {
  if (session.intervalState === "Focus") {
    return `${session.remainingSeconds ?? 0}s left in focus`;
  }

  if (session.intervalState === "Break") {
    return `${session.remainingSeconds ?? 0}s left in break`;
  }

  if (session.intervalState === "Transition") {
    return `${session.remainingSeconds ?? 0}s left in transition`;
  }

  return session.isStale ? "stale" : "ready for next focus";
}

function getTargetDescriptions(record: FocusRecord) {
  return [...record.targets, ...record.focusTargets].map(describeTarget);
}

function describeTarget(target: FocusTarget) {
  if (target.kind === "RecallSession") {
    const noteTitles = target.notes.map((note) => note.title).join(", ");
    const labelNames =
      target.labels.length === 0
        ? "no labels"
        : target.labels.map((label) => label.name).join(", ");

    return `RecallSession: ${target.recallSession.mode} | Notes: ${noteTitles} | Labels: ${labelNames}`;
  }

  if (target.labels.length === 0) {
    return `Note: ${target.note.title} | Unlabeled note work`;
  }

  return `Note: ${target.note.title} | Labels: ${target.labels
    .map((label) => label.name)
    .join(", ")}`;
}
