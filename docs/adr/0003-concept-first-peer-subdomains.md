# Concept-First Peer Subdomains

The app organizes product code by domain concepts and peer subdomains instead of technical layers such as `domain`, `application`, `infrastructure`, `components`, or `routes`. Domain-driven design supplies the names and ownership boundaries, while _A Philosophy of Software Design_ supplies the module quality bar: each subdomain should expose a small public interface and hide its internal structure.

`Learning Loop` remains domain language for the study cycle, but it is not the architecture container for every study-related module. Notes, Recall, Focus, and Labels are peer subdomains because each owns meaningful UI, behavior, persistence, and terminology. Code shared across subdomains should not move into a generic `shared` folder; it should either stay with the owning subdomain and be consumed through that public interface, or be promoted to a named module when it represents a stable concept.

Rejected alternatives: a single broad `learning-loop` container makes the structure imply that all study behavior has one owner, while layer-first folders make technical concerns more visible than the domain language. Both alternatives weaken information hiding as the app grows.
