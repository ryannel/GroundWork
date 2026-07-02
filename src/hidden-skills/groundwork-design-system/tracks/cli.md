# CLI Track

This track applies to products whose primary interface is a command-line tool: terminal applications, shell utilities, developer CLIs, build systems, package managers, infrastructure tools, and any product where humans interact through typed commands and terminal output.

The shared foundation flow (`tracks/_foundation.md`) owns the session spine: it runs the brand-level Phases 1, 2, and 4 once for the whole product, drawing this track's contributions from the Foundation Contributions section below, and it runs this track's Phase 3 and Phase 5 at the right points. Its Cross-Phase Signal Capture rule stays in force throughout every phase of this track.

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

## Foundation Contributions

The shared foundation flow pulls these sections into its brand-level phases.

### Envelope (foundation Phase 1)

**Place the CLI on the spectrum first.** Before drafting this type's NFRs, infer where the CLI sits on the composable → interactive → hybrid spectrum from the product brief, and **propose** it: "this reads as a hybrid — a composable one-shot core with an interactive session surface, because the brief describes both scripting in CI and a conversational workflow." Then let the user react. Propose-first, never a questionnaire. Default an ambiguous read to **hybrid** — it carries the broadest envelope, so nothing is foreclosed. The paradigm decides which NFR dimensions and which later phases carry weight, so it is the first thing to settle. Record the agreed position in the Phase 1 section of `.groundwork/cache/design-system-cache.md`.

Cover all relevant dimensions of the CLI envelope: startup and runtime performance budgets, composability and piping contracts, platform and shell compatibility, terminal capability detection, exit code discipline, signal handling, offline and error tolerance, configuration hierarchy, security, and accessibility. Ground each decision in the product brief and apply the track defaults where applicable: sub-100ms cold start, NO_COLOR compliance, XDG Base Directory compliance, structured output mode alongside human-readable defaults, POSIX signal handling, exit code 0/1/2 convention.

When the paradigm is interactive or hybrid, the NFR proposal also covers the interactive envelope alongside the composable floor: session persistence and resumability, the interrupt model, streaming render budget, autocomplete latency, TUI/alt-screen support with its non-TTY degradation path, multimodal and file input, and context-window management. The composable spine defaults stay in force for every paradigm — they are the floor the interactive layer builds on.

### Research notes (foundation Phase 2)

Pull from the paradigm-aware palette in the Default Stance: composable tools for output and composition challenges, the interactive/agentic cluster (Claude Code, Gemini CLI, Aider, the Charm stack) for session, streaming, slash-command, and autocomplete challenges. Match the source to the paradigm settled in Phase 1.

### Type language (foundation Phase 4)

Fold these dimensions into the foundation's language clusters. The user should never need to think about specific ANSI codes:

- **Cluster 1: Identity** — Output personality, colour philosophy, iconography and symbol vocabulary, and in-terminal branding. Propose the CLI's voice as a unified stance: how terse or pedagogical it is, whether colour is functional or decorative, whether the symbol palette is Unicode, emoji, ASCII, or none, and — for interactive products — how present the branding is (a splash or wordmark on launch, or restraint).
- **Cluster 2: Feel** — Information density, progress and feedback, structured output character, and live-rendering feel. Propose how dense the default verbosity is, how long-running operations communicate, and how data presentations degrade in narrow terminals. When the paradigm is interactive or hybrid, also propose the streaming feel: whether output streams token-by-token or lands in blocks, how "alive" the thinking indicator feels, and how settled or busy the repaint cadence reads — as a *feel*, not a number.
- **Cluster 3: Craft** — Error tone, interactive posture, interrupt posture, and autocomplete assertiveness. Propose how errors feel (diagnostic vs terse), and when the CLI prompts vs assumes. For interactive products, also propose how interruption feels (can you stop a runaway response cleanly) and how eager autocomplete is (passive ghost-text vs an assertive menu).

