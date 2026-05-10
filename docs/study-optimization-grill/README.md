# Study Optimization Grill Inputs

These documents convert `/Users/brunodias/Downloads/study_optimization_app_blueprint.md` into focused inputs for future `grill-with-docs` sessions.

They are intentionally written as decision packets, not final product documentation. Each packet gives the grilling session a narrow scope, a recommended default answer, and the questions that should be challenged against `CONTEXT.md`, ADRs, and the code.

## Current Baseline

`01-product-thesis-and-learning-loop.md` is completed. `CONTEXT.md` and ADR 0005 resolved the original Note-versus-Study-Item tension:

- **Study Note** is the durable recall target.
- **Note** is source material behind one or more Study Notes.
- "Study Item" was rejected as too abstract for user-facing domain language.
- Low-performing Study Notes use **Needs practice** in user-facing copy.
- Scheduled recall uses **Due for Recall** as the domain term and "Recall Today" as the likely UI copy.

The remaining packets should treat that baseline as fixed unless a future session explicitly reopens the decision.

## Recommended Session Order

1. `01-product-thesis-and-learning-loop.md` - done; retained as the resolved baseline.
2. `02-domain-model-study-notes.md`
3. `03-recall-scheduler-and-session-builder.md`
4. `04-labels-dashboard-and-exam-mode.md`
5. `05-study-note-creation-memory-aids-ai-and-settings.md`
6. `06-focus-integration-and-roadmap.md`

## How To Use These

For each session, feed one file into `grill-with-docs` and ask it to:

- challenge every proposed term against `CONTEXT.md`
- preserve decisions already captured in `CONTEXT.md` and ADRs
- identify contradictions with the current code
- resolve one decision at a time
- update `CONTEXT.md` only when a term is actually decided
- create an ADR only for hard-to-reverse architectural choices

## Expected Outputs

Each grill session should end with one of these outcomes:

- accepted domain language
- rejected or renamed domain language
- an ADR candidate
- a migration or implementation slice
- an explicit unresolved question

Do not treat these packets as already-decided product requirements.
