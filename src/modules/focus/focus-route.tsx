import { createFileRoute } from "@tanstack/react-router";
import {
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import { type AppTranslationKey, useAppTranslation } from "../language";
import { listNotesForUser } from "../notes";
import {
  type AppFocusContext,
  AppFocusError,
  type FocusSession,
} from "./focus";
import { useFocusTimerTick } from "./focus-session-start-control";
import {
  deriveFocusWeeklyAnalytics,
  type FocusWeeklyAnalytics,
  type FocusWeeklyAnalyticsMetric,
} from "./focus-weekly-analytics";
import type { AppPersistentFocusContext } from "./persistent-focus";

type AppTranslate = ReturnType<typeof useAppTranslation>["t"];

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

const DEFAULT_BREAK_MINUTES = "5";
const DEFAULT_FOCUS_MINUTES = "25";
const DEFAULT_PLANNED_FOCUS_INTERVALS = "4";
const DEFAULT_FOCUS_SESSION_START_VALUES: FocusSessionStartValues = {
  breakMinutes: DEFAULT_BREAK_MINUTES,
  focusMinutes: DEFAULT_FOCUS_MINUTES,
  plannedFocusIntervals: DEFAULT_PLANNED_FOCUS_INTERVALS,
};
const focusAnalyticsComparisonSuffix = " vs last week";
const focusAnalyticsNoChangeComparison = `No change${focusAnalyticsComparisonSuffix}`;
const focusAnalyticsMetricLabelKeys = {
  "average-session-length": "focus.analytics.averageSessionLength",
  "completed-sessions": "focus.analytics.completedSessions",
  "focus-minutes": "focus.analytics.focusMinutes",
  "notes-created": "focus.analytics.notesCreated",
  "notes-touched": "focus.analytics.notesTouched",
  "recall-answered": "focus.analytics.recallAnswered",
} as const satisfies Record<
  FocusWeeklyAnalyticsMetric["id"],
  AppTranslationKey
>;

export const Route = createFileRoute("/_protected/focus")({
  component: FocusPage,
});

function FocusPage() {
  const { t } = useAppTranslation();
  const focus = Route.useRouteContext({
    select: (context) => context.focus,
  });
  const persistentFocus = Route.useRouteContext({
    select: (context) => context.persistentFocus,
  });
  const notes = Route.useRouteContext({
    select: (context) => context.notes,
  });
  const recall = Route.useRouteContext({
    select: (context) => context.recall,
  });
  const { sessionSnapshot } = useResolvedProtectedSession("/_protected/focus");

  useSyncExternalStore(focus.subscribe, focus.getSnapshot, focus.getSnapshot);
  useSyncExternalStore(
    focus.subscribe,
    focus.getRecordSnapshot,
    focus.getRecordSnapshot,
  );
  const notesSnapshot = useSyncExternalStore(
    notes.subscribe,
    notes.getSnapshot,
    notes.getSnapshot,
  );
  useSyncExternalStore(
    recall.subscribe,
    recall.getSessionResultsSnapshot,
    recall.getSessionResultsSnapshot,
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
  const userNotes = listNotesForUser(notesSnapshot, userId);
  const sessionResults =
    userId === null ? [] : recall.listSessionResults({ userId });
  const weeklyAnalytics = deriveFocusWeeklyAnalytics({
    focusRecords: records,
    notes: userNotes,
    now: new Date(),
    sessionResults,
  });
  const translatedWeeklyAnalytics = translateFocusWeeklyAnalytics(
    weeklyAnalytics,
    t,
  );
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="focus-workspace-heading"
      className="focus-workspace"
    >
      <header className="focus-workspace__page-header recall-surface__header">
        <div className="notes-editor__title-stack">
          <h3 id="focus-workspace-heading" ref={headingRef} tabIndex={-1}>
            {t("focus.heading")}
          </h3>
          <p className="muted notes-editor__meta">{t("focus.description")}</p>
        </div>
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

      <section
        aria-label={translatedWeeklyAnalytics.heading}
        className="focus-card focus-card--analytics"
      >
        <div className="focus-card__header">
          <div>
            <p className="section-label">{t("focus.analytics.sectionLabel")}</p>
            <strong className="focus-card-title">
              {translatedWeeklyAnalytics.heading}
            </strong>
          </div>
        </div>
        <dl className="focus-weekly-analytics">
          {translatedWeeklyAnalytics.metrics.map((metric) => (
            <div key={metric.id}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
              <span>{metric.comparisonLabel}</span>
            </div>
          ))}
        </dl>
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
  const { t } = useAppTranslation();
  const sessionStatus = getFocusSessionStatus(activeSession, t);
  const sessionDetails = getFocusSessionPanelDetails(activeSession, t);

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
    <section
      aria-label={t("focus.activeSession.legend")}
      className="focus-session-panel"
    >
      <div className="focus-session-panel__header">
        <div>
          <p className="section-label">{t("focus.panel.activeLabel")}</p>
          <h4>{t("focus.panel.session")}</h4>
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
            {t("focus.panel.endSession")}
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
  const { t } = useAppTranslation();

  return (
    <dl
      aria-label={t("focus.panel.currentDetails")}
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
  const { t } = useAppTranslation();
  const [startValues, setStartValues] = useState<FocusSessionStartValues>(
    DEFAULT_FOCUS_SESSION_START_VALUES,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorId = useId();
  const isFocusSessionActive = activeSession !== null;
  const setupNote = isFocusSessionActive
    ? t("focus.form.setupLocked")
    : t("focus.form.setupNote");

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
          <p className="section-label">{t("focus.form.setup")}</p>
          <strong className="focus-card-title">{t("focus.form.setup")}</strong>
        </div>
      </div>
      <form
        aria-describedby={errorMessage === null ? undefined : errorId}
        aria-label={t("focus.form.setup")}
        className="focus-config-form"
        onSubmit={handleSubmit}
      >
        <div className="focus-config-form__fields">
          <label>
            <span>{t("focus.form.focusMinutes")}</span>
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
            <span>{t("focus.form.breakMinutes")}</span>
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
            <span>{t("focus.form.plannedIntervals")}</span>
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
            {t("focus.form.startSession")}
          </button>
          <button
            className="notes-action"
            disabled={isFocusSessionActive}
            onClick={handleReset}
            type="button"
          >
            {t("focus.form.reset")}
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

function getFocusSessionPanelDetails(
  session: FocusSession | null,
  t: AppTranslate,
): FocusSessionPanelDetails {
  if (session === null) {
    return {
      description: t("focus.panel.description.empty"),
      stats: [
        {
          label: t("focus.panel.focus"),
          value: `${DEFAULT_FOCUS_MINUTES} min`,
        },
        {
          label: t("focus.panel.break"),
          value: `${DEFAULT_BREAK_MINUTES} min`,
        },
        {
          label: t("focus.panel.intervals"),
          value: DEFAULT_PLANNED_FOCUS_INTERVALS,
        },
        {
          label: t("focus.panel.completed"),
          value: `0 / ${DEFAULT_PLANNED_FOCUS_INTERVALS}`,
        },
      ],
      timerLabel: "--:--",
    };
  }

  return {
    description: getActiveTimerDescription(session, t),
    stats: [
      {
        label: t("focus.panel.focus"),
        value: `${session.focusIntervalMinutes} min`,
      },
      {
        label: t("focus.panel.break"),
        value: `${session.breakIntervalMinutes} min`,
      },
      {
        label: t("focus.panel.intervals"),
        value: getPlannedIntervalsLabel(session, t),
      },
      {
        label: t("focus.panel.completed"),
        value: getCompletedIntervalsLabel(session),
      },
    ],
    timerLabel: getRemainingTimerLabel(session),
  };
}

function getFocusSessionStatus(session: FocusSession | null, t: AppTranslate) {
  if (session === null) {
    return {
      actionLabel: null,
      label: t("focus.status.ready"),
    };
  }

  if (session.isStale) {
    return {
      actionLabel: null,
      label: t("focus.status.stale"),
    };
  }

  switch (session.intervalState) {
    case "Focus":
      return {
        actionLabel: null,
        label: t("focus.status.inProgress"),
      };
    case "Transition":
      return {
        actionLabel: t("focus.status.action.keepFocusing"),
        label: t("focus.status.transition"),
      };
    case "Break":
      return {
        actionLabel: t("focus.status.action.skipBreak"),
        label: t("focus.status.break"),
      };
    case "AwaitingNextFocus":
      return {
        actionLabel: t("focus.status.action.startNext"),
        label: t("focus.status.awaitingNext"),
      };
  }
}

function getActiveTimerDescription(session: FocusSession, t: AppTranslate) {
  switch (session.intervalState) {
    case "Focus":
      return t("focus.panel.description.focus");
    case "Transition":
      return t("focus.panel.description.transition");
    case "Break":
      return t("focus.panel.description.break");
    case "AwaitingNextFocus":
      if (session.isStale) {
        return t("focus.panel.description.stale");
      }

      return t("focus.panel.description.awaitingNext");
  }
}

function getPlannedIntervalsLabel(session: FocusSession, t: AppTranslate) {
  if (session.plannedFocusIntervalCount === null) {
    return t("focus.panel.open");
  }

  return String(session.plannedFocusIntervalCount);
}

function getCompletedIntervalsLabel(session: FocusSession) {
  if (session.plannedFocusIntervalCount === null) {
    return String(session.completedFocusIntervalCount);
  }

  return `${session.completedFocusIntervalCount} / ${session.plannedFocusIntervalCount}`;
}

function translateFocusWeeklyAnalytics(
  weeklyAnalytics: FocusWeeklyAnalytics,
  t: AppTranslate,
): FocusWeeklyAnalytics {
  return {
    heading: t("focus.analytics.heading"),
    metrics: weeklyAnalytics.metrics.map((metric) => ({
      ...metric,
      comparisonLabel: translateFocusAnalyticsComparisonLabel(
        metric.comparisonLabel,
        t,
      ),
      label: t(focusAnalyticsMetricLabelKeys[metric.id]),
    })),
  };
}

function translateFocusAnalyticsComparisonLabel(
  comparisonLabel: string,
  t: AppTranslate,
) {
  if (comparisonLabel === focusAnalyticsNoChangeComparison) {
    return t("focus.analytics.noChange");
  }

  return t("focus.analytics.vsLastWeek", {
    value: comparisonLabel.replace(focusAnalyticsComparisonSuffix, ""),
  });
}

function getRemainingTimerLabel(session: FocusSession) {
  const remainingSeconds = session.remainingSeconds ?? 0;
  const normalizedSeconds = remainingSeconds <= 0 ? 0 : remainingSeconds;
  const minutes = Math.floor(normalizedSeconds / 60);
  const seconds = normalizedSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
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
