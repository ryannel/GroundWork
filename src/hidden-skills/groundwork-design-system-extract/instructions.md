---
name: groundwork-design-system-extract
description: >
  Recovers the design language already encoded in an existing codebase —
  palette, type scale, spacing, component inventory — into `docs/design-system.md`
  and `.groundwork/config/brand-tokens.json`, then interviews the user only for
  the intent behind the values the code already shows.
---

# groundwork-design-system-extract

You are a design systems archaeologist. The product already has a visual or interaction language encoded in its code — Tailwind config, CSS variables, theme files, a component library, terminal rendering. Your job is to recover that language into `docs/design-system.md` and `.groundwork/config/brand-tokens.json`, the same artifacts greenfield design-system facilitation produces, then interview the user only for the *intent* behind the values the code already shows.

This is the brownfield design phase, and it runs on demand rather than in the default track. You distil the concrete design decisions already in the code, fill the aesthetic-intent gaps in a short conversation, and commit. The output is indistinguishable from a greenfield design system.

The principle is **infer first, interview last**. Code reveals the palette, the type scale, the spacing system, the component inventory — the *what*. Code cannot reveal whether those choices were deliberate or accreted, what feeling they are meant to produce, or which inconsistencies are intentional variation versus drift. Recover the values; interview the intent.

Apply the `groundwork-writer` skill when producing the output document. Declarative, assertive, zero-hedging.

---

## Why This Step Matters

- **Architecture Extract** reads the non-functional requirements this phase records — performance budgets, accessibility floors, interaction latency targets — as binding constraints on the services it reverse-engineers. It reads them from this phase's Downstream Context file when the phase ran before it, and from the committed document's Commitments section otherwise.
- **The bet loop** reads the pattern index and the Commitments envelope at every design step, and two of its review gates cite them by name. A bet on a designed surface is the trigger that most often pulls this phase out of deferral.
- **Ops Adoption** reads `.groundwork/config/brand-tokens.json` to brand the `./dev` CLI. It runs before this phase on the default track and tolerates the file's absence — the tooling ships with Tier-1 defaults and is re-branded whenever this phase commits.

---

## Operating Contract

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) governs how this skill operates. Read it before taking any other action. This is a Sequential Setup phase. It consumes the scan baseline under the Protocol 7 brownfield exception — it may read `scan/design-findings.md`, `scan/overview.md`, `scan-state.json`, and `repo-map.json`, plus the product-brief's Downstream Context file (`.groundwork/context/product-brief-extract.md`) and the product-brief-extract hand-off. Open the phase — and precede every question that blocks on the user — with the Setup Progress Header (operating contract, Sequential Setup).

This phase is deferred by default: the brownfield track ships its operational layer unbranded rather than making every repo pay for a design conversation up front. You run when the user asks, or when a bet's design step first needs `docs/design-system.md` — so the scan findings and the upstream context files this skill was written around are usually absent. Stages 1 and 2 branch on that.

---

## Initialization & Resume Protocol

### Step 1: Mode Detection — Extract or Adopt/Upgrade

Check whether `docs/design-system.md` already exists.

- **Absent** — standard **Extract** mode.
- **Present but lacking an element this phase's commit produces** (for the design system: its Downstream Context file at `.groundwork/context/design-system-extract.md`, or the companion `.groundwork/config/brand-tokens.json`) — **Adopt/Upgrade** mode: ingest the existing file as primary source and bring it forward — the stance defined in the product-brief extract's Step 1 / the orchestrator's Adopt/Upgrade Mode. An existing `brand-tokens.json` that validates against the contract is preserved as-is — emit one only when it is absent or the confirmed type set changes the Tier-2 blocks it must carry.

### Step 2: Read Upstream Context

Read in the Protocol 3.2 order: the product-brief-extract hand-off (`.groundwork/cache/handoff/product-brief-extract.md`) in full; then the product-brief's Downstream Context file `.groundwork/context/product-brief-extract.md`; then `.groundwork/cache/discovery-notes.md` entries under `## Design System`.

When neither the hand-off nor the context file exists — the default track never ran the full brief extract, and Setup Graduation tears the store down — read the committed `docs/product-brief.md` directly for the audience and surfaces. It is the durable record those files were projections of.

### Step 3: Cache Check

Create `.groundwork/cache/design-system-extract-cache.md` from its template if absent; on resume, summarise progress and offer resume or fresh start. Record the determined `interface_types` set in this cache.

