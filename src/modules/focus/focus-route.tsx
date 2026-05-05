import { createFileRoute } from "@tanstack/react-router";
import {
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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

type FocusSessionStartInput = {
  breakIntervalMinutes: number;
  focusIntervalMinutes: number;
  plannedFocusIntervalCount: number | null;
};

type FocusSessionPanelStat = {
  label: string;
  value: string;
};

type FocusSessionPanelDetails = {
  description: string;
  stats: readonly FocusSessionPanelStat[];
  timerLabel: string;
};

type RecentFocusTargetSummary = {
  context: string;
  key: string;
  kindLabel: string;
  title: string;
};

const DEFAULT_BREAK_MINUTES = "5";
const DEFAULT_FOCUS_MINUTES = "25";
const DEFAULT_PLANNED_FOCUS_INTERVALS = "4";
const DEFAULT_FOCUS_SESSION_START_VALUES: FocusSessionStartValues = {
  breakMinutes: DEFAULT_BREAK_MINUTES,
  focusMinutes: DEFAULT_FOCUS_MINUTES,
  plannedFocusIntervals: DEFAULT_PLANNED_FOCUS_INTERVALS,
};
const FOCUS_RECORD_TABLE_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
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
  const recentFocusTargets = getRecentFocusTargetSummaries(recentRecords);
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

        <section
          aria-label="Recent focus targets"
          className="focus-card focus-card--quiet"
        >
          <div className="focus-card__header">
            <div>
              <p className="section-label">Recent targets</p>
              <strong className="focus-card-title">Recent focus targets</strong>
            </div>
          </div>
          {recentFocusTargets.length === 0 ? (
            <p>
              Touch notes or recall during focus sessions to build recent target
              context here.
            </p>
          ) : (
            <ul className="focus-target-panel-list">
              {recentFocusTargets.map((target) => (
                <li key={target.key}>
                  <span className="focus-target-panel-list__kind">
                    {target.kindLabel}
                  </span>
                  <strong>{target.title}</strong>
                  <span>{target.context}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
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
              Completed sessions will appear here with proven focus duration,
              touched targets, and completion status.
            </p>
          </article>
        ) : (
          <div className="focus-records-table-wrapper">
            <table
              aria-label="Recent focus sessions"
              className="focus-records-table"
            >
              <thead>
                <tr>
                  <th scope="col">Completed</th>
                  <th scope="col">Focus duration</th>
                  <th scope="col">Focus intervals</th>
                  <th scope="col">Touched targets</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <time dateTime={record.endedAt}>
                        {formatRecentFocusRecordDate(record.endedAt)}
                      </time>
                    </td>
                    <td>{getPrimaryMetricLabel(record)}</td>
                    <td>{getCompletedFocusIntervalsLabel(record)}</td>
                    <td>{getTouchedTargetsLabel(record)}</td>
                    <td>Completed</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  const sessionStatus = getFocusSessionStatus(activeSession);
  const sessionDetails = getFocusSessionPanelDetails(activeSession);

  async function handleEndFocusSession() {
    if (userId === null || activeSession === null) {
      return;
    }

    if (persistentFocus === undefined) {
      focus.endFocusSession({ userId });
      return;
    }

    await persistentFocus.endFocusSession(userId);
  }

  async function handleAdvanceFocusSession() {
    if (userId === null || activeSession === null) {
      return;
    }

    if (persistentFocus === undefined) {
      focus.startNextFocusInterval({ userId });
      return;
    }

    await persistentFocus.startNextFocusInterval(userId);
  }

  return (
    <section aria-label="Active focus session" className="focus-session-panel">
      <div className="focus-session-panel__header">
        <div>
          <p className="section-label">Active session</p>
          <h4>Focus session</h4>
        </div>
        <span className="focus-session-panel__status">
          {sessionStatus.label}
        </span>
      </div>

      <div className="focus-session-panel__timer">
        <strong>{sessionDetails.timerLabel}</strong>
        <span>{sessionDetails.description}</span>
      </div>
      {activeSession === null ? null : (
        <div className="focus-session-panel__actions">
          <button
            className="notes-action notes-action-primary"
            onClick={() => {
              void handleEndFocusSession();
            }}
            type="button"
          >
            End focus session
          </button>
          {sessionStatus.actionLabel === null ? null : (
            <button
              className="notes-action"
              onClick={() => {
                void handleAdvanceFocusSession();
              }}
              type="button"
            >
              {sessionStatus.actionLabel}
            </button>
          )}
        </div>
      )}
      <FocusSessionStats stats={sessionDetails.stats} />
    </section>
  );
}

function FocusSessionStats({
  stats,
}: Readonly<{
  stats: readonly FocusSessionPanelStat[];
}>) {
  return (
    <dl
      aria-label="Current session details"
      className="focus-session-panel__stats"
    >
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt>{stat.label}</dt>
          <dd>{stat.value}</dd>
        </div>
      ))}
    </dl>
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
  const isFocusSessionActive = activeSession !== null;
  const setupNote = isFocusSessionActive
    ? "Changes apply to your next session. Setup is locked while focus is active."
    : "Changes apply to your next session.";

  function updateStartValue(field: FocusSessionStartField, value: string) {
    setStartValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (userId === null || isFocusSessionActive) {
      return;
    }

    try {
      const nextSessionInput = getFocusSessionStartInput(startValues);

      if (persistentFocus === undefined) {
        focus.startFocusSession({
          ...nextSessionInput,
          userId,
        });
      } else {
        await persistentFocus.startFocusSession(userId, nextSessionInput);
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
              disabled={isFocusSessionActive}
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
              disabled={isFocusSessionActive}
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
              disabled={isFocusSessionActive}
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
        <p className="focus-setup-note">{setupNote}</p>
        <div className="focus-config-form__actions">
          <button
            className="notes-action notes-action-primary"
            disabled={isFocusSessionActive}
            type="submit"
          >
            Start focus session
          </button>
          <button
            className="notes-action"
            disabled={isFocusSessionActive}
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

  return `${focusMinutes} minutes`;
}

function getCompletedFocusIntervalsLabel(record: FocusRecord) {
  return `${record.completedFocusIntervalCount} completed`;
}

function getTouchedTargetsLabel(record: FocusRecord) {
  return `${getTargetDescriptions(record).length} touched`;
}

function getFocusSessionPanelDetails(
  session: FocusSession | null,
): FocusSessionPanelDetails {
  if (session === null) {
    return {
      description: "Start a session from setup when you are ready.",
      stats: [
        {
          label: "Focus",
          value: `${DEFAULT_FOCUS_MINUTES} min`,
        },
        {
          label: "Break",
          value: `${DEFAULT_BREAK_MINUTES} min`,
        },
        {
          label: "Intervals",
          value: DEFAULT_PLANNED_FOCUS_INTERVALS,
        },
        {
          label: "Completed",
          value: `0 / ${DEFAULT_PLANNED_FOCUS_INTERVALS}`,
        },
      ],
      timerLabel: "--:--",
    };
  }

  return {
    description: getActiveTimerDescription(session),
    stats: [
      {
        label: "Focus",
        value: `${session.focusIntervalMinutes} min`,
      },
      {
        label: "Break",
        value: `${session.breakIntervalMinutes} min`,
      },
      {
        label: "Intervals",
        value: getPlannedIntervalsLabel(session),
      },
      {
        label: "Completed",
        value: getCompletedIntervalsLabel(session),
      },
    ],
    timerLabel: getRemainingTimerLabel(session),
  };
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
      if (session.isStale) {
        return "This session is stale and should be ended.";
      }

      return "Break complete. Start the next focus interval when ready.";
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

function getRecentFocusTargetSummaries(
  records: readonly FocusRecord[],
): readonly RecentFocusTargetSummary[] {
  const recentTargets = new Map<string, RecentFocusTargetSummary>();

  for (const record of records) {
    for (const target of [...record.targets, ...record.focusTargets]) {
      const summary = summarizeFocusTarget(target);

      if (!recentTargets.has(summary.key)) {
        recentTargets.set(summary.key, summary);
      }
    }
  }

  return Array.from(recentTargets.values()).slice(0, 5);
}

function formatRecentFocusRecordDate(value: string) {
  return FOCUS_RECORD_TABLE_DATE_FORMATTER.format(new Date(value));
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

function summarizeFocusTarget(target: FocusTarget): RecentFocusTargetSummary {
  if (target.kind === "RecallSession") {
    return {
      context: formatFocusTargetLabels(target.labels),
      key: `RecallSession:${target.recallSession.id}`,
      kindLabel: "Recall practice",
      title: target.notes.map((note) => note.title).join(", "),
    };
  }

  return {
    context:
      target.labels.length === 0
        ? "No labels"
        : target.labels.map((label) => label.name).join(", "),
    key: `Note:${target.note.id}`,
    kindLabel: "Note study",
    title: target.note.title,
  };
}

function parseOptionalNumber(value: string) {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  return Number(trimmedValue);
}

function getFocusSessionStartInput(
  values: FocusSessionStartValues,
): FocusSessionStartInput {
  return {
    breakIntervalMinutes: Number(values.breakMinutes),
    focusIntervalMinutes: Number(values.focusMinutes),
    plannedFocusIntervalCount: parseOptionalNumber(
      values.plannedFocusIntervals,
    ),
  };
}
