---
name: groundwork-update
description: Draft the weekly update for a Groundwork plan once work has started. Use when asked for a status update, "what changed since last week", or a weekly note for a plan in workspaces/<ws>/plans/<plan>/. Reads GitHub issue state into status.json, diffs the plan and the system model against an earlier commit or tag, reads the plan's health, and drafts a short update for a human to post.
---

# Weekly update

GitHub is the tracker and git is the history; the plan never stores state. This skill reads both and drafts the
note. **A human posts it. Never post, comment or message on their behalf.**

Inputs: the workspace, the plan and the earlier point (a commit, or a tag such as `plan/<plan>/v2`).

## Loop

1. **Issue state.** For each work item with `github_issue`, `gh issue view <n> --repo <org/name> --json
state,closedAt,url`, and write `workspaces/<ws>/plans/<plan>/status.json` in its existing shape
   (`{ "wi:…": { "state", "closed_at", "url" } }`). Say which issues could not be read. Items without
   `github_issue` are skipped; file them first ([groundwork-issues](../groundwork-issues/SKILL.md)). A sync tool
   is TODO.
2. **What changed in the plan.** `git diff <ref> -- workspaces/<ws>/plans/<plan>/plan.yaml`, read as meaning:
   milestones moved, questions opened or resolved, work items added, removed or moved between milestones, ops
   added or removed. Plan Atlas's semantic `diff.mjs` is not ported yet (TODO).
3. **What changed underneath.** `git diff <ref> -- workspaces/<ws>/domains workspaces/<ws>/flows` for the system
   model, and `workspaces/<ws>/scans/` for re-scans since. Any change to an id the plan's ops target is drift:
   the plan was written against a different today (its `baseline`). Flag these separately; someone must say so
   out loud.
4. **Health.** `npm test`, and the plan's pages under `npm run dev`: open and overdue questions, untested
   changes, gaps. Read `questions[].blocks` and `decide_by` to name the blockers.
5. **Draft** at most 200 words in four parts:
   - **Done**: work items closed since then (from `status.json`), milestone progress.
   - **Slipped**: milestones whose `due` has passed with open items, or that moved.
   - **Decisions needed this week**: each open question with its deciding team and `decide_by`; overdue first.
   - **Today changed**: drift from step 3, and whether the plan still applies.
6. Hand the draft to the human with the diffs and the health behind it.

Approved versions in the revision ledger are natural starting points: `plans/<plan>/revisions/<v>.yaml` (see
[groundwork-revise](../groundwork-revise/SKILL.md)).

## Status and tags

`meta.status` moves `draft` → `review` → `approved` by the room's decision, not the agent's. Approval is a git tag
`plan/<plan>/v<n>` on that commit, which next week's diff can name. Do not change `meta.status` yourself.
