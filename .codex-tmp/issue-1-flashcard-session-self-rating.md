## Parent

- #149

## What to build

Update FlashCard Results semantics so the Recall Section no longer presents FlashCard review as if it had an independent score. In the Results list and selected Session review, FlashCard should use the average self-rating percentage as its aggregate summary metric. The selected SessionResult should keep the current score slot and progress iconography, but relabel that metric as Session self rating and remove per-Question numeric score from FlashCard review.

## Acceptance criteria

- [ ] FlashCard result rows in the Results list still show a compact percentage, and that percentage reflects average Session self rating rather than generic score semantics.
- [ ] The selected FlashCard SessionResult uses the current score slot for an aggregate metric labeled Session self rating instead of Score.
- [ ] FlashCard Question review no longer shows per-Question numeric score, while preserving the existing FlashCard mode label and Question count behavior.

## Blocked by

None - can start immediately
