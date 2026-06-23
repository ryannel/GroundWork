---
name: groundwork-review
description: >
  Reviews a draft GroundWork document in an isolated subagent context and
  returns a structured verdict — PRESENT or REVISE — with critical and advisory
  findings. Calling skills invoke it once per mutated canonical doc with the
  document path and type; only the verdict and findings flow back.
---

# GroundWork Review

## How This Skill Is Invoked

This skill runs in an **isolated subagent context** — never in the calling skill's main conversation. The calling skill provides a document path and document type; this subagent reads the document, performs the review, and returns the verdict and findings only. The deliberation, the upstream-doc reads, and any intermediate reasoning stay in the subagent context and do not flow back to the caller.

Running the review in-context, the way earlier versions of this skill operated, paid the cost of every review's intermediate reasoning forever — the verdict and findings are useful to the caller; the deliberation is not. Isolation is the contract.

### Invocation environments

| Environment | How the calling skill invokes the review |
|---|---|
| Claude Code | Via the `Task` tool with a general-purpose subagent. The prompt loads this file and supplies the document path and document type. |
| Other environments | Any mechanism that runs this skill's instructions in an isolated context with file-read tools and returns the final text. |

The contract is environment-agnostic — input and output are the same regardless of how the isolated execution is realised.

---

## Inputs

The calling skill passes two fields:

- `document_path` — the draft to review. The path may point to a cache draft (e.g. `.groundwork/cache/product-brief-draft.md`) or a committed canonical doc.
- `document_type` — one of: `product-brief`, `design-system`, `architecture`, `infrastructure`, `domain-entity`, `bet-pitch`, `technical-design`, `decomposition`, `maturity`. Used to locate upstream documents.

Read the document at `document_path` before beginning any check.

---

## Type-Specific Checklist

After reading the document, load `.groundwork/skills/groundwork-review/checklists/<document_type>.md` if it exists. The checklist names the failure modes specific to this document type; apply its items as the type-specific pass alongside Checks 1–4. When a checklist item is violated, cite it **by name** in the finding — e.g. `checklist: Label without a person — 'Role-Playing Groups' has no job-to-be-done` — not by restating the item's text.

If the checklist file is missing, proceed with the generic checks alone — its absence is not an error.

One checklist deliberately sits outside the `document_type` enum: `checklists/implementation-readiness.md` is the delivery workflow's inline gate, applied directly by the bet skill before the first slice — it never routes through this review and must not be added as a `document_type`.

Checklist findings flow through the same output contract below: the item's 🔴/🟡 marking sets the finding's severity, the verdict rules apply unchanged, and the length discipline holds — cite item names, not item text.

---

## Output Contract

Return exactly two blocks of structured output, in this order, and nothing else:

```
VERDICT: PRESENT | REVISE

FINDINGS:
- 🔴 <finding 1>
- 🔴 <finding 2>
- 🟡 <advisory finding>
```

If there are no findings, return `FINDINGS: none`. Do not write conversational text, do not summarise the document, do not explain your reasoning. The calling skill consumes only the verdict and findings — anything else is wasted output tokens.

The verdict rules:

- Any 🔴 Critical finding → `VERDICT: REVISE`. The caller revises and re-invokes.
- Only 🟡 Advisory findings (or none) → `VERDICT: PRESENT`. The caller surfaces the advisory findings to the user after presenting the draft.

---

## Check 1: Conversation Fidelity

The subagent context does not see the calling skill's conversation. This check therefore narrows: instead of comparing the document to the conversation that produced it, compare it to the document's own internal coherence and to the upstream docs (Check 3).

For checks that genuinely require the conversation, the calling skill is responsible for noting them when it invokes the review — pass any concern about fidelity as a hint inside the invocation prompt.

For this check, answer:

**Does the document contradict itself?**
Scan for internal contradictions — a capability named in one section that is excluded in another, a constraint stated as binding but ignored in the body, a deferred question that the body silently resolves. Each contradiction is a finding.

**Does the document contain claims the upstream docs do not support?**
This shades into Check 3 but applies even when the document has no upstream — any claim that reads as fact but is not derivable from the document's own evidence is a finding.

---

## Check 2: The Handoff Test

This document will be read by someone — agent or human — who was not in the conversation. They will use it to start their own work.

Read the document's own description of its purpose and who it serves. Then ask:

**Can each intended consumer start their work with only this document?**

For every person or role the document claims to serve, ask: what would they have to come back and ask before they could begin? Each unanswered question is a finding.

Published `docs/` artifacts are **clean reference documentation** — they carry no `## Summary for Downstream` section. The cross-phase contract (Key Decisions / Binding Constraints / Deferred Questions / Out of Scope) lives in the ephemeral Downstream Context file at `.groundwork/context/<phase>.md` (Protocol 5 of the operating contract), written at commit and torn down at setup completion (Protocol 10). That context file is **not** the document under review and is **not** part of this gate — the reviewer assesses the published doc body as reference documentation. Do not read `.groundwork/context/` and do not require, or check the contents of, any summary section in the published doc.

If a published setup doc still carries a leftover `## Summary for Downstream` section (an old-template artifact), that is itself worth a 🟡 finding — the section no longer belongs in published docs — but its **absence** is correct and must never be flagged.

Apply the Handoff Test to the body itself: every decision, constraint, deferral, and exclusion the consumers need must be present and coherent **in the body**. A binding decision the body fails to record, or an open question the body silently resolves, is a finding on the body — not on any summary header.

---

## Check 3: Upstream Contract

Every document after the first inherits commitments from the documents that came before it.

