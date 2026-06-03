# GroundWork Review

## How This Skill Is Invoked

This skill runs in an **isolated subagent context** — never in the calling skill's main conversation. The calling skill provides a document path and document type; this subagent reads the document, performs the review, and returns the verdict and findings only. The deliberation, the upstream-doc reads, and any intermediate reasoning stay in the subagent context and do not flow back to the caller.

Running the review in-context, the way earlier versions of this skill operated, paid the cost of every review's intermediate reasoning forever — the verdict and findings are useful to the caller; the deliberation is not. Isolation is the contract.

### Invocation environments

| Environment | How the calling skill invokes the review |
|---|---|
| Claude Code | Via the `Task` tool with a general-purpose subagent. The prompt loads this file and supplies the document path and document type. |
| GroundWork eval harness | Via the `invoke_review` tool exposed by the harness. The harness makes a fresh `client.messages.create` call seeded with this skill's instructions as system prompt. |
| Other environments | Any mechanism that runs this skill's instructions in an isolated context with file-read tools and returns the final text. |

The contract is environment-agnostic — input and output are the same regardless of how the isolated execution is realised.

---

## Inputs

The calling skill passes two fields:

- `document_path` — the draft to review. The path may point to a cache draft (e.g. `.groundwork/cache/product-brief-draft.md`) or a committed canonical doc.
- `document_type` — one of: `product-brief`, `design-system`, `architecture`, `infrastructure`, `bet-pitch`, `technical-design`. Used to locate upstream documents.

Read the document at `document_path` before beginning any check.

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

For **setup documents** (a `document_type` of `product-brief`, `design-system`, `architecture`, or `infrastructure`), the `## Summary for Downstream` section is mandatory and must be the first section after the frontmatter. If it is **missing or empty**, that alone is a 🔴 finding — downstream phases read it first and cannot start without it. Bet documents (`bet-pitch`, `technical-design`, `decomposition`) are exempt: they carry no summary, per the Lifecycle Modes section of the operating contract. Do not raise this finding for them.

Pay particular attention to the `## Summary for Downstream` section (Protocol 5 of the operating contract). The summary is the first thing every downstream phase reads. Check that:

- `### Key Decisions` covers every binding decision the body commits to.
- `### Binding Constraints` covers every constraint that downstream phases must respect.
- `### Deferred Questions` names the resolving phase for each open decision.
- `### Out of Scope` lists permanent exclusions, not deferrals.

A summary header that omits a binding decision from the body is a 🔴 finding.

---

## Check 3: Upstream Contract

Every document after the first inherits commitments from the documents that came before it.

The chain is:

```
product-brief → design-system → architecture → infrastructure → bet-pitch → technical-design
```

For the given `document_type`, read every upstream document that exists. The foundational documents live at canonical paths: `docs/product-brief.md`, `docs/design-system.md`, `docs/architecture.md`, `docs/infrastructure.md`. The bet documents live under the bet slug: `docs/bets/<slug>/pitch.md` and `docs/bets/<slug>/technical-design.md`. When reviewing a bet document, infer `<slug>` from the document path — the draft path contains the slug as a directory component.

**Read upstream summary headers first.** For each upstream doc, the `## Summary for Downstream` section is the canonical contract; check the document under review against that section. Read the upstream body only when a specific claim in the document under review needs verification the summary cannot provide.

If an upstream document doesn't exist, skip this check for that upstream and note its absence — do not fail on it.

If the product brief is the document being reviewed, skip this check entirely. It has no upstream.

For each upstream:

**Does the document honour every commitment from upstream?**

- Are all Key Decisions, Binding Constraints, and users/capabilities accounted for — either addressed, explicitly deferred, or quietly compatible?
- Does anything in this document contradict the upstream summary or body?
- Has any upstream commitment been silently dropped?

Each contradiction, omission, or silent departure is a finding.

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
