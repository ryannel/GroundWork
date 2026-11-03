# Working on Groundwork

Groundwork shows the systems a company runs (workspace › domain › system › component) and the plans that change
them. It is a rebuild of Plan Atlas (`/Users/RNEL/Workspace/plan-atlas`; tag `pre-rebuild` holds the old
Groundwork) in Next.js and TypeScript.

- Read `docs/architecture.md` before adding a file. The lint config enforces it; do not disable rules to get past
  it.
- Before workspace-backed work, run `npm run workspace -- list` (or `npm run --silent workspace -- list --json`) in this checkout. Resolve
  the requested workspace's name, id and folder from that registry; `workspaces/` contains examples, not all
  available workspaces. Never claim a workspace or its model is missing from a folder search alone.
  Pass the resolved `--workspace <id>` to map and plan commands when several workspaces are registered.
- At the start of a task, run `npm run check:begin` to record a local checkpoint without committing existing work.
  While working, run `npm run check:quick` (or pass explicit files/folders after `--`). Do not reset the checkpoint
  to hide a failure. Keep one task per checkout; separate concurrent tasks into worktrees.
- Before handing back a local feature change, the focused checks must pass. Run `npm run check` for shared
  application/domain/infrastructure changes, check-tooling or lint/configuration changes, and before merging.
  Run `npm run build` for route, server/client boundary, dependency or build configuration changes, and before
  merging. After rendering or data-loading changes, also run `npm run budget` against the production build.
- Keep related behaviour together. Line, parameter, import and folder counts are not reasons to split code.
  Extract for a separate responsibility, reuse, or a useful test boundary; keep complexity and dependency rules.
- One word per idea. The levels are workspace, domain, system and component, and nothing else. A
  service is one kind of component (alongside stores, topics and apps), not a level.
- Write for the reader in plain British English. Titles name things; the
  line under a title says what is true.
- Skills for agents live in `.agents/skills/` (`.claude/skills` and `.github/skills` link to it). To answer a
  question about the systems, use `groundwork-ask`: the map first (`npm run map`), then the cited code. To scan
  repos into the map, `groundwork-scan`; to write a plan, `groundwork-plan`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
