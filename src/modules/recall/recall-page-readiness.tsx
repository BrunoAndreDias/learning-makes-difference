import { createContext, type ReactNode, useContext } from "react";

import { PageHeader } from "../../design-system/page-header";
import { PageLayout } from "../../design-system/page-layout";
import {
  PageReadinessListRow,
  PageReadinessState,
  SkeletonBlock,
  SkeletonText,
} from "../../design-system/skeleton";
import {
  hasPendingProtectedWorkspaceRefresh,
  type ProtectedWorkspaceRefreshKey,
  useProtectedWorkspaceRefreshState,
} from "../workspace-shell/app-shell/protected-workspace-refresh";

type RecallRouteReadinessState = {
  routeEntryPending: boolean;
};

const defaultRecallRouteReadinessState: RecallRouteReadinessState = {
  routeEntryPending: false,
};

const RecallRouteReadinessContext = createContext<RecallRouteReadinessState>(
  defaultRecallRouteReadinessState,
);

const recallTodayReadinessLabel = "Preparing Recall Today";
const recallDueTodayReadinessLabel = "Preparing Scheduled Recall";
const recallResultsReadinessLabel = "Preparing Results Workspace";
const recallSelectionReadinessLabel = "Preparing Recall Selection";
const recallSessionReadinessLabel = "Preparing Recall Session";

const recallTodayPriorityRows = [
  {
    actionWidth: "7rem",
    detailWidths: ["86%", "68%"],
    eyebrowWidth: "8rem",
    id: "priority-1",
    metaWidths: ["9.5rem", "7rem"],
    titleWidth: "17rem",
  },
  {
    actionWidth: "7rem",
    detailWidths: ["82%", "70%"],
    eyebrowWidth: "7rem",
    id: "priority-2",
    metaWidths: ["10rem", "7.5rem"],
    titleWidth: "15rem",
  },
  {
    actionWidth: "7rem",
    detailWidths: ["88%", "64%"],
    eyebrowWidth: "8.5rem",
    id: "priority-3",
    metaWidths: ["9rem", "6.5rem"],
    titleWidth: "16rem",
  },
] as const;

const recallTodayContinuationRows = [
  {
    actionWidth: "2.25rem",
    detailWidths: ["62%"],
    eyebrowWidth: "7rem",
    id: "continuation-1",
    metaWidths: ["7rem"],
    titleWidth: "9rem",
  },
  {
    actionWidth: "2.25rem",
    detailWidths: ["66%"],
    eyebrowWidth: "8rem",
    id: "continuation-2",
    metaWidths: ["7.5rem"],
    titleWidth: "10rem",
  },
  {
    actionWidth: "2.25rem",
    detailWidths: ["56%"],
    eyebrowWidth: "6rem",
    id: "continuation-3",
    metaWidths: ["6.5rem"],
    titleWidth: "8rem",
  },
] as const;

const dueTodayRows = [
  {
    actionWidth: "7rem",
    detailWidths: ["92%", "74%"],
    eyebrowWidth: "7rem",
    id: "due-1",
    metaWidths: ["9.5rem", "7rem"],
    titleWidth: "16rem",
  },
  {
    actionWidth: "7rem",
    detailWidths: ["88%", "72%"],
    eyebrowWidth: "8rem",
    id: "due-2",
    metaWidths: ["10rem", "7.5rem"],
    titleWidth: "17rem",
  },
  {
    actionWidth: "7rem",
    detailWidths: ["84%", "70%"],
    eyebrowWidth: "7rem",
    id: "due-3",
    metaWidths: ["9rem", "6.5rem"],
    titleWidth: "15rem",
  },
  {
    actionWidth: "7rem",
    detailWidths: ["90%", "68%"],
    eyebrowWidth: "8rem",
    id: "due-4",
    metaWidths: ["10rem", "7rem"],
    titleWidth: "16.5rem",
  },
] as const;

