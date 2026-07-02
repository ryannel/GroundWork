# Shared Foundation (Brand Level)

A product has one brand — one mood, one personality, one interaction philosophy, one language — no matter how many interface types express it. This flow establishes that brand once. The type tracks (`graphical-ui.md`, `cli.md`, `agentic-protocol.md`) then translate it into each medium: CSS tokens for a screen, ANSI roles for a terminal, protocol semantics for an agent surface. Running the brand conversation per type would ask the user to decide their product's personality twice and invite the two answers to drift; running translation at brand level would produce a spec too abstract to implement. The split keeps each conversation at its right altitude.

This file owns the session's spine:

1. **Phases 1–4 run once, here.** Each phase pulls the type-specific contributions it needs from the active tracks' `Foundation Contributions` sections — the envelope dimensions, research palettes, and language dimensions that genuinely differ by medium. Phase 3 (structure) is the exception: it is inherently per type, so this flow runs each active track's Phase 3 in turn.
2. **Phase 5 (translation + guided review) runs once per active type.** Load each active track's Phase 5 and execute it; the track is authoritative for its medium's translation.
3. **Phase 6 (commit) runs once, here,** after every active type's walkthrough completes.

The active types were recorded in `.groundwork/cache/design-system-cache.md` during initialization. With one active type, this flow degrades to the familiar single-track session — the same phases in the same order, with the foundation and the type conversation indistinguishable to the user.

Before Phase 1, read each active track's **Default Stance** and **Foundation Contributions** sections in full — they carry the defaults, palettes, and dimensions the phases below draw on.

---

## Cross-Phase Signal Capture

Design conversations routinely surface signals that belong to a different phase — a performance target or startup budget with infrastructure implications, an offline expectation or configuration store that shapes data architecture, a sequencing instinct about which features ship first. As these signals arise during any phase — foundation or track — append them as bullets under the matching section header in `.groundwork/cache/discovery-notes.md`: `## Architecture` for infrastructure or technology opinions, `## Design Details` for async, schema, or contract implications, `## Bets` for feature sequencing, `## Product Brief` for vision-level refinements — then return to the current topic. Capturing them now means the downstream phase finds them instead of asking the user to repeat themselves.

---

## Phase 1: Non-Functional Requirements (NFR)

NFRs define the engineering envelope the design system must operate within. Budgets, baselines, and tolerance policies constrain design choices downstream — a design system that specifies 300ms transitions inside a 50ms interaction budget, rich interactive prompts for a tool that must run headless in CI, or rich diagnostic output inside a 4K-token context budget is internally contradictory.

Read `docs/product-brief.md`. For each active type, apply its track's **Envelope** contribution — the dimensions to cover, the type defaults to advocate, and any pre-step the track requires (the CLI track settles its composable/interactive/hybrid paradigm before anything else, because that decision shapes its whole envelope). Using the product brief and those track defaults as your starting position, draft one complete NFR proposal immediately — do not open with questions. The proposal covers the product-wide envelope and each active type's envelope; when two types share a dimension (error tolerance, offline behaviour), state it once at product level and note any per-type divergence. Skip dimensions that are clearly irrelevant to the product.

Present the proposed NFRs in full and invite the user to confirm, challenge, or adjust specific items. The proposal is the starting position — accept what the user confirms, revise what they challenge. Once approved, write the confirmed NFRs to the Phase 1 section of `.groundwork/cache/design-system-cache.md` and set its status to `done`. Proceed to Phase 2.

---

## Phase 2: Research

The inspiration library grounds the design conversation in concrete, existing products. Abstract discussions ("make it premium", "make it precise") produce vague specs. Discussions anchored in specific examples — Linear's command palette rendering from local cache before the server responds, ripgrep streaming results so the first match appears before the search completes, Terraform's plan-apply-verify loop forcing explicit approval before any state mutation — produce actionable design decisions.

