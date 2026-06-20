---
title: Identity & Access
description: Authentication and authorization as architecture — human identity on OIDC/OAuth 2.1, workload identity via SPIFFE, first-class agent identity, and authorization modeled rather than scattered.
status: active
last_reviewed: 2026-06-19
---
# Identity & Access

## TL;DR

Who may do what is an architectural decision made with the boundaries, not a middleware bolted on afterward. Humans authenticate through a proven OIDC/OAuth 2.1 provider; services authenticate each other with **workload identity** (SPIFFE/SPIRE short-lived SVIDs, mTLS through the mesh, no secret in code); and in an agent-led system, agents are **first-class non-human identities** with their own credentials and explicit delegation. Authorization is modelled once and enforced everywhere, not re-implemented per endpoint.

## Why this matters

Identity is where most breaches actually land — a stolen long-lived secret, an over-broad role, a service that trusted the network. And it is the hardest thing to retrofit: once authorization logic is scattered across handlers and the trust model is implicit, tightening it touches everything. Deciding identity and access at the architecture stage — the trust boundaries, the credential lifetimes, the authorization model — is far cheaper than discovering them during an incident. In 2026 the surface widened again: machines and agents now outnumber humans as actors, and each needs an identity the system can reason about.

## Our principles

### 1. Authn and authz are architecture

The trust model — who is authenticated, how, and what each identity may do — is decided with the service boundaries, because it shapes every contract and data path. Authentication establishes *who*; authorization decides *what they may do*; we keep the two distinct and design both deliberately rather than letting them accrete in middleware.

### 2. Human identity is boring and standard

We do not invent auth. Humans authenticate through a proven identity provider over **OIDC / OAuth 2.1**; sessions and tokens follow current OWASP guidance. OAuth 2.1 is still a consolidating draft, but its substance is not in doubt — it folds the settled security best practice (RFC 9700) into the base spec: mandatory PKCE on every authorization-code flow, no implicit grant, no resource-owner password grant. Track those practices, not the RFC's publication date. Custom JWT handling, bespoke session cookies, and home-grown MFA are how teams learn about auth vulnerabilities the hard way.

### 3. Workload identity is the service perimeter

Services prove who they are with cryptographic **workload identity** — short-lived, auto-rotating credentials bound to the workload, mTLS between services, no secret in application code. Machine identity is the new perimeter; "it came from inside the network" authenticates nothing.

How you *issue* that identity is a sizing decision, not dogma, and SPIFFE/SPIRE is not the default answer for everyone. If you already run a service mesh you already have SPIFFE-compatible identity — Istio issues X.509 SVIDs and mTLS by default — so the marginal cost is near zero. On a single cloud, the provider's own workload identity (IAM roles, workload identity federation, OIDC-federated tokens) gives you keyless, short-lived credentials with no new infrastructure to operate. Reach for SPIFFE/SPIRE directly when you span clouds or run off-mesh workloads that need *one* portable identity plane — and budget for it honestly: SPIRE is mature but non-trivial to run well. The anti-pattern is the static service API key in an env var, not "didn't deploy SPIRE."

### 4. Authorization is modelled, not scattered

Choose the model for the question you are actually answering. **Role-based (RBAC)** for coarse, stable job functions. **Relationship-based (ReBAC, the Zanzibar model)** when access follows the graph — "this user can see this document because it lives in a folder shared with a group they belong to" — which is exactly where RBAC dies of role explosion. **Attribute/policy-based (ABAC)** when the decision turns on context the subject doesn't carry: time, location, resource state. Most real systems combine them, and the practical path is one direction: start with roles, and reach for ReBAC the moment you catch yourself encoding sharing or hierarchy *as* roles.

Enforce through one path, not a thicket of per-endpoint checks, and externalise shared or complex policy so the rules are inspectable. But externalising the *decision* is not the same as adding a network hop per request — a central policy service that every call must round-trip is both a latency tax and a new single point of failure. Distribute the engine (embedded library, sidecar, or local cache with a short TTL) so policy is authored centrally and evaluated locally, and reserve the synchronous call to a central decision point for genuinely sensitive, low-volume actions. Authorization copy-pasted across handlers is authorization that will be wrong somewhere; authorization behind one slow network dependency is an outage waiting to happen.

