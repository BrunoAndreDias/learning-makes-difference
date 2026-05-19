import { useEffect, useId, useState } from "react";

import { Button } from "../../design-system/button";
import { useAppTranslation } from "../language";
import {
  type AppFocusContext,
  AppFocusError,
  type FocusSession,
} from "./focus";
import {
  endActiveFocusSession,
  restartDefaultFocusSession,
  startDefaultFocusSession,
  startNextFocusInterval,
} from "./focus-session-actions";
import { useFocusTimerTick } from "./focus-session-start-control";
import type { AppPersistentFocusContext } from "./persistent-focus";

const FOCUS_DOCK_TIMER_SEPARATOR = " \u00b7 ";
const FOCUS_DOCK_CLASS_NAME = "focus-dock focus-dock--pill";

type FocusDockAction = () => Promise<void> | void;
type AppTranslate = ReturnType<typeof useAppTranslation>["t"];

export function FocusDock({
  activeFocusSession,
  focus,
  persistentFocus,
  userId,
}: Readonly<{
  activeFocusSession: FocusSession | null;
  focus: AppFocusContext;
  persistentFocus?: AppPersistentFocusContext;
  userId: string | null;
}>) {
  const { t } = useAppTranslation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorId = useId();
  useFocusTimerTick(activeFocusSession);
  const currentActiveFocusSession =
    userId === null ? activeFocusSession : focus.getActiveSession({ userId });
  const errorDescriptionId = errorMessage === null ? undefined : errorId;
  const isActionDisabled = userId === null;
  const focusActionInput = { focus, persistentFocus, userId };

  useEffect(() => {
    if (currentActiveFocusSession === null) {
      return;
    }

    setErrorMessage(null);
  }, [currentActiveFocusSession]);

  async function runDockAction(action: FocusDockAction) {
    try {
      await action();
      setErrorMessage(null);
    } catch (error) {
      if (error instanceof AppFocusError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  function renderErrorMessage() {
    if (errorMessage === null) {
      return null;
    }

    return (
      <span className="focus-dock__error" id={errorId} role="status">
        {errorMessage}
      </span>
    );
  }

  async function runPrimaryAction(session: FocusSession) {
    if (isCompletedFocusSession(session)) {
      await restartDefaultFocusSession(focusActionInput);
      return;
    }

    switch (session.intervalState) {
      case "Focus":
        await endActiveFocusSession(focusActionInput);
        return;
      case "Transition":
      case "Break":
      case "AwaitingNextFocus":
        await startNextFocusInterval(focusActionInput);
        return;
    }
  }

  if (currentActiveFocusSession === null) {
    return (
      <section
        aria-label={t("focus.dock.heading")}
        className={FOCUS_DOCK_CLASS_NAME}
      >
        <div className="focus-dock__body">
          <div className="focus-dock__actions">
            <Button
              aria-describedby={errorDescriptionId}
              disabled={isActionDisabled}
              onClick={() => {
                void runDockAction(() =>
                  startDefaultFocusSession(focusActionInput),
                );
              }}
              size="compact"
              type="button"
              variant="secondary"
            >
              {t("focus.dock.start")}
            </Button>
          </div>
          {renderErrorMessage()}
        </div>
      </section>
    );
  }

  const isCompletedSession = isCompletedFocusSession(currentActiveFocusSession);
  const focusDockStatusLabel = getFocusDockStatusLabel(
    currentActiveFocusSession,
    t,
  );

  const primaryActionLabel = isCompletedSession
    ? t("focus.dock.start")
    : getFocusDockPrimaryActionLabel(currentActiveFocusSession, t);

  return (
    <section
      aria-label={t("focus.dock.heading")}
      className={FOCUS_DOCK_CLASS_NAME}
      data-state={getFocusDockDataState(currentActiveFocusSession)}
    >
      <div className="focus-dock__body">
        <span className="focus-dock__status">{focusDockStatusLabel}</span>
        <div className="focus-dock__actions">
          <Button
            aria-describedby={errorDescriptionId}
            disabled={isActionDisabled}
            onClick={() => {
              void runDockAction(() =>
                runPrimaryAction(currentActiveFocusSession),
              );
            }}
            size="compact"
            type="button"
            variant="secondary"
          >
            {primaryActionLabel}
          </Button>
        </div>
        {renderErrorMessage()}
      </div>
    </section>
  );
}

function getFocusDockPrimaryActionLabel(
  session: FocusSession,
  t: AppTranslate,
) {
  switch (session.intervalState) {
    case "Focus":
      return t("focus.action.end");
    case "Transition":
      return t("focus.status.action.keepFocusing");
    case "Break":
      return t("focus.status.action.skipBreak");
    case "AwaitingNextFocus":
      return t("focus.status.action.startNext");
  }
}

function getFocusDockStatusLabel(session: FocusSession, t: AppTranslate) {
  if (isCompletedFocusSession(session)) {
    return t("focus.dock.state.complete");
  }

  const timerLabel = formatRemainingTimerLabel(session);

  switch (session.intervalState) {
    case "Focus":
      return formatFocusDockStatusLabel(
        t("focus.dock.state.active"),
        timerLabel,
      );
    case "Transition":
    case "AwaitingNextFocus":
      return formatFocusDockStatusLabel(
        t("focus.dock.state.paused"),
        timerLabel,
      );
    case "Break":
      return formatFocusDockStatusLabel(t("focus.status.break"), timerLabel);
  }
}

function getFocusDockDataState(session: FocusSession) {
  if (isCompletedFocusSession(session)) {
    return "complete";
  }

  switch (session.intervalState) {
    case "Focus":
      return "focus";
    case "Transition":
    case "AwaitingNextFocus":
      return "paused";
    case "Break":
      return "break";
  }
}

function formatFocusDockStatusLabel(stateLabel: string, timerLabel: string) {
  return `${stateLabel}${FOCUS_DOCK_TIMER_SEPARATOR}${timerLabel}`;
}

function isCompletedFocusSession(session: FocusSession) {
  return (
    session.intervalState === "AwaitingNextFocus" &&
    session.currentInterval === "Focus" &&
    session.plannedFocusIntervalCount !== null &&
    session.completedFocusIntervalCount >= session.plannedFocusIntervalCount
  );
}

function formatRemainingTimerLabel(session: FocusSession) {
  const remainingSeconds = session.remainingSeconds ?? 0;
  const normalizedSeconds = remainingSeconds <= 0 ? 0 : remainingSeconds;
  const minutes = Math.floor(normalizedSeconds / 60);
  const seconds = normalizedSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
