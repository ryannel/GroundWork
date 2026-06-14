# Identity & Access

Who may do what is an architectural decision made with the boundaries, not a middleware bolted on later — and the hardest thing to retrofit once authorization is scattered and the trust model is implicit. Decide three things with the boundaries: how each actor authenticates, how services prove identity to each other, and how authorization is modelled. In 2026 a fourth actor joined: agents, which need an identity the system can reason about.

## Authn vs authz — keep them distinct

Authentication establishes *who*; authorization decides *what they may do*. Design both deliberately. Conflating them, or letting either accrete in middleware, is how access control becomes unauditable.

## Human identity is boring and standard

Do not invent auth. Humans authenticate through a proven provider over **OIDC / OAuth 2.1**; sessions and tokens follow current OWASP guidance. Custom JWT handling, bespoke session cookies, and home-grown MFA are how teams learn auth vulnerabilities the hard way.

## Workload identity is the service perimeter

Services prove who they are with cryptographic **workload identity** — SPIFFE/SPIRE issuing short-lived, auto-rotating SVIDs, mTLS through the mesh with no secret in app code. "It came from inside the network" authenticates nothing; machine identity is the perimeter ([security-and-trust.md](security-and-trust.md)).

## Authorization is modelled, not scattered

Choose the model deliberately and enforce it through one path:
- **RBAC** for coarse role-based access.
- **ReBAC** (relationship-based, Zanzibar-style) for "can *this* user see *this* document".
- **ABAC / policy** where rules are dynamic.

Externalise complex or shared policy to a policy engine so the rules are inspectable and consistent. Per-endpoint permission checks copy-pasted across handlers are authorization that will be wrong somewhere.

## Agent & non-human identity is first-class

An automated actor — service account, CI job, AI agent — has its own identity, never a borrowed human one. In an agent-led system this is load-bearing: the agent carries an identity into every request, consequential tool calls are authorised **per-action**, and **delegation is explicit** (on-behalf-of token exchange) so authorization can reason about which agent acted on whose behalf. An agent with a shared admin key is excessive agency by another name ([agentic-systems.md](agentic-systems.md)).

## Least privilege, short-lived credentials, tenant as identity

Every identity starts minimal and widens only on evidence; credentials are short-lived and auto-rotated (a static long-lived secret is a breach with a long fuse). In a multi-tenant system the **tenant is part of every identity and every authorization decision**, enforced at the data boundary — never trusted from a client-supplied parameter. Cross-tenant access is the highest-severity failure class.

## Antipatterns to catch

- **Implicit network trust** — "internal, so authenticated." No.
- **Long-lived static secrets** — a shared service key with no rotation.
- **Scattered authorization** — per-endpoint checks that drift apart.
- **Borrowed identity for machines** — a bot acting as a human admin, no trace of who acted.
- **Invented auth** — custom JWT/session/MFA instead of the standard.
- **Tenant-by-query-param** — trusting a client-supplied tenant id.
