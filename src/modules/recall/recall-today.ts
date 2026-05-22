import {
  type PlannedRecallWorkItem,
  planRecallWork,
  type RecallWorkReason,
} from "./recall-work-planning";

export type RecallTodayReason = RecallWorkReason;
export type RecallTodayQueueItem = PlannedRecallWorkItem;

export function buildRecallTodayQueue(
  input: Parameters<typeof planRecallWork>[0],
): RecallTodayQueueItem[] {
  return [...planRecallWork(input).recallTodayQueue];
}
