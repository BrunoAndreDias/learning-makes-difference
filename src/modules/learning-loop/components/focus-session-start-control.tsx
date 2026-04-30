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
    const buttonLabel = `End focus · ${getRemainingMinuteLabel(activeFocusSession)}`;

    return (
      <fieldset className="app-focus-session-status tag-row">
        <legend className="sr-only">Active focus session</legend>
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
            {buttonLabel}
          </button>
        )}
        <span
          aria-label="Focus session status"
          className="sr-only"
          role="status"
        >
          {getFocusStatusMessage(activeFocusSession)}
        </span>
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

function getFocusStatusMessage(session: FocusSession) {
  const remainingLabel = getRemainingMinuteLabel(session);

  switch (session.intervalState) {
    case "Transition":
      return `Transition window: ${remainingLabel} left`;
    case "Break":
      return `Break: ${remainingLabel} left`;
    case "AwaitingNextFocus":
      return session.isStale ? "Focus session stale" : "Ready for next focus";
    case "Focus":
      return `Focus: ${remainingLabel} left`;
  }
}

function getRemainingMinuteLabel(session: FocusSession) {
  const remainingSeconds = session.remainingSeconds ?? 0;
  const remainingMinutes =
    remainingSeconds <= 0 ? 0 : Math.ceil(remainingSeconds / 60);

  return `${remainingMinutes} ${remainingMinutes === 1 ? "min" : "mins"}`;
}

function parseOptionalNumber(value: string) {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  return Number(trimmedValue);
}