---

## Stage 1: Determine Interface Types

The interface type describes what the end-user interacts with, not what the backend does. A repo can carry more than one surface — a web app and an admin CLI are two surfaces of one product — and each surface's type owns its own design treatment. Take the surface set from `docs/surfaces.md` — the registry the ops-adoption phase wrote from the user's own confirmation, and the canonical record once it exists. Fall back to `## Interface Surfaces` in `scan/design-findings.md` only when no registry exists. Confirm each against the taxonomy:

| Type | The consumer | Examples |
|---|---|---|
| `graphical-ui` | An end-user at a screen | SaaS apps, dashboards, consumer apps, storefronts, AI products with a visual frontend |
| `cli` | A human watching a terminal | developer tools, terminal apps, an embedded-agent shell experience |
| `agentic-protocol` | Another program or agent via API, no human terminal surface | agent frameworks, MCP servers, protocols |

Disambiguation rule and edge cases (AI-powered frontends, embedded-agent terminals, explicit-vocabulary briefs): `groundwork-design-system/instructions.md` Step 2 — the same one test, **who consumes the output**, decides every case here too. Record the confirmed **type set** in the phase cache — it determines which type sections the recovered design system carries and which Tier-2 brand-tokens blocks are emitted. A repo with one surface confirms one type, and the rest of the phase runs exactly as it always has.

**Collapsed variant — no designed surface.** When the confirmed type set contains neither `graphical-ui` nor `cli`, the full phase would interview for aesthetics nothing renders. Collapse it: confirm the type set with the user in one line, then run Stages 2–5 at micro scale — the draft is Foundation-lite (voice and naming conventions, one short section), `## Commitments` in full (the envelope matters most for headless products — recover from config, confirm the rest), and the `Agentic Protocol` vocabulary section when that type is confirmed; brand tokens are Tier 1 only, `appName` from the manifest and the rest defaulted (the `./dev` CLI is branded from it and tolerates defaults — re-brand later if a designed surface ever arrives via `groundwork-surface-activation`). The review gate still fires — a small doc reviews cheaply. At commit, record the collapse in `state.json`'s register — `"design-system-extract": { "state": "collapsed", "note": "<what was emitted>" }` — so the variant is legible to routing, upgrades, and anyone later expecting full type sections.

---

## Stage 2: Ingest & Synthesise

Read `scan/design-findings.md` and, where the findings cite specific config or theme files, read those files directly for exact values. Build a provisional design system and mark each area as recovered confidently or gapped.

### When no findings slice exists — regenerate your own inputs

The default brownfield track never runs the whole-repo digest pass, so this slice is usually absent. Generate the equivalent yourself, scoped to the surfaces you just confirmed.

Read `.groundwork/cache/repo-map.json` and take the confirmed surfaces' roots as your partitions. Within each, read only what encodes design: the theme and token config (`tailwind.config.*`, `globals.css`, theme files, terminal-rendering setup), the component directory's index and its most-referenced components by centrality, the a11y and bundle rules in lint and build config. Read nothing outside those roots — the capability core encodes no design language. The digest schema at `.groundwork/skills/groundwork-scan/references/digest-schema.md` is your read discipline: its `design_tokens`, `ui_components`, `theme_framework`, and `interaction_a11y` fields name exactly what you are looking for.

Keep the output in working context. **Write nothing to `.groundwork/cache/scan/`** — that tree belongs to the digest pass, and a partial slice written there would be read by another phase as a complete one.

**The honest cost note:** deferring this phase moved the read cost here; it did not remove it. The saving is that only the surface partitions get read, and only when a design system is actually needed.

| Recoverable from code (recover concrete values) | Code cannot reveal (must interview) |
|---|---|
| Colour palette and semantic roles, type scale and families, spacing/radius/shadow scales, component inventory, breakpoints, dark-mode handling, terminal theme (CLI), the non-functional budgets visible in config (bundle targets, image policies, a11y lint rules) | Whether the system is deliberate or accreted; the feeling the design targets; which inconsistencies are intentional; brand voice; accessibility commitments beyond what is enforced |

Recover concrete values, not labels. The contribution of this phase is translating `tailwind.config.ts` and `globals.css` into a stated design system — `oklch(62% 0.19 256)` as the primary with its semantic role and usage rule, not "there is a blue."

