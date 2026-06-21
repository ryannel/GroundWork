# Phase 2: Scaffolding Execution

**If command execution tools are available:** Execute the confirmed generator commands in order. For each command:
1. Run `npx --yes nx g "$(pwd)/.groundwork/config/generators.json:<generator-name>" <parameters>`. The absolute `$(pwd)` prefix is required because Nx calls `require.resolve` on the collection argument — a relative path resolves against Nx's own `node_modules`, not the workspace root.
2. Verify the expected output files exist (e.g., `services/<name>/go.mod` for a Go service, `services/<name>/package.json` for a Next.js app).

After all generators have run, verify that `docker-compose.yml` includes entries for every scaffolded service.

Then reconcile against `.groundwork/capability-ports.json`: every capability with a `compose-service` footprint must have its service in `docker-compose.yml`, every `runner` footprint an entry in `.dev/dev.config.json` `runners[]`, and every `none` capability its stub plus a strict-xfail contract test in the service. A declared footprint with no materialization is a mapping or generation error — fix it before advancing, since the generators inject infrastructure only on demand and a missing provider leaves the capability silently unsatisfied.

Go and Python generators automatically install the corresponding `groundwork-go-engineer` or `groundwork-python-engineer` skill into `.agents/skills/`. The Next.js generator installs `groundwork-nextjs-engineer`. Verify each skill file exists after its generator runs — the generator promotes it directly from the framework package, so if any are missing, re-run that service's generator.

Mark the Scaffolding Execution phase complete in `scaffold-cache.md` and proceed to Phase 3.

**If command execution tools are unavailable:** The execution plan is already in `scaffold-cache.md`. Present the full runbook to the user as a single handoff — all commands in order, with the expected output for each. Do not ask them to run one command and report back. Accept their confirmation and mark the Scaffolding Execution phase complete. Note that infrastructure verification (Phase 4) must be done manually.
