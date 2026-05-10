# Design-System Module Aggregation

The design system organizes reusable UI by module aggregation. Each reusable UI module gets its own folder under `src/design-system/`, and that folder owns the files that change with that module: public entrypoint, implementation, tests, styles, stories, fixtures, and related helpers. Flat root-level component files inside `src/design-system/` are avoided because they weaken locality once each module grows beyond a single file.

This keeps the public seam stable while letting each module deepen internally. Callers should import through the module folder path, such as `src/design-system/button`, rather than reaching into private files. Shared design foundations that are not UI modules themselves, such as tokens and global CSS, may remain at the design-system root.

Design decisions should be design-system-first. Before building route-local or subdomain-local UI, check whether an existing design-system module already fits. If it almost fits, prefer extending the design-system module when the result improves reuse without leaking subdomain-specific behavior into the public interface. Reach for a non-design-system solution only when the UI is specific enough that promotion would create a shallow reusable module or a misleading abstraction.

This decision complements ADR-0003. Product code is still organized by peer subdomain, while reusable UI lives in the design system as its own named module set. The design system is not a generic dumping ground for arbitrary shared code; it is the home for stable reusable UI modules with clear public seams.

Rejected alternatives: keeping design-system modules as flat files at the root makes growth painful and hides ownership as variants, tests, and styles accumulate. Defaulting to route-local UI before checking the design system causes duplicate interaction patterns and weakens visual consistency. Promoting every shared-looking widget into the design system also fails because it produces shallow modules with unstable interfaces.