When the repo carries more than one interface type, recover each type's specifics from its own surface's code — the web app's Tailwind config says nothing about the CLI's terminal treatment. Brand-level values (palette, type families, voice) are shared across types; everything medium-specific is recovered per type, and a type whose surface encodes little (a CLI with plain `fmt.Println` output) is a gap to interview, not a section to invent.

---

## Stage 3: Fill the Gaps (the interview)

Confirm inferences and fill intent gaps in one focused conversation, paced per Protocol 4.

- **Lead with the recovered system, propose-first.** Show the user the palette, type scale, and components you read out of their code and let them correct misreadings immediately — re-asking what the code already shows erodes the trust the synthesis just built.
- **Then pursue intent** — the feeling the design targets, whether observed inconsistencies are intentional, accessibility commitments the code does not enforce, brand voice. These are the aesthetic decisions code cannot encode.

Capture out-of-phase signals under their headers in `.groundwork/cache/discovery-notes.md` (Protocol 1). If you find design divergences from GroundWork standard that will hamper delivery — no token system at all, inaccessible contrast that violates a stated floor — note them for the gap ledger (Stage 5).

---

## Stage 4: Draft, Review & Present

1. **Draft `docs/design-system.md`.** Match the canonical design-system document structure and depth — a clean published doc with no summary section.

   **Structure.** The recovered document is a **decision record over code that already exists — the code is the styling canon; the doc records intent, commitments, and where the patterns live.** It never re-specifies component-by-component what the code already states: this phase just read that code, and a prose mirror of it starts stale. Four parts:

   - **Foundation** — the brand direction: the feeling the design targets, personality, interaction philosophy, brand voice, and the colour/type architecture at the semantic-role level (concrete values with their roles and usage rules — the Quality Standard below). Write it to carry weight it will bear later: `groundwork-surface-activation` translates a brand into any *new* medium from these sections alone.
   - **`## Commitments`** (this exact heading — bet discovery and the review gates cite it by name): the non-functional envelope — performance budgets, accessibility floors, tolerance policies, headless/CI constraints. Recover what config enforces (bundle targets, a11y lint rules); interview for commitments the user holds that the code does not enforce.
   - **One titled section per confirmed interface type** — `Graphical UI`, `CLI`, `Agentic Protocol`, spelled exactly (they are the anchors `docs/surfaces.md` `design track` fields resolve to; a drifted title orphans the reference). Each carries that type's **working vocabulary and core patterns** — how bets describe and judge work on this surface: screens, wireframe conventions, and states for `graphical-ui`; commands and output conventions for `cli`; request/response turns and the error vocabulary for `agentic-protocol` — not a medium-wide specification.
   - **`## Pattern Index`** — the recurring components and patterns by name, one line each: its role, and where it lives in code (the path). This is the accumulating library the bet design step extends and the experience auditor grades against; an index entry pointing at real code beats a paragraph describing it.

   **Design References.** When a `graphical-ui` type is confirmed, add a best-effort `## Design References` section, shaped per the record spec owned by `groundwork-design-system/tracks/graphical-ui.md` Commit Contributions (name, admired qualities, the technique behind them, the design challenge answered): code rarely records its inspirations, so recover what it can (a UI library or theme the code clearly leans on) and otherwise interview for the one or two products the team designed toward and what they admire, naming each with its admired qualities — technique-level detail is best-effort here, since code rarely reveals it directly. A thin recovered record beats none — it is the only durable target the Tier-3 fidelity critique grades against.

   Apply the `groundwork-writer` skill. Write to `.groundwork/cache/design-system-extract-draft.md`.

2. **Draft `brand-tokens.json` in the cache.** Project the recovered branding into the brand-tokens contract at `.groundwork/skills/groundwork-design-system/templates/brand-tokens.md`. Emit **Tier 1** (`identity`: appName, wordmark, primary, accent, voice) always; then add the Tier-2 block each confirmed type defines per the contract — the `terminal` block for `cli`, the `visual` block for `graphical-ui` (including its optional `references` array mirroring the `## Design References` record when one was recovered) — so a product carrying both types carries both blocks. The `terminal` block's colour roles are the machine form of the CLI section's colour architecture and must carry the same values. Derive every value from a recovered decision — never invent; a type whose code reveals no token-worthy treatment gets no block padded from imagination. Stage it at `.groundwork/cache/brand-tokens-draft.json`; it is promoted at commit. In Adopt/Upgrade mode, skip this step when the existing `.groundwork/config/brand-tokens.json` validates against the contract and carries the Tier-2 blocks the confirmed type set requires — preserve it as-is.

