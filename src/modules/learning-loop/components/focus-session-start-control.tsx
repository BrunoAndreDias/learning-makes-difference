import { useEffect, useId, useRef, useState } from "react";
import {
  type AppFocusContext,
  AppFocusError,
  type FocusSession,
} from "../domain/focus";

type FocusSessionStartValues = {
  breakMinutes: string;
  focusMinutes: string;
  plannedFocusIntervals: string;
};

const DEFAULT_FOCUS_MINUTES = "25";
const DEFAULT_BREAK_MINUTES = "5";
const EMPTY_PLANNED_FOCUS_INTERVALS = "";
const DEFAULT_FOCUS_SESSION_START_VALUES: FocusSessionStartValues = {
  breakMinutes: DEFAULT_BREAK_MINUTES,
  focusMinutes: DEFAULT_FOCUS_MINUTES,
  plannedFocusIntervals: EMPTY_PLANNED_FOCUS_INTERVALS,
};

export function FocusSessionStartControl({
  activeFocusSession,
  focus,
  userId,
}: Readonly<{
  activeFocusSession: FocusSession | null;
  focus: AppFocusContext;
  userId: string | null;
}>) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorId = useId();
  const focusSessionButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousSessionStateRef = useRef<FocusSession["intervalState"] | null>(
    null,
  );

  useEffect(() => {
    if (activeFocusSession === null) {
      return;
    }

    setErrorMessage(null);
  }, [activeFocusSession]);

  useEffect(() => {
    if (activeFocusSession === null) {
      previousSessionStateRef.current = null;
      return;
    }

    const previousSessionState = previousSessionStateRef.current;
    previousSessionStateRef.current = activeFocusSession.intervalState;

    if (
      previousSessionState === activeFocusSession.intervalState &&
      previousSessionState !== null
    ) {
      return;
    }

    if (activeFocusSession.intervalState === "Break") {
      return;
    }

    focusSessionButtonRef.current?.focus();
  }, [activeFocusSession]);

  if (activeFocusSession !== null) {
    const focusStatus = getFocusStatus(activeFocusSession);

    return (
      <fieldset className="app-focus-session-status tag-row">
        <legend className="sr-only">Active focus session</legend>
        <span aria-atomic="true" aria-label="Focus timer status" role="status">
          <span className="sr-only">{focusStatus.prefix}</span>
          {focusStatus.label}
        </span>
        {userId === null ? null : (
          <button
            className="notes-action notes-action-primary"
            onClick={() => {
              focus.endFocusSession({
                userId,
              });
            }}
            ref={focusSessionButtonRef}
            type="button"
          >
            End focus
          </button>
        )}
      </fieldset>
    );
  }

  function startFocusSessionFromValues(input: FocusSessionStartValues) {
    if (userId === null) {
      return;
    }

    try {
      focus.startFocusSession({
        breakIntervalMinutes: Number(input.breakMinutes),
        focusIntervalMinutes: Number(input.focusMinutes),
        plannedFocusIntervalCount: parseOptionalNumber(
          input.plannedFocusIntervals,
        ),
        userId,
      });
      setErrorMessage(null);
    } catch (error) {
      if (error instanceof AppFocusError) {
        setErrorMessage(error.message);
        return;
      }

      throw error;
    }
  }

  function startDefaultFocusSession() {
    startFocusSessionFromValues(DEFAULT_FOCUS_SESSION_START_VALUES);
  }

  return (
    <div className="app-focus-session-start tag-row">
      <button
        className="notes-action notes-action-primary"
        onClick={startDefaultFocusSession}
        type="button"
      >
        Start Focus
      </button>
      {errorMessage === null ? null : (
        <span id={errorId} role="status">
          {errorMessage}
        </span>
      )}
    </div>
  );
}

function getFocusStatus(session: FocusSession) {
  if (session.intervalState === "AwaitingNextFocus") {
    return {
      label: session.isStale ? "Focus session stale" : "Ready for next focus",
      prefix: "",
    };
  }

  switch (session.intervalState) {
    case "Transition":
      return {
        label: getRemainingTimerLabel(session),
        prefix: "Transition window: ",
      };
    case "Break":
      return {
        label: getRemainingTimerLabel(session),
        prefix: "Break: ",
      };
    case "Focus":
      return {
        label: getRemainingTimerLabel(session),
        prefix: "Focus: ",
      };
  }
}

function getRemainingTimerLabel(session: FocusSession) {
  const remainingSeconds = session.remainingSeconds ?? 0;
  const normalizedSeconds = remainingSeconds <= 0 ? 0 : remainingSeconds;
  const minutes = Math.floor(normalizedSeconds / 60);
  const seconds = normalizedSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")} left`;
}

function parseOptionalNumber(value: string) {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  return Number(trimmedValue);
}
