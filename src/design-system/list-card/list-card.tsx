import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  Ref,
} from "react";

type ListCardProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  chip?: ReactNode;
  chipClassName?: string;
  chipProps?: HTMLAttributes<HTMLSpanElement>;
  description: ReactNode;
  ref?: Ref<HTMLButtonElement>;
  selected?: boolean;
  title: ReactNode;
};

export function ListCard({
  chip,
  chipClassName,
  chipProps,
  className,
  description,
  selected = false,
  title,
  ...props
}: Readonly<ListCardProps>) {
  const composedClassName = ["list-card", className].filter(Boolean).join(" ");
  const composedChipClassName = ["list-card__chip", chipClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={composedClassName}
      data-selected={selected ? "true" : undefined}
      type="button"
      {...props}
    >
      <span className="list-card__content">
        <strong className="list-card__title">{title}</strong>
        <span className="list-card__description">{description}</span>
      </span>
      {chip === undefined || chip === null ? null : (
        <span className={composedChipClassName} {...chipProps}>
          {chip}
        </span>
      )}
    </button>
  );
}
