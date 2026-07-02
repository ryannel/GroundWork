# Phase 4: Data Flow & Communication

Define how data moves through the system — what each service receives, what it produces, how services communicate with each other, and what storage each service requires.

This phase turns the service map from Phase 3 into a living system. Understanding data flow before committing to specific technologies prevents premature optimisation and ensures technology choices serve the actual communication patterns rather than hypothetical ones.

API contracts and database schemas are not designed here. They belong to the Bet phase, where each feature is designed in detail. The architecture phase produces the skeleton those details will be built on.

**Apply from the architect references:** `integration-and-workflows.md` (the sync-vs-async decision, outbox, retries, timeouts as budgets), `realtime-and-async.md` (any streaming/live path), `data-architecture.md` (data ownership, event/table contracts, retention), and `ai-native-architecture.md` (the model-provider decision and what it obligates). Load the reference for the pattern in play and embed its trade-off in the proposal.

**How to run this conversation:**

Use the service map from Phase 3 and the constraints from Phase 2 to draft a complete data flow proposal covering every service at once. For each service, specify: inputs and their sources, outputs and their consumers, communication pattern (sync vs async) with the reasoning behind the choice, and storage needs including data shape and access patterns. Present this as a single structured proposal the user can scan, correct, and refine — proposing all flows together exposes cross-service dependencies and inconsistencies that per-service interrogation hides.

For every sync/async decision, embed the tradeoff in the proposal — sync creates coupling but simplifies reasoning; async adds resilience but introduces eventual consistency. The user reacts to concrete tradeoffs faster than they answer abstract questions about them.

Once data flows are confirmed, propose the specific technology for each capability area: the database, the queue, the streaming platform, the cache, the auth provider, the file store. Attach rationale and downstream obligations to each choice — the implementation requirements that flow from each decision into service-level design.

For any system that calls an LLM, the **model provider and model** are a first-class technology decision here, not an implementation detail to settle later — name them explicitly (provider plus the specific model), with rationale and the downstream obligations they impose (a streaming path, prompt caching of any large shared context, a moderation/safety gate, cost and latency budgets). This is an ADR-worthy decision: the scaffold phase maps the named provider onto a generator flag and the bet that follows builds the provider-specific integration against it, so an unnamed or assumed provider becomes a silent mismatch the moment code is generated. State it.

As implementation details emerge — async flows, ownership decisions, callback patterns, schema implications — capture them immediately in `## Design Details` in `.groundwork/cache/discovery-notes.md`. These details feed the API contract and database schema design phases downstream.

Think across the full range of capabilities a system typically requires — data persistence, real-time delivery, search, background processing, file storage, authentication, messaging, and external integrations — and address each one that applies.
