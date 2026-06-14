# Security & Trust

Security is every engineer's job, every day. Treat every service as untrusted, every dependency as a supply-chain risk, every input as hostile, and every secret as already-compromised unless proven otherwise. The goal is not zero risk — it is a system that stays standing when any single control fails. A system that is reliable but exploitable is not reliable.

The trust model is an architectural decision, decided with the boundaries — not an implementation detail discovered later.

## The design decisions

1. **Zero trust between services, on workload identity.** Services authenticate each other on every request; no "internal" network is implicitly trusted. The concrete 2026 mechanism is **workload identity** — SPIFFE/SPIRE issuing short-lived, auto-rotated SVIDs, mTLS established via the service mesh with no secret in app code. Machine identity is the new perimeter. If an attacker pivots into one service, they do not inherit the blast radius of the whole system.
2. **Threat model the change, not just the product.** Every significant change asks before sign-off: who could misuse this, and how? A new endpoint, field, or integration gets a five-minute threat conversation — cheap up front, and it catches most of what a pen test or production would otherwise find.
3. **Secrets are managed, rotated, audited.** No secret lives in source. Secrets live in a manager, are fetched at runtime, rotated on a schedule, and every access is audited — so a leak's damage window is hours, not years.
4. **Input is hostile; validate at the boundary.** Every input at a trust boundary is validated: request bodies, webhook payloads, queue events, model outputs. Inside the boundary, trust your own types. The discipline is that the boundary is explicit and every crossing is scrutinised.
5. **Supply chain is part of the attack surface.** Pin versions, review new dependencies before adoption, scan on every build. Move past SBOM-alone to **provenance**: sign artifacts (Sigstore/cosign) and emit signed build attestations as **SLSA build levels** — "an SBOM says what's inside; provenance proves where it came from." A dependency added without review is a back door added without review (npm carried 450k+ malicious packages in 2025).
6. **Least privilege by default.** Every service, database role, and cloud identity starts with the minimum it needs and is extended only on evidence. "Give it admin and fix later" has a lifetime of never.
7. **Auth is boring technology.** Do not invent auth. Proven providers handle user authentication; service-to-service uses short-lived tokens from a standard IdP; sessions follow OWASP guidance. Exotic auth is how a team learns about auth vulnerabilities the hard way.
8. **Detect and respond, not just prevent.** Assume prevention sometimes fails. Log security-relevant events, alert on suspicious patterns, rehearse incident response.

## AI & agent security

A model in the system widens the attack surface in ways classic AppSec misses:

- **Prompt injection is structural, and it leads OWASP's LLM risks** (LLM01). The model mixes instructions and data in one channel, and the injection arrives *indirectly* — through retrieved documents, tool outputs, and other agents (it propagates across co-running agents). Output validation alone is insufficient; scrutinise the inputs and constrain what a model-driven action can reach.
- **Excessive agency** is the architectural control: an agent gets least privilege and a bounded toolset, and consequential tool calls are authorised per-action, not granted wholesale ([agentic-systems.md](agentic-systems.md)).
- **Agent identity.** A non-human actor needs its own identity and delegation, carried into the request (SPIFFE-for-agents) so authorization can reason about *which* agent acted on whose behalf ([identity-and-access.md](identity-and-access.md)).
- **MCP/tool security.** A tool surface is an execution surface — tool poisoning and exec-capable tools are real; threat-model the tool catalogue, not just the API.

## Multi-tenancy is decided here

The tenancy isolation strategy — **shared database**, **schema-per-tenant**, or **database-per-tenant** — is an architectural decision made with the boundaries, because it shapes data models, query patterns, and compliance boundaries across every service. Decide it before the schema hardens; retrofitting isolation is brutal.

## Privacy is a design input

Regulated data shapes the architecture before procurement, not after:
- **Collect the minimum**, retain for a bounded time, scope and audit every access.
- **Data residency** (EU data on EU infrastructure for some purposes) is an input to storage and pipeline topology.
- **PII is handled distinctly from content** — shorter retention, tighter access, not co-located where avoidable, and never in logs.
- **Data-subject rights** (access, rectification, portability, deletion) are first-class features flowing through the same plumbing as retention expiry.
- Compliance frameworks that may apply — GDPR, HIPAA, PCI-DSS, SOC 2 — drive audit logging, access control, and encryption requirements beyond data location alone. Surface them while establishing constraints.

## Antipatterns to catch

- **"Internal network = trusted"** — the assumption every modern breach exploits.
- **Secrets in env vars committed to Git** — use the manager, always.
- **"It's internal, skip auth"** — internal tools are an attacker's favourite foothold.
- **Dependencies pulled on intuition** — a 12-star package with no maintainer is a supply-chain risk.
- **Exotic auth** — custom JWT/session/MFA handling. Use the battle-tested thing.
- **PII in logs** — trace and log data outlive the systems that produced them.
