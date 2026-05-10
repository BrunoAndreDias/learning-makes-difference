# Study Notes as Durable Recall Targets

The app will use **Study Notes** as the durable practiced object for recall, scoring, scheduling, Labels, Metaphors, and Acronyms. **Notes** remain source material behind Study Notes: a Study Note belongs to exactly one Note, a Note may produce multiple Study Notes, and Users create or edit source Notes through the Study Notes workflow rather than through a separate source-note workspace.

This replaces the earlier Note-centered recall model because the product promise is not just capturing notes; it is turning source material into trainable recall units. Rejected alternatives were keeping Notes as the durable recall target, which made independent prompts and schedules awkward, and using the term Study Item, which was too abstract for a user-facing study product.

Consequences: the primary workspace and route become **Study Notes** at `/study-notes`; `/notes` is removed; RecallSessions target Study Notes; Labels and memory aids attach to Study Notes; source Notes are supporting context and are not directly deleted except through confirmed deletion of the last linked Study Note.
