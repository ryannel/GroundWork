# Implementation Plan: Visual Verification Loop (Render Correctness → Coherence → Fidelity)

**Status:** PARTIALLY EXECUTED 2026-06-20, then **REFRAMED 2026-06-21** by the High-End Micro-Polish System work. The deterministic floor (render-smoke, a11y, geometry, token-lint, component render tests, visual-regression) and the durable references stand. Two things changed: the **vision-grading Tier-3 `visual-fidelity` review was removed** — a static-screenshot vision grade is a weak craft signal, blind to motion and state — and replaced by a deterministic `test_token_conformance.py` plus a designer **spec-conformance** judgement at delivery; and the craft bar moved **upstream** into a per-app token system (atmosphere tokens projected into the app, a token-traceable per-surface micro-polish spec, and a convergent exemplar-*technique* research pass at design-settle). The history below is retained for rationale.

**Original status (2026-06-20):** PARTIALLY EXECUTED (proposed 2026-06-19). Origin: two related failure modes in bet delivery — (1) the agent never runs and looks at the UI it built, so behavioral tests pass while the rendered page is broken (blank, throwing, unstyled), and (2) when the UI does render, nothing grades it against the design system's intent or the reference apps it drew from. Both open decisions are now settled: **D2** — built the `groundwork-designer` persona (WS-E, done); **D3** — Tier-3 ships fail-closed-with-revise-cap, conditional on graphical-surface-touched.

**Executed 2026-06-20:** WS-A capture (render-smoke writes screenshots; bet-progress capture guidance) · WS-B3 render-smoke gate (`system-test-runner` emits `test_render_smoke.py`, viewport × theme matrix, generation tests assert it compiles) · WS-B4 a11y gate (pre-existing) · WS-C delivery agent inspection (`04-delivery.md` milestone close) · WS-D durable Design References (`_foundation` Phase 6, `graphical-ui` track, `brand-tokens` `references`) · WS-D3 per-screen visual intent (`02-design.md` Step 1.95) · WS-E designer persona (full canon + persona, separately recorded) · WS-F Tier-3 critique (`visual-fidelity` document_type + image-input review mode + `checklists/visual-fidelity.md`) · WS-G gates (`04-delivery` Tier 1+2, `05-validation` Step 2.6 fail-closed conditional) · §12 identifiers landed in the contributor guide's Cross-Phase Contracts table.

**Executed 2026-06-20 (second pass):** WS-B1 token-conformance lint (`eslint.config.mjs` `no-restricted-syntax` rules banning raw hex/length literals and Tailwind arbitrary values) · WS-B2 component render tests (`components/render-smoke.test.tsx` example + delivery practice) · WS-B5 layout/geometry gate (`test_layout_geometry.py`, no-horizontal-overflow-at-mobile) · WS-B6 visual regression (`test_visual_regression.py`, opt-in per D8, Pillow-based, baseline protocol documented) · WS-B7 route inventory (`tests/system/routes.json`, render-smoke + geometry + visual-regression sweep it) · WS-H generalize (`cli`/`agentic-protocol` tracks carry a Verification Gate section) · brownfield `design-system-extract` recovers the `## Design References` record. Generation (224) and contract (13) suites green; nextjs component test typechecks clean.

**Still owed:** only the **verification debt** in §11 — a live UI-heavy sim, seeded with a render bug and a coherence defect, proving the ladder bites end-to-end with Playwright booted (the owner is running this). Separately: a pre-existing, unrelated `tsc` failure in the Clerk provider (`components/providers/production.tsx` — `baseTheme` vs `Appearance<Theme>`) fails the `auth=clerk` compilation vectors; it predates this work and needs a Clerk-version fix of its own.
**Audience:** An engineer or agent implementing this change. Each slice names its files and an acceptance check; judgment calls are listed as open decisions in §10.
**Scope owner:** `groundwork-bet` skill (delivery + validation workflows), the `system-test-runner` generator (capture + smoke tests), a new `groundwork-designer` discipline-expert persona, the `groundwork-review` machinery (Protocols 8/9), and `groundwork-design-system` (durable references).

---

## 0. Read this first — the mental model

