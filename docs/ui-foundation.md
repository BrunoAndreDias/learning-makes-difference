# UI Foundation

This document is the canonical styling reference for feature work that builds on issue 14.

## Source material

- Primary layout references: `docs/layout/no_collapse.png` and `docs/layout/collapsed_menu_withou_focus_mode.png`
- Brand mark: `docs/layout/logo.png`
- Product and interaction language: `docs/prd-learning-makes-difference.md`
- Accessibility baseline: `docs/adr/0001-wcag2-accessibility.md`

## Visual direction

The shell is intentionally bright, dense, and study-focused rather than marketing-oriented. The layout references establish:

- warm canvas backgrounds instead of flat white
- strong blue utility accents anchored to the logo
- soft inset surfaces for dense productivity controls
- dark slate text for long-form readability
- rounded card geometry that stays calm rather than playful

## Token contract

The shared token source lives in `src/design-system/tokens.ts`.

- `brand`: product naming, shell tone, and the canonical logo/layout references
- `color`: brand, shell, content, and supporting semantic colors
- `typography`: heading, body, and label defaults
- `spacing`: the base spacing scale for layout and component rhythm
- `radius`: corner scale for controls, cards, and pill labels
- `breakpoints`: responsive thresholds for future routes and shell variants
- `focus`: visible focus ring defaults sized for WCAG-friendly keyboard use

## Global defaults

The CSS foundation lives in `src/design-system/global.css`.

- Base text remains at `16px` with `1.5` line-height for readable long-form note content.
- `:focus-visible` uses a 3px blue outline plus a translucent ring so keyboard focus is obvious on light surfaces.
- Surfaces assume a warm off-white panel layered over a slightly cooler shell gradient.
- Reusable shell classes such as `.app-shell`, `.surface-card`, `.shell-panel`, and `.tag` are intended as the first shared primitives for route-level UI.

## Usage guidance

- Prefer tokens before introducing one-off hex values, spacing values, or radii.
- Keep semantic HTML as the default; styling should not require ARIA to repair interactions.
- Use `color.content.strong` or `color.content.default` for body copy to preserve contrast on light surfaces.
- Reserve `color.brand.primary` for actions, focus treatments, and currently selected state.
- Preserve the dense three-panel shell feel from the layout references when building the first authenticated screens.
