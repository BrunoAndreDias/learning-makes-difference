import type { AppFocusContext } from "./focus";
import type { AppPersistentFocusContext } from "./persistent-focus";

const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;

type FocusSessionActionInput = {
  focus: AppFocusContext;
  persistentFocus: AppPersistentFocusContext | undefined;
  userId: string | null;
};

function createDefaultFocusSessionInput() {
  return {
    breakIntervalMinutes: DEFAULT_BREAK_MINUTES,
    focusIntervalMinutes: DEFAULT_FOCUS_MINUTES,
    plannedFocusIntervalCount: null,
  };
}

export async function startDefaultFocusSession({
  focus,
  persistentFocus,
  userId,
}: FocusSessionActionInput) {
  if (userId === null) {
    return;
  }

  const input = createDefaultFocusSessionInput();

  if (persistentFocus === undefined) {
    focus.startFocusSession({ ...input, userId });
    return;
  }

  await persistentFocus.startFocusSession(userId, input);
}

export async function endActiveFocusSession({
  focus,
  persistentFocus,
  userId,
}: FocusSessionActionInput) {
  if (userId === null) {
    return;
  }

  if (persistentFocus === undefined) {
    focus.endFocusSession({ userId });
    return;
  }

  await persistentFocus.endFocusSession(userId);
}

export async function startNextFocusInterval({
  focus,
  persistentFocus,
  userId,
}: FocusSessionActionInput) {
  if (userId === null) {
    return;
  }

  if (persistentFocus === undefined) {
    focus.startNextFocusInterval({ userId });
    return;
  }

  await persistentFocus.startNextFocusInterval(userId);
}

export async function restartDefaultFocusSession({
  focus,
  persistentFocus,
  userId,
}: FocusSessionActionInput) {
  if (userId === null) {
    return;
  }

  const input = createDefaultFocusSessionInput();

  if (persistentFocus === undefined) {
    focus.endFocusSession({ userId });
    focus.startFocusSession({ ...input, userId });
    return;
  }

  await persistentFocus.endFocusSession(userId);
  await persistentFocus.startFocusSession(userId, input);
}