GroundWork's design system is one of its strongest artifacts — the `graphical-ui` track enforces a brutal "deep vs shallow" standard (OKLCH palettes, multi-layer shadow stacks, easing curves). The specification is excellent. The failure is **everything downstream of it is blind to the running application.** The delivery loop proves business logic and asserts DOM selectors, but no step ever **boots the app and looks at it.**

That blindness fails on a ladder of three tiers. Each tier catches a class of bug the tier below cannot:

> **Tier 1 — Does it render and work?** A behavioral test asserting `getByTestId('submit')` exists passes while the page is a blank white screen, throwing a hydration error, unstyled because the CSS 404'd, or showing an error-boundary fallback. The selector is present; the page is broken. This entire class is invisible to assertion-based tests, and it is where the missed bugs live.
>
> **Tier 2 — Does it look coherent?** Even when it renders, nothing confirms the layout isn't overlapping, cut off, blank above the fold, or mis-aligned. The agent has **never seen what it built** — the workflow never tells it to look, and Claude is multimodal, so the capability is there and simply unused.
>
> **Tier 3 — Is it excellent?** Token-conformance is checked (`groundwork-nextjs-engineer`: no hardcoded colors/spacing/fonts), but *composition* — hierarchy, rhythm, density, polish — is never graded against the design system's committed intent or the market-leading apps it drew from. And the North Star itself evaporates: the inspiration library is cache-only, deleted on design-system commit (`tracks/graphical-ui.md` Phase 6), so by delivery there is nothing durable to compare against.

**The organizing idea:** the delivery loop gains a verification ladder against the *running* app — **works → coherent → excellent.** One screenshot-capture substrate feeds all three: a deterministic smoke gate (Tier 1) catches correctness bugs cheaply and fail-closed; the agent reading those same screenshots (Tier 2) catches broken rendering; a multimodal critique against intent + live-researched references (Tier 3) catches polish gaps. Tiers 1–2 are the priority — they catch the bugs being shipped today; Tier 3 is the quality layer on top.

The plan also exploits an organizational fact: the contributor guide names `groundwork-designer` as **planned**, the discipline-expert that "owns usability" (architect owns feasibility, product owns value + viability). The Tier-3 judgment is exactly its territory.

**Authoring standard.** Every skill-file change this plan lands conforms to the skill-writer standard. The new delivery and validation steps state intent and the reasoning dimensions, never a verbatim checklist the agent recites; each gate explains why it exists; the fidelity rubric carries a shallow-vs-deep example so the critic calibrates against the example, not the adjective; and every new shared identifier names its writers and readers in the same change (§12), because a consumer reading a drifted identifier finds nothing with no error.

---

## 1. Findings this plan responds to

| ID | Finding | Severity | Tier |
|---|---|---|---|
| V1 | Delivery never boots and looks at the UI; behavioral selector tests pass while the rendered page is broken (blank / throwing / unstyled / error-boundary) | **Critical — shipping bugs today** | 1 |
| V2 | No render-smoke assertions: console errors, uncaught exceptions, failed asset/API requests, and blank-render are never checked (`templates/bet-progress-test.md` scopes interface tests to "wiring, rendering, and interaction" via DOM only) | High | 1 |
| V3 | The agent never visually inspects what it built; no workflow step instructs it to view a screenshot before closing a surface milestone (`workflows/04-delivery.md`) | High | 2 |
| V4 | Interface tests capture no screenshots; Playwright `page` fixture drives navigation only | High | 1/2/3 |
| V5 | Realization is never graded for craft — token-conformance is the only visual gate (`groundwork-nextjs-engineer` Safety Gates) | Medium | 3 |
| V6 | Inspiration library + aesthetic bar are cache-only, deleted on design-system commit; no durable record of *which* references or *what* was admired | Medium — prereq for Tier 3 | 3 |
| V7 | Per-bet surface design carries no concrete per-screen visual intent to critique against (`workflows/02-design.md`) | Medium | 3 |
| V8 | Validation has no visual QA step; Step 5 *updates* `docs/design-system.md` but never checks the UI against it (`workflows/05-validation.md`) | High | 1/2/3 |
| V9 | `groundwork-designer` persona (usability owner) is planned but unbuilt; visual-craft judgment has no home | Medium | 3 |
| V10 | Concept must generalize: `cli` and `agentic-protocol` surfaces also have a "run it and observe the output" gap; a graphical-only fix violates the "fix for every product" rule | Medium | all |
| V11 | "Do not hardcode colors/spacing/fonts" is a `groundwork-nextjs-engineer` review heuristic, not an automated lint gate — token drift ships silently | Medium | 1 |
| V12 | No component-level render tests; a component that throws on a prop/state combo surfaces only when a page integrates it | High | 1 |
| V13 | WCAG 2.1 AA is committed in the design system but never enforced by an automated accessibility test | High | 1 |
| V14 | No layout/geometry coverage; responsive breakage (horizontal overflow, clipped text) ships unseen | Medium | 1 |
| V15 | No visual regression coverage; unintended visual changes to existing screens ship with no signal | Medium | 1 |
| V16 | Dual-theme and breakpoints are committed but tests run neither a theme nor a viewport matrix — dark-mode and mobile breakage is uncovered | High | 1 |

