# CLI Track

This track applies to products whose primary interface is a command-line tool: terminal applications, shell utilities, developer CLIs, build systems, package managers, infrastructure tools, and any product where humans interact through typed commands and terminal output.

---

## Default Stance

Be fluid. Adapt seamlessly to the user's product positioning, target audience, and Unix philosophy alignment. The agent's role is to match the user's vision — not to impose a rigid CLI style.

### The mental model: a composable spine, plus an interactive layer

Every CLI sits on a **composable spine** — structured output, exit-code discipline, colour that degrades, non-TTY fallback, pipe-safety, graceful interrupt. This is a floor, not a style. It is what lets a tool live in CI, pipes, and agent loops. Even the most conversational modern CLI keeps it: Claude Code has a `-p` one-shot mode; `gh` has interactive prompts but every command still scripts cleanly.

Some CLIs add an **interactive layer** on top of that spine — a persistent session or REPL, slash commands, inline autocomplete, live-rendered regions, token streaming, context management. This is the Claude Code / Gemini CLI class. The layer is additive: it never replaces the spine, it builds on it.

So a CLI's design sits somewhere on a spectrum, and the first job of this track is to place it:

- **Composable** — one-shot, Unix-traditional. The spine is the whole product. (`rg`, `fd`, `jq`.)
- **Interactive** — a session-oriented or conversational tool. Spine plus a rich interactive layer. (Claude Code, Aider, a REPL.)
- **Hybrid** — a one-shot core *and* an interactive surface over the same capabilities. This is the common case. (`gh`, `mise` — scriptable everywhere, interactive when it helps.)

Hold this as one model you adapt by shifting *emphasis*, not as three separate procedures. A composable tool still needs error anatomy and help craft; an interactive tool still needs `--json`. What changes across the spectrum is which dimensions carry the most design weight.

GroundWork practices this itself: the `./dev` control plane it scaffolds into every project is built on the same composable spine, with a live status dashboard and interactive wizard as its interactive layer. The brand the user designs here flows into both — `./dev` and, when the product is a CLI, the product's own starter render from the same brand tokens this phase emits.

### Defaults

The default starting position is modern, high-craft CLI design. When the user has no strong preference, advocate for the following defaults — and be ready to explain *why* each one matters:

