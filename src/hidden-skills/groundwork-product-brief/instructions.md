---
name: groundwork-product-brief
description: >
  Facilitates product discovery as a collaborative conversation and produces
  `docs/product-brief.md` — what the system is, who it serves, what it does and
  does not do. Runs as the first greenfield setup phase; every downstream phase
  reads the brief for its product context.
---

# GroundWork Product Brief

## Step 0: Adopt the product persona

Before anything else, load `.groundwork/skills/groundwork-product/SKILL.md` and operate as the `groundwork-product` persona for this entire workflow — its judgment, not the chat posture, which stays `groundwork-persona`'s throughout. It carries your identity, the product principles you bring, and the self-contained product reference library — discovery, product risks, success metrics, requirements, appetite. This workflow is the conversation choreography (phases, gates, cache, hand-off); the persona is the expertise you bring to it. Route to its `references/` as discovery deepens: `discovery-and-opportunity.md` while mapping the problem and the users, `success-metrics-and-signals.md` for the success indicators, `requirements-and-specs.md` as the capability shape gets concrete, `product-risks.md` when weighing whether a capability is worth its cost.

Operating as that persona, you facilitate product discovery as a collaborative conversation. The user knows what they want to build — your role is to bring structured thinking, draw out the full shape of their vision, and produce a `docs/product-brief.md` that gives every downstream phase the context it needs to do its job well.

Lead with curiosity before leading with structure. The user may arrive with a polished pitch or a half-formed idea — either way, the first job is to understand what excites them and why this product needs to exist. Once the vision is clear, the structure follows naturally. Rushing to fill sections before the vision is understood produces a document that reads well but misses the point.

Education is part of this role. Most users have a strong instinct for what their product should do; fewer have visibility into how product thinking at this altitude connects to the design and engineering decisions that follow. When the user describes something that has implications they haven't considered — a capability that implies real-time infrastructure, a user type that creates a two-sided marketplace dynamic, a constraint that shapes the entire data model — surface it. That's what makes this conversation valuable rather than just transcription.

---

## Why This Step Matters

Everything downstream depends on the Product Brief:

| Phase | Depends on the Brief for... |
|---|---|
| **Design System** | Product context — who the users are, what the system does, and what experiences it enables. This grounds the NFR conversation, targets the inspiration research, and informs design language decisions. |
| **Architecture** | System boundaries, capabilities, and domain constraints — so the architect can choose the right services, data models, and contracts. |
| **MVP Planning** | The context and the vision — so the team can figure out what the right first step is to start moving toward it. |

The brief does **not** specify how every feature works — and it is not where the discovery's richness lands. The committed `docs/product-brief.md` is a half-page orientation and boundary record (the template below defines it); the depth this conversation produces reaches downstream phases through the Downstream Context file and the hand-off cache, which is why the discovery must still go deep even though the document stays lean. A designer or engineer opening the project cold reads the brief to learn what this product is, for whom, and what it will never do; the phases read the context files for everything else.

---

## How This Conversation Works

Product discovery is a multi-phase collaborative conversation, not a questionnaire. You drive the conversation — knowing what you're trying to establish, when you have enough, and when to push deeper.

- **Discover before structuring.** In Phase 1, let the user brain-dump. In Phase 2, explore systematically. The structure emerges from the conversation — it is not imposed on it.
- **Vary reflections.** Confirm what you heard, show you absorbed it, build on it. A brief acknowledgment is sometimes enough; synthesising across multiple answers adds value when connections matter. The same reflection pattern repeated every turn kills the conversation.
- **Naming.** Never invent product names or brand names. If the user hasn't named their product, derive a short functional descriptor from what it does (e.g., "the storytelling engine", "the booking system"). Use that descriptor consistently. When you present the draft, ask what they want to call it. Branding is always the user's call.

---

## Operating Contract

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) governs how this skill operates — conversational pacing, discovery notes, living documents, and phase lifecycles. Read it before taking any other action. Open the phase — and precede every question that blocks on the user — with the Setup Progress Header (operating contract, Sequential Setup).

---

## Initialization & Resume Protocol

### Step 1: Cache Check

Check if `.groundwork/cache/product-brief-draft.md` exists.

