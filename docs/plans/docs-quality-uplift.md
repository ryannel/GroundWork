# Implementation Plan: Docs Quality Uplift (Readable Content, Branded Site, Diagrams)

**Status:** PROPOSED 2026-06-23. No slices executed. Supersedes nothing; builds on the archived `docs-site-scaffold.md` (which delivered the site as a native runner) by raising the quality bar of both what the skills *write* and what the generator *renders*.
**Audience:** An engineer or agent implementing this change. Each slice names its files and an acceptance check; the judgment calls that remain are in §8.
**Scope owner:** `groundwork-writer` (content quality) and the `docs-site` generator (site quality), with coupled changes to `groundwork-architecture` / `groundwork-scaffold` (diagram + ordering mandates), `groundwork-bet` (bets ordering), the shared brand-token projection in `src/generators/shared/`, and `source.config.ts`.

---

## 0. Read this first — the mental model

GroundWork already produces the raw material of a great doc site — a disciplined corpus of canonical Markdown and a per-project `brand-tokens.json` — and then renders it as the **stock Fumadocs starter**. The quality gap is not a missing capability; it is two layers each stopping one step short of the polish the inputs already support.

A side-by-side of a GroundWork-generated site (`magpie`) against a hand-built reference (`wordloop-platform/services/wordloop-docs`) isolates the gap precisely:

> **The docs read like a report-out from a conversation, not reference documentation.** This is the deepest problem and the hardest to see in a file diff. GroundWork generates docs at the *end of a facilitated setup conversation*, and they carry its residue: the structure mirrors the phase handoff (`## Summary for Downstream`, `Key Decisions`, `Binding Constraints`, `Deferred Questions`, `Out of Scope`) and the voice narrates the deliberation ("these budgets are binding," "X was deferred"). Reference documentation describes the **system as it exists**, in timeless present tense, for a reader who was never in the room. magpie's `architecture.md` opens with the *minutes of the meeting that designed it* before it ever says what the system is. The reference opens with what the system is and why, then progressively discloses detail.
>
> **The content is also dense and flat.** 73 docs, ~6,100 lines, and **one callout in the entire corpus**, **zero diagrams**, and **zero images**. `architecture.md` is 305 lines of prose describing a topology it never draws. The writer skill teaches excellent *prose* discipline (declarative, inverted-pyramid, active voice) but nothing about *register* (reference vs. report-out) or *visual* communication — diagrams, callouts, scannable rhythm. A reader meets a wall of text where the reference meets a mental model and a sequence diagram.
>
> **The site throws away the brand.** GroundWork's design-system phase produces `brand-tokens.json`, and the `nextjs-app` generator already projects it into `globals.css`/`brand.css`. The `docs-site` generator contains **zero brand references** — default Inter font, bare `createPreset()`, no theme. The reference bridges its OKLCH palette into Fumadocs `fd-*` tokens, sets a 65ch measure and 1.6 line-height, and loads brand fonts. Same inputs available; one consumes them, one ignores them.
>
> **Nothing is ordered, introduced, or drawn.** No `meta.json` exists anywhere, so the sidebar renders in raw filesystem order patched by a `betsFirst()` JS hack. The home route is a redirect to an auto-generated link-dump. Mermaid is wired nowhere — `next.config` is a bare `createMDX()` with no rehype plugin — so even if a doc *had* a diagram, it would render as inert text.

**The organizing constraint:** GroundWork docs are **plain `.md`** — read raw on GitHub and retrieved cold by agents from the pristine `docs/` tree. The reference gets its richness from MDX React components (`<Mermaid>`, `<Callout>`, `<Card>`) that render *only* inside its Next.js app. We will **not** adopt MDX. Instead we close the gap with the subset of richness that renders in **both** GitHub and Fumadocs, plus site-side polish that never touches content:

