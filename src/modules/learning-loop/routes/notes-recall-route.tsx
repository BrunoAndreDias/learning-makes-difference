import { FlashCardRecallSessionPage } from "./recall-session-route";

export function NotesRecallSessionPage() {
  return (
    <FlashCardRecallSessionPage
      breadcrumbCurrent="Recall"
      breadcrumbLabel="Notes"
      breadcrumbTo="/notes"
      returnTo="/notes"
      subtitle="Recall the note from memory before revealing the answer. Rate honestly — your ratings shape future practice."
    />
  );
}
