import { useEffect, useId, useRef, useState } from "react";
import {
  type AppFocusContext,
  AppFocusError,
  type FocusSession,
} from "./focus";
import type { AppPersistentFocusContext } from "./persistent-focus";

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
  persistentFocus,
  userId,
}: Readonly<{
  activeFocusSession: FocusSession | null;
  focus: AppFocusContext;
  persistentFocus?: AppPersistentFocusContext;
  userId: string | null;
}>) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorId = useId();
  const focusSessionButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousSessionStateRef = useRef<FocusSession["intervalState"] | null>(
    null,
  );
  useFocusTimerTick(activeFocusSession);
  const currentActiveFocusSession =
    userId === null ? activeFocusSession : focus.getActiveSession({ userId });

  useEffect(() => {
    if (currentActiveFocusSession === null) {
      return;
    }

    setErrorMessage(null);
  }, [currentActiveFocusSession]);

  useEffect(() => {
    if (currentActiveFocusSession === null) {
      previousSessionStateRef.current = null;
      return;
    }

    const previousSessionState = previousSessionStateRef.current;
    previousSessionStateRef.current = currentActiveFocusSession.intervalState;

    if (
      previousSessionState === currentActiveFocusSession.intervalState &&
      previousSessionState !== null
    ) {
      return;
    }

    if (currentActiveFocusSession.intervalState === "Break") {
      return;
    }

    focusSessionButtonRef.current?.focus();
  }, [currentActiveFocusSession]);

  if (currentActiveFocusSession !== null) {
    const focusStatus = getFocusStatus(currentActiveFocusSession);

    async function startNewFocusSession() {
      if (userId === null) {
        return;
      }

      try {
        if (persistentFocus === undefined) {
          focus.endFocusSession({ userId });
          focus.startFocusSession({
            breakIntervalMinutes: Number(DEFAULT_BREAK_MINUTES),
            focusIntervalMinutes: Number(DEFAULT_FOCUS_MINUTES),
            plannedFocusIntervalCount: null,
            userId,
          });
        } else {
          await persistentFocus.endFocusSession(userId);
          await persistentFocus.startFocusSession(userId, {
            breakIntervalMinutes: Number(DEFAULT_BREAK_MINUTES),
            focusIntervalMinutes: Number(DEFAULT_FOCUS_MINUTES),
            plannedFocusIntervalCount: null,
          });
        }
        setErrorMessage(null);
      } catch (error) {
        if (error instanceof AppFocusError) {
          setErrorMessage(error.message);
          return;
        }

        throw error;
      }
    }

    return (
      <fieldset className="app-focus-session-status tag-row">
        <legend className="sr-only">Active focus session</legend>
        {userId === null ? null : (
          <>
            {currentActiveFocusSession.isStale ? (
              <button
                className="notes-action notes-action-primary"
                onClick={() => {
                  void startNewFocusSession();
                }}
                ref={focusSessionButtonRef}
                type="button"
              >
                Start new focus
              </button>
            ) : (
              <button
                className="notes-action notes-action-primary"
                onClick={() => {
                  if (persistentFocus === undefined) {
                    focus.endFocusSession({
                      userId,
                    });
                    return;
                  }

                  void persistentFocus.endFocusSession(userId);
                }}
                ref={focusSessionButtonRef}
                type="button"
              >
                End focus
                {focusStatus.isPersistentState ? null : (
                  <span aria-hidden="true">{focusStatus.label}</span>
                )}
              </button>
            )}
            {focusStatus.isPersistentState &&
            !currentActiveFocusSession.isStale ? (
              <span className="tag" role="status">
                {focusStatus.label}
              </span>
            ) : null}
            {errorMessage === null ? null : (
              <span id={errorId} role="status">
                {errorMessage}
              </span>
            )}
          </>
        )}
      </fieldset>
    );
  }

  async function startFocusSessionFromValues(input: FocusSessionStartValues) {
    if (userId === null) {
      return;
    }

    try {
      if (persistentFocus === undefined) {
        focus.startFocusSession({
          breakIntervalMinutes: Number(input.breakMinutes),
          focusIntervalMinutes: Number(input.focusMinutes),
          plannedFocusIntervalCount: parseOptionalNumber(
            input.plannedFocusIntervals,
          ),
          userId,
        });
      } else {
        await persistentFocus.startFocusSession(userId, {
          breakIntervalMinutes: Number(input.breakMinutes),
          focusIntervalMinutes: Number(input.focusMinutes),
          plannedFocusIntervalCount: parseOptionalNumber(
            input.plannedFocusIntervals,
          ),
        });
      }
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
    void startFocusSessionFromValues(DEFAULT_FOCUS_SESSION_START_VALUES);
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

export function useFocusTimerTick(session: FocusSession | null) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (session?.stateEndsAt === null || session?.stateEndsAt === undefined) {
      return;
    }

    const timerId = window.setInterval(() => {
      setTick((currentTick) => currentTick + 1);
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [session?.stateEndsAt]);
}

function getFocusStatus(session: FocusSession) {
  if (session.intervalState === "AwaitingNextFocus") {
    return {
      isPersistentState: true,
      label: session.isStale ? "Focus session stale" : "Ready for next focus",
      prefix: "",
    };
  }

  switch (session.intervalState) {
    case "Transition":
      return {
        isPersistentState: false,
        label: getRemainingTimerLabel(session),
        prefix: "Transition window: ",
      };
    case "Break":
      return {
        isPersistentState: false,
        label: getRemainingTimerLabel(session),
        prefix: "Break: ",
      };
    case "Focus":
      return {
        isPersistentState: false,
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

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function parseOptionalNumber(value: string) {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  return Number(trimmedValue);
}