Drawing on the product context and agreed NFRs from Phase 1, identify the 3–5 core design challenges this product faces (e.g., "async generation with delayed delivery," "streaming dense results into a terminal," "media-heavy reading experience"). For each challenge, find 1–2 leading products that solve it exceptionally well, pulling from each active track's Default Stance palette and any **Research notes** in its Foundation Contributions. Match sources to what was settled in Phase 1 — an interactive CLI needs interactive exemplars; a composable one does not borrow REPL patterns it will never use. Describe the **specific pattern, interaction, or mechanism** worth borrowing — not just the product's reputation. Aim for 5–8 references total; when several types are active, every type's challenges must be represented. Breadth across challenges is more valuable than depth on one.

Present this Inspiration Library and ask for the user's reaction. Do they agree? Are there specific paradigms they want to adopt? Do not proceed until they have confirmed the direction.

Once approved, write to the Phase 2 section of `.groundwork/cache/design-system-cache.md` and set its status to `done`. Proceed to Phase 3.

---

## Phase 3: Structure (Per Type)

Structure is the one foundation-stage conversation that cannot run at brand level: a screen product needs an app shell, a terminal product needs a command architecture, a protocol product needs a workspace topology. Each is the structural container every later decision for that type lives inside — getting it wrong means reworking every downstream decision the type makes, getting it right means every one of them has a home — and Phase 4's language conversation reacts to it.

For each active type, in turn: define the structural skeleton using patterns from the Phase 2 inspiration library, exploring and proposing decisions across the track's decision dimensions (its Phase 3 section names them). Guide the conversation with leading-edge patterns for the type; propose the structure based on the inspiration library, then ask the user to react and refine. When a structural decision implies a backend or infrastructure capability, append the implication as a bullet under `## Architecture` in `.groundwork/cache/discovery-notes.md` before continuing the conversation — the architecture phase finds these notes and skips re-deriving what was already decided here; each track's Phase 3 section names its own capture examples.

Once a type's structure is approved, write it to that type's subsection under Phase 3 in `.groundwork/cache/design-system-cache.md` and set that subsection to `done`. When every active type's structure is approved, set the Phase 3 status to `done` and proceed to Phase 4.

---

## Phase 4: Brand Language

This phase captures the user's taste — the brand's mood, personality, interaction philosophy, and language — as the raw material every type's Phase 5 translation draws from. The user should never need to think about specific values, in any medium. Decide the brand once; let each type express it.

Draw on the product brief for identity and audience context, and on the inspiration library from Phase 2 for concrete reference points. Cover the language in three focused clusters — grouping related decisions so the user can react to a coherent stance rather than isolated individual choices. Each cluster pairs the brand-level core below with each active type's dimensions for that cluster, taken from the track's **Type language** contribution, so the brand stance and its per-medium expression are settled in the same conversation. For each cluster, open with a cohesive proposal that reflects what the product brief and inspiration library suggest, then invite the user to react and redirect.

**Cluster 1: Identity** — The brand's personality and emotional register: what the product feels like, how it speaks, and what vocabulary conventions carry that identity. Fold in each active type's identity dimensions.

**Cluster 2: Feel** — Information density, pacing, and feedback philosophy: how much the product communicates, how physical or restrained it feels, and how it signals work in progress. Fold in each active type's feel dimensions.

**Cluster 3: Craft** — Error philosophy and microcopy character: how the product behaves when things go wrong, and how its smallest text units feel. Fold in each active type's craft dimensions.

After each cluster proposal, invite the user to react and refine before advancing. Mark each cluster as covered in `.groundwork/cache/design-system-cache.md` as you go. Skip a dimension only when it is clearly irrelevant to the product.

### Synthesis Gate

Before caching, distill the entire Phase 4 conversation into a structured design direction and present it to the user for confirmation. Scattered conversation notes are not sufficient input for Phase 5 — the synthesis forces the agent to reconcile any contradictions and present a coherent vision.

The synthesis stays in the user's language. No CSS values, no ANSI codes, no state schemas. It captures the *decisions* the user made in terms they recognise and can confidently approve or correct.

