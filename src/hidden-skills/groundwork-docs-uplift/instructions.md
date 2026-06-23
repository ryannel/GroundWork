---
name: groundwork-docs-uplift
description: >
  Brings an existing project's documentation site to the current GroundWork target state —
  brand theming, rendered diagrams, ordered navigation, a real landing page — and gives its
  docs a reader-first pass. Use when a project predates the branded docs-site, when its site was
  hand-built or has drifted, or when the user asks to "fix / improve / refresh the docs site".
  Opinionated about what a GroundWork doc site is, and able to refactor one into that shape.
---

# groundwork-docs-uplift

A GroundWork doc site is the project's `docs/` tree rendered with the brand the design system already produced: themed, diagram-rendering, ordered, and opening on a landing page rather than a redirect. Many projects do not have that — they predate the branded generator, were assembled by hand, or have drifted as the generator advanced. This skill closes that gap. It knows the target state, detects how far a given site is from it, and refactors the site and (lightly) the content until the site matches.

You are not redesigning anything. The brand is settled in `.groundwork/config/brand-tokens.json` and the doc *content* is settled in `docs/`. Your job is to make the site render both at the framework's current bar, and to strip from the content the setup-flow residue that should never have shipped in published docs.

---

## Operating Contract

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) governs this skill. Read it before taking any other action. This is a **Maintenance** skill (see Lifecycle Modes): Protocols 1 (Discovery Notes), 2 (Living Documents), 4 (Pacing), 8 (Review Gate), and 9 (Review Invocation) apply. There is no phase cache, no hand-off file, and no fresh-context recommendation. Available only after setup completes.

Apply the `groundwork-writer` skill whenever you edit a `docs/` document — the content pass below is the Living Documents protocol pointed at the doc site's readability.

---

## The target state

These are the properties a GroundWork doc site has. They are the checklist you assess against and refactor toward — the same definition the `docs-site` generator builds new sites to.

| # | Property | What "present" means |
|---|---|---|
| T1 | **Branded theme** | An `app/brand.css` projects `brand-tokens.json` onto the site's theme variables; `app/layout.tsx` imports it and the brand font. An unbranded project (no `brand-tokens.json`) correctly stays on the stock theme — that is target, not a gap. |
| T2 | **Reading typography** | A measure near 68ch, ~1.6 line-height, and an explicit heading scale — not the framework default body. |
| T3 | **Rendered diagrams** | Fenced ` ```mermaid ` blocks render in the browser — a remark transform rewrites them to a `<Mermaid chart>` node, a `Mermaid` client component renders them, and no headless browser is needed at build. The same block renders natively on GitHub. |
| T4 | **Ordered navigation** | A `docs/meta.json` orders the canonical doc set (product-brief → design-system → architecture → infrastructure → domain → services → decisions → api → ways-of-working → principles, with principles sunk last/collapsed). No imperative sidebar-ordering hack in the layout. |
| T5 | **A landing page** | The site root is a brand-driven hero + section cards derived from the doc tree — not a bare redirect or an auto-generated link dump. |
| T6 | **Clean content** | Published `docs/*.md` read as reference documentation: timeless-present register, `title` + `description` frontmatter, no leftover `## Summary for Downstream` section, a diagram where structure or flow is described. |

---

## Step 1: Detect the site and its provenance

Establish what you are working with before changing anything.

1. **Find the site.** Look for a docs site service — a Fumadocs/Next.js app under `services/` (or wherever the project keeps surfaces) whose content source is the root `docs/` tree. If there is none, ask the user whether to scaffold one (route them to the `docs-site` generator) rather than hand-building one here.
2. **Read its provenance.** Check `.groundwork/config/manifest.json` and the generator provenance record. A site the `docs-site` generator produced is **Tier-3 generator-owned**; a site assembled by hand or heavily edited is **divergent**. This split decides Step 2.
3. **Assess against the target state.** Walk T1–T6 and record, concretely, which are present, which are missing, and which are present-but-drifted. Present this short assessment to the user before refactoring — it is the plan for the run.

---

## Step 2: Bring the site to target (T1–T5)

### Path A — a generator-produced site

The fastest correct uplift is to regenerate. The `docs-site` generator already builds T1–T5; an older site is simply an older generation.

- Regenerate the docs-site through the current generator with its **recorded options** (the Tier-3 reconcile path — the same mechanism `groundwork-upgrade` uses for generator surfaces). This re-emits `app/brand.css`, `app/docs.css`, the `source.config.ts` mermaid pipeline, the landing page, and seeds `docs/meta.json`.
- **Reconcile, do not clobber.** Where the project hand-edited a generated file, carry the intentional edits forward rather than overwriting them. `docs/meta.json` that the project hand-tuned is preserved.
- Confirm the regeneration covered every missing T1–T5 item from the Step 1 assessment.

### Path B — a divergent or hand-built site

Refactor in place, item by item, to the target state — porting the generator's approach rather than inventing a parallel one:

- **T1/T2** — add `app/brand.css` projecting `brand-tokens.json` onto the site's theme variables, and an `app/docs.css` carrying the measure / line-height / heading scale; wire both in the layout. Read the `docs-site` generator for the exact projection so the brand reads identically across surfaces.
- **T3** — add a remark transform (` ```mermaid ` → `<Mermaid chart>`) to the MDX pipeline, the `mermaid` dependency, and a `Mermaid` client component wired into the docs page's MDX components map (avoid `rehype-mermaid`/Playwright).
- **T4** — write `docs/meta.json` in the canonical order; remove any imperative sidebar-ordering code.
- **T5** — replace a redirect/link-dump root with a brand-driven hero + section cards derived from the doc tree.

Keep the unbranded fallback intact: a project with no `brand-tokens.json` stays on the stock theme.

---

## Step 3: The content pass (T6)

The site can be perfect and the docs still read like a report-out. Give the content a reader-first pass under `groundwork-writer`.

1. **Strip setup-flow residue.** Any published `docs/*.md` (outside `docs/bets/`) carrying a leftover `## Summary for Downstream` section is running the retired contract. Graduate it exactly as the `gw-context-split` migration does: promote each still-binding Key Decision / Binding Constraint into a `docs/decisions/` ADR (or confirm it is already in the body), fold any live deferred/scope note into the body, then strip the section. Never delete a binding decision without first landing it in an ADR or the body.
2. **Flag report-out register.** Scan for the report-out tells (`we decided`, `is deferred`, `out of scope for now`, `for the MVP`). Rewrite the worst offenders in the timeless present with the system as subject. This is a pass, not a rewrite — prioritise the docs a reader hits first (product-brief, architecture).
3. **Frontmatter + diagrams.** Ensure every doc has `title` + `description`; add a `mermaid` diagram where a doc describes a topology, a cross-service flow, or an entity lifecycle in prose alone.
4. **Gate mutated docs.** Any canonical doc you materially rewrite goes through `groundwork-review` (Protocols 8–9) before commit, with the matching `document_type`.

Pace this with the user (Protocol 4) — agree how deep the content pass goes; a full-corpus rewrite is rarely what they want, and the structural site uplift (Steps 1–2) delivers most of the visible win on its own.

---

## Step 4: Verify and report

- Build the site (or its type-check) and confirm it compiles, a `mermaid` block renders, the sidebar is ordered, and the landing page renders.
- Re-walk T1–T6 and report which were already met, which you changed, and what content you graduated or rewrote. List every doc touched (this is the Living Documents change list, Protocol 2).
- If you opened ADRs while graduating residue, name them.
