---
name: maturity-checklist
description: >
  Type-specific failure modes for reviewing a maturity doc — the evidenced
  assessment and roadmap against the nine-dimension maturity model.
---

# Maturity Checklist

This checklist checks a draft `docs/maturity.md`. It answers one question: **is every assessment
evidenced, every roadmap row parseable, and every claim consistent with the committed doc set?**

Read the model at `.agents/groundwork/skills/maturity-model.md` first — it defines the
dimensions (D1–D9), the assessment states (including the `n/a` state reserved for the
conditional dimensions D8 and D9), and the allowed severity, recommendation, and status
values. Match each item against the document text and the canonical doc summaries.

## Summary Contract

- [ ] 🔴 **Summary absent or displaced**: the `## Summary for Downstream` section is missing,
  empty, or not the first section after the frontmatter — maturity is a setup document and
  carries the summary like the rest.
- [ ] 🔴 **Accepted gap missing from summary**: a roadmap row with status `accepted` is not
  reflected under `### Key Decisions` or `### Out of Scope` — downstream skills must see
  accepted gaps without parsing the table.

## Assessment Rows

- [ ] 🔴 **State without evidence**: an assessment row carries a state (✅/🟡/🔴) but cites no file,
  command output, or absence that justifies it — an assessment row without evidence is an
  opinion.
- [ ] 🔴 **Partial without specifics**: a 🟡 partial assessment does not name exactly which part
  of the dimension fails — "partially done" with no specifics steers no one.
- [ ] 🔴 **Dimension missing**: one of the nine dimensions (D1–D9) has no assessment row —
  a conditional dimension whose precondition does not hold still gets a row, with state `n/a`
  and the precondition as evidence.
- [ ] 🟡 **Assessment stamp missing**: the assessment carries no date or no record of which phase
  or skill ran it.
- [ ] 🟡 **Evidence that proves nothing**: the cited evidence does not bear on the dimension's
  signal — a doc path offered as proof of D3 (one-command operations), say, instead of the
  `./dev` surface.

## Roadmap Vocabulary

Downstream skills parse these strings exactly; a near-miss is a silent orphan.

- [ ] 🔴 **Out-of-vocabulary severity**: a severity other than `blocks-delivery`,
  `standard-divergence`, or `cosmetic`.
- [ ] 🔴 **Out-of-vocabulary recommendation**: a recommendation other than `fix-now`, `defer`, or
  `blocks-delivery`.
- [ ] 🔴 **Out-of-vocabulary status**: a status other than `open`, `in-bet (<slug>)`,
  `closed (<slug>)`, or `accepted`.
- [ ] 🔴 **Row without a dimension**: a roadmap row names no dimension (D1–D9) — the gap cannot
  be tied to what it blocks.
- [ ] 🟡 **Gap without a cost**: a roadmap row does not state what leaving the gap open costs —
  the model exists to let the user weigh maturity work against product work with full
  information.

## Attribution

- [ ] 🔴 **Unattributed closure**: a row marked `closed` does not name the closing bet slug — an
  unattributed closure cannot be audited later.
- [ ] 🔴 **Unattributed acceptance**: a row marked `accepted` does not record who accepted it and
  why in its notes.
- [ ] 🟡 **History silent**: the `## History` log carries no line for the assessment or status
  change this draft records — the append-only audit trail has a hole.

## Consistency with the Doc Set

- [ ] 🔴 **Assessment contradicts a committed doc**: a state or roadmap row contradicts the
  canonical doc set — claiming D3 ✅ while `docs/infrastructure.md` records no `./dev` surface,
  or naming a service `docs/architecture.md` does not have.
- [ ] 🟡 **Status contradicts the roadmap's own evidence**: a row's notes describe the gap as
  resolved while its status reads `open`, or vice versa — the row disagrees with itself.
