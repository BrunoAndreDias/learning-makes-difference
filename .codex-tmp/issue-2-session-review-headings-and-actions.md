## Parent

- #149

## What to build

Clean up the selected SessionResult surface so it reads as a dedicated historical review pane instead of a second launch point for Recall. Rename the selected result pane to Session review, rename the main section to Questions, shorten the stat label to Questions, and remove the selected-result footer actions so starting a new RecallSession remains the responsibility of the master-panel Start Recall action.

## Acceptance criteria

- [ ] The selected result pane heading uses Session review instead of Result details.
- [ ] The main Question-review section uses Questions instead of Questions and answers, and the stat label uses Questions instead of Questions attempted.
- [ ] The selected SessionResult footer no longer shows Back to selection or Start another recall, while the master-panel Start Recall action remains available.

## Blocked by

None - can start immediately
