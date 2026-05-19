PROTOTYPE - Focus nav row

Question:
Should the Focus sidebar navigation row combine route navigation with compact
FocusSession status and a separate Start/End control?

How to run:
`pnpm run dev`, then open `/focus?variant=A`, `/focus?variant=B`, or
`/focus?variant=C`. The chosen variant also appears across authenticated
workspace routes while the sidebar is expanded.

Variants:
- A: Inline label row. Navigation content, timer, and Start/End live inside one
  Focus row; clicking the button controls the session and clicking the rest
  navigates to Focus.
- B: Status stack row. The Focus row becomes a slightly framed active utility
  with visible state copy.
- C: Separated control row. The timer reads more like a badge below the Focus
  label, with the action button beside the navigation target.

Verdict:
Variant A is the current preferred direction. Keep the Start/End button visually
inside the Focus label surface while preserving separate click behavior.
