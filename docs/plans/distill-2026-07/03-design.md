# Distillation Plan — Design

Status: PROPOSED (input to the master distillation plan)
Scope (wc -w):

| File | Words |
|---|---|
| src/hidden-skills/groundwork-design-system/instructions.md | 2,214 |
| src/hidden-skills/groundwork-design-system/tracks/_foundation.md | 2,588 |
| src/hidden-skills/groundwork-design-system/tracks/graphical-ui.md | 4,908 |
| src/hidden-skills/groundwork-design-system/tracks/cli.md | 5,164 |
| src/hidden-skills/groundwork-design-system/tracks/agentic-protocol.md | 3,580 |
| src/hidden-skills/groundwork-design-system/templates/brand-tokens.md | 2,437 |
| src/hidden-skills/groundwork-design-system/templates/design-system-cache.md | 321 |
| src/hidden-skills/groundwork-designer/SKILL.md | 1,695 |
| src/hidden-skills/groundwork-designer/references/ (8 files) | 5,436 |
| src/hidden-skills/groundwork-designer/sync-anchor.md | 135 |
| src/docs/principles/design/ (7 files) | 9,759 |
| **Total** | **38,243** |

---

## 1. Intention

The Design section exists to turn a user's felt aesthetic intent into an implementation-ready specification that removes every downstream design decision, and then to keep a design conscience present at every later moment a look/feel/behaviour call is made (bet design, delivery review, validation). Three mechanisms carry it: a facilitation workflow (design-system), a portable expert persona (designer), and the principle corpus the persona distils from.

Per-file intention map:

