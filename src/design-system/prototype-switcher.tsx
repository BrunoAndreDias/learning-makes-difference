import { useEffect } from "react";

export type PrototypeVariantOption<TVariant extends string> = {
  key: TVariant;
  label: string;
};

type PrototypeSwitcherProps<TVariant extends string> = {
  current: TVariant;
  onChange: (variant: TVariant) => void;
  variants: readonly PrototypeVariantOption<TVariant>[];
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

export function PrototypeSwitcher<TVariant extends string>({
  current,
  onChange,
  variants,
}: Readonly<PrototypeSwitcherProps<TVariant>>) {
  const currentIndex = variants.findIndex((variant) => variant.key === current);
  const safeCurrentIndex = currentIndex === -1 ? 0 : currentIndex;
  const currentVariant = variants[safeCurrentIndex];

  function getRelativeVariant(offset: -1 | 1) {
    const nextIndex =
      (safeCurrentIndex + offset + variants.length) % variants.length;

    return variants[nextIndex].key;
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onChange(getRelativeVariant(-1));
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        onChange(getRelativeVariant(1));
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  });

  if (import.meta.env.PROD || variants.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Prototype variant switcher" className="prototype-switcher">
      <button
        aria-label="Previous prototype variant"
        className="prototype-switcher__button"
        onClick={() => onChange(getRelativeVariant(-1))}
        type="button"
      >
        &lt;
      </button>
      <span className="prototype-switcher__label">
        {currentVariant.key} - {currentVariant.label}
      </span>
      <button
        aria-label="Next prototype variant"
        className="prototype-switcher__button"
        onClick={() => onChange(getRelativeVariant(1))}
        type="button"
      >
        &gt;
      </button>
    </nav>
  );
}
