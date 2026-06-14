---
title: Identity & Access
description: Authentication and authorization as architecture — human identity on OIDC/OAuth 2.1, workload identity via SPIFFE, first-class agent identity, and authorization modeled rather than scattered.
status: active
last_reviewed: 2026-06-14
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

We do not invent auth. Humans authenticate through a proven identity provider over **OIDC / OAuth 2.1**; sessions and tokens follow current OWASP guidance. Custom JWT handling, bespoke session cookies, and home-grown MFA are how teams learn about auth vulnerabilities the hard way.

### 3. Workload identity is the service perimeter

Services prove who they are with cryptographic **workload identity** — SPIFFE/SPIRE issuing short-lived, auto-rotating SVIDs, mTLS established through the service mesh with no secret in application code. Machine identity is the new perimeter; "it came from inside the network" authenticates nothing.

### 4. Authorization is modelled, not scattered

We choose an authorization model deliberately — role-based for coarse access, **relationship-based (ReBAC)** for "can this user see this specific document", attribute/policy-based where rules are dynamic — and enforce it through one path, not a thicket of per-endpoint checks. Where policy is complex or shared, externalise it to a policy engine so the rules are inspectable and consistent. Authorization logic copy-pasted across handlers is authorization that will be wrong somewhere.

### 5. Agent and non-human identity is first-class

An automated actor — a service account, a CI job, an AI agent — has its own identity, not a borrowed human one. In an agent-led system this is load-bearing: an agent carries an identity into every request, consequential tool calls are authorised per-action, and **delegation is explicit** (on-behalf-of token exchange) so authorization can reason about *which* agent acted, on *whose* behalf. An agent with a shared admin key is excessive agency by another name.

### 6. Least privilege, short-lived credentials

Every identity — human, workload, or agent — starts with the minimum it needs and is widened only on evidence. Credentials are short-lived and auto-rotated by default; a static, long-lived secret is a breach with a long fuse. Roles and scopes are reviewed the way code is reviewed.

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
- *SPIFFE/SPIRE* (CNCF) — workload identity and short-lived SVIDs.
- *Zero Trust Architecture*, NIST SP 800-207 — identity as the perimeter.
- *Zanzibar*, Google — the model behind relationship-based authorization.
