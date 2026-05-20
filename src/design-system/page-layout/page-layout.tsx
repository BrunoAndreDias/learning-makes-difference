import type {
  ComponentPropsWithoutRef,
  HTMLAttributes,
  ReactNode,
} from "react";

import { PageHeader } from "../page-header";

type PageLayoutTag = "article" | "div" | "main" | "section";

type SharedPageHeaderProps = Pick<
  ComponentPropsWithoutRef<typeof PageHeader>,
  | "actions"
  | "actionsClassName"
  | "beforeTitle"
  | "copyClassName"
  | "description"
  | "headingLevel"
  | "headingProps"
  | "title"
>;

type PageLayoutProps = Omit<HTMLAttributes<HTMLElement>, "children" | "title"> &
  SharedPageHeaderProps & {
    afterHeader?: ReactNode;
    as?: PageLayoutTag;
    beforeHeader?: ReactNode;
    bodyClassName?: string;
    children?: ReactNode;
    headerClassName?: string;
    heroClassName?: string;
  };

export function PageLayout({
  actions,
  actionsClassName,
  afterHeader,
  as = "section",
  beforeHeader,
  beforeTitle,
  bodyClassName,
  children,
  className,
  copyClassName,
  description,
  headerClassName,
  headingLevel = 3,
  headingProps,
  heroClassName,
  title,
  ...props
}: Readonly<PageLayoutProps>) {
  const ContainerTag = as;
  const composedClassName = ["page-layout", className]
    .filter(Boolean)
    .join(" ");
  const composedHeroClassName = ["page-layout__hero", heroClassName]
    .filter(Boolean)
    .join(" ");
  const composedHeaderClassName = ["page-layout__header", headerClassName]
    .filter(Boolean)
    .join(" ");
  const composedBodyClassName = ["page-layout__body", bodyClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <ContainerTag className={composedClassName} {...props}>
      <div className={composedHeroClassName}>
        {beforeHeader}
        <PageHeader
          actions={actions}
          actionsClassName={actionsClassName}
          beforeTitle={beforeTitle}
          className={composedHeaderClassName}
          copyClassName={copyClassName}
          description={description}
          headingLevel={headingLevel}
          headingProps={headingProps}
          title={title}
        />
        {afterHeader}
      </div>

      {children === undefined || children === null ? null : (
        <div className={composedBodyClassName}>{children}</div>
      )}
    </ContainerTag>
  );
}
