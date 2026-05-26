import type { ReactNode } from "react";

import { PageLayout } from "../../design-system/page-layout";
import {
  PageReadinessListRow,
  PageReadinessState,
  SkeletonBlock,
  SkeletonText,
} from "../../design-system/skeleton";

const practiceRepairQueueReadinessLabel = "Preparing Practice Repair queue";
const practiceRepairWorkspaceReadinessLabel =
  "Preparing Practice Repair workspace";
const practiceRepairDraftReadinessLabel =
  "Preparing Practice Repair draft view";

const queueSectionConfigs = [
  {
    descriptionWidths: ["15rem", "12rem"],
    id: "active",
    rows: [
      {
        actionWidth: "9.5rem",
        detailWidths: ["100%", "78%"],
        eyebrowWidth: "6.5rem",
        id: "active-row",
        metaWidths: ["9.5rem", "7rem"],
        titleWidth: "15rem",
      },
    ],
    titleWidth: "7.25rem",
  },
  {
    descriptionWidths: ["16rem", "13rem"],
    id: "candidate",
    rows: [
      {
        actionWidth: "9rem",
        detailWidths: ["98%", "82%"],
        eyebrowWidth: "9rem",
        id: "candidate-row-1",
        metaWidths: ["10rem", "8rem"],
        titleWidth: "16rem",
      },
      {
        actionWidth: "9rem",
        detailWidths: ["92%", "76%"],
        eyebrowWidth: "8rem",
        id: "candidate-row-2",
        metaWidths: ["9rem", "7.5rem"],
        titleWidth: "14.5rem",
      },
    ],
    titleWidth: "10rem",
  },
] as const;

const workspaceDetailConfigs = [
  {
    id: "prompt",
    labelWidth: "4.25rem",
    lineWidths: ["96%", "72%"],
  },
  {
    id: "answer",
    labelWidth: "6rem",
    lineWidths: ["90%", "68%"],
  },
  {
    id: "expected-answer",
    labelWidth: "8rem",
    lineWidths: ["92%", "78%"],
  },
  {
    id: "last-score",
    labelWidth: "5.5rem",
    lineWidths: ["7rem", "14rem"],
  },
] as const;

const workspaceEditorFieldConfigs = [
  {
    height: "2.8rem",
    id: "prompt",
    labelWidth: "3.75rem",
  },
  {
    height: "6.5rem",
    id: "expected-answer",
    labelWidth: "7rem",
  },
] as const;

const practiceRepairOptionConfigs = [
  {
    descriptionWidths: ["100%", "92%"],
    id: "edit-answer",
    titleWidth: "9rem",
  },
  {
    descriptionWidths: ["96%", "82%"],
    id: "split-note",
    titleWidth: "8rem",
  },
  {
    descriptionWidths: ["98%", "78%"],
    id: "create-sibling",
    titleWidth: "10rem",
  },
  {
    descriptionWidths: ["94%", "74%"],
    id: "memory-aid",
    titleWidth: "7.5rem",
  },
] as const;

function PracticeRepairReadinessHeader({
  label,
}: Readonly<{
  label: string;
}>) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <SkeletonBlock as="span" height="2.5rem" width="14rem" />
    </>
  );
}

function PracticeRepairReadinessPageLayout({
  bodyClassName,
  children,
  className,
  label,
}: Readonly<{
  bodyClassName?: string;
  children: ReactNode;
  className: string;
  label: string;
}>) {
  return (
    <PageLayout
      actions={
        <SkeletonBlock as="div" height="2.8rem" radius="pill" width="12rem" />
      }
      aria-label="Practice Repair"
      as="section"
      bodyClassName={bodyClassName}
      className={className}
      description={
        <SkeletonText
          as="span"
          className="recall-practice-repair-readiness__description"
          lineHeight="0.9rem"
          lineWidths={["34rem", "28rem"]}
        />
      }
      headerClassName="recall-surface__header"
      headingLevel={1}
      title={<PracticeRepairReadinessHeader label={label} />}
    >
      {children}
    </PageLayout>
  );
}

