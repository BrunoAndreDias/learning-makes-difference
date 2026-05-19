# Recall Schedules Use Simplified Spaced Repetition

Each **Study Note** will have a **Recall Schedule** that determines when it should next be recalled. The app will use a simplified spaced-repetition scheduler shaped by recall evidence: forgotten or hard recall keeps the Study Note close, while good or easy recall pushes the next recall further away. Users see simple product language such as **Recall Today** and next recall timing, not algorithm names.

This replaces deriving **Due for Recall** only from the latest recall score and age, because that would make scheduling too coarse once the app starts recommending recall by default. Rejected alternatives were a fixed deterministic interval ladder, which is easy to explain but less adaptive, and full SM-2, which carries implementation complexity and historical edge cases that v1 does not need.

Consequences: **Due for Recall** is assigned from a per-Study Note Recall Schedule, **Recall Today** can be the default recall entry point, and implementation must persist enough schedule state to recompute future recall timing without exposing scheduler internals to the User.
