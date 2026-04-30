import type { AppFocusContext } from "../domain/focus";

export function BreakIntervalOverlay({
  focus,
  userId,
}: Readonly<{
  focus: AppFocusContext;
  userId: string;
}>) {
  return (
    <section
      aria-label="Break interval reminder"
      className="focus-break-overlay"
      role="region"
    >
      <div className="focus-break-overlay__panel">
        <p className="focus-break-overlay__eyebrow">Break in progress</p>
        <p className="focus-break-overlay__copy">
          Rest first. Skip the break to start the next focus interval.
        </p>
        <button
          className="notes-action notes-action-primary"
          onClick={() => {
            focus.startNextFocusInterval({
              userId,
            });
          }}
          type="button"
        >
          Skip break
        </button>
      </div>
    </section>
  );
}
