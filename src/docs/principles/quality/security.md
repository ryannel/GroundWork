---
title: Security
description: Zero-trust, threat modeling, SLSA supply-chain integrity, and the secure SDLC.
status: active
last_reviewed: 2026-06-19
---
# Security

## TL;DR

Security is every engineer's job, every day. We treat every service as untrusted, every dependency as a supply-chain risk, every input as hostile, and every secret as already-compromised unless we can prove otherwise. The goal is not zero risk — it is a system that stays standing when any single control fails.

## Why this matters

When a platform handles sensitive user data, a security incident is not an inconvenience — it is a breach of the trust users place in the system. Security is the baseline that every other quality concern rests on. A system that is reliable but exploitable is not reliable.

## Our principles

### 1. Zero trust between services

Services authenticate each other on every request. No "internal" network is trusted implicitly; every call carries an identity, every identity is authorised per operation. The concrete mechanism is **workload identity** — short-lived, auto-rotated credentials and mTLS established at the platform layer with no secret in application code; machine identity is the new perimeter. The breach-resistance argument is simple — if an attacker pivots into one service, they do not inherit the blast radius of the entire system. The mechanism scales to the system: SPIFFE/SPIRE issuing auto-rotated SVIDs is the full-control answer, but a managed mesh or signed service tokens from a standard IdP buy most of the breach-resistance for a fraction of the operating cost. The non-negotiable is that identity travels with every call and is verified there — not which issuer mints it. Choose by blast radius, not by fashion.

### 2. Threat model the change, not just the product

Every significant change asks the security question before the design is signed off: who could misuse this, and how? A new endpoint, a new data field, a new integration — each gets a five-minute threat conversation. This is cheap upfront and catches most of the issues that would otherwise be found in a pen test or, worse, in production.

### 3. Secrets are managed, rotated, and audited

No secret lives in source. The hierarchy is eliminate, then shorten, then rotate. The best secret is no secret: wherever principle 1's workload identity or OIDC federation reaches, there is no static credential to leak. Where a credential is unavoidable, prefer **dynamic, short-lived** secrets — minted per session with a TTL in minutes — over a long-lived value on a rotation calendar. Scheduled rotation of a static secret is closer to theatre than control: an attacker abuses a leaked credential in minutes, not at the next quarterly cycle, so a 90-day rotation bounds nothing that matters. Reserve scheduled rotation for the static credentials that genuinely cannot be made ephemeral. Whatever survives lives in a secret manager, is fetched at runtime, and has every access audited — so the damage window is bounded by the TTL, not by a calendar.

### 4. Input is hostile; validate at the boundary

Every piece of input at a trust boundary is validated: request bodies, webhook payloads, message queue events, model outputs. Inside the trust boundary we trust our own types and do not repeat the checks ([Code Craft](../foundations/code-craft.md)). The discipline is that the boundary is explicit and every crossing is scrutinised.

### 5. Supply chain is part of our attack surface

Every third-party dependency is a potential exploit vector. We pin versions, review new dependencies before adoption, and scan on every build. Beyond the SBOM (what is inside) we emit **provenance** (where it came from): artifacts are signed with Sigstore/cosign and ship signed build attestations expressed as SLSA build levels. The target is SLSA Build L3 (a hardened, isolated build platform that signs its own provenance) for anything we publish, and at least L1 provenance on everything built internally — L3 is what makes provenance non-forgeable, so it is the level worth paying for. A dependency added without review is a back door added without review.

### 6. Least privilege by default

Every service, every database role, every cloud identity starts with the minimum permissions it needs and is extended only on evidence. "Give it admin and fix it later" is a decision with a lifetime of never. IAM policies, database roles, and credential scopes are reviewed in the same way code is reviewed.

### 7. Auth is boring technology

We do not invent auth. Proven auth providers handle user authentication — OIDC for federation, passkeys/WebAuthn as the phishing-resistant default rather than passwords plus OTP; service-to-service auth uses short-lived tokens from a standard identity provider; session storage follows the OWASP guidance for the context. Exotic auth is how a team learns about auth vulnerabilities the hard way.

### 8. Detect and respond, not just prevent

Assume prevention will sometimes fail. We log security-relevant events, alert on suspicious patterns, and run incident-response tabletops so the team knows what to do when something happens. Detection that arrives after the incident is cleaned up is not detection.

### 9. The model is an attack surface

A model in the system widens the threat model in ways classic AppSec misses. **Prompt injection** has led the OWASP LLM risks since the list began and is structural, not a bug awaiting a patch: the model mixes instructions and data in one channel, and the injection arrives indirectly through retrieved content, tool outputs, and other agents (it propagates across co-running agents). Treat it as unsolved — there is no method that blocks it 100%, and a guardrail advertising 95% is handing the other 5% to a motivated attacker. So we contain rather than cure, and the containment is architectural. The design-time decision rule is the **lethal trifecta** (Willison) / **Agents Rule of Two** (Meta): an agent acting autonomously may hold at most two of {processes untrusted input, accesses private data or sensitive systems, can change state or communicate externally}. An agent that needs all three does not run unsupervised — it gets a human in the loop, or a fresh and reliably-validated context, before it acts. Underneath that rule: give non-human actors their own identity and per-action tool authorization, treat a tool/MCP catalogue as an execution surface to threat-model rather than an API, and remember that output validation alone is not a defence — excessive agency is the architectural control.

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
- *OWASP Top 10 for LLM Applications (2025)* — prompt injection and excessive agency lead the list.
- *The lethal trifecta* (Simon Willison) and *Agents Rule of Two* (Meta) — the design rules that bound agent authority.
