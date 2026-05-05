import { createFileRoute } from "@tanstack/react-router";
import {
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { formatCount } from "../../lib/format-count";
import {
  type AppFocusContext,
  AppFocusError,
  type FocusRecord,
  type FocusSession,
  type FocusTarget,
} from "./focus";
import { useFocusTimerTick } from "./focus-session-start-control";
import { formatFocusTargetKindLabel } from "./learner-copy";
import type { AppPersistentFocusContext } from "./persistent-focus";

type FocusSessionStartValues = {
  breakMinutes: string;
  focusMinutes: string;
  plannedFocusIntervals: string;
};

type FocusSessionStartField = keyof FocusSessionStartValues;

const DEFAULT_FOCUS_SESSION_START_VALUES: FocusSessionStartValues = {
  breakMinutes: "5",
  focusMinutes: "25",
  plannedFocusIntervals: "4",
};
const FOCUS_RECORD_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  year: "numeric",
});

export const Route = createFileRoute("/_protected/focus")({
  component: FocusPage,
});

function FocusPage() {
  const focus = Route.useRouteContext({
    select: (context) => context.focus,
  });
  const persistentFocus = Route.useRouteContext({
    select: (context) => context.persistentFocus,
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
  useFocusTimerTick(activeSession);
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
    <section
      aria-labelledby="focus-records-heading"
      className="focus-workspace"
    >
      <header className="focus-page-header">
        <p className="section-label">Focus</p>
        <h3 id="focus-records-heading" ref={headingRef} tabIndex={-1}>
          Study sessions
        </h3>
        <p>Run a Pomodoro session to stay focused and make steady progress.</p>
      </header>

      <section className="focus-session-workspace">
        <ActiveFocusSessionPanel
          activeSession={activeSession}
          focus={focus}
          persistentFocus={persistentFocus}
          userId={userId}
        />
        <FocusSessionConfig
          activeSession={activeSession}
          focus={focus}
          persistentFocus={persistentFocus}
          userId={userId}
        />
      </section>

      <div className="focus-grid">
        <article className="focus-card focus-summary-card">
          <div className="focus-card__header">
            <div>
              <p className="section-label">Recent study time</p>
              <strong className="focus-card-title">Last 7 sessions</strong>
            </div>
          </div>
          <dl className="focus-metrics" aria-label="Recent study time">
            <div>
              <dt>Focus time</dt>
              <dd>{recentFocusMinutes} minutes</dd>
            </div>
            <div>
              <dt>Break time</dt>
              <dd>{recentBreakMinutes} minutes</dd>
            </div>
            <div>
              <dt>Completed sessions</dt>
              <dd>{recentRecords.length}</dd>
            </div>
          </dl>
        </article>

        <article className="focus-card focus-card--quiet">
          <p className="section-label">How capture works</p>
          <p>
            Study sessions stay read-only in v1. Notes and Recall activity
            attach to a running focus block automatically, so session history
            stays useful without extra logging.
          </p>
        </article>
      </div>

      <section aria-label="Completed study sessions" className="focus-records">
        <div className="focus-section-heading">
          <div>
            <p className="section-label">History</p>
            <strong className="focus-card-title">
              Completed study sessions
            </strong>
          </div>
          <span className="tag">{records.length} total</span>
        </div>
        {records.length === 0 ? (
          <article className="focus-empty-state">
            <p className="section-label">No completed sessions yet</p>
            <strong className="focus-card-title">
              Finish your first session
            </strong>
            <p>
              Completed sessions will appear here with captured study targets.
            </p>
          </article>
        ) : (
          records.map((record) => {
            const targetDescriptions = getTargetDescriptions(record);

            return (
              <article className="focus-record-card" key={record.id}>
                <div className="focus-record-card__header">
                  <div>
                    <p className="section-label">Completed</p>
                    <h4>{getPrimaryMetricLabel(record)}</h4>
                  </div>
                  <time dateTime={record.endedAt}>
                    {formatFocusRecordDate(record.endedAt)}
                  </time>
                </div>
                <dl
                  className="focus-metrics"
                  aria-label={`Study session ${record.id}`}
                >
                  <div>
                    <dt>Breaks</dt>
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
                {targetDescriptions.length === 0 ? (
                  <p className="muted">No study targets captured.</p>
                ) : (
                  <ul
                    className="focus-target-list"
                    aria-label={`Touched targets for ${record.id}`}
                  >
                    {targetDescriptions.map((target) => (
                      <li key={target}>{target}</li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })
        )}
      </section>
    </section>
  );
}

function ActiveFocusSessionPanel({
  activeSession,
  focus,
  persistentFocus,
  userId,
}: Readonly<{
  activeSession: FocusSession | null;
  focus: AppFocusContext;
  persistentFocus?: AppPersistentFocusContext;
  userId: string | null;
}>) {
  const headingId = useId();
  const currentActiveSession =
    userId === null ? activeSession : focus.getActiveSession({ userId });

  async function endFocusSession() {
    if (userId === null || currentActiveSession === null) {
      return;
    }

    if (persistentFocus === undefined) {
      focus.endFocusSession({ userId });
      return;
    }

    await persistentFocus.endFocusSession(userId);
  }

  async function advanceFocusSession() {
    if (userId === null || currentActiveSession === null) {
      return;
    }

    if (persistentFocus === undefined) {
      focus.startNextFocusInterval({ userId });
      return;
    }

    await persistentFocus.startNextFocusInterval(userId);
  }

  const sessionStatus = getFocusSessionStatus(currentActiveSession);

  return (
    <section aria-label="Active focus session" className="focus-session-panel">
      <div className="focus-session-panel__header">
        <div>
          <p className="section-label">Active session</p>
          <h4 id={headingId}>Focus session</h4>
        </div>
        <span className="focus-session-panel__status">
          {sessionStatus.label}
        </span>
      </div>

      {currentActiveSession === null ? (
        <>
          <div className="focus-session-panel__timer">
            <strong>--:--</strong>
            <span>Start a session from setup when you are ready.</span>
          </div>
          <dl
            aria-label="Current session details"
            className="focus-session-panel__stats"
          >
            <div>
              <dt>Focus</dt>
              <dd>25 min</dd>
            </div>
            <div>
              <dt>Break</dt>
              <dd>5 min</dd>
            </div>
            <div>
              <dt>Intervals</dt>
              <dd>4</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>0 / 4</dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          <div className="focus-session-panel__timer">
            <strong>{getRemainingTimerLabel(currentActiveSession)}</strong>
            <span>{getActiveTimerDescription(currentActiveSession)}</span>
          </div>
          <div className="focus-session-panel__actions">
            <button
              className="notes-action notes-action-primary"
              onClick={() => {
                void endFocusSession();
              }}
              type="button"
            >
              End focus session
            </button>
            {sessionStatus.actionLabel === null ? null : (
              <button
                className="notes-action"
                onClick={() => {
                  void advanceFocusSession();
                }}
                type="button"
              >
                {sessionStatus.actionLabel}
              </button>
            )}
          </div>
          <dl
            aria-label="Current session details"
            className="focus-session-panel__stats"
          >
            <div>
              <dt>Focus</dt>
              <dd>{currentActiveSession.focusIntervalMinutes} min</dd>
            </div>
            <div>
              <dt>Break</dt>
              <dd>{currentActiveSession.breakIntervalMinutes} min</dd>
            </div>
            <div>
              <dt>Intervals</dt>
              <dd>{getPlannedIntervalsLabel(currentActiveSession)}</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>{getCompletedIntervalsLabel(currentActiveSession)}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}

function FocusSessionConfig({
  activeSession,
  focus,
  persistentFocus,
  userId,
}: Readonly<{
  activeSession: FocusSession | null;
  focus: AppFocusContext;
  persistentFocus?: AppPersistentFocusContext;
  userId: string | null;
}>) {
  const [startValues, setStartValues] = useState<FocusSessionStartValues>(
    DEFAULT_FOCUS_SESSION_START_VALUES,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorId = useId();
  const currentActiveSession =
    userId === null ? activeSession : focus.getActiveSession({ userId });

  function updateStartValue(field: FocusSessionStartField, value: string) {
    setStartValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (userId === null || currentActiveSession !== null) {
      return;
    }

    try {
      if (persistentFocus === undefined) {
        focus.startFocusSession({
          breakIntervalMinutes: Number(startValues.breakMinutes),
          focusIntervalMinutes: Number(startValues.focusMinutes),
          plannedFocusIntervalCount: parseOptionalNumber(
            startValues.plannedFocusIntervals,
          ),
          userId,
        });
      } else {
        await persistentFocus.startFocusSession(userId, {
          breakIntervalMinutes: Number(startValues.breakMinutes),
          focusIntervalMinutes: Number(startValues.focusMinutes),
          plannedFocusIntervalCount: parseOptionalNumber(
            startValues.plannedFocusIntervals,
          ),
        });
      }
      setErrorMessage(null);
      setStartValues(DEFAULT_FOCUS_SESSION_START_VALUES);
    } catch (error) {
      if (error instanceof AppFocusError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  function handleReset() {
    setStartValues(DEFAULT_FOCUS_SESSION_START_VALUES);
    setErrorMessage(null);
  }

  return (
    <article className="focus-card focus-card--setup">
      <div className="focus-card__header">
        <div>
          <p className="section-label">Session setup</p>
          <strong className="focus-card-title">Session setup</strong>
        </div>
      </div>
      <form
        aria-describedby={errorMessage === null ? undefined : errorId}
        aria-label="Session setup"
        className="focus-config-form"
        onSubmit={handleSubmit}
      >
        <div className="focus-config-form__fields">
          <label>
            <span>Focus minutes</span>
            <input
              disabled={currentActiveSession !== null}
              inputMode="numeric"
              min="1"
              onChange={(event) =>
                updateStartValue("focusMinutes", event.target.value)
              }
              type="number"
              value={startValues.focusMinutes}
            />
          </label>
          <label>
            <span>Break minutes</span>
            <input
              disabled={currentActiveSession !== null}
              inputMode="numeric"
              min="0"
              onChange={(event) =>
                updateStartValue("breakMinutes", event.target.value)
              }
              type="number"
              value={startValues.breakMinutes}
            />
          </label>
          <label>
            <span>Planned intervals</span>
            <input
              disabled={currentActiveSession !== null}
              inputMode="numeric"
              min="1"
              onChange={(event) =>
                updateStartValue("plannedFocusIntervals", event.target.value)
              }
              type="number"
              value={startValues.plannedFocusIntervals}
            />
          </label>
        </div>
        <p className="focus-setup-note">
          {currentActiveSession === null
            ? "Changes apply to your next session."
            : "Changes apply to your next session. Setup is locked while focus is active."}
        </p>
        <div className="focus-config-form__actions">
          <button
            className="notes-action notes-action-primary"
            disabled={currentActiveSession !== null}
            type="submit"
          >
            Start focus session
          </button>
          <button
            className="notes-action"
            disabled={currentActiveSession !== null}
            onClick={handleReset}
            type="button"
          >
            Reset to defaults
          </button>
        </div>
        {errorMessage === null ? null : (
          <span id={errorId} role="alert">
            {errorMessage}
          </span>
        )}
      </form>
    </article>
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
  const intervalLabel = formatCount(
    record.completedBreakIntervalCount,
    "break",
  );

  return `${intervalLabel}, ${breakMinutes} minutes`;
}

function getFocusSessionStatus(session: FocusSession | null) {
  if (session === null) {
    return {
      actionLabel: null,
      label: "Ready",
    };
  }

  if (session.isStale) {
    return {
      actionLabel: null,
      label: "Session stale",
    };
  }

  switch (session.intervalState) {
    case "Focus":
      return {
        actionLabel: null,
        label: "In progress",
      };
    case "Transition":
      return {
        actionLabel: "Keep focusing",
        label: "Transition window",
      };
    case "Break":
      return {
        actionLabel: "Skip break",
        label: "Break",
      };
    case "AwaitingNextFocus":
      return {
        actionLabel: "Start next focus",
        label: "Ready for next focus",
      };
  }
}

function getActiveTimerDescription(session: FocusSession) {
  switch (session.intervalState) {
    case "Focus":
      return "Focus time remaining";
    case "Transition":
      return "Time left to keep focusing before break starts";
    case "Break":
      return "Break time remaining";
    case "AwaitingNextFocus":
      return session.isStale
        ? "This session is stale and should be ended."
        : "Break complete. Start the next focus interval when ready.";
  }
}

function getPlannedIntervalsLabel(session: FocusSession) {
  if (session.plannedFocusIntervalCount === null) {
    return "Open";
  }

  return String(session.plannedFocusIntervalCount);
}

function getCompletedIntervalsLabel(session: FocusSession) {
  if (session.plannedFocusIntervalCount === null) {
    return String(session.completedFocusIntervalCount);
  }

  return `${session.completedFocusIntervalCount} / ${session.plannedFocusIntervalCount}`;
}

function getRemainingTimerLabel(session: FocusSession) {
  const remainingSeconds = session.remainingSeconds ?? 0;
  const normalizedSeconds = remainingSeconds <= 0 ? 0 : remainingSeconds;
  const minutes = Math.floor(normalizedSeconds / 60);
  const seconds = normalizedSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function getTargetDescriptions(record: FocusRecord) {
  return Array.from(
    new Set([...record.targets, ...record.focusTargets].map(describeTarget)),
  );
}

function formatFocusRecordDate(value: string) {
  return FOCUS_RECORD_DATE_FORMATTER.format(new Date(value));
}

function describeTarget(target: FocusTarget) {
  if (target.kind === "RecallSession") {
    const noteTitles = target.notes.map((note) => note.title).join(", ");
    const labelNames = formatFocusTargetLabels(target.labels);

    return `${formatFocusTargetKindLabel(target.kind)}: ${noteTitles} | Labels: ${labelNames}`;
  }

  if (target.labels.length === 0) {
    return `Note study: ${target.note.title} | No labels yet`;
  }

  return `Note study: ${target.note.title} | Labels: ${target.labels
    .map((label) => label.name)
    .join(", ")}`;
}

function formatFocusTargetLabels(labels: FocusTarget["labels"]) {
  if (labels.length === 0) {
    return "no labels";
  }

  return labels.map((label) => label.name).join(", ");
}

function parseOptionalNumber(value: string) {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  return Number(trimmedValue);
}
