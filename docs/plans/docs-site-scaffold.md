# Implementation Plan: Docs Site Scaffold — Serve `docs/` (Bets Included) as an Optional Native Runner

**Status:** PROPOSED 2026-06-17. **Updated 2026-06-18** to land on the now-EXECUTED scaffold foundation: `dev-cli-native-runners.md` is complete — the native-runner registry, the `registerRunner()` generator helper, the capability-port/footprint framework, and the `infrastructure.md` footprint matrix all shipped. Triggered by a request to "support a doc site as part of the scaffold so the bets are easily viewable," using Fumadocs (with Mintlify floated as a possible second option). **The generator already exists** (`src/generators/docs-site/`, registered in `generators.json`, mapped in `groundwork-scaffold` phase 01, covered by a generation test). It is *not* a greenfield build — it is an unfinished one, and it is now the **only surface-shaped generator still injecting into `docker-compose.yml`** while `electron-app`/`flutter-app`/`cli-app` already self-register as native runners. This plan closes the gap between "a Fumadocs project is generated" and "a docs site that actually serves `docs/` well, surfaces bets, runs cleanly, and is offered as a real optional scaffold step." Picks up `G3 docs site` left open in `contract-grade-delivery.md`; the native-runner foundation it depends on is no longer pending.
**Audience:** An engineer or agent implementing this change. Each slice names its files and an acceptance check; judgment calls are listed as open decisions in §6.
**Scope owner:** The `docs-site` generator (`src/generators/docs-site/`), the `groundwork-scaffold` skill (phase 01 mapping + an optional offer), the `workspace-dev-cli` runner registry (`cli-src/`), `docs/infrastructure.md` shape, the scaffold tests, and a changelog/migration entry.

---

## 0. Read this first — the mental model

The request reads as greenfield ("let's use Fumadocs"), but the generator is already here and mostly built:

- `src/generators/docs-site/files/source.config.ts` does `defineDocs({ dir: '../../docs' })` — it compiles the **pristine root `docs/` directory** at build time. So the intent ("serve the docs folder") is already wired.
- `generator.ts` injects the service into `docker-compose.yml` (build context `./services/docs-site`, port 4000→3000) and runs `pnpm install`.
- `groundwork-scaffold/phases/01-ingestion-service-mapping.md` lists `docs-site --name <slug>` in both the capability→flag table and the generator-availability table.
- `tests/scaffolds/test_generation.py::test_docs_site_generation` passes (structural); `tests/scaffolds/test_compilation.py::test_docs_site_compiles` is `xfail`.

So the work is **not** "add a docs site." It is to fix three things that stop the existing one from delivering on the ask, plus make it an honest optional step:

> **Gap 1 — The containerized build can't see the docs.** `source.config.ts` reads `../../docs`, which resolves to the repo root only when Next runs *from the service directory*. But the generator wires it as a **docker-compose service** with build context `./services/docs-site` and a `COPY . .` Dockerfile (`files/Dockerfile`). The root `docs/` folder is *outside* that build context, so `next build` inside the container compiles against a `../../docs` that does not exist. The compose path is structurally broken; the only path that works today is running Next locally from the service dir. This is exactly the case the **native-runner registry** was built for — a thing `./dev` manages that is *not* a docker-compose service. That registry is now shipped: `registerRunner(tree, RunnerSpec)` in `src/generators/shared/scaffold-helpers.ts` is the one-line conversion, and `electron-app`/`flutter-app`/`cli-app` already use it. docs-site is simply the generator that never got converted.

> **Gap 2 — GroundWork docs render with blank titles and nav.** Fumadocs derives a page's title and its sidebar label from frontmatter `title`. GroundWork deliberately carries **no `title` frontmatter** (memory: frontmatter was stripped from all doc templates; the docs that do have frontmatter carry `owner`/`audience`, not `title`). Bet pitches and plans carry none. So today every page title and every nav entry is blank or a raw filename — the bets are *present* but not "easily viewable." The site must derive titles from the first `# H1` (which every GroundWork doc has) so it works with zero frontmatter, and it needs a nav structure that surfaces `bets/` as a first-class section instead of a flat filename dump.

