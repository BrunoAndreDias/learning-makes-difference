import { useEffect, useId, useState } from "react";

import { Button, type ButtonVariant } from "../../design-system/button";
import { useAppTranslation } from "../language";
import {
  type AppFocusContext,
  AppFocusError,
  type FocusSession,
} from "./focus";
import { useFocusTimerTick } from "./focus-session-start-control";
import type { AppPersistentFocusContext } from "./persistent-focus";

const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;
const FOCUS_DOCK_TIMER_SEPARATOR = " \u00b7 ";

type FocusDockVariant = "pill" | "sidebar";

export function FocusDock({
  activeFocusSession,
  focus,
  persistentFocus,
  userId,
  variant = "sidebar",
}: Readonly<{
  activeFocusSession: FocusSession | null;
  focus: AppFocusContext;
  persistentFocus?: AppPersistentFocusContext;
  userId: string | null;
  variant?: FocusDockVariant;
}>) {
  const { t } = useAppTranslation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorId = useId();
  useFocusTimerTick(activeFocusSession);
  const currentActiveFocusSession =
    userId === null ? activeFocusSession : focus.getActiveSession({ userId });
  const isSidebarVariant = variant === "sidebar";
  const primaryActionVariant: ButtonVariant = "secondary";

  useEffect(() => {
    if (currentActiveFocusSession === null) {
      return;
    }

    setErrorMessage(null);
  }, [currentActiveFocusSession]);

  async function runDockAction(action: () => Promise<void> | void) {
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

  if (currentActiveFocusSession === null) {
    return (
      <section
        aria-label={t("focus.dock.heading")}
        className={`focus-dock focus-dock--${variant}`}
      >
        {isSidebarVariant ? (
          <p className="focus-dock__heading">{t("focus.dock.heading")}</p>
        ) : null}
        <div className="focus-dock__body">
          <div className="focus-dock__actions">
            <Button
              aria-describedby={errorMessage === null ? undefined : errorId}
              disabled={userId === null}
              onClick={() => {
                void runDockAction(async () => {
                  if (userId === null) {
                    return;
                  }

                  if (persistentFocus === undefined) {
                    focus.startFocusSession({
                      breakIntervalMinutes: DEFAULT_BREAK_MINUTES,
                      focusIntervalMinutes: DEFAULT_FOCUS_MINUTES,
                      plannedFocusIntervalCount: null,
                      userId,
                    });
                    return;
                  }

                  await persistentFocus.startFocusSession(userId, {
                    breakIntervalMinutes: DEFAULT_BREAK_MINUTES,
                    focusIntervalMinutes: DEFAULT_FOCUS_MINUTES,
                    plannedFocusIntervalCount: null,
                  });
                });
              }}
              size="compact"
              type="button"
              variant={primaryActionVariant}
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
  const primaryAction = isCompletedSession
    ? async () => {
        if (userId === null) {
          return;
        }

        if (persistentFocus === undefined) {
          focus.endFocusSession({ userId });
          focus.startFocusSession({
            breakIntervalMinutes: DEFAULT_BREAK_MINUTES,
            focusIntervalMinutes: DEFAULT_FOCUS_MINUTES,
            plannedFocusIntervalCount: null,
            userId,
          });
          return;
        }

        await persistentFocus.endFocusSession(userId);
        await persistentFocus.startFocusSession(userId, {
          breakIntervalMinutes: DEFAULT_BREAK_MINUTES,
          focusIntervalMinutes: DEFAULT_FOCUS_MINUTES,
          plannedFocusIntervalCount: null,
        });
      }
    : async () => {
        if (userId === null) {
          return;
        }

        switch (currentActiveFocusSession.intervalState) {
          case "Focus":
            if (persistentFocus === undefined) {
              focus.endFocusSession({ userId });
              return;
            }

            await persistentFocus.endFocusSession(userId);
            return;
          case "Transition":
          case "Break":
          case "AwaitingNextFocus":
            if (persistentFocus === undefined) {
              focus.startNextFocusInterval({ userId });
              return;
            }

            await persistentFocus.startNextFocusInterval(userId);
            return;
        }
      };

  const showEndAction =
    isSidebarVariant &&
    !isCompletedSession &&
    currentActiveFocusSession.intervalState !== "Focus";

  return (
    <section
      aria-label={t("focus.dock.heading")}
      className={`focus-dock focus-dock--${variant}`}
      data-state={getFocusDockDataState(currentActiveFocusSession)}
    >
      {isSidebarVariant ? (
        <p className="focus-dock__heading">{t("focus.dock.heading")}</p>
      ) : null}
      <div className="focus-dock__body">
        <span className="focus-dock__status">{focusDockStatusLabel}</span>
        <div className="focus-dock__actions">
          <Button
            aria-describedby={errorMessage === null ? undefined : errorId}
            disabled={userId === null}
            onClick={() => {
              void runDockAction(primaryAction);
            }}
            size="compact"
            type="button"
            variant={primaryActionVariant}
          >
            {primaryActionLabel}
          </Button>
          {showEndAction ? (
            <Button
              aria-describedby={errorMessage === null ? undefined : errorId}
              disabled={userId === null}
              onClick={() => {
                void runDockAction(async () => {
                  if (userId === null) {
                    return;
                  }

                  if (persistentFocus === undefined) {
                    focus.endFocusSession({ userId });
                    return;
                  }

                  await persistentFocus.endFocusSession(userId);
                });
              }}
              size="compact"
              type="button"
            >
              {t("focus.action.end")}
            </Button>
          ) : null}
        </div>
        {renderErrorMessage()}
      </div>
    </section>
  );
}

function getFocusDockPrimaryActionLabel(
  session: FocusSession,
  t: ReturnType<typeof useAppTranslation>["t"],
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

function getFocusDockStatusLabel(
  session: FocusSession,
  t: ReturnType<typeof useAppTranslation>["t"],
) {
  if (isCompletedFocusSession(session)) {
    return t("focus.dock.state.complete");
  }

  switch (session.intervalState) {
    case "Focus":
      return `${t("focus.dock.state.active")}${FOCUS_DOCK_TIMER_SEPARATOR}${formatRemainingTimerLabel(session)}`;
    case "Transition":
      return `${t("focus.dock.state.paused")}${FOCUS_DOCK_TIMER_SEPARATOR}${formatRemainingTimerLabel(session)}`;
    case "Break":
      return `${t("focus.status.break")}${FOCUS_DOCK_TIMER_SEPARATOR}${formatRemainingTimerLabel(session)}`;
    case "AwaitingNextFocus":
      return `${t("focus.dock.state.paused")}${FOCUS_DOCK_TIMER_SEPARATOR}${formatRemainingTimerLabel(session)}`;
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
      return "paused";
    case "Break":
      return "break";
    case "AwaitingNextFocus":
      return "paused";
  }
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
