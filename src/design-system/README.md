# Design System

## Rules

- Design-system UI modules live in their own folders under `src/design-system/`.
- Each module folder owns the files that change with that module, such as its public entrypoint, implementation, tests, styles, stories, and fixtures.
- Public imports should go through the module folder path, for example `src/design-system/button`.
- When a reusable interaction needs both button and navigation forms, keep them in the same DS module instead of duplicating route-local class composition.
- When making a design decision, check the design system first. Use or extend an existing design-system module before introducing route-local or module-local UI.
- Only reach for a non-design-system solution when the UI is domain-specific enough that promoting it would create a shallow module or false reuse.

## Spacing Scale

Use the fixed spacing scale from `src/design-system/tokens.ts` and the matching CSS variables from `global.css`. Avoid one-off gap, margin, or padding values unless the value is intrinsic to a component's physical control size.

| Token | CSS variable | Size |
| --- | --- | --- |
| `spacing[1]` | `--space-1` | `0.25rem` |
| `spacing[2]` | `--space-2` | `0.5rem` |
| `spacing[3]` | `--space-3` | `0.75rem` |
| `spacing[4]` | `--space-4` | `1rem` |
| `spacing[5]` | `--space-5` | `1.5rem` |
| `spacing[6]` | `--space-6` | `2rem` |
| `spacing[7]` | `--space-7` | `3rem` |
| `spacing[8]` | `--space-8` | `4rem` |

## Buttons

Use `Button` and `ButtonLink` from `src/design-system/button`. Use `size="compact"` for dense toolbars, list panels, and inline catalog actions; use the default regular size for primary page actions and forms.
