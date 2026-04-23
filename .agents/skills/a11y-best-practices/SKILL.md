---
name: a11y-best-practices
description: Reviews and implements web accessibility best practices for product UI, code changes, and design decisions. Use when the user asks for accessibility help, mentions a11y/WCAG/ARIA/keyboard/screen readers/focus/contrast/forms, or wants an accessibility review or fix.
---

# A11y Best Practices

Use this skill for accessibility reviews and implementation work in web apps.

Project baseline:
- This repo treats accessibility as a first-class requirement.
- The local ADR targets WCAG 2.1 AA.
- Prefer WCAG 2.2 AA checks when they improve the result without conflicting with existing requirements.

## Quick start

1. Identify the surface: page, component, flow, form, modal, navigation, media, or data display.
2. Check semantics before ARIA. Prefer native HTML that already has the right behavior.
3. Review keyboard access, focus behavior, accessible names, instructions, errors, and announcements.
4. Check visual requirements that affect usability: contrast, visible focus, target size, reflow, zoom, reduced motion.
5. Report issues by severity with concrete fixes. If editing code, implement the smallest correct semantic fix first.

## Review workflow

When reviewing or changing code:
- Start with user impact, not lint output.
- Flag blockers first: missing labels, broken keyboard flow, hidden focus, inaccessible dialogs, incorrect button/link usage, missing alt text, color-only meaning.
- Cite the affected file and the user-facing failure.
- Mention the relevant WCAG criterion when it materially clarifies the problem.
- Prefer patterns that work for keyboard, screen reader, zoom, and touch users at the same time.

## Implementation rules

- Use native controls before ARIA widgets.
- Do not add ARIA that duplicates or conflicts with native semantics.
- Ensure every interactive element has an accessible name.
- Keep DOM order and focus order aligned with the intended reading order.
- Make all functionality reachable by keyboard alone.
- Use explicit labels, helpful instructions, and text-based error recovery for forms.
- Announce async status changes with the right live-region pattern when needed.
- Do not rely only on color, position, shape, hover, or sound to convey meaning.
- Preserve visible focus, sufficient contrast, and usable target sizes.

## Output contract

For reviews:
- List findings ordered by severity.
- For each finding, include the user impact, location, and recommended fix.

For implementation:
- State which a11y issue was fixed.
- Note any remaining risk, testing gap, or manual verification still needed.

See [REFERENCE.md](REFERENCE.md) for the detailed checklist and anti-patterns.