**Strengths the plan must not regress:** the design system's deep-spec standard; the cache-deleted-on-commit discipline (this plan persists a *new, small* durable artifact, not the whole cache); the fail-closed Protocol 8/9 review machinery; the surface-registry / interface-type abstraction; the conditional-on-surface test economy (backend bets must pay nothing).

---

## 2. Workstream A — Capture substrate: screenshot the running app (V4)

The foundation all three tiers consume. One mechanism, reused.

**A1 — Interface tests screenshot key states.**
`templates/bet-progress-test.md` + the `system-test-runner` generator's test scaffolding: for `graphical-ui` surface milestones, the Playwright `page` fixture captures a screenshot of each key state of the screen under test — default, hover, focus, empty, loading, error — written to a known artifact path (e.g. `.groundwork/cache/visual/<bet-slug>/<surface>/<state>.png`). These states are where "looks unfinished" and "renders broken" both live. *Accept:* a graphical interface test run produces the screenshot set at the artifact path; capture is skipped cleanly for `cli`/`agentic-protocol` surfaces.

**A2 — Honest scope boundary.**
Document that static capture verifies *render correctness, coherence, and composition* only. Motion (easing, durations, press physics) and perceived latency (<50ms) — both heavily committed in the design system — remain behavior-tested, not screenshot-tested; a later video/trace stretch is noted out of scope, not silently implied as covered. *Accept:* the template states what the capture does and does not see.

---

## 3. Workstream B — Tier 1: automated render + visual coverage (the test pyramid) — **ship first**

Tier 1 is not one test — it is a generated, **permanent** coverage pyramid that runs in CI with no agent in the loop. It is the highest-leverage workstream: it catches the bug class being shipped today and prevents its regression forever. Its throughline is the design system itself: **the design system's commitments become test configuration** — WCAG AA → the axe threshold; dual-theme → the theme matrix; breakpoints → the viewport matrix; tokens → the conformance lint; the named states (empty/loading/error) → required component states. A rigorous spec already exists; this workstream turns its promises into gates instead of hoping they are honored.

All layers are permanent best-practice tests generated by the `nextjs-app` + `system-test-runner` generators. The bet adds coverage for its own new routes and components during Delivery; Validation confirms green and archives only the bet-progress proof-of-work — the same promotion shape as contract specs (`workflows/05-validation.md` Step 2.5).

**B1 — Token-conformance lint (V11).**
A stylelint/eslint rule banning raw color/spacing/font-size literals outside the token definition layer, projected from `brand-tokens.json`. This converts the `groundwork-nextjs-engineer` "do not hardcode colors/spacing/fonts" *review heuristic* into a deterministic CI gate. *Accept:* a hardcoded `#3b82f6` or `12px` in a component fails lint; token references pass.

**B2 — Component render tests (V12).**
Every component renders without throwing across its prop permutations and the states the design system names — default, loading, empty, error, long-content. Testing Library mount assertions, or Storybook stories with a test-runner so the stories double as a catalog the agent (Tier 2) and the critic (Tier 3) can also view. *Accept:* a component that throws on an empty-data prop, or has no empty/error state, is caught in isolation before any page integrates it.

