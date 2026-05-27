# CLI Track

This track applies to products whose primary interface is a command-line tool: terminal applications, shell utilities, developer CLIs, build systems, package managers, infrastructure tools, and any product where humans interact through typed commands and terminal output.

---

## Default Stance

Be fluid. Adapt seamlessly to the user's product positioning, target audience, and Unix philosophy alignment. The agent's role is to match the user's vision — not to impose a rigid CLI style.

The default starting position is modern, high-craft CLI design. When the user has no strong preference, advocate for the following defaults — and be ready to explain *why* each one matters:

**Technical defaults:**
- Sub-100ms cold-start time. Users abandon CLIs that feel sluggish before producing output — every dependency loaded at startup is a tax on every invocation.
- Structured output mode (`--json`, `--format`) alongside human-readable defaults. Machine-readability is a first-class concern because CLIs live in pipelines, not just in terminals.
- `NO_COLOR` compliance (https://no-color.org/). Colour enhances readability but must never be required to interpret output — CI environments, accessibility tools, and piped output all strip colour.
- XDG Base Directory Specification compliance for config, cache, and data files. Scattering dotfiles in `$HOME` is a legacy pattern that makes environments unreproducible.
- Shell completion generation for bash, zsh, fish, and PowerShell as a built-in capability. Discoverability through tab completion is how power users learn a CLI — adding it later means retrofitting every command.
- Exit code discipline: 0 for success, 1 for general errors, 2 for usage errors. Scripts depend on exit codes for control flow — undocumented or inconsistent codes break automation silently.
- POSIX signal handling: graceful shutdown on SIGINT/SIGTERM with cleanup of temporary files. Ctrl+C must never leave orphaned processes or corrupted state.

**Craft bar** (examples of the premium standard the agent targets):
- Rich, context-aware help that adapts to the user's current state.
- Progressive disclosure: simple commands with sensible defaults that expert users can override.
- Considered output hierarchy: headers, grouped sections, aligned columns, and semantic colour that makes dense terminal output scannable.
- Tactile feedback: spinners for long operations, progress bars for measurable work, inline status updates for multi-step processes.
- Composable by design: every command produces output that can be piped, filtered, and combined with standard Unix tools.
- Error messages that diagnose, suggest, and link — not just report.

Draw inspiration from trend-setting CLIs: `gh`, `rg`, `fd`, `just`, `mise`, charm/bubbletea, starship, `bat`, `eza`.

---

## Cross-Phase Signal Capture

CLI conversations routinely surface signals that belong to a different phase — a startup budget with infrastructure implications, a configuration store that shapes architecture, a sequencing instinct about which commands ship first. As these signals arise during any stage, append them as bullets under the matching section header in `.groundwork/cache/discovery-notes.md` — `## Architecture` for infrastructure or technology opinions, `## Design Details` for protocol or schema implications, `## Bets` for feature sequencing, `## Product Brief` for vision-level refinements — then return to the current topic. Capturing them now means the downstream phase finds them instead of asking the user to repeat themselves.

---

## Stage 1: Non-Functional Requirements (NFR)

NFRs define the engineering envelope the CLI design system must operate within. Startup budgets, composability contracts, platform targets, and security models all constrain design choices downstream — a CLI that specifies rich interactive prompts but must work in headless CI pipelines is internally contradictory.

Read `docs/product-brief.md` for product context. Then explore the user's values and priorities through a multi-turn conversation. Understand what they care about, what tradeoffs they'd accept, and what "broken" looks like to them.

The goal is to emerge with a clear picture of the CLI's non-functional constraints across these dimensions: performance and startup budgets, composability and piping contracts, platform and shell compatibility, terminal capability detection, offline and error tolerance, configuration hierarchy, security, and accessibility. Not every dimension applies to every CLI — explore what's relevant, skip what isn't.

After exploring through dialogue, **propose** a comprehensive set of granular NFRs that synthesise the user's stated values with modern best practices. Present them and refine collaboratively. Once approved, write to the Stage 1 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 2.

---

## Stage 2: Research

The inspiration library grounds the design conversation in concrete, existing tools. Abstract discussions ("make it feel polished") produce vague specs. Discussions anchored in specific examples ("ripgrep renders results from a streaming parser so the first match appears before the search completes") produce actionable design decisions.

Drawing on the product context and agreed NFRs from Stage 1, identify the core UX challenges this CLI faces and find leading tools that solve similar problems exceptionally well. Describe the **specific pattern or interaction** worth borrowing — not just the tool's reputation. Sources span developer CLIs, build and task runners, infrastructure tools, terminal UI frameworks, and terminal enhancements.

Present the Inspiration Library and ask for the user's reaction. Do not proceed until they have confirmed the direction.

Once approved, write to the Stage 2 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 3.

---

## Stage 3: Command Architecture

The command architecture is the structural container everything else lives inside — the taxonomy, I/O topology, configuration surface, and discovery model. Getting this wrong means reworking every command. Getting it right means every subsequent design decision has a home.

Define the structural skeleton using patterns from the Stage 2 inspiration library. The agent should explore and propose decisions across: command taxonomy and hierarchy, flag and argument conventions, input/output topology (what goes to stdout vs stderr vs stdin), configuration surface and precedence, help and discovery model, shell integration, and progressive disclosure strategy.

Guide the conversation with leading-edge CLI design patterns. Propose the architecture based on the inspiration library, then ask the user to react and refine.

Once approved, write to the Stage 3 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 4.

---

## Stage 4: Terminal Language

This stage captures the user's instincts about how the CLI communicates through the terminal — the raw material the agent will translate into concrete ANSI specifications in Stage 5. The user should never need to think about specific ANSI codes.

Explore terminal language dimensions through conversation — one topic at a time, going deep before advancing:

- **Output personality** — the CLI's voice and how it relates to the user
- **Information density** — default verbosity and how complexity scales
- **Colour philosophy** — whether colour is functional, decorative, or minimal
- **Progress and feedback** — how long-running operations communicate
- **Tables and structured output** — how data is presented and how it degrades
- **Error tone** — how errors feel and what they communicate
- **Iconography and symbols** — Unicode, emoji, ASCII, or none
- **Interactive elements** — when the CLI prompts vs assumes

### Synthesis Gate

Before caching, distill the entire Stage 4 conversation into a structured direction and present it to the user for confirmation. Scattered conversation notes are not sufficient input for Stage 5.

The synthesis stays in the user's language. No ANSI codes, no output templates, no column widths. It captures the *decisions* the user made in terms they recognise:

- **Output personality**: A short characterisation of the CLI's voice.
- **Information density**: The default verbosity posture.
- **Colour philosophy**: The role colour plays.
- **Feedback style**: How the CLI communicates work-in-progress.
- **Error tone**: How errors feel.
- **Interactive posture**: When the CLI should ask vs. assume.
- **Symbol vocabulary**: The marker style.

Present as a clear summary the user can scan and approve in one read. Confirm before proceeding.

Once confirmed, write the synthesis to the Stage 4 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 5.

---

## Stage 5: Expert Translation & Review

### 5a: Translation (Agent-Driven, Autonomous)

The user provided taste, instinct, and direction across Stages 1–4. The agent now translates that into a rigorous CLI design specification — autonomously.

Compile the full UX Design Guide using the approved outputs stored in `.groundwork/cache/ux-design-cache.md`. The document combines NFRs from Stage 1 with a comprehensive CLI design system that the agent derives from the terminal language direction captured in Stage 4.

Apply the `groundwork-writer` skill to ensure the tone is declarative, assertive, and free of hedging. Structure it to read like a rigorous CLI specification that an implementer (human or agent) can follow to produce a polished, consistent tool.

#### The Translation Mandate

The user said "terse and Unix-traditional" — the agent commits to specific output templates with exact column widths and truncation rules. The user said "diagnostic errors" — the agent specifies the exact error message structure with severity labels, causal chains, and recovery hints. The user said "Unicode symbols" — the agent defines the complete symbol vocabulary with ASCII fallbacks. Every high-level preference from Stage 4 must be resolved into concrete, implementable specifications. If the cached direction is ambiguous, the agent makes the design call — that is the job.

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

The same standard applies across the entire specification:
- **Typographic hierarchy**: Not just "bold for headers" — exact weight/style/casing combinations for every content tier, with stacking rules defining which treatments can combine.
- **Output structure templates**: Not just "show a table" — exact column alignment, header treatment, separator style, truncation rules, and concrete templates for success, list, detail, diff, JSON, and table outputs with both wide and narrow terminal variants.
- **Progress patterns**: Not just "use spinners" — character sets, rotation speed, message format, completion treatment, stderr routing rules, and multi-step announcement format.
- **Error anatomy**: Not just "show helpful errors" — exact error format template with severity, causal chain, recovery hint, exit code mapping, warning format, validation batching, and debug output toggle.
- **Confirmation patterns**: Not just "confirm destructive actions" — prompt format, accepted responses, `--yes`/`--force` bypass, non-TTY fallback behaviour, selection prompt format, and text input validation.
- **Help text anatomy**: Not just "include examples" — usage line format, description tone, subcommand grouping, flag alignment, example count and format, see-also links, and footer content.
- **Responsive degradation**: Minimum supported width, degradation strategy, column priority rules, and width detection method.
- **Composition rules**: `--json` schema contract, `--quiet` behaviour, `--verbose` behaviour, pipe detection rules, and Unix tool compatibility constraints.

#### UX Design Guide Target Structure

**Part 1 — Constraints**: Startup budgets, composability contracts, platform targets, terminal capability requirements, configuration hierarchy.

**Part 2 — Command Architecture**: Command taxonomy, I/O topology, configuration surface, help system, shell integration, progressive disclosure.

**Part 3 — CLI Design System** (each at the depth standard above):
Colour architecture (ANSI 256 + truecolor, NO_COLOR) · Typographic hierarchy · Output structure templates · Progress & loading patterns · Error anatomy · Confirmation & prompt patterns · Help text anatomy · Responsive degradation · Composition rules · Version & update communication

---

Before presenting the draft, run this self-check:
1. **Does every section contain committed, implementable values?** If a section reads like a brief ("use a terse style with functional colour"), the translation is incomplete.
2. **Does every specification include concrete templates or tables?** Prose descriptions without examples are insufficient.
3. **Would a developer implementing this need to make any design decisions?** If yes, the spec is underspecified.

### 5b: Review (Collaborative)

Present the complete draft to the user. This is the first time the user sees technical specifics — actual ANSI mappings, output templates, error format definitions, symbol tables.

The user's role shifts from providing direction to reacting to choices. Walk through the spec together. Do not rush this — the user has earned a say in the details by providing clear direction earlier. If they push back on a choice, propose alternatives that still honour the original intent. If they approve, move on.

Refine iteratively until the user is satisfied with the full specification.

Once approved, proceed to Stage 6: Commit.

---

## Stage 6: Commit

Execute **only** after Stage 5b review is complete and the user has explicitly approved the specification.

Follow the Phase Lifecycle commit protocol from the Operating Contract:

1. Write the finalised spec to `docs/ux-design.md` by promoting it from `.groundwork/cache/ux-design-draft.md`.
2. Delete the cache files `.groundwork/cache/ux-design-cache.md` and `.groundwork/cache/ux-design-draft.md`.
3. Apply the Living Documents protocol — scan the conversation for insights that refine any existing `docs/` artifact (e.g. `docs/product-brief.md`). Apply surgical updates. Report what changed.
4. Update discovery notes — scan for out-of-phase signals not captured in real time. Remove `## UX Design` entries incorporated into `docs/ux-design.md`.
5. Confirm that the phase is complete.
6. Recommend a fresh context for the next phase — a clean context gives the next skill full working memory.
7. Immediately load and execute the `groundwork-orchestrator` skill to show the user what's next. Do not ask the user to invoke it — hand off automatically.