This type's Synthesis Gate expression fields:

- **Colour philosophy**: The role colour plays.
- **Symbol vocabulary**: The marker style.
- **Feedback style**: How the CLI communicates work-in-progress.
- **Interactive posture**: When the CLI should ask vs. assume.

When the paradigm is interactive or hybrid, also capture:

- **Streaming feel**: How output arrives — token-by-token or in blocks — and how alive the thinking state feels.
- **Branding posture**: How present the in-terminal identity is on launch.
- **Interactive assertiveness**: How eager prompts, autocomplete, and interruption feel.

---

## Phase 3: Command Architecture

*Runs inside the foundation flow's Phase 3 step — once for this type, per the shared skeleton it defines.*

The command architecture is the structural container everything else lives inside — the taxonomy, I/O topology, configuration surface, and discovery model.

Decision dimensions: command taxonomy and hierarchy, flag and argument conventions, input/output topology (what goes to stdout vs stderr vs stdin), configuration surface and precedence, help and discovery model, shell integration, and progressive disclosure strategy.

When the paradigm is interactive or hybrid, the skeleton also covers the session surface:
- **Session model** — one-shot, a persistent REPL loop, or both. A hybrid must define how the same capability is reached one-shot *and* in-session.
- **Slash-command taxonomy and grammar** — namespacing, arguments, discoverability, and how slash commands coexist with flag-based subcommands without two parallel vocabularies.
- **Input modes** — single-line, multi-line editing, and multimodal entry (`@`-mentions, file paths, paste) where the product warrants.
- **The dual-surface contract** — every capability reachable interactively must also be reachable scriptably, so the interactive layer never strands functionality the spine cannot reach. This is the architectural expression of the composable-floor rule.

Capture examples for the Architecture discovery-notes bullet: authentication backend, telemetry sink, update channel, remote config service, credential storage.

---

## Phase 5: Expert Translation & Review

*The foundation flow runs this phase once per active type, after the brand language direction (foundation Phase 4) is confirmed. The agent translates that direction into concrete ANSI specifications — the user never has to think about a raw escape code.*

### 5a: Translation (Agent-Driven, Autonomous)

The agent translates the approved direction into a rigorous CLI design specification. This track's file table (below) feeds the foundation flow's 5a mechanics — output location, one `write_file` per section, the self-check before presenting.

**This track's section files:**

| File | Content |
|---|---|
| `00-header.md` | The document title and the "implementation-ready specification" intro paragraph. No summary section — the Downstream Context (Protocol 5) is written separately to `.groundwork/context/design-system.md` at commit, not concatenated into the spec |
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

The commit/review `cat *.md` globs pick up `06`/`07` automatically with no change. Split into two files (rather than one) so the Phase 5b re-flow stays unambiguous: `06` is walked in the Interaction cluster, `07` in the Surface cluster, so each cluster maps to a single file. Each file is a self-contained markdown section — start its top-level heading at H1 (`# Part 1 — Constraints`) or H2 as appropriate so the files compose cleanly when concatenated. In a multi-type session, `06`/`07` take the next slots in this type's decade (e.g. `16`/`17`) per the foundation flow's Draft Layout rule.

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

#### Design System Target Structure

The spec must cover all of the following, each at the depth standard above. Missing sections are not acceptable.

**Part 1 — Constraints**: Startup budgets, composability contracts, platform targets, terminal capability requirements, configuration hierarchy.

**Part 2 — Command Architecture**: Command taxonomy, I/O topology, configuration surface, help system, shell integration, progressive disclosure.

