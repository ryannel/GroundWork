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

This is Phase 2 of the brownfield track. The scan phase left you a design findings slice. You distil the concrete design decisions already in the code, fill the aesthetic-intent gaps in a short conversation, and commit. The output is indistinguishable from a greenfield design system.

The principle is **infer first, interview last**. Code reveals the palette, the type scale, the spacing system, the component inventory — the *what*. Code cannot reveal whether those choices were deliberate or accreted, what feeling they are meant to produce, or which inconsistencies are intentional variation versus drift. Recover the values; interview the intent.

Apply the `groundwork-writer` skill when producing the output document. Declarative, assertive, zero-hedging.

---

## Why This Step Matters

- **Architecture Extract** reads the design system's Downstream Context file for non-functional requirements — performance budgets, accessibility floors, interaction latency targets — that shape the services it reverse-engineers.
- **Infra Adoption** reads `.groundwork/config/brand-tokens.json` to brand the `./dev` CLI it scaffolds. This file **must** exist after this phase, or the operational layer the next phase bolts on is unbranded.

---

## Operating Contract

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) governs how this skill operates. Read it before taking any other action. This is a Sequential Setup phase. It consumes the scan baseline under the Protocol 7 brownfield exception — it may read `scan/design-findings.md`, `scan/overview.md`, and `scan-state.json`, plus the product-brief's Downstream Context file (`.groundwork/context/product-brief-extract.md`) and the product-brief-extract hand-off.

---

## Initialization & Resume Protocol

### Step 1: Mode Detection — Extract or Adopt/Upgrade

Check whether `docs/design-system.md` already exists.

- **Absent** — standard **Extract** mode.
- **Present but lacking an element this phase's commit produces** (for the design system: its Downstream Context file at `.groundwork/context/design-system-extract.md`, or the companion `.groundwork/config/brand-tokens.json`) — **Adopt/Upgrade** mode: ingest the existing file as primary source and bring it forward — the stance defined in the product-brief extract's Step 1 / the orchestrator's Adopt/Upgrade Mode. An existing `brand-tokens.json` that validates against the contract is preserved as-is — emit one only when it is absent or the confirmed type set changes the Tier-2 blocks it must carry.

### Step 2: Read Upstream Context

Read in the Protocol 3.2 order: the product-brief-extract hand-off (`.groundwork/cache/handoff/product-brief-extract.md`) in full; then the product-brief's Downstream Context file `.groundwork/context/product-brief-extract.md`; then `.groundwork/cache/discovery-notes.md` entries under `## Design System`.

### Step 3: Cache Check

Create `.groundwork/cache/design-system-extract-cache.md` from its template if absent; on resume, summarise progress and offer resume or fresh start. Record the determined `interface_types` set in this cache.

---

## Stage 1: Determine Interface Types

The interface type describes what the end-user interacts with, not what the backend does. A repo can carry more than one surface — a web app and an admin CLI are two surfaces of one product — and each surface's type owns its own design treatment. The scan recorded every surface it found under `## Interface Surfaces` in `scan/design-findings.md`; confirm each against the taxonomy:

| Type | The consumer | Examples |
|---|---|---|
| `graphical-ui` | An end-user at a screen | SaaS apps, dashboards, consumer apps, storefronts, AI products with a visual frontend |
| `cli` | A human watching a terminal | developer tools, terminal apps, an embedded-agent shell experience |
| `agentic-protocol` | Another program or agent via API, no human terminal surface | agent frameworks, MCP servers, protocols |

Disambiguation rule and edge cases (AI-powered frontends, embedded-agent terminals, explicit-vocabulary briefs): `groundwork-design-system/instructions.md` Step 2 — the same one test, **who consumes the output**, decides every case here too. Record the confirmed **type set** in the phase cache — it determines which type sections the recovered design system carries and which Tier-2 brand-tokens blocks are emitted. A repo with one surface confirms one type, and the rest of the phase runs exactly as it always has.

---

## Stage 2: Ingest & Synthesise

Read `scan/design-findings.md` and, where the findings cite specific config or theme files, read those files directly for exact values. Build a provisional design system and mark each area as recovered confidently or gapped.

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

   **Structure.** Open with the **shared foundation** (non-functional requirements, colour architecture with concrete values and semantic roles, typography, brand voice), then **one titled section per confirmed interface type** — `Graphical UI`, `CLI`, `Agentic Protocol`, as applicable. Each type section carries that type's medium-specific system — spacing, components, breakpoints, and interaction patterns for `graphical-ui`; the terminal treatment for `cli`; response shape and error vocabulary for `agentic-protocol`. A single-type product carries one type section — the same shape greenfield facilitation produces.

   **Spell the type-section titles exactly** (`Graphical UI`, `CLI`, `Agentic Protocol`): they are the anchors `docs/surfaces.md` `design track` fields resolve to; a drifted title orphans the reference.

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
3. **Promote brand tokens.** Move `.groundwork/cache/brand-tokens-draft.json` to `.groundwork/config/brand-tokens.json` (when Adopt/Upgrade preserved an existing valid file, there is no draft — leave the existing file untouched). Verify it validates against the contract and carries the Tier-2 blocks the confirmed type set requires. This file is persistent config — it is never deleted at cache cleanup, and infra adoption depends on it.
4. **Append design gaps to the ledger** at `.groundwork/cache/gap-ledger.md` (create from `.groundwork/skills/templates/gap-ledger.md` if absent): design divergences from standard this phase uniquely saw.
5. Write the hand-off to `.groundwork/cache/handoff/design-system-extract.md` from the shared template: rejected design directions, deferred decisions, user instincts about interaction not captured in the spec. Omit empty sections (Protocol 6).
6. **Delete the consumed findings slice** `.groundwork/cache/scan/design-findings.md`. Delete the previous hand-off `.groundwork/cache/handoff/product-brief-extract.md` (now consumed) and the phase cache `.groundwork/cache/design-system-extract-cache.md`. Leave `scan/overview.md`, `scan-state.json`, and `repo-map.json`.
7. Apply the Living Documents protocol — refine `docs/product-brief.md` if the conversation surfaced refinements; refresh the product-brief's live Downstream Context file where the change touched a Key Decision, Binding Constraint, or Deferred Question. Follow the Reversal Protocol if any update overturns a prior Key Decision.
8. Update discovery notes — remove `## Design System` entries now captured.
9. Confirm completion, recommend a fresh context, and immediately load and execute `groundwork-orchestrator`. Do not ask the user to invoke it. Record nothing in `state.json` — the orchestrator reconciles this phase's completion from its committed artifacts (its Brownfield Setup table is the source of truth).
