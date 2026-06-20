# Phase 4: Infrastructure Verification

Boot the infrastructure and prove it works. The infrastructure document must describe a system that runs, not a system that should run in theory — a document based on an unverified scaffold has no value to the team that inherits it.

1. **Boot** — start the full local stack: `./dev start`.
2. **Migrate** — run database migrations for every service that includes PostgreSQL. Check the generated service for the migration command (typically `./dev migrate` or a service-level script).
3. **Test** — run the system integration tests pre-baked into the scaffolds. These tests verify cluster health, service connectivity, database availability, and cross-service communication.
4. **Self-heal** — if a service fails to start or a test fails, debug and repair it. Read logs, inspect generated configuration, fix port collisions, adjust environment variables, and iterate until everything is green. A failure here indicates a defect in the GroundWork generators — resolve it so the team does not encounter it.
5. **Reconcile capability footprints** — for every capability in `.groundwork/capability-ports.json`, confirm its footprint is real, not just declared: a `compose-service` provider has a running container; a `runner` provider appears in `./dev status` (probe `./dev status --json` and check its `runners` array); an `env` provider has its variables present in the service's config / `.env.example`; a `none` bare interface has its strict-xfail contract test in the service's suite (the bet is visible, not forgotten). The managed set `./dev` reports must equal the architecture's surfaces + services + runners — a mismatch is a gap between what the architecture declared and what the scaffold built, and is resolved here, not papered over in the doc.

6. **Seed the code map** — run `npx groundwork-method repo-map` to build the initial `.groundwork/cache/repo-map.json` from the scaffolded source (tree-sitter import edges + PageRank centrality). The project is born with a current code map rather than waiting for the first agent to build one, and it is the concrete evidence Phase 5 cites for maturity dimension D5.

Do not advance to Phase 5 until the entire system boots cleanly, all tests pass, every capability footprint reconciles, and the code map is seeded.

Mark the Infrastructure Verification phase complete in `scaffold-cache.md`.

**If execution tools are unavailable:** Skip this phase and record in `scaffold-cache.md` that verification and the code-map seed are pending. The infrastructure document in Phase 5 must flag this explicitly — it cannot present ports and commands as verified facts if the system has not been booted, and the D5 assessment must show the map as not-yet-built rather than assumed present.
