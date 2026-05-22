import {
  getPrimaryRecallWorkReason,
  type PlannedRecallWorkItem,
  planRecallWork,
  type RecallWorkPlanningInput,
  type RecallWorkReason,
} from "./recall-work-planning";

export type RecallTodayReason = RecallWorkReason;
export type RecallTodayQueueItem = PlannedRecallWorkItem;

export function buildRecallTodayQueue(
  input: RecallWorkPlanningInput,
): RecallTodayQueueItem[] {
  return [...planRecallWork(input).recallTodayQueue];
}

export function getPrimaryRecallTodayReason(item: {
  reasons: readonly RecallTodayReason[];
}): RecallTodayReason {
  return getPrimaryRecallWorkReason(item.reasons);
}
