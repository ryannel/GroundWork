# Implementation Plan: Composable Scaffolds — Capability Ports, Providers, Native Runners, Honest Infrastructure

**Status:** EXECUTED (complete 2026-06-18; started 2026-06-16). Triggered by a real run: an Electron desktop app ("Magpie") scaffolded a `./dev` whose `start` claimed a 0s success while `status` showed zero containers and zero processes — because the only thing `./dev` can manage is docker-compose services, and a local-first desktop architecture has none. Nothing was broken; the model is wrong for non-server apps. **Expanded 2026-06-16** into a broader thesis (WS-F): the scaffold should compose to the architecture through hexagonal **capability ports** with selectable **providers**, where infrastructure and runners are *consequences* of provider choices, not defaults. Decision: build the capability-port framework generically, with LLM as the first worked provider family.
>
> **Executed so far: WS-A + WS-B + WS-C.**
>
> *WS-A/B (foundation):* db/jaeger are now on-demand (moved into `ensureOptionalInfra`, like redis); the base compose ships no services; Go/Python inject db+jaeger, Next.js injects jaeger, all service generators create the services/volumes maps via `createNode` (fixing a latent `.has is not a function` bug exposed once the base stopped shipping `services:`). The native **runner registry** (`runners` in `.dev/dev.config.json`, new `cli-src/util/runners.ts`) is live: `start` launches declared runners (Phase C) with cwd/env, `stop`/`clean` terminate them, `status`/`logs` include them, `getAppServices` excludes runner dirs; `start` prints an honest "nothing to start" notice instead of a fake success; `migrate` no-ops without a db; `dev.config.json` seeds `runners: []` and preserves them across re-runs.
>
> *WS-C (generators self-register):* shared `registerRunner(tree, …)` helper (idempotent by name). electron-app registers an **autostart surface** runner (`./dev start` brings up the desktop app); flutter-app and cli-app register surface runners with `autostart:false` (need a device / invoked ad hoc); python-microservice gains `--native` → registers an **autostart sidecar** runner and emits no compose service for itself (provisions only backing infra it connects to, no forced jaeger). `./dev status --json` gained a `runners` array (state per runner) for the WS-D reconciliation probe. cli-app also gained its missing `recordGeneratorProvenance` call.
>
> *End-to-end proof:* scaffolding workspace-dev-cli + electron-app + `python-microservice --native` yields a `./dev status` whose Native Processes table lists both (`desktop-app` surface, `compute-service` sidecar) — the original Magpie "(none)" symptom is closed. Verified: `./dev test generation` (215 passed pre-WS-C; WS-C adds 4 targeted runner/infra tests, all green) + `./dev test contracts` (bundle fresh, merge idempotent) + clean `tsc`/bundle build.
>
> **Executed 2026-06-17: WS-F core (F1–F5 for the Python/LLM reference family).** A capability registry as data (`src/generators/capabilities/llm/`: `capability.json` + per-stack port/contract templates + `providers/{anthropic,openai,local,none}/footprint.json` + adapter templates) — adding a provider is a folder, not code. A shared `applyCapability` injector (`src/generators/shared/capabilities.ts`) materializes port + adapter + contract test + provider dependency + env footprint, consumed by both `python-microservice --llm` (rewired off its inline per-provider templates; the `LLMGateway` port moved out of `protocols.py` into its own `llm_port.py`) and a new standalone **`add-capability`** generator (Day-2 / bet entry point). `none` is the raw gateway: port + not-yet-implemented stub + a strict-xfail contract test (kept xfail so fresh scaffolds stay green and flip red on delivery — a deliberate refinement of "red test"). `local` is an OpenAI-compatible adapter against a self-hosted endpoint (env footprint). Existing `anthropic`/`openai` generated output is byte-equivalent (no regression). Verified: 3 new capability generation tests + the existing LLM-provider matrix + infra/native suite green (`./dev test contracts` green); full generation suite pass owed before merge.
>
> **Executed 2026-06-17: WS-F F7 + F8 (architecture declares capability ports; scaffold reconciles).** `groundwork-architecture` template §3 gains a Capability Ports & Providers table; Phase 5 elicits provider + footprint per port (`none` = raw gateway/bet); Phase 7 writes the machine twin `.groundwork/capability-ports.json` (new contract `templates/capability-ports.md`, disambiguated from the surface capability *ledger*). `groundwork-architecture-extract` recovers ports from brownfield code. `groundwork-scaffold` Phase 1 reads the twin → generator flags / `add-capability`; Phases 2 + 4 reconcile footprints (compose-service → container, runner → `./dev status`, env → documented, `none` → strict-xfail test). Cross-Phase Contracts table updated. Verified: `./dev test contracts` green (skill-sync, anchors, migration gate). Skills clean-copy on update — `[no-migration]`.
>
> **Executed 2026-06-17: WS-F F5 (Go LLM family) — O9 resolved "Go only".** `capabilities/llm` gains a `go` stack: the `gateway.LLMGateway` port, `net/http` adapters for anthropic/openai/local (no SDK dep → `go.mod` untouched, compiles standalone — verified with `gofmt -e` on all four) + the `none` stub, and a contract test with a compile-time `var _ gateway.LLMGateway` assertion + a Skip-based bet test. `add-capability` detects the Go stack and resolves the module import path from `go.mod`; `applyCapability` generalized with per-stack `envFile` + go.mod require injection. Surfaces/frontends consume the LLM via the backend contract (no embedded adapter — keys server-side, one port per owner). Verified: 2 new Go generation tests + the full Python suite green.
>
> **Executed 2026-06-18: WS-F rounding-out + WS-D2 + WS-E (F6, F9, D2, E1, E3) — plan complete.** `applyCapability` now materializes all four footprint kinds: it already wrote `env`/`none`, and now injects a `compose-service` footprint's container into the workspace `docker-compose.yml` and registers a `runner` footprint with `./dev`. Two new LLM providers exercise the new arms and prove "swap the footprint, keep the port + adapter": **`ollama`** (runner — `ollama serve`) and **`localai`** (compose-service — a model-server container), both reusing the OpenAI-compatible adapter (F9). The footprint matrix (env/compose/runner/none) is covered by generation tests. **F6:** a `capability-ports.md` engineer-skill reference (go + python — the stacks that emit ports; frontends consume via the backend per O9) describes the generated port/adapter/footprint shape and the `none` bet, mirrored byte-identical. **D2:** `infrastructure.md` gains a "What `./dev start` does" section (one row per managed unit, run mode + boot command, cross-checked against `./dev status --json`). **E1:** `gw-runner-retro-registration` agent migration registers surfaces/sidecars as runners in pre-existing installs without touching db/jaeger compose. **E3:** a runner-lifecycle boot test (`test_scaffolds.py`) starts/stops a runner on a container-less workspace with no Docker. Verified: full generation suite + contracts + migration gate green.
>
> **Remaining:** none — the plan is fully executed. (Note: WS-A's db/jaeger stay on the proven on-demand inline path rather than being reframed as capability providers (F2); the capability footprint layer is the general mechanism, and db/jaeger remain the substrate it generalizes — reframing them was judged out-of-scope regression risk, decision open to revision.)
**Audience:** An engineer or agent implementing this change. Each slice names its files and an acceptance check; judgment calls are listed as open decisions in §7.
**Scope owner:** The `workspace-dev-cli` generator and its bundled CLI (`cli-src/`), the surface + native-sidecar generators (`electron-app`, `cli-app`, `flutter-app`, `python-microservice`), a new capability/provider generator layer, the `groundwork-architecture` + `groundwork-scaffold` skills, the engineer skills (hexagonal port/adapter conventions), and migrations. Coupled docs: `docs/architecture.md` (new Capabilities & Providers section), `docs/infrastructure.md` shape.

---

## 0. Read this first — the mental model

`./dev` has exactly one notion of a manageable unit: **a directory in `services/` that is also a service in `docker-compose.yml`** (`cli-src/src/util/services.ts:34-56`). Native-vs-Docker is then a marker-file guess (`.air.toml`/`package.json`/`pyproject.toml`), and the boot command for each type is hardcoded (`util/services.ts:73-85`). Everything downstream — `start`, `stop`, `status`, `logs`, `migrate` — iterates that one set.

Two consequences fall out, and both are the bug the user hit:

> **Wrong default — the baseline assumes a server.** `workspace-dev-cli` always seeds `docker-compose.yml` with `db` (Postgres+pgvector) + `jaeger` (`files/docker-compose.yml.template:3-44`). Redis and the pubsub emulator are *not* seeded — the template comment (lines 23-27) says they're injected on demand by services that actually need them. **Postgres and Jaeger should obey that same rule and don't.** A local-first desktop app needs neither, so its compose gets stripped to `services: {}` — and an empty stack is what `./dev start` then "succeeds" at.

> **No primitive for non-container apps.** The `electron-app` generator deliberately never joins compose (`generator.ts:254`), and a native macOS Python sidecar (Metal/MPS, can't be containerized) has nowhere to register either. `dev.config.json` carries three fields — `projectPrefix`, `identity`, `terminal` (`cli-src/src/index.ts:9-13`) — and nothing for runners. So a desktop app and its sidecar are *structurally invisible* to `./dev`. The scaffold run that produced Magpie even tried to do the right thing — it stripped db/jaeger and wrote an explanatory comment into the compose — but had nothing to register the app and sidecar *into*, so it stopped there.

**The organizing idea:** decouple "managed by `./dev`" from "is a docker-compose service." Introduce a first-class **runner registry** — declared native processes the CLI starts, stops, tails, and reports on — and make *all* infrastructure (db, jaeger included) opt-in, exactly as redis already is. Then "managed unit" = {docker infra services} ∪ {app services} ∪ {declared runners}, and `./dev start` tells the literal truth about each.

With those two primitives in place, the user's "don't scaffold the wrong thing" vs "scaffold then customise" fork mostly dissolves: **surface and native-sidecar generators self-register their runner** (correct by construction), and the **scaffold skill adds a reconciliation pass** that prunes infra the architecture didn't ask for, confirms every active surface + sidecar maps to a managed unit, and writes an `infrastructure.md` that matches what `./dev` will actually do. Intelligence lives in the generators for the mechanical part and in the skill for the genuinely architecture-specific judgment ("this Python service is native because it needs Metal/MPS").

### Going further (2026-06-16): infrastructure is a consequence of providers, not a default

The two primitives above make the *symptom* go away. The deeper fix removes the *category of bug*: stop the scaffold from shipping any infrastructure as a guess at all. GroundWork already preaches hexagonal architecture — ports in the domain, swappable adapters at the edge. The scaffold should be a **composition of capability ports**, and infrastructure should fall out of which providers satisfy them:

- The **architecture** declares the *capabilities* the app needs — LLM, relational store, vector search, object storage, email, payments, telemetry, …
- Each capability is a hexagonal **port** (a domain interface).
- Each port is satisfied at scaffold time by a chosen **provider/adapter**. `none` — a **raw gateway**: the port + a stub adapter + a *red* contract test, no implementation — is always a legal choice.
- Each provider declares its **operational footprint**, exactly one of: **env only** (e.g. an Anthropic/OpenAI LLM adapter → an API-key env var, no infra), **a compose service** (e.g. a pgvector store → injects `db`), **a native runner** (e.g. a local model server → a WS-B runner), or **nothing** (the raw gateway).

Under this model, WS-A's "make db/jaeger on-demand" is no longer a special case — it is the *general rule*: `db` appears because some provider's footprint is a compose service; `jaeger` appears because a telemetry provider was selected. The runner registry (WS-B) is simply the mechanism a provider uses when its footprint is a process. **WS-A and WS-B are the substrate; the capability-port/provider layer (WS-F) is the policy that drives them.** There are no infra defaults because there are no defaults — only declared capabilities and the providers chosen to satisfy them.

The `none` mode is GroundWork's own thesis turned on the scaffold: it ships a port's contract as a spec + a failing test, and the concrete adapter becomes a **bet**. Composable providers + the bet loop is the framework's full design-locked-in-tests story, end to end — and it lands precisely on the port/adapter boundaries the engineer skills already enforce.

---

## 1. Findings this plan responds to

| ID | Finding | Severity |
|---|---|---|
| F1 | `start` prints "Development environment started (0s)" + "Run './dev logs'" even when nothing was started — a misleading success (`lifecycle.ts:79-80`) | High — the reported symptom |
| F2 | `db` + `jaeger` are hardcoded in the base compose template instead of being injected on demand like redis/pubsub (`docker-compose.yml.template:3-44`) | High — wrong default |
| F3 | No runner registry: `dev.config.json` cannot declare a native process; surfaces (electron/cli/flutter) and native sidecars are unmanageable by `./dev` (`index.ts:9-13`, `electron-app/generator.ts:254`) | High — missing primitive |
| F4 | The compose-unreadable fallback in `getAppServices()` returns *all* `services/` dirs and boot-detects them by marker, so without a compose file a surface dir could be mis-launched (`util/services.ts:42`) | Medium — correctness once compose is optional |
| F5 | `migrate` assumes a `-db` container always exists and waits 120s for it (`lifecycle.ts:130-147`); on a db-less project it would hang then error | Medium |
| F6 | No generator can register a native process; there is no shared helper analogous to the compose-injection helper | Medium — enabler for F3 |
| F7 | `infrastructure.md` is written from the scaffold skill's intent, not reconciled against what `./dev` actually manages, so it can describe a stack the CLI can't run | Medium |
| F8 | Existing installs carry a db+jaeger compose and a runner-less `dev.config.json`; the change must land without breaking or silently rewriting their stacks | High — upgrade safety |

**Strengths this plan must not regress:** on-demand infra injection (the redis/pubsub pattern is the model, not the exception); the zero-dependency bundled CLI; graceful degradation when Docker is absent (`getComposeServices()` → `null` fallback); the provenance/manifest tiering that makes `update` safe; surface generators staying out of compose.

---

## 2. Workstream A — Honest infrastructure (the baseline stops assuming a server)

**A1 — Strip `db` + `jaeger` from the base compose template; make them on-demand.**
Edit `src/generators/workspace-dev-cli/files/docker-compose.yml.template` so the seeded file declares only the `groundwork-net` network (no `services:` block, or an empty one with the existing explanatory comment). Move the `db` and `jaeger` service definitions into the on-demand injection path used today for redis/pubsub. A service generator injects:
- `db` (+ `db_data` volume) when the service needs a relational/vector store;
- `jaeger` when the service exports OTLP telemetry.

*Files:* `workspace-dev-cli/files/docker-compose.yml.template`; the injection helper under `src/generators/shared/` (the same module `go-microservice`/`python-microservice` already use for redis); `go-microservice/generator.ts`, `python-microservice/generator.ts`, `nextjs-app/generator.ts` (call the db/jaeger injectors when their options imply a store / telemetry). *Accept:* generating a workspace with no backend service yields a compose with no services; generating a go-microservice with a store yields `db` + `jaeger`; `./dev test generation` covers both.

**A2 — Don't emit `docker-compose.yml` when no service will ever use it.**
If the workspace has no containerized service after scaffolding, there should be no compose file at all (not an empty one that invites the "why is this here" question). Since `workspace-dev-cli` runs *first*, it can't know yet — so keep writing the network-only file, and add a scaffold-skill reconciliation step (WS-D) that deletes a service-less compose at the end. Alternatively, gate the file on a generator option. *Decision in §7.* *Accept:* a desktop-only scaffold ends with no `docker-compose.yml`, or a clearly-commented empty one — pick per §7.

**A3 — `start` tells the truth.**
Rewrite the tail of `start` (`lifecycle.ts:79-81`) to summarise what actually happened: counts of infra services started, app services booted, runners launched. When the union is empty, print an explicit notice — "No containerized services or native runners are registered. See docs/infrastructure.md." — at info level, **not** a success card. *Accept:* on an empty workspace `./dev start` prints the notice and exits 0 without claiming a started environment; on a desktop workspace it reports the launched runner.

**A4 — `migrate` is a no-op when there's no database.**
Guard `migrate` (`lifecycle.ts:130-147`): if no compose service named `${projectPrefix}-db` exists, print "No database in this workspace; nothing to migrate." and return 0 instead of waiting 120s. *Accept:* `./dev migrate` on a db-less workspace returns immediately.

---

## 3. Workstream B — The runner registry (the missing primitive)

**B1 — Extend the `dev.config.json` schema with `runners`.**
Add an optional `runners` array to the `DevConfig` interface (`cli-src/src/index.ts:9-13`) and a typed shape:
```jsonc
"runners": [
  {
    "name": "compute-service",        // unique; keys pid/log files
    "kind": "sidecar",                // "sidecar" | "surface" — display/metadata only
    "cmd": "uv run python src/main.py",
    "cwd": "services/compute-service", // relative to repo root
    "env": { "FOO": "bar" },          // optional
    "health": null,                   // optional; { "type": "http", "url": "..." } | { "type": "port", "port": 5173 }
    "autostart": true                 // optional, default true; false = registered but not launched by `start`
  }
]
```
*Files:* `cli-src/src/index.ts`; a new `cli-src/src/util/runners.ts` exporting `getRunners(config)`, plus helpers that reuse the existing `writePid/readPid/isRunning/isDead/killTree` (those already take an arbitrary name string). *Accept:* a config with a `runners` array round-trips; unit-tested in `cli-src`.

**B2 — `start` launches declared runners (Phase C).**
After Phase A (infra) and Phase B (app services), iterate `getRunners()`: skip `autostart:false`; skip already-running; `spawnBackground` with `cwd` + merged `env`; `writePid(name, pid)`; log to `.dev/logs/<name>.log`; same 500ms liveness check as app services (`lifecycle.ts:65-76`). *Accept:* `./dev start` on a workspace with a registered runner spawns it, writes `.dev/pids/<name>.pid`, and reports the PID.

**B3 — `stop` / `clean` terminate runners.**
Extend the loops in `stop` (`lifecycle.ts:88-94`) and `clean` (`107-112`) to include `getRunners()` names. *Accept:* `./dev stop` kills the runner tree and removes its pid file.

**B4 — `status` and `logs` include runners.**
`collectStatus()` (`lifecycle.ts:227-242`) and `renderStatusTables()` (`244-258`) add runners to the Native Processes section (running → PID, dead → "dead"); the `--json` shape gains them. `logs` (`201-209`) tails `.dev/logs/<name>.log` for each runner. *Accept:* `./dev status` lists a running runner under Native Processes; `./dev logs` shows its output.

**B5 — Runners are authoritative for their directories (close F4).**
`getAppServices()` must exclude any `services/` dir that is registered as a runner, in both the compose-readable and the compose-`null` fallback path (`util/services.ts:34-44`). This prevents a surface dir from being double-managed or boot-detected by marker. *Accept:* a workspace with `compute-service` registered as a runner and no compose file does not also treat it as an app service (no `npm run dev`/`air` guess); unit test added.

**B6 — Rebuild the bundle.**
After all `cli-src/` edits, `npm run build:dev-cli`; commit the regenerated `dist/dev-bundle.js`. The freshness contract test (`./dev test contracts`) fails on a stale bundle. *Accept:* `./dev test contracts` green.

---

## 4. Workstream C — Generators self-register their runner

**C1 — `electron-app` registers a surface runner.**
On generation, call the shared runner-registration helper (C5) to add a `kind:"surface"` runner whose `cmd` is the Electron dev launch (the existing `project.json` run-commands target, e.g. `npx nx run <name>:serve`) and `cwd` the app dir. Remove the now-misleading "deliberately not managed" framing at `electron-app/generator.ts:254` — it's still not in compose, but it *is* a runner now. *Accept:* scaffolding an electron-app yields a `dev.config.json` runner; `./dev start` launches it.

**C2 — `cli-app` and `flutter-app` register their runners.**
Same pattern. `cli-app`'s runner may be `autostart:false` (a CLI isn't a long-lived process you "start"); `flutter-app` registers its `flutter run`/device target. *Decision on cli-app autostart in §7.* *Accept:* each generator writes its runner; covered by `./dev test generation`.

**C3 — `python-microservice` native mode registers a sidecar runner.**
When a Python service is generated as a native sidecar rather than a container (the Metal/MPS case), register a `kind:"sidecar"` runner instead of injecting a compose service. Needs a generator option to choose native vs container. *Decision on the option name/default in §7.* *Accept:* `python-microservice --native` (or equivalent) produces a runner, no compose entry; container mode unchanged.

**C4 — Surface registry → runner mapping in scaffold Phase 1.**
The scaffold skill's surface→generator mapping (`groundwork-scaffold/phases/01-ingestion-service-mapping.md:20-42`) already routes `electron-app`/`flutter-app`/`cli-app`. No new routing — the generators now self-register — but document that a surface becomes a runner. *Accept:* phase doc names the runner outcome per surface.

**C5 — Shared runner-registration helper.**
Add `registerRunner(tree, runner)` to `src/generators/shared/` (sibling of the compose-injection helper): reads `.dev/dev.config.json`, appends/updates the `runners` array idempotently by `name`, writes it back. Idempotent re-runs must not duplicate. *Files:* `src/generators/shared/` + `recordGeneratorProvenance` so the upgrade path knows the runner was generator-produced. *Accept:* calling twice yields one entry; provenance recorded.

---

## 5. Workstream D — Scaffold-skill reconciliation (the "customise" half)

**D1 — Post-generation reconciliation step.**
Add a step at the end of `groundwork-scaffold/phases/02-scaffolding-execution.md`: after all generators run, read the architecture's data + runtime decisions and:
1. Confirm `db`/`jaeger` are present **iff** the architecture calls for a store / telemetry; remove any that the architecture explicitly rejected (with a discovery note explaining why).
2. Confirm every **active surface** and every **native sidecar** in `architecture.md` / `surfaces.json` maps to either a compose service or a registered runner — no orphans.
3. If no compose service remains, resolve the empty-compose decision (WS-A2).
*Accept:* the phase doc has the reconciliation checklist; a desktop-only scaffold leaves no db/jaeger and every surface is a runner.

**D2 — `infrastructure.md` matches reality.**
The infrastructure doc the scaffold writes (Phases 4–6) must enumerate, per managed unit, *how `./dev` runs it* — container vs runner, the boot command, and why a native sidecar is native. Add a "What `./dev start` does" section derived from the final compose + runner set, so the doc can't describe a stack the CLI can't run (F7). *Accept:* `infrastructure.md` lists each runner and container with its run mode; cross-check against `./dev status --json` shape.

**D3 — Sanity probe.**
After reconciliation, the skill runs `./dev status` (or a dry introspection) and confirms the reported managed set equals the architecture's surfaces + services. *Accept:* the phase instructs the probe and what to do on mismatch.

---

## 6. Workstream E — Upgrade safety + tests

**E1 — Migration for existing installs (F8).**
The bundle is Tier 1 (clean-replaced on `update`) so new CLI behavior ships automatically. The `runners` field is additive — old configs without it have zero runners and keep working — so it is `[no-migration]` *for safety*. But two things need handling:
- **Provenance regeneration must not wipe runners.** When the upgrade path regenerates `dev.config.json` from recorded options, the `runners` array must be preserved/merged, not reset (mirror the `8c943ad` compose-preservation fix).
- **Retro-registering surfaces in an existing project** is judgment → an `agent` migration brief (`migrations/<id>/brief.md`, Detect/Transform/Accept): detect surfaces with no runner, propose registrations, leave the user's db/jaeger compose untouched unless they opt in.
*Files:* `migrations/index.json` entry at the unreleased version; brief; fixture under `tests/fixtures/installs/`. *Accept:* migration-coverage gate in `./dev test contracts` green; fixture exercises it.

**E2 — Generation + compilation tests.**
Extend `tests/scaffolds/test_generation.py` for: empty workspace → no compose services; backend-with-store → db+jaeger; each surface generator → a runner in `dev.config.json`. Pairwise compile unaffected. *Accept:* `./dev test generation` covers the new branches.

**E3 — Boot test for a runner.**
Add an end-to-end case (or extend `test_scaffolds.py` / `validate_scaffold.py`) that scaffolds a workspace with a trivial native runner, `./dev start`, asserts the pid file + `./dev status --json` shows it native+running, `./dev stop`, asserts gone. *Accept:* the runner lifecycle is covered without Docker.

**E4 — Release bookkeeping.**
Per the contributor release checklist: CHANGELOG entry (with the `[migration]`/`[no-migration]` lines and registry id), version bump, `npm run build:dev-cli`, contract gates. The framework-upgrade memory notes the next release must be ≥ 0.10.0. *Accept:* release checklist satisfiable; gates green.

---

## 6.5 Workstream F — Composable capability ports & providers (the policy layer)

This is the organizing idea (§0 "Going further"). Build it generically; ship LLM as the first fully-worked provider family. Conceptually F drives A/B; in execution, A/B are the substrate F plugs into.

**F1 — Capability + provider model, as data not code.**
Define a capability as a descriptor, so adding a capability or provider is templates + manifest, not new generator logic. Proposed layout: `src/generators/capabilities/<capability>/` holding `capability.json` (id, the port-interface templates per stack, the provider catalog, the default provider, the contract-test template) and `providers/<provider>/` (adapter templates + a `footprint.json`). *Accept:* a capability registry the scaffold + a generator can read; adding a provider is a folder, not a code change. *(See O6 for the manifest shape.)*

**F2 — Provider footprint → infra/runners (the bridge to WS-A/B).**
Each provider's `footprint.json` declares exactly one of `env` / `compose-service` / `runner` / `none` plus its payload. Selecting a provider invokes the matching mechanism: the db/jaeger/redis compose injectors from WS-A, `registerRunner` from WS-B/C5, or just records required env. **WS-A's db and jaeger become provider footprints** — `db` is the footprint of a `postgres`/`pgvector` provider for the relational/vector-store capability; `jaeger` is the footprint of an `otlp-jaeger` provider for the telemetry capability. *Accept:* choosing a compose-footprint provider injects the service; a runner-footprint provider registers a runner; an env-footprint provider injects nothing but records the var; no double-implementation of injection logic.

**F3 — The `none` raw-gateway mode.**
For provider `none`, emit: the port interface in the domain, a stub adapter that returns a not-implemented error, composition-root wiring that selects the stub, and a **red** port-conformance contract test under the service's `contracts/`. Optionally seed a bet pitch "Implement the `<capability>` adapter" so the gateway flows straight into the delivery loop. *(See O7, O8.)* *Accept:* `--capability=llm --provider=none` produces a port + stub + red test + wiring and nothing else; the suite is red on exactly that test; no infra, no runner.

**F4 — Generator surface.**
A shared capability-injection module consumed two ways: (a) as options on the service generators at scaffold time (e.g. `go-microservice --capabilities=llm:anthropic,store:postgres`), and (b) as a standalone `add-capability` generator to bolt a port+provider onto an existing service on Day 2 / inside a bet. *(See O6.)* *Accept:* both entry points share one injector; idempotent re-runs don't duplicate ports; provenance recorded.

**F5 — LLM reference family.**
Ship `capabilities/llm/` with providers `anthropic` (default), `openai`, `local` (runner footprint, points at a local endpoint), and `none`. Per supported stack (start with the stacks the engineer skills cover): adapter template, env contract, and a port-conformance test. Default is `anthropic` per GroundWork's AI-native house stance; the choice is still open to the user. *Accept:* each provider generates a compiling adapter (or red gateway for `none`) wired behind one `LLMPort`; switching providers swaps only the adapter, not the port or its callers.

**F6 — Engineer-skill alignment.**
The emitted ports/adapters/wiring must match the hexagonal conventions in `groundwork-go-engineer` / `-python-engineer` / `-nextjs-engineer`. Add a reference (e.g. a `capability-ports` doc) so those skills recognise the scaffold shape and so a hand-written adapter matches the generated one. *Accept:* a generated adapter passes the engineer skill's own review checklist; a reference describes the port/adapter/footprint contract.

**F7 — Architecture declares capabilities (new cross-phase contract).**
`groundwork-architecture` (greenfield) and `groundwork-architecture-extract` (brownfield) gain a first-class **Capabilities & Providers** section in `architecture.md` with a machine twin (`.groundwork/config/capabilities.json` or similar): for each capability, the chosen provider and rationale (including "raw gateway — to be built as a bet"). This is what the scaffold reads to compose infra + runners + ports. Register it in the contributor guide's Cross-Phase Contracts table (written by architecture, read by scaffold + bet). *Accept:* the architecture skill captures capability→provider choices; the scaffold consumes them; the contracts table lists the chain.

**F8 — Scaffold reconciliation extends (folds into WS-D).**
WS-D's reconciliation now also verifies: every declared capability has a provider; every provider's footprint is materialized (env documented in `infrastructure.md`, compose service present, or runner registered); every `none` gateway has a red contract test and (if enabled) a seeded bet. *Accept:* a scaffold with one `none` capability and one `anthropic` capability ends with one red gateway test, one env var documented, zero stray infra.

**F9 — Tests, provenance, migration.**
Generation tests per footprint kind (env/compose/runner/none). The capability registry is generator-produced → provenance-recorded so `update` reconciles it. Adding the capability framework to an existing install is additive (new generator + `add-capability`); no forced rewrite of existing services. *Accept:* `./dev test generation` covers the footprint matrix; migration-coverage gate green.

---

## 7. Decisions

### Settled
- **Decouple management from compose via a runner registry in `dev.config.json`.** (User chose "Full: runner registry + honest infra", 2026-06-16.) Rationale: the only fix that lets `./dev` manage desktop/CLI/local-first apps; everything else just hides the symptom.
- **Build the capability-port/provider framework generically, LLM as the first worked family.** (User chose "General port framework, LLM as reference", 2026-06-16.) Rationale: satisfies the Sandbox Problem rule — fix the scaffold for every app, not for the LLM case; the abstraction is the deliverable, LLM is the proof.
- **Infrastructure is a consequence of providers, not a default** — db/jaeger become provider footprints (F2), generalising WS-A.
- **Default shipped LLM provider is Anthropic/Claude** (house AI-native stance), framework still offers `openai`/`local`/`none`. Reversible; the user's "OpenAI" was an example of the *choice*, not a request for the default.
- **db + jaeger become on-demand**, mirroring the existing redis/pubsub injection pattern — not a new mechanism, the correct application of the one already there.
- **Generators self-register runners; the scaffold skill reconciles.** Resolves the a-vs-b fork: mechanical correctness by construction, architecture-specific judgment in the skill.

### Open (resolve during execution)
- **O1 — Empty compose: delete the file, or keep a commented empty one?** (WS-A2.) Deleting is cleanest but `getComposeServices()` must already degrade gracefully (it does → `null`). Lean: delete in the scaffold reconciliation step; keep the network-only file out of the generator default. Confirm no command assumes the file exists beyond the graceful path.
- **O2 — `python-microservice` native-vs-container option.** Name/default (`--native`? `--runtime=native|container`?). Default stays container; native is opt-in driven by the architecture decision. Confirm against how the scaffold skill currently invokes the generator.
- **O3 — `cli-app` runner `autostart`.** A CLI isn't a long-lived "start" target. Lean `autostart:false` (registered, listed in status as "not a service", runnable via its own target) — confirm against how cli-app is meant to be exercised.
- **O4 — Health checks for runners (`health` field).** Ship the field but defer enforcement (no readiness gating in `start` v1) unless cheap. Surfaces/sidecars rarely need a compose-style healthcheck on day one.
- **O5 — Should app-service native boot (Phase B) be folded into the runner registry too?** Long-term the marker-detection path (`bootCommand`) is a special case of a runner. Out of scope for v1 (keep Phase B as-is) but note the convergence so we don't entrench two systems.
- **O6 — Capability manifest shape + generator surface (F1, F4).** Where the registry lives (`src/generators/capabilities/<cap>/capability.json` + `providers/<p>/footprint.json` is the lean proposal) and whether the entry points are service-generator options, a standalone `add-capability` generator, or both (lean: both, one shared injector). Confirm against how `scaffold-designer` expects new generators to be structured.
- **O7 — Runtime provider selection.** Generate one chosen adapter + stub and switch via env (simplest), or generate multiple adapters selectable at runtime? Lean: one adapter + stub, env-switchable to the stub/mock for tests — multi-adapter only if a capability genuinely needs runtime switching.
- **O8 — Does a `none` raw gateway auto-seed a bet pitch (F3)?** It would make the gateway flow straight into delivery, but auto-creating bets during scaffold may be surprising. Lean: emit the port + red test + wiring always; offer the seeded bet as a scaffold-skill prompt, not an automatic write.
- **O9 — Which stacks get LLM adapters first (F5)?** Start with the stacks the engineer skills already cover (Go, Python, Next.js); defer surface-only stacks (Flutter/Electron call a backend port rather than embedding an LLM adapter — confirm per architecture).

---

## 8. Sequencing & gates

Conceptually providers (WS-F) drive everything; in execution, build the substrate first so each provider footprint plugs into machinery that already works.

1. **WS-A** (honest infra) + **WS-B** (runner registry) — the substrate. Independent of each other, parallelizable. B6 (rebuild bundle) closes both.
2. **WS-C** (generators self-register runners) depends on B + C5 (the helper).
3. **WS-F core** (F1 manifest, F2 footprint bridge, F3 `none` mode, F4 injector) depends on A + B + C5 — the footprint mechanisms must exist. F2 reframes WS-A's db/jaeger injectors as provider footprints, so do A1 in a way that exposes reusable injectors.
4. **WS-F LLM family** (F5) + **engineer-skill alignment** (F6) on top of F core.
5. **WS-F7** (architecture declares capabilities) can proceed in parallel with F core — it's a skill+contract change — but the scaffold can't consume capabilities until F7 lands.
6. **WS-D** (scaffold reconciliation, incl. F8) depends on A + C + F — there must be infra, runners, and capabilities to reconcile.
7. **WS-E + F9** (upgrade + tests) last as a bundle, but per-WS acceptance tests are written alongside each WS, not deferred.

**Done means:**
- *Runtime honesty (A/B):* a desktop-only scaffold ends with no stray db/jaeger, the Electron app + any native sidecar registered as runners; `./dev start` launches them and reports PIDs, `status` lists them, `stop` kills them; an empty workspace's `start` prints an honest "nothing registered" notice, not a fake success.
- *Composability (F):* `--capability=llm --provider=anthropic` yields a port + adapter + env var + green contract test and no infra; `--provider=none` yields a port + stub + red contract test and nothing else; a compose-footprint provider injects its service; a runner-footprint provider registers a runner; `architecture.md`'s Capabilities & Providers section is what drove all of it; `infrastructure.md` describes exactly the resulting stack.
- *Regression + upgrade:* a server scaffold is unchanged; `./dev test generation && ./dev test contracts` green; an existing install upgrades without losing or silently rewriting its stack or runners.
