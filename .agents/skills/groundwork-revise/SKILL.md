---
name: groundwork-revise
description: Revise a Groundwork plan through git with its revision ledger. Use when asked to revise, propose a change, make a revision, "v2", approve the revision, reject it, or "what changed since the approved plan" for a plan in <workspace>/plans/<plan>/. Proposes a version, edits the ops, validates and diffs, opens the PR; later approves or rejects. A human merges; never approve for someone.
---

# Revise a plan

The plan is one file; a revision is the same file at a new commit, never a copy. `meta.revisions` is the ledger
(oldest first, statuses `proposed | approved | rejected`). The newest approved entry is the **canonical plan**; its
exact snapshot is `<workspace>/plans/<plan>/revisions/<version>.yaml`. `meta.status` (draft | review |
approved) is the plan's lifecycle and is separate; the ledger is the revision lifecycle. A plan with no ledger
behaves as before. The app shows the ledger at `/<ws>/plans/<plan>/revisions/` and each version on its own page.

**A human merges. You never approve on someone's behalf.** Approve only when the teams have agreed and a human asks.

Plan Atlas had `tools/revision.mjs` and `tools/diff.mjs` for this. Groundwork has neither yet (TODO); the steps
below say what to do by hand until they exist.

## Propose (PR 1)

1. Start from a clean branch off `origin/main`. Say what the revision is for.
2. **Pick the version.** Major when `problem`, goals, non-goals, metrics, scenarios, milestones or teams changed;
   otherwise minor. Agree it with the human.
3. **Append a proposed entry** to `meta.revisions` and bump `meta.version` and `meta.date`:

   ```yaml
   - version: '1.1'
     status: proposed
     date: '2026-10-08'
     summary: Pause skips the invoice run instead of voiding it.
     why: Voided invoices confuse finance and refund twice. Skipping keeps one record per period.
     by: [team:billing]
     pr: 412 # add once the PR is open
     work: # when the revision touches work already filed
       - {
           item: wi:billing-skip,
           action: rework,
           note: The rule moves from the job to the handler.,
         }
   ```

   `why` is what reviewers decide on: two or three plain sentences on what goes wrong without it and why this way.
   Check the keys against `meta.revisions` in `schema/plan.schema.json`.

4. **Edit the plan**: ops in `changes[]`, work items, questions. **Never renumber or rename ids**: ids are how
   before and after are matched. Today stays in the model; deltas are ops. If the plan's cover says today has
   changed under it, re-read those targets and run `npm run plan:base -- check <plan>` in the same revision.
5. **Check it**: `npm run workspace -- check <workspace>`, then open the plan in `npm run dev` and read the new version's page. Compare with the
   approved snapshot by eye or with `git diff --no-index <workspace>/plans/<plan>/revisions/<v>.yaml
<workspace>/plans/<plan>/plan.yaml`. No new warnings.
6. **Open the PR** with a plain summary of the diff as its body: what the revision brings, the checks, where the
   journey changes, the work and teams affected. Read the checks yourself first: a new field nobody sets, an
   untested step or a new dependency between teams is usually a gap in the ops, not something to explain away.

## Approve (PR 2)

The plan's owner approves by merging; whoever merges answers for it. Before merging, read the revision's page and
tell the teams it affects (done work reopened, open work changing, a new dependency). Then, by hand:

- set the head entry to `status: approved`, with `approved_on` and `approved_by: '@<handle>'` (one GitHub handle,
  never a list of teams); `approval_pr` only when the approval comes in a different PR from the proposal;
- copy `plan.yaml` to `revisions/<version>.yaml` exactly as approved. That snapshot is never edited afterwards.

With no ledger yet, the first approved entry at the current `meta.version` starts one.

## Reject

Set the head entry to `status: rejected` with `rejected_on`, `rejected_by: '@<handle>'` (who closed the PR) and
`reason` (ask the room; the version's page leads with it). Save the proposal as `revisions/<version>.yaml`, then
restore `plan.yaml` from the newest approved snapshot, keeping the ledger with the rejected entry. Do it in a PR.
The next proposal takes a higher version than the rejected one.

## Editorial fixes

Typos and wording: propose and approve in the same PR; the PR review is the approval. Use a minor version.

## Checklist

- Ids unchanged; new things get new ids.
- `meta.version` equals the last non-rejected entry (the validator errors otherwise); only the last entry may be
  proposed; `team:` ids in `by` exist; `approved_by` and `rejected_by` are one `@handle`.
- `revisions/<v>.yaml` is written once, at approval or rejection, and never edited.
- Work items already filed as issues ([groundwork-issues](../groundwork-issues/SKILL.md)): edit those issues by
  hand (`gh issue edit`) and list them in the PR body; nothing syncs them yet.
- A CODEOWNERS line per plan folder, in the workspace repo, names the owner who merges: `plans/<plan>/** @org/billing`.