**B3 — Render-smoke gate (V1, V2).**
The `system-test-runner` ships a render-smoke module for `graphical-ui` surfaces, parameterized over the route inventory (B7) **and the viewport × theme matrix**. For each route in each (viewport, theme), drive the booted app with the `page` fixture and assert the objective facts a broken page violates:
- navigation returns 2xx/3xx, never 4xx/5xx
- **zero `error`-level console messages** (`page.on("console")`) and **zero uncaught page exceptions** (`page.on("pageerror")`) — an allowlist for known-benign third-party noise is configurable, empty by default
- no failed same-origin asset/API requests (4xx/5xx on `page.on("response")`) — catches the unstyled-CSS-404 case
- the framework error overlay / app error-boundary fallback is **not** present
- the page rendered meaningful content — the app root has children, body text is non-empty, DOM node count clears a floor — catches the blank-screen (and dark-mode-invisible-text) case

On pass, the test writes the route's screenshots (the A1 set) so Tiers 2–3 can read them. *Accept:* injecting a runtime error, an asset 404, or a blank route into a scaffold sandbox turns the smoke test red; a healthy app stays green across both themes and all viewports.

**B4 — Accessibility gate (V13).**
An axe-core pass (`axe-playwright`) per route and per component story, with the threshold set to the design system's committed accessibility baseline (WCAG 2.1 AA by default). Catches contrast failures, missing labels/alt text, broken ARIA, and focus-trap defects — deterministically, and as enforcement of a stated commitment rather than a hope. *Accept:* a contrast-failing token pairing or an unlabeled control fails the gate; the threshold is read from the design system, not hardcoded.

**B5 — Layout/geometry assertions (V14).**
A *targeted handful* of deterministic invariants — no horizontal overflow at the mobile breakpoint (`scrollWidth <= clientWidth`), key landmark elements within the viewport, no clipped text on primary content (`scrollHeight` vs `clientHeight`). Kept deliberately small to avoid heuristic flakiness. *Accept:* a component that forces horizontal scroll on a phone width fails; ordinary responsive layouts pass.

**B6 — Visual regression (opt-in) (V15).**
Screenshot-baseline diffing per route/state/theme (Playwright `toHaveScreenshot()` or an external service), catching *unintended* visual change against a known-good baseline. Shipped **opt-in** per decision D8 because of its baseline-management and flakiness cost: when enabled, the generator pins fonts, disables animations, and masks dynamic regions, and documents the baseline-update protocol. Note its blind spot honestly: it does nothing for a screen's *first* render — that is what B2–B5 and Tier 2 cover. *Accept:* when enabled, an unintended color/layout shift in an existing screen fails CI; an intended change updates the baseline through the documented protocol.

**B7 — Route inventory.**
The route-driven layers (B3–B6) need the list of screens. Resolve it from the surface registry / app route manifest where one exists; otherwise the delivery agent declares the routes the bet touched, recorded alongside the bet-progress tests. A project-wide sweep over all known routes is the permanent suite; the bet-progress copy proves the bet's own screens. *Accept:* a new route added by a bet is covered without hand-editing a list where a manifest exists.

**B8 — Runs in the normal suite; gates delivery; promotes like contracts.**
Every layer is part of `./dev test bet <slug>` and the permanent suite — no special invocation. New permanent coverage written during Delivery for the bet's UI stays after the bet-progress suite archives, exactly as best-practice tests already do. *Accept:* `./dev test bet` executes the pyramid; any red layer blocks the milestone; the permanent layers survive bet archival.

---

## 4. Workstream C — Tier 2: the agent looks at what it built (V3)

The capability exists (Claude is multimodal); the workflow never invokes it.

**C1 — Delivery instructs the agent to view the screenshots.**
`workflows/04-delivery.md`: when a `graphical-ui` surface milestone goes green on behavior + smoke, the delivery agent **Reads the captured screenshots** (A1) and judges whether each screen renders as the design intended and is free of rendering defects, before the milestone closes. Author this step to the skill-writer standard: state the intent and the dimensions to reason over — rendering integrity, layout and alignment, image and asset fidelity, and whether each state (empty/loading/error) reads as designed rather than as a failure — and trust the agent to surface what is wrong. Do not enumerate a fixed checklist the agent recites; a scripted list both narrows what it looks for and repeats verbatim every session. *Accept:* delivery of a graphical surface produces a written visual-inspection note per screen naming what the agent observed; a milestone cannot close without it.

**C2 — Inspection findings loop back into delivery.**
A coherence defect the agent spots is fixed in the same delivery phase (cheaper than any later gate). Findings genuinely deferred are logged as discovery-notes / follow-up, never silently dropped. *Accept:* the workflow states the fix-now-or-log-explicitly rule.

