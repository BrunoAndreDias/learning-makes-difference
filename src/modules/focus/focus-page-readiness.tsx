import { PageLayout } from "../../design-system/page-layout";
import {
  PageReadinessState,
  SkeletonBlock,
  SkeletonText,
} from "../../design-system/skeleton";

const readinessLabel = "Preparing Focus";

const focusConfigFields = [
  {
    id: "focus-minutes",
    labelWidth: "5.25rem",
    valueWidth: "4.25rem",
  },
  {
    id: "break-minutes",
    labelWidth: "5rem",
    valueWidth: "4rem",
  },
  {
    id: "planned-cycles",
    labelWidth: "4.75rem",
    valueWidth: "3rem",
  },
] as const;

const sessionPlanRows = [
  {
    durationWidth: "3.2rem",
    id: "focus-1",
    labelWidth: "3.6rem",
  },
  {
    durationWidth: "2.6rem",
    id: "break-1",
    labelWidth: "3rem",
  },
  {
    durationWidth: "3.2rem",
    id: "focus-2",
    labelWidth: "3.6rem",
  },
  {
    durationWidth: "2.6rem",
    id: "break-2",
    labelWidth: "3rem",
  },
] as const;

const activityRows = [
  {
    durationWidth: "2.4rem",
    id: "morning",
    labelWidth: "2.8rem",
    rangeWidth: "6.25rem",
  },
  {
    durationWidth: "2.2rem",
    id: "midday",
    labelWidth: "2.8rem",
    rangeWidth: "6.5rem",
  },
  {
    durationWidth: "2.3rem",
    id: "afternoon",
    labelWidth: "2.8rem",
    rangeWidth: "6rem",
  },
] as const;

const supportRows = [
  {
    actionWidth: "8rem",
    detailWidths: ["10rem", "9rem"],
    id: "practice-repair",
    titleWidth: "7rem",
  },
  {
    actionWidth: "7.5rem",
    detailWidths: ["11rem", "8.5rem"],
    id: "recall-today",
    titleWidth: "6.5rem",
  },
] as const;

const focusAnalyticsMetrics = [
  {
    detailWidth: "7.5rem",
    id: "focus-minutes",
    metricWidth: "4.75rem",
    titleWidth: "5.75rem",
  },
  {
    detailWidth: "8rem",
    id: "sessions-completed",
    metricWidth: "3.8rem",
    titleWidth: "6.5rem",
  },
  {
    detailWidth: "7rem",
    id: "average-session-length",
    metricWidth: "4.3rem",
    titleWidth: "7.25rem",
  },
  {
    detailWidth: "8.5rem",
    id: "recall-answered",
    metricWidth: "4rem",
    titleWidth: "6.75rem",
  },
] as const;

const sessionActionWidths = ["8.5rem", "9rem"] as const;
const sessionStatIds = ["cycle", "break", "target"] as const;
const activityMetricIds = ["time", "sessions", "streak"] as const;

type FocusConfigFieldReadinessConfig = (typeof focusConfigFields)[number];
type FocusSessionPlanRowReadinessConfig = (typeof sessionPlanRows)[number];
type FocusActivityRowReadinessConfig = (typeof activityRows)[number];
type FocusSupportRowReadinessConfig = (typeof supportRows)[number];
type FocusAnalyticsMetricReadinessConfig =
  (typeof focusAnalyticsMetrics)[number];

export function FocusPageReadinessState() {
  return (
    <PageLayout
      className="focus-workspace"
      description={
        <SkeletonText
          as="span"
          className="focus-readiness__description"
          lineHeight="0.95rem"
          lineWidths={["30rem", "24rem"]}
        />
      }
      headerClassName="focus-page-header"
      headingLevel={1}
      title={
        <>
          <span className="sr-only">{readinessLabel}</span>
          <SkeletonBlock as="span" height="2.6rem" width="8.5rem" />
        </>
      }
    >
      <PageReadinessState className="focus-readiness" label={readinessLabel}>
        <section className="focus-session-workspace">
          <FocusSessionPanelReadiness />
          <div className="focus-session-sidebar">
            <FocusActivityCardReadiness />
            <FocusSupportCardReadiness />
          </div>
        </section>

        <FocusAnalyticsCardReadiness />
      </PageReadinessState>
    </PageLayout>
  );
}

function FocusSessionPanelReadiness() {
  return (
    <section aria-hidden="true" className="focus-session-panel">
      <div className="focus-session-panel__header">
        <SkeletonBlock as="div" height="1.1rem" width="10rem" />
        <SkeletonBlock as="div" height="1.95rem" radius="pill" width="7.5rem" />
      </div>

      <FocusSessionTimerReadiness />
      <FocusSessionActionsReadiness />
      <FocusSessionSetupReadiness />
      <FocusSessionStatsReadiness />
    </section>
  );
}