**Part 3 — CLI Design System**:
- **Colour architecture** (ANSI 256 + truecolor, NO_COLOR) — the worked example above sets the depth bar.
- **Typographic hierarchy** — not just "bold for headers": exact weight/style/casing combinations for every content tier, with stacking rules defining which treatments can combine.
- **Output structure templates** — not just "show a table": exact column alignment, header treatment, separator style, truncation rules, and concrete templates for success, list, detail, diff, JSON, and table outputs with both wide and narrow terminal variants.
- **Progress & loading patterns** — not just "use spinners": character sets, rotation speed, message format, completion treatment, stderr routing rules, and multi-step announcement format.
- **Error anatomy** — not just "show helpful errors": exact error format template with severity, causal chain, recovery hint, exit code mapping, warning format, validation batching, and debug output toggle.
- **Confirmation & prompt patterns** — not just "confirm destructive actions": prompt format, accepted responses, `--yes`/`--force` bypass, non-TTY fallback behaviour, selection prompt format, and text input validation.
- **Help text anatomy** — not just "include examples": usage line format, description tone, subcommand grouping, flag alignment, example count and format, see-also links, and footer content.
- **Responsive degradation** — minimum supported width, degradation strategy, column priority rules, and width detection method.
- **Composition rules** — `--json` schema contract, `--quiet` behaviour, `--verbose` behaviour, pipe detection rules, and Unix tool compatibility constraints.
- **Version & update communication**

**Part 4 — Session & Live Surface** (interactive and hybrid paradigms only, each at the depth standard above):
- **Session/REPL loop**
- **Slash-command grammar** — not just "support slash commands": the trigger, argument parsing, completion behaviour, namespacing, and error handling, specified as an EBNF-style grammar.
- **Streaming render budget** — the worked example above sets the depth bar; not just "stream the output": time-to-first-byte target, token-flush cadence, repaint throttle (e.g. ~30fps), and the plain-line fallback when stdout is not a TTY.
- **Autocomplete behaviour** — not just "add autocomplete": trigger conditions, ranking, ghost-text vs. menu presentation, accept/dismiss keys, and a latency ceiling.
- **Live-render/TUI regions and non-TTY fallback** — not just "use a TUI": which screen regions repaint, alt-screen vs. inline rendering, and the dumb-terminal/non-TTY fallback for each region.
- **Session persistence & context-window management** — not just "keep a session": start, persist, resume, clear, and how context-window usage is tracked, surfaced, and compacted.
- **Interrupt semantics** — not just "handle Ctrl+C": what Esc does vs. Ctrl+C, mid-stream cancellation behaviour, and the cleanup guarantee on each.
- **In-terminal branding & splash**

### Independent Review (Pre-Walkthrough)

The user is about to see this draft in Phase 5b. Before they do, the draft passes through an independent review — `groundwork-review` checks it for silent invention, dropped Phase 4 commitments, and contradictions against the upstream Product Brief that the user is unlikely to catch during a walkthrough of ANSI mappings, output templates, and error formats. The CLI design system constrains every downstream command and contract; catching these failures here is cheaper than catching them after `docs/design-system.md` becomes the source of truth.

Assemble the draft — a shell operation, not a model emission, so it costs no output tokens regardless of spec size: `run_command("cat .groundwork/cache/design-system-draft/*.md > .groundwork/cache/design-system-draft.md")`. Then dispatch `groundwork-review` per Protocol 9 with `document_path: .groundwork/cache/design-system-draft.md` and `document_type: design-system`. The gate is fail-closed and the revise cap is Protocol 8's, not restated here: on REVISE, apply every 🔴 Critical finding directly to the affected section file(s) under `.groundwork/cache/design-system-draft/` only, re-assemble with the same `cat` command, and re-dispatch until PRESENT. Once PRESENT, remove the assembled file (`rm .groundwork/cache/design-system-draft.md`; the section files remain the source of truth for Phase 5b and Phase 6) and carry any 🟡 Advisory findings forward into Phase 5b.

Proceed to Phase 5b only once the verdict is PRESENT.

### 5b: Guided Review (Collaborative)

#### Cluster Walkthrough

**Cluster 1: Foundation** — Colour architecture (ANSI 256 + truecolor + NO_COLOR), typographic hierarchy, and output structure templates.