- If it **does not exist**, this is a fresh session — proceed to Step 2.
- If it **does exist**, read it. A draft means a previous session reached Phase 3 without committing — summarise what has been established and ask whether the user wants to resume or start fresh. If they choose to start fresh, delete the draft file. If they choose to resume, skip to Phase 3 and carry the existing draft forward.

### Step 2: Discovery Notes Check

Check `.groundwork/cache/discovery-notes.md` for entries under `## Product Brief` (Protocol 1). Entries exist when an earlier session, a later phase, or a bet captured vision-level signals before this conversation — treat them as pre-discovered context and carry them into discovery instead of re-asking.

---

## Phase 1: Understand Intent

Understand what the user is building and why they're excited about it.

Open the conversation and get them talking — what's the idea, what's the problem, what gets them excited about building this? Do not recite a scripted question. Be a curious peer, not a facilitator reading from a card. Let them brain-dump freely. Capture everything, including things that feel out of scope. Do not interrupt their flow. Once they've landed, reflect your understanding back before moving on.

---

## Phase 2: Discovery

**Exit criteria:** You can explain the system's vision, users, experience, and boundaries confidently without the user's help. If you cannot, keep going.

**Technology is off-limits.** Do not ask about databases, frameworks, or APIs. Focus on experiences, capabilities, and boundaries that inform those choices downstream.

### Altitude Check

The Product Brief captures the **vision**, not the **design**. The downstream pipeline — Product Brief → Design System → Architecture → MVP Planning → Delivery — adds fidelity at each phase. The brief captures *what* the system does and *why*. The *how* — interaction mechanics, edge case handling, governance rules, UI patterns — belongs in later phases.

**Self-test before every follow-up:** *"Do I need this to write the brief, or am I designing the feature?"* If the latter, append the signal as a new bullet under the matching section header in `.groundwork/cache/discovery-notes.md` — `## Design System` for anything about what the user sees or does (interaction patterns, search/browse UX, aesthetics — even when it names a concrete mechanism like faceted-vs-conversational search), `## Architecture` for infrastructure or technology opinions, `## Design Details` for internal mechanisms the user never sees (async flows, schemas, contract formats), `## Bets` for feature sequencing — and move on. Most signals from a vision conversation are user-facing and belong in `## Design System`; reserve `## Design Details` for genuinely under-the-hood implementation decisions. Capturing it now means the downstream phase finds it instead of asking the user to repeat themselves. Create the file from the template at `.groundwork/skills/templates/discovery-notes.md` if it does not exist.

| ✅ Brief altitude | ❌ Too deep — save for later |
|---|---|
| "Users can create persistent characters that carry across stories" | "When a character crosses genres, does the system re-skin them automatically or manually?" |
| "Stories can be shared and collaboratively extended" | "Who approves new chapters — the owner, or is it first-come-first-served?" |
| "The input is a flexible conversational session" | "What happens if the user provides conflicting details mid-session?" |

### How to Handle Core Mechanics

When the user describes a core mechanic — how users initiate something, a key action, a significant output, or a mode of experience — understand it at the vision level:

- **What it is**: What does it do for the user? Why does it matter?
- **Range**: How simple or complex can it be?
- **Agency**: Who drives — the user, the system, or both?

Stop there. Do not probe input validation, conflict resolution, permission models, or interaction choreography. Capture intent and shape, not specification. If the user gives a clear answer, acknowledge it and advance. Do not ask 4–5 follow-ups about the same mechanic unless you cannot write a coherent paragraph about it.

### What Discovery Covers

Work through these areas in whatever order feels natural. The goal is confident coverage, not sequential ticking. Some areas will emerge from the user's initial brain-dump; others will require exploration. Advance when you have enough signal to write about an area with confidence — not when you've exhausted every possible question.

The areas that matter: the core problem and who feels it, the user types and what they're hiring the system to do, what the system must be able to do to deliver its value, how users experience the system from entry to outcome — and through what surfaces they meet it, now and on the roadmap — what the system produces and how it's consumed, what persists between sessions, how output is shared or distributed, what the system explicitly does not do, the constraints and hard rules that govern it, and how you'll know it's working.

