# Implementation Plan: De-Jargon the Architecture — Keep the Discipline, Drop the Label

**Status:** PROPOSED 2026-06-17. This is a **discovery-first** plan: Part A (§3) is the discovery campaign; its output populates the implementation skeleton in Part B (§4). No code or skill edits happen until discovery closes and the naming decisions in §5 are settled.
**Audience:** The agent/engineer running the discovery campaign, then executing the rename. Each discovery workstream names what it produces; each implementation workstream names the artifact it fills.
**Scope owner:** The engineering-principles corpus (`src/docs/principles/system-design/`), the architect + engineer skills (`groundwork-architect`, `groundwork-go-engineer`, `groundwork-python-engineer`, `groundwork-nextjs-engineer`), the scaffold generators (`src/generators/`), the architecture/scaffold methodology skills, and the migration registry.

---

## 0. Read this first — the mental model

**The thesis is right; the label has become a liability.** GroundWork's structural discipline — a pure domain core, dependencies that flow inward, capabilities expressed as interfaces, implementations swappable at the edge, the rule enforced in CI — is non-negotiable and stays exactly as rigorous. What changes is that we stop *naming* it after a specific 2005 framework. Hexagonal, onion, clean architecture, ports-and-adapters: these are four labels for one idea, and committing to one label buys us nothing while costing us two things:

> **Cost 1 — The label invites ritual.** "Hexagonal" comes with a folklore of layers, a vocabulary (`port`, `adapter`, `gateway`), and a tendency toward the "onion with ten rings" the principle itself warns against. We end up defending the metaphor instead of the discipline.
>
> **Cost 2 — The vocabulary fights the language.** We ship Go services with an `internal/core/gateway/` package (ports) and an `internal/provider/` package (adapters). No idiomatic Go codebase is laid out that way — Go defines interfaces where they are consumed and names implementation packages after the technology (`postgres`, `kafka`). The same mismatch exists in Python. We are imposing a cross-language metaphor on top of languages that already have idioms for exactly this, and the agents and engineers reading the output pay the translation tax.

**The reframe, in one line:** *Rely on abstractions, inject dependencies, keep the core pure, enforce the dependency direction — and express all of it in each language's own idiom, with no framework label attached.* Same discipline, named after what it does, written the way the language is written.

**The bar these two goals set, together.** A generated service must do two things at once, and neither is allowed to win at the other's expense:

1. **Uphold the discipline** — pure core, inward dependencies, interface-driven edges, enforced in CI.
2. **Be instantly familiar** — a seasoned Go (or Python, or TS) engineer who has *never seen GroundWork* should open the service and find the layout unsurprising, because it matches how that language is conventionally written elsewhere.

This is the explicit rejection of "the word reads fine in English, so keep it." `port`/`provider`/`gateway`/`adapter` as a code *structure* are a cross-language metaphor no single language's practitioners actually use; we replace them with what each language's community already reaches for. The discipline is constant across languages; its *expression* is native to each. The test for any naming choice is therefore not "is it clean?" but **"would a practitioner of this language, coming from another codebase, expect to see exactly this?"**

**The organizing idea for this plan:** the work is a *rename*, not a redesign — the structure stays, the words change. But "rename" undersells the hazard. The jargon is woven into a tight contract chain (capability registry → generator code → generated files → engineer skills → architecture template → machine twins → CI lint rules → tests → fixtures → migrations). A word changed in one link with the chain unfollowed leaves a silent break. **So the entire value of this plan is in the discovery: build the complete map first, then the execution is mechanical.**

### The one hazard that dominates everything: "provider" means two things

Before any inventory, internalize this — it is the single largest source of wrong edits:

| Sense | Examples | Fate |
|---|---|---|
| **Hexagonal adapter naming** — the package/dir/symbol that holds edge implementations | Go `internal/provider/`, Python `src/provider/`, `*Adapter` symbols, `*Gateway` port symbols | **RENAME** to language idiom |
| **Capability vendor choice** — *which implementation* satisfies a capability (a real, first-class GroundWork concept) | `llm` capability's `providers: [anthropic, openai, local, none]`; `capability-ports.json` `provider` field; `--llmProvider anthropic` | **KEEP** — this is domain vocabulary, not jargon |
| **Framework / platform "provider"** — unrelated borrowed term | Next.js React Context "providers", `auth` provider (Clerk) | **KEEP** — out of scope, do not touch |