| Richness | Reference (MDX, site-only) | This plan (plain `.md`, dual-render) |
|---|---|---|
| Diagrams | `<Mermaid chart={…}/>` client component | Fenced ` ```mermaid ` — native on GitHub, rendered in-site via build-time `rehype-mermaid` |
| Callouts | `<Callout type="info">` | GitHub alerts `> [!NOTE]` / `> [!WARNING]` — native on GitHub, supported by Fumadocs |
| Nav cards / hero | `<Card>` in content | Generated **site-side** from the doc tree + brand tokens — content stays clean |
| Theme | OKLCH → `fd-*` in `global.css` | Project `brand-tokens.json` → `fd-*`, reusing the `nextjs-app` projection |

Every content fix renders identically for the human on GitHub, the human on the site, and the agent reading the file. Every site fix is driven by tokens GroundWork already generates. Nothing is magpie-specific — per the contributor rule, each change improves the output for *every* product GroundWork builds.

---

## 1. Findings this plan responds to

Condensed from the magpie↔wordloop teardown. IDs are referenced by the workstreams.

| ID | Finding | Layer | Severity |
|---|---|---|---|
| F1 | Site ignores `brand-tokens.json` entirely: default Inter, bare `createPreset()`, no theme, no logo — stock Fumadocs starter | Site | High — "no branding" |
| F2 | No typographic discipline: no measure cap, default line-height/scale — long docs read as walls | Site | High — readability |
| F3 | Mermaid renders nowhere: `next.config` bare `createMDX()`, no `rehype-mermaid`, no dependency | Site | High — "no diagrams" |
| F4 | No real landing page: `app/page.tsx` redirects; `/docs` falls to the auto-generated `DocsIndex` link-dump | Site | High — "no landing page" |
| F5 | No `meta.json` anywhere → sidebar in raw filesystem order, patched only by the `betsFirst()` hack in `app/docs/layout.tsx` | Site/Content | High — "no sidebar order" |
| F6 | Content has **zero diagrams**: `architecture.md` (topology), data-flow, and domain lifecycles draw nothing | Content | High — readability |
| F7 | Content has **one callout in 73 files**: no visual separation of canonical truths / warnings | Content | Medium — readability |
| F8 | `architecture.md` opens with `## Summary for Downstream` (+`###`s) **before its `# H1`** — the page starts with a jargon contract, title buried at line 43 | Content | Medium — readability + correctness |
| F9 | Frontmatter is incoherent: 69/73 files carry it in **four different shapes**; `services/*` lack `title`/`description`; `architecture.md` lacks `description` → `DocsDescription` renders empty on most pages. The `source.config.ts` comment ("docs ship WITHOUT frontmatter") is stale and wrong | Content | Medium |
| F10 | `betsFirst()` is an imperative JS hack standing in for declarative ordering; the 40-file `principles/` tree dominates the sidebar with no grouping/collapse | Site | Low |
| F11 | Reference ships governance the corpus lacks: freshness badge, docs-health + diagram-drift scripts, prose lint, `llms.txt`/OG/MCP outputs | Both | Low — deferred (WS-J) |
| **F12** | **Docs read like a facilitation report-out, not reference documentation:** structured around the setup conversation's decision/handoff flow (`Summary for Downstream`, `Key Decisions`, `Deferred Questions`, `Out of Scope`) and written in a "we decided X / Y is deferred" register, instead of describing the system as it exists for a reader who was never in the conversation. F8 is one symptom. | Content | **Highest — the core readability problem** |

**Strengths to preserve:** plain-Markdown content (GitHub + agent readable, site-agnostic); the pristine `docs/` tree the site reads at `../../docs`; the writer skill's prose discipline; the existing `brand-tokens.json` pipeline; the `/docs` index fallback shipped 2026-06-23 (it becomes the safety net beneath WS-D, not a replacement for it).

---

## 2. Settled decisions (drive the workstreams)

These were decided with the scope owner on 2026-06-23. Rationale recorded; open to revision per the project's append-only-is-the-record principle.

