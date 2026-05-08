# Study Optimization Grill Inputs

These documents convert `/Users/brunodias/Downloads/study_optimization_app_blueprint.md` into focused inputs for future `grill-with-docs` sessions.

They are intentionally written as decision packets, not final product documentation. Each packet gives the grilling session a narrow scope, a recommended default answer, and the questions that should be challenged against `CONTEXT.md`, ADRs, and the code.

## Current Tension

The current project language says a Note is the durable recall item. The study optimization blueprint proposes a separate Study Item as the trainable unit.

That is the central decision to grill first. Most later decisions depend on it.

## Recommended Session Order

1. `01-product-thesis-and-learning-loop.md`
2. `02-domain-model-study-items.md`
3. `03-recall-scheduler-and-session-builder.md`
4. `04-labels-dashboard-and-exam-mode.md`
5. `05-note-creation-mnemonics-ai-and-settings.md`
6. `06-focus-integration-and-roadmap.md`

## How To Use These

For each session, feed one file into `grill-with-docs` and ask it to:

- challenge every proposed term against `CONTEXT.md`
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