> **Gap 3 — It isn't actually optional, and nothing runs it.** It is one undifferentiated row in the service-mapping table — there is no "do you want a docs site?" decision, no default-off posture, and no `./dev` affordance to launch it with live reload. The user asked for an *optional* step; that means an explicit offer in the scaffold flow and a registered runner the user can start.

**The organizing idea:** the docs site is a **native runner that renders the live `docs/` tree with H1-derived titles and a bets-first nav, offered as an optional scaffold step, defaulting off.** Fumadocs stays the default engine; Mintlify becomes a documented seam, not a parallel build.

---

## 1. Findings this plan responds to

| ID | Finding | Severity |
|---|---|---|
| D1 | `docs-site` generator exists and is wired, but as a docker-compose service — the wrong primitive for a build that reads the repo-root `docs/` tree. It is now the lone surface generator not on the runner registry (electron/flutter/cli already converted) | High — architecture / consistency |
| D2 | Docker build context (`./services/docs-site` + `COPY . .` in `files/Dockerfile`) cannot see `../../docs`; containerized `next build` compiles against a missing docs dir. The fix (`registerRunner`) is now a shipped helper, so this is a small conversion, not new infrastructure | High — broken path |
| D11 | The new scaffold has two registration paths: **capability footprints** (`shared/capabilities.ts`, `applyCapability` → `env`/`compose-service`/`runner`/`none`) for provider-backed ports, and **direct `registerRunner`** for surfaces. docs-site must use the surface path, not be modeled as a capability port — choosing wrong would couple a docs nicety into the architecture's port graph | Medium — model fit |
| D3 | Fumadocs derives titles/nav labels from frontmatter `title`; GroundWork docs carry none (H1-only) → every page/nav entry blank or raw filename. Bets present but not viewable | High — core to the ask |
| D4 | Nav title hardcoded `"Architecture Docs"` (`files/app/docs/layout.tsx`); no `meta.json` → `bets/`, `lifecycle/`, `principles/` render as an unordered filename tree; bets buried | Medium |
| D5 | Not a real optional step: one row in the mapping table, no decision prompt, no default-off posture, no infrastructure.md/hand-off treatment | Medium — the ask |
| D6 | No `./dev` affordance to run the site locally with live doc reload (and the compose path that would have built it is broken per D2) | Medium |
| D7 | `test_docs_site_compiles` is `xfail` — `@/.source` is a `fumadocs-mdx`/`next build` artifact, so `tsc --noEmit` has no types until source is generated | Low |
| D8 | `.md` vs `.mdx` globbing and rendering of GroundWork's code fences / tables / nested `bets/<slug>/` paths are unverified against real GroundWork docs | Low |
| D9 | Mintlify floated as a second option; no engine seam exists. Mintlify is a hosted SaaS configured by `docs.json`, not a Next build — a different shape entirely | Decision — defer behind a seam |
| D10 | Dependency pins are aging RCs (`next 15.0.3`, `react 19.0.0-rc-…`, `fumadocs 14.3.0`); fine to ship but worth a deliberate pin review | Low |

**Strengths not to regress:** the `defineDocs({ dir: '../../docs' })` approach (single source of truth — the site reads the real docs, never a copy); the port-assignment + provenance recording in `generator.ts`; the existing generation test and route-rename handling for `[[...slug]]`.

---

## 2. Workstream A — Run it honestly (native runner, not a broken container)

Resolves D1, D2, D6, D11. The runner registry is shipped (`runners` in `.dev/dev.config.json`, `cli-src/util/runners.ts`) and the generator-side helper exists — this is now a conversion, not new plumbing.

