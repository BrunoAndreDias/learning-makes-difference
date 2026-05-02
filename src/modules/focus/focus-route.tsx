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
  plannedFocusIntervals: "",
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
  const activeSessionDisplay = getActiveSessionDisplay(activeSession);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="focus-records-heading"
      className="focus-workspace"
    >
      <header className="focus-hero">
        <div className="focus-hero__content">
          <p className="section-label">Focus review</p>
          <h3 id="focus-records-heading" ref={headingRef} tabIndex={-1}>
            Study sessions
          </h3>
          <p>
            Plan a Pomodoro block, keep the timer visible, and review what you
            studied without leaving the workspace.
          </p>
          <div className="tag-row focus-hero__tags">
            <span className="tag">{records.length} study sessions</span>
            <span className="tag">{recentFocusMinutes} recent focus min</span>
            <span className="tag">{recentBreakMinutes} recent break min</span>
          </div>
        </div>
        <aside aria-label="Current focus session" className="focus-now-card">
          <span className="focus-now-card__label">
            {activeSessionDisplay.label}
          </span>
          <strong>{activeSessionDisplay.summary}</strong>
          <span>{activeSessionDisplay.detail}</span>
        </aside>
      </header>

      <div className="focus-grid">
        <FocusSessionConfig
          activeSession={activeSession}
          focus={focus}
          persistentFocus={persistentFocus}
          userId={userId}
        />

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
  useFocusTimerTick(activeSession);
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
      setStartValues((currentValues) => ({
        ...currentValues,
        plannedFocusIntervals: "",
      }));
    } catch (error) {
      if (error instanceof AppFocusError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  return (
    <article className="focus-card focus-card--setup">
      <div className="focus-card__header">
        <div>
          <p className="section-label">Focus config</p>
          <strong className="focus-card-title">Pomodoro timer</strong>
        </div>
      </div>
      <form
        aria-describedby={errorMessage === null ? undefined : errorId}
        aria-label="Focus session start"
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
            <span>Planned focus intervals</span>
            <input
              disabled={currentActiveSession !== null}
              inputMode="numeric"
              min="1"
              onChange={(event) =>
                updateStartValue("plannedFocusIntervals", event.target.value)
              }
              placeholder="Optional"
              type="number"
              value={startValues.plannedFocusIntervals}
            />
          </label>
        </div>
        {currentActiveSession === null ? (
          <button className="notes-action notes-action-primary" type="submit">
            Start Focus
          </button>
        ) : (
          <button
            className="notes-action notes-action-primary"
            disabled
            type="button"
          >
            Focus{" "}
            <span aria-hidden="true">
              {getRemainingTimerLabel(currentActiveSession)}
            </span>
          </button>
        )}
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

function getActiveSessionDisplay(session: FocusSession | null) {
  if (session === null) {
    return {
      detail: "Start a session below when you are ready.",
      label: "Ready",
      summary: "No timer running",
    };
  }

  return {
    detail: getActiveSessionDetail(session),
    label: session.intervalState,
    summary: getActiveSessionSummary(session),
  };
}

function getActiveSessionSummary(session: FocusSession) {
  const remainingLabel = getRemainingMinuteLabel(session);

  switch (session.intervalState) {
    case "Focus":
      return `${remainingLabel} left in focus`;
    case "Break":
      return `${remainingLabel} left in break`;
    case "Transition":
      return `${remainingLabel} transition`;
    case "AwaitingNextFocus":
      return session.isStale ? "Stale session" : "Ready for next focus";
  }
}

function getActiveSessionDetail(session: FocusSession) {
  const completedLabel = `${session.completedFocusIntervalCount} completed`;
  let plannedLabel = "open-ended";

  if (session.plannedFocusIntervalCount !== null) {
    plannedLabel = `${session.plannedFocusIntervalCount} planned`;
  }

  return `${completedLabel} · ${plannedLabel}`;
}

function getRemainingMinuteLabel(session: FocusSession) {
  const remainingSeconds = session.remainingSeconds ?? 0;
  const remainingMinutes =
    remainingSeconds <= 0 ? 0 : Math.ceil(remainingSeconds / 60);

  return formatCount(remainingMinutes, "min", "mins");
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
