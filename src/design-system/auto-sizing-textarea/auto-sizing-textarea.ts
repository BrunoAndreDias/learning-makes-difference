export function resizeTextareaToFitContent(
  textarea: HTMLTextAreaElement | null,
) {
  if (textarea === null) {
    return;
  }

  const borderBoxOffset = textarea.offsetHeight - textarea.clientHeight;

  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight + borderBoxOffset}px`;
}
