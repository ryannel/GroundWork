---
name: groundwork-issues
description: File a Groundwork plan's work items as GitHub issues with the gh CLI, in dependency order, labelled by team and milestone, and write each issue number back into the plan as `github_issue`. Use when asked to create, file, export or preview GitHub issues from a plan in <workspace>/plans/<plan>/, or to keep status.json in step with the issues.
---

# Plan work items to GitHub issues

The app already writes each issue: the build chapter (`/<ws>/plans/<plan>/build/`) lists the work items in build
order, each with its issue body (from `issueMarkdown` in `src/application/plan/issues.ts`, laid out by the issue
templates in `src/application/plan/issue-templates.ts`) and a copy button. That page is the preview.

Plan Atlas had `tools/export-issues.mjs` to create them in one go; Groundwork has no such tool yet (TODO). Until it
does, file them with `gh` as below. Creating issues is visible to others and is not undone: **ask the human first**,
naming the repos and the count.

## Before you start

1. The plan validates (`npm run workspace -- check <workspace>`; the plan's pages show no errors under `npm run dev`).
2. Every work item has `repo: org/name`, one of `meta.repos`.
3. `gh auth status` succeeds for an account that can create issues and labels in those repos.
4. Items that already have `github_issue` are done; skip them, but use their numbers to link dependants.

## File them

Go in build order (dependencies first; the build chapter's order). For each work item:

```bash
gh label create "team:<team-slug>" --repo <org/name> --force        # once per repo and label
gh label create "ms:<milestone-slug>" --repo <org/name> --force
gh label create "plan:<meta.id>" --repo <org/name> --force
gh issue create --repo <org/name> --title "<template prefix><work item title>" \
  --label "team:<team-slug>,ms:<milestone-slug>,plan:<meta.id>" --body-file -   # paste the body from the build chapter
```

- **Template**: the work item's `issue_type` (`task` by default, or `story`, `feature`, `bug`) picks the form.
  Use the target repo's `.github/ISSUE_TEMPLATE/<type>.yml` when it has one (title prefix and labels from it),
  otherwise the built-in one the app uses.
- **Dependencies**: in the body's "Depends on" lines, replace each work item with its issue: `#12` in the same
  repo, `org/name#12` across repos. Build order means it already exists.
- **Write back** straight after each issue is created, so a failure halfway leaves the plan in step with GitHub:
  add `github_issue: <number>` as the last key of that work item, keeping the file's style and comments. Never
  copy `github_issue` between plans or author it for an issue that does not exist.

## Re-running and changes

- To re-create an issue, delete its `github_issue` line first.
- Nothing updates or closes existing issues. When a work item's body changes after filing (often in a
  [revision](../groundwork-revise/SKILL.md)), update the issue by hand: `gh issue edit <n> --repo <org/name>
--body-file -` with the new body from the build chapter.

## Status

Done ticks and milestone progress come from `<workspace>/plans/<plan>/status.json`, never the plan:

```json
{
  "wi:checkout-vat": {
    "state": "closed",
    "closed_at": "2026-09-30T14:12:00Z",
    "url": "https://github.com/acme/checkout/issues/41"
  }
}
```

Until there is a sync tool (TODO), refresh it with `gh issue view <n> --repo <org/name> --json state,closedAt,url`
for every work item with `github_issue`, and write the file in the shape above.

## After filing

Check the plan still validates, tell the human the created URLs and that the plan changed, and leave `meta.status`
to the room.
