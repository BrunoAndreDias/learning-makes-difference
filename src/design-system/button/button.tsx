import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

export type ButtonVariant = "danger" | "primary" | "secondary" | "standard";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  iconOnly?: boolean;
  ref?: Ref<HTMLButtonElement>;
  variant?: ButtonVariant;
};

const variantClassNames: Record<ButtonVariant, string> = {
  danger: "notes-action-danger",
  primary: "notes-action-primary",
  secondary: "notes-action-secondary",
  standard: "",
};

export function Button({
  children,
  className,
  iconOnly = false,
  variant = "standard",
  ...props
}: Readonly<ButtonProps>) {
  const baseClassName = iconOnly ? "notes-icon-button" : "notes-action";
  const variantClassName = variantClassNames[variant];
  const composedClassName = [baseClassName, variantClassName, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={composedClassName} {...props}>
      {children}
    </button>
  );
}
