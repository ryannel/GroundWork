# Implementation Plan: Docs Quality Uplift — Separate Setup Context from Product Documentation

**Status:** EXECUTED 2026-06-23 on branch `docs-quality-uplift` (unpushed). All workstreams delivered: WS-A context split + Setup Graduation, WS-B/C/D reader-first writer voice + diagram/callout mandates, WS-E bet technical-design split, WS-F/G branded docs-site (theme, build-time mermaid, ordered nav, landing), WS-H the `groundwork-docs-uplift` skill. Mechanical gates green (`./dev test generation` 225 passed; contracts/migration/workflow-index fresh). **Remaining:** the live-simulation quality acceptance (`./dev sandbox --simulate`) — needs a human Claude Code session, see §3. Supersedes the original pre-reframe version of this plan.
**Audience:** An engineer or agent implementing or reviewing this change. Each workstream names its files and an acceptance check.
**Scope owner:** The operating contract + every setup-phase skill (the context split), `groundwork-writer` (voice + diagrams), `groundwork-bet` (design-doc shape), the `docs-site` generator + shared brand projection (the site), and a new `groundwork-docs-uplift` skill.

---

## 0. Read this first — the reframe

GroundWork's setup flows produce one artifact per phase that serves **two masters**: the cross-phase machinery the *flow* needs — the `## Summary for Downstream` block (Key Decisions / Binding Constraints / Deferred Questions / Out of Scope) that every downstream phase's init reads — and the *product documentation* a reader who was never in the room needs. Both lived at the top of every `docs/*.md`. The flow's bookkeeping leaked into and shaped the published docs, so they read like a report-out of the setup conversation rather than reference documentation.

**The fix is to make the two distinct.** The cross-phase contract moves out of `docs/` into a temporary store at `.groundwork/context/<phase>.md` that only the flow consumes — and because that store is scaffolding, the flow that erects it also dismantles it: at the setup→delivery transition, binding decisions graduate into proper ADRs, the rest is reconciled into the docs, and the store is torn down. `docs/` is left as clean, reader-first, diagram-rich, branded product documentation — the single durable record, grown through delivery.

```
        BEFORE                                AFTER
  docs/architecture.md                   .groundwork/context/architecture.md   (temporary; flow only)
  ├─ ## Summary for Downstream     →     docs/architecture.md                  (clean reference doc)
  └─ <body + "we decided…">              docs/decisions/*.md                   (ADRs, at graduation)
```

Everything else follows: once the report-out scaffolding leaves `docs/`, the writing register, the diagrams, the callouts, the bet-doc shape, and the site theme are all just "what good product documentation looks like" — enforced where each doc is produced, and re-achievable on an existing project by the uplift skill.

