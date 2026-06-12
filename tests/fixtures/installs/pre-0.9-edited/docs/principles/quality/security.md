---
title: Security
description: Zero-trust, threat modeling, SLSA supply-chain integrity, and the secure SDLC.
status: active
last_reviewed: 2026-05-26
---
# Security

## TL;DR

Security is every engineer's job, every day. We treat every service as untrusted, every dependency as a supply-chain risk, every input as hostile, and every secret as already-compromised unless we can prove otherwise. The goal is not zero risk — it is a system that stays standing when any single control fails.

## Why this matters

When a platform handles sensitive user data, a security incident is not an inconvenience — it is a breach of the trust users place in the system. Security is the baseline that every other quality concern rests on. A system that is reliable but exploitable is not reliable.

## Our principles

### 1. Zero trust between services

Services authenticate each other on every request. No "internal" network is trusted implicitly; every call carries an identity, every identity is authorised per operation. The breach-resistance argument is simple — if an attacker pivots into one service, they do not inherit the blast radius of the entire system.

### 2. Threat model the change, not just the product

Every significant change asks the security question before the design is signed off: who could misuse this, and how? A new endpoint, a new data field, a new integration — each gets a five-minute threat conversation. This is cheap upfront and catches most of the issues that would otherwise be found in a pen test or, worse, in production.

### 3. Secrets are managed, rotated, and audited

No secret lives in source. Secrets live in a secret manager, are fetched at runtime, are rotated on a schedule, and every access is audited. A leaked secret's damage window is measured in hours, not years, because we assumed it would leak and planned for it.

### 4. Input is hostile; validate at the boundary

Every piece of input at a trust boundary is validated: request bodies, webhook payloads, message queue events, model outputs. Inside the trust boundary we trust our own types and do not repeat the checks ([Code Craft](../foundations/code-craft.md)). The discipline is that the boundary is explicit and every crossing is scrutinised.

### 5. Supply chain is part of our attack surface

Every third-party dependency is a potential exploit vector. We pin versions, review new dependencies before adoption, run SBOM generation and vulnerability scans on every build, and follow SLSA supply-chain integrity practices. A dependency added without review is a back door added without review.

### 6. Least privilege by default

Every service, every database role, every cloud identity starts with the minimum permissions it needs and is extended only on evidence. "Give it admin and fix it later" is a decision with a lifetime of never. IAM policies, database roles, and credential scopes are reviewed in the same way code is reviewed.

### 7. Auth is boring technology

We do not invent auth. Proven auth providers handle user authentication; service-to-service auth uses short-lived tokens from a standard identity provider; session storage follows the OWASP guidance for the context. Exotic auth is how a team learns about auth vulnerabilities the hard way.

### 8. Detect and respond, not just prevent

Assume prevention will sometimes fail. We log security-relevant events, alert on suspicious patterns, and run incident-response tabletops so the team knows what to do when something happens. Detection that arrives after the incident is cleaned up is not detection.

## How we apply this

- [Privacy](privacy.md) — the handling of regulated data sits inside the security perimeter.
- [Reliability](reliability.md) — stability and security share a lot of failure-mode vocabulary.
- [API Design](../system-design/api-design.md) — signed webhooks, idempotency keys, and structured errors that do not leak internals.

## Anti-patterns we reject

- **Internal network = trusted.** This is the assumption every modern breach exploits.
- **Secrets in environment variables checked into Git.** Use the secret manager. Always.
- **"It is an internal tool, we can skip auth."** Internal tools are an attacker's favourite foothold.
- **Dependencies pulled in on intuition.** A package with 12 stars, no maintainer, and a vague promise is a supply-chain risk.
- **Exotic auth.** Custom JWT handling, custom session cookies, custom MFA flows. Use the standard, battle-tested thing.
- **"The WAF will catch it."** A web application firewall is a last layer. Primary defence is correct code.

## Further reading

- *The Tangled Web*, Michal Zalewski — the canonical tour of web-security oddness.
- *The Web Application Hacker's Handbook*, Stuttard & Pinto — read once to know what you are defending against.
- *OWASP Top 10* — the catalogue of vulnerabilities every web engineer must know.
- *SLSA Framework* ([slsa.dev](https://slsa.dev)) — the supply-chain integrity ladder.
- *Zero Trust Architecture*, NIST SP 800-207 — the canonical definition.