const resultsRows = [
  {
    actionWidth: "5rem",
    detailWidths: ["74%"],
    eyebrowWidth: "9rem",
    id: "result-1",
    metaWidths: ["6rem", "5.5rem"],
    titleWidth: "11rem",
  },
  {
    actionWidth: "5rem",
    detailWidths: ["70%"],
    eyebrowWidth: "9rem",
    id: "result-2",
    metaWidths: ["5.5rem", "5rem"],
    titleWidth: "10rem",
  },
  {
    actionWidth: "5rem",
    detailWidths: ["76%"],
    eyebrowWidth: "9rem",
    id: "result-3",
    metaWidths: ["6rem", "5rem"],
    titleWidth: "10.5rem",
  },
  {
    actionWidth: "5rem",
    detailWidths: ["72%"],
    eyebrowWidth: "9rem",
    id: "result-4",
    metaWidths: ["5.5rem", "4.5rem"],
    titleWidth: "9.5rem",
  },
] as const;

const selectedResultQuestionRows = [
  {
    actionWidth: "9rem",
    detailWidths: ["92%", "72%"],
    eyebrowWidth: "8rem",
    id: "selected-result-question-1",
    metaWidths: ["10rem", "8rem"],
    titleWidth: "17rem",
  },
  {
    actionWidth: "9rem",
    detailWidths: ["90%", "70%"],
    eyebrowWidth: "8rem",
    id: "selected-result-question-2",
    metaWidths: ["9rem", "7rem"],
    titleWidth: "16rem",
  },
  {
    actionWidth: "9rem",
    detailWidths: ["94%", "76%"],
    eyebrowWidth: "8rem",
    id: "selected-result-question-3",
    metaWidths: ["9.5rem", "7.5rem"],
    titleWidth: "18rem",
  },
] as const;

const selectionAvailableRows = [
  {
    detailWidths: ["88%", "68%"],
    id: "available-1",
    labelWidths: ["4rem", "5rem"],
    titleWidth: "15rem",
  },
  {
    detailWidths: ["92%", "70%"],
    id: "available-2",
    labelWidths: ["4.5rem", "5.5rem"],
    titleWidth: "16rem",
  },
  {
    detailWidths: ["84%", "64%"],
    id: "available-3",
    labelWidths: ["5rem", "4rem"],
    titleWidth: "14rem",
  },
  {
    detailWidths: ["86%", "72%"],
    id: "available-4",
    labelWidths: ["4rem", "4.5rem"],
    titleWidth: "15.5rem",
  },
] as const;

const selectionSelectedRows = [
  {
    detailWidths: ["82%"],
    id: "selected-1",
    titleWidth: "12rem",
  },
  {
    detailWidths: ["78%"],
    id: "selected-2",
    titleWidth: "13rem",
  },
  {
    detailWidths: ["74%"],
    id: "selected-3",
    titleWidth: "11rem",
  },
] as const;

export function RecallRouteReadinessProvider({
  children,
  value,
}: Readonly<{
  children: ReactNode;
  value: RecallRouteReadinessState;
}>) {
  return (
    <RecallRouteReadinessContext.Provider value={value}>
      {children}
    </RecallRouteReadinessContext.Provider>
  );
}

export function useIsRecallPageReadinessPending(
  keys: readonly ProtectedWorkspaceRefreshKey[],
) {
  const protectedWorkspaceRefreshState = useProtectedWorkspaceRefreshState();
  const { routeEntryPending } = useContext(RecallRouteReadinessContext);

  return (
    routeEntryPending ||
    hasPendingProtectedWorkspaceRefresh(protectedWorkspaceRefreshState, keys)
  );
}

function ReadinessTitle({
  height = "2.3rem",
  label,
  width,
}: Readonly<{
  height?: string;
  label: string;
  width: string;
}>) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <SkeletonBlock as="span" height={height} width={width} />
    </>
  );
}

function RecallSurfaceDescription({
  className,
  widths,
}: Readonly<{
  className?: string;
  widths: readonly string[];
}>) {
  return (
    <SkeletonText
      as="span"
      className={className}
      lineHeight="0.95rem"
      lineWidths={widths}
    />
  );
}