function PracticeRepairWorkspaceEvidenceSkeleton({
  showInlineEditor,
}: Readonly<{
  showInlineEditor: boolean;
}>) {
  return (
    <section
      className="recall-panel recall-practice-repair-workspace__evidence recall-practice-repair-workspace__evidence--compact"
      aria-hidden="true"
    >
      <header className="recall-practice-repair-workspace__card-header">
        <SkeletonBlock as="div" height="4.5rem" radius="pill" width="4.5rem" />

        <div className="recall-practice-repair-workspace__card-copy">
          <SkeletonBlock as="div" height="1.6rem" width="13rem" />
          <SkeletonText lineHeight="0.82rem" lineWidths={["11rem", "8rem"]} />
        </div>

        <SkeletonBlock as="div" height="3rem" radius="pill" width="11rem" />
      </header>

      {workspaceDetailConfigs.map((config) => (
        <section
          className="recall-practice-repair-workspace__detail recall-practice-repair-readiness__workspace-detail"
          key={config.id}
        >
          <SkeletonBlock as="div" height="0.9rem" width={config.labelWidth} />
          <div className="recall-practice-repair-workspace__detail-copy">
            <SkeletonText lineHeight="0.9rem" lineWidths={config.lineWidths} />
          </div>
        </section>
      ))}

      {showInlineEditor ? (
        <section
          aria-hidden="true"
          className="recall-practice-repair-workspace__current-editor"
        >
          <div className="recall-practice-repair-workspace__current-editor-copy">
            <SkeletonBlock as="div" height="1rem" width="11rem" />
            <SkeletonText
              lineHeight="0.82rem"
              lineWidths={["18rem", "15rem"]}
            />
          </div>

          <div className="recall-practice-repair-workspace__current-fields">
            {workspaceEditorFieldConfigs.map((field) => (
              <div
                className="recall-practice-repair-workspace__current-field"
                key={field.id}
              >
                <SkeletonBlock
                  as="div"
                  height="0.82rem"
                  width={field.labelWidth}
                />
                <SkeletonBlock as="div" height={field.height} width="100%" />
              </div>
            ))}
          </div>

          <div className="recall-practice-repair-workspace__editor-actions">
            <SkeletonBlock
              as="div"
              height="2.9rem"
              radius="pill"
              width="10rem"
            />
          </div>
        </section>
      ) : null}
    </section>
  );
}

function PracticeRepairOptionsSkeleton() {
  return (
    <div className="recall-practice-repair-workspace__repair-list">
      {practiceRepairOptionConfigs.map((config, index) => (
        <article
          aria-hidden="true"
          className="recall-practice-repair-workspace__repair-card recall-practice-repair-readiness__option"
          data-selected={index === 0 ? "true" : "false"}
          key={config.id}
        >
          <div className="recall-practice-repair-workspace__repair-button">
            <span className="recall-practice-repair-workspace__repair-copy">
              <SkeletonBlock
                as="span"
                height="1rem"
                width={config.titleWidth}
              />
              <SkeletonText
                as="span"
                lineHeight="0.82rem"
                lineWidths={config.descriptionWidths}
              />
            </span>

            <SkeletonBlock as="span" height="1rem" radius="pill" width="1rem" />
          </div>
        </article>
      ))}
    </div>
  );
}