- **A1 — Self-register a `docs-site` runner instead of joining compose.** In `src/generators/docs-site/generator.ts`, delete the `composeDoc` parse + service-injection blocks and call the shipped helper `registerRunner(tree, …)` from `src/generators/shared/scaffold-helpers.ts` with a `RunnerSpec`: `{ name: <slug>, kind: 'surface', cmd: 'pnpm dev' (see O1), cwd: 'services/<slug>', env: { PORT: '<assignedPort>' }, autostart: false }`. `registerRunner` is idempotent by `name` and no-ops with a warning if `.dev/dev.config.json` is absent (workspace-dev-cli runs first in the scaffold flow, so this only bites when docs-site is generated standalone). This is the **surface registration path** (D11), exactly as `electron-app/generator.ts:262` calls it — *not* the capability-footprint path (`applyCapability`/`footprint.json`), which is for provider-backed ports. *Acceptance:* generated `.dev/dev.config.json` gains a `docs-site` runner; `docker-compose.yml` is untouched; `./dev status` lists the runner under its `native`/`runners` set.
  - *File:* `src/generators/docs-site/generator.ts` (remove `require('yaml')` compose handling; import and call `registerRunner`). The port can still be computed for the `PORT` env, but no longer needs to dodge compose port collisions (see O5).
- **A2 — Remove or repurpose the Dockerfile.** Either delete `files/Dockerfile` (a native runner needs none) or, if a deployable container is wanted, set the compose/build context to the **repo root** with `dockerfile: services/<slug>/Dockerfile` and a `COPY docs ./docs` so `../../docs` resolves — but A1's native-dev path is the default. *Acceptance:* no generated artifact references a build context that excludes `docs/`.
- **A3 — Keep `pnpm install` post-generation hook** (already present) but make it tolerate pnpm absence the way other generators do. *Acceptance:* generation succeeds with a clear warning when pnpm is missing.

## 3. Workstream B — Serve `docs/` well, frontmatter-free (bets visible)

Resolves D3, D4, D8. This is the heart of the ask.

- **B1 — Derive page title from the first H1.** Configure `source.config.ts` so a doc with no frontmatter still gets a title: add a `frontmatterSchema` whose `title` defaults from the document's first `# heading` (remark-extract H1 → frontmatter, or Fumadocs' title-from-content option). *Acceptance:* a fixture doc with zero frontmatter and a single `# Pitch: …` H1 renders with that title and that sidebar label.
- **B2 — Bets-first nav via generated `meta.json`.** Add `meta.json` files (or a `source.config.ts` page-tree transform) so the sidebar groups `bets/`, `lifecycle/`, `principles/`, `examples/` as labelled sections with `bets/` ordered first and each `bets/<slug>/` rendered as a sub-group (pitch → plan → contracts). *Acceptance:* generated site sidebar shows a "Bets" section listing each bet slug; a bet's `pitch.md` is reachable in ≤2 clicks from the docs home.
- **B3 — Nav title from the project, not hardcoded.** Replace `nav={{ title: 'Architecture Docs' }}` in `files/app/docs/layout.tsx` with the project/brand name (templated from generator options / `brand-tokens.json`, consistent with the other themed generators). *Acceptance:* generated `layout.tsx` shows the project name, not "Architecture Docs".
- **B4 — Confirm `.md` + nested paths + GroundWork markdown render.** Ensure `defineDocs` globs `.md` (not only `.mdx`), that `bets/<slug>/…` nested dirs resolve under `[[...slug]]`, and that GroundWork's tables/code fences/callouts render. *Acceptance:* a seeded `docs/` fixture containing a nested bet and a fenced code block + table renders without MDX parse errors.

## 4. Workstream C — Make it a genuine optional scaffold step

Resolves D5.