Every occurrence of `provider`, `gateway`, and `adapter` must be classified into one of these three before it is touched. Discovery workstream **D2 exists solely to do this classification** and is the gate the rename hangs on.

---

## 1. Preliminary findings (from initial recon — discovery confirms and completes these)

IDs are referenced by discovery and implementation workstreams. Counts are from a first grep sweep (`*.md/.ts/.js/.json/.go/.py`, excluding `node_modules`); discovery makes them exhaustive and classified.

| ID | Finding | Where | Scale |
|---|---|---|---|
| F1 | A whole principle doc is built around the label, including its filename | `src/docs/principles/system-design/hexagonal-architecture.md` | 1 file, ~80 lines, plus the `index.md` link and every cross-reference |
| F2 | The architect persona's reference is titled and framed by the label | `src/hidden-skills/groundwork-architect/references/boundaries-and-hexagonal.md`; pinned by `sync-anchor.md` | 1 ref + sync anchor |
| F3 | Go scaffold puts ports in `internal/core/gateway/` and adapters in `internal/provider/` — non-idiomatic package names baked into directory layout, package decls, imports, and every consuming service | `src/generators/go-microservice/files/**` | ~13 template files + every importer |
| F4 | Python scaffold puts adapters in `src/provider/`; ports are Protocols in `src/core/domain/` with "gateway" in docstrings | `src/generators/python-microservice/files/**` | ~6 template files + docstrings + DI wiring |
| F5 | The capability system encodes the jargon as data: `capability.json` carries `portSymbol`/`adapterSymbol`, file paths under `core/gateway/` and `provider/`, and the module comment says "hexagonal". This is the contract that generates the symbols. | `src/generators/capabilities/**`, `src/generators/shared/capabilities.ts`, `src/generators/add-capability/` | capability.json per capability + shared TS + generator + schema |
| F6 | The architecture cross-phase contract is literally named "Capability **Ports** & **Providers**" with a JSON twin whose schema uses `provider`/`footprint`; the template explains it via "GroundWork preaches hexagonal architecture" | `src/hidden-skills/templates/capability-ports.md`, `groundwork-architecture/architecture-template.md`, `phases/03,05`, `groundwork-bet/workflows/02-design.md`, `.groundwork/capability-ports.json` schema | cross-phase contract — highest blast radius |
| F7 | Engineer-skill references describe and assert the hexagonal structure; `boundaries`/`architecture.md`/`go-services.md`/`ml-systems-ai-engineering.md` all carry it; mirrors in `.agents/skills/` must stay byte-identical (sync gate) | `src/hidden-skills/groundwork-{go,python}-engineer/**` + `.agents/skills/` mirrors | canon + mirror, sync-anchored |
| F8 | Scan/extract skills look for hexagonal structure in brownfield code | `groundwork-scan/references/digest-schema.md`, `templates/architecture-findings.md`, `groundwork-architecture-extract` | brownfield path |
| F9 | CI dependency-direction rules key off the package names (`depguard` in Go, `import-linter` in Python, ESLint in TS) — renaming packages breaks the rules that enforce the discipline | generator template configs (discovery to locate exact files) | enforcement layer — must move in lockstep with F3/F4 |
| F10 | Tests assert the file paths and symbols (`test_generation.py`, `test_compilation.py`, `test_contracts.py`, scaffold boot) | `tests/scaffolds/**`, `tests/cli/**` | test suite |
| F11 | Frozen install fixtures contain the old shapes; they are the **source state** for upgrade-path tests and must NOT be edited — the rename must instead ship a migration that transforms them | `tests/fixtures/installs/{pre-0.9,0.9-pre-surfaces,*-edited}/**` | do-not-touch; defines migration need |
| F12 | The change touches the shipped surface (principle doc = tier 2, generator output = tier 3, capability-ports.json shape possibly tier 4), so it requires migration registry entries + changelog `[migration]` lines + a version bump | `migrations/`, `CHANGELOG.md`, `package.json`, operating-contract version | release machinery |
| F13 | Other principle docs reference the label in passing (`evolutionary-architecture.md`, `surface-architecture.md`, `architecture-decisions.md`, `code-craft.md`, `product-risks.md`, `index.md`) and two prior plans mention it (`architecture-2026-refresh.md`, `dev-cli-native-runners.md` — plans are historical record, likely leave as-is) | `src/docs/principles/**`, `docs/plans/**` | prose cross-refs |