---

## 5. Workstream D — Persist the visual North Star (V6, V7) — prereq for Tier 3

A craft comparison needs a durable target. Per decision D1, we do **not** store reference *images* (they go stale, many are auth-walled) — we durably record *which* references and *what specifically we admire*, and the reviewer fetches current imagery live at review time.

**D1 — Design system commits a durable reference record.**
`tracks/_foundation.md` Phase 6 + `tracks/graphical-ui.md` Commit Contributions: write a `## Design References` section into `docs/design-system.md` carrying, per reference product: its name, the specific qualities admired ("Linear's command-palette density and backdrop blur; its restraint with color"), and the design challenge it answers. The Phase 2 inspiration library distilled to its durable essence — not the whole cache. *Accept:* a greenfield run produces a non-empty record naming ≥3 products with admired-qualities prose; `groundwork-design-system-extract` recovers the same shape best-effort.

**D2 — Brand tokens carry the reference list.**
`templates/brand-tokens.md`: add an optional `references` array (name + admired-qualities string) to the `visual` block so the set is machine-readable for the Tier-3 reviewer. *Accept:* `brand-tokens.json` schema updated; contract test covers the new optional field.

**D3 — Bets state per-surface visual intent.**
`workflows/02-design.md` Surface Design: each bet touching a `graphical-ui` surface states the intended look/feel per screen ("dense data table in the Linear mold; primary action top-right; empty state must feel inviting, not broken") — the per-screen critique target, not a re-derivation of the design system. *Accept:* the technical-design checklist requires visual intent for every new/changed graphical surface.

---

## 6. Workstream E — Build the `groundwork-designer` persona (V9)

Per decision D2 (proposed). Tier-3 judgment needs an owner; the planned designer is the correct home. Build it on the discipline-expert anatomy (`SKILL.md` + `sync-anchor.md` + self-contained `references/`), mirroring `groundwork-architect`/`groundwork-product`.