| # | Decision | Rationale |
|---|---|---|
| D1 | **Content stays plain `.md`.** Richness via fenced ` ```mermaid ` + GitHub alerts `> [!NOTE]`, never MDX components. | Preserves the dual-reader contract (GitHub raw + agent cold-read). Fenced mermaid is strictly better than the reference's client component — it also renders on GitHub. |
| D2 | **Minimal frontmatter: `title` + `description` required on every canonical doc.** | Fixes the incoherent four-shape state; populates `DocsDescription` and gives clean sidebar labels. Reverses part of the earlier blanket frontmatter removal (see §8 note) — deliberately, and minimally. |
| D3 | **The landing page is site-side**, generated from the doc tree + brand tokens. No `docs/index.md` injected — the tree stays content-pristine. | A branded hero + section cards needs styling plain `.md` can't carry; keeping it in the app honors the pristine-tree rule the 2026-06-23 fix established. |
| D4 | **Theme comes from `brand-tokens.json`, reusing the `nextjs-app` projection.** | The brand system already exists per project; the docs site should match the app, not invent a default. Extract the projection into a shared helper rather than fork it. |

---

## 3. Workstream A — Site theme from brand tokens (F1)

The highest-leverage, lowest-risk win: make the docs site consume the brand system GroundWork already generates.

**A1 — Extract a shared brand-token→CSS projection.**
The `nextjs-app` generator already reads `brand-tokens.json` and emits `app/brand.css` + token utilities in `globals.css`. Lift the projection logic into `src/generators/shared/` (e.g. `brand-css.ts`) so both generators call one function. *Accept:* `nextjs-app` output byte-identical after refactor (its tests still pass); the helper is unit-covered.

**A2 — Project brand tokens into the docs site.**
In the `docs-site` generator, read `brand-tokens.json` and emit a `app/brand.css` that maps the palette + atmosphere onto Fumadocs `fd-*` CSS variables (`--color-fd-primary`, `--color-fd-background`, sidebar surface, accent), imported from `app/layout.tsx`. Wire brand fonts (fallback to the current Inter when tokens name none). *Accept:* a scaffold with a non-default `brand-tokens.json` renders the docs site in-palette; with no tokens, it falls back cleanly to today's appearance.

**A3 — Logo + nav identity.**
Drive the nav title/logo from the project (already have `navTitle`); add an optional logo slot fed by brand tokens. *Accept:* nav shows the project identity, not bare text, when a logo token is present.

---

## 4. Workstream B — Typography & readability (F2)

**B1 — Reading measure + rhythm.**
Add a docs-site stylesheet (or extend `brand.css`) setting the prose `max-width` to ~65–72ch, `line-height` ~1.6, and an explicit `h1–h4` type scale, mapped through brand-token typography roles where present. *Accept:* `architecture.md` renders with a bounded measure and clear heading hierarchy, not full-width body text.

---

## 5. Workstream C — Mermaid rendering (F3)

**C1 — Wire build-time mermaid.**
Add `rehype-mermaid` (or the Fumadocs-recommended remark/rehype path) to `next.config.mjs`'s MDX pipeline and the dependency to the generated `package.json`, themed from brand tokens. Build-time rendering keeps the site static and matches GitHub's output. *Accept:* a doc containing a fenced ` ```mermaid ` block renders an SVG diagram in the site; the same file renders a diagram on GitHub.

---

## 6. Workstream D — Branded landing page (F4)

**D1 — Generated home.**
Replace the `app/page.tsx` redirect with a branded landing rendered from the doc tree + brand tokens: a hero (project name + product-brief one-liner), section cards linking into the top-level doc sections, and a quickstart card (`./dev` entry points pulled from `infrastructure.md`). Keep the `/docs` `DocsIndex` fallback as the catch-all. *Accept:* `/` shows a branded landing (not a redirect to a link-dump); cards link to live sections; appearance tracks brand tokens.

---

## 7. Workstream E — Sidebar ordering via `meta.json` (F5, F10)

**E1 — Emit a root + section ordering baseline.**
The `docs-site` generator (or `groundwork-scaffold` Phase that writes the docs map) emits `docs/meta.json` ordering the canonical top-level set logically (product-brief → design-system → architecture → infrastructure → domain → services → decisions → api → ways-of-working → principles), with `principles` set `defaultOpen: false` to stop the 40-file tree dominating the rail, and a `---Section---` separator where it aids grouping. *Accept:* the sidebar renders in the canonical order with principles collapsed; no `betsFirst()` needed.

**E2 — Bets ordering owned by the bet skill.**
`groundwork-bet` maintains `docs/bets/meta.json` (or a `bets`-floating entry in the root meta) so active/delivered bets order sensibly as they are created. *Accept:* a new bet appears in the intended position without code changes.

**E3 — Retire the `betsFirst()` hack.**
Remove the imperative sort from `app/docs/layout.tsx` once declarative ordering covers it. *Accept:* `layout.tsx` carries no ordering logic; order is data-driven.

> `meta.json` files are sidebar config, not content — GitHub and agents ignore them, so the `docs/` tree stays effectively content-pristine. See §8 for the one open question this raises.

---

## 8. Workstream K — Writing voice, tone & structure: report-out → reference documentation (F12, F8)

**The content centerpiece.** The other content workstreams (diagrams, callouts, frontmatter) decorate a doc; this one rewrites how it reads. GroundWork docs are generated at the end of a facilitated conversation and inherit its shape and voice. Reference documentation describes the *system*, in timeless present tense, for someone who was never in the room. This workstream retrains `groundwork-writer` on register and structure, and resolves how the machine/handoff scaffolding coexists with reader-facing prose.

