# Practice Repair Top-Level Section

Builds on ADR-0010 and supersedes its remaining transitional Practice Repair routing guidance.

Practice Repair should be a top-level authenticated section instead of Recall-owned subroutes. The canonical routes are `/practice-repair` for the queue, `/practice-repair/:practiceRepairEntryId` for confirmed workspaces, and `/practice-repair/results/:sessionResultId/questions/:questionResultId` for question-scoped draft review. Legacy `/recall/repair*` URLs are removed rather than redirected.

This aligns the shell with the current job structure: Today decides what matters next, Recall runs recall work and Results review, Practice Repair owns repair orchestration, and Study Notes owns content edits reached through explicit deep links. The trade-off is route churn and link updates, but it removes misleading Recall ownership and makes Practice Repair consistently reachable from navigation, Results, Study Guidance, and Study Notes return paths.

Consequences: the primary navigation includes a top-level Practice Repair item; Results continues to surface weak-question repair candidates but links them into the Practice Repair namespace; Study Notes return targets use canonical Practice Repair entry ids; and removed Recall-owned Practice Repair URLs behave like generic removed routes instead of compatibility redirects.