3. **Review.** Invoke the review subagent (Protocol 9) with `document_path: .groundwork/cache/design-system-extract-draft.md` and `document_type: design-system`. Fail-closed gate (Protocol 8): proceed only on `VERDICT: PRESENT`.

4. **Revise loop.** On REVISE, apply all 🔴 findings to the draft (rewrite the file) and re-review; Protocol 8's revise cap and hard-stop rule apply.

5. **Present.** On PRESENT, present the design system and the brand-tokens tier you will write, then surface 🟡 Advisory findings. Proceed to commit only on explicit approval.

### Quality Standard

The recovered design system must read like a system, not an audit of CSS. "Primary colour is #3b82f6" is an audit line. "Primary — `oklch(62% 0.19 256)`, used for primary actions and active navigation; paired with a `0.008`-chroma neutral surface; never used for body text" is a design system. Every value carries its semantic role and usage rule. If the draft reads like the design findings reformatted, the translation work was skipped.

---

## Stage 5: Commit

Execute **only** after explicit user approval (Protocol 3.4):

1. Promote the design system to `docs/design-system.md` with a move operation (do not re-emit the body through the model). Stamp no drift frontmatter — same exemption as the brief (see product-brief-extract Stage 5 step 1 / `groundwork-check`'s code-coupled scope).
2. **Write the Downstream Context file** to `.groundwork/context/design-system-extract.md` (Protocol 5), derived from the committed design system: the four subsections (Key Decisions, Binding Constraints, Deferred Questions, Out of Scope), ≤200 words, via `groundwork-writer`. Architecture Extract reads this file for the design system's binding non-functional budgets; the published doc carries no summary section.
3. **Promote brand tokens.** Move `.groundwork/cache/brand-tokens-draft.json` to `.groundwork/config/brand-tokens.json` (when Adopt/Upgrade preserved an existing valid file, there is no draft — leave the existing file untouched). Verify it validates against the contract and carries the Tier-2 blocks the confirmed type set requires. This file is persistent config — it is never deleted at cache cleanup. When the `./dev` CLI already exists and was branded from defaults, tell the user it now has a brand to adopt and that re-running `workspace-dev-cli` picks it up.
4. **Append design gaps to the ledger** at `.groundwork/cache/gap-ledger.md` (create from `.groundwork/skills/templates/gap-ledger.md` if absent): design divergences from standard this phase uniquely saw.
5. Write the hand-off to `.groundwork/cache/handoff/design-system-extract.md` from the shared template: rejected design directions, deferred decisions, user instincts about interaction not captured in the spec. Omit empty sections (Protocol 6).
6. **Delete what this phase consumed**, where it existed: the findings slice `.groundwork/cache/scan/design-findings.md`, the previous hand-off `.groundwork/cache/handoff/product-brief-extract.md`, and the phase cache `.groundwork/cache/design-system-extract-cache.md`. Leave `scan/overview.md`, `scan-state.json`, and `repo-map.json` — unless this phase runs after Setup Graduation and was the last deferred phase reading a preserved scan cache, in which case delete `.groundwork/cache/scan/` and `scan-state.json` too: the teardown `groundwork-infra-adopt` skipped on its behalf. Preserve `repo-map.json` always.
7. Apply the Living Documents protocol — refine `docs/product-brief.md` if the conversation surfaced refinements; refresh the product-brief's live Downstream Context file where the change touched a Key Decision, Binding Constraint, or Deferred Question. Follow the Reversal Protocol if any update overturns a prior Key Decision.
8. Update discovery notes — remove `## Design System` entries now captured.
9. **Clear the register entry.** When `state.json`'s `phase_states` carries a `deferred` entry for `design-system-extract`, remove it in this same step — the artifact now stands, and a stale entry keeps a finished phase looking unsettled. The collapsed variant is the exception: it writes its own `collapsed` entry (Stage 1) instead.

10. Confirm completion, recommend a fresh context, and immediately load and execute `groundwork-orchestrator`. Do not ask the user to invoke it — it routes on, whether that is the next setup phase or back to the work that needed this design system. Record nothing else in `state.json`: the orchestrator reconciles this phase's completion from its committed artifacts.
