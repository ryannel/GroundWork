# Phase 5: Component Boundaries & Contracts

Define the precise boundary of each service: what it owns, what it explicitly does not own, and how it exposes its capabilities.

**How to run this conversation:**

Use the service map and confirmed data flows to draft a complete boundary proposal for all services at once. For each service, specify: what it owns, what it explicitly does not own, and the contract format for each interface (REST APIs → OpenAPI spec, async events → AsyncAPI schema, agent capabilities → MCP schema). Present this as a structured summary the user can scan and correct in a single pass — batch presentation lets the user spot ownership conflicts across services that sequential discussion obscures.

Where ownership is ambiguous — two services have a reasonable claim over a concept or a piece of data — call out the conflict explicitly, present the competing options with their consequences, and resolve with the user before finalising. Clear ownership precedes contract definition; a contract assigned to the wrong owner compounds the error into every downstream service that depends on it.

Every data boundary is a trust boundary. Identifying which boundaries exist is an architectural decision made here; how validation is implemented is enforced at the service level.