**Organizing constraint (unchanged):** GroundWork docs stay **plain `.md`** — read raw on GitHub and retrieved cold by agents. Richness comes only from the subset that renders in *both* GitHub and Fumadocs (fenced ` ```mermaid `, GitHub alerts) plus site-side theme/landing that never touches content. No MDX in content.

---

## 1. Findings

| ID | Finding |
|---|---|
| F1 | The `## Summary for Downstream` contract was woven through 34 files / 83 occurrences — operating-contract Protocols 2/3/5/6, every setup-phase commit, the writer, and 9 review checklists. Moving it is the centerpiece. |
| F2 | Downstream context is long-range (every upstream doc a phase depends on), while the Protocol 6 hand-off is single-hop — so the contract needs its own persistent-through-setup store, not the hand-off cache. |
| F3 | The brand projection is only partially reusable: `nextjs-app` targets Tailwind v4 + shadcn vars; `docs-site` is Fumadocs `--color-fd-*`. Shared = `resolveVisual()` + validators + type; **not** the renderer. |
| F4 | The docs site is stock Fumadocs: default font, bare `createPreset()`, redirect-only landing, no `meta.json` (a `betsFirst()` JS hack), no mermaid pipeline. |
| F5 | The bet technical design was one file read by decomposition, delivery, the review, and templates — splitting it ripples to those readers. |
| F6 | The architecture draft already uses a per-section-directory pattern (`architecture-draft/NN-*.md` → `cat` → `docs/architecture.md`); the bet split mirrors it. |
| F7 | `docs-site` is a Tier-3 generator surface; `docs/` content is Tier-2; doc shape is Tier-4 — each touching slice needs a migration entry or `[no-migration]` annotation, gated by `./dev test contracts`. |

---

## 2. Workstreams

### Content track — DELIVERED

**WS-A — Split setup context out of docs, then tear it down (the spine).** ✅
Operating-contract Protocol 5 reworked to "Downstream Context" written to `.groundwork/context/<phase>.md`; new Protocol 10 (Setup Graduation) defines the reconcile-and-teardown at the setup→delivery boundary; Protocols 2/3/6/7 and the lifecycle-mode notes repointed. `groundwork-writer` enforces the clean-doc + context-file split. Every greenfield/brownfield setup producer writes the context file instead of an in-doc summary and reads upstream context from `.groundwork/context/`. The 9 review checklists no longer gate on an in-doc summary (they flag a leftover one). The orchestrator runs Setup Graduation before the first bet and keys brownfield completion off the context file. Maintenance skills no longer touch summaries. Migration `gw-context-split` graduates old in-doc summaries in place. Contributor guide cross-phase table + `.groundwork/context/` storage row updated.

**WS-B — Reader-first writing voice (`groundwork-writer`).** ✅
Reference register (system-as-subject, timeless present; banned report-out vocabulary), reader-first structure (orient then disclose; inverted-pyramid demoted to a within-section tactic), accessibility (define-on-first-use, intuition→precision, concrete→abstract), required `title` + `description` frontmatter, new failure modes.

**WS-C — Diagrams as a mandate.** ✅
Writer gains a diagram section (fenced ` ```mermaid `; type-by-content mapping). Architecture template requires a topology `graph` in §2 and a `sequenceDiagram` per non-trivial flow in §5; domain-entity template requires a `stateDiagram-v2` for the lifecycle.

**WS-D — Callouts.** ✅
GitHub-alert callouts (`> [!NOTE]`/`[!IMPORTANT]`/`[!WARNING]`) in the writer, used sparingly.

**WS-E — Split the bet technical design (`groundwork-bet`).** ✅
`docs/bets/<slug>/technical-design/` replaces the single file: `00-overview.md` (business logic + data flows with required mermaid diagrams — the gold file), `01-surface-design.md`, `02-capability-design.md`. Template split to match; 02-design drafts the three and assembles them for review like architecture; decomposition/delivery/templates/instructions and the contributor table repointed.

### Site track — DELIVERED

**WS-F — Brand the doc-site target state.** ✅
Extract `resolveVisual` + validators + `ResolvedVisual` into `src/generators/shared/brand-tokens.ts` (nextjs-app imports them; its `app/brand.css` stays byte-identical, guarded by `./dev test generation`). `docs-site/generator.ts` maps the palette onto the installed Fumadocs `--color-fd-*` variables via a new `renderDocsBrandCss`; typography (~68ch, 1.6 line-height, h1–h4 scale); unbranded fallback unchanged.

**WS-G — Mermaid + nav order + landing.** ✅
Client-side mermaid via a small remark transform (` ```mermaid ` → `<Mermaid chart>`) + a `Mermaid` client renderer (`mermaid` dep, no `rehype-mermaid`/Playwright) in `source.config.ts`; seed a root `docs/meta.json` ordering the canonical set and retire `betsFirst()`; a generated branded landing replacing the redirect (with the `/docs` index as fallback).

**WS-H — Doc-site uplift skill (new).** ✅
`src/hidden-skills/groundwork-docs-uplift/instructions.md`, routed from the orchestrator's anytime lane: opinionated about the WS-F/G target state (a T1–T6 checklist), regenerates generator-produced sites or refactors hand-built ones, seeds/fixes `meta.json`, and runs a content pass (via `groundwork-writer` + the review gate) that strips any leftover in-body `## Summary for Downstream` sections, graduating their decisions to ADRs.

---

## 3. Sequencing & gates

```
WS-A ──┬─ WS-B ──┬─ WS-C
       │         ├─ WS-D
       │         └─ WS-E
WS-F ──── WS-G ──── WS-H        (site track, independent of the content track)
```

- **Content track gates:** `./dev test contracts` (migration-coverage + changelog↔registry cross-check) green — confirmed for WS-A–E. No mechanical test asserts doc *quality*; the real acceptance is a live greenfield simulation (`./dev sandbox --simulate`) whose output reads as reference documentation, carries diagrams/callouts, has no `## Summary for Downstream` in `docs/`, and whose `.groundwork/context/` is gone after setup with binding decisions present as ADRs.
- **Site track gates:** `./dev test generation` + `./dev test contracts` green; `nextjs-app` `brand.css` byte-identical after the shared extraction; a booted docs site shows brand theming, a rendered mermaid diagram, ordered nav, and a branded landing — and the same `.md` renders the diagram + callout on GitHub.
- **Graduation/teardown:** drive a simulation through the setup→delivery transition and assert `.groundwork/context/` is gone, no setup residue remains, and every context-store binding decision is an ADR; interrupt mid-setup to confirm the store exists *during* setup.