export function RecallTodayPageReadinessState() {
  return (
    <section
      aria-label="Recall"
      className="page-layout recall-workspace recall-today-page"
    >
      <div className="recall-today-wrapper">
        <article className="recall-surface recall-today-surface">
          <PageHeader
            actions={
              <div className="recall-today-actions">
                <SkeletonBlock
                  as="div"
                  height="2.75rem"
                  radius="pill"
                  width="10rem"
                />
                <SkeletonBlock
                  as="div"
                  height="2.75rem"
                  radius="pill"
                  width="9.5rem"
                />
              </div>
            }
            actionsClassName="recall-today-hero__actions"
            className="recall-surface__header recall-today-hero"
            description={
              <RecallSurfaceDescription widths={["28rem", "22rem"]} />
            }
            headingLevel={1}
            title={
              <ReadinessTitle
                label={recallTodayReadinessLabel}
                width="13.5rem"
              />
            }
          >
            <div className="recall-today-readiness__hero-summary">
              <SkeletonBlock as="div" height="1rem" width="18rem" />
            </div>
          </PageHeader>

          <PageReadinessState
            className="recall-today-readiness"
            label={recallTodayReadinessLabel}
          >
            <section className="recall-today-readiness__priority">
              <SkeletonBlock as="div" height="1.25rem" width="9rem" />
              <ol className="recall-today-readiness__priority-list">
                {recallTodayPriorityRows.map((row) => (
                  <li key={row.id}>
                    <PageReadinessListRow
                      actionWidth={row.actionWidth}
                      detailWidths={row.detailWidths}
                      eyebrowWidth={row.eyebrowWidth}
                      metaWidths={row.metaWidths}
                      titleWidth={row.titleWidth}
                    />
                  </li>
                ))}
              </ol>
            </section>

            <section className="recall-today-readiness__continuation">
              <div className="recall-today-readiness__continuation-heading">
                <SkeletonBlock as="div" height="0.85rem" width="8rem" />
                <SkeletonBlock as="div" height="1px" width="100%" />
              </div>
              <ol className="recall-today-readiness__continuation-list">
                {recallTodayContinuationRows.map((row) => (
                  <li key={row.id}>
                    <PageReadinessListRow
                      actionWidth={row.actionWidth}
                      detailWidths={row.detailWidths}
                      eyebrowWidth={row.eyebrowWidth}
                      metaWidths={row.metaWidths}
                      titleWidth={row.titleWidth}
                    />
                  </li>
                ))}
              </ol>
            </section>
          </PageReadinessState>
        </article>
      </div>
    </section>
  );
}

export function RecallDueTodayPageReadinessState() {
  return (
    <section
      aria-label="Recall"
      className="page-layout recall-workspace recall-today-page recall-scheduled-page"
    >
      <div className="recall-today-wrapper">
        <article className="recall-surface recall-today-surface recall-scheduled-surface">
          <PageHeader
            actions={
              <SkeletonBlock
                as="div"
                height="2.75rem"
                radius="pill"
                width="11rem"
              />
            }
            actionsClassName="recall-today-hero__actions"
            className="recall-surface__header recall-today-hero"
            description={
              <RecallSurfaceDescription widths={["27rem", "22rem"]} />
            }
            headingLevel={1}
            title={
              <ReadinessTitle
                label={recallDueTodayReadinessLabel}
                width="14rem"
              />
            }
          >
            <div className="recall-readiness-summary">
              <SkeletonBlock
                as="div"
                height="2.4rem"
                radius="pill"
                width="7rem"
              />
              <SkeletonBlock
                as="div"
                height="2.4rem"
                radius="pill"
                width="6rem"
              />
              <SkeletonBlock
                as="div"
                height="2.4rem"
                radius="pill"
                width="9rem"
              />
            </div>
          </PageHeader>

          <PageReadinessState
            className="recall-due-today-readiness"
            label={recallDueTodayReadinessLabel}
          >
            <section className="recall-due-today-readiness__summary">
              <SkeletonBlock as="div" height="0.9rem" width="11rem" />
              <SkeletonText
                lineHeight="0.82rem"
                lineWidths={["24rem", "18rem"]}
              />
            </section>

            <ol className="recall-due-today-readiness__queue">
              {dueTodayRows.map((row) => (
                <li key={row.id}>
                  <PageReadinessListRow
                    actionWidth={row.actionWidth}
                    detailWidths={row.detailWidths}
                    eyebrowWidth={row.eyebrowWidth}
                    metaWidths={row.metaWidths}
                    titleWidth={row.titleWidth}
                  />
                </li>
              ))}
            </ol>
          </PageReadinessState>
        </article>
      </div>
    </section>
  );
}

