# Surface Stack Selection

GroundWork standardizes one stack per surface platform. The pick is principled, not ad hoc: three axes, in priority order, decide it.

## The three axes

1. **Training-set fluency.** The model's prior — how much working code in this stack the agent has absorbed. An agent fluent in a stack writes idiomatic code on the first pass, recognises its failure modes, and needs thinner principles to stay on pattern. A technically superior stack with a thin corpus costs more per slice than a good-enough stack the agent already speaks.

2. **The agent-closable loop.** Can the agent run generate → boot → test → observe end-to-end, without a human driving an IDE, a device, or a signing dialog? GroundWork's test-driven delivery methodology lives or dies on this axis: a milestone the agent cannot demonstrate autonomously is a milestone a human must babysit, and the delivery loop stalls on every one. A stack whose canonical test harness runs headless in CI beats a stack whose tests need a window and a hand.

3. **The platform capability ceiling.** What UX the stack can reach — counting native escape hatches. The ceiling is measured *with* platform channels, native modules, and FFI, because AI labor makes those hatches nearly free: dropping to Swift, Kotlin, or C++ for one capability is no longer a team-skills decision, it is a slice.

## The era shift

Write-once portability is demoted as a selection criterion. Its historical weight came from the cost of maintaining N platform-specific codebases — a cost AI labor has collapsed. What portability still buys (one design system projection, one set of contracts consumed) GroundWork gets from the capability core instead: the core is written once and proven headless; only the thin surface adapters are per-platform. Pick the stack that maximises agent fluency and loop closure on its platform, not the one that promises to run everywhere.

## The standard picks

| Platform | Stack | The deciding axis |
|---|---|---|
| web | Next.js (React, TypeScript) | Deepest corpus of any UI stack; Playwright closes the loop headlessly. |
| mobile | Flutter | The most mature first-party test harness in mobile (`flutter test` widget tests + `integration_test` on a headless Android emulator) closes the loop in CI; a single strong corpus; platform channels reach the native ceiling. Chosen over Expo/React Native despite the TypeScript-coherence cost — that cost is deliberate and recorded. |
| desktop | Electron | Playwright drives Electron natively — the strongest agent-closable loop of any desktop option — and the renderer reuses the web stack and brand-token projection wholesale. Flutter-desktop was considered and declined: the loop advantage and web-ecosystem maturity are decisive here. |
| terminal | `cli-app` (TypeScript, shared render layer) | Subprocess testing is the cheapest loop there is; the shared theme layer projects brand tokens for free. |
| agentic | MCP server | The protocol is the surface; contract tests are the loop. |

A new platform earns its standard pick by the same three axes, in the same order, recorded in a decisions table like this one. When two stacks tie on fluency and loop, the higher ceiling wins; when they tie on everything, the one that reuses more of the existing chain (tokens, test runner, engineer skills) wins.
