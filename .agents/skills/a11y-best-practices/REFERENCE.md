# A11y Reference

This skill is adapted from GitHub's a11y guidance and aligned to this repo's WCAG ADR.
Source reference: `https://github.com/github/awesome-copilot/blob/main/instructions/a11y.instructions.md`

## Severity

- `critical`: Users cannot complete a core task or access key content.
- `important`: Significant friction or broken assistive technology support.
- `suggestion`: Useful improvement with lower immediate risk.

## Core checklist

### Semantics first

- Use real `button`, `a`, `input`, `select`, `textarea`, `table`, `th`, `nav`, `main`, `header`, and heading levels before custom roles.
- Use `button` for actions and `a` for navigation.
- Avoid clickable `div` or `span` unless there is no viable native control.
- Prefer implicit semantics over `role` attributes that restate the obvious.

### Keyboard and focus

- All interactive features must work without a mouse.
- Focus order should match visual and reading order.
- No keyboard trap.
- Focus must remain visible.
- On open/close for dialogs, menus, and popovers, move focus deliberately and restore it predictably.
- Provide a bypass path for repeated navigation where needed.
- Ensure sticky headers or overlays do not hide the focused element.

### Names, labels, and instructions

- Every control needs an accessible name.
- Visible labels should match or be contained in the accessible name.
- Icon-only buttons still need a text alternative.
- Placeholder text is not a substitute for a label.
- Use descriptive headings, labels, and link text.

### Forms and errors

- Associate labels programmatically.
- Mark required fields in text, not color alone.
- Tie help text and error text to fields with the proper relationships.
- Describe errors in text and suggest recovery when possible.
- Allow paste, password managers, and autocomplete where appropriate.
- Avoid unnecessary repeated data entry in a single flow.

### Content and media

- Informative images need meaningful alt text; decorative images use empty alt text.
- Captions are required for prerecorded video; transcripts are needed for audio-only content.
- Do not encode meaning only through color or icons.
- Use real lists and tables for structured information.

### Visual usability

- Text contrast should meet AA thresholds.
- Non-text UI indicators also need sufficient contrast.
- Content should reflow at narrow widths without two-dimensional scrolling for normal reading.
- Zoom and text spacing changes should not break content or controls.
- Respect reduced-motion preferences for non-essential animation.
- Targets should be large enough or spaced enough to avoid accidental activation.

### Dynamic UI and announcements

- Use `aria-live` or status patterns for async updates that users need to hear.
- Do not move focus for routine status updates unless the user must act there.
- Loading, success, validation, and save states should be exposed to assistive tech.

### ARIA restraint

- No ARIA is better than bad ARIA.
- Do not add `role="button"` when a real `button` is possible.
- Keep `aria-expanded`, `aria-controls`, `aria-selected`, and similar states synchronized with actual UI state.
- Only use complex ARIA patterns when native HTML cannot provide the behavior.

## Common anti-patterns

- Click handler on non-interactive elements without keyboard support.
- Removing focus outlines without an equivalent visible focus style.
- Form fields with placeholders but no labels.
- Dialogs that do not trap focus while open or do not return focus on close.
- Validation that is only color-coded or only announced visually.
- Tables built from generic elements with no table semantics.
- Accordions, tabs, or menus that only work with pointer input.
- Links with vague text like "click here" or duplicate names that hide destination.
- Auto-playing, flashing, or motion-heavy UI with no user control.
- Custom checkboxes, radios, and selects that are less accessible than the native control.

## Review phrasing

Use this format when useful:

- `Severity`: critical | important | suggestion
- `Issue`: what breaks for the user
- `Why it matters`: keyboard, screen reader, low vision, cognitive load, touch precision, or motion sensitivity
- `Fix`: the smallest semantic correction that resolves the issue

## Notes for this repo

- Treat WCAG 2.1 AA as the minimum contractual baseline because that is what the ADR states today.
- Borrow WCAG 2.2 AA checks when reviewing modern interaction patterns, especially focus visibility, focus not obscured, dragging alternatives, and target size.
