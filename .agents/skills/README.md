# Groundwork agent skills

Twelve skills for agents that map a company's systems and write the plans that change them. Each is a directory
with a `SKILL.md` (its frontmatter `name` and `description` decide when it loads) and supporting files. They are
nudges, not tutorials: the conventions, the loop, the tools, and where facts go.

The system model (workspace › domain › system › component, with contracts and handlers) is what is true today,
extracted from code by scans and corrected by people. Plans are overlays: ops on the model's ids, read onto today
while open and onto a frozen copy once landed, never a copy of today.

| Skill                   | Use it to                                                                                                                                                       | Tools it leans on                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `groundwork-workspace/` | Make a workspace as its own repo, or register one already on this machine: who it is for, teams, actors, a first cut of domains and systems, then a scan.       | `npm run workspace`, `gh`                                                                  |
| `groundwork-scan/`      | Scan a workspace's repos (all, or `--since` the last scan): one explorer per repo, merge into `contracts.yaml` and `handlers.yaml`, report, confirm with teams. | `gh`, `git`, `tools/scan-diff.ts`, `tools/scan-mark.ts`, `tools/sources.ts`, `npm run map` |
| `groundwork-explore/`   | The brief for one explorer on one repo: what it owns, exposes, stores, publishes and consumes, and each handler's step tree, every fact with its sources.       | `tools/permalink.ts`                                                                       |
| `groundwork-ask/`       | Answer questions about the systems from the map first, then the cited code, and say when a repo's map is stale.                                                 | `npm run map`, `MAP.md`, `git`                                                             |
| `groundwork-plan/`      | Write a plan as an overlay: footprint from the map, fill gaps with a scan, ops on system ids (including `h:` handlers), the reasoning, the room.                | `npm run map`, `groundwork-scan`, `npm run workspace -- check`                             |
| `groundwork-schema/`    | Ground rules, what is derived and what the validator checks (`SKILL.md`; fields live in `schema/`), op recipes (`cookbook.md`).                                 | `npm run workspace -- check`                                                               |
| `groundwork-review/`    | Review a plan before the session: overlay purity, drift from its lock, attribution and freshness, the newcomer walk, findings as YAML fixes.                    | `npm run workspace -- check`, `tools/sources.ts --check`, `npm run map -- repos`           |
| `groundwork-revise/`    | Revise a plan through git: propose a version in the revision ledger, edit ops with stable ids, open the PR; later approve or reject. A human merges.            | `git`, `gh`                                                                                |
| `groundwork-issues/`    | File work items as GitHub issues in dependency order and write the numbers back.                                                                                | `gh`                                                                                       |
| `groundwork-update/`    | Weekly update: issue state into `status.json`, what changed in the plan and underneath it, health, a note of 200 words at most for a human to post.             | `gh`, `git`                                                                                |
| `groundwork-mockup/`    | Today's screens in the model, `screen:` on steps, the new look as ops, the walking mockup.                                                                      | the app (`npm run dev`)                                                                    |
| `groundwork-graph/`     | Map a federated GraphQL graph into the model (graphs, subgraphs, operations, cache layers) and plan changes to it.                                              | `gh`, `rover` (optional)                                                                   |

## Facts, attributed

Every extracted fact carries `sources: [{ repo, path, lines, commit, symbol? }]`, the code that proves it at a
pinned commit; the app turns each into a permalink. Each scanned repo has `<workspace>/scans/<org>/<name>.yaml`
recording the commit the map is true at, so a reader can tell how stale it is. `node tools/sources.ts
<workspace> --check` reports what is unattributed and what no longer resolves.

## Not built yet

Named in the skills where they would be used: `tools/scan-merge.ts` (scan),
an issue export and status sync (issues, update), the revision ledger and semantic diff tools (revise, update),
and a mockup scaffold (mockup). Until then the skills say how to do each step by hand.

## Installing

Skills are plain directories; the agent finds them by location. `.agents/skills/` is the source of truth, and the
other agents' project paths are symlinks to it.

| Path                                   | Picked up by                                                   |
| -------------------------------------- | -------------------------------------------------------------- |
| `.agents/skills/` (real directory)     | Codex, GitHub Copilot and other Agent Skills–compatible agents |
| `.claude/skills` → `../.agents/skills` | Claude Code                                                    |
| `.github/skills` → `../.agents/skills` | GitHub Copilot (CLI, VS Code, cloud agent)                     |

Edit skills under `.agents/skills/` only. On Windows, clone with `git config core.symlinks true` so the links
check out as links.

Each workspace is its own repo (see [groundwork-workspace](groundwork-workspace/SKILL.md)), and
`npm run workspace -- add <folder>` links these skills into it, so an agent opened in the workspace repo finds
them too. In the skills, `<workspace>` is the workspace's folder (its repo, or `workspaces/<id>/` for the bundled
examples) and `<ws>` is its id, as in `/<ws>/` in the app or `--workspace <ws>`. Paths such as `tools/` and
`schema/`, and every `npm run` command, are Groundwork's: run them in the Groundwork checkout.
