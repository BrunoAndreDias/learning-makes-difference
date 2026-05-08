# Concept-First Peer Subdomains

The app organizes product code by domain concepts and peer subdomains instead of technical layers such as `domain`, `application`, `infrastructure`, `components`, `hooks`, `utils`, `types`, `services`, or `routes`. Domain-driven design supplies the names and ownership boundaries, while _A Philosophy of Software Design_ supplies the module quality bar: each subdomain should expose a small public interface and hide its internal structure.

This is a vertical codebase decision. Code is grouped by what it does for the product, not by the technical shape of the file. A subdomain should colocate the UI, routes, server logic, persistence access, types, tests, and private helpers that change with that product concept.

`Learning Loop` remains domain language for the study cycle, but it is not the architecture container for every study-related module. Study Notes, Recall, Focus, and Labels are peer subdomains because each owns meaningful UI, behavior, persistence, and terminology. Source Notes live behind the Study Notes workflow rather than as a separate primary workspace destination. Code shared across subdomains should not move into a generic `shared` folder or a generic technical layer merely because multiple subdomains use it. It should either stay with the owning subdomain and be consumed through that public interface, or be promoted to a named module when it represents a stable product or platform concept.

Cross-subdomain imports should use public interfaces rather than deep-importing internal files. When the codebase needs stronger enforcement, use lint rules, package boundaries, or workspace exports to make those dependencies explicit.

This follows the argument in Dominik Dorfmeister's "The Vertical Codebase": horizontal layer folders increase cognitive load as a product grows because code that changes together gets scattered, while unrelated files are grouped only by technical shape. Vertical organization improves cohesion, makes ownership easier to see, and gives both humans and coding agents clearer boundaries.

Rejected alternatives: a single broad `learning-loop` container makes the structure imply that all study behavior has one owner, while layer-first folders make technical concerns more visible than the domain language. Broad `shared` or `utils` areas hide ownership and make private implementation details easy to reuse accidentally. These alternatives weaken information hiding as the app grows.
