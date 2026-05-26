import { PageLayout } from "../../design-system/page-layout";
import {
  PageReadinessListRow,
  PageReadinessState,
  SkeletonBlock,
  SkeletonText,
} from "../../design-system/skeleton";
import "./study-notes.css";

const readinessLabel = "Preparing Study Notes";

const managementRowConfigs = [
  {
    actionWidth: "9rem",
    detailWidths: ["100%", "74%"],
    eyebrowWidth: "7rem",
    id: "due-today",
    metaWidths: ["9rem", "7rem"],
    titleWidth: "15rem",
  },
  {
    actionWidth: "9.5rem",
    detailWidths: ["96%", "68%"],
    eyebrowWidth: "6.5rem",
    id: "new-note",
    metaWidths: ["8rem", "6.5rem"],
    titleWidth: "14rem",
  },
  {
    actionWidth: "8.75rem",
    detailWidths: ["94%", "72%"],
    eyebrowWidth: "8rem",
    id: "repair",
    metaWidths: ["8.5rem", "7rem"],
    titleWidth: "16rem",
  },
  {
    actionWidth: "9.25rem",
    detailWidths: ["92%", "70%"],
    eyebrowWidth: "7.5rem",
    id: "upcoming",
    metaWidths: ["9rem", "6.75rem"],
    titleWidth: "13rem",
  },
] as const;

const catalogRowConfigs = [
  {
    id: "catalog-1",
    labelWidth: "6rem",
    promptWidth: "11.5rem",
    statusWidth: "5rem",
    updatedWidth: "4rem",
  },
  {
    id: "catalog-2",
    labelWidth: "5.5rem",
    promptWidth: "10rem",
    statusWidth: "5.5rem",
    updatedWidth: "4.5rem",
  },
  {
    id: "catalog-3",
    labelWidth: "6.25rem",
    promptWidth: "12rem",
    statusWidth: "4.75rem",
    updatedWidth: "3.75rem",
  },
  {
    id: "catalog-4",
    labelWidth: "4.75rem",
    promptWidth: "9.5rem",
    statusWidth: "5.25rem",
    updatedWidth: "4.25rem",
  },
  {
    id: "catalog-5",
    labelWidth: "6.5rem",
    promptWidth: "10.75rem",
    statusWidth: "5rem",
    updatedWidth: "4rem",
  },
  {
    id: "catalog-6",
    labelWidth: "5rem",
    promptWidth: "9rem",
    statusWidth: "4.5rem",
    updatedWidth: "3.5rem",
  },
] as const;

const editorToolbarWidthsByRouteKind = {
  create: ["5rem", "6.75rem"],
  edit: ["5rem", "5.5rem", "6.75rem"],
} as const;

type StudyNotesReadinessRouteKind = "create" | "edit";

function StudyNotesReadinessTitle() {
  return (
    <>
      <span className="sr-only">{readinessLabel}</span>
      <SkeletonBlock as="span" height="2.5rem" width="14rem" />
    </>
  );
}

function StudyNotesReadinessDescription() {
  return (
    <SkeletonText
      as="span"
      lineHeight="0.95rem"
      lineWidths={["28rem", "20rem"]}
    />
  );
}

function StudyNotesReadinessActions() {
  return (
    <>
      <SkeletonBlock as="div" height="2.75rem" radius="pill" width="9.35rem" />
      <SkeletonBlock as="div" height="2.75rem" radius="pill" width="10.25rem" />
    </>
  );
}

function StudyNotesReadinessField({
  controlHeight,
  detailWidths = ["100%", "76%"],
  labelWidth,
}: Readonly<{
  controlHeight: string;
  detailWidths?: readonly string[];
  labelWidth: string;
}>) {
  return (
    <section aria-hidden="true" className="study-notes-readiness__field">
      <SkeletonBlock as="div" height="0.95rem" width={labelWidth} />
      <SkeletonBlock as="div" height={controlHeight} width="100%" />
      <SkeletonText lineHeight="0.78rem" lineWidths={detailWidths} />
    </section>
  );
}