- **design-system/instructions.md** — Boot the session: establish the intent-in/specification-out contract, adopt the designer persona, detect the interface-type set, and route into the foundation flow. Everything after routing belongs to the files it routes to.
- **tracks/_foundation.md** — Own the session spine: run the brand conversation once (Phases 1–4), dispatch each type's Phase 3 and Phase 5, and run the single commit (Phase 6) that assembles the spec, emits brand tokens, and writes the cross-phase contract files.
- **tracks/graphical-ui.md / cli.md / agentic-protocol.md** — Supply each medium's design content: opinionated defaults with reasoning, the envelope/language dimensions the foundation phases fold in, the structure conversation, and the translation mandate with a calibrated quality bar so the autonomous 5a draft is deep, not plausible.
- **templates/brand-tokens.md** — The machine contract for `.groundwork/config/brand-tokens.json`: what each block carries, who writes it, who reads it, and what depth a projected value must have (the annotated example is the calibrator generators and extract sessions copy from).
- **templates/design-system-cache.md** — Resume skeleton; phase statuses and walkthrough checklists.
- **designer/SKILL.md** — The portable persona: identity, decision routing into references, first checks, handoffs, safety gates, output expectations — so any adopting workflow gets the same designer with no corpus dependency.
- **designer/references/*** — Decision-time distillations of the corpus (plus the self-authored design-review.md): the reasoning the persona applies without loading 9.7k words of corpus.
- **designer/sync-anchor.md** — The drift tripwire: corpus edits force a reference review in the same commit.
- **src/docs/principles/design/*** — The durable design canon: the researched, human-readable source the references distil and the manifesto beliefs trace to.

---

## 2. Findings

| ID | Where | Finding | Severity |
|---|---|---|---|
| DESIGN-1 | tracks/graphical-ui.md, cli.md, agentic-protocol.md — "Independent Review (Pre-Walkthrough)", "5b: Guided Review" framing + "Re-flow Protocol" + "Walkthrough Progress" + "Completion Gate", 5a "Output location" preamble, pre-draft self-check | **Triplicated Phase-5 machinery.** ~1,000 words of near-verbatim mechanics per track (identical sentences: "This is a shell operation, not a model emission", "the propagation is mandatory, the file-at-a-time mechanic is what makes it safe", the six review steps, the five re-flow steps, the "cluster names are deliberately distinct from Phase 4" paragraph). Every session loads `_foundation.md` *plus* the active tracks, so the duplication is a direct context cost and a 3× drift surface — a fix to the review loop must land in three files. | high |
| DESIGN-2 | Same three tracks, each "Phase 3" section | **Duplicated Phase-3 skeleton.** The scaffolding sentences repeat per track ("…is the structural container everything else lives inside — Getting this wrong means reworking every X", the discovery-notes capture instruction, the approve/cache/return closer); only the decision-dimension list and examples differ. | med |
| DESIGN-3 | design-system/instructions.md "Commit Contract" + "Brand tokens" paragraph | **Dead instruction + triple statement.** Restates `_foundation.md` Phase 6 and templates/brand-tokens.md — yet Step 3 orders "DO NOT retain these initialization instructions in context once the foundation is loaded," so this ~300-word restatement is discarded before the commit it governs. The commit is specified three times (instructions, foundation Phase 6, template). | med |
| DESIGN-4 | _foundation.md Phase 6 step 1 ("Persist the design references as a technique library", ~230 words) vs graphical-ui.md Commit Contributions "Design References" bullet (~120 words) | **Two owners of one cross-phase artifact.** Both specify the `## Design References` record (per-product name/qualities/challenge, ≥3 products) with slightly different wording ("never screenshots" vs "not stored imagery"). `## Design References` is read by bet 02-design (micro-polish spec), the experience-auditor/Tier-3 critique, design-system-extract, and mirrored into the `visual.references` array — a drifted spec here silently degrades all of them. | med |
| DESIGN-5 | instructions.md Step 2 (Interface Type Detection, ~700 words); design-system-extract/instructions.md Stage 1 | **Classification rule stated twice, padded once.** Step 2 follows its table with four successive disambiguation paragraphs that partially restate the table and each other ("The interface type describes what the end-user interacts with…", "If the product brief describes end-consumers…", "Disambiguate `cli` from `agentic-protocol` by who consumes the output…", "If the product brief contains explicit interface vocabulary…"). The extract skill carries its own compressed paraphrase of the same rule — two writers of `interface_types` classifying from different texts. | med |
| DESIGN-6 | instructions.md "Adopt the designer persona" paragraph; groundwork-bet/workflows/02-design.md Step 1.95 ¶2 | **Adoption seams restate the persona's routing table.** Both re-enumerate which designer reference covers what ("perceptual colour and type in `visual-craft.md`, spacing and grid in `layout-and-space.md`…"). The persona's Context Routing table owns this; a routing change in the persona strands two paraphrases. (The architect adoption at 02-design line 35 correctly does *not* restate routing.) | low |
| DESIGN-7 | tracks/cli.md "Verification Gate", tracks/agentic-protocol.md "Verification Gate" | **Delivery canon in a file delivery never loads.** Only the design-system session and surface-activation load track files (verified: no other skill references `tracks/`); the three-tier proof runs in bet 04-delivery, which already carries the medium-general rule ("a `cli` or `agentic-protocol` milestone proves at its own front door"). Asymmetric too — graphical-ui.md has no such section. Protocol named where it is not enacted. | med |
| DESIGN-8 | operating-contract Protocol 1; instructions.md Step 1.5 ¶2; _foundation.md "Cross-Phase Signal Capture" | **Signal capture stated three times per session.** The contract fully specifies capture + headers; Step 1.5 ¶2 restates it generically; _foundation restates it with design-calibrated examples (the only version adding value). | low |
| DESIGN-9 | Each track: "Design System Target Structure" vs the "same standard applies across the entire specification" depth-bullet list | **Same-file section list twice.** The Part-3 section names appear once bare (coverage) and once with depth cues ("Not just token names — full OKLCH values…"). The depth cues are load-bearing calibration (skill-writer "Quality bars"); the bare list is not. | low |
| DESIGN-10 | templates/brand-tokens.md, `visual` field reference, `references` bullet | **Structural defect in a shipped contract.** The `platform` field's introductory text ("Sub-objects keyed by platform dimension; each theme projection reads the sub-object it serves… Web needs no sub-object…") is fused onto the end of the `references` bullet — the `- platform` bullet header is missing, so the contract misattributes platform semantics to `references`, with `platform.touch`/`platform.desktop` orphaned beneath the wrong parent. | med |
| DESIGN-11 | designer/references/usability-and-ux.md vs src/docs/principles/design/usability-and-ux.md principles 8–9; groundwork-bet/workflows/02-design.md Step 1.95 | **Distillation gap; content parked in one consumer.** Corpus principles 8 ("Usable has a floor you can check and a ceiling you judge") and 9 ("Solve UX problems with the patterns the best products use now, implemented fully", + the half-built-pattern antipattern) have no counterpart in the persona's reference. Instead the pattern discipline lives as a ~190-word inline paragraph in bet 02-design Step 1.95 (filter-pill/skeleton examples near-copied from the corpus) — so the persona's other adoption points (design-system setup, validation §87 doc updates, Tier-2 review) never receive it, and the bet copy drifts independently of the sync-anchored corpus. The sync-anchor shows usability-and-ux was re-stamped 2026-06-27 without closing this. | med |
| DESIGN-12 | tracks/graphical-ui.md Default Stance "Technical defaults" | **Mild intent contradiction.** instructions.md mandates persona adoption and says "load that reference and apply its reasoning rather than re-deriving it here", yet the track re-derives OKLCH/8-point/hardware-acceleration reasoning that visual-craft.md carries at greater depth. Skill-writer's "Opinionated defaults need reasoning" sanctions *one sentence* per default; several run to two or three. | low |
| DESIGN-13 | src/docs/principles/design/* (all 7 files) | **Corpus format overhead is structural, not local.** TL;DR + Anti-patterns mirror the numbered principles at ~25–30% of each file; the designer references prove the same content compresses to ~40–60% with zero decision loss. But the format is shared with the whole principles corpus (foundations, system-design, quality) — a design-only format change would fork the corpus. | low |
| DESIGN-14 | groundwork-surface-activation/instructions.md §"run the type's track lazily" | **Restructure hazard, not a current defect.** The lazy-activation path loads *only* `tracks/<type>.md` and executes "its Phase 5 in full", explicitly standing in for the foundation flow. Any extraction of shared Phase-5 machinery out of the tracks (DESIGN-1) silently strips the review gate and re-flow protocol from lazy activation unless surface-activation loads the machinery too, in the same commit. | med |
| DESIGN-15 | All three tracks, "Independent Review" steps 3–4 | **Operating-contract non-conformance by over-statement.** Protocol 9 states "the dispatch mechanics and the failure procedure live here and are never restated per skill" — yet each track restates the fail-closed rule, the verdict grammar, the revise loop, and the cap ("proceed only on a parseable `VERDICT: PRESENT`; a review that errors, hangs, or returns no verdict…"). Three restatements of a contract that forbids restatement; a Protocol 8/9 change now has four places to drift. | med |
| DESIGN-16 | instructions.md "How This Conversation Works" | **Generic posture bullets duplicating Protocol 4 and the persona.** "Discover before proposing / use the user's language / orient the user" restate conversational-pacing and expert-peer content the operating contract and adopted persona already carry; only "teach acronyms you introduce" is design-specific. | low |

**Judged and kept (calibration, not bloat):** the deep-vs-shallow Quality Standard pairs (one per track, two in cli.md — the second calibrates interactive-surface depth, the CLI track's distinctive risk); the Translation Mandate examples ("warm vellum" → `oklch(96% 0.008 60)`); the Base Token Resolution fill-in block in graphical-ui.md; brand-tokens.md's annotated JSON example; the per-area depth bullets (after the DESIGN-9 merge). These are exactly skill-writer's "the agent calibrates against the example, not the adjective." The designer references are genuinely good distillations — decision-time framing, honest compression (visual-craft 1,039 w from 1,833; usability 659 from 1,599), antipatterns preserved — not near-copies; the persona pattern itself needs no surgery.

---

## 3. Distillation moves

**MOVE-1 — Extract the shared Phase-5 machinery into `_foundation.md`** *(DESIGN-1, DESIGN-15, DESIGN-14)*
`_foundation.md` already owns the session spine and the Draft Layout rule; give it the rest of the machinery, stated once:

- The 5a mechanics: draft directory rationale (bounded per-section files, the output-token-budget argument), the "one `write_file` per section" rule, prefix/concatenation rules, the single-type vs multi-type layout (already there — the per-track trailing paraphrases "This table is the single-active-type layout; the foundation flow's Draft Layout rule governs…" collapse into it).
- The Independent Review procedure — reduced to what Protocol 9 says a caller states: *when* it fires (after 5a, before 5b), *what* it passes (`document_path`: the concatenated draft, `document_type: design-system`), the assemble/clean-up shell steps, and carry-forward of 🟡 findings. Dispatch mechanics, verdict grammar, fail-closed handling, and the revise cap become a pointer to Protocols 8–9 — restoring conformance instead of restating it three times.
- The 5b mechanics: proposal framing, no-blanket-approval rule, the Phase-4-vs-5b cluster-naming rationale, elicit escalation, Re-flow Protocol, Walkthrough Progress, Completion Gate, and the pre-draft self-check (the three questions are medium-agnostic once "CSS values" becomes "committed, implementable values").

Each track's Phase 5 shrinks to its content: the file table, Translation Mandate, Quality Standard exemplars + merged depth list (MOVE-6), and one compact block per walkthrough cluster (what is presented, what to teach, what alternatives to offer). Sketch:

> Before: cli.md §Independent Review — 6 numbered steps, ~260 words, repeated in two sibling files.
> After: cli.md §Phase 5 ends with "Run the foundation flow's translation-review-walkthrough machinery over this track's files; the review's one CLI-specific risk framing: the user will not catch dropped Phase-4 commitments inside a walkthrough of ANSI mappings and output templates."

This improves delivery, not just size: one canonical review loop means a session with two active types executes the identical gate for both, and a protocol fix lands once. **Same commit requirement:** update groundwork-surface-activation's lazy-activation step to load `_foundation.md`'s Phase-5 machinery alongside the track (it already reads the committed foundation sections in place of the cache) — see FLAG(6).

**MOVE-2 — Extract the Phase-3 skeleton** *(DESIGN-2)*
`_foundation.md` Phase 3 gains the shared skeleton (container framing, propose-from-inspiration-library, the `## Architecture` discovery-notes capture, the approve/cache/return closer). Tracks keep only their decision-dimension lists and the per-type capture examples (auth backend vs notifications vs state-store — those examples are the calibration worth the words).

**MOVE-3 — Put instructions.md on a routing diet** *(DESIGN-3, DESIGN-16, DESIGN-6, DESIGN-8)*

- Commit Contract section → two lines: the commit runs once in the foundation flow's Phase 6; brand tokens follow `templates/brand-tokens.md`. Delete the restated Protocol 3.4/5/6 choreography and the Tier-1/Tier-2 recap (both live where they execute).
- Persona adoption paragraph → adopt the persona and defer to *its* Context Routing table; delete the reference-by-reference enumeration.
- "How This Conversation Works" → fold the one novel bullet (teach jargon you introduce) into the Core Contract; drop the Protocol-4 restatements.
- Step 1.5 ¶2 (capture restatement) → one pointer sentence; _foundation's design-calibrated capture section becomes the single in-skill statement.

**MOVE-4 — One disambiguation paragraph for interface types** *(DESIGN-5)*
Step 2 keeps: the Protocol-5 read order, the per-type table, the MVP-horizon active-set rule, and **one** consolidated disambiguation paragraph built on the single test that decides every listed edge case — *who consumes the output* (human at a screen → graphical-ui even with an AI backend; human at a terminal → cli even when an LLM drives it; a program integrating via API → agentic-protocol) — plus the ask-the-user fallback. Coordinate with the extract skill so its Stage-1 rule states the same one test in the same words (FLAG(4)); the two writers of `interface_types` must classify identically.

**MOVE-5 — Single owner for the Design References spec** *(DESIGN-4)*
graphical-ui.md Commit Contributions owns the full record spec (convergent research pass, per-product name/qualities-with-technique/challenge, ≥3 products, technique-library-not-mood-board, the two consumers, the `visual.references` mirror). `_foundation.md` Phase 6 step 1 keeps a one-sentence trigger: "when a graphical-ui type is active, run the graphical track's Design References pass now (Commit Contributions)." The extract skill's recovery paragraph points at the same owner for the record shape (FLAG(4)).

**MOVE-6 — Merge each track's Target Structure into its depth list** *(DESIGN-9)*
One list per track serving both coverage and calibration: every Part-3 section name with its "not just X — Y" depth cue. "Missing sections are not acceptable" heads the merged list so the coverage gate survives.

**MOVE-7 — Close the persona distillation gap, then thin the bet-side copy** *(DESIGN-11)*
Add two short sections to designer/references/usability-and-ux.md: "The floor is checkable; the ceiling is judged" (dead-end screens and missing async states are defects a review catches; coherence and pleasure are judged by eye against the system and references) and "Use the current best-in-class pattern, implemented completely" (converged patterns give forward-leaning + familiar; a half-implemented pattern is worse than none; promote a new pattern into the design system so the next screen inherits it) — plus `dead-end screens` and `the half-built pattern` antipatterns. Then bet 02-design Step 1.95's inline paragraph shrinks to a pointer + the bet-specific instruction (name the chosen pattern per view in `01-ui-design.md`) — FLAG(5). This is a net *behavioural* gain: every adoption point of the persona now carries the pattern discipline, and it tracks the sync-anchored corpus instead of a fork in a bet workflow. No sync-anchor re-stamp needed (the corpus files are untouched).

**MOVE-8 — Repair and trim the brand-tokens contract** *(DESIGN-10)*
Insert the missing `- platform` bullet header (optional; sub-objects keyed by platform dimension; each projection reads its sub-object; web needs none) so `platform.touch`/`platform.desktop` nest under it and the `references` bullet ends at "…committed a reference record." Trim the third statement of readers/writers: the block table's "Read by" column and the Rules' "Many readers, by key" bullet say the same thing — keep the table (it is the orientation surface), compress the rule to the one fact the table lacks (none of them write; none branch on `tier`).

**MOVE-9 — Relocate the verification-gate intent, cut the sections** *(DESIGN-7)*
Delete both Verification Gate sections. Keep their one durable sentence in each track's Commit Contributions: the committed type section is the vocabulary and reference bar delivery's medium-general proof tiers judge against (04-delivery owns the gate). Before cutting, confirm 04-delivery/native-check canon carries the per-medium capture mechanics the sections uniquely name (`subprocess`/`pexpect` capture for cli, response-payload capture for agentic-protocol) — if absent there, that single line moves to the delivery canon, not back here (FLAG(5)).

**MOVE-10 — Tighten Default Stance reasoning to one line per default** *(DESIGN-12)*
Keep every default and its one-sentence why (skill-writer sanctioned); trim second and third sentences whose reasoning the persona's references carry (e.g. the OKLCH default keeps "HEX lightness is not perceptual — equal steps look unequal across hues", drops the elaboration). Applies to all three tracks' Default Stance blocks.

---

## 4. Cuts

| Cut | Why safe |
|---|---|
| Verification Gate sections, cli.md + agentic-protocol.md (~330 words) | Never read at delivery time (no delivery file loads `tracks/`); 04-delivery §"Prove it in the consumer's medium" + Tiers 1–3 carry the intention where it executes. One-line pointer survives in Commit Contributions (MOVE-9). |
| instructions.md Commit Contract restatement + Brand tokens recap (~300 words) | The skill instructs the agent to drop instructions.md from context before commit; the surviving copies (_foundation Phase 6, brand-tokens.md) are the ones that execute. |
| Per-track Independent Review steps, Re-flow Protocol, Walkthrough Progress, Completion Gate, output-location preambles, self-checks (~2,000 words net across three tracks after the single ~800-word foundation statement) | Same words, one location, loaded in every session that loads any track. Nothing is lost; drift surface shrinks 3×→1×. |
| Per-track Protocol 8/9 mechanics restatement (~90 words × 3) | The operating contract mandates exactly this: mechanics "live here and are never restated per skill." The caller-side facts (when, document_path/type) are kept. |
| instructions.md reference-routing enumeration + 02-design Step 1.95 routing enumeration (~120 words) | The persona's Context Routing table is the authority; adopters point at it. Behaviour identical; drift eliminated. |
| Step 2's three redundant disambiguation paragraphs (~200 words) | The table + the one who-consumes-the-output test decide every case the paragraphs re-litigate; the ask-the-user fallback is kept. |
| instructions.md Step 1.5 ¶2 capture restatement; "How This Conversation Works" generic bullets (~150 words) | Protocol 1/Protocol 4 are loaded and binding; _foundation keeps the one design-calibrated capture statement. |
| Per-track bare "Target Structure" lists (~80 words × 3) | Merged into the depth lists — coverage gate and calibration both survive in one list. |
| _foundation Phase 6's long Design References spec (~180 words of its 230) | Single owner in graphical-ui Commit Contributions (MOVE-5); the trigger sentence remains at the commit step. |
| Default Stance second/third-sentence elaborations (~150 words across tracks) | One-line reasoning kept per default; deeper reasoning lives in the mandatorily-adopted persona's references. |

Not cut, deliberately: both cli.md deep/shallow pairs; the Base Token Resolution block; brand-tokens.md's annotated example; the mobile/desktop Platform Dimension subsections (right altitude — spec vocabulary, token-level, pointers into the brand-tokens contract, no Dart/widget prescription); the designer references (they are the model the rest of the repo should follow).

---

## 5. Risks & cross-section flags

**Cross-phase identifiers touched (writers → readers) — none renamed by this plan; listed because the moves relocate their specifying text:**

- `interface_types` + type slugs (`graphical-ui`/`cli`/`agentic-protocol`): written by design-system Step 2 and design-system-extract Stage 1 → read by the track loader, surface-activation, the surface registry/scaffold chain, bet 02-design vocabulary, brand-tokens Tier-2 block selection. MOVE-4 consolidates the *rule text*; the identifier strings are untouched.
- Section titles `# Graphical UI` / `# CLI` / `# Agentic Protocol` in docs/design-system.md: written by the Draft Layout rule and extract → read by `docs/surfaces.md` design-track references (`docs/design-system.md § CLI`) and surface-activation. Draft Layout stays in _foundation; titles unchanged.
- `## Design References` + `visual.references`: written by _foundation Phase 6 / graphical-ui Commit Contributions / extract → read by bet 02-design Step 1.95, experience-auditor/Tier-3, and the token projection. MOVE-5 changes which file specifies the record, not the record.
- `brand-tokens.json` blocks and atmosphere token names (`identity`/`terminal`/`visual`; `elevation`, `blur`, `gradients`, `surface`, `motion.interactions`, `typography.roles`, `platform.*`): contract in templates/brand-tokens.md → read by workspace-dev-cli, nextjs-app generator (`app/brand.css` projection), `test_token_conformance.py`, cli-app generator, extract. MOVE-8 fixes nesting only; no field or key changes, so the generator/test consumers are unaffected (`version` stays 1).
- Draft dir `.groundwork/cache/design-system-draft/` + numeric prefixes: written by tracks → consumed by the Phase-6 `cat`, the review assembly, and surface-activation's cleanup. Machinery relocation keeps the paths verbatim.
- Track filenames `tracks/<type>.md`: loaded by name from instructions.md Step 3 and surface-activation. This plan does not rename or split track files — the extraction target is the existing `_foundation.md`, precisely so no loader changes beyond FLAG(6).

**Execution risks:**

- **Lazy-activation coupling (highest).** MOVE-1 is unsafe without the surface-activation edit landing in the same commit — otherwise a lazily activated type runs Phase 5 with no review gate and no re-flow protocol. See FLAG(6).
- **Sync-anchor cascade.** MOVE-7 edits a designer reference without touching the corpus — no hash re-stamp needed. But if section 8 rewrites any `src/docs/principles/design/*` file, all affected designer sync-anchor pins re-stamp and the matching references re-review in the same commit (8 pins; `./dev test contracts` gates it). Sequence: land this plan's reference addition either before or as part of any corpus rewrite, not interleaved.
- **Operating-contract conformance.** MOVE-1 must keep the caller-side obligations Protocol 9 assigns (what is passed, when it fires) while deleting only the restated mechanics; a review of the extracted text against Protocols 8–9 is the acceptance check.
- **Shipped-surface classification.** Every touched file is tier-1 framework-owned (hidden skills incl. templates) and clean-replaced on `update` → changelog `[no-migration]`; no registry migration, no reconcile family. Output shapes (design-system.md structure, brand-tokens.json schema) are unchanged, so groundwork-update's Family Index needs no new family.
- **Multi-type sessions are the regression case.** The machinery extraction changes what a two-type session reads; the acceptance check is a dry read-through of the hybrid case (graphical-ui + cli) confirming decade prefixes, the `06`/`07` CLI files, and the per-type walkthrough loop still compose from the single Draft Layout statement.

**Flags:**

- FLAG(4): design-system-extract Stage 1 carries a compressed paraphrase of the interface-type classification rule and a second description of the `## Design References` record. After MOVE-4/MOVE-5, align the extract to the same one-test wording ("who consumes the output") and point its References recovery at the graphical-ui Commit Contributions owner — two writers of `interface_types` and of the References record must classify/shape identically.
- FLAG(5): bet 02-design Step 1.95 — (a) shrink the inline best-in-class-pattern paragraph to a pointer once designer references/usability-and-ux.md carries it (MOVE-7 here); (b) replace its reference-routing enumeration with a pointer to the persona's Context Routing table; (c) before the tracks' Verification Gate sections are cut (MOVE-9), confirm 04-delivery/native-check canon names the cli (`subprocess`/`pexpect`) and agentic-protocol (response payload) capture mechanics — adopt the one-liner there if absent.
- FLAG(6): groundwork-surface-activation's lazy-activation step loads only `tracks/<type>.md` and "execute[s] its Phase 5 in full", standing in for the foundation flow. MOVE-1 relocates the shared Phase-5 machinery into `_foundation.md`; update surface-activation **in the same commit** to load that machinery alongside the track, or lazy activation silently loses the review gate and re-flow protocol.
- FLAG(7): persona-adoption pattern rule for all three personas: an adoption seam is a pointer — adopters must not re-enumerate the persona's Context Routing rows (design-system instructions.md and bet 02-design both do this for the designer; the architect adoption in the same 02-design file correctly does not). Sweep architect/product adopters for the same restatement and codify the rule where the persona pattern is documented.
- FLAG(8): two corpus-side items. (a) Format overhead: TL;DR + Anti-patterns mirror the numbered principles at ~25–30% per file across the whole principles corpus; the designer references demonstrate ~2× compression with no decision loss — if the principles section trims the house format, do it corpus-wide, and expect the designer sync-anchor cascade (8 pins re-stamped + 8 reference reviews in the same commit). (b) Process gap: usability-and-ux.md gained principles 8–9 (2026-06-27) and the sync-anchor was re-stamped without the persona reference gaining counterparts (DESIGN-11) — the anchor gate proves *review happened*, not *distillation happened*; consider requiring the review note to state where each new principle's distillation lives.
- FLAG(10): skill-writer's "Structural consistency across sibling skills" principle, read alone, licenses exactly the failure DESIGN-1 documents — contributors satisfied it by *copying* the shared lifecycle into every sibling. Add the complementary rule: when siblings share a lifecycle verbatim, consistency is achieved by extraction to the shared spine (the routing file the siblings already load), not by synchronized copies; copies are the fallback only when no shared file is loaded alongside.

---

## 6. Expected outcome

| File | Current | Target | Delta |
|---|---|---|---|
| design-system/instructions.md | 2,214 | ~1,450 | −760 |
| tracks/_foundation.md | 2,588 | ~3,150 | +560 (absorbs the single machinery statement) |
| tracks/graphical-ui.md | 4,908 | ~3,550 | −1,360 |
| tracks/cli.md | 5,164 | ~3,900 | −1,260 |
| tracks/agentic-protocol.md | 3,580 | ~2,500 | −1,080 |
| templates/brand-tokens.md | 2,437 | ~2,250 | −190 |
| templates/design-system-cache.md | 321 | 321 | 0 |
| designer/SKILL.md | 1,695 | ~1,660 | −35 |
| designer/references/ | 5,436 | ~5,570 | +130 (usability-and-ux gains floor/ceiling + pattern-completeness) |
| designer/sync-anchor.md | 135 | 135 | 0 |
| src/docs/principles/design/ | 9,759 | 9,759 | 0 here (format question flagged to section 8) |
| **Section total** | **38,243** | **~34,250** | **≈ −4,000 (−10%; −19% inside the 21k design-system skill)** |

**Behavioural improvements the deltas buy:**

- Every design-system session (and every multi-type session doubly so) loads ~2–3k fewer duplicated words, and the words it does load state each protocol once — the review gate, re-flow, and walkthrough behave identically across types because they *are* one text.
- Protocol 8/9 conformance is restored: a future contract change lands in the contract, not in three tracks that were forbidden to carry it.
- Lazy surface activation runs the same gated Phase 5 as setup (today it re-reads a copy; after FLAG(6) it reads the canonical one).
- The designer persona carries the pattern-completeness and floor/ceiling disciplines everywhere it is adopted — design-system setup, bet design, Tier-2 review, validation — instead of only where one bet workflow inlined them.
- The `## Design References` record and the interface-type classification each have one specifying text, so their many readers (bet design, experience-auditor, extract, token projection) stop depending on two paraphrases staying accidentally aligned.
- The brand-tokens contract parses correctly at the `platform` seam, removing a misread that could send platform ergonomics into the `references` array in extract or generator work.
- What was kept is the calibration that makes the 5a drafts deep — the quality-bar pairs, the translation-mandate examples, the token fill-in block — now easier to find because they are no longer interleaved with triplicated mechanics.
