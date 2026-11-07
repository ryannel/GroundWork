# Groundwork agent skills

Skills for agents that map a company's systems and write the plans that change them. Each is a directory
with a `SKILL.md` (its frontmatter `name` and `description` decide when it loads) and supporting files. They are
nudges, not tutorials: the conventions, the loop, the tools, and where facts go.

The system model (workspace › domain › system › component, with contracts and handlers) is what is true today,
extracted from code by scans and corrected by people. Plans are overlays: ops on the model's ids, read onto today
while open and onto a frozen copy once landed, never a copy of today. A plan may build on other plans
(`builds_on`), so a system changes in increments; plans that serve one outcome join a programme
(`programmes/<id>/programme.yaml`). Every team, partners included, gets the same work items and milestones. What
each team has promised and what has happened are an append-only record beside the plan, `progress.yaml`, written
with `npm run progress -- add`; the site never writes it.

## Find the workspace first

Before workspace-backed work, run `npm run --silent workspace -- list --json` in the Groundwork checkout.
Use its name, id, folder and registration source to resolve the workspace the person means. The registry
includes `groundwork.local.yaml` links and honours `GROUNDWORK_WORKSPACES`; `workspaces/` contains only
bundled examples. A folder search cannot establish that a workspace or model is missing.

Read `<workspace>/MAP.md` and `<workspace>/plans/` at the resolved folder. Pass `--workspace <ws>` to
map and plan-base commands when several workspaces are registered; there is no arbitrary first-workspace
default. If the registry cannot resolve a link, report its error and repair the registration rather than
silently falling back to an example. Do not link, unlink, clone or scan an additional workspace without
the person's authorisation.

| Skill                   | Use it to                                                                                                                                                                                         | Tools it leans on                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `groundwork-workspace/` | Make a workspace as its own repo, or register one already on this machine: who it is for, teams, actors, a first cut of domains and systems, then a scan.                                         | `npm run workspace`, `gh`                                                           |
| `groundwork-scan/`      | Coordinate authorised repository scans, inferred interpretation and reusable tooling improvements.                                                                                                | `scan:pass`, `scan:entries`, `scan:entry`, freshness and validation tools           |
| `groundwork-landscape/` | Organise scan evidence into high-level exploration areas and reassess placements, boundaries and relationships as new behaviour is discovered.                                                    | Scan records, `npm run map`, cited code                                             |
| `groundwork-diagram/`   | Author and review value-flow diagrams, resource ownership, connection summaries and apparent orphans after scans.                                                                                 | Production model, diagram audit, cited code, screenshots                            |
| `groundwork-explore/`   | Trace one pinned source scope into evidence, execution/data relationships, gaps and inferred meaning.                                                                                             | Source indexes, framework bindings, bounded queries, cited code                     |
| `groundwork-ask/`       | Answer from the selected map/capture and cited evidence, preserving freshness and inferred labels.                                                                                                | `npm run map`, catalogues, bounded query pages, `git`                               |
| `groundwork-plan/`      | Write a plan as an overlay: footprint from the map, fill gaps with a scan, ops on system ids (including `h:` handlers), the reasoning; split a large discovery into a programme of stacked plans. | `npm run map`, `groundwork-scan`, `npm run workspace -- check`, `npm run plan:base` |
| `groundwork-schema/`    | Select and validate consolidated workspace, evidence and plan contracts.                                                                                                                          | Authoritative schemas, generators and validators                                    |
| `groundwork-review/`    | Review a plan before the session: overlay purity, drift from its lock and its bases, overlaps, partner commitments, attribution and freshness, the newcomer walk, findings as YAML fixes.         | `npm run workspace -- check`, `npm run map -- show`, `npm run map -- repos`         |
| `groundwork-revise/`    | Revise a plan through git: propose a version in the revision ledger, edit ops with stable ids, open the PR; later approve or reject. A human merges.                                              | `git`, `gh`                                                                         |
| `groundwork-issues/`    | File work items as GitHub issues in dependency order and write the numbers back; partner items are recorded separately.                                                                           | `gh`, `npm run progress`                                                            |
| `groundwork-update/`    | Weekly update: issue state into `progress.yaml`, what changed in the plan and underneath it, health, a note of 200 words at most for a human to post.                                             | `gh`, `git`, `npm run progress`                                                     |
| `groundwork-mockup/`    | Today's screens in the model, `screen:` on steps, the new look as ops, the walking mockup.                                                                                                        | the app (`npm run dev`)                                                             |
| `groundwork-graph/`     | Map a federated GraphQL graph into the model (graphs, subgraphs, operations, cache layers) and plan changes to it.                                                                                | `gh`, `rover` (optional)                                                            |

## Facts, attributed

Current facts use `cites:` with a pinned code reference or persisted `ev:` record. Repository evidence
records its source commit in `repository.json`. `npm run map -- show <id> --workspace <ws>` returns
the record, its citations and its gaps. Use the source pin to check the code.

## Not built yet

an issue export and a GitHub sync that appends to `progress.yaml` by itself (issues, update; `npm run progress`
appends one checked event at a time), owner evidence collected by the scan (scan), the revision ledger and semantic
diff tools (revise, update), and a mockup scaffold (mockup). Until then the skills say how to do each step by hand.

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
