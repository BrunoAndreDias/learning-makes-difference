import { Link, type LinkProps } from "@tanstack/react-router";
import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type BreadcrumbItem = {
  anchorProps?: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;
  current?: boolean;
  href?: string;
  label: ReactNode;
  linkProps?: Omit<LinkProps, "children" | "className" | "to">;
  to?: LinkProps["to"];
};

type BreadcrumbProps = Omit<
  HTMLAttributes<HTMLElement>,
  "aria-label" | "children"
> & {
  "aria-label"?: string;
  items: readonly BreadcrumbItem[];
};

export function Breadcrumb({
  "aria-label": ariaLabel = "Breadcrumb",
  className,
  items,
  ...props
}: Readonly<BreadcrumbProps>) {
  const composedClassName = ["breadcrumb", className].filter(Boolean).join(" ");

  return (
    <nav aria-label={ariaLabel} className={composedClassName} {...props}>
      <ol className="breadcrumb-list">
        {items.map((item, index) => {
          const isCurrent = item.current === true || index === items.length - 1;
          const key =
            typeof item.label === "string" ? item.label : `breadcrumb-${index}`;

          return (
            <li className="breadcrumb-item" key={key}>
              {index === 0 ? null : (
                <span aria-hidden="true" className="breadcrumb-separator">
                  /
                </span>
              )}
              {isCurrent ||
              (item.href === undefined && item.to === undefined) ? (
                <span
                  aria-current={isCurrent ? "page" : undefined}
                  className={
                    isCurrent ? "breadcrumb-current" : "breadcrumb-label"
                  }
                >
                  {item.label}
                </span>
              ) : item.to !== undefined ? (
                <Link
                  className="breadcrumb-link"
                  to={item.to}
                  {...item.linkProps}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  className="breadcrumb-link"
                  href={item.href}
                  {...item.anchorProps}
                >
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