function FocusSessionTimerReadiness() {
  return (
    <div className="focus-session-panel__timer">
      <div className="focus-timer-ring">
        <span aria-hidden="true" className="focus-timer-ring__leaf">
          <SkeletonBlock
            as="span"
            className="focus-readiness__leaf"
            height="1.5rem"
            radius="pill"
            width="1.5rem"
          />
        </span>
        <span className="focus-readiness__timer-copy">
          <SkeletonBlock as="span" height="0.9rem" width="7.5rem" />
        </span>
        <strong className="focus-readiness__timer-value">
          <SkeletonBlock as="span" height="3.4rem" width="7rem" />
        </strong>
        <span className="focus-readiness__timer-copy">
          <SkeletonBlock as="span" height="0.95rem" width="6rem" />
        </span>
      </div>
    </div>
  );
}

function FocusSessionActionsReadiness() {
  return (
    <div className="focus-readiness__actions">
      {sessionActionWidths.map((width) => (
        <SkeletonBlock
          as="div"
          height="2.7rem"
          key={width}
          radius="pill"
          width={width}
        />
      ))}
    </div>
  );
}

function FocusSessionSetupReadiness() {
  return (
    <div className="focus-session-setup">
      <div className="focus-config-form">
        <div className="focus-config-form__actions">
          <SkeletonBlock
            as="div"
            height="2.8rem"
            radius="pill"
            width="10.5rem"
          />
        </div>
        <div className="focus-config-form__fields">
          {focusConfigFields.map((field) => (
            <FocusConfigFieldReadiness field={field} key={field.id} />
          ))}
        </div>

        <FocusSessionPlanReadiness />
      </div>
    </div>
  );
}

function FocusConfigFieldReadiness({
  field,
}: Readonly<{
  field: FocusConfigFieldReadinessConfig;
}>) {
  return (
    <div aria-hidden="true" className="focus-config-field">
      <span className="focus-config-field__icon">
        <SkeletonBlock as="span" height="1.6rem" radius="pill" width="1.6rem" />
      </span>
      <span className="focus-config-field__copy">
        <SkeletonBlock as="span" height="0.75rem" width={field.labelWidth} />
        <SkeletonBlock as="span" height="1rem" width={field.valueWidth} />
      </span>
    </div>
  );
}

function FocusSessionPlanReadiness() {
  return (
    <section aria-hidden="true" className="focus-session-plan">
      <div className="focus-session-plan__header">
        <SkeletonBlock as="div" height="1rem" width="9rem" />
        <SkeletonBlock as="div" height="0.85rem" width="6rem" />
      </div>
      <ol className="focus-session-plan__list">
        {sessionPlanRows.map((row, index) => (
          <FocusSessionPlanRowReadiness index={index} key={row.id} row={row} />
        ))}
      </ol>
    </section>
  );
}

function FocusSessionPlanRowReadiness({
  index,
  row,
}: Readonly<{
  index: number;
  row: FocusSessionPlanRowReadinessConfig;
}>) {
  return (
    <li>
      <span className="focus-session-plan__index">
        <SkeletonBlock as="span" height="0.8rem" radius="pill" width="0.8rem" />
      </span>
      <span className="focus-session-plan__dot">
        <SkeletonBlock
          as="span"
          className="focus-readiness__plan-dot"
          height="0.9rem"
          radius="pill"
          width="0.9rem"
        />
      </span>
      <span>
        <SkeletonBlock as="span" height="0.85rem" width={row.labelWidth} />
      </span>
      <span>
        <SkeletonBlock as="span" height="0.85rem" width={row.durationWidth} />
      </span>
      {index === 0 ? (
        <strong className="focus-session-plan__next">
          <SkeletonBlock as="span" height="0.75rem" width="2.5rem" />
        </strong>
      ) : (
        <span />
      )}
    </li>
  );
}