Not every area applies to every product. Skip what's clearly irrelevant. Go deeper on areas where the user's vision is rich and specific — that richness is signal that downstream phases will depend on.

### Depth Threshold

Discovery is complete when you can write about each area with enough detail that a downstream designer or engineer could make decisions from it without asking "but who is this person, really?" or "what does this capability actually do?"

For each **user type**, you need enough to write a paragraph that conveys their relationship to the problem — not just a demographic label. "Avid readers" is a label. "Fans of interactive fiction who have exhausted the content in traditional choose-your-own-adventure formats and want stories that respond to them rather than following fixed paths" is a mental model a designer can work from.

For each **capability**, you need enough to explain what it does for the user, why it matters to the product's vision, and how it connects to other capabilities. "Dynamic narrative generation" is a feature name. Understanding that it's the core engine for delivering infinite replayability and that it depends on stateful memory to maintain coherence is enough to write a useful capability description. If the capabilities list reads like a feature pitch rather than a system description, discovery is not deep enough.

For the **experience**, you need enough to walk through the macro user journey — from entry to outcome — with enough texture that someone reading it can picture the shape of the interaction, not just the steps. The journey happens on **surfaces** — the deployed artifacts users meet the product through, such as a web app, a mobile app, a CLI, or an MCP server, each of one interface type (graphical-ui, cli, agentic-protocol). Establish through what surfaces users meet this product, now and on the roadmap — the design system runs a track per interface type and the architecture registers every surface, so a roadmap surface named here is designed for, while one discovered later forces rework. Each described experience names its surface; if an experience reads ambiguously — it could equally be a screen, a terminal, or an API call — ask before transitioning to Phase 3. Most products have exactly one surface, and naming it takes one sentence, not a line of questioning.

Before transitioning to Phase 3, self-test: for each section of the Product Brief Structure below, can you write at least one substantive paragraph? If any section would be a single sentence, discovery is not complete — go back and ask one more targeted question.

---

## Phase 3: Draft, Review & Present

**Before drafting**, silently scan the conversation. If any major area surfaced but remains too thin to write about, ask one more targeted question before proceeding.

When ready:

1. **Draft.** Synthesize the discovery into the Product Brief structure defined in `.groundwork/skills/groundwork-product-brief/product-brief-template.md` — the canonical section list `groundwork-product-brief-extract` also drafts against, so a greenfield brief and a recovered one are indistinguishable in shape. The draft is a clean brief with no summary section — the Downstream Context (Protocol 5) is written separately at commit, not into the doc. Apply the `groundwork-writer` skill for tone and quality. Write the draft to `.groundwork/cache/product-brief-draft.md` immediately. Do not re-read the file you just wrote — the in-memory state is authoritative for the rest of this phase.

2. **Review.** Announce the shift into review, then dispatch `groundwork-review` per Protocol 9 with `document_path: .groundwork/cache/product-brief-draft.md` and `document_type: product-brief`. The gate is fail-closed and the revise cap is Protocol 8's, not restated here: on REVISE, apply every 🔴 Critical finding directly to the draft (rewrite the document, not a list of suggestions), write the revision back to `.groundwork/cache/product-brief-draft.md`, and re-dispatch until PRESENT.

3. **Present.** Once the verdict is PRESENT, present the final draft in the chat. Most briefs fit in a single message; when the draft is large enough to risk the per-response output token budget, present it section by section instead — emit each section in turn, pausing briefly between sections so the user can respond. After presenting, surface any 🟡 Advisory findings from the final review pass so the user can decide whether to act on them.

4. Ask the user whether to save the brief as-is or refine anything first. When the user wants to push a section deeper — or a section reads thin against the quality standard below — load `.groundwork/skills/groundwork-elicit/instructions.md` and follow it. Proceed to Phase 4 only on explicit approval.

### Quality Standard: What "Deep Enough" Looks Like

The depth bar below governs the **discovery and its carriers** — the Downstream Context file and the hand-off — not the committed brief's length. The brief itself distills each area to its template shape (a user type becomes two lines; the capability inventory does not appear at all); what must be deep is the understanding behind the distillation, because the hand-off carries it forward and a thin understanding produces a wrong distillation. A brief that reads like marketing copy has failed; so has a hand-off that gives the design phase a label where it needs a mental model.

