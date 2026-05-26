import { PageLayout } from "../../../design-system/page-layout";
import {
  PageReadinessState,
  SkeletonBlock,
  SkeletonText,
} from "../../../design-system/skeleton";

const readinessLabel = "Preparing Settings";

const settingsFieldWidths = [
  {
    controlWidth: "100%",
    id: "display-name",
    labelWidth: "5.5rem",
  },
  {
    controlWidth: "100%",
    id: "language",
    labelWidth: "4.5rem",
  },
  {
    controlWidth: "100%",
    id: "study-objective",
    labelWidth: "6.5rem",
  },
  {
    controlWidth: "100%",
    id: "study-intensity",
    labelWidth: "6rem",
  },
  {
    controlWidth: "100%",
    id: "user-time-zone",
    labelWidth: "5.75rem",
  },
] as const;

const settingsSummaryWidths = [
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
          <article
            aria-hidden="true"
            className="settings-panel settings-panel--form"
          >
            <div className="settings-panel__header">
              <SkeletonBlock as="div" height="0.8rem" width="5rem" />
              <SkeletonBlock as="div" height="1.15rem" width="10rem" />
            </div>

            <div className="settings-form settings-readiness__form">
              {settingsFieldWidths.map((field) => (
                <div
                  className="settings-form__field settings-readiness__field"
                  key={field.id}
                >
                  <SkeletonBlock
                    as="span"
                    height="0.85rem"
                    width={field.labelWidth}
                  />
                  <SkeletonBlock
                    as="span"
                    height="2.45rem"
                    width={field.controlWidth}
                  />
                </div>
              ))}

              <div className="settings-form__checkbox-field settings-readiness__checkbox">
                <SkeletonBlock
                  as="span"
                  height="1rem"
                  radius="pill"
                  width="1rem"
                />
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

          <article
            aria-hidden="true"
            className="settings-panel settings-panel--summary"
          >
            <div className="settings-panel__header">
              <SkeletonBlock as="div" height="0.8rem" width="5rem" />
              <SkeletonBlock as="div" height="1.15rem" width="9rem" />
            </div>

            <dl className="settings-summary">
              {settingsSummaryWidths.map((row) => (
                <div className="settings-readiness__summary-row" key={row.id}>
                  <dt>
                    <SkeletonBlock
                      as="span"
                      height="0.78rem"
                      width={row.labelWidth}
                    />
                  </dt>
                  <dd>
                    <SkeletonBlock
                      as="span"
                      height="0.95rem"
                      width={row.detailWidth}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        </div>
      </PageReadinessState>
    </PageLayout>
  );
}
