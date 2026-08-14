# Part 6: Two doors

Greenfield and brownfield enter the same system. Both end in the same place: a project with the Record, the Standards, the Loop, the Proof, and the two surfaces.

## Greenfield

**Intent.** One or two conversations produce four artifacts:

- the brief (the problem, the users, the falsifiable success signal)
- the architecture sketch (topology, stacks, boundaries)
- the capability manifest (what the product must do, with a probe for each row)
- the standards sheet, born from the sealed toolchain choices

Each artifact has an output contract: the sections it must fill. Each artifact also has a depth gate: a review that sends a thin artifact back until it is real.

Both the output contract and the depth gate are `dated`. They exist because unforced agents produce thin artifacts. They will die the day models stop doing that.

Conversation choreography is gone. The artifact shapes stay.

**The birth seal.** The agent proposes the current best toolchain and patterns. A fresh-context adversary reviews the proposal — the researcher must not grade its own research. Then the human seals it all in one sitting: toolchain, standards, manifest, and probe intents.

**The design system.** A product with a UI gets its design system before its screens ([standards.md](standards.md)), and it is born on the canvas ([loop.md](loop.md)): the owner explores type, color, and components rendered live, and seals a look they saw — never token strings on faith. The sealed system is pulled down and materialized as tokens and real components in code. That pull is the moment the repo becomes the origin; from then on the canvas consumes what the repo holds. Without sync, the owner can still design on the canvas and export into the repo by hand; with no canvas at all, the same exploration runs against locally rendered sheets. Either way the seal is granted on rendered treatment.

**The build.** Models build capability by capability against the manifest, through the same slice loop as feature work. Green-probed rows bulk-accept under the birth seal. Only red rows and the decisions the agent flags as needing a human reach you. Progress renders on the Map. The first feature lands the same day.

**What stays deterministic.** Only the spine: the dev CLI and the CI wiring.

The docs site leaves the spine. The tower renders every repo's committed docs. A public product docs site, where a product wants one, is product work — not part of the spine.

There are no golden reference repos and no per-stack templates.

What is pinned: the outcomes (the battery's probes must pass) and the sealed choices (held by ratchets). What floats: how the model builds it. That stays as current as the model itself, instead of aging inside a template.

The battery reaches every product the same way: through the dev CLI's standard sockets. These are the named commands every project exposes — `test`, `run`, `lint`, and kin — whatever tooling runs underneath them.

A stack that keeps failing its probes earns more pinned constraints. A maintained starter repo is the last resort.

The 10 generators retire only after the battery passes against at least one existing generator-built repo.

## Brownfield

**Day one — what needs no sockets.** These install immediately: the honesty and wiring scans, the dependency audit, the Queue, and a ratchet baseline snapshot.

The install also registers the project with the tower ([surfaces.md](surfaces.md)). That makes it appear in the portfolio view from the first minute.

The day-one baseline covers universal rules only. Per-project rules are baselined later, at the adoption seal. Even so, the next change made in that repo already cannot cheat on the universal rules.

Deletion tests join as soon as the `test` socket is mapped. They have to execute the suite, so they cannot start on day one.

**The repo adapter.** The dev CLI installs as an adapter. Its sockets map to the repo's existing commands. For example, `test` wraps whatever runs tests today.

An unmapped socket shows as a visible red row. It never silently passes.

Each probe starts running as soon as the socket it needs is mapped. Coverage grows command by command, instead of waiting for a full setup.

Mapping is a human approval, not a discovery. Repo-defined commands are untrusted until a human confirms each mapping. The dependency audit runs before the first repo command does.

**The adoption seal.** This is standards genesis without a birth. The agent extracts the conventions the code actually follows and proposes them as the initial standards. An adversary reviews them. The human seals them.

At the same moment, the blessed module is nominated: the cleanest existing instance of each pattern — not an aspiration.

**The manifest, extracted incrementally.** A brownfield system arrives with capabilities nobody wrote down. So the capability manifest is built the same way the docs are: every bet that touches an area adds that area's rows and probes.

Probe-coverage autonomy grows along with it. Early on, little is probe-covered, so the dial stays low. That is honest, not a flaw.

**Docs.** Docs are extracted incrementally, as the system is touched, in the standard shape, with citations required. This is never a big-bang re-documentation project.

One safety rule applies: extraction reads the repo's existing code, comments, and docs, and that content is untrusted input. It can contain text that tries to steer an agent. So extraction only proposes — a human approves before anything executes or lands.

## Autonomy and the security floor — both doors

Unattended eligibility follows the dial's coverage cap ([loop.md](loop.md)). What matters is probe coverage of the touched area, not the task label. Unattended runs require:

- An enforced permission model, not a stated one. A rule that lives only in prose gets ignored — this spec itself teaches that lesson.
- The model is a path allowlist, pinned push remotes, a scoped credential, and a ban on new remotes. All of this is set as host configuration. `verify` checks it before granting unattended eligibility.
- Dependency-provenance checks on proposed toolchains: the typosquat defense for packages proposed fresh at birth.
- Secrets scanning.
- The standing rule that extraction and archaeology propose, never execute.