function PracticeRepairWorkspaceSidebarSkeleton({
  showLifecycleActions,
}: Readonly<{
  showLifecycleActions: boolean;
}>) {
  return (
    <aside
      aria-hidden="true"
      className="recall-practice-repair-workspace__sidebar"
    >
      <section className="recall-panel recall-practice-repair-workspace__panel">
        <div className="recall-practice-repair-workspace__panel-copy">
          <SkeletonBlock as="div" height="1.1rem" width="8rem" />
          <SkeletonText lineHeight="0.82rem" lineWidths={["100%", "86%"]} />
        </div>

        <PracticeRepairOptionsSkeleton />

        {showLifecycleActions ? (
          <>
            <div className="recall-practice-repair-workspace__actions">
              <SkeletonBlock
                as="div"
                height="3rem"
                radius="pill"
                width="100%"
              />
              <SkeletonBlock
                as="div"
                height="3rem"
                radius="pill"
                width="100%"
              />
            </div>

            <SkeletonText
              as="div"
              className="recall-practice-repair-workspace__support"
              lineHeight="0.82rem"
              lineWidths={["100%", "90%"]}
            />
          </>
        ) : null}
      </section>
    </aside>
  );
}

export function PracticeRepairQueuePageReadinessState() {
  return (
    <PracticeRepairReadinessPageLayout
      bodyClassName="recall-practice-repair-queue__body"
      className="recall-workspace recall-surface recall-practice-repair-queue-surface"
      label={practiceRepairQueueReadinessLabel}
    >
      <PageReadinessState
        className="recall-practice-repair-readiness recall-practice-repair-readiness--queue"
        label={practiceRepairQueueReadinessLabel}
      >
        {queueSectionConfigs.map((section) => (
          <section
            className="recall-practice-repair-readiness__section"
            key={section.id}
          >
            <div className="recall-practice-repair-readiness__section-header">
              <SkeletonBlock
                as="div"
                height="1.1rem"
                width={section.titleWidth}
              />
              <SkeletonText
                lineHeight="0.82rem"
                lineWidths={section.descriptionWidths}
              />
            </div>

            <ol className="recall-practice-repair-readiness__queue-list">
              {section.rows.map((row) => (
                <li key={row.id}>
                  <PageReadinessListRow
                    actionWidth={row.actionWidth}
                    className="recall-practice-repair-readiness__queue-row"
                    detailWidths={row.detailWidths}
                    eyebrowWidth={row.eyebrowWidth}
                    metaWidths={row.metaWidths}
                    titleWidth={row.titleWidth}
                  />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </PageReadinessState>
    </PracticeRepairReadinessPageLayout>
  );
}

export function PracticeRepairWorkspacePageReadinessState() {
  return (
    <PracticeRepairReadinessPageLayout
      className="recall-workspace recall-surface recall-practice-repair-workspace"
      label={practiceRepairWorkspaceReadinessLabel}
    >
      <PageReadinessState
        className="recall-practice-repair-readiness recall-practice-repair-readiness--workspace"
        label={practiceRepairWorkspaceReadinessLabel}
      >
        <div className="recall-practice-repair-workspace__layout">
          <div className="recall-practice-repair-workspace__main">
            <PracticeRepairWorkspaceEvidenceSkeleton showInlineEditor />
          </div>

          <PracticeRepairWorkspaceSidebarSkeleton showLifecycleActions />
        </div>
      </PageReadinessState>
    </PracticeRepairReadinessPageLayout>
  );
}

export function PracticeRepairDraftPageReadinessState() {
  return (
    <PracticeRepairReadinessPageLayout
      className="recall-workspace recall-surface recall-practice-repair-workspace"
      label={practiceRepairDraftReadinessLabel}
    >
      <PageReadinessState
        className="recall-practice-repair-readiness recall-practice-repair-readiness--draft"
        label={practiceRepairDraftReadinessLabel}
      >
        <div className="recall-practice-repair-workspace__layout">
          <div className="recall-practice-repair-workspace__main">
            <PracticeRepairWorkspaceEvidenceSkeleton showInlineEditor={false} />
          </div>

          <PracticeRepairWorkspaceSidebarSkeleton
            showLifecycleActions={false}
          />
        </div>
      </PageReadinessState>
    </PracticeRepairReadinessPageLayout>
  );
}
