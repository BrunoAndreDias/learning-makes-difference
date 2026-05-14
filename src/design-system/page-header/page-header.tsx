import type { HTMLAttributes, ReactNode, Ref } from "react";

type PageHeaderHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

type PageHeaderHeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  ref?: Ref<HTMLHeadingElement>;
};

type PageHeaderProps = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "title"
> & {
  actions?: ReactNode;
  actionsClassName?: string;
  beforeTitle?: ReactNode;
  children?: ReactNode;
  copyClassName?: string;
  description?: ReactNode;
  headingLevel?: PageHeaderHeadingLevel;
  headingProps?: PageHeaderHeadingProps;
  title: ReactNode;
};

export function PageHeader({
  actions,
  actionsClassName,
  beforeTitle,
  children,
  className,
  copyClassName,
  description,
  headingLevel = 3,
  headingProps,
  title,
  ...props
}: Readonly<PageHeaderProps>) {
  const HeadingTag = `h${headingLevel}` as const;
  const composedClassName = ["page-header", className]
    .filter(Boolean)
    .join(" ");
  const composedCopyClassName = ["page-header__copy", copyClassName]
    .filter(Boolean)
    .join(" ");
  const composedActionsClassName = ["page-header__actions", actionsClassName]
    .filter(Boolean)
    .join(" ");
  const { className: headingClassName, ...resolvedHeadingProps } =
    headingProps ?? {};
  const composedHeadingClassName = ["page-header__title", headingClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={composedClassName} {...props}>
      <div className={composedCopyClassName}>
        {beforeTitle === undefined || beforeTitle === null ? null : (
          <div className="page-header__before-title">{beforeTitle}</div>
        )}
        <HeadingTag
          className={composedHeadingClassName}
          {...resolvedHeadingProps}
        >
          {title}
        </HeadingTag>
        {description === undefined || description === null ? null : (
          <p className="page-header__description">{description}</p>
        )}
        {children === undefined || children === null ? null : (
          <div className="page-header__content">{children}</div>
        )}
      </div>
      {actions === undefined || actions === null ? null : (
        <div className={composedActionsClassName}>{actions}</div>
      )}
    </header>
  );
}
