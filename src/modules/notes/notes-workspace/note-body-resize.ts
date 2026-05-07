export type NoteBodyResizeGeometry = {
  layoutLeft: number;
  layoutWidth: number;
  pointerClientX: number;
  splitterWidth: number;
  columnGap: number;
};

export type NoteBodyResizeLimits = {
  maxFraction: number;
  minFraction: number;
};

function clampNoteBodyFraction(
  fraction: number,
  limits: NoteBodyResizeLimits,
): number {
  return Math.min(limits.maxFraction, Math.max(limits.minFraction, fraction));
}

export function getNoteBodyFractionFromPointer(
  geometry: NoteBodyResizeGeometry,
  limits: NoteBodyResizeLimits,
): number {
  const availableWidth =
    geometry.layoutWidth - geometry.splitterWidth - geometry.columnGap * 2;

  if (availableWidth <= 0) {
    return limits.minFraction;
  }

  const bodyWidth =
    geometry.pointerClientX -
    geometry.layoutLeft -
    geometry.columnGap -
    geometry.splitterWidth / 2;

  return clampNoteBodyFraction(bodyWidth / availableWidth, limits);
}

export function getNoteBodyFractionFromBodyWidth(
  bodyWidth: number,
  geometry: Omit<NoteBodyResizeGeometry, "pointerClientX">,
  limits: NoteBodyResizeLimits,
): number {
  const availableWidth =
    geometry.layoutWidth - geometry.splitterWidth - geometry.columnGap * 2;

  if (availableWidth <= 0) {
    return limits.minFraction;
  }

  return clampNoteBodyFraction(bodyWidth / availableWidth, limits);
}