- **C1 — Explicit optional offer in scaffold phase 01.** In `src/hidden-skills/groundwork-scaffold/phases/01-ingestion-service-mapping.md`, add a short directive (not just the mapping row): after core services are mapped, **offer the docs site as an optional addition** via Protocol 4 (single decision), **default off**, framed as "a browsable site for your `docs/` — product brief, architecture, and bets." Keep the existing mapping-table row as the execution reference. *Acceptance:* the phase instructs the agent to ask, defaults to skipping, and only runs `docs-site` on an affirmative.
- **C2 — Hand-off + footprint-matrix row.** When generated, the docs site must appear as a **managed unit in the "What `./dev start` does" footprint matrix** that scaffold phase 05 writes into `docs/infrastructure.md` — one row (run mode + boot command, derived from `.dev/dev.config.json`), and that row must match `./dev status --json`'s `runners` array (the reconciliation rule the phase already enforces). Don't invent a separate docs-site section; it is a runner like any other. Note it in the scaffold hand-off. When skipped, say nothing. *Acceptance:* a scaffold that includes the docs site shows it as a runner row in the infrastructure footprint matrix and `./dev status --json` agrees; one that skips it does not mention a docs site.
- **C3 — Generator-availability table accuracy.** Update the phase-01 generator table row to state it registers a native runner (not a compose service) and serves the live `docs/` tree. *Acceptance:* the table matches WS-A/B behavior.

## 5. Workstream D — Harden & test

Resolves D7, D10.

- **D1t — Un-`xfail` the compilation test.** In `tests/scaffolds/test_compilation.py`, generate the Fumadocs source before `tsc` (run the `fumadocs-mdx` postinstall / `next build`-equivalent source step, or `postinstall` that writes `.source`) so `@/.source` types exist, then drop the `xfail`. If a full build is too slow for the compilation layer, assert via `next build` in the slow `test_scaffolds.py` layer instead and leave a typed stub for `tsc`. *Acceptance:* docs-site type-checks (or builds) in CI without `xfail`.
- **D2t — Extend generation assertions.** Add assertions to `tests/scaffolds/test_generation.py::test_docs_site_generation` for `source.config.ts` H1-title config (B1), `meta.json` bets grouping (B2), the runner entry in `.dev/dev.config.json` (A1), and absence of a `docker-compose.yml` injection. *Acceptance:* generation test fails if any WS-A/B artifact regresses.
- **D3t — Boot smoke (optional, slow layer).** In `test_scaffolds.py`, seed a tiny `docs/` with a bet and assert the site builds and the bet route resolves. *Acceptance:* a built docs site serves `/docs/bets/<slug>/pitch`.
- **D4t — Pin review.** Deliberately re-pin `next`/`react`/`fumadocs-*` to current stable releases (off the React 19 RC) or document why the pins stay. *Acceptance:* `package.json` pins are stable releases or carry an inline justification.

## 6. Workstream E — Mintlify as a second engine (seam, deferred)

Resolves D9. Do **not** build a parallel Mintlify build now; install the seam and document the path.

- **E1 — `--engine` schema flag.** Add `engine: "fumadocs" | "mintlify"` to `schema.json` (default `fumadocs`). For `mintlify`, generate a `docs.json` (Mintlify config pointing at the `docs/` tree) + a README on running `mintlify dev` / hosting, rather than a Next app. Gate behind a clearly-marked "experimental / config-only" note. *Acceptance:* `docs-site --engine mintlify` emits a valid `docs.json` and no Next app; default and omitted `--engine` are unchanged Fumadocs.
- **E2 — Architecture note.** Record in the plan/decisions that Mintlify is a hosted SaaS keyed on `docs.json`, so its "generator" is config + instructions, not a buildable service — the two engines do not share a runner shape. (Captured in §7 below; revisit before building E1.)

## 7. Decisions

**Settled:**

