## Parent

- #149

## What to build

Make early-ended SessionResults explain coverage clearly without reviving duplicated note review. The selected SessionResult should keep fully attempted sessions compact, but when a RecallSession ended before reaching every targeted Note, the summary line should make that partial coverage explicit and a lightweight Not reached notes section should appear. That section should list only unreached Note titles and should stay absent when every targeted Note was reached.

## Acceptance criteria

- [ ] Fully attempted SessionResults keep the simpler compact summary line, while early-ended SessionResults explicitly describe attempted Question coverage against the broader targeted Note set.
- [ ] Single-note single-question SessionResults do not render a duplicated note section.
- [ ] Not reached notes appears only when targeted Notes were unreached, lists only Note titles, and stays absent when all targeted Notes were reached.

## Blocked by

- #151