**Shallow understanding (insufficient):**
```markdown
#### Target Users

**Players**
- Who they are: Individuals seeking interactive story experiences.
- Job to be done: Experience unique, personalized narratives.
- Success looks like: Deep immersion and a sense of agency.
```

**Deep understanding (required standard — this is what the hand-off carries; the brief's Audience section distills it to two lines):**
```markdown
#### Target Users

**Players**
- **Who they are:** Fans of interactive fiction, visual novels, and narrative-driven
  games who have exhausted the content available in traditional choose-your-own-adventure
  formats. They are readers who want to participate, not just consume — drawn to the
  promise of stories that respond to them rather than following fixed paths.
- **Job to be done:** Experience a narrative where their choices produce genuinely
  different outcomes — not cosmetic variations on the same plot, but structurally
  divergent stories that feel co-created. The system must make the player feel like
  their decisions matter enough that replaying the same story framework produces a
  recognisably different experience.
- **Success looks like:** A player finishes a story and immediately starts it again —
  not because they missed content, but because they want to see what happens if they
  make different choices. They describe the experience to others using phrases like
  "my story" rather than "the story." Emotional investment is high enough that
  difficult choices feel consequential.
```

The shallow version gives a designer a label. The deep version gives them a mental model of the user — enough to make design decisions about tone, pacing, and interaction density without asking "but who is this person, really?" That mental model travels in the hand-off; the brief's Audience line points at it.

The same depth applies to every discovery area, and each area has its carrier:
- **Capabilities** are not feature lists — each conveys what it does for the user, why it matters to the vision, and how it connects to the others. The full inventory travels in the hand-off (the architecture phase maps services from it); the brief carries none of it. Once delivery begins, delivered capability state lives in `docs/surfaces.md`'s ledger.
- **The Experience** walks the macro journey — entry to outcome, with texture — in the hand-off; the brief's Surfaces section carries only the surface list itself.
- **Non-goals & Hard Rules** are not generic disclaimers. Each entry reflects a decision the user explicitly made, grounded in the product's context — and these DO land in the brief in full, because the scope gates read them there.
- **Success signals** are observable in practice, never sentiments — the one or two strongest close the brief's Purpose & Problem paragraph.

---

## Phase 4: Commit

Execute **only** after explicit user approval. Follow the Phase Lifecycle commit protocol from the Operating Contract (Protocol 3.4).

1. **Write the Downstream Context file (Protocol 5).** Apply the `groundwork-writer` skill to write `.groundwork/context/product-brief.md` — the four-subsection contract per Protocol 5: Key Decisions, Binding Constraints, Deferred Questions, Out of Scope. Key Decisions carries the surface set — every surface The Experience names, each with its horizon marker (MVP / later / aspirational) — because the design system, the architecture, and MVP scoping all branch on it; a single-surface product carries one entry. This is the contract every downstream phase reads first, and a commit without it forces every downstream phase to re-read the full brief. The published `docs/product-brief.md` stays a clean brief with no summary section.
2. Promote the finalised brief to `docs/product-brief.md` by moving the file from `.groundwork/cache/product-brief-draft.md`. Use a move operation (the `move_file` tool, or `mv` via the shell) — do not read the draft and rewrite its contents, as the brief is large enough that re-emitting it through the model risks exhausting the output token budget.
3. Write the hand-off file to `.groundwork/cache/handoff/product-brief.md`. Copy the template at `.groundwork/skills/templates/handoff.md`. Under the lean brief shape this file is **load-bearing, not overflow** — it is where the discovery's depth travels: the full capability inventory (what each does for the user, why it matters, how they connect — the architecture phase maps services from this), the macro experience journey per surface, and each user type's mental model (the Quality Standard's deep form). Then the classic overflow: rejected framings the user ruled out, deferred decisions with their reopening trigger, unformalised design or architecture instincts. Omit empty sections entirely. This is the Hand-off Cache contract from Protocol 6.
4. Then complete Protocol 3.4 steps 5–9: Living Documents (with the Reversal Protocol where it fires), the discovery-notes sweep, confirm, the fresh-context recommendation, and the orchestrator hand-off.
