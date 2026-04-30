export function BreakIntervalOverlay({
  onSkipBreak,
}: Readonly<{
  onSkipBreak: () => void;
}>) {
  return (
    <section
      aria-label="Break interval reminder"
      className="focus-break-overlay"
    >
      <div className="focus-break-overlay__panel">
        <p className="focus-break-overlay__eyebrow">Break in progress</p>
        <p className="focus-break-overlay__copy">
          Rest first. Skip the break to start the next focus interval.
        </p>
        <button
          className="notes-action notes-action-primary"
          onClick={onSkipBreak}
          type="button"
        >
          Skip break
        </button>
      </div>
    </section>
  );
}
