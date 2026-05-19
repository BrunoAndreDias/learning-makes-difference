const practiceRepairPath = "/practice-repair" as const;

const removedRecallPracticeRepairPathPattern = /^\/recall\/repair(?:\/.*)?$/;
const removedRecallPracticeRepairResultsPathPattern =
  /^\/recall\/results\/[^/]+\/questions\/[^/]+\/repair$/;

export function isPracticeRepairPath(pathname: string) {
  return (
    pathname === practiceRepairPath ||
    pathname.startsWith(`${practiceRepairPath}/`)
  );
}

export function isRemovedRecallPracticeRepairPath(pathname: string) {
  return (
    removedRecallPracticeRepairPathPattern.test(pathname) ||
    removedRecallPracticeRepairResultsPathPattern.test(pathname)
  );
}
