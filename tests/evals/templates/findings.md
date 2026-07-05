<!--
  Template for the graded-findings scaffold, seeded into the review bundle by
  `./dev sim assess`. Placeholders: {{runId}}, {{path}}, {{suite}}, {{model}},
  {{until}}, {{assessedAt}}. The driver (agent or human) grades the run by
  filling the table; the filled file is the durable output the fix work cites.
-->
# Graded findings — run {{runId}}

- **path/suite:** {{path}} / {{suite}}
- **model:** {{model}}
- **bound:** {{until}}
- **assessed:** {{assessedAt}}
- **evidence:** `conversation.md`, `checklist.md`, `verdict.md` in this bundle

> **The Sandbox Problem rule** (contributor skill): the sandbox product is a
> signal about the generic case, not a specification for it. Every fix below
> must improve the skill *for every possible product* — if a finding's fix
> mentions this sandbox's domain, generalize it before filing.

## Findings

<!-- One row per defect. Severity: blocker / major / minor. Cite the evidence
     (a transcript turn, a checklist row, a verdict line) — an uncited finding
     is an opinion. Delete this comment when grading. -->

| # | Severity | What the evidence shows | Owning skill / file | Generalized fix |
|---|---|---|---|---|
| 1 | | | | |

## Disposition

<!-- After grading: for each finding, one line — fixed in <commit> / filed as
     follow-up / accepted (why). A finding with no disposition is unfinished
     business, not a graded run. -->

- Finding 1:

## Verdict summary

<!-- One paragraph: is the methodology healthier or weaker than the last run of
     this scenario, and what single change would most improve it? -->
