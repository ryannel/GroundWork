---
title: Privacy
description: Data minimisation, GDPR, PII handling, deletion, model training, and data residency for platforms that handle sensitive user data.
status: active
last_reviewed: 2026-06-19
---
# Privacy

## TL;DR

We only collect what we need, keep it only as long as we need it, expose it only where it is needed, and let users see, correct, and remove their own data on demand. Privacy is a design input, not a compliance appendage.

## Why this matters

A privacy failure is not a regulatory inconvenience — it is a direct breach of user trust. When a product handles sensitive user data — whether it's a platform, a CLI, or a desktop app — remediation is punishingly expensive. Privacy has to be thought about at design time, because once the data exists in the wrong shape or the wrong place, it cannot easily be undone. Some of it — anything that has been backed up, copied to a warehouse, or trained into a model — cannot be undone at all without a deliberate plan made before collection.

## Our principles

### 1. Collect the minimum

For every field we capture, we ask: do we actually need this to deliver the user's outcome? Data minimisation reduces both privacy risk and operational complexity. "We might find it useful later" is not a sufficient reason to collect a field.

The honest tension is with measurement and ML, where more raw, per-user, fine-grained data always *looks* more useful. The decision rule: collect at the grain the outcome requires, and no finer. For product analytics, prefer aggregates, derived metrics, and event counts over raw identifiable records; where the analysis genuinely needs distributions, coarsen or add differential-privacy noise rather than retaining the raw PII. "It is for analytics" lowers the bar for *nobody* — the same necessity test applies.

### 2. Retain for a bounded time

Every category of data has an explicit retention policy set at collection time, justified by a purpose and a lawful basis. Expired data is deleted by automation, not by a Tuesday-afternoon cron. "We keep it forever" is never a category.

Some data legitimately needs a longer clock — security and audit logs, fraud signals, financial records with statutory retention, and records under legal hold. That is not a licence to keep everything: a legal hold suspends deletion for *named* records tied to a specific matter; it does not turn the whole database immutable. The decision rule: each category gets its own period and its own justification, and the longest clock applies only to the records that actually earn it.

### 3. Access is scoped and audited

Every internal access to user data is authenticated, authorised, and logged. Engineers cannot browse production data casually; support staff cannot read sensitive records without a clear business reason and an auditable access record. Unsupervised access is a policy failure waiting to be discovered.

### 4. Users see, control, and remove their data — including the copies

Data subject rights — access, rectification, portability, deletion — are first-class features, not regulatory bolt-ons. A deletion request flows through the same plumbing as retention expiry: structured, automated, and verifiable.

"Delete everywhere" is harder than it sounds, and this is where most real systems fail. User data is spread across the primary store, read replicas, caches, search indices, analytics warehouses, and backup snapshots, and an immutable or append-only backup tier cannot be surgically edited row by row. The EDPB's 2025 coordinated enforcement action on the right to erasure found exactly this: controllers that never propagate deletion into backups, and controllers that let a restore silently resurrect deleted data. The decision rule:

- **Live and queryable tiers** (primary, replicas, caches, indices, warehouse) erase synchronously and verifiably on request.
- **Immutable backup tiers** either get **crypto-shredding** — encrypt each subject's data under a per-subject key and destroy the key, rendering the ciphertext unrecoverable without touching the snapshot — or rely on a **documented, bounded rotation window** during which any restore is guaranteed to re-apply pending deletions before the data becomes reachable again.

A deletion that quietly leaves "just this one copy" — most often in a backup or a warehouse export — is a promise broken. So is calling something deleted when it has merely been weakly de-identified.

### 5. Design for data residency

Where data lives matters, both for regulation and for user expectation, and it is a design input to storage and pipeline choices — not an afterthought discovered during procurement.

It is also widely misunderstood. The GDPR is **not** a data-localisation law: it does not require EU personal data to physically stay on EU soil. It bars *transfers* to a third country unless a lawful mechanism backs them — an adequacy decision (the EU–US Data Privacy Framework is one, declared adequate in 2023 and extended to the EEA), Standard Contractual Clauses, or Binding Corporate Rules. The decision rule: separate a genuine **localisation mandate** (a sectoral or sovereignty law that says the bytes must remain in-country — these are real but specific) from the far more common **transfer-safeguard requirement** (data may leave if a mechanism plus access controls are in place). Pick the storage region from the strictest obligation that actually applies to the data, not from folklore about "EU data can never leave the EU."