Brand-level fields, always:

- **Brand personality**: A short characterisation of the overall feel and voice.
- **Emotional register**: The mood and temperature the product carries.
- **Voice and tone**: How the product speaks to its users.
- **Information density**: How much the product communicates per view or per turn.
- **Feedback philosophy**: How the product responds to the user working — motion, progress, status.
- **Error philosophy**: How failures feel and how much the product explains.

Plus each active type's expression fields, listed in its track's Type language contribution.

Present this as a clear summary the user can scan and approve in one read. Ask them to confirm or correct before proceeding.

Once confirmed, write the synthesis to the Phase 4 section of `.groundwork/cache/design-system-cache.md` and set its status to `done`. Proceed to Phase 5.

---

## Phase 5: Per-Type Translation & Review

For each active type in turn, run the machinery below and pull in its track's medium-specific content at each step — the file table, Base Token Resolution (where the track has one), the Translation Mandate, and the Quality Standard exemplars. This file is the single source of truth for how translation, review, and the walkthrough execute; each track is the single source of truth for its medium's translation and depth calibration. Track each type's walkthrough progress separately in `.groundwork/cache/design-system-cache.md`.

### Standalone invocation (surface-activation)

`groundwork-surface-activation` runs this Phase 5 directly, without the rest of this file, when a product gains a surface of a type it has never expressed before. In that invocation, the Phase 1–4 brand direction — which this section normally draws from the live cache — instead lives in the already-committed foundation sections of `docs/design-system.md`: read those in place of `.groundwork/cache/design-system-cache.md`'s Phase 1–4 fields. The commit at the end of the walkthrough is surface-activation's own append-the-section step, not this file's Phase 6. Every other mechanic below — the per-file draft directory, the Independent Review pass, the 5b walkthrough, and the Re-flow Protocol — runs exactly as written.

### 5a: Translation (Agent-Driven, Autonomous)

The user provided taste, instinct, and direction across Phases 1–4 (or, in a standalone invocation, the committed foundation). The agent now translates that into a rigorous, medium-specific specification — autonomously.

**Output location**: `.groundwork/cache/design-system-draft/` — a directory of per-section files. Each file stays bounded in size, so any later change (review revise, 5b re-flow) touches only the affected files instead of regenerating the whole spec in a single turn. Regenerating the whole spec at once exhausts the per-response output token budget on rich specs; the per-section layout makes that failure structurally impossible. Writing to `docs/design-system.md` is prohibited until Phase 6 (Commit) — on initial generation that file does not exist; do not attempt to read it.

**Write each section as a separate file.** Use one `write_file` call per section (the tool creates parent directories automatically); the active track's file table names the sections and their content. The numeric prefixes determine concatenation order at commit; each file is a self-contained markdown section, starting its top-level heading at H1 or H2 as appropriate so the files compose cleanly when concatenated.

Apply the `groundwork-writer` skill to every file: declarative, assertive, free of hedging — a rigorous specification that simultaneously serves as implementation instructions for a developer or an AI tool.

