export function isModifiedKeyShortcut(
  event: Pick<KeyboardEvent, "ctrlKey" | "key" | "metaKey">,
  key: string,
): boolean {
  return (
    (event.metaKey || event.ctrlKey) &&
    event.key.toLocaleLowerCase() === key.toLocaleLowerCase()
  );
}
