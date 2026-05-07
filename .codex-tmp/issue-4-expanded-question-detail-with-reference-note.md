## Parent

- #149

## What to build

Build the expanded Question detail flow for Session review so each opened Question becomes a trustworthy historical comparison. Expanded detail should repeat the self-rating, present Your answer first, then the Reference note, show the full stored Note body immediately, preserve the full typed answer text as written, and explicitly say No typed answer recorded when no text was stored. Attempted Questions must remain expandable even when the answer text is empty.

## Acceptance criteria

- [ ] Expanding a Question shows the repeated self-rating, then Your answer, then Reference note in that order.
- [ ] If a typed answer exists, expanded detail shows the full stored text as written; if none exists, it says No typed answer recorded.
- [ ] Expanded detail shows the full Reference note body immediately, and Questions without typed answer text still remain expandable.

## Blocked by

- #152
