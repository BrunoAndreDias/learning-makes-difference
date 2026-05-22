import {
  type DueForRecallQueueItem,
  planRecallWork,
  type RecallWorkPlanningInput,
} from "./recall-work-planning";

export type DueTodayQueueItem = DueForRecallQueueItem;

export function buildDueTodayQueue(
  input: RecallWorkPlanningInput,
): DueTodayQueueItem[] {
  return [...planRecallWork(input).dueForRecallQueue];
}
