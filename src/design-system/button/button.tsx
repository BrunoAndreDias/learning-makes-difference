import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

export type ButtonVariant = "danger" | "primary" | "secondary" | "standard";
export type ButtonSize = "compact" | "regular";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  iconOnly?: boolean;
  ref?: Ref<HTMLButtonElement>;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const variantClassNames: Record<ButtonVariant, string> = {
  danger: "notes-action-danger",
  primary: "notes-action-primary",
  secondary: "notes-action-secondary",
  standard: "",
};

const sizeClassNames: Record<ButtonSize, string> = {
  compact: "notes-action-compact",
  regular: "",
};

export function Button({
  children,
  className,
  iconOnly = false,
  size = "regular",
  variant = "standard",
  ...props
}: Readonly<ButtonProps>) {
  const baseClassName = iconOnly ? "notes-icon-button" : "notes-action";
  const sizeClassName = sizeClassNames[size];
  const variantClassName = variantClassNames[variant];
  const composedClassName = [
    baseClassName,
    sizeClassName,
    variantClassName,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={composedClassName} {...props}>
      {children}
    </button>
  );
}
