import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { ButtonSize, ButtonVariant } from "./button";

type ButtonLinkProps = Omit<LinkProps, "className"> & {
  children: ReactNode;
  className?: string;
  iconOnly?: boolean;
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

export function ButtonLink({
  children,
  className,
  iconOnly = false,
  size = "regular",
  variant = "standard",
  ...props
}: Readonly<ButtonLinkProps>) {
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
    <Link className={composedClassName} {...props}>
      {children}
    </Link>
  );
}
