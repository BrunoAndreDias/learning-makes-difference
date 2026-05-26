import { PageLayout } from "../../../design-system/page-layout";
import {
  PageReadinessState,
  SkeletonBlock,
  SkeletonText,
} from "../../../design-system/skeleton";

const readinessLabel = "Preparing Settings";

const settingsFormFields = [
  {
    id: "display-name",
    labelWidth: "5.5rem",
  },
  {
    id: "language",
    labelWidth: "4.5rem",
  },
  {
    id: "study-objective",
    labelWidth: "6.5rem",
  },
  {
    id: "study-intensity",
    labelWidth: "6rem",
  },
  {
    id: "user-time-zone",
    labelWidth: "5.75rem",
  },
] as const;

const settingsSummaryRows = [
  {
    detailWidth: "14rem",
    id: "email",
    labelWidth: "3.75rem",
  },
  {
    detailWidth: "7rem",
    id: "status",
    labelWidth: "4.25rem",
  },
  {
    detailWidth: "5rem",
    id: "language",
    labelWidth: "4.5rem",
  },
  {
    detailWidth: "8rem",
    id: "study-objective",
    labelWidth: "6.5rem",
  },
  {
    detailWidth: "6rem",
    id: "study-intensity",
    labelWidth: "6rem",
  },
  {
    detailWidth: "10rem",
    id: "user-time-zone",
    labelWidth: "5.75rem",
  },
] as const;

type SettingsFormFieldReadinessConfig = (typeof settingsFormFields)[number];
type SettingsSummaryRowReadinessConfig = (typeof settingsSummaryRows)[number];

export function SettingsPageReadinessState() {
  return (
    <PageLayout
      className="settings-layout"
      description={
        <SkeletonText
          as="span"
          className="settings-readiness__description"
          lineHeight="0.95rem"
          lineWidths={["32rem", "26rem"]}
        />
      }
      headerClassName="settings-page-header recall-surface__header"
      title={
        <>
          <span className="sr-only">{readinessLabel}</span>
          <SkeletonBlock as="span" height="2.2rem" width="9rem" />
        </>
      }
    >
      <PageReadinessState className="settings-readiness" label={readinessLabel}>
        <div className="settings-main-grid">
          <SettingsFormPanelReadiness />
          <SettingsSummaryPanelReadiness />
        </div>
      </PageReadinessState>
    </PageLayout>
  );
}

function SettingsFormPanelReadiness() {
  return (
    <article aria-hidden="true" className="settings-panel settings-panel--form">
      <SettingsPanelHeaderReadiness titleWidth="10rem" />

      <div className="settings-form settings-readiness__form">
        {settingsFormFields.map((field) => (
          <SettingsFormFieldReadiness field={field} key={field.id} />
        ))}

        <div className="settings-form__checkbox-field settings-readiness__checkbox">
          <SkeletonBlock as="span" height="1rem" radius="pill" width="1rem" />
          <SkeletonBlock as="span" height="0.9rem" width="11rem" />
        </div>

        <SkeletonBlock as="div" height="1rem" width="8rem" />
        <SkeletonBlock
          as="div"
          className="settings-readiness__submit"
          height="2.6rem"
          radius="pill"
          width="11.5rem"
        />
      </div>
    </article>
  );
}

function SettingsFormFieldReadiness({
  field,
}: Readonly<{
  field: SettingsFormFieldReadinessConfig;
}>) {
  return (
    <div className="settings-form__field settings-readiness__field">
      <SkeletonBlock as="span" height="0.85rem" width={field.labelWidth} />
      <SkeletonBlock as="span" height="2.45rem" width="100%" />
    </div>
  );
}

function SettingsSummaryPanelReadiness() {
  return (
    <article
      aria-hidden="true"
      className="settings-panel settings-panel--summary"
    >
      <SettingsPanelHeaderReadiness titleWidth="9rem" />

      <dl className="settings-summary">
        {settingsSummaryRows.map((row) => (
          <SettingsSummaryRowReadiness key={row.id} row={row} />
        ))}
      </dl>
    </article>
  );
}

function SettingsPanelHeaderReadiness({
  titleWidth,
}: Readonly<{
  titleWidth: string;
}>) {
  return (
    <div className="settings-panel__header">
      <SkeletonBlock as="div" height="0.8rem" width="5rem" />
      <SkeletonBlock as="div" height="1.15rem" width={titleWidth} />
    </div>
  );
}

function SettingsSummaryRowReadiness({
  row,
}: Readonly<{
  row: SettingsSummaryRowReadinessConfig;
}>) {
  return (
    <div className="settings-readiness__summary-row">
      <dt>
        <SkeletonBlock as="span" height="0.78rem" width={row.labelWidth} />
      </dt>
      <dd>
        <SkeletonBlock as="span" height="0.95rem" width={row.detailWidth} />
      </dd>
    </div>
  );
}
