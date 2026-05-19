# Today Landing And Authenticated IA

Supersedes ADR-0009.

Authenticated Users should land on `/today`, and the app shell should use **Today** as the navigation label for **Study Guidance** instead of exposing **Insights** as a primary destination. Today is product copy for the decision surface that helps the User choose the next action; it does not replace the domain concept **Study Guidance**, and it does not rename **Recall Today**. Practice Repair is no longer a stable Recall-owned IA decision. The long-term authenticated IA moves toward separate top-level destinations for Today, Study Notes, Recall, Practice Repair, and Focus.

This simplifies the shell around current jobs instead of mixed execution and analytics language. The trade-off is a temporary gap between product direction and routing implementation: this slice introduces `/today`, removes `/insights`, and updates default authenticated landing behavior now, while later slices will finish moving Practice Repair out of Recall and replace the remaining transitional `/recall/repair*` ownership.

Consequences: authenticated root, login, registration, and not-found fallbacks land on `/today`; the primary navigation uses **Today** and removes **Insights**; **Study Guidance** remains the domain term behind Today; **Recall Today** keeps its existing name inside Recall; and future routing work should treat Recall-owned Practice Repair URLs as transitional rather than canonical.
