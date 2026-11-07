---
name: groundwork-update
description: Draft the weekly update for a Groundwork plan once work has started. Use when asked for a status update, "what changed since last week", or a weekly note for a plan in <workspace>/plans/<plan>/. Appends GitHub issue state to progress.yaml, diffs the plan and the system model against an earlier commit or tag, reads the plan's health, and drafts a short update for a human to post.
---

# Weekly update

First run `npm run --silent workspace -- list --json` in the Groundwork checkout. Resolve the plan's workspace id and
folder before reading its model or status; see [workspace discovery](../README.md#find-the-workspace-first).

GitHub and `progress.yaml` record what has happened, and git is the history; the plan never stores state. This skill reads both and drafts the
note. **A human posts it. Never post, comment or message on their behalf.**

Inputs: the workspace, the plan and the earlier point (a commit, or a tag such as `plan/<plan>/v2`).

## Loop

1. **Issue state.** For each work item with `github_issue`, read it with `gh issue view <n> --repo <org/name> --json
state,closedAt,url` and record it through the progress tool, which checks the event and appends it only when the
   state differs from the item's latest `github` event (so running it again appends nothing):

   ```bash
   npm run progress -- add <workspace> <plan> --subject wi:… --kind work --state done|in_progress \
     --source-kind github --repo <org/name> --issue <n> --url <issue url> --at <closedAt day, or today>
   ```

   A closed issue is `done`, an open one `in_progress`. Never edit earlier events. Say which issues could not be
   read. Items without `github_issue` are skipped; file them first ([groundwork-issues](../groundwork-issues/SKILL.md)).
   Partner items have no issue; their progress and commitments come from what the partner says, recorded with the
   same command (`--kind commitment --state accepted --promised-for … --said-by … --source-kind partner-update`).
   `npm run progress -- show <workspace> <plan>` prints where each item, milestone and team stands afterwards.

2. **What changed in the plan.** `git -C <workspace> diff <ref> -- plans/<plan>/plan.yaml`, read as meaning:
   milestones moved, questions opened or resolved, work items added, removed or moved between milestones, ops
   added or removed. Plan Atlas's semantic `diff.mjs` is not ported yet (TODO).
3. **What changed underneath.** `git -C <workspace> diff <ref> -- domains flows journeys` for the
   system model, and the repository pins in `evidence/` for rescans since. Any change to an id the plan's ops target is drift,
   and the plan's cover names it when `base.lock.json` no longer matches. A plan it builds on, or its programme,
   that changed since the lock is drift too; `git -C <workspace> diff <ref> -- plans/<base> programmes/<id>`. Flag these separately; someone must say so
   out loud.
4. **Health.** `npm run workspace -- check <workspace>`, and the plan's pages under `npm run dev`: open and overdue questions, untested
   changes, gaps. Read `questions[].blocks` and `decide_by` to name the blockers.
5. **Draft** at most 200 words in five parts:
   - **Done**: work items done since then (from `progress.yaml`), milestone progress.
   - **Promises**: commitments made, declined or withdrawn since then, promised dates later than `needed_by`, and
     the work blocked by a declined commitment (`npm run progress -- show`).
   - **Slipped**: milestones whose `due` has passed with open items, or that moved.
   - **Decisions needed this week**: each open question with its deciding team and `decide_by`; overdue first.
   - **Today changed**: drift from step 3, whether the plan still applies, and which changes today now matches
     (realisation, from `npm run progress -- show`). Done work and a matching model are separate facts; say both.
6. Hand the draft to the human with the diffs and the health behind it.

Approved versions in the revision ledger are natural starting points: `plans/<plan>/revisions/<v>.yaml` (see
[groundwork-revise](../groundwork-revise/SKILL.md)).

## Status and tags

`meta.status` moves `draft` → `review` → `approved` by the teams' decision, not the agent's. Approval is a git tag
`plan/<plan>/v<n>` on that commit, which next week's diff can name. Do not change `meta.status` yourself.