**Composable spine (every paradigm):**
- Sub-100ms cold-start time. Users abandon CLIs that feel sluggish before producing output — every dependency loaded at startup is a tax on every invocation.
- Structured output mode (`--json`, `--format`) alongside human-readable defaults. Machine-readability is a first-class concern because CLIs live in pipelines, not just in terminals.
- `NO_COLOR` compliance (https://no-color.org/). Colour enhances readability but must never be required to interpret output — CI environments, accessibility tools, and piped output all strip colour.
- XDG Base Directory Specification compliance for config, cache, and data files. Scattering dotfiles in `$HOME` is a legacy pattern that makes environments unreproducible.
- Shell completion generation for bash, zsh, fish, and PowerShell as a built-in capability. Discoverability through tab completion is how power users learn a CLI — adding it later means retrofitting every command.
- Exit code discipline: 0 for success, 1 for general errors, 2 for usage errors. Scripts depend on exit codes for control flow — undocumented or inconsistent codes break automation silently.
- POSIX signal handling: graceful shutdown on SIGINT/SIGTERM with cleanup of temporary files. Ctrl+C must never leave orphaned processes or corrupted state.

**Interactive layer (when the CLI is interactive or hybrid):** these sit *on top of* the spine — propose them only when the paradigm calls for a session surface.
- A one-shot escape hatch (`-p`/`--print`/`--json`) is mandatory even for interactive CLIs. An interactive tool that cannot be scripted is unusable in CI and pipelines — the composable floor is non-negotiable, not a fallback.
- Session persistence and resumability. Losing the conversation or context on disconnect destroys the core value of a session-oriented tool — persist the transcript and context to XDG state.
- Interrupt model: Esc cancels the current stream, Ctrl+C exits the session. Conflating the two means a user cannot stop a runaway response without killing everything.
- Streaming render budget: throttle repaints (~30fps) and flush tokens on a fixed cadence. Uncapped per-token repaints saturate the terminal and cause flicker.
- Autocomplete latency under ~50ms. Completion that lags behind typing feels broken and gets ignored.
- Live regions degrade to plain streamed lines off a TTY or under `TERM=dumb`. Alt-screen TUI that does not fall back breaks over SSH, in CI, and when piped.
- Context-window usage is surfaced, not silent. Silent truncation produces confusing model behaviour — show usage and offer compaction or clear.
- Multimodal and file-input affordances (`@`-mentions, paths, paste) where the product warrants. Typing file contents by hand is exactly the friction these tools exist to remove.

**Craft bar** (examples of the premium standard the agent targets):
- Rich, context-aware help that adapts to the user's current state.
- Progressive disclosure: simple commands with sensible defaults that expert users can override.
- Considered output hierarchy: headers, grouped sections, aligned columns, and semantic colour that makes dense terminal output scannable.
- Tactile feedback: spinners for long operations, progress bars for measurable work, inline status updates for multi-step processes.
- Composable by design: every command produces output that can be piped, filtered, and combined with standard Unix tools.
- Error messages that diagnose, suggest, and link — not just report.

Draw inspiration from trend-setting CLIs — as a palette to pull from by paradigm, not a checklist:
- **Composable craft:** `gh`, `rg`, `fd`, `just`, `mise`, `bat`, `eza`, starship — output hierarchy, streaming results, completion, scannable dense output.
- **Interactive / agentic:** Claude Code (namespaced slash commands, mid-stream tool/permission prompts, `Esc`-to-interrupt, `-p` one-shot under an interactive product, session + `/resume`), Gemini CLI (in-terminal branding, streaming markdown render, context management), Aider (REPL over a git tree, `/`-commands, multi-line edit), Warp / Fig / Atuin (ghost-text autocomplete, fuzzy history), `fzf` (embeddable fuzzy-select), the Charm stack / bubbletea / lipgloss / glamour (Elm-style update loop, alt-screen repaint, terminal markdown), ratatui / nushell / IPython (live-render regions, structured REPL with reverse-search).

---

## Cross-Phase Signal Capture

Design system conversations routinely surface signals that belong to a different phase — a startup budget with infrastructure implications, a configuration store that shapes architecture, a sequencing instinct about which commands ship first. As these signals arise during any phase, append them as bullets under the matching section header in `.groundwork/cache/discovery-notes.md` — `## Architecture` for infrastructure or technology opinions, `## Design Details` for protocol or schema implications, `## Bets` for feature sequencing, `## Product Brief` for vision-level refinements — then return to the current topic. Capturing them now means the downstream phase finds them instead of asking the user to repeat themselves.

---

## Phase 1: Non-Functional Requirements (NFR)

NFRs define the engineering envelope the CLI design system must operate within. Startup budgets, composability contracts, platform targets, and security models all constrain design choices downstream — a CLI that specifies rich interactive prompts but must work in headless CI pipelines is internally contradictory.

### Place the CLI on the spectrum first

Before drafting NFRs, infer where this CLI sits on the composable → interactive → hybrid spectrum from the product brief, and **propose** it: "this reads as a hybrid — a composable one-shot core with an interactive session surface, because the brief describes both scripting in CI and a conversational workflow." Then let the user react. Propose-first, never a questionnaire. Default an ambiguous read to **hybrid** — it carries the broadest envelope, so nothing is foreclosed. The paradigm decides which NFR dimensions and which later phases carry weight, so it is the first thing to settle. Record the agreed position in the Phase 1 section of `.groundwork/cache/design-system-cache.md`.

Read `docs/product-brief.md`. Using the product brief and the track defaults above as your starting position, draft a complete NFR proposal immediately — do not open with questions.

Cover all relevant dimensions: startup and runtime performance budgets, composability and piping contracts, platform and shell compatibility, terminal capability detection, exit code discipline, signal handling, offline and error tolerance, configuration hierarchy, security, and accessibility. Ground each decision in the product brief and apply the track defaults where applicable: sub-100ms cold start, NO_COLOR compliance, XDG Base Directory compliance, structured output mode alongside human-readable defaults, POSIX signal handling, exit code 0/1/2 convention. Skip dimensions that are clearly irrelevant to the product.

When the paradigm is interactive or hybrid, the NFR proposal also covers the interactive envelope alongside the composable floor: session persistence and resumability, the interrupt model, streaming render budget, autocomplete latency, TUI/alt-screen support with its non-TTY degradation path, multimodal and file input, and context-window management. The composable spine defaults stay in force for every paradigm — they are the floor the interactive layer builds on.

Present the proposed NFRs in full and invite the user to confirm, challenge, or adjust specific items. The proposal is the starting position — accept what the user confirms, revise what they challenge. Once approved, write the confirmed NFRs to the Phase 1 section of `.groundwork/cache/design-system-cache.md` and set its status to `done`. Proceed to Phase 2.

---

## Phase 2: Research

The inspiration library grounds the design conversation in concrete, existing tools. Abstract discussions ("make it feel polished") produce vague specs. Discussions anchored in specific examples ("ripgrep renders results from a streaming parser so the first match appears before the search completes") produce actionable design decisions.

Drawing on the product context and agreed NFRs from Phase 1, identify the core design challenges this CLI faces and find leading tools that solve similar problems exceptionally well. Describe the **specific pattern or interaction** worth borrowing — not just the tool's reputation. Pull from the paradigm-aware palette in the Default Stance: composable tools for output and composition challenges, the interactive/agentic cluster (Claude Code, Gemini CLI, Aider, the Charm stack) for session, streaming, slash-command, and autocomplete challenges. Match the source to the paradigm settled in Phase 1 — an interactive product needs interactive exemplars, and a composable one does not need to borrow REPL patterns it will never use.

Present the Inspiration Library and ask for the user's reaction. Do not proceed until they have confirmed the direction.

Once approved, write to the Phase 2 section of `.groundwork/cache/design-system-cache.md` and set its status to `done`. Proceed to Phase 3.

---

## Phase 3: Command Architecture

The command architecture is the structural container everything else lives inside — the taxonomy, I/O topology, configuration surface, and discovery model. Getting this wrong means reworking every command. Getting it right means every subsequent design decision has a home.

Define the structural skeleton using patterns from the Phase 2 inspiration library. The agent should explore and propose decisions across: command taxonomy and hierarchy, flag and argument conventions, input/output topology (what goes to stdout vs stderr vs stdin), configuration surface and precedence, help and discovery model, shell integration, and progressive disclosure strategy.

When the paradigm is interactive or hybrid, the skeleton also covers the session surface:
- **Session model** — one-shot, a persistent REPL loop, or both. A hybrid must define how the same capability is reached one-shot *and* in-session.
- **Slash-command taxonomy and grammar** — namespacing, arguments, discoverability, and how slash commands coexist with flag-based subcommands without two parallel vocabularies.
- **Input modes** — single-line, multi-line editing, and multimodal entry (`@`-mentions, file paths, paste) where the product warrants.
- **The dual-surface contract** — every capability reachable interactively must also be reachable scriptably, so the interactive layer never strands functionality the spine cannot reach. This is the architectural expression of the composable-floor rule.

Guide the conversation with leading-edge CLI design patterns. Propose the architecture based on the inspiration library, then ask the user to react and refine.

When a command-architecture decision implies a backend or infrastructure capability — authentication backend, telemetry sink, update channel, remote config service, credential storage — append the implication as a bullet under `## Architecture` in `.groundwork/cache/discovery-notes.md` before continuing the conversation. The architecture phase finds these notes and skips re-deriving what was already decided here.

Once approved, write to the Phase 3 section of `.groundwork/cache/design-system-cache.md` and set its status to `done`. Proceed to Phase 4.

---

## Phase 4: Terminal Language

This phase captures the user's instincts about how the CLI communicates through the terminal — the raw material the agent will translate into concrete ANSI specifications in Phase 5. The user should never need to think about specific ANSI codes.

Cover terminal language in three focused clusters — grouping related decisions so the user can react to a coherent stance rather than isolated individual choices. For each cluster, open with a cohesive proposal that reflects what the product brief and inspiration library suggest, then invite the user to react and redirect.

**Cluster 1: Identity** — Output personality, colour philosophy, iconography and symbol vocabulary, and in-terminal branding. Propose the CLI's voice as a unified stance: how terse or pedagogical it is, whether colour is functional or decorative, whether the symbol palette is Unicode, emoji, ASCII, or none, and — for interactive products — how present the branding is (a splash or wordmark on launch, or restraint).

**Cluster 2: Feel** — Information density, progress and feedback, structured output character, and live-rendering feel. Propose how dense the default verbosity is, how long-running operations communicate, and how data presentations degrade in narrow terminals. When the paradigm is interactive or hybrid, also propose the streaming feel: whether output streams token-by-token or lands in blocks, how "alive" the thinking indicator feels, and how settled or busy the repaint cadence reads — as a *feel*, not a number.

**Cluster 3: Craft** — Error tone, interactive posture, interrupt posture, and autocomplete assertiveness. Propose how errors feel (diagnostic vs terse), and when the CLI prompts vs assumes. For interactive products, also propose how interruption feels (can you stop a runaway response cleanly) and how eager autocomplete is (passive ghost-text vs an assertive menu).

After each cluster proposal, invite the user to react and refine before advancing. Mark each cluster as covered in `.groundwork/cache/design-system-cache.md` as you go. Skip a dimension only when it is clearly irrelevant to the product.

### Synthesis Gate

Before caching, distill the entire Phase 4 conversation into a structured direction and present it to the user for confirmation. Scattered conversation notes are not sufficient input for Phase 5.

The synthesis stays in the user's language. No ANSI codes, no output templates, no column widths. It captures the *decisions* the user made in terms they recognise:

- **Output personality**: A short characterisation of the CLI's voice.
- **Information density**: The default verbosity posture.
- **Colour philosophy**: The role colour plays.
- **Feedback style**: How the CLI communicates work-in-progress.
- **Error tone**: How errors feel.
- **Interactive posture**: When the CLI should ask vs. assume.
- **Symbol vocabulary**: The marker style.

When the paradigm is interactive or hybrid, also capture:
- **Streaming feel**: How output arrives — token-by-token or in blocks — and how alive the thinking state feels.
- **Branding posture**: How present the in-terminal identity is on launch.
- **Interactive assertiveness**: How eager prompts, autocomplete, and interruption feel.

Present as a clear summary the user can scan and approve in one read. Confirm before proceeding.

Once confirmed, write the synthesis to the Phase 4 section of `.groundwork/cache/design-system-cache.md` and set its status to `done`. Proceed to Phase 5.

---

## Phase 5: Expert Translation & Review

### 5a: Translation (Agent-Driven, Autonomous)

The user provided taste, instinct, and direction across Phases 1–4. The agent now translates that into a rigorous CLI design specification — autonomously.

**Output location**: `.groundwork/cache/design-system-draft/` — a directory of per-section files. Each file stays bounded in size, so any later change (review revise, 5b re-flow) touches only the affected files instead of regenerating the whole spec in a single turn. Regenerating the whole spec at once exhausts the per-response output token budget on rich specs; the per-section layout makes that failure structurally impossible. Writing to `docs/design-system.md` is prohibited until Phase 6 (Commit) — on initial generation that file does not exist; do not attempt to read it.

**Write each section as a separate file.** Use one `write_file` call per section (the tool creates parent directories automatically):

| File | Content |
|---|---|
| `00-header.md` | The `## Summary for Downstream` section first (Key Decisions, Binding Constraints, Deferred Questions, Out of Scope per Protocol 5), then the document title and the "implementation-ready specification" intro paragraph |
| `01-constraints.md` | Part 1 — startup budgets, composability contracts, platform targets, terminal capability requirements, configuration hierarchy |
| `02-command-architecture.md` | Part 2 — command taxonomy, I/O topology, configuration surface, help system, shell integration, progressive disclosure |
| `03-foundation.md` | Part 3 Cluster 1 — colour architecture (ANSI 256 + truecolor + NO_COLOR), typographic hierarchy, output structure templates |
| `04-interaction.md` | Part 3 Cluster 2 — progress & loading patterns, confirmation & prompt patterns, error anatomy |
| `05-surface.md` | Part 3 Cluster 3 — help text anatomy, responsive degradation, composition rules, version & update communication |

**Interactive and hybrid paradigms add two more files** (a composable CLI creates neither):

| File | Content |
|---|---|
| `06-session-interaction.md` | REPL/session loop, slash-command grammar, streaming render budget, autocomplete behaviour, interrupt semantics |
| `07-live-surface.md` | Live-render/TUI regions and their non-TTY fallback, session persistence and context-window management, in-terminal branding and splash |

The numeric prefixes determine concatenation order at commit, and the commit/review `cat *.md` globs pick up `06`/`07` automatically with no change. Split into two files (rather than one) so the Phase 5b re-flow stays unambiguous: `06` is walked in the Interaction cluster, `07` in the Surface cluster, so each cluster maps to a single file. Each file is a self-contained markdown section — start its top-level heading at H1 (`# Part 1 — Constraints`) or H2 as appropriate so the files compose cleanly when concatenated.

Compile each section using the approved outputs stored in `.groundwork/cache/design-system-cache.md`. The document combines NFRs from Phase 1 with a comprehensive CLI design system that the agent derives from the terminal language direction captured in Phase 4.

Apply the `groundwork-writer` skill to ensure the tone is declarative, assertive, and free of hedging. Structure it to read like a rigorous CLI specification that an implementer (human or agent) can follow to produce a polished, consistent tool.

#### The Translation Mandate

The user said "terse and Unix-traditional" — the agent commits to specific output templates with exact column widths and truncation rules. The user said "diagnostic errors" — the agent specifies the exact error message structure with severity labels, causal chains, and recovery hints. The user said "Unicode symbols" — the agent defines the complete symbol vocabulary with ASCII fallbacks. Every high-level preference from Phase 4 must be resolved into concrete, implementable specifications. If the cached direction is ambiguous, the agent makes the design call — that is the job.

CLI tools consistently feel amateurish without deeply specified output formatting. The design system must go beyond "use colours" — it must prescribe exact ANSI colour mappings, output column widths, error message templates, progress indicator styles, and a clear hierarchy.

#### Quality Standard: Deep vs. Shallow

Every section must contain enough detail that a developer can implement it without making any design decisions of their own.

**Shallow output (unacceptable):**
```
Colours:
- Success: green
- Error: red
- Warning: yellow
- Info: blue
```

**Deep output (required standard):**
```
Colour Architecture
═══════════════════

All colours defined in ANSI 256 (baseline) with truecolor (24-bit) enhancement.
NO_COLOR compliance: when set, all colour stripped; hierarchy maintained via
bold, dim, and whitespace.

  Role        │ ANSI 256   │ Truecolor  │ NO_COLOR fallback
  ────────────┼────────────┼────────────┼──────────────────
  success     │ 72         │ #5faf87    │ bold
  error       │ 167        │ #d75f5f    │ bold
  warning     │ 179        │ #d7af5f    │ bold
  info        │ 75         │ #5fafff    │ dim
  muted       │ 245        │ #8a8a8a    │ dim
  accent      │ 183        │ #d7afff    │ underline
  header      │ —          │ —          │ bold + UPPER CASE
  key         │ 75         │ #5fafff    │ plain
  value       │ 252        │ #d0d0d0    │ plain

  FORCE_COLOR: When set, emit colour even when stdout is not a TTY.
  Truecolor detection: check $COLORTERM == "truecolor" || "24bit".
  Fallback chain: truecolor → 256 → bold/dim → plain.
```

The shallow version gives a developer four words. The deep version gives them a complete colour system with fallback chains, detection rules, and machine-safe degradation. **Every section of the CLI design system must hit this depth.**

The same standard governs interactive surfaces. A streaming render budget, shallow vs. deep:

**Shallow output (unacceptable):**
```
Streaming:
- Stream the model's response as it arrives.
- Show a spinner while thinking.
```

**Deep output (required standard):**
```
Streaming Render Budget
═══════════════════════

Time-to-first-token target: < 300ms from submit to first visible glyph;
until then, render the thinking indicator (see below).

  Stage          │ Behaviour
  ───────────────┼──────────────────────────────────────────────
  thinking       │ braille spinner @ 80ms/frame, dim, on stderr
  streaming      │ flush buffered tokens to stdout every 50ms
  repaint        │ throttle live regions to 30fps (33ms min frame)
  settle         │ on stop, final repaint + newline, restore cursor

  Non-TTY / TERM=dumb: no spinner, no repaint. Tokens flush to stdout
  line-buffered as they arrive; the response is identical in content,
  plain in form.
  Interrupt: Esc flushes the partial response, prints a dim
  "⎋ interrupted" marker, returns to the prompt. Ctrl+C exits.
```

The shallow version gives a developer two instructions and a dozen unanswered questions. The deep version commits to latency targets, flush cadence, a repaint ceiling, the non-TTY fallback, and interrupt behaviour — implementable without a single further design decision. **Interactive sections hit this depth too.**

The same standard applies across the entire specification:
- **Typographic hierarchy**: Not just "bold for headers" — exact weight/style/casing combinations for every content tier, with stacking rules defining which treatments can combine.
- **Output structure templates**: Not just "show a table" — exact column alignment, header treatment, separator style, truncation rules, and concrete templates for success, list, detail, diff, JSON, and table outputs with both wide and narrow terminal variants.
- **Progress patterns**: Not just "use spinners" — character sets, rotation speed, message format, completion treatment, stderr routing rules, and multi-step announcement format.
- **Error anatomy**: Not just "show helpful errors" — exact error format template with severity, causal chain, recovery hint, exit code mapping, warning format, validation batching, and debug output toggle.
- **Confirmation patterns**: Not just "confirm destructive actions" — prompt format, accepted responses, `--yes`/`--force` bypass, non-TTY fallback behaviour, selection prompt format, and text input validation.
- **Help text anatomy**: Not just "include examples" — usage line format, description tone, subcommand grouping, flag alignment, example count and format, see-also links, and footer content.
- **Responsive degradation**: Minimum supported width, degradation strategy, column priority rules, and width detection method.
- **Composition rules**: `--json` schema contract, `--quiet` behaviour, `--verbose` behaviour, pipe detection rules, and Unix tool compatibility constraints.

For interactive and hybrid paradigms, the same depth standard applies to the session surface:
- **Streaming render budget**: Not just "stream the output" — time-to-first-byte target, token-flush cadence, repaint throttle (e.g. ~30fps), and the plain-line fallback when stdout is not a TTY.
- **Slash-command grammar**: Not just "support slash commands" — the trigger, argument parsing, completion behaviour, namespacing, and error handling, specified as an EBNF-style grammar.
- **Autocomplete behaviour**: Not just "add autocomplete" — trigger conditions, ranking, ghost-text vs. menu presentation, accept/dismiss keys, and a latency ceiling.
- **Live-update regions**: Not just "use a TUI" — which screen regions repaint, alt-screen vs. inline rendering, and the dumb-terminal/non-TTY fallback for each region.
- **Session lifecycle**: Not just "keep a session" — start, persist, resume, clear, and how context-window usage is tracked, surfaced, and compacted.
- **Interrupt semantics**: Not just "handle Ctrl+C" — what Esc does vs. Ctrl+C, mid-stream cancellation behaviour, and the cleanup guarantee on each.

#### Design System Target Structure

**Part 1 — Constraints**: Startup budgets, composability contracts, platform targets, terminal capability requirements, configuration hierarchy.

**Part 2 — Command Architecture**: Command taxonomy, I/O topology, configuration surface, help system, shell integration, progressive disclosure.

**Part 3 — CLI Design System** (each at the depth standard above):
Colour architecture (ANSI 256 + truecolor, NO_COLOR) · Typographic hierarchy · Output structure templates · Progress & loading patterns · Error anatomy · Confirmation & prompt patterns · Help text anatomy · Responsive degradation · Composition rules · Version & update communication

**Part 4 — Session & Live Surface** (interactive and hybrid paradigms only, each at the depth standard above):
Session/REPL loop · Slash-command grammar · Streaming render budget · Autocomplete behaviour · Interrupt semantics · Live-render/TUI regions and non-TTY fallback · Session persistence & context-window management · In-terminal branding & splash

---

Before presenting the draft, run this self-check:
1. **Does every section contain committed, implementable values?** If a section reads like a brief ("use a terse style with functional colour"), the translation is incomplete.
2. **Does every specification include concrete templates or tables?** Prose descriptions without examples are insufficient.
3. **Would a developer implementing this need to make any design decisions?** If yes, the spec is underspecified.

### Independent Review (Pre-Walkthrough)

The user is about to see this draft in Phase 5b. Before they do, the draft passes through an independent review — `groundwork-review` checks the draft for silent invention, dropped commitments from Phase 4, and contradictions against the upstream Product Brief that the user is unlikely to catch during a walkthrough of ANSI mappings, output templates, and error formats. The CLI design system constrains every downstream command and contract; catching these failures here is cheaper than catching them after `docs/design-system.md` becomes the source of truth.

1. **Announce** the shift — the agent is moving from translation into an independent review before presenting to the user.
2. **Assemble the draft for review.** Run `run_command("cat .groundwork/cache/design-system-draft/*.md > .groundwork/cache/design-system-draft.md")` to concatenate the section files into a single document. This is a shell operation, not a model emission — it does not consume output tokens regardless of spec size.
3. **Invoke the review subagent** (Protocol 9) with `document_path: .groundwork/cache/design-system-draft.md` and `document_type: design-system`. The gate is fail-closed (Protocol 8): proceed only on a parseable `VERDICT: PRESENT`; a review that errors, hangs, or returns no verdict follows Protocol 9's failure path — do not present the draft as reviewed.
4. **Revise loop.** If the verdict is **REVISE**, apply every 🔴 Critical finding directly to the affected section file(s) under `.groundwork/cache/design-system-draft/` — rewrite only the files the finding implicates. After revisions, re-assemble with `cat` and run the review again. Repeat until the verdict is **PRESENT**. After 3 REVISE verdicts, apply the revise cap defined in Protocol 8.
5. **Clean up the assembled file.** Once the verdict is PRESENT, run `run_command("rm .groundwork/cache/design-system-draft.md")`. The section files in the draft directory remain the source of truth for Phase 5b and Phase 6.
6. **Carry advisory findings forward.** When the verdict is PRESENT, hold any 🟡 Advisory findings — they surface to the user during or after Phase 5b so the user can decide whether to act on them.

Once the review verdict is PRESENT, proceed to Phase 5b.

### 5b: Guided Review (Collaborative)

The draft is a proposal. Present it to the user as one — explicitly frame it as what the agent built from their direction.

**Do not ask the user to approve the full spec.** Do not present a summary and ask "does this look right?" Instead, walk through the spec in three focused clusters, each earning approval before advancing. When the user wants to push a section deeper — or a section reads thin against the quality standard above — load `.agents/groundwork/skills/groundwork-elicit/instructions.md` and follow it.

#### Cluster Walkthrough

The cluster names here are deliberately distinct from the Phase 4 language clusters (Identity / Feel / Craft) — Phase 4 grouped *aesthetic decisions* the user owns; Phase 5b walks through *implementation specifics* the agent owns. Distinct names keep both schemes legible when both phases are referenced in the same conversation.

**Cluster 1: Foundation** — Colour architecture (ANSI 256 + truecolor + NO_COLOR), typographic hierarchy, and output structure templates.

These are the base primitives every later decision composes from. Present the colour role table with fallback chains, the bold/dim/casing hierarchy, and the concrete output templates side by side. Teach the reasoning: why ANSI 256 as the baseline with truecolor enhancement, why specific role-to-colour mappings, how column widths and truncation rules were derived. Offer alternatives that honour the same direction. Wait for the user's reaction before advancing.

**Cluster 2: Interaction** — Progress and loading patterns, confirmation and prompt patterns, error anatomy. For interactive and hybrid CLIs, this cluster also covers `06-session-interaction.md`: the streaming render budget, slash-command grammar, autocomplete behaviour, and interrupt semantics.

These define how the CLI behaves under load and under failure. Present the spinner/progress treatment, the confirmation prompt format with `--yes`/`--force` bypass rules, and the full error message template (severity, causal chain, recovery hint, exit code) as a connected system. For interactive products, present the streaming budget, interrupt model, and autocomplete as part of the same behaviour-under-load story. Teach the trade-offs: machine-friendly stderr routing vs. human-friendly inline updates. Justify the specific choices against the Phase 4 direction. Offer alternatives. Wait for the user's reaction.

**Cluster 3: Surface** — Everything else: help text anatomy, responsive degradation rules, composition rules (`--json` schema, `--quiet`, `--verbose`), version and update communication. For interactive and hybrid CLIs, this cluster also covers `07-live-surface.md`: live-render/TUI regions and their fallback, session persistence and context-window management, and in-terminal branding.

These are engineering craft — decisions the agent should own. Present the full set as a summary table: what was decided, in one line per topic. Call out any judgment calls the user might have an opinion on. Ask if anything feels wrong. Do not walk through each one individually unless the user flags a concern.

#### Re-flow Protocol

When the user requests a change in any cluster:

1. Acknowledge the change and confirm understanding.
2. Assess downstream impact — state explicitly which section files are affected, including any downstream files whose rules reference the change.
3. **Rewrite the affected section files.** Each section lives in its own file under `.groundwork/cache/design-system-draft/`. Use `write_file` to replace the implicated files in turn — for example, a change to the colour role table rewrites `03-foundation.md`, and may ripple into `04-interaction.md` if error formatting references the colour roles. Each `write_file` is bounded by the size of one section, never the whole spec.
4. Summarise the re-flow: list every section file that changed and what specifically shifted.
5. If a previously-approved cluster was affected substantively, re-present it before continuing.

A CLI design system is a web of interconnected decisions. Changing the colour role table affects error formatting, which affects the help system. Propagate the change into every section file it implicates — file-by-file, never as a single full-spec rewrite. Isolated edits that ignore downstream effects create internal contradictions that surface during implementation; the propagation is mandatory, the file-at-a-time mechanic is what makes it safe.

#### Walkthrough Progress

Track which clusters have been reviewed in `.groundwork/cache/design-system-cache.md` under the Phase 5 checklist. Mark each cluster as complete when the user approves it.

#### Completion Gate

The walkthrough is complete when all three clusters have been presented and approved. Only then does Phase 6 (Commit) execute.

Once approved, proceed to Phase 6: Commit.

---

## Phase 6: Commit

Execute **only** after Phase 5b review is complete and the user has explicitly approved the specification.

Follow the Phase Lifecycle commit protocol from the Operating Contract:

1. **Verify the summary header.** Confirm the draft directory's `00-header.md` (or first section file) contains a `## Summary for Downstream` section populated per Protocol 5 of the operating contract — Key Decisions (colour role table, output structure, exit-code policy; and for interactive/hybrid CLIs, the session model, streaming budget, and slash-command grammar), Binding Constraints (ANSI fallback chain, machine-readability requirements, accessibility floors), Deferred Questions, Out of Scope. If missing, apply `groundwork-writer` to add it before assembling.

2. **Assemble the final spec.** Concatenate the section files into the canonical location: `run_command("cat .groundwork/cache/design-system-draft/*.md > docs/design-system.md")`. The numeric prefixes guarantee the correct section order — the glob picks up `06`/`07` automatically when they exist. This is a shell operation, not a model emission — it does not consume output tokens regardless of spec size.

3. **Emit brand tokens.** Write `.groundwork/config/brand-tokens.json` following the contract at `.agents/groundwork/skills/groundwork-design-system/templates/brand-tokens.md`. The CLI track emits **Tier 2** — identity plus the full `terminal` block (colour role table, symbol vocabulary, splash, typography), carrying the *same* values as the colour architecture and symbol vocabulary just written into `docs/design-system.md`. This is the machine projection scaffolding reads to brand the `./dev` CLI and the product's own CLI. It lives in persistent config and is not removed by the cache cleanup in the next step.

4. **Write the hand-off file.** Copy `.agents/groundwork/skills/templates/handoff.md` to `.groundwork/cache/handoff/design-system.md` and fill in only the sections that have content: rejected colour palettes or output templates, deferred decisions (composition rules, plugin architecture), user instincts about CLI ergonomics not yet committed, and any other context the architecture phase needs. Omit empty sections.

5. **Clean up caches.** Remove the draft directory, the design-system cache, and the consumed previous hand-off: `run_command("rm -rf .groundwork/cache/design-system-draft .groundwork/cache/design-system-cache.md .groundwork/cache/handoff/product-brief.md")`. Cache Isolation (Protocol 7) requires the previous hand-off to be deleted once consumed.

6. Apply the Living Documents protocol — scan the conversation for insights that refine any existing `docs/` artifact (e.g. `docs/product-brief.md`). Apply surgical updates and refresh affected summary headers. Report what changed. If an update **reverses** a prior Key Decision or Binding Constraint (Protocol 2 — e.g. the design system overturns a brief commitment), follow the Reversal Protocol: reconcile the full body of the affected doc, fix dependent docs, write the superseding ADR, and re-invoke `groundwork-review` on each mutated doc before committing.

7. Update discovery notes — scan for out-of-phase signals not captured in real time. Remove `## Design System` entries incorporated into `docs/design-system.md` or the hand-off file.

8. Confirm that the phase is complete.

9. Recommend a fresh context for the next phase — a clean context gives the next skill full working memory.

10. Immediately load and execute the `groundwork-orchestrator` skill to show the user what's next. Do not ask the user to invoke it — hand off automatically.
