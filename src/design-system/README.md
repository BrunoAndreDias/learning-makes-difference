# Design System

## Rules

- Design-system UI modules live in their own folders under `src/design-system/`.
- Each module folder owns the files that change with that module, such as its public entrypoint, implementation, tests, styles, stories, and fixtures.
- Public imports should go through the module folder path, for example `src/design-system/button`.
- When a reusable interaction needs both button and navigation forms, keep them in the same DS module instead of duplicating route-local class composition.
- When making a design decision, check the design system first. Use or extend an existing design-system module before introducing route-local or module-local UI.
- Only reach for a non-design-system solution when the UI is domain-specific enough that promoting it would create a shallow module or false reuse.
