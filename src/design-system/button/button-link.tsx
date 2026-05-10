import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { ButtonVariant } from "./button";

type ButtonLinkProps = Omit<LinkProps, "className"> & {
  children: ReactNode;
  className?: string;
  iconOnly?: boolean;
  variant?: ButtonVariant;
};

const variantClassNames: Record<ButtonVariant, string> = {
  danger: "notes-action-danger",
  primary: "notes-action-primary",
  secondary: "notes-action-secondary",
  standard: "",
};

export function ButtonLink({
  children,
  className,
  iconOnly = false,
  variant = "standard",
  ...props
}: Readonly<ButtonLinkProps>) {
  const baseClassName = iconOnly ? "notes-icon-button" : "notes-action";
  const variantClassName = variantClassNames[variant];
  const composedClassName = [baseClassName, variantClassName, className]
    .filter(Boolean)
    .join(" ");

  return (
    <Link className={composedClassName} {...props}>
      {children}
    </Link>
  );
}