**E1 — Scaffold the persona.**
`src/hidden-skills/groundwork-designer/`: persona header + discipline spine; `references/` distilling the usability/visual-craft corpus (`src/docs/principles/quality/accessibility.md`, the design-system tracks' aesthetic standards, relevant `ai-native`/`foundations` principles) for the persona's decision-time lens. *Accept:* skill loads; `./dev test contracts` sync-anchor gate green.

**E2 — Wire adoption points.**
Adopted in-workflow (the established persona-in-a-workflow-route model): in `groundwork-design-system` (to author per-screen visual intent, D3) and in the Tier-3 review (WS-F). *Accept:* both workflows reference the persona at the right step.

**E3 — Update the contributor guide.**
`.agents/skills/groundwork-contributor/SKILL.md`: move `groundwork-designer` from "planned" to built; record it as the usability owner. *Accept:* the discipline-expert section names three built personas.

> If D2 resolves to "extend existing skills only," WS-E collapses into adding the review logic to `groundwork-bet` + `groundwork-nextjs-engineer` directly; the other workstreams are unaffected.

---

## 7. Workstream F — Tier 3: the fidelity critique (V5, V8)

A multimodal reviewer (Opus, image-capable) grades the captured screenshots for craft.

**F1 — The review subagent.**
A `groundwork-review` document type (`visual-fidelity`) / designer-owned brief. Inputs: the captured screenshots (WS-A), the design system intent (`docs/design-system.md` + per-screen intent from D3), and the durable reference record (D2). The reviewer **researches reference imagery live** — WebSearch/WebFetch for current grabs of the named market-leading apps (per D1: well-known leaders whose design language is abundantly and stably public) — then grades. *Accept:* the review runs on a captured set and emits structured findings.

**F2 — Dimension-based rubric, not similarity (decision D4).**
Grade *craft dimensions* — visual hierarchy, spacing rhythm and alignment, density, contrast and legibility, state completeness, polish — against the design system's own intent, with reference imagery as calibration for "what good looks like at this craft level." It explicitly does **not** score "looks like Linear"; a "make it resemble reference X" finding is itself a defect (off-brand, plagiaristic). *Accept:* the rubric enumerates the dimensions and carries the anti-mimicry guardrail; an on-brand-but-different fixture is not penalized for non-resemblance.

**F3 — Findings are actionable, calibrated to a quality bar.**
Each finding names screen, state, dimension, the gap against intent, and a concrete fix. The review brief carries a shallow-vs-deep finding example per the skill-writer quality-bar technique — a thin "spacing feels off" beside a deep "the card grid uses a 12px gutter where the spec's 8-pt rhythm calls for 16px, so the density reads cramped against the Linear-class restraint the design references" — so the critic calibrates against the example, not the adjective. *Accept:* findings carry screen + state + dimension + fix; the brief shows the shallow/deep contrast.

---

## 8. Workstream G — Wire the gates into the lifecycle (V8)

Per decision D3 (proposed: fail-closed, conditional, revise cap — mirroring Protocol 8/9).

**G1 — Delivery-time loop.**
`workflows/04-delivery.md`: a graphical surface milestone closes only after Tier 1 (the coverage pyramid green, WS-B) and Tier 2 (agent inspection, WS-C); the Tier-3 critique (WS-F) runs here too so the agent iterates on craft before "done." *Accept:* delivery of a graphical surface runs all applicable tiers; critical findings addressed in-phase.

**G2 — Validation confirmation gate.**
`workflows/05-validation.md`: after Step 2 (test suite), for bets that touched graphical surfaces, confirm the Tier 1 pyramid is green, the inspection happened, and the fidelity review passed. Fail-closed (Protocol 8): proceed only on parseable PASS; revise cap prevents infinite polish loops; advisory findings carry to the user. **Conditional:** skipped entirely when no graphical surface was touched — backend bets pay nothing. *Accept:* a graphical bet cannot reach `delivered` with a red Tier 1 layer or unresolved critical visual findings; a backend-only bet runs validation unchanged.

**G3 — Cost guard.**
Tier 1 is cheap and always runs for graphical surfaces; Tier 3 is multimodal + web research, so it is gated strictly on graphical-surface-touched and its run/skip is reported. *Accept:* validation output states which tiers ran and why.

---

## 9. Workstream H — Generalize across interface types (V10)

The concept is a **verification gate: observe the running artifact in its medium, against intent + reference.** Screenshots are `graphical-ui`; frame the mechanism per-track so the fix holds for every product.

**H1 — CLI.** The `cli` track already names reference tools (ripgrep, Terraform). Capture = terminal output; Tier 1 = command runs, exit code, no stderr crash; Tier 3 = output ergonomics graded against the CLI spec + reference-tool output. *Accept:* the gate concept documented for `cli`; build sequenced after graphical-ui.

**H2 — Agentic-protocol.** Capture = response payload; Tier 1 = request succeeds, response well-formed; Tier 3 = response shape/ergonomics vs spec + reference protocols. Lightest-touch, build deferred. *Accept:* the generic framing covers all three interface types; no track is silently graphical-only.

---

## 10. Decisions

**Settled:**

| ID | Decision | Rationale |
|---|---|---|
| D1 | Reference imagery is **researched live at review time**, not stored; we persist only the reference list + admired-qualities. | User steer (2026-06-19): references are market leaders whose design language is abundantly and stably public; live research sidesteps stale/auth-walled stored images. |
| D4 | Tier 3 grades **craft level, not mimicry**; dimension-based rubric against the design system's own intent, references as calibration only. | A similarity bar produces plagiarized, off-brand UIs. |
| D5 | All gates are **conditional on graphical-surface-touched**; backend bets pay nothing. | Cost discipline; mirrors the surface-conditional test economy. |
| D7 | Tier 1 is **deterministic and fail-closed**; no model judgment in the correctness pyramid. | Render correctness is objective; a flaky LLM gate on it would erode trust in the whole ladder. |
| D8 | Visual regression (B6) ships **opt-in**, not default-on; the rest of Tier 1 (B1–B5) is default-on. | Snapshot diffing carries real baseline-management and flakiness cost and only catches *changes*, not first renders; the deterministic layers carry the bug-catch value without that overhead. |
| D9 | Tier 1's thresholds are **read from the design system** (a11y baseline, themes, breakpoints, tokens), not hardcoded in the generator. | The spec is the source of truth; tests that restate its values drift from it silently. |

**Open:**

| ID | Question | Recommendation |
|---|---|---|
| D2 | Owner: build `groundwork-designer` now, or bolt review logic onto existing skills? | Build the persona — the planned usability owner, correct architectural home (WS-E). Veto collapses WS-E into edits to `groundwork-bet` + `groundwork-nextjs-engineer`. |
| D3 | Tier-3 teeth: fail-closed-with-revise-cap from day one, or advisory-first then harden? | Fail-closed conditional with revise cap — matches every GroundWork gate. Advisory-first is the fallback if the critique proves flaky in early sims. (Tier 1 is fail-closed regardless, per D7.) |
| D6 | Motion/latency: behavior-tested, or invest in video/trace capture? | Behavior-tested for now (A2); video/trace is a later stretch once static verification is proven. |

---

## 11. Sequencing and gates

**Order, by leverage and dependency:**
1. **WS-A (capture)** — the substrate everything consumes.
2. **WS-B (Tier 1 coverage pyramid)** — ship immediately after capture, deterministic layers first (token lint, component, smoke, a11y, geometry); visual regression last and opt-in. This catches the bugs going out today and locks them against regression.
3. **WS-C (Tier 2 inspection)** — the agent looks; cheap, high-value, no new infra.
4. **WS-D (persist references) + WS-E (designer persona)** — prereqs for Tier 3; parallelizable with the D2 decision.
5. **WS-F (Tier 3 critique)** → **WS-G (wire all gates)** — fidelity layer on top.
6. **WS-H (generalize)** — last.

Tiers 1–2 (WS-A/B/C) are independently shippable and deliver most of the bug-catch value without any of the Tier-3 machinery; do not block them on the persona or fidelity decisions.

**Done means:**
- A graphical bet ships permanent automated coverage (WS-B): token-conformance lint, component render tests across named states, a render-smoke gate (no console errors / exceptions / failed requests / error-boundary / blank render) run across the theme × viewport matrix, an axe accessibility gate at the design system's committed baseline, and a few layout invariants — with visual regression available opt-in. Injecting a runtime error, an asset 404, a contrast failure, or a mobile overflow into a sandbox turns the relevant layer red.
- The delivery agent reads screenshots of every screen it built and records a coherence verdict before the milestone closes (WS-C).
- A graphical bet states per-screen visual intent (WS-D), and the Tier-3 critique grades captured screenshots against intent + live-researched references with a dimension-based rubric (WS-F).
- The validation gate blocks a graphical bet on a red smoke or unresolved critical visual findings, and is skipped for backend bets (WS-G).
- The gate concept is documented for all three interface types (WS-H).
- A live simulation on a UI-heavy bet shows Tier 1 catching a real render bug and the agent's inspection catching a real coherence defect (verification, owed like every live-sim debt in the plan ledger).

**Verification debt:** the ladder is only credible once observed live. A UI-heavy greenfield sim with the gates active — deliberately seeded with a render bug and a coherence defect — is the acceptance evidence; seed it after WS-C lands.

---

## 12. Cross-phase identifiers this plan introduces

Each identifier below is written by one phase and read by others, often in a different session. Drift is silent — a consumer reading a drifted path or key finds nothing, with no error — so every writer and reader changes in lockstep, and each row lands in the contributor guide's Cross-Phase Contracts table in the same change.

| Identifier | Written by | Read by |
|---|---|---|
| Screenshot artifact path `.groundwork/cache/visual/<bet-slug>/<surface>/<state>.png` | A1 capture (`system-test-runner` interface tests) | Tier 2 inspection (delivery agent, C1); Tier 3 critic (F1) |
| `## Design References` section in `docs/design-system.md` + `references` array in the `visual` block of `brand-tokens.json` | design-system commit (D1, D2); design-system-extract | Tier 3 critic (F1, F2) |
| Per-screen visual intent in the bet's `technical-design.md` Surface Design | bet `02-design` (D3) | Tier 2 inspection (C1); Tier 3 critic (F1–F3); delivery |
| `visual-fidelity` review `document_type` | delivery + validation review invocation (G1, G2) | `groundwork-review` machinery / designer brief (F1) |
| Route inventory (route manifest or delivery-declared routes) | surface registry, or delivery agent (B7) | route-driven Tier 1 layers — smoke, a11y, geometry, visual regression (B3–B6) |
| Token-conformance lint config projected from `brand-tokens.json` | `nextjs-app` generator (B1) | CI lint; `groundwork-nextjs-engineer` (its hardcode heuristic now references the gate) |