| # | Decision | Rationale |
|---|---|---|
| S1 | Ship as a **native runner**, not a docker-compose service | The build reads repo-root `../../docs`, which is outside any per-service Docker build context (D2). The runner registry already exists for exactly this (`dev-cli-native-runners.md`). Bonus: `next dev` gives live doc reload. |
| S2 | **Derive titles from the first H1**, zero-frontmatter | GroundWork deliberately ships frontmatter-free docs (D3); the site must work with what GroundWork writes, not force a frontmatter convention back onto every doc. |
| S3 | **Default off; offered explicitly** as an optional step | The user asked for optional; a docs site is a nicety, not infrastructure every project needs. |
| S4 | **Fumadocs is the default engine**; Mintlify is a deferred, config-only seam | Fumadocs builds from local Markdown with no SaaS dependency and is already implemented. Mintlify is hosted and shaped differently (D9) — a flag and docs, not a parallel build. |
| S5 | Serve the **live `docs/` tree**, never a copy | Single source of truth; the site reflects whatever the delivery loop writes. Already the generator's approach — preserve it. |
| S6 | Register via the **direct surface path** (`registerRunner`), not as a capability port/footprint | The capability framework (`shared/capabilities.ts`) models *provider-backed* ports (LLM, store, …) whose infrastructure is a consequence of provider choice. A docs site is a developer-facing surface with a fixed shape, not a swappable provider — modeling it as a port would pollute the architecture's capability graph. It registers a `runner` footprint the same way `electron/flutter/cli` surfaces do. |

**Open:**

| # | Question |
|---|---|
| O1 | Runner command: `next dev` (live reload, slower, dev-only) vs `next build && next start` (production-faithful, no live reload)? Lean `next dev` for the default runner; offer build for deploy. |
| O2 | Should the plan also produce a **static export** (Fumadocs static / `next export`) for hosting the docs (e.g. GitHub Pages), or is local-run enough for v1? |
| O3 | `meta.json` generation: emit static `meta.json` files at generation time, or a `source.config.ts` page-tree transform that orders sections dynamically? Static is simpler; dynamic survives new top-level doc dirs. |
| O4 | Does Mintlify warrant a generator at all, or just a documented `docs.json` + a `groundwork-upgrade`-style note? Decide before building E1. |
| O5 | Port: keep the base-4000 native port, or let the runner pick a free port and print it (no compose port map needed once it leaves Docker)? |
| O6 | Migration scope: extend `gw-runner-retro-registration` to de-compose + re-register an existing `docs-site` service, or ship `[no-migration]` + release note on the assumption installed docs sites are rare? |

## 8. Sequencing & gates

1. **WS-A** (runner, de-Docker) — unblocks every other piece; without it the site can't build at all.
2. **WS-B** (titles + bets nav) — the actual payload of the ask; do immediately after A.
3. **WS-C** (optional offer + infra docs) — wraps it into the scaffold flow.
4. **WS-D** (tests + pins) — lock the behavior; un-`xfail` is the credibility gate.
5. **WS-E** (Mintlify seam) — only after A–D land and O4 is decided.

**Shipping plumbing (applies on commit):** for fresh generations this is additive → a `[no-migration]` CHANGELOG line. **But the compose→runner conversion (WS-A) changes generator output shape**, so an install that *already* generated a docs-site-as-compose-service is left with a stale compose entry and no runner. The retro-registration migration `gw-runner-retro-registration` (shipped with `dev-cli-native-runners.md`) already registers surfaces/sidecars as runners in pre-existing installs without touching db/jaeger — **extend it (or add a sibling) to cover an existing `docs-site` compose service**: strip the compose entry, register the runner. Decide via O6 whether this is worth a migration or whether docs-site is rare-enough-in-the-wild to ship `[no-migration]` with a release note. `cli-src/` is *not* touched by this plan (the runner mechanism already exists), so no dev-bundle rebuild is required unless WS-D work reaches into it. Run the cheap gates: `./dev test generation && ./dev test contracts` (contracts includes the migration-coverage gate, which will flag the shape change if no entry/annotation is provided).

**Done means:** `docs-site --name docs` generates a Fumadocs app registered as a native `./dev` runner (no broken compose service); `./dev start` (or the runner) serves the live `docs/` tree with H1-derived titles and a sidebar where **bets are a first-class, browsable section**; the scaffold skill offers it as an optional, default-off step and documents it in `infrastructure.md` when taken; the compilation test no longer `xfail`s; and Mintlify exists as a documented `--engine` seam, not a half-built parallel.