### 5. Agent and non-human identity is first-class

An automated actor — a service account, a CI job, an AI agent — has its own identity, not a borrowed human one. In an agent-led system this is load-bearing: an agent carries its own identity into every request, consequential tool calls are authorised per-action, and **delegation is explicit**. The mechanism is token exchange (RFC 8693): the issued token carries an `act` claim naming the actor, so the audit trail records *which* agent acted on *whose* behalf — and nested exchanges record the full chain when one agent calls another. MCP's authorization model builds on exactly this, layered on OAuth 2.1 + PKCE.

Two gaps the standards are still closing, which you must design around rather than assume away. First, PKCE protects the exchange but does **not** authenticate the client — a non-human client's identity has to be asserted by the infrastructure it runs on, which is precisely what workload identity (principle 3) provides; agent identity and workload identity are the same problem at two altitudes. Second, classic OAuth has no front-channel way to capture a user's *explicit consent* for an agent to act for them; in-flight IETF on-behalf-of-user drafts add a `requested_actor`/`actor_token` flow for this, but until they land, treat consent for consequential agent delegation as something you design explicitly, not something the protocol hands you. An agent with a shared admin key is excessive agency by another name.

### 6. Least privilege, short-lived credentials

Every identity — human, workload, or agent — starts with the minimum it needs and is widened only on evidence. Credentials are short-lived and auto-rotated by default; a static, long-lived secret is a breach with a long fuse. Short-lived is necessary but not sufficient: a bearer token is replayable by anyone who captures it for as long as it lives, so bind tokens to their holder — sender-constrained via DPoP or mTLS, as the OAuth Security BCP (RFC 9700) and OAuth 2.1 now recommend — so a stolen token is useless off the key it was issued to. Roles and scopes are reviewed the way code is reviewed.

### 7. Tenant isolation is an identity boundary

In a multi-tenant system, the tenant is part of every identity and every authorization decision, enforced at the data boundary, not assumed from a query parameter. Cross-tenant access is the highest-severity failure class; the identity model is where it is prevented.

## How we apply this

The architect decides the trust model, the identity mechanisms, and the authorization model with the boundaries; the engineer skills implement them, and the security perimeter ([Security](../quality/security.md)) is where they are stress-tested. Workload identity and the policy engine are shared infrastructure, not per-service code.

- [Security & Trust](../quality/security.md) — the perimeter identity sits inside.
- [Agentic Systems](../ai-native/agentic-systems.md) — agent identity, delegation, per-action authorization.

## Anti-patterns we reject

- **Implicit network trust.** "It's an internal call, it's authenticated." It is not.
- **Long-lived static secrets.** A shared service key in an env var is a breach waiting for its trigger.
- **Scattered authorization.** Per-endpoint permission checks that drift out of agreement.
- **Borrowed identity for machines.** A bot or agent acting as a human admin, with no trace of who really acted.
- **Invented auth.** Custom JWT / session / MFA instead of the battle-tested standard.
- **Tenant-by-query-param.** Trusting a client-supplied tenant id instead of binding it to the authenticated identity.

## Further reading

- *OAuth 2.1* and *OpenID Connect* — the standard human-auth stack.
- *OAuth 2.0 Security Best Current Practice*, RFC 9700 — sender-constrained tokens, PKCE, the rules OAuth 2.1 folds in.
- *OAuth 2.0 Token Exchange*, RFC 8693 — delegation and the `act` claim behind on-behalf-of.
- *SPIFFE/SPIRE* (CNCF) — workload identity and short-lived SVIDs.
- *Zero Trust Architecture*, NIST SP 800-207 — identity as the perimeter.
- *Zanzibar*, Google — the model behind relationship-based authorization (OpenFGA, SpiceDB).