The chain is:

```
product-brief → design-system → architecture → infrastructure → bet-pitch → technical-design → decomposition
```

**`maturity` resolves its upstream specially.** The maturity doc (`docs/maturity.md`) assesses the project against the model defined at `.groundwork/skills/maturity-model.md` — read that file first; it defines the dimensions (D1–D9), assessment states, and the allowed severity/recommendation/status values. Its upstream is the full canonical doc set: an assessment or roadmap row that contradicts a committed doc (claiming D3 ✅ while `docs/infrastructure.md` records no `./dev` surface, or naming a service `docs/architecture.md` does not have) is a 🔴 finding.

**`domain-entity` resolves its upstream specially.** Domain entity docs (`docs/domain/<entity>.md`) are *generated from* architecture, so they sit below it rather than on the linear chain. Their upstream is **`docs/architecture.md` plus the accepted (non-superseded) ADRs under `docs/decisions/`** — skip any ADR whose `status` is `superseded`. The entity's `Owner:`, its fields, and any vendor or mechanism it names (auth provider, persistence model, data-isolation strategy) must agree with that current architecture and those ADRs. A domain doc that still names a superseded choice — e.g. `Owner: web (via Supabase Auth)` after an ADR moved auth to Clerk and persistence to another service — is a 🔴 finding: it describes a system no longer being built.

An invariant that asserts a guarantee an accepted ADR explicitly surrendered or weakened — claiming a pre-screen where the ADR records a monitor, immediate consistency where the ADR accepted eventual — is a 🔴 finding: it overstates what the system enforces. A domain event listed as published when the architecture provisions no message broker or event bus is a 🔴 finding for the same reason: it implies a mechanism that does not exist.

For the given `document_type`, read every upstream document that exists. The foundational documents live at canonical paths: `docs/product-brief.md`, `docs/design-system.md`, `docs/architecture.md`, `docs/infrastructure.md`. The bet documents live under the bet slug: `docs/bets/<slug>/pitch.md` and `docs/bets/<slug>/technical-design.md`. When reviewing a bet document, infer `<slug>` from the document path — the draft path contains the slug as a directory component.

**Read each upstream doc's body.** Published upstream docs are reference documentation with no summary section; the doc body is the contract. Check the document under review against the decisions and constraints the upstream body commits to.

If an upstream document doesn't exist, skip this check for that upstream and note its absence — do not fail on it.

If the product brief is the document being reviewed, skip this check entirely. It has no upstream.

For each upstream:

**Does the document honour every commitment from upstream?**

- Are all decisions, constraints, and users/capabilities the upstream body commits to accounted for — either addressed, explicitly deferred, or quietly compatible?
- Does anything in this document contradict the upstream body?
- Has any upstream commitment been silently dropped?

Each contradiction, omission, or silent departure is a finding.

---

## Check 4: Document-Type Specifics

Some document types carry a requirement the generic checks do not cover.

**`bet-pitch` — the `## Rabbit Holes & No-Gos` section must contain actual rabbit holes, not only no-gos.** These are two distinct things:

- **No-Gos** are scope exclusions — features deliberately cut ("users will expect authoring, but it is bet two").
- **Rabbit Holes** are technical traps or unknowns that could silently consume the appetite — the parts where the work could balloon (long-session coherence, classifier latency against a tight budget, prompt-size growth, idempotency under retries) — each ideally paired with a guard or a spike.

If the section lists only scope cuts and names no technical rabbit hole, yet the bet plainly carries technical risk, that is a 🔴 finding: the pitch has not surfaced where the appetite is actually at risk. A bet that is genuinely low-risk technically may state so explicitly instead.

**`maturity` — rows must be complete and evidenced.** Check every row against the model's allowed values:

- Each assessment row carries a state (✅/🟡/🔴, or `n/a` on the conditional dimensions D8–D9) **and** evidence — a state with no cited file, command output, or absence is a 🔴 finding.
- Each roadmap row carries a dimension (D1–D9), a severity (`blocks-delivery`/`standard-divergence`/`cosmetic`), a recommendation (`fix-now`/`defer`/`blocks-delivery`), and a status (`open`/`in-bet (<slug>)`/`closed (<slug>)`/`accepted`). A missing or out-of-vocabulary value is a 🔴 finding — downstream skills parse these strings.
- A row marked `closed` must name the closing bet slug; a row marked `accepted` must record who accepted it and why in its notes. Either absence is a 🔴 finding: an unattributed closure or acceptance cannot be audited later.
- A 🟡 partial assessment that does not name exactly which part of the dimension fails is a 🔴 finding — "partially done" with no specifics steers no one.

---

## Findings

A finding is a specific, quotable problem. Not a general observation. Not advice. A finding identifies exact text (or exact absence of text) and states what is wrong.

Bad finding: "The users section could be stronger."
Good finding: "'Role-Playing Groups' is listed as a user type but has no job-to-be-done or success definition — a designer couldn't design a journey for them."

Classify each finding:
- 🔴 **Critical** — Would cause someone downstream to start from wrong or incomplete foundations.
- 🟡 **Advisory** — Worth surfacing to the user, but a reasonable consumer could work past it.

Keep each finding to one or two short sentences. The calling skill is going to apply them in revisions — long findings are harder to act on, not more useful.

---

## Length Discipline

The entire return payload — verdict + findings — should fit in ≤500 tokens. The skill loads roughly 200 lines into the subagent's context; the subagent reads a draft and a handful of upstream sections; the output is short. If the output is running long, you are explaining instead of finding — cut the explanation.
