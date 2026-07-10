# Old-install fixtures

Committed snapshots of project trees as older GroundWork versions left them. These are
**inputs, not goldens** — frozen at creation, never re-harvested. The upgrade-path
contract tests (`tests/cli/test_upgrade.py`) copy a fixture to a temp dir, run the
current CLI's `update` against it, and assert the convergence / preservation /
idempotency invariants. Each future release that ships a migration adds the fixture
state it migrates *from* if no existing fixture covers it.

| Fixture | Provenance |
|---|---|
| `pre-0.9/` | `git worktree add <tmp> 1498e0a` (S6, before the 0.9.0 semver/stamp commit), then `node <wt>/bin/groundwork.js init` in this directory. Unstamped: that CLI had no `stampVersion`, no agent wiring, no AGENTS.md. |
| `0.9-pre-surfaces/` | Same procedure at `f81cc6b` (0.9.0, the last commit before the multi-surface restructure), plus generator output seeded by hand: `.dev/dev-bundle.js` built from that commit's `cli-src` (`node build.mjs` with the repo's node_modules), `dev` from that commit's `dev.template`, and a minimal `.dev/dev.config.json` — the dev bundle is not tracked in git, so it cannot be `git show`n. |
| `*-edited/` | Synthetic variants: the base fixture plus (a) user edits to tier-2 files — a team addendum in `docs/principles/index.md`, an HTML comment in `AGENTS.md` (0.9 variant) — and (b) synthetic pre-restructure project state targeted by the backfill briefs: `docs/ux-design.md` (pre-0.9 variant; `gw-design-system-rename`), `docs/architecture.md` without drift frontmatter or a surface registry (`gw-drift-frontmatter-stamp`, `gw-surfaces-registry-bootstrap`), and `docs/bets/checkout-flow/pitch.md` without `status` frontmatter (`gw-bet-shape-uplift`). |
| `0.16-docsite-pre-live-meta/` | Synthetic, minimal (exercised by the per-migration round trip in `tests/cli/test_migration_gate.py`, not the whole-update suite — it is not a full install): the 0.16-era shape `gw-live-first-bets-meta` migrates from — a docs-site service registered in `.dev/dev.config.json` (its `scripts/sync-live-bets.js` a stub; the migration only probes existence) and a `docs/bets/meta.json` whose `pages` predates `_live`. |

The `.claude` and `CLAUDE.md` entries are symlinks (committed as such); copy fixtures
with `shutil.copytree(..., symlinks=True)`.
