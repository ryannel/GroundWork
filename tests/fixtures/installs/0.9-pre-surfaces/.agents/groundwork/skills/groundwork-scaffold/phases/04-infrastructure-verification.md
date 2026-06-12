# Phase 4: Infrastructure Verification

Boot the infrastructure and prove it works. The infrastructure document must describe a system that runs, not a system that should run in theory — a document based on an unverified scaffold has no value to the team that inherits it.

1. **Boot** — start the full local stack: `./dev start`.
2. **Migrate** — run database migrations for every service that includes PostgreSQL. Check the generated service for the migration command (typically `./dev migrate` or a service-level script).
3. **Test** — run the system integration tests pre-baked into the scaffolds. These tests verify cluster health, service connectivity, database availability, and cross-service communication.
4. **Self-heal** — if a service fails to start or a test fails, debug and repair it. Read logs, inspect generated configuration, fix port collisions, adjust environment variables, and iterate until everything is green. A failure here indicates a defect in the GroundWork generators — resolve it so the team does not encounter it.

Do not advance to Phase 5 until the entire system boots cleanly and all tests pass.

Mark the Infrastructure Verification phase complete in `scaffold-cache.md`.

**If execution tools are unavailable:** Skip this phase and record in `scaffold-cache.md` that verification is pending. The infrastructure document in Phase 5 must flag this explicitly — it cannot present ports and commands as verified facts if the system has not been booted.