**K1 — Reference register: the system is the subject.**
Add a voice rule: state what the system *is* and *does*, not what the team *decided* or *deferred*. The reader needs the current truth, not the deliberation that produced it. Rationale stays — as "why the system is this way," never "what we chose"; rejected alternatives live in ADRs, not the narrative.
- ❌ "We decided to run on Apple Silicon only; cross-platform support was deferred."
- ✅ "Magpie runs on Apple Silicon. The Neural Engine and unified memory make local inference viable."
*Accept:* the skill defines the reference register with before/after examples and an explicit ban on report-out phrasing ("we decided," "deferred," "out of scope for now," "as discussed").

**K2 — Structure for the reader, not the phase.**
Every doc opens with orientation — a plain-language statement of what this is and the mental model — before any detail or contract, then discloses progressively (overview → concepts → specifics). The document's spine is the reader's information need, not the setup phase's output sections. *Accept:* the skill specifies a reader-first section order per doc type (e.g. architecture: what the system is → topology diagram → key capabilities → boundaries → constraints), distinct from the phase-handoff order.

**K3 — High-level and accessible.**
Define each domain term on first use; lead complex sections with the intuition before the precision; prefer the concrete noun over the abstraction. A competent engineer new to the project should absorb the architecture from its first screen. *Accept:* the skill carries an accessibility checklist (term-on-first-use, intuition-before-precision, no undefined acronyms) with a worked rewrite of a dense magpie passage.

**K4 — Quarantine the process/handoff scaffolding.**
`Summary for Downstream`, `Deferred Questions`, and `Out of Scope` are facilitation/handoff artifacts that make a published doc read like meeting minutes. Implement the chosen coexistence model (decision O5) so the reader-facing doc reads as documentation while the cross-phase contract survives. *Accept:* a regenerated `architecture.md` opens as reference documentation; the Protocol-5 hand-off contract is still satisfiable by downstream phases.

> This workstream subsumes WS-H (document-open discipline) — H1-first is the smallest instance of K2. Implement them together.

## 9. Workstream F — Diagrams as a content mandate (F6)

**F1 — Teach diagram authoring in `groundwork-writer`.**
Add a "Diagrams" section: when to draw, which Mermaid type per purpose (topology → `graph`/`flowchart`; cross-service operations → `sequenceDiagram`; entity relationships → `erDiagram`; lifecycle states → `stateDiagram-v2`), and that diagrams are authored as fenced ` ```mermaid ` blocks placed inline with the prose that explains them (why-before-how). *Accept:* the skill names the diagram type for each GroundWork doc type and shows a worked example.

**F2 — Make specific docs require a diagram.**
`architecture.md` must carry a topology diagram; cross-service data-flow sections a sequence diagram; `domain/<entity>.md` a lifecycle diagram where states exist. Encode the requirement in `groundwork-architecture` (and `groundwork-scaffold` / extract counterparts) at the point each doc is drafted. *Accept:* a generated architecture doc contains at least one rendered topology diagram.

---

## 10. Workstream G — Callouts & visual rhythm (F7)

**G1 — Teach GitHub-alert callouts.**
Add to `groundwork-writer`: use `> [!NOTE]` / `> [!IMPORTANT]` / `> [!WARNING]` to lift canonical truths, binding constraints, and hazards out of body prose — sparingly, one per concept, never decoratively. *Accept:* the skill defines each alert's use and caps density.

**G2 — Section-length rhythm.**
Guidance to break sections longer than a screen with a diagram, table, or callout; keep one idea per paragraph. *Accept:* the skill states the rhythm rule with a before/after.

---

## 11. Workstream H — Document-open discipline (F8)

**H1 — H1 first, then a lead.**
Fix the writer rule so every doc opens with its `# H1` title followed by a one-to-two sentence lead paragraph, *then* the `## Summary for Downstream` contract. Today the skill says the summary is "the first section after the frontmatter," which produced the title-buried-at-line-43 bug. *Accept:* the skill mandates H1 + lead before the summary; a regenerated `architecture.md` opens with its title.

> **Do not rename `## Summary for Downstream`.** The exact heading is a cross-phase contract identifier read by downstream setup phases (operating contract Protocol 5) — renaming it is silent identifier drift. The fix is ordering and a human lead paragraph, not a rename. Whether to additionally de-emphasize the summary visually in-site is an open question (§12).

---

## 12. Workstream I — Frontmatter coherence (F9)

**I1 — Define the minimal schema (D2).**
`groundwork-writer`: every canonical doc carries `title` + `description` (one scannable sentence). `last_reviewed` stays optional; drop the divergent `service`/`type`/`generation_mode` shapes from the required set. *Accept:* the skill shows the exact required frontmatter and one example per doc type.

