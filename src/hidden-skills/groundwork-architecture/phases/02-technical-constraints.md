# Phase 2: Technical Constraints

Constraints define the boundaries of the design space. Establishing them first means technology and topology decisions are made within a realistic envelope — not revisited when a hard constraint rules out a design already agreed on.

**Apply from the architect references:** `security-and-trust.md` (trust model, multi-tenancy strategy, the privacy and compliance inputs), `reliability.md` (SLOs, RTO/RPO and what they demand of the topology), and `performance-and-scale.md` (reading the demand shape, scale-to-zero, managed-vs-self-managed). Load the reference when its constraint area is in play and apply its reasoning rather than re-deriving it.

**How to run this conversation:**

Open by summarising what you already know from the existing documents. Then work through the constraint areas — one at a time if needed, but if a single exchange gives you confident answers across multiple areas, capture them all. Never advance on a constraint that is unclear or assumed; resolve it before moving on.

These areas commonly surface constraints, but the conversation may reveal others. Cover them in whatever order flows naturally:

- **Content and regulatory** — what the product handles and where it operates determines which platforms, providers, and data handling approaches are available. Sensitive content categories, regulated data types (PII, health, financial), data residency obligations, and jurisdiction-specific hosting requirements can each eliminate entire infrastructure approaches. Explore compliance frameworks that may apply — GDPR, HIPAA, PCI-DSS, SOC 2 — as these drive audit logging, access control, and encryption requirements beyond just data location.

- **Security and trust model** — how the system authenticates users and services, how it authorises access to resources, and how it isolates data between users or tenants are architectural decisions, not implementation details. Multi-tenancy strategy (shared database, schema-per-tenant, database-per-tenant) must be decided here because it affects data models, query patterns, and compliance boundaries across every service.

- **Scale and infrastructure model** — understand the shape of the system's demand and what the team is willing to manage. For indie and hobby projects, a key question is whether costs can reach near-zero during inactivity — scale-to-zero is a legitimate architectural requirement that shapes every infrastructure choice that follows. For systems expecting continuous load, understand whether demand is spiky and unpredictable or stable and forecastable — these require fundamentally different approaches. Fully managed services trade operational burden for higher spend and vendor dependency; self-managed infrastructure trades convenience and reliability for control and cost.

- **Availability and reliability** — understand the system's availability expectations and what happens when parts of it fail. The acceptable recovery time if the system goes down (RTO) and how much data loss is tolerable in a failure scenario (RPO) drive decisions about redundancy, replication, failover, and backup strategy. A system that must be 99.99% available is architecturally different from one where an hour of downtime is acceptable.

- **Geographic distribution** — where users are and whether the system needs to serve them from multiple regions. Latency-sensitive products with a global user base may require edge delivery, regional deployments, or CDN strategies that fundamentally change the topology — this is about where the system physically runs, not just how fast it responds.

- **Existing technology and vendor constraints** — what is already in place, what is off the table, and what commitments already exist. An existing cloud provider relationship, a legacy system that must be integrated, a technology ban, or a team's existing expertise all constrain the design space in ways that the documents may not have captured.

- **Performance** — latency and throughput targets are typically captured in the Design System NFRs. Reference those directly. Only explore further here if they are absent or if the architecture introduces system paths the design phase did not account for.

When you have a clear picture of the constraints, summarise them and confirm with the user before moving to Phase 3.
