# Working on Groundwork

Groundwork shows the systems a company runs (workspace › domain › system › component) and the plans that change
them. It is a rebuild of Plan Atlas (`/Users/RNEL/Workspace/plan-atlas`; tag `pre-rebuild` holds the old
Groundwork) in Next.js and TypeScript.

- Read `docs/architecture.md` before adding a file. The lint config enforces it; do not disable rules to get past
  it.
- While working, run `npm run lint:changed` and `npm test`. Before handing back, `npm run check` and
  `npm run build` must pass.
- One word per idea. The levels are workspace, domain, system and component, and nothing else. A
  service is one kind of component (alongside stores, topics and apps), not a level.
- Write for the reader in plain British English. Titles name things; the
  line under a title says what is true.
- Skills for agents live in `.agents/skills/` (`.claude/skills` and `.github/skills` link to it). To answer a
  question about the systems, use `groundwork-ask`: the map first (`npm run map`), then the cited code. To scan
  repos into the map, `groundwork-scan`; to write a plan, `groundwork-plan`.
