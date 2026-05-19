import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useId, useState, useSyncExternalStore } from "react";

import { Button, ButtonLink } from "../../design-system/button";
import { PageHeader } from "../../design-system/page-header";
import { defaultUserTimeZone } from "../access/session/session-contract";
import { useResolvedProtectedSession } from "../access/session/use-resolved-protected-session";
import { type AppTranslationKey, useAppTranslation } from "../language";
import { listNotesForUser } from "../notes";
import { listStudyNotesForUser } from "../study-notes";
import {
  type AppFocusContext,
  AppFocusError,
  type FocusRecord,
  type FocusSession,
} from "./focus";
import {
  FocusSessionStartControl,
  useFocusTimerTick,
} from "./focus-session-start-control";
import {
  deriveFocusWeeklyAnalytics,
  type FocusWeeklyAnalytics,
  type FocusWeeklyAnalyticsMetric,
} from "./focus-weekly-analytics";
import type { FocusLearningLoopSupportSuggestion } from "./learning-loop-support";
import { getFocusLearningLoopSupportSuggestions } from "./learning-loop-support";
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

type FocusSessionConfigFieldProps = {
  disabled: boolean;
  field: FocusSessionStartField;
  icon: "break" | "cycles" | "focus";
  label: string;
  unitLabel?: string;
  min: string;
  onChange: (field: FocusSessionStartField, value: string) => void;
  value: string;
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

type FocusLearningLoopSupportCopy = {
  actionLabelKey: AppTranslationKey;
  summaryKey: AppTranslationKey;
  titleKey: AppTranslationKey;
};

type FocusTodayActivity = {
  longestStreakDays: number;
  sessions: readonly FocusTodayActivitySession[];
  sessionsCompleted: number;
  totalFocusMinutes: number;
};

type FocusTodayActivitySession = {
  durationLabel: string;
  id: string;
  timeRangeLabel: string;
};

const DEFAULT_BREAK_MINUTES = "5";
const DEFAULT_FOCUS_MINUTES = "25";
const DEFAULT_PLANNED_FOCUS_INTERVALS = "4";
const DEFAULT_LONG_BREAK_MINUTES = 15;
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
const focusLearningLoopSupportCopyByActionId = {
  "practice-repair": {
    actionLabelKey: "focus.support.practiceRepairAction",
    summaryKey: "focus.support.practiceRepairSummary",
    titleKey: "focus.support.practiceRepairTitle",
  },
  "recall-today": {
    actionLabelKey: "focus.support.recallTodayAction",
    summaryKey: "focus.support.recallTodaySummary",
    titleKey: "recall.today.title",
  },
} as const satisfies Record<
  FocusLearningLoopSupportSuggestion["actionId"],
  FocusLearningLoopSupportCopy
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
  const studyNotes = Route.useRouteContext({
    select: (context) => context.studyNotes,
  });
  const persistentStudyNotes = Route.useRouteContext({
    select: (context) => context.persistentStudyNotes,
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
  const studyNotesStore = persistentStudyNotes ?? studyNotes;
  const studyNotesSnapshot = useSyncExternalStore(
    studyNotesStore.subscribe,
    studyNotesStore.getSnapshot,
    studyNotesStore.getSnapshot,
  );
  useSyncExternalStore(
    recall.subscribe,
    recall.getSessionResultsSnapshot,
    recall.getSessionResultsSnapshot,
  );
  const recallSchedules = useSyncExternalStore(
    recall.subscribe,
    recall.getRecallSchedulesSnapshot,
    recall.getRecallSchedulesSnapshot,
  );
  const userId = sessionSnapshot.user?.id ?? null;
  const activeSession =
    userId === null ? null : focus.getActiveSession({ userId });
  useFocusTimerTick(activeSession);
  const records =
    userId === null
      ? []
      : [...focus.getFocusRecords({ userId })].sort(
          (left, right) => Date.parse(right.endedAt) - Date.parse(left.endedAt),
        );
  const userNotes = listNotesForUser(notesSnapshot, userId);
  const userStudyNotes = listStudyNotesForUser(studyNotesSnapshot, userId);
  const userTimeZone =
    sessionSnapshot.user?.userTimeZone ?? defaultUserTimeZone;
  const sessionResults =
    userId === null ? [] : recall.listSessionResults({ userId });
  const learningLoopSupportSuggestions =
    userId === null
      ? []
      : getFocusLearningLoopSupportSuggestions({
          attemptsByNote: recall.listAttemptsByNote({ userId }),
          now: new Date().toISOString(),
          recallSchedules,
          sessionResults,
          studyNotes: userStudyNotes,
          userTimeZone,
        });
  const hasLearningLoopSupport = learningLoopSupportSuggestions.length > 0;
  const weeklyAnalytics = deriveFocusWeeklyAnalytics({
    focusRecords: records,
    notes: userNotes,
    now: new Date(),
    sessionResults,
  });
  const todayActivity = deriveFocusTodayActivity({
    focusRecords: records,
    now: new Date(),
    userTimeZone,
  });
  const translatedWeeklyAnalytics = translateFocusWeeklyAnalytics(
    weeklyAnalytics,
    t,
  );

  return (
    <section
      className={
        hasLearningLoopSupport
          ? "focus-workspace focus-workspace--has-support"
          : "focus-workspace"
      }
    >
      <PageHeader
        actions={
          <FocusSessionStartControl
            activeFocusSession={activeSession}
            focus={focus}
            persistentFocus={persistentFocus}
            userId={userId}
          />
        }
        className="focus-page-header"
        description={t("focus.description")}
        headingLevel={1}
        title={t("focus.heading")}
      />

      <section className="focus-session-workspace">
        <ActiveFocusSessionPanel
          activeSession={activeSession}
          focus={focus}
          persistentFocus={persistentFocus}
          userId={userId}
        />
        <div className="focus-session-sidebar">
          <FocusTodayActivityPanel activity={todayActivity} />
          {hasLearningLoopSupport ? (
            <FocusLearningLoopSupport
              suggestions={learningLoopSupportSuggestions}
            />
          ) : null}
        </div>
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

function FocusLearningLoopSupport({
  suggestions,
}: Readonly<{
  suggestions: readonly FocusLearningLoopSupportSuggestion[];
}>) {
  const { t } = useAppTranslation();

  return (
    <section
      aria-label={t("focus.support.regionLabel")}
      className="focus-card focus-card--support"
    >
      <div className="focus-card__header">
        <div>
          <p className="section-label">{t("focus.support.sectionLabel")}</p>
          <h3 className="focus-card-title">{t("focus.support.heading")}</h3>
          <p>{t("focus.support.description")}</p>
        </div>
      </div>
      <div className="focus-learning-loop-support">
        {suggestions.map((suggestion) => {
          const copyKeys =
            focusLearningLoopSupportCopyByActionId[suggestion.actionId];

          return (
            <article
              className="focus-learning-loop-support__item"
              key={suggestion.actionId}
            >
              <span
                aria-hidden="true"
                className={`focus-support-icon focus-support-icon--${suggestion.actionId}`}
              >
                {suggestion.actionId === "recall-today" ? (
                  <CalendarQueueIcon />
                ) : (
                  <WarningIcon />
                )}
              </span>
              <div className="focus-learning-loop-support__copy">
                <h4>{t(copyKeys.titleKey)}</h4>
                <p>{t(copyKeys.summaryKey)}</p>
              </div>
              <ButtonLink
                size="compact"
                to={suggestion.href}
                variant="secondary"
              >
                {t(copyKeys.actionLabelKey)}
              </ButtonLink>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FocusTodayActivityPanel({
  activity,
}: Readonly<{
  activity: FocusTodayActivity;
}>) {
  const { t } = useAppTranslation();
  const streakLabel = t("focus.activity.streakDays", {
    count: activity.longestStreakDays,
  });
  const [streakCount, ...streakUnitParts] = streakLabel.split(" ");
  const streakUnit = streakUnitParts.join(" ");

  return (
    <section
      aria-label={t("focus.activity.regionLabel")}
      className="focus-card focus-card--activity"
    >
      <div className="focus-card__header">
        <div className="focus-activity-header-copy">
          <h3 className="focus-card-title">{t("focus.activity.heading")}</h3>
          <p>{t("focus.activity.description")}</p>
        </div>
        <Button
          className="focus-activity-view-all"
          size="compact"
          type="button"
          variant="standard"
        >
          {t("focus.activity.viewAll")}
        </Button>
      </div>
      <dl className="focus-activity-summary">
        <div className="focus-activity-summary__metric">
          <dt>{t("focus.activity.totalFocusTime")}</dt>
          <dd className="focus-activity-summary__value">
            <span aria-hidden="true" className="focus-activity-summary__icon">
              <ClockIcon />
            </span>
            <span>{`${activity.totalFocusMinutes}m`}</span>
          </dd>
          <dd className="focus-activity-summary__supporting">
            {t("focus.activity.sessionCount", {
              count: activity.sessionsCompleted,
            })}
          </dd>
        </div>
        <div className="focus-activity-summary__metric">
          <dt>{t("focus.activity.sessionsCompleted")}</dt>
          <dd className="focus-activity-summary__value">
            <span aria-hidden="true" className="focus-activity-summary__icon">
              <CheckIcon />
            </span>
            <span>{activity.sessionsCompleted}</span>
          </dd>
        </div>
        <div className="focus-activity-summary__metric">
          <dt>{t("focus.activity.longestStreak")}</dt>
          <dd className="focus-activity-summary__value">
            <span aria-hidden="true" className="focus-activity-summary__icon">
              <StreakIcon />
            </span>
            <span>{streakCount}</span>
            {streakUnit === "" ? null : (
              <span className="focus-activity-summary__unit">{streakUnit}</span>
            )}
          </dd>
        </div>
      </dl>
      {activity.sessions.length === 0 ? (
        <p className="focus-activity-empty">{t("focus.activity.empty")}</p>
      ) : (
        <ul
          aria-label={t("focus.activity.sessionsList")}
          className="focus-activity-list"
        >
          {activity.sessions.map((session) => (
            <li key={session.id}>
              <span>{session.timeRangeLabel}</span>
              <span>{t("focus.panel.focus")}</span>
              <span>{session.durationLabel}</span>
              <CheckIcon />
            </li>
          ))}
        </ul>
      )}
      <p className="focus-activity-note">
        <ClockIcon />
        <span>{t("focus.activity.localTimeNote")}</span>
      </p>
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
  const [startValues, setStartValues] = useState<FocusSessionStartValues>(
    DEFAULT_FOCUS_SESSION_START_VALUES,
  );
  const sessionStatus = getFocusSessionStatus(activeSession, t);
  const sessionDetails = getFocusSessionPanelDetails(
    activeSession,
    t,
    startValues,
  );
  const regionLabel =
    activeSession === null
      ? t("focus.panel.startRegion")
      : t("focus.activeSession.legend");
  const panelTitle =
    activeSession === null
      ? t("focus.panel.startTitle")
      : t("focus.panel.session");

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
    <section aria-label={regionLabel} className="focus-session-panel">
      <div className="focus-session-panel__header">
        <div>
          <h3>{panelTitle}</h3>
        </div>
        <button className="focus-session-settings" type="button">
          <SettingsIcon />
          <span>{t("focus.panel.sessionSettings")}</span>
        </button>
      </div>

      <div className="focus-session-panel__timer">
        <div className="focus-timer-ring">
          <span aria-hidden="true" className="focus-timer-ring__leaf">
            <LeafIcon />
          </span>
          <span>{sessionDetails.description}</span>
          <strong>{sessionDetails.timerLabel}</strong>
          <span>{sessionStatus.label}</span>
        </div>
      </div>
      {activeSession === null ? null : (
        <div className="focus-session-panel__actions">
          <Button
            onClick={() => {
              void handleEndFocusSession();
            }}
            type="button"
            variant="secondary"
          >
            {t("focus.panel.endSession")}
          </Button>
          {sessionStatus.actionLabel === null ? null : (
            <Button
              onClick={() => {
                void handleAdvanceFocusSession();
              }}
              type="button"
            >
              {sessionStatus.actionLabel}
            </Button>
          )}
        </div>
      )}
      <FocusSessionConfig
        activeSession={activeSession}
        focus={focus}
        onStartValuesChange={setStartValues}
        persistentFocus={persistentFocus}
        startValues={startValues}
        userId={userId}
      />
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
  onStartValuesChange,
  persistentFocus,
  startValues,
  userId,
}: Readonly<{
  activeSession: FocusSession | null;
  focus: AppFocusContext;
  onStartValuesChange: (values: FocusSessionStartValues) => void;
  persistentFocus?: AppPersistentFocusContext;
  startValues: FocusSessionStartValues;
  userId: string | null;
}>) {
  const { t } = useAppTranslation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorId = useId();
  const isFocusSessionActive = activeSession !== null;
  const setupNote = isFocusSessionActive
    ? t("focus.form.setupLocked")
    : t("focus.form.setupNote");
  const visibleStartValues = getVisibleFocusSessionStartValues(
    activeSession,
    startValues,
  );

  function updateStartValue(field: FocusSessionStartField, value: string) {
    onStartValuesChange({
      ...startValues,
      [field]: value,
    });
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
      onStartValuesChange(DEFAULT_FOCUS_SESSION_START_VALUES);
    } catch (error) {
      if (error instanceof AppFocusError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  function handleReset() {
    onStartValuesChange(DEFAULT_FOCUS_SESSION_START_VALUES);
    setErrorMessage(null);
  }

  return (
    <div className="focus-session-setup">
      <form
        aria-describedby={errorMessage === null ? undefined : errorId}
        aria-label={t("focus.form.setup")}
        className="focus-config-form"
        onSubmit={handleSubmit}
      >
        <div className="focus-config-form__actions">
          {isFocusSessionActive ? null : (
            <Button
              className="focus-start-button"
              disabled={isFocusSessionActive}
              type="submit"
              variant="secondary"
            >
              <PlayIcon />
              <span>{t("focus.form.startSession")}</span>
            </Button>
          )}
          <Button
            className="focus-reset-button sr-only"
            disabled={isFocusSessionActive}
            onClick={handleReset}
            type="button"
          >
            {t("focus.form.reset")}
          </Button>
        </div>
        <div className="focus-config-form__fields">
          <FocusConfigField
            disabled={isFocusSessionActive}
            field="focusMinutes"
            icon="focus"
            label={t("focus.form.focusDuration")}
            min="1"
            onChange={updateStartValue}
            unitLabel={t("focus.form.minutesUnit")}
            value={visibleStartValues.focusMinutes}
          />
          <FocusConfigField
            disabled={isFocusSessionActive}
            field="breakMinutes"
            icon="break"
            label={t("focus.form.breakDuration")}
            min="0"
            onChange={updateStartValue}
            unitLabel={t("focus.form.minutesUnit")}
            value={visibleStartValues.breakMinutes}
          />
          <FocusConfigField
            disabled={isFocusSessionActive}
            field="plannedFocusIntervals"
            icon="cycles"
            label={t("focus.form.cycles")}
            min="1"
            onChange={updateStartValue}
            value={visibleStartValues.plannedFocusIntervals}
          />
        </div>
        <p className="focus-setup-note sr-only">{setupNote}</p>
        <FocusSessionPlan startValues={visibleStartValues} />
        {errorMessage === null ? null : (
          <span id={errorId} role="alert">
            {errorMessage}
          </span>
        )}
      </form>
    </div>
  );
}

function FocusConfigField({
  disabled,
  field,
  icon,
  label,
  unitLabel,
  min,
  onChange,
  value,
}: Readonly<FocusSessionConfigFieldProps>) {
  const { t } = useAppTranslation();
  const inputLabelKey = {
    breakMinutes: "focus.form.breakMinutes",
    focusMinutes: "focus.form.focusMinutes",
    plannedFocusIntervals: "focus.form.plannedIntervals",
  } as const satisfies Record<FocusSessionStartField, AppTranslationKey>;

  return (
    <label className="focus-config-field">
      <span aria-hidden="true" className="focus-config-field__icon">
        {icon === "focus" ? (
          <ClockIcon />
        ) : icon === "break" ? (
          <BreakCupIcon />
        ) : (
          <RepeatIcon />
        )}
      </span>
      <span className="focus-config-field__copy">
        <span className="focus-config-field__label">{label}</span>
        <span className="focus-config-field__value">
          <input
            aria-label={t(inputLabelKey[field])}
            disabled={disabled}
            inputMode="numeric"
            min={min}
            onChange={(event) => onChange(field, event.target.value)}
            type="number"
            value={value}
          />
          {unitLabel === undefined ? null : <span>{unitLabel}</span>}
        </span>
      </span>
    </label>
  );
}

function FocusSessionPlan({
  startValues,
}: Readonly<{
  startValues: FocusSessionStartValues;
}>) {
  const { t } = useAppTranslation();
  const focusMinutes = getPositiveIntegerOrDefault(
    startValues.focusMinutes,
    Number(DEFAULT_FOCUS_MINUTES),
  );
  const breakMinutes = getNonNegativeIntegerOrDefault(
    startValues.breakMinutes,
    Number(DEFAULT_BREAK_MINUTES),
  );
  const plannedIntervals = getPositiveIntegerOrDefault(
    startValues.plannedFocusIntervals,
    Number(DEFAULT_PLANNED_FOCUS_INTERVALS),
  );
  const sessionPlan = Array.from({ length: plannedIntervals }, (_, index) => [
    {
      durationMinutes: focusMinutes,
      isNext: index === 0,
      kind: "focus" as const,
      label: t("focus.panel.focus"),
      step: index * 2 + 1,
    },
    {
      durationMinutes:
        index === plannedIntervals - 1
          ? DEFAULT_LONG_BREAK_MINUTES
          : breakMinutes,
      isNext: false,
      kind: "break" as const,
      label:
        index === plannedIntervals - 1
          ? t("focus.plan.longBreak")
          : t("focus.panel.break"),
      step: index * 2 + 2,
    },
  ]).flat();

  return (
    <div className="focus-session-plan">
      <div className="focus-session-plan__header">
        <strong>{t("focus.plan.heading")}</strong>
        <button className="focus-session-plan__schedule" type="button">
          {t("focus.plan.viewFullSchedule")}
        </button>
      </div>
      <ol
        aria-label={t("focus.plan.heading")}
        className="focus-session-plan__list"
      >
        {sessionPlan.map((planItem) => (
          <li key={planItem.step}>
            <span className="focus-session-plan__index">{planItem.step}</span>
            <span
              className={
                planItem.kind === "focus"
                  ? "focus-session-plan__dot"
                  : "focus-session-plan__break-icon"
              }
            >
              {planItem.kind === "focus" ? null : <BreakCupIcon />}
            </span>
            <span>{planItem.label}</span>
            <span>{`${planItem.durationMinutes} min`}</span>
            {planItem.isNext ? (
              <strong className="focus-session-plan__next">
                {t("focus.plan.next")}
              </strong>
            ) : (
              <span aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function getFocusSessionPanelDetails(
  session: FocusSession | null,
  t: AppTranslate,
  startValues: FocusSessionStartValues,
): FocusSessionPanelDetails {
  if (session === null) {
    const focusMinutes = getPositiveIntegerOrDefault(
      startValues.focusMinutes,
      Number(DEFAULT_FOCUS_MINUTES),
    );
    const breakMinutes = getNonNegativeIntegerOrDefault(
      startValues.breakMinutes,
      Number(DEFAULT_BREAK_MINUTES),
    );
    const plannedFocusIntervals = getPositiveIntegerOrDefault(
      startValues.plannedFocusIntervals,
      Number(DEFAULT_PLANNED_FOCUS_INTERVALS),
    );

    return {
      description: t("focus.panel.description.empty"),
      stats: [
        {
          label: t("focus.panel.focus"),
          value: `${focusMinutes} min`,
        },
        {
          label: t("focus.panel.break"),
          value: `${breakMinutes} min`,
        },
        {
          label: t("focus.panel.intervals"),
          value: String(plannedFocusIntervals),
        },
        {
          label: t("focus.panel.completed"),
          value: `0 / ${plannedFocusIntervals}`,
        },
      ],
      timerLabel: `${focusMinutes}:00`,
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

function getVisibleFocusSessionStartValues(
  activeSession: FocusSession | null,
  startValues: FocusSessionStartValues,
): FocusSessionStartValues {
  if (activeSession === null) {
    return startValues;
  }

  return {
    breakMinutes: String(activeSession.breakIntervalMinutes),
    focusMinutes: String(activeSession.focusIntervalMinutes),
    plannedFocusIntervals:
      activeSession.plannedFocusIntervalCount === null
        ? ""
        : String(activeSession.plannedFocusIntervalCount),
  };
}

function getPositiveIntegerOrDefault(value: string, fallback: number) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
}

function getNonNegativeIntegerOrDefault(value: string, fallback: number) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return fallback;
  }

  return parsedValue;
}

function deriveFocusTodayActivity(input: {
  focusRecords: readonly FocusRecord[];
  now: Date;
  userTimeZone: string;
}): FocusTodayActivity {
  const todayKey = getLocalDateKey({
    timestamp: input.now.toISOString(),
    userTimeZone: input.userTimeZone,
  });
  const todayRecords =
    todayKey === null
      ? []
      : input.focusRecords
          .filter(
            (record) =>
              getLocalDateKey({
                timestamp: record.endedAt,
                userTimeZone: input.userTimeZone,
              }) === todayKey,
          )
          .sort(
            (left, right) =>
              Date.parse(left.startedAt) - Date.parse(right.startedAt),
          );

  return {
    longestStreakDays: getLongestFocusStreakDays({
      focusRecords: input.focusRecords,
      userTimeZone: input.userTimeZone,
    }),
    sessions: todayRecords.slice(0, 3).map((record) => ({
      durationLabel: `${record.completedFocusIntervalCount * record.focusIntervalMinutes}m`,
      id: record.id,
      timeRangeLabel: formatFocusActivityTimeRange({
        endedAt: record.endedAt,
        startedAt: record.startedAt,
        userTimeZone: input.userTimeZone,
      }),
    })),
    sessionsCompleted: todayRecords.length,
    totalFocusMinutes: todayRecords.reduce(
      (totalMinutes, record) =>
        totalMinutes +
        record.completedFocusIntervalCount * record.focusIntervalMinutes,
      0,
    ),
  };
}

function getLongestFocusStreakDays(input: {
  focusRecords: readonly FocusRecord[];
  userTimeZone: string;
}) {
  const dayKeys = [
    ...new Set(
      input.focusRecords
        .map((record) =>
          getLocalDateKey({
            timestamp: record.endedAt,
            userTimeZone: input.userTimeZone,
          }),
        )
        .filter((dayKey): dayKey is string => dayKey !== null),
    ),
  ].sort();

  if (dayKeys.length === 0) {
    return 0;
  }

  let longestStreak = 1;
  let currentStreak = 1;

  for (let index = 1; index < dayKeys.length; index += 1) {
    const previousDay = Date.parse(`${dayKeys[index - 1]}T00:00:00.000Z`);
    const currentDay = Date.parse(`${dayKeys[index]}T00:00:00.000Z`);
    const daysBetween = Math.round(
      (currentDay - previousDay) / (24 * 60 * 60 * 1000),
    );

    if (daysBetween === 1) {
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }

    longestStreak = Math.max(longestStreak, currentStreak);
  }

  return longestStreak;
}

function getLocalDateKey(input: {
  timestamp: string;
  userTimeZone: string;
}): string | null {
  const date = new Date(input.timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    const parts = new Intl.DateTimeFormat("en", {
      day: "2-digit",
      month: "2-digit",
      timeZone: input.userTimeZone,
      year: "numeric",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year === undefined || month === undefined || day === undefined) {
      return null;
    }

    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

function formatFocusActivityTimeRange(input: {
  endedAt: string;
  startedAt: string;
  userTimeZone: string;
}) {
  const timeFormatter = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: input.userTimeZone,
  });

  return `${timeFormatter.format(new Date(input.startedAt))} - ${timeFormatter.format(
    new Date(input.endedAt),
  )}`;
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

function SettingsIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M12.2 2h-.4a2 2 0 0 0-2 1.7l-.1.7a2 2 0 0 1-3 1.2l-.6-.4a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .5 2.8l.6.4a2 2 0 0 1 0 3.2l-.6.4a2 2 0 0 0-.5 2.8l.2.4a2 2 0 0 0 2.7.7l.6-.4a2 2 0 0 1 3 1.2l.1.7a2 2 0 0 0 2 1.7h.4a2 2 0 0 0 2-1.7l.1-.7a2 2 0 0 1 3-1.2l.6.4a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.5-2.8l-.6-.4a2 2 0 0 1 0-3.2l.6-.4a2 2 0 0 0 .5-2.8l-.2-.4a2 2 0 0 0-2.7-.7l-.6.4a2 2 0 0 1-3-1.2l-.1-.7a2 2 0 0 0-2-1.7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="m9 7 8 5-8 5V7Z" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M19 4c-6.5.6-10.5 4.5-10.5 10.2 0 2.5 1.6 4.2 4 4.2 5.3 0 7.5-6.1 6.5-14.4Z" />
      <path d="M8 20c1.2-4.4 4-7.4 8.4-9" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M17 2 21 6l-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" />
      <path d="M7 22 3 18l4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </svg>
  );
}

function CalendarQueueIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M7 3v4" />
      <path d="M17 3v4" />
      <path d="M4 8h16" />
      <path d="M5 5h14v15H5V5Z" />
      <path d="M8 13h3" />
      <path d="M8 16h5" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  );
}

function StreakIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M12 21a7 7 0 0 0 7-7c0-4.5-3.3-6.8-5.2-9.7-.3 2.7-1.6 4.4-3.3 5.8-.2-1.3-.9-2.5-2-3.3C8.4 9.9 5 11.7 5 15a7 7 0 0 0 7 6Z" />
      <path d="M12 18a3 3 0 0 0 3-3c0-1.7-1.1-2.6-2-3.7-.2 1-.8 1.8-1.7 2.4-.2-.7-.6-1.2-1.2-1.6-.1 1.8-1.1 2.5-1.1 3.9a3 3 0 0 0 3 2Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </svg>
  );
}

function BreakCupIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M7 8h9v7a4 4 0 0 1-4 4H9a2 2 0 0 1-2-2V8Z" />
      <path d="M16 10h1a2 2 0 0 1 0 4h-1" />
      <path d="M9 4v2" />
      <path d="M13 4v2" />
    </svg>
  );
}