function StudyNotesCatalogReadiness() {
  return (
    <aside aria-hidden="true" className="notes-list-panel">
      <div className="study-notes-catalog-tools">
        <div className="study-notes-search">
          <SkeletonBlock as="span" height="0.9rem" width="0.9rem" />
          <SkeletonBlock as="span" height="0.9rem" width="9.5rem" />
        </div>
        <div className="study-notes-filter">
          <SkeletonBlock as="span" height="0.9rem" width="1rem" />
        </div>
      </div>

      <div className="study-notes-catalog-meta">
        <SkeletonBlock as="span" height="0.8rem" width="4.75rem" />
        <SkeletonBlock as="span" height="0.8rem" width="6rem" />
      </div>

      <div className="notes-list">
        <ol className="notes-list__items study-notes-readiness__catalog-list">
          {catalogRowConfigs.map((config) => (
            <li key={config.id}>
              <div className="study-notes-readiness__catalog-row">
                <span className="study-note-row__icon study-notes-readiness__catalog-icon">
                  <SkeletonBlock as="span" height="1rem" width="1rem" />
                </span>
                <span className="study-note-row__content study-notes-readiness__catalog-content">
                  <SkeletonBlock
                    as="span"
                    height="0.9rem"
                    width={config.promptWidth}
                  />
                  <SkeletonBlock
                    as="span"
                    height="0.72rem"
                    width={config.labelWidth}
                  />
                  <SkeletonBlock
                    as="span"
                    className="study-note-row__status study-notes-readiness__catalog-status"
                    height="1.1rem"
                    radius="pill"
                    width={config.statusWidth}
                  />
                </span>
                <span className="study-note-row__updated-inline study-notes-readiness__catalog-updated">
                  <SkeletonBlock
                    as="span"
                    height="0.72rem"
                    width={config.updatedWidth}
                  />
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}

function StudyNotesEditorReadiness({
  routeKind,
}: Readonly<{
  routeKind: StudyNotesReadinessRouteKind;
}>) {
  return (
    <section
      aria-hidden="true"
      className="notes-editor study-notes-editor study-notes-readiness__editor"
    >
      <div className="notes-editor__study-surface">
        <div className="study-notes-editor__masthead">
          <div className="study-notes-editor__title">
            <SkeletonBlock as="div" height="0.78rem" width="8rem" />
            <SkeletonBlock
              as="div"
              height="2rem"
              width={routeKind === "create" ? "10rem" : "12rem"}
            />
            <SkeletonText
              lineHeight="0.8rem"
              lineWidths={routeKind === "create" ? ["9rem"] : ["10rem", "7rem"]}
            />
          </div>

          <div className="study-notes-editor__toolbar study-notes-readiness__editor-toolbar">
            {editorToolbarWidthsByRouteKind[routeKind].map((width) => (
              <SkeletonBlock
                as="div"
                height="2.25rem"
                key={width}
                radius="pill"
                width={width}
              />
            ))}
          </div>
        </div>

        <div className="study-notes-editor__fields">
          <StudyNotesReadinessField
            controlHeight="5.75rem"
            detailWidths={["100%", "64%"]}
            labelWidth="4.5rem"
          />
          <StudyNotesReadinessField
            controlHeight="7rem"
            detailWidths={["100%", "72%"]}
            labelWidth="8rem"
          />

          <section
            aria-hidden="true"
            className="study-notes-editor__info-section study-notes-readiness__section"
          >
            <div className="study-notes-readiness__section-header">
              <SkeletonBlock as="div" height="0.95rem" width="5rem" />
              <SkeletonText lineHeight="0.78rem" lineWidths={["11rem"]} />
            </div>
            <div className="study-notes-readiness__chips">
              <SkeletonBlock
                as="span"
                height="1.7rem"
                radius="pill"
                width="4.5rem"
              />
              <SkeletonBlock
                as="span"
                height="1.7rem"
                radius="pill"
                width="5.25rem"
              />
              <SkeletonBlock
                as="span"
                height="1.7rem"
                radius="pill"
                width="4rem"
              />
            </div>
          </section>

          <section
            aria-hidden="true"
            className="study-notes-editor__info-section study-notes-readiness__section"
          >
            <div className="study-notes-readiness__section-header">
              <SkeletonBlock as="div" height="0.95rem" width="8.5rem" />
              <SkeletonText lineHeight="0.78rem" lineWidths={["12rem"]} />
            </div>
            <SkeletonBlock as="div" height="7.5rem" width="100%" />
          </section>

          <section
            aria-hidden="true"
            className="study-notes-summary-card study-notes-recall-insights study-notes-readiness__section"
          >
            <div className="study-notes-readiness__section-header">
              <SkeletonBlock as="div" height="1rem" width="7rem" />
              <SkeletonText lineHeight="0.8rem" lineWidths={["100%", "70%"]} />
            </div>
            <div className="study-notes-readiness__chips">
              <SkeletonBlock as="span" height="2.8rem" width="7.5rem" />
              <SkeletonBlock as="span" height="2.8rem" width="7rem" />
              <SkeletonBlock as="span" height="2.8rem" width="8rem" />
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

export function StudyNotesManagementPageReadinessState() {
  return (
    <PageLayout
      actions={<StudyNotesReadinessActions />}
      actionsClassName="study-notes-hero__actions"
      className="notes-workspace study-notes-management-page"
      description={<StudyNotesReadinessDescription />}
      headerClassName="study-notes-hero"
      headingLevel={1}
      title={<StudyNotesReadinessTitle />}
    >
      <PageReadinessState
        className="study-notes-management study-notes-management-readiness"
        label={readinessLabel}
      >
        <div
          aria-hidden="true"
          className="study-notes-management-readiness__tabs"
        >
          <SkeletonBlock as="span" height="0.95rem" width="5.5rem" />
          <SkeletonBlock as="span" height="0.95rem" width="4.5rem" />
          <SkeletonBlock as="span" height="0.95rem" width="6rem" />
        </div>

        <div className="study-notes-management__filters">
          <div aria-hidden="true" className="study-notes-list-search">
            <SkeletonBlock as="span" height="0.9rem" width="0.9rem" />
            <SkeletonBlock as="span" height="0.9rem" width="12rem" />
          </div>
          <div aria-hidden="true" className="study-notes-list-filter">
            <SkeletonBlock as="span" height="0.9rem" width="7.5rem" />
          </div>
        </div>

        <div className="study-notes-management__summary study-notes-management-readiness__summary">
          <SkeletonBlock as="span" height="0.9rem" width="18rem" />
        </div>

        <div className="study-notes-management__list-wrap">
          <ol className="study-notes-management__list study-notes-management-readiness__list">
            {managementRowConfigs.map((config) => (
              <li key={config.id}>
                <PageReadinessListRow
                  actionWidth={config.actionWidth}
                  className="study-notes-readiness__management-row"
                  detailWidths={config.detailWidths}
                  eyebrowWidth={config.eyebrowWidth}
                  metaWidths={config.metaWidths}
                  titleWidth={config.titleWidth}
                />
              </li>
            ))}
          </ol>
        </div>
      </PageReadinessState>
    </PageLayout>
  );
}

export function StudyNotesWorkspacePageReadinessState({
  routeKind,
}: Readonly<{
  routeKind: StudyNotesReadinessRouteKind;
}>) {
  return (
    <PageLayout
      actions={<StudyNotesReadinessActions />}
      actionsClassName="study-notes-hero__actions"
      bodyClassName="study-notes-workspace__body"
      className="notes-workspace study-notes-workspace"
      data-route-kind={routeKind}
      description={<StudyNotesReadinessDescription />}
      headerClassName="study-notes-hero"
      headingLevel={1}
      title={<StudyNotesReadinessTitle />}
    >
      <PageReadinessState
        className="study-notes-layout study-notes-readiness"
        label={readinessLabel}
      >
        <StudyNotesCatalogReadiness />
        <StudyNotesEditorReadiness routeKind={routeKind} />
      </PageReadinessState>
    </PageLayout>
  );
}