### 6. PII is handled distinctly from content

Email addresses, names, IPs — PII has a shorter retention, tighter access controls, and is explicitly not co-located with content where we can help it. Treating all data the same makes the problems of the most sensitive fields become the problems of every field.

The mechanism is separation: hold identifiers in a dedicated vault and reference them elsewhere by an opaque token (pseudonymisation). This shrinks the blast radius of any single store and makes crypto-shredding tractable — destroy the vault entry and the tokens dangle. But pseudonymisation is a risk-reduction tool, not an exit: under the GDPR, pseudonymised data is *still personal data* and stays fully in scope. Only true anonymisation leaves scope, and anonymisation is harder than it looks — coarse de-identification often remains re-identifiable by linkage. Do not let a tokenisation layer convince anyone the obligations have disappeared.

### 7. Model training is a lawful, transparent, and near-irreversible decision

User data is used to train or evaluate models only on a lawful, recorded, and defensible basis. Consent is the cleanest basis, but it is often infeasible to obtain at the scale and retroactivity model training demands — a point the EDPB's Opinion 28/2024 on AI models makes directly. Where consent is not workable, **legitimate interest** can be a valid basis *if* it survives the three-step necessity-and-balancing test, the use is disclosed plainly, and users have a real, honoured opt-out. What is never defensible is silent training, or assuming consent because "everyone does."

Treat the choice to train as **near-permanent**. A model can memorise and regurgitate its training data, and the EDPB has confirmed a trained model is not automatically anonymous. Machine unlearning does not reliably take it back: exact unlearning means retraining from scratch, and approximate methods are unproven and can degrade the model. The decision rule: pick and record the lawful basis *before* training, and never feed a model anything you could not defend keeping forever — because, in practice, training is keeping it forever.

### 8. Privacy reviews happen before launch

Every feature that touches user data has a privacy review before it ships — the same rhythm as a security review, often in the same meeting. The reviewer asks the specific questions a regulator or an investigative journalist would, and the answers go on the record. Where the processing is high-risk — large-scale sensitive data, profiling, or novel use of personal data — that review *is* a Data Protection Impact Assessment, which the GDPR makes mandatory rather than optional. "We will do the privacy review after launch" is a commitment that never gets honoured.

## How we apply this

- [Data Engineering](../system-design/data-engineering.md) — retention and contract discipline.
- [Security](security.md) — the perimeter that privacy relies on.
- [Postgres](../stack/postgres.md) — retention enforced at the storage layer.

## Anti-patterns we reject

- **"Privacy is the lawyers' job."** By the time the lawyers are involved, the damage is done. Privacy is an engineering discipline.
- **Retention by default to forever.** Growing tables nobody cleans are ticking privacy incidents.
- **Deletion that stops at the live database.** If the backup or the warehouse still has the row, the deletion did not happen. Plan the backup story before you promise erasure.
- **Anonymisation theatre.** Calling weakly de-identified data "anonymous" or "deleted" when relinking is feasible — flagged repeatedly in EDPB enforcement — is a breach dressed as compliance.
- **Development data scraped from production.** A dev environment with a sample of real user data is a breach waiting to be noticed.
- **Analytics as a free pass.** "It is for analytics" is not a sufficient justification for collecting a piece of PII. The same bar applies.
- **PII in logs.** Trace and log data routinely outlives the systems that produced it. PII does not belong there.
- **Silent model training.** Training on user data without a recorded lawful basis, plain disclosure, and a real opt-out is not made acceptable by a sentence buried in a ToS.

## Further reading

- *GDPR* text and ICO guidance — the canonical European framework.
- *CCPA/CPRA* — the Californian counterpart.
- *Privacy by Design*, Ann Cavoukian — the foundational essay on baking privacy into architecture.
- *Data Protection Impact Assessments* (ICO) — the practical model we use for privacy reviews.
- EDPB *Opinion 28/2024* on data protection in AI models — lawful basis, legitimate interest, and model anonymity.
- EDPB *2025 Coordinated Enforcement Framework report on the right to erasure* — backups, restores, and anonymisation-as-deletion.
