# Lightweight Practice Repair Entries

Practice Repair will become a lightweight first-class v1 concept by persisting **Practice Repair Entries** tied to weak recall evidence from Results review. Each entry belongs to a **Study Note**, references the **SessionResult** and stored **Question** that prompted it, carries a structured **Practice Repair Intent** plus a free-text correction, and can create a **Practice Follow-up** that feeds **Recall Today** once actionable.

This deliberately expands the previous v1 boundary, which kept Practice Repair as simple suggestions only. The trade-off is that persisted repair entries add data-model and lifecycle complexity, but they give the app a bridge from weak recall to future practice without introducing a full error log, mistake taxonomy, or remediation workflow. Full error logs and mistake-type classification remain deferred.

Consequences: **Practice Repair Entries** are future-practice evidence rather than recall evidence, active/historical state is derived from lifecycle facts, and deleted **Study Notes** leave their repair entries as read-only historical repair records visible only through Results or other historical context.
