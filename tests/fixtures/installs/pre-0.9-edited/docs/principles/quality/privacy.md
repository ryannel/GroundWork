---
title: Privacy
description: Data minimisation, GDPR, PII handling, and data residency for platforms that handle sensitive user data.
status: active
last_reviewed: 2026-05-26
---
# Privacy

## TL;DR

We only collect what we need, keep it only as long as we need it, expose it only where it is needed, and let users see, correct, and remove their own data on demand. Privacy is a design input, not a compliance appendage.

## Why this matters

A privacy failure is not a regulatory inconvenience — it is a direct breach of user trust. When a platform handles sensitive user data, remediation is punishingly expensive. Privacy has to be thought about at design time, because once the data exists in the wrong shape or the wrong place, it cannot easily be undone.

## Our principles

### 1. Collect the minimum

For every field we capture, we ask: do we actually need this to deliver the user's outcome? Data minimisation reduces both privacy risk and operational complexity. "We might find it useful later" is not a sufficient reason to collect a field.

### 2. Retain for a bounded time

Every category of data has an explicit retention policy set at collection time. Expired data is deleted by automation, not by a Tuesday-afternoon cron. "We keep it forever" is never the answer.

### 3. Access is scoped and audited

Every internal access to user data is authenticated, authorised, and logged. Engineers cannot browse production data casually; support staff cannot read sensitive records without a clear business reason and an auditable access record. Unsupervised access is a policy failure waiting to be discovered.

### 4. Users see, control, and remove their data

Data subject rights — access, rectification, portability, deletion — are first-class features, not regulatory bolt-ons. A user's deletion request flows through the same plumbing as retention expiry: structured, automated, and verifiable. A deletion that leaves "just this one copy" around is a promise broken.

### 5. Design for data residency

Where data lives matters — both for regulation (EU user data must stay on EU infrastructure for some purposes) and for user expectation. Residency is a design input to storage and pipeline choices, not an afterthought discovered during procurement.

### 6. PII is handled distinctly from content

Email addresses, names, IPs — PII has a shorter retention, tighter access controls, and is explicitly not co-located with content where we can help it. The treat-all-data-the-same approach makes the problems of the most sensitive fields become the problems of every field.

### 7. Model training respects user choice

User data is used to train or evaluate models only when the user has given informed consent, and the consent record is auditable. Assuming consent because "everyone does" is not a posture we hold.

### 8. Privacy reviews happen before launch

Every feature that touches user data has a privacy review before it ships — the same rhythm as a security review, often in the same meeting. The reviewer asks the specific questions a regulator or an investigative journalist would, and the answers go on the record. "We will do the privacy review after launch" is a commitment that never gets honoured.

## How we apply this

- [Data Engineering](../system-design/data-engineering.md) — retention and contract discipline.
- [Security](security.md) — the perimeter that privacy relies on.
- [Postgres](../stack/postgres.md) — retention enforced at the storage layer.

## Anti-patterns we reject

- **"Privacy is the lawyers' job."** By the time the lawyers are involved, the damage is done. Privacy is an engineering discipline.
- **Retention by default to forever.** Growing tables nobody cleans are ticking privacy incidents.
- **Development data scraped from production.** A dev environment with a sample of real user data is a breach waiting to be noticed.
- **Analytics as a free pass.** "It is for analytics" is not a sufficient justification for collecting a piece of PII. The same bar applies.
- **PII in logs.** Trace and log data routinely outlives the systems that produced it. PII does not belong there.
- **Consent-by-omission.** Checking a "we may use your data to improve the model" box buried in a ToS is not consent.

## Further reading

- *GDPR* text and ICO guidance — the canonical European framework.
- *CCPA/CPRA* — the Californian counterpart.
- *Privacy by Design*, Ann Cavoukian — the foundational essay on baking privacy into architecture.
- *Data Protection Impact Assessments* (ICO) — the practical model we use for privacy reviews.