**What must NOT regress:** the dependency-inversion discipline itself; the CI-enforced inward-flow rule (F9); the `none` raw-gateway-as-a-bet mechanic (whatever we end up calling it); the capability *vendor-choice* concept (the legitimate "provider", F5/F6); the contract-grade machine-twin pattern; mirror byte-identity + sync-anchor gates; the upgrade path for existing installs.

---

## 2. Scope boundaries (what discovery treats as in vs out)

- **In:** the named principle and its persona reference (F1, F2); generated-code package/dir/symbol naming for Go and Python (F3, F4); the jargon embedded in capability data (F5); the *prose framing* everywhere (F6, F7, F8, F13); the CI rules, tests, and migrations that ride along (F9–F12).
- **In (decided — see D-SET-5):** the architecture-level contract is de-jargoned too. "Capability **Ports**" loses the hexagonal word in its human-facing framing; the legitimately-idiomatic vendor "provider" stays. The one residual question is purely mechanical, not vocabulary: whether the *machine identifiers* (the `capability-ports.json` filename and its JSON keys) are renamed in lockstep or held stable as opaque identifiers behind renamed human-facing words — a blast-radius call that D4's chain analysis settles, not a naming call.
- **Out:** Next.js React "providers" and `auth` provider naming (F-hazard table); third-party library names; the four prior plans' historical text; user's *already-generated* service code in the field (the migration touches GroundWork-owned artifacts and ships guidance, but does not rewrite a user's hand-evolved service — see D5/D-OPEN-3).

---

## 3. PART A — The Discovery Campaign (this is the deliverable to run first)

Discovery runs as parallel workstreams. Each emits a written artifact under `.groundwork/` or a section appended to this plan. **Discovery is read-only** — it produces the map and the decisions; it changes nothing. D1–D2 can run fully parallel (fan out with `Explore`/`general-purpose` subagents). D3 depends on D2's classification. D4–D6 depend on D1.

### D1 — Exhaustive terminology inventory
Produce the complete, deduplicated occurrence list. Method: grep the full tree (not just shipped `src/` — include `docs/`, `tests/`, `.agents/`, `migrations/`) for the label set (`hexagon*`, `ports and adapters`, `onion`, `clean architecture`) and the naming set (`gateway`, `provider`, `adapter`, `port`). Bucket every hit by **kind**, because kind determines edit strategy:

| Kind | Edit strategy |
|---|---|
| (a) principle-doc / skill prose | reword to the de-jargoned framing |
| (b) generated-code package / directory name | rename — language-idiom dependent (needs D3) |
| (c) generated-code symbol (interface/struct/class/var) | rename — language-idiom dependent (needs D3) |
| (d) comment / docstring | reword |
| (e) schema / option description text | reword |
| (f) cross-phase contract identifier (JSON keys, field values) | de-jargon the prose (D-SET-6); rename the machine keys only on D4's blast-radius call — high blast radius |
| (g) test assertion (path or symbol) | follows (b)/(c) |
| (h) frozen fixture (F11) | DO NOT EDIT — feeds migration scope (D5) |

*Output:* `inventory.md` — a table of every occurrence with file:line, the matched term, and its kind. This is the master checklist the implementation ticks off; "done" = every (a)–(g) row resolved, every (h) row covered by a migration.

### D2 — The "provider" disambiguation pass (the gate)
For every `provider`, `gateway`, `adapter` hit from D1, classify into the three senses from §0 (adapter-naming → rename; vendor-choice → keep; framework/React → keep). Where ambiguous, read the surrounding code. Pay special attention to the collisions: `capability.json` uses `provider` (vendor, keep) *and* generates code into a `provider/` package (rename); the Python `ComfyUIGateway` class is an *adapter* despite the name. *Output:* the kind-(b)/(c)/(f) rows of `inventory.md` annotated RENAME or KEEP, with a one-line reason on every KEEP so the rename pass can't second-guess it.

### D3 — Per-language idiom research → target naming scheme
The decision that everything mechanical keys off. For each stack — Go, Python, *and the framework layer* (FastAPI, Next.js App Router) — research the *current, trend-leading* (2026) community-standard way to express "interface owned by the core, implementation at the edge, injected." Researched against how the language's own community writes it today, **not** invented and not harmonized across stacks (per D-SET-7): Go's opinionated package conventions are authoritative for Go, FastAPI/Python packaging norms for Python, App Router structure for the frontend — even where that makes the three diverge in layout and vocabulary. Concretely answer, per stack: where do interfaces live, what are they called, where do implementations live, what are the packages/modules named, how is DI wired, and what does the CI dependency-rule config look like under the new names. Sketch the before/after directory tree for each scaffold. *Acceptance bar for the scheme (per D-SET-5):* for each language, the before/after tree must pass the familiarity test — *"would a practitioner of this language, arriving from an unrelated codebase, expect to see exactly this and find nothing surprising?"* Validate it the way the simulation harness validates skills: ideally a quick read by someone fluent in each language (or a fresh-context agent prompted as that practitioner) confirming the layout looks native, not framework-imposed. *Output:* `naming-scheme.md` — the proposed target conventions, which becomes **D-OPEN-1/2** for sign-off. (Seed expectation: Go → interfaces in the core/domain package where consumed, implementations in technology-named packages, no `gateway`/`provider` packages; Python → Protocols in the domain, implementations in named modules; TS/Next.js → already idiomatic, mostly prose.)

### D4 — The contract-chain dependency graph
Trace what *reads* each RENAME identifier, so nothing drifts. Start from `capability.json` `portSymbol`/`adapterSymbol` and the file paths, and follow: → `shared/capabilities.ts` → the generators that emit code → the generated file paths → engineer-skill references that describe the structure → the architecture template + `capability-ports.json` schema → scaffold Phase-1/Phase-4 reconciliation → CI lint configs (F9) → tests (F10). *Output:* `chain.md` — an ordered dependency list per renamed identifier, so the implementation can change a name and walk every reader in the same slice. This is the cross-phase-contract discipline the contributor guide mandates.

### D5 — Migration & upgrade-path surface
Determine exactly what shape changes for existing installs and what each tier needs (per the contributor guide's tier table): the principle-doc rename (tier-2 doc — hash-classified refresh/merge, plus an agent migration if the *filename* changes since that's a rename not a content edit); generator output (tier-3 — regenerate with recorded options); `capability-ports.json` schema (tier-4 if D4's call renames its keys per D-SET-6 — needs a shape migration). Define the **migration boundary**: GroundWork-owned artifacts get migrated; a user's already-scaffolded, hand-evolved service code is theirs — decide whether we ship an *agent* migration brief that offers to rename their packages or merely document the new convention going forward (D-OPEN-3). Confirm against the frozen fixtures (F11) which "from" states must be exercised. *Output:* `migration-plan.md` — the registry entries, changelog `[migration]` lines, version target, and fixture coverage needed.

### D6 — Test & enforcement-gate impact
Enumerate every test and CI rule that asserts the old paths/symbols (F9, F10) and the sync-anchor hashes that will change when F1/F2/F7 are reworded. Confirm the mirror-sync gate and `sync-anchor.md` SHA pins are updated in the same slice as the principle edit. *Output:* `test-impact.md` — the list of test files to update and gates to re-green, so the implementation knows its definition of done.

### D7 — Naming proposal & external sanity check
Propose the replacement for the principle's title/filename and the de-jargoned framing language, lightly checked against how current (2026) practitioners frame this without the framework label (e.g. "dependency inversion", "ports without the jargon", "core-and-edges"). *Output:* candidate names feeding **D-OPEN-1**.

**Discovery exit criteria:** `inventory.md` complete and fully classified; `naming-scheme.md`, `chain.md`, `migration-plan.md`, `test-impact.md` written; §5 open decisions D-OPEN-1..3 resolved with the user. Only then does Part B execute.

---

## 4. PART B — Implementation skeleton (discovery fills the file lists)

Sequenced so the discipline never goes un-enforced and the tree never sits broken. Each workstream's exact file list comes from D1/D4; acceptance checks come from D6.

- **WS-I0 — Land the naming decisions.** Record D-OPEN-1..3 outcomes in §5 as *settled*. Nothing downstream starts until these are fixed.
- **WS-I1 — Principle doc + persona reference (F1, F2, F13).** Rename/reword `hexagonal-architecture.md` and `boundaries-and-hexagonal.md`, fix `index.md` and every prose cross-ref (D1 kind-a), update `groundwork-architect/sync-anchor.md` SHAs. *Accept:* `./dev test contracts` sync gates green; no stale link to the old filename.
- **WS-I2 — Capability data + shared generator layer (F5).** Apply the D3 scheme to `capability.json` (`portSymbol`/`adapterSymbol`, file paths), `shared/capabilities.ts`, `add-capability` generator + schema. KEEP every vendor-`provider` per D2. *Accept:* `./dev test generation` green for capability combos.
- **WS-I3 — Go scaffold (F3) + Python scaffold (F4).** Rename packages/dirs/symbols per D3; move the CI dependency-rule config (F9) in the same slice; update every importer (from D4's chain). *Accept:* `./dev test generation` + `./dev test compilation` green; the dependency-direction rule still fails on an inward-flow violation (prove the guarantee survived the rename).
- **WS-I4 — Engineer-skill references + mirrors (F7).** Reword the structure descriptions in canon, re-sync the `.agents/` mirrors byte-for-byte, update sync anchors. *Accept:* mirror-sync + sync-anchor gates green.
- **WS-I5 — Architecture & scaffold methodology + the cross-phase contract (F6).** Reword the framing per D-SET-6; rename the machine keys only on D4's blast-radius call (then update the JSON twin, schema, and Phase-1/4 reconciliation together). *Accept:* architecture-template + scaffold phase docs consistent; capability-ports contract doc and schema agree.
- **WS-I6 — Brownfield scan/extract (F8).** Update what the scan looks for and how findings are templated. *Accept:* brownfield generation/contract tests green.
- **WS-I7 — Tests (F10).** Update assertions per D6. *Accept:* full fast-gate suite (`generation`, `contracts`, `cli`) green; a deliberate live `./dev test compilation` run on the renamed scaffolds.
- **WS-I8 — Migrations + release (F11, F12).** Author the registry entries and changelog `[migration]` lines from D5, exercise them against the frozen fixtures, bump the version, rebuild the dev bundle. *Accept:* migration-coverage gate + changelog↔registry cross-check green; fixture upgrade tests pass.
- **WS-I9 — Live verification.** Run a greenfield simulation through Architecture → Scaffold → first Bet on the renamed stack, and a brownfield run, to prove the de-jargoned vocabulary reads cleanly end-to-end and the agent still produces the right structure. *Accept:* `./dev sandbox review` checklist green; judge pass on a fresh session.

---

## 5. Decisions

### Settled
| ID | Decision | Rationale |
|---|---|---|
| D-SET-1 | The structural discipline (pure core, inward dependencies, interface-driven edges, CI-enforced direction) is unchanged. Only naming and framing change. | This is a rename, not a redesign — the thesis is sound; the label is the liability. |
| D-SET-2 | The capability *vendor-choice* "provider" concept is preserved verbatim (anthropic / postgres / clerk as the *implementation that satisfies a capability*). | It is **idiomatic**, not merely "fine English": every practitioner already expects "provider" for this concept (Terraform/cloud/OAuth providers). It passes the D-SET-5 familiarity test, so it stays — distinct from "provider"-the-adapter-package, which fails it and goes. |
| D-SET-5 | **Idiomatic-per-language is the supreme rule, above "it reads fine in English."** Every generated service must simultaneously (a) uphold the clean-architecture discipline and (b) be instantly familiar to a practitioner of that language arriving from another codebase. Where the two could pull apart, idiom is the tie-breaker, never a cross-language metaphor. (User decision, 2026-06-17.) | The services are read far more than the principle doc; their credibility is "does this look like real, native Go/Python/TS?" A familiar layout that also enforces the discipline beats a "clean" layout that announces a framework. |
| D-SET-7 | **The target for each stack is its own most idiomatic, modern, trend-leading structure — researched, not invented.** Each language *and framework* follows the prevailing best practice of *its own* community (Go's opinionated package conventions; Python/FastAPI packaging norms; Next.js App Router structure). Stacks may legitimately diverge in layout and vocabulary; cross-language uniformity is explicitly **not** a goal. Word choice is downstream of idiom: if `provider` is genuinely the idiomatic Go word it stays; if not, it goes — the deciding question is always "what does this language's community actually do today," never "what reads consistently across our stacks." (User decision, 2026-06-17.) | The whole value proposition is a service that looks native. A uniform GroundWork scheme imposed across languages is itself a framework fingerprint — the thing we are removing. |
| D-SET-6 | The architecture-level contract is de-jargoned too (resolves former D-OPEN-3): drop "hexagonal" and the `port` framing from its human-facing prose, keep the vendor "provider". Whether the machine identifiers (`capability-ports.json` filename + JSON keys) are renamed in lockstep or held stable behind the renamed prose is a blast-radius call deferred to D4, not a vocabulary call. | User steer (2026-06-17): port/provider aren't kept just because they parse in English. The cross-language *words* get de-jargoned; the *identifier-rename cost* is decided on engineering grounds once D4 maps the readers. |
| D-SET-3 | Frozen install fixtures (`tests/fixtures/installs/**`) are never hand-edited; the rename ships a migration that carries old installs forward. | They are the "from" state for upgrade tests (F11). |
| D-SET-4 | Discovery is read-only and completes before any edit. | The entire risk is an unfollowed contract-chain link; the map must exist first. |

### Open — resolve with the user before WS-I0
| ID | Question | Recommendation (seed) |
|---|---|---|
| D-OPEN-1 | New name + framing for the principle (and its filename). | Lead candidate: name it after the rule, not the shape — e.g. `dependency-direction.md` / "Dependencies Point Inward", keeping the four labels mentioned once as "you may know this as…". Final wording from D7. |
| D-OPEN-2 | The concrete per-stack target conventions (Go / Python / FastAPI / Next.js App Router). | From D3, decided by research into each community's current best practice (D-SET-7) — not a uniform scheme. *Hypotheses to confirm, not assumptions:* Go likely drops the `gateway`/`provider` packages for core-owned interfaces + technology-named implementation packages; Python likely keeps Protocols-in-domain but renames `src/provider/`; the frontend is likely already idiomatic. Research overrides any of these. |
| D-OPEN-3 | For users' already-scaffolded service code, do we ship an agent migration that offers to rename their packages, or only document the new convention for new code? | **Recommend document-only** for existing user code (their evolved code is theirs); migrate GroundWork-owned artifacts and new generation. Revisit if the field signal says otherwise. (Was D-OPEN-4; D-OPEN-3 resolved into D-SET-6.) |

---

## 6. Sequencing & gates

```
D1 ─┬─ D2 ─── D3 ──┐
    └─ D7 ──────────┤
D4, D5, D6 (after D1) ┘
        ↓
   §5 decisions resolved (D-OPEN-1..3)
        ↓
WS-I0 → I1 ─┐
        I2 ─┼─ I3 ─ I4 ─ I5 ─ I6 ─ I7 ─ I8 ─ I9
            ┘   (each slice keeps the tree green + the dependency rule enforced)
```

**Gate to start Part B:** discovery exit criteria (§3) met and §5 open decisions settled.
**Gate to call the plan EXECUTED:** all fast gates green (`./dev test generation && ./dev test contracts && ./dev test cli`), a live `./dev test compilation` on the renamed scaffolds, migration fixtures passing, and the WS-I9 live sims reviewed — with the dependency-direction rule proven to still fail on a violation, so the discipline is demonstrably intact under the new names.

**Update this Status header in the same commit that executes any slice** (the contributor-guide rule — headers have gone stale repeatedly).
