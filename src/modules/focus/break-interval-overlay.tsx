import { useEffect, useRef } from "react";

import { Button } from "../../design-system/button";

export function BreakIntervalOverlay({
  onSkipBreak,
}: Readonly<{
  onSkipBreak: () => void;
}>) {
  const skipBreakButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    skipBreakButtonRef.current?.focus();
  }, []);

  return (
    <section
      aria-label="Break interval reminder"
      aria-live="assertive"
      className="focus-break-overlay"
    >
      <div className="focus-break-overlay__panel">
        <p className="focus-break-overlay__eyebrow">Break in progress</p>
        <p className="focus-break-overlay__copy">
          Rest first. Skip the break to start the next focus interval.
        </p>
        <Button
          onClick={onSkipBreak}
          ref={skipBreakButtonRef}
          type="button"
          variant="primary"
        >
          Skip break
        </Button>
      </div>
    </section>
  );
}
