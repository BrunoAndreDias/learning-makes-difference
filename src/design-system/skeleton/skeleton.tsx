import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import "./skeleton.css";

type SkeletonDimension = number | string;
type SkeletonTag = "div" | "span";
type SkeletonRadius = "default" | "pill";
type SkeletonStyle = CSSProperties & {
  "--skeleton-height"?: string;
  "--skeleton-width"?: string;
};

type SkeletonBlockProps = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "style"
> & {
  animated?: boolean;
  as?: SkeletonTag;
  height?: SkeletonDimension;
  radius?: SkeletonRadius;
  style?: CSSProperties;
  width?: SkeletonDimension;
};

type SkeletonTextProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  animated?: boolean;
  as?: SkeletonTag;
  lineHeight?: SkeletonDimension;
  lineWidths?: readonly SkeletonDimension[];
};

type PageReadinessStateProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  label: string;
};

type PageReadinessCardProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  animated?: boolean;
  badgeWidth?: SkeletonDimension;
  detailWidths?: readonly SkeletonDimension[];
  metricWidth?: SkeletonDimension;
  titleWidth?: SkeletonDimension;
};

type PageReadinessListRowProps = Omit<
  HTMLAttributes<HTMLElement>,
  "children"
> & {
  actionWidth?: SkeletonDimension;
  animated?: boolean;
  detailWidths?: readonly SkeletonDimension[];
  eyebrowWidth?: SkeletonDimension;
  metaWidths?: readonly SkeletonDimension[];
  titleWidth?: SkeletonDimension;
};

function formatDimension(value: SkeletonDimension) {
  return typeof value === "number" ? `${value}px` : value;
}

function resolveSkeletonStyle({
  height,
  style,
  width,
}: {
  height: SkeletonDimension | undefined;
  style: CSSProperties | undefined;
  width: SkeletonDimension | undefined;
}) {
  const resolvedStyle: SkeletonStyle = { ...style };

  if (height !== undefined) {
    resolvedStyle["--skeleton-height"] = formatDimension(height);
  }

  if (width !== undefined) {
    resolvedStyle["--skeleton-width"] = formatDimension(width);
  }

  return resolvedStyle;
}

export function SkeletonBlock({
  animated = true,
  as = "span",
  className,
  height,
  radius = "default",
  style,
  width,
  ...props
}: Readonly<SkeletonBlockProps>) {
  const Tag = as;
  const resolvedStyle = resolveSkeletonStyle({ height, style, width });

  return (
    <Tag
      aria-hidden="true"
      className={[
        "skeleton-block",
        radius === "pill" ? "skeleton-block--pill" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-animated={animated ? "true" : "false"}
      style={resolvedStyle}
      {...props}
    />
  );
}

export function SkeletonText({
  animated = true,
  as = "div",
  className,
  lineHeight = "0.9rem",
  lineWidths = ["100%", "92%", "68%"],
  ...props
}: Readonly<SkeletonTextProps>) {
  const Tag = as;

  return (
    <Tag
      aria-hidden="true"
      className={["skeleton-text", className].filter(Boolean).join(" ")}
      {...props}
    >
      {lineWidths.map((width) => (
        <SkeletonBlock
          animated={animated}
          as="span"
          height={lineHeight}
          key={String(width)}
          width={width}
        />
      ))}
    </Tag>
  );
}

export function PageReadinessState({
  children,
  className,
  label,
  ...props
}: Readonly<PageReadinessStateProps>) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className={["page-readiness-state", className].filter(Boolean).join(" ")}
      {...props}
    >
      <p
        aria-label={label}
        aria-live="polite"
        className="sr-only"
        role="status"
      >
        {label}
      </p>
      {children}
    </section>
  );
}

export function PageReadinessCard({
  animated = true,
  badgeWidth = "5rem",
  className,
  detailWidths = ["12rem", "9rem"],
  metricWidth = "2.6rem",
  titleWidth = "7.25rem",
  ...props
}: Readonly<PageReadinessCardProps>) {
  return (
    <article
      aria-hidden="true"
      className={["page-readiness-card", className].filter(Boolean).join(" ")}
      {...props}
    >
      <SkeletonBlock
        animated={animated}
        as="div"
        height="0.8rem"
        radius="pill"
        width={badgeWidth}
      />
      <div className="page-readiness-card__metric">
        <SkeletonBlock
          animated={animated}
          as="div"
          height="1.9rem"
          width={metricWidth}
        />
        <SkeletonBlock
          animated={animated}
          as="div"
          height="0.9rem"
          width={titleWidth}
        />
      </div>
      <SkeletonText
        animated={animated}
        lineHeight="0.82rem"
        lineWidths={detailWidths}
      />
    </article>
  );
}

export function PageReadinessListRow({
  actionWidth = "10.5rem",
  animated = true,
  className,
  detailWidths = ["100%", "82%"],
  eyebrowWidth = "7rem",
  metaWidths = ["11rem", "9rem"],
  titleWidth = "18rem",
  ...props
}: Readonly<PageReadinessListRowProps>) {
  return (
    <article
      aria-hidden="true"
      className={["page-readiness-list-row", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <div className="page-readiness-list-row__eyebrow">
        <SkeletonBlock
          animated={animated}
          as="div"
          height="0.8rem"
          radius="pill"
          width={eyebrowWidth}
        />
      </div>
      <div className="page-readiness-list-row__primary">
        <SkeletonBlock
          animated={animated}
          as="div"
          height="1.1rem"
          width={titleWidth}
        />
        <SkeletonText
          animated={animated}
          lineHeight="0.8rem"
          lineWidths={metaWidths}
        />
      </div>
      <div className="page-readiness-list-row__detail">
        <SkeletonText
          animated={animated}
          lineHeight="0.82rem"
          lineWidths={detailWidths}
        />
      </div>
      <div className="page-readiness-list-row__action">
        <SkeletonBlock
          animated={animated}
          as="div"
          height="2.5rem"
          radius="pill"
          width={actionWidth}
        />
      </div>
    </article>
  );
}
