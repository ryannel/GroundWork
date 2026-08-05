# Part 6: Two doors

Greenfield and brownfield enter the same system. Both end in the same place: a project with the Record, the Standards, the Loop, the Proof, and the two surfaces.

## Greenfield

**Intent.** One or two conversations produce four artifacts: the brief (problem, users, the falsifiable success signal), the architecture sketch (topology, stacks, boundaries), the capability manifest (what the product must do, each row with its probe), and the standards sheet born from the sealed toolchain choices. Each artifact has an output contract — the sections it must fill — and a depth gate — a review that bounces a thin artifact back until it is real. Both are `dated`: they exist because unforced agents produce thin artifacts, and they die the day models stop doing that. Conversation choreography is gone. The artifact shapes stay.

**The birth seal.** The agent proposes the current best toolchain and patterns. A fresh-context adversary reviews the proposal. The researcher must not grade its own research. Then the human seals: toolchain, standards, manifest, and probe intents, in one sitting.

**The build.** Models build capability by capability against the manifest, through the same slice loop as feature work. Green-probed rows bulk-accept under the birth seal. Only red rows and the decisions the agent flags as needing a human reach you. Progress renders on the Map. First feature the same day.

**What stays deterministic.** The spine only: dev CLI and CI wiring. (The docs site leaves the spine — the tower renders every repo's committed docs, and a public product docs site, where a product wants one, is product work.) No golden reference repos. No per-stack templates. What is pinned: the outcomes (the battery's probes must pass) and the sealed choices (held by ratchets). What floats: how the model builds it — which stays as current as the model itself, instead of aging in a template. The battery reaches every product the same way, through the dev CLI's standard sockets: the named commands every project exposes (`test`, `run`, `lint`, and kin), whatever tooling runs underneath. A stack that keeps failing its probes earns more pinned constraints, with a maintained starter repo as the last resort. The 10 generators retire only after the battery passes against at least one existing generator-built repo.

## Brownfield

**Day one — what needs no sockets.** The honesty and wiring scans, deletion tests, the dependency audit, the Queue, and a ratchet baseline snapshot install immediately, and the install registers the project with the tower ([surfaces.md](surfaces.md)) so it appears in the portfolio view from the first minute. The next change made in that repo already cannot cheat at those.

**The adapter.** The dev CLI installs as an adapter: its sockets map to the repo's existing commands. For example, `test` wraps whatever runs tests today. An unmapped socket is a visible red row, not a silent pass. Each probe starts running as soon as the socket it needs is mapped — coverage grows command by command instead of waiting for a full setup.

**The adoption seal.** Standards genesis without a birth: the agent extracts the conventions the code actually follows and proposes them as the initial standards. An adversary reviews. The human seals. The blessed module is nominated at the same moment: the cleanest existing instance of each pattern, not an aspiration.

**The manifest, extracted incrementally.** A brownfield system arrives with capabilities nobody enumerated, so the capability manifest is built the way the docs are: every bet that touches an area adds that area's rows and probes. Probe-coverage autonomy grows with it — early on, little is probe-covered and the dial stays low. That is honest, not a flaw.

**Docs.** Extracted incrementally as the system is touched, in the standard shape, citations required. Never a big-bang re-documentation project. One safety rule: extraction reads the repo's existing code, comments, and docs, and that content is untrusted input — it can contain text that tries to steer an agent. So extraction only proposes; a human approves before anything executes or lands.

## Autonomy and the security floor — both doors

Unattended eligibility is computed from probe coverage of the touched area, not from the task label. Unattended runs require:

- A stated permission model for what the agent may touch.
- Dependency-provenance checks on proposed toolchains: the typosquat defense for packages proposed fresh at birth.
- Secrets scanning.
- The standing rule that extraction and archaeology propose, never execute.