These are the base primitives every later decision composes from. Present the colour role table with fallback chains, the bold/dim/casing hierarchy, and the concrete output templates side by side. Teach the reasoning: why ANSI 256 as the baseline with truecolor enhancement, why specific role-to-colour mappings, how column widths and truncation rules were derived. Offer alternatives that honour the same direction. Wait for the user's reaction before advancing.

**Cluster 2: Interaction** — Progress and loading patterns, confirmation and prompt patterns, error anatomy. For interactive and hybrid CLIs, this cluster also covers `06-session-interaction.md`: the streaming render budget, slash-command grammar, autocomplete behaviour, and interrupt semantics.

These define how the CLI behaves under load and under failure. Present the spinner/progress treatment, the confirmation prompt format with `--yes`/`--force` bypass rules, and the full error message template (severity, causal chain, recovery hint, exit code) as a connected system. For interactive products, present the streaming budget, interrupt model, and autocomplete as part of the same behaviour-under-load story. Teach the trade-offs: machine-friendly stderr routing vs. human-friendly inline updates. Justify the specific choices against the Phase 4 direction. Offer alternatives. Wait for the user's reaction.

**Cluster 3: Surface** — Everything else: help text anatomy, responsive degradation rules, composition rules (`--json` schema, `--quiet`, `--verbose`), version and update communication. For interactive and hybrid CLIs, this cluster also covers `07-live-surface.md`: live-render/TUI regions and their fallback, session persistence and context-window management, and in-terminal branding.

These are engineering craft — decisions the agent should own. Present the full set as a summary table: what was decided, in one line per topic. Call out any judgment calls the user might have an opinion on. Ask if anything feels wrong. Do not walk through each one individually unless the user flags a concern.

The Re-flow Protocol, Walkthrough Progress tracking, and Completion Gate that govern this walkthrough are the foundation flow's Phase 5 machinery — this track's cluster content is what they operate on.

---

## Commit Contributions

Phase 6 runs once for the whole design system, in the foundation flow. This track contributes:

- **Document section:** the `# CLI` section files assembled into `docs/design-system.md`, including the session and live-surface files for interactive/hybrid paradigms.
- **Brand tokens:** the Tier 2 `terminal` block — colour role table, symbol vocabulary, splash, typography per the contract at `.groundwork/skills/groundwork-design-system/templates/brand-tokens.md` — carrying the *same* values as the colour architecture and symbol vocabulary just written into the document. This is the machine projection scaffolding reads to brand the `./dev` CLI and the product's own CLI.
- **Summary key decisions:** colour role table, output structure, exit-code policy; and for interactive/hybrid CLIs, the session model, streaming budget, and slash-command grammar. Binding constraints include the ANSI fallback chain, machine-readability requirements, accessibility floors.
- **Hand-off content:** rejected colour palettes or output templates, deferred decisions (composition rules, plugin architecture), user instincts about CLI ergonomics not yet committed.

## Verification Gate

The visual verification loop is medium-general: observe the running artifact in its medium, against intent and reference. For a `cli` surface the artifact is **terminal output**, and the same three tiers apply — graphical screenshots are one instance of a wider pattern, not a special case.

- **Capture:** the command's rendered output (stdout/stderr, exit code), captured by the surface's interface tests via `subprocess`/`pexpect`.
- **Tier 1 — does it run:** the command executes, exits with the policy's code, and does not crash to stderr — deterministic, asserted directly on output and exit status.
- **Tier 2 — does it read coherently:** the delivery agent reads the captured output and judges it against this track's output structure and colour-role table.
- **Tier 3 — is it excellent:** output ergonomics graded against the CLI spec and the reference tools this track names (ripgrep, Terraform) — alignment, density, colour discipline, error legibility.

The deterministic CLI gate runs today through the surface's interface tests; the graphical render-smoke generator is the first built instance of Tier 1, and the CLI equivalent is sequenced after it. No track is silently graphical-only.
