import { PageLayout } from "../../design-system/page-layout";
import {
  PageReadinessCard,
  PageReadinessListRow,
  PageReadinessState,
  SkeletonBlock,
  SkeletonText,
} from "../../design-system/skeleton";
import "./study-guidance.css";

const summaryCardConfigs = [
  {
    detailWidths: ["12rem", "10rem"],
    id: "practice-repair",
    metricWidth: "2.4rem",
    titleWidth: "6rem",
  },
  {
    detailWidths: ["11rem", "8rem"],
    id: "practice-follow-up",
    metricWidth: "2.6rem",
    titleWidth: "7rem",
  },
  {
    detailWidths: ["12rem", "9rem"],
    id: "due-today",
    metricWidth: "2.2rem",
    titleWidth: "5.5rem",
  },
  {
    detailWidths: ["11rem", "8.5rem"],
    id: "completion-blocker",
    metricWidth: "2.6rem",
    titleWidth: "7.5rem",
  },
  {
    detailWidths: ["12rem", "9rem"],
    id: "first-recall",
    metricWidth: "2.3rem",
    titleWidth: "6.25rem",
  },
  {
    detailWidths: ["10rem", "7.5rem"],
    id: "interleaving-ready",
    metricWidth: "2.8rem",
    titleWidth: "8rem",
  },
] as const;

const rowConfigs = [
  {
    actionWidth: "11rem",
    detailWidths: ["100%", "78%"],
    eyebrowWidth: "8rem",
    id: "practice-repair-row",
    metaWidths: ["11rem", "9rem"],
    titleWidth: "17rem",
  },
  {
    actionWidth: "10rem",
    detailWidths: ["96%", "82%"],
    eyebrowWidth: "7rem",
    id: "practice-follow-up-row",
    metaWidths: ["10rem", "8rem"],
    titleWidth: "15rem",
  },
  {
    actionWidth: "11.5rem",
    detailWidths: ["94%", "72%"],
    eyebrowWidth: "8.5rem",
    id: "due-today-row",
    metaWidths: ["11rem", "8.5rem"],
    titleWidth: "18rem",
  },
  {
    actionWidth: "10.5rem",
    detailWidths: ["92%", "76%"],
    eyebrowWidth: "6.5rem",
    id: "first-recall-row",
    metaWidths: ["9rem", "7rem"],
    titleWidth: "14rem",
  },
] as const;

export function StudyGuidancePageReadinessState() {
  return (
    <PageLayout
      actions={
        <SkeletonBlock
          as="div"
          height="2.8rem"
          radius="pill"
          width="12.25rem"
        />
      }
      className="study-guidance-workspace"
      description={
        <SkeletonText
          as="span"
          className="study-guidance-readiness__description"
          lineHeight="0.95rem"
          lineWidths={["34rem", "28rem"]}
        />
      }
      headerClassName="study-guidance-workspace__page-header"
      headingLevel={1}
      title={
        <>
          <span className="sr-only">Preparing Study Guidance</span>
          <SkeletonBlock as="span" height="2.6rem" width="16rem" />
        </>
      }
    >
      <PageReadinessState
        className="study-guidance-readiness"
        label="Preparing Study Guidance"
      >
        <section className="study-guidance-summary">
          <ul className="study-guidance-summary__list">
            {summaryCardConfigs.map((config) => (
              <li key={config.id}>
                <PageReadinessCard
                  detailWidths={config.detailWidths}
                  metricWidth={config.metricWidth}
                  titleWidth={config.titleWidth}
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="study-guidance-plan">
          <ol className="study-guidance-plan__list">
            {rowConfigs.map((config) => (
              <li key={config.id}>
                <PageReadinessListRow
                  actionWidth={config.actionWidth}
                  className="study-guidance-readiness__row"
                  detailWidths={config.detailWidths}
                  eyebrowWidth={config.eyebrowWidth}
                  metaWidths={config.metaWidths}
                  titleWidth={config.titleWidth}
                />
              </li>
            ))}
          </ol>
        </section>
      </PageReadinessState>
    </PageLayout>
  );
}