**I2 — Apply across doc templates and producing skills.**
Update every doc-producing skill / template to emit `title` + `description`. *Accept:* a fresh greenfield run produces docs that all carry both fields.

**I3 — Fix `source.config.ts`.**
Correct the stale "docs ship WITHOUT frontmatter" comment; keep the H1-derivation as a *fallback* when `title` is absent; ensure `description` flows to `DocsDescription`. *Accept:* generated pages show a non-empty description; H1 fallback still works for any doc lacking frontmatter.

---

## 13. Workstream J — Governance (F11, deferred)

Out of scope for the first pass; tracked so it is not lost. The reference ships a freshness badge (`last_reviewed` → green/yellow/red), `docs-health` + `diagram-drift` scripts, a Vale prose lint, and LLM-export routes (`llms.txt`, per-page `.mdx`, OG images, MCP). GroundWork already has `llms.txt` discipline in the writer skill; the rest is a future plan once D2's `last_reviewed` is consistently present.

---

## 14. Sequencing & gates

**Order:** Two tracks run largely in parallel.
- *Site track* — A → B → C → D, independent of content, immediately visible; proves the brand pipeline end-to-end. Plus E (ordering).
- *Content track* — **K leads** (voice, tone, structure — the core fix; subsumes H), then F (diagrams), G (callouts), I (frontmatter). These are mostly `groundwork-writer` edits that ship as skills (clean-copy, no migration), with coupled edits to the doc-producing skills and, for K4, possibly the operating contract.

K is the highest-value content slice and gates the others: a beautifully themed site rendering report-out prose is still hard to read. Resolve O5 before K4 executes.

**Gates:**
- `./dev test generation` + `./dev test contracts` green after every slice touching a generator.
- A scaffolded docs site **boots and renders** a brand-themed page, a mermaid diagram, an ordered sidebar, and a branded landing (a `./dev test compilation`/`validate` extension, or a manual boot recorded in the plan ledger).
- **Migration coverage:** changes under `src/generators/docs-site/files/`, `src/generators/shared/`, and `src/docs/` touch the shipped surface — each needs a `[migration]` registry entry or a `[no-migration]` CHANGELOG annotation (the docs site is Tier-3 generator-produced and regenerates on `update`; `src/docs` is Tier-2 and refreshes/merges). Sync-anchor gate stays green if any `groundwork-writer` principle references move.
- A live greenfield simulation produces a doc set that clears the new bar (diagrams present, callouts used, sidebar ordered, landing branded) — the real acceptance test, recorded under `docs/examples/`.

---

## 15. Open decisions

| # | Question | Recommendation |
|---|---|---|
| O1 | `meta.json` lives inside the `docs/` tree (idiomatic Fumadocs) vs. an ordering map held in the docs-site app to keep `docs/` strictly free of non-`.md` files. | In-tree `meta.json` — it is config not content, GitHub/agents ignore it, and it is the standard Fumadocs mechanism. Revisit only if a purity concern surfaces. |
| O2 | Should the in-site render of `## Summary for Downstream` be visually de-emphasized (collapsible/aside) so human readers meet prose first, while the heading-name contract is preserved? | Decide from the rendered result once K2/K4 land. |
| **O5** | **(Pivotal, WS-K4) How do the setup-conversation handoff artifacts (`Summary for Downstream`, `Deferred Questions`, `Out of Scope`) coexist with reader-facing docs?** Three models: **(a)** keep them, but move below the reader-facing body and/or render as a collapsible "machine summary" aside in-site — preserves the Protocol-5 contract identifier, lowest risk; **(b)** relocate the handoff contract entirely into the existing `.groundwork/cache/handoff/<phase>.md` cache so published docs carry none of it — cleanest reader experience, but a methodology change touching operating-contract Protocol 5 and every downstream reader; **(c)** keep structure as-is, fix only the prose register (K1) — smallest change, leaves the report-out *shape* intact. | Recommend **(a)** now (decouples reader experience from the contract at low risk), with **(b)** evaluated as a follow-up if (a) still reads as minutes. Avoid (c) — it only half-solves the stated problem. **This touches the operating contract; confirm before WS-K4.** |
| O3 | Mermaid theming: a single brand-derived theme vs. light/dark variants matching the site toggle. | Start with one brand-derived theme; add dark variant if the contrast is poor. |
| O4 | How far to push diagram *requirements* vs. *guidance* — a hard gate that fails a bet without a diagram, or strong skill guidance only. | Guidance first (WS-F); a gate only if simulations show diagrams still get skipped. |
