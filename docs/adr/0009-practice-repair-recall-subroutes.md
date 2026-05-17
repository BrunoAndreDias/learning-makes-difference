# Practice Repair Recall Subroutes

Practice Repair will be modeled as Recall-owned orchestration instead of an inline Results toggle or a top-level product section. Confirmed **Practice Repair Entries** get durable identities and use `/recall/repair/:practiceRepairEntryId` as their canonical workspace, while `/recall/repair` is a Practice Repair Queue and `/recall/results/:sessionResultId/questions/:questionResultId/repair` is the question-scoped draft view that preserves weak recall evidence before confirmation.

This keeps Practice Repair first-class enough for focused repair work without turning it into a full error log or separate primary workspace. The main trade-off is more routing and identity complexity, but it preserves clear ownership: Recall owns weak-evidence review, repair queueing, entry lifecycle, and follow-up recall; Study Notes continues to own Study Note editing, splitting, sibling creation, and memory-aid editing through explicit deep links back to the active Practice Repair workspace.

Consequences: Results remains the full historical evidence surface, the Practice Repair Queue stays actionable by prioritizing active entries and deduplicating unconfirmed candidates, and completed repairs lead to targeted single-Study-Note follow-up recall rather than the full Recall Today queue.