export function RecallResultsPageReadinessState() {
  return (
    <PageLayout
      actions={
        <SkeletonBlock as="div" height="2.8rem" radius="pill" width="11rem" />
      }
      aria-label="Recall"
      as="section"
      className="recall-workspace recall-surface recall-results-surface"
      description={<RecallSurfaceDescription widths={["24rem", "18rem"]} />}
      headerClassName="recall-surface__header"
      headingLevel={1}
      title={
        <ReadinessTitle label={recallResultsReadinessLabel} width="10rem" />
      }
    >
      <PageReadinessState
        className="recall-results-readiness"
        label={recallResultsReadinessLabel}
      >
        <div className="recall-results-workspace recall-results-readiness__workspace">
          <section className="recall-panel recall-results-master">
            <SkeletonBlock as="div" height="1.1rem" width="7rem" />
            <div className="recall-results-readiness__toolbar">
              <SkeletonBlock
                as="div"
                height="2.75rem"
                radius="pill"
                width="100%"
              />
              <SkeletonBlock
                as="div"
                height="2.75rem"
                radius="pill"
                width="6.5rem"
              />
            </div>
            <ol className="recall-results-readiness__master-list">
              {resultsRows.map((row) => (
                <li key={row.id}>
                  <PageReadinessListRow
                    actionWidth={row.actionWidth}
                    detailWidths={row.detailWidths}
                    eyebrowWidth={row.eyebrowWidth}
                    metaWidths={row.metaWidths}
                    titleWidth={row.titleWidth}
                  />
                </li>
              ))}
            </ol>
          </section>

          <section className="recall-panel recall-results-detail-panel">
            <div className="recall-results-detail-scroll-content">
              <div className="recall-results-readiness__detail">
                <SkeletonBlock as="div" height="1.1rem" width="9rem" />
                <SkeletonText
                  lineHeight="0.82rem"
                  lineWidths={["100%", "88%"]}
                />
                <ol className="recall-results-readiness__detail-list">
                  {selectedResultQuestionRows.map((row) => (
                    <li key={row.id}>
                      <PageReadinessListRow
                        actionWidth={row.actionWidth}
                        detailWidths={row.detailWidths}
                        eyebrowWidth={row.eyebrowWidth}
                        metaWidths={row.metaWidths}
                        titleWidth={row.titleWidth}
                      />
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        </div>
      </PageReadinessState>
    </PageLayout>
  );
}

export function RecallSelectionPageReadinessState() {
  return (
    <PageLayout
      aria-label="Recall setup"
      as="section"
      className="recall-workspace recall-surface"
      description={<RecallSurfaceDescription widths={["25rem", "20rem"]} />}
      headerClassName="recall-surface__header recall-select__header"
      title={
        <ReadinessTitle label={recallSelectionReadinessLabel} width="14rem" />
      }
    >
      <PageReadinessState
        className="recall-selection-readiness"
        label={recallSelectionReadinessLabel}
      >
        <div className="recall-selection-layout recall-selection-layout--picker">
          <section className="recall-panel recall-note-picker recall-select-note-picker">
            <div className="recall-selection-readiness__toolbar">
              <SkeletonBlock
                as="div"
                height="2.75rem"
                radius="pill"
                width="100%"
              />
              <SkeletonBlock
                as="div"
                height="2.75rem"
                radius="pill"
                width="11rem"
              />
            </div>

            <div className="recall-selection-readiness__filter-summary">
              <SkeletonBlock as="div" height="0.95rem" width="12rem" />
              <div className="recall-selection-readiness__filter-actions">
                <SkeletonBlock
                  as="div"
                  height="2.3rem"
                  radius="pill"
                  width="9rem"
                />
                <SkeletonBlock
                  as="div"
                  height="2.3rem"
                  radius="pill"
                  width="8rem"
                />
              </div>
            </div>

            <ol className="recall-selection-readiness__picker-list">
              {selectionAvailableRows.map((row) => (
                <li key={row.id}>
                  <div className="recall-selection-readiness__note-row">
                    <SkeletonBlock
                      as="div"
                      height="1.2rem"
                      radius="pill"
                      width="1.2rem"
                    />
                    <div className="recall-selection-readiness__note-copy">
                      <SkeletonBlock
                        as="div"
                        height="1rem"
                        width={row.titleWidth}
                      />
                      <SkeletonText
                        lineHeight="0.82rem"
                        lineWidths={row.detailWidths}
                      />
                      <div className="recall-selection-readiness__note-labels">
                        {row.labelWidths.map((width) => (
                          <SkeletonBlock
                            as="div"
                            height="1.55rem"
                            key={`${row.id}-${width}`}
                            radius="pill"
                            width={width}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <aside className="recall-panel recall-session-setup recall-select-session-setup">
            <div className="recall-select-session-setup__header">
              <SkeletonBlock as="div" height="0.85rem" width="8rem" />
            </div>

            <section className="recall-selection-readiness__selected">
              <SkeletonBlock as="div" height="1rem" width="10rem" />
              <ol className="recall-selection-readiness__selected-list">
                {selectionSelectedRows.map((row) => (
                  <li key={row.id}>
                    <div className="recall-selection-readiness__selected-row">
                      <SkeletonBlock
                        as="div"
                        height="0.95rem"
                        width={row.titleWidth}
                      />
                      <SkeletonText
                        lineHeight="0.78rem"
                        lineWidths={row.detailWidths}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="recall-selection-readiness__controls">
              <SkeletonBlock as="div" height="0.95rem" width="9rem" />
              <SkeletonBlock
                as="div"
                height="2.75rem"
                radius="pill"
                width="100%"
              />
            </section>

            <div className="recall-selection-readiness__actions">
              <SkeletonBlock
                as="div"
                height="2.75rem"
                radius="pill"
                width="8rem"
              />
              <SkeletonBlock
                as="div"
                height="2.75rem"
                radius="pill"
                width="100%"
              />
            </div>
          </aside>
        </div>
      </PageReadinessState>
    </PageLayout>
  );
}

export function RecallSessionPageReadinessState() {
  return (
    <section className="recall-shell" aria-label="Recall session">
      <PageHeader
        actions={
          <div className="recall-session-status">
            <div className="recall-progress-card">
              <div className="recall-progress-card__count">
                <SkeletonBlock as="div" height="1rem" width="4rem" />
                <SkeletonBlock as="div" height="0.7rem" width="2.5rem" />
              </div>
              <SkeletonBlock as="div" height="0.38rem" width="100%" />
              <SkeletonBlock
                as="div"
                height="1.9rem"
                radius="pill"
                width="7rem"
              />
              <SkeletonBlock as="div" height="0.85rem" width="10rem" />
            </div>
          </div>
        }
        actionsClassName="recall-shell__progress"
        className="recall-shell__header"
        copyClassName="recall-shell__context"
        headingLevel={3}
        title={
          <ReadinessTitle
            height="2.1rem"
            label={recallSessionReadinessLabel}
            width="13rem"
          />
        }
      />

      <PageReadinessState
        className="recall-session-readiness"
        label={recallSessionReadinessLabel}
      >
        <div className="recall-session-layout">
          <div className="recall-session-main">
            <article className="recall-card">
              <div className="recall-card__hidden-state">
                <SkeletonBlock
                  as="div"
                  height="2.85rem"
                  radius="pill"
                  width="2.85rem"
                />
                <SkeletonBlock as="div" height="2.2rem" width="20rem" />
                <SkeletonBlock as="div" height="1px" width="3.6rem" />
                <SkeletonText lineHeight="0.95rem" lineWidths={["18rem"]} />
                <SkeletonBlock
                  as="div"
                  height="2.45rem"
                  radius="pill"
                  width="10rem"
                />
                <div className="recall-session-readiness__textarea">
                  <SkeletonText
                    lineHeight="0.95rem"
                    lineWidths={["100%", "98%", "72%"]}
                  />
                </div>
                <SkeletonBlock
                  as="div"
                  height="2.8rem"
                  radius="pill"
                  width="13rem"
                />
              </div>
            </article>

            <div className="recall-session-main__actions recall-session-readiness__footer">
              <SkeletonBlock
                as="div"
                height="2.5rem"
                radius="pill"
                width="8rem"
              />
              <SkeletonBlock
                as="div"
                height="2.5rem"
                radius="pill"
                width="9rem"
              />
            </div>
          </div>
        </div>
      </PageReadinessState>
    </section>
  );
}