Before presenting the draft, run this self-check:
1. **Does every section contain committed, implementable values?** If a section reads like a design brief, the translation is incomplete.
2. **Does every section have multi-value depth?** A single property or a one-line rule is insufficient — each concept needs its full, concrete treatment (the active track's Quality Standard names what "full" means for this medium).
3. **Would an implementer need to make any design decisions?** If yes, the spec is underspecified. Make the call — that is the agent's core contribution.

Update this type's Phase 5 entry in `.groundwork/cache/design-system-cache.md` to `draft-complete`. **Do not present a summary and ask for blanket approval.** Proceed directly to the Independent Review pass.

### Draft Layout

All types share one draft directory, `.groundwork/cache/design-system-draft/`, concatenated by filename at commit.

**Single active type:** use the track's file table exactly as written, with one change — the first type-specific section file (`02-…`) opens with the type's section title as its first line (`# Graphical UI`, `# CLI`, or `# Agentic Protocol`) so `docs/surfaces.md` design-track references (`docs/design-system.md § CLI`) resolve. Everything else, including heading levels, is unchanged.

**Several active types:**

- `00-header.md` and `01-foundation.md` are written once, by the first type's 5a run. `00-header.md` carries the document title and intro as the track describes — no summary section; the Downstream Context (Protocol 5) is written separately to `.groundwork/context/design-system.md` at commit, not concatenated into the spec. `01-foundation.md` carries `# Part 1 — Foundation`: the product-wide constraints from Phase 1 and the brand language direction from Phase 4 in specification form — the shared reference every type section translates, and the anchor for cross-surface consistency.
- Each type's section files take a decade prefix in run order (`10-`, `20-`, `30-`) with the type slug in the name — e.g. `10-graphical-ui-shell.md`, `20-cli-command-architecture.md` — replacing the track table's `02-`…`07-` prefixes; the section content per file is as the track's table defines, except that each type's envelope-specific constraints open its own section rather than sharing Part 1. The type's first file opens with the type's `#`-level section title, and the track's part headings demote one level beneath it so section boundaries stay unambiguous when the document is read as a whole.
- The numeric prefixes keep `cat *.md` concatenation in order: header, foundation, then each type's section.

The Independent Review pass between 5a and 5b — the fail-closed `groundwork-review` gate (Protocol 8/9) over the assembled draft — is owned by each track's own Phase 5 section, not restated here: the dispatch mechanics are identical across tracks, but the per-medium review risk they name is not, and the operating contract's review-gate conformance check reads the gate directly off each track file. Run whichever active track's Independent Review section says, in turn, before that type's 5b.

### 5b: Guided Review (Collaborative)

The draft is a proposal. Present it to the user as one — explicitly frame it as what the agent built from their direction.

**Do not ask the user to approve the full spec.** Do not present a summary of highlights and ask "does this look right?" Instead, walk through the spec in the active track's three focused clusters, each earning approval before advancing. When the user wants to push a section deeper — or a section reads thin against the track's quality standard — load `.groundwork/skills/groundwork-elicit/instructions.md` and follow it.

The cluster names each track uses are deliberately distinct from the Phase 4 language clusters (Identity / Feel / Craft) — Phase 4 grouped *aesthetic decisions* the user owns; this walkthrough covers *implementation specifics* the agent owns. Distinct names keep both schemes legible when both phases are referenced in the same conversation. Each track's Phase 5 names its own three clusters and states what each presents, teaches, and offers as alternatives.

#### Re-flow Protocol

When the user requests a change in any cluster:

1. Acknowledge the change and confirm understanding.
2. Assess downstream impact — state explicitly which section files are affected, including any downstream files whose tokens or rules reference the change.
3. **Rewrite the affected section files.** Each section lives in its own file under `.groundwork/cache/design-system-draft/`. Use `write_file` to replace the implicated files in turn. Each `write_file` is bounded by the size of one section, never the whole spec.
4. Summarise the re-flow: list every section file that changed and what specifically shifted.
5. If a previously-approved cluster was affected substantively, re-present it before continuing.

A design system is a web of interconnected decisions — changing one primitive ripples into whatever downstream section references it. Propagate the change into every section file it implicates — file-by-file, never as a single full-spec rewrite. Isolated edits that ignore downstream effects create internal contradictions that surface during implementation; the propagation is mandatory, the file-at-a-time mechanic is what makes it safe.

#### Walkthrough Progress

Track which clusters have been reviewed in `.groundwork/cache/design-system-cache.md` under the Phase 5 checklist. Mark each cluster as complete when the user approves it. This enables session resumption — if the conversation is interrupted, the agent sees which clusters have been reviewed and resumes from the next unchecked item.

#### Completion Gate

The walkthrough is complete when all three of the active track's clusters have been presented and approved. Mark this type's walkthrough done in the cache, then return to this flow — it proceeds to the next active type's translation, or to Phase 6 (Commit) when this is the last.

When the last active type's walkthrough completes, proceed to Phase 6.

---

## Phase 6: Commit

Execute **only** after every active type's Phase 5b walkthrough is complete and the user has explicitly approved each type's specification. Verify every walkthrough checklist in `.groundwork/cache/design-system-cache.md` is marked complete before proceeding.

Follow the Phase Lifecycle commit protocol from the Operating Contract:

1. **Write the Downstream Context file (Protocol 5).** Apply `groundwork-writer` to write `.groundwork/context/design-system.md` — the four-subsection contract per Protocol 5 of the operating contract: Key Decisions covering the brand foundation and every active type (each track's Commit Contributions section names its key-decision set), Binding Constraints (accessibility floors, performance budgets, fallback chains, machine-readability requirements), Deferred Questions, Out of Scope. This is written to the ephemeral context store, not into `docs/design-system.md` — the assembled spec carries no summary section.

   **Trigger the Design References pass.** When a `graphical-ui` type is active, run the graphical-ui track's Design References pass now (Commit Contributions) — it owns the full record spec (the convergent research pass, the per-product shape, the technique-library stance, and its two consumers). The `visual` block's `references` array (step 3) carries the named set machine-readably.

2. **Assemble the final spec.** Concatenate the section files into the canonical location: `run_command("cat .groundwork/cache/design-system-draft/*.md > docs/design-system.md")`. The numeric prefixes guarantee the correct order — the glob picks up per-type decades and the CLI track's `06`/`07` files automatically. This is a shell operation, not a model emission — it does not consume output tokens regardless of spec size.

3. **Emit brand tokens.** Write `.groundwork/config/brand-tokens.json` following the contract at `.groundwork/skills/groundwork-design-system/templates/brand-tokens.md`: the Tier 1 `identity` block always (every product gets a branded `./dev` CLI), plus one Tier 2 block per active type that defines one — `terminal` from the CLI track, `visual` from the graphical-ui track; the agentic-protocol track contributes no Tier 2 block. Each block carries the *same* values as the corresponding type section just written into `docs/design-system.md` — this is a mechanical projection of approved decisions, not a new conversation. The file lives in persistent config and is not removed by the cache cleanup in the next step.

4. **Write the hand-off file.** Copy `.groundwork/skills/templates/handoff.md` to `.groundwork/cache/handoff/design-system.md` and fill in only the sections that have content: rejected directions, deferred design decisions, and user instincts not yet committed — each active track's Commit Contributions section lists what its medium typically leaves behind — plus any other context the architecture phase needs. Omit empty sections.

5. **Clean up caches.** Remove the draft directory, the design-system cache, and the consumed previous hand-off: `run_command("rm -rf .groundwork/cache/design-system-draft .groundwork/cache/design-system-cache.md .groundwork/cache/handoff/product-brief.md")`. Cache Isolation (Protocol 7) requires the previous hand-off to be deleted once consumed.

6. Apply the Living Documents protocol — scan the conversation for insights that refine any existing `docs/` artifact (e.g. `docs/product-brief.md`). Apply surgical updates and refresh the affected Downstream Context files in `.groundwork/context/` (Protocol 5). Report what changed. If an update **reverses** a prior Key Decision or Binding Constraint (Protocol 2 — e.g. the design system overturns a brief commitment), follow the Reversal Protocol: reconcile the full body of the affected doc, fix dependent docs, write the superseding ADR, and re-invoke `groundwork-review` on each mutated doc before committing.

7. Update discovery notes — scan for out-of-phase signals not captured in real time. Remove `## Design System` entries incorporated into `docs/design-system.md` or the hand-off file.

8. Confirm that the phase is complete.

9. Recommend a fresh context for the next phase — a clean context gives the next skill full working memory.

10. Immediately load and execute the `groundwork-orchestrator` skill to show the user what's next. Do not ask the user to invoke it — hand off automatically.