function FocusSessionStatsReadiness() {
  return (
    <dl className="focus-session-panel__stats focus-readiness__stats">
      {sessionStatIds.map((stat) => (
        <div key={stat}>
          <dt>
            <SkeletonBlock as="span" height="0.75rem" width="5rem" />
          </dt>
          <dd>
            <SkeletonBlock as="span" height="1rem" width="4rem" />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function FocusActivityCardReadiness() {
  return (
    <section aria-hidden="true" className="focus-card focus-card--activity">
      <div className="focus-card__header">
        <div className="focus-activity-header-copy">
          <SkeletonBlock as="div" height="1.1rem" width="9rem" />
          <SkeletonText lineHeight="0.82rem" lineWidths={["14rem", "10rem"]} />
        </div>
        <SkeletonBlock as="div" height="2rem" radius="pill" width="5rem" />
      </div>

      <dl className="focus-activity-summary">
        {activityMetricIds.map((metric) => (
          <FocusActivityMetricReadiness key={metric} />
        ))}
      </dl>

      <ul className="focus-activity-list">
        {activityRows.map((row) => (
          <FocusActivityRowReadiness key={row.id} row={row} />
        ))}
      </ul>

      <p className="focus-activity-note">
        <SkeletonBlock as="span" height="0.9rem" width="11rem" />
      </p>
    </section>
  );
}

function FocusActivityMetricReadiness() {
  return (
    <div className="focus-activity-summary__metric">
      <dt>
        <SkeletonBlock as="span" height="0.75rem" width="5rem" />
      </dt>
      <dd className="focus-activity-summary__value">
        <span aria-hidden="true" className="focus-activity-summary__icon">
          <SkeletonBlock
            as="span"
            height="1.35rem"
            radius="pill"
            width="1.35rem"
          />
        </span>
        <SkeletonBlock as="span" height="1.6rem" width="2.8rem" />
      </dd>
      <dd className="focus-activity-summary__supporting">
        <SkeletonBlock as="span" height="0.78rem" width="4.5rem" />
      </dd>
    </div>
  );
}

function FocusActivityRowReadiness({
  row,
}: Readonly<{
  row: FocusActivityRowReadinessConfig;
}>) {
  return (
    <li>
      <span>
        <SkeletonBlock as="span" height="0.85rem" width={row.rangeWidth} />
      </span>
      <span>
        <SkeletonBlock as="span" height="0.85rem" width={row.labelWidth} />
      </span>
      <span>
        <SkeletonBlock as="span" height="0.85rem" width={row.durationWidth} />
      </span>
      <SkeletonBlock as="span" height="1rem" radius="pill" width="1rem" />
    </li>
  );
}

function FocusSupportCardReadiness() {
  return (
    <section aria-hidden="true" className="focus-card focus-card--support">
      <div className="focus-card__header">
        <div>
          <SkeletonBlock as="div" height="0.8rem" width="7rem" />
          <SkeletonBlock
            as="div"
            className="focus-readiness__support-heading"
            height="1.1rem"
            width="10rem"
          />
        </div>
      </div>

      <div className="focus-learning-loop-support">
        {supportRows.map((row) => (
          <FocusSupportRowReadiness key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
}

function FocusSupportRowReadiness({
  row,
}: Readonly<{
  row: FocusSupportRowReadinessConfig;
}>) {
  return (
    <article className="focus-learning-loop-support__item">
      <span aria-hidden="true" className="focus-support-icon">
        <SkeletonBlock
          as="span"
          className="focus-readiness__support-icon"
          height="1.2rem"
          radius="pill"
          width="1.2rem"
        />
      </span>
      <div className="focus-learning-loop-support__copy">
        <SkeletonBlock as="div" height="0.95rem" width={row.titleWidth} />
        <SkeletonText lineHeight="0.78rem" lineWidths={row.detailWidths} />
      </div>
      <SkeletonBlock
        as="div"
        height="2rem"
        radius="pill"
        width={row.actionWidth}
      />
    </article>
  );
}

function FocusAnalyticsCardReadiness() {
  return (
    <section aria-hidden="true" className="focus-card focus-card--analytics">
      <div className="focus-card__header">
        <div>
          <SkeletonBlock as="div" height="0.8rem" width="6rem" />
          <SkeletonBlock
            as="div"
            className="focus-readiness__analytics-heading"
            height="1.15rem"
            width="11rem"
          />
        </div>
      </div>

      <dl className="focus-weekly-analytics focus-readiness-metrics">
        {focusAnalyticsMetrics.map((metric) => (
          <FocusAnalyticsMetricReadiness key={metric.id} metric={metric} />
        ))}
      </dl>
    </section>
  );
}

function FocusAnalyticsMetricReadiness({
  metric,
}: Readonly<{
  metric: FocusAnalyticsMetricReadinessConfig;
}>) {
  return (
    <div className="focus-readiness-metrics__item">
      <dt>
        <SkeletonBlock as="span" height="0.78rem" width={metric.titleWidth} />
      </dt>
      <dd>
        <SkeletonBlock as="span" height="1.9rem" width={metric.metricWidth} />
      </dd>
      <span>
        <SkeletonBlock as="span" height="0.78rem" width={metric.detailWidth} />
      </span>
    </div>
  );
}
