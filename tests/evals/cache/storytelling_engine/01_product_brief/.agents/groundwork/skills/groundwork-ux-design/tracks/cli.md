# CLI Track

This track applies to products whose primary interface is a command-line tool: terminal applications, shell utilities, developer CLIs, build systems, package managers, infrastructure tools, and any product where humans interact through typed commands and terminal output.

---

## Default Stance

Be fluid. Adapt seamlessly to the user's product positioning, target audience, and Unix philosophy alignment. The agent's role is to match the user's vision — not to impose a rigid CLI style.

The default starting position is modern, high-craft CLI design trends and technical standards. Draw inspiration from trend-setting CLI tools (e.g., `gh`, `rg`, `fd`, `just`, `mise`, charm/bubbletea, starship, `fx`, `bat`, `eza`). When the user has no strong preference, advocate for the following defaults:

**Technical defaults:**
- Sub-100ms cold-start time. Users abandon CLIs that feel sluggish before producing output.
- Structured output mode (`--json`, `--format`) alongside human-readable defaults. Machine-readability is a first-class concern, not a flag bolted on later.
- `NO_COLOR` compliance (https://no-color.org/). Colour enhances but must never be required to interpret output.
- XDG Base Directory Specification compliance for config, cache, and data files.
- Shell completion generation for bash, zsh, fish, and PowerShell as a built-in capability, not an afterthought.
- Exit code discipline: 0 for success, 1 for general errors, 2 for usage errors. Document every non-zero exit code.
- POSIX signal handling: graceful shutdown on SIGINT/SIGTERM with cleanup of temporary files.

**Craft bar** (examples of the premium standard we target — adapt to the user's chosen direction):
- Rich, context-aware help that adapts to the user's current state — not a static wall of flags.
- Progressive disclosure: simple commands with sensible defaults that expert users can override with flags and config.
- Considered output hierarchy: headers, grouped sections, aligned columns, and semantic colour that makes dense terminal output scannable at a glance.
- Tactile feedback: spinners for long operations, progress bars for measurable work, inline status updates for multi-step processes.
- Composable by design: every command produces output that can be piped, filtered, and combined with standard Unix tools.
- Error messages that diagnose, suggest, and link — not just report.

---

## Stage 1: Non-Functional Requirements (NFR)

Begin by understanding the user's values and high-level expectations for how their CLI should feel and behave. Read `docs/product-brief.md` for product context. Do not walk through a granular checklist or present a wall of questions — instead, conduct a higher-level, **strictly one-question-at-a-time** conversation that captures their priorities, values, and instincts.

Pick **one** of the following topics to start with, ask a single question, and wait for the user's response before moving to the next:
- What does "fast" mean to them? Is it startup time, command execution, or time-to-first-output?
- How important is composability? Should every command be pipeable, or are some commands inherently interactive?
- What is the primary platform? POSIX-only, or must it work on Windows?
- How do they think about discoverability? Should the CLI teach users as they go, or be terse and assume expertise?
- What are their instincts around destructive operations? Confirm everything, confirm only dangerous actions, or trust the user?

After you have explored these areas through a multi-turn dialogue, **propose** a comprehensive set of granular NFRs that align with the user's stated values, modern best practices, and the product context. Cover:

1. **Performance & Startup**: Cold-start budget (target ms), lazy loading strategy, time-to-first-output for common commands, dependency loading approach.
2. **Composability & Piping**: stdin/stdout/stderr contract (what goes where), machine-readable output modes (`--json`, `--csv`, `--tsv`), quiet/verbose flags, pipe detection and output adaptation.
3. **Platform & Shell Compatibility**: Target operating systems, POSIX compliance level, Windows support strategy (native, WSL, both), shell completion targets (bash, zsh, fish, PowerShell).
4. **Terminal Capability Detection**: TTY detection strategy, colour capability detection (truecolor, 256, 16, none), terminal width handling, `NO_COLOR` and `FORCE_COLOR` compliance.
5. **Offline & Error Tolerance**: Network-dependent command behaviour, timeout budgets, retry semantics, offline fallback strategies.
6. **Configuration Hierarchy**: Precedence order (flags > env vars > project config > user config > defaults), config file format (TOML, YAML, JSON), XDG compliance, project-local vs. user-global config.
7. **Security**: Credential storage strategy, secret masking in output and logs, sensitive command confirmation gates, audit logging for destructive operations.
8. **Accessibility**: Screen reader compatibility, high-contrast mode, keyboard-only operation guarantees, alternative output formats for assistive technology.

Present the proposed NFRs and refine collaboratively. Once the user approves, write the agreed NFRs to the Stage 1 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 2.

---

## Stage 2: Research

Drawing on the product context and agreed NFRs from Stage 1, build a targeted pool of inspiration.

1. Gather a list of leading CLI tools, terminal applications, and command-line experiences that exemplify modern, high-craft design. Prioritise tools that solve similar UX problems to the ones this product faces and are trend-leading in how they do it. Sources of inspiration include:
   - **Developer CLIs**: `gh` (GitHub CLI — rich interactive + composable output), `rg` (ripgrep — raw speed + smart defaults), `fd` (find replacement — user-friendly defaults), `bat` (cat replacement — syntax highlighting + git integration).
   - **Build & Task Runners**: `just` (simple command runner — discoverable, no magic), `mise` (dev tool manager — polyglot, ergonomic), `nx` (monorepo tooling — task graph, caching), `turbo` (build system — incremental, parallelised).
   - **Infrastructure CLIs**: `terraform` (plan-apply-verify loop), `kubectl` (resource-oriented subcommands), `docker` (verb-noun taxonomy), `flyctl` (opinionated deploy UX).
   - **Terminal UI Frameworks**: charm/bubbletea (Go TUI framework — rich interactive UIs), ink (React for CLIs), oclif (CLI framework — plugin architecture, help generation), clap (Rust CLI parser — derive macros, shell completions).
   - **Terminal Enhancements**: starship (prompt — informational, fast, configurable), `eza`/`lsd` (ls replacements — icons, colours, git status), `fx` (JSON viewer — interactive exploration), `glow` (markdown renderer — terminal-native rich text).
2. Present this Inspiration Library to the user, describing exactly what each example does well and how it applies to our product's CLI design.
3. **STOP and ask the user:** Ask for their thoughts. Do they agree with the references? Are there specific CLI "vibes" or paradigms from this list they want to adopt? Do not proceed until they have confirmed the direction.

Once the user approves, write the agreed inspiration library to the Stage 2 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 3.

---

## Stage 3: Command Architecture

Define the structural container of the CLI — the command taxonomy, I/O topology, and configuration surface that users interact with. This is the equivalent of an "App Shell" for command-line tools.

Guide the user with leading-edge CLI design patterns. Discuss and define:

- **Command Taxonomy**: How are commands organised? Propose a hierarchy based on the product's domain. Discuss verb-noun patterns (`groundwork init`, `groundwork bet create`) vs. noun-verb (`groundwork bet create` vs. `groundwork create bet`). Define the depth limit for subcommands (typically 2–3 levels max). Reference patterns from `gh`, `docker`, and `kubectl`.
- **Flag & Argument Conventions**: Propose conventions for flags (long `--flag`, short `-f`), positional arguments, and boolean flags. Define required vs. optional arguments. Discuss `--yes`/`--force` patterns for bypassing confirmations. Reference GNU and POSIX conventions.
- **Input/Output Topology**: Define what goes to stdout (primary output, pipeable data), stderr (progress, errors, human messages), and stdin (piped input, interactive prompts). Propose how the CLI detects whether it's running interactively (TTY) or in a pipeline and adapts its output accordingly.
- **Configuration Surface**: Where does configuration live? Propose a hierarchy: project-local config (e.g., `.groundwork/config.toml`), user-global config (e.g., `~/.config/groundwork/config.toml`), environment variables, and command flags. Define the precedence order and how conflicts are resolved.
- **Help & Discovery**: How does the user learn what the CLI can do? Propose rich, context-aware help: `--help` on any command shows usage, description, examples, and related commands. Discuss man page generation, contextual hints when commands fail, and "did you mean?" suggestions for typos.
- **Shell Integration**: Propose shell completion generation (bash, zsh, fish, PowerShell), alias recommendations, and prompt integration (e.g., showing project state in the shell prompt via starship-compatible segments).
- **Progressive Disclosure**: How does complexity scale? Propose a strategy where common operations require zero flags (`groundwork init`), power-user features are accessible via flags (`groundwork init --type brownfield`), and expert configuration lives in config files. The 80% case must be effortless.

Propose the command architecture based on the inspiration library and these patterns. Ask the user to react and refine.

Once the user approves, write the agreed command architecture to the Stage 3 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 4.

---

## Stage 4: Terminal Language

Lead a high-level conversation about how the CLI communicates through the terminal. The user should never need to think about specific ANSI codes — your job is to understand their instincts about density, colour, and feedback deeply enough to extrapolate the concrete system yourself.

Discuss the following with the user:

- **Output Personality**: What is the overall voice of the CLI? Terse and Unix-traditional (`git` — minimal output, trust the user), friendly and informative (`gh` — rich output, helpful suggestions, emoji), professional and structured (`terraform` — clear plan/apply separation, aligned output), or playful and colourful (charm tools — rich TUI elements, animations)?
- **Information Density**: How much should each command output? Minimal by default with `--verbose` for detail? Or rich by default with `--quiet` for scripting? How should lists be formatted — compact single-line items, or multi-line cards with metadata?
- **Colour Philosophy**: Is colour functional (semantic meaning: green=success, red=error, yellow=warning), decorative (brand expression, visual hierarchy), or minimal (monochrome with bold/dim for emphasis)? How important is colour to the brand identity?
- **Progress & Feedback**: How does the CLI communicate long-running operations? Spinners (single-line, minimal), progress bars (measurable work), streaming logs (build-tool style), or silent-until-complete (Unix philosophy)? Discuss multi-step operations — should each step be announced, or only the final result?
- **Tables & Structured Output**: How are tabular data and lists presented? Aligned columns with headers, bordered tables, minimal separator-free layouts, or something else? How does the output degrade when the terminal is too narrow?
- **Error Tone**: How do error messages feel? Clinical and precise ("Error: file not found: config.toml"), helpful and suggestive ("Error: config.toml not found. Run `groundwork init` to create it."), or contextual and diagnostic ("Error: config.toml not found. This file is created during setup. It looks like this project hasn't been initialized yet. Run `groundwork init` to get started.")?
- **Iconography & Symbols**: Does the CLI use Unicode symbols (✓, ✗, →, •), emoji (✅, ❌, 🚀), ASCII-safe markers (`[OK]`, `[FAIL]`, `-->`), or no markers at all? What's the fallback when the terminal doesn't support Unicode?
- **Interactive Elements**: When running interactively (TTY detected), does the CLI use prompts, multi-select menus, fuzzy finders, or confirmation dialogs? How opinionated should these be — always interactive, or only when the user hasn't provided enough flags?

### Synthesis Gate

Before caching, distill the entire Stage 4 conversation into a structured direction and present it to the user for confirmation. This is mandatory — scattered conversation notes are not sufficient input for Stage 5.

The synthesis stays in the user's language. No ANSI codes, no output templates, no column widths. It captures the *decisions* the user made in terms they recognise:

- **Output personality**: A short characterisation of the CLI's voice (e.g., "Terse and Unix-traditional — trust the user, minimal output, no hand-holding").
- **Information density**: The default verbosity posture (e.g., "Minimal by default, rich on request via --verbose").
- **Colour philosophy**: The role colour plays (e.g., "Purely functional — green/red/yellow for status, no decorative colour").
- **Feedback style**: How the CLI communicates work-in-progress (e.g., "Spinners for indeterminate, progress bars for measurable, silent for fast ops").
- **Error tone**: How errors feel (e.g., "Diagnostic and helpful — say what happened, why, and what to do next").
- **Interactive posture**: When the CLI should ask vs. assume (e.g., "Confirm destructive actions, skip everything else").
- **Symbol vocabulary**: The marker style (e.g., "Unicode symbols like ✓ and ✗, not emoji, with ASCII fallback").

Present this as a clear summary the user can scan and approve in one read. Ask them to confirm or correct before proceeding.

Once the user confirms the direction, write this synthesis to the Stage 4 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 5.

---

## Stage 5: Expert Translation & Review

Stage 5 has two distinct phases. The first is autonomous work by the agent. The second is a collaborative conversation about the specifics.

### 5a: Translation (Agent-Driven)

The user provided taste, instinct, and direction across Stages 1–4. The agent now translates that into a rigorous CLI design specification — autonomously.

Compile the full UX Design Guide using the approved outputs stored in `.groundwork/cache/ux-design-cache.md`. The document combines NFRs from Stage 1 with a comprehensive CLI design system that the agent derives from the terminal language direction captured in Stage 4.

Apply the `groundwork-writer` skill to ensure the tone is declarative, assertive, and free of hedging. Structure it to read like a rigorous CLI specification that an implementer (human or agent) can follow to produce a polished, consistent tool.

**The Translation Mandate**: The user said "terse and Unix-traditional" — the agent commits to specific output templates, column widths, and truncation rules. The user said "diagnostic errors" — the agent specifies the exact error message structure with severity labels, causal chains, and recovery hints. The user said "Unicode symbols" — the agent defines the complete symbol vocabulary with ASCII fallbacks. Every high-level preference from Stage 4 must be resolved into concrete, implementable specifications. If the cached direction is ambiguous, the agent makes the design call — that is the job.

**Critical**: CLI tools consistently feel amateurish without deeply specified output formatting. The design system must go beyond "use colours" — it must prescribe exact ANSI colour mappings, output column widths, error message templates, progress indicator styles, and a clear hierarchy that tells the implementer exactly how every piece of terminal output should look.

### UX Design Guide Target Structure

#### Part 1: The Constraints (Non-Functional Requirements)
Concrete behavioural rules derived from Stage 1. Startup budgets, composability contracts, platform targets, terminal capability requirements, and configuration hierarchy.

#### Part 2: Command Architecture & Interaction Principles
Command taxonomy, I/O topology, configuration surface, help system, shell integration, and progressive disclosure from Stage 3. The structural skeleton of the CLI.

#### Part 3: CLI Design System

Translate the user's high-level terminal language preferences into concrete, enforceable specifications. Each section must be deeply specified:

##### Colour Architecture
- Define all colours using **ANSI 256** as the baseline, with **truecolor** (24-bit) as the enhanced tier. Specify both representations for every colour.
- Define semantic colour roles: success (command completed), error (command failed), warning (non-fatal issue), info (informational output), muted (secondary/contextual text), accent (highlighted values, counts, paths), header (section titles), key (flag names, config keys), value (flag values, config values).
- For each colour role: specify the ANSI 256 code, the truecolor hex value, and the `NO_COLOR` fallback treatment (bold, dim, italic, underline, or plain).
- Define the `NO_COLOR` compliance strategy: when `NO_COLOR` is set, all colour is stripped. Specify how the output retains hierarchy and readability through bold, dim, and whitespace alone.
- Define `FORCE_COLOR` behaviour for CI/CD environments that strip TTY detection but want colour.

##### Typographic Hierarchy
Terminal "typography" is defined by weight (bold, normal, dim), style (italic, underline), and casing:
- **Headers/Titles**: Bold, optionally UPPER CASE or Title Case. Used for section labels, command names in help output, and summary lines.
- **Primary Content**: Normal weight. The default for command output, list items, and descriptions.
- **Secondary/Contextual**: Dim. Used for metadata, timestamps, IDs, and supplementary information that supports but doesn't lead.
- **Emphasis**: Bold or underline (never both simultaneously). Used for key values, paths, and actionable items within a line.
- **Code/Literals**: Surrounded by backticks in prose, or rendered as-is in structured output. Used for file paths, command names, and config keys.
- Define the exact combination rules: which treatments can stack and which are mutually exclusive.

##### Output Structure Templates
Define the exact format for each output type the CLI produces:

- **Success Output**: What does a successful command look like? Define the structure (e.g., status marker + message + contextual detail). Provide an exact template.
- **List Output**: How are lists of items displayed? Define column alignment, header row treatment, separator style, and truncation behaviour for long values. Provide templates for both wide and narrow terminals.
- **Detail Output**: How is a single item's full detail displayed? Define the key-value layout (aligned colons, indented sections, grouped fields). Provide an exact template.
- **Diff Output**: How are before/after changes displayed? Define the diff format (unified diff, side-by-side, inline markers). Specify colour treatments for additions, deletions, and unchanged lines.
- **JSON Output**: Define the structured output format for `--json` mode. Specify the schema conventions (camelCase vs. snake_case, null handling, array wrapping).
- **Table Output**: Define column alignment rules, header formatting, row separators (or lack thereof), and the strategy for columns that exceed available width (truncate, wrap, or omit).

##### Progress & Loading Patterns
Define how the CLI communicates ongoing work:

- **Spinner**: For indeterminate operations. Specify the spinner character set (e.g., `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` or `|/-\`), rotation speed (ms per frame), and the message format alongside the spinner. Define the completion treatment (spinner replaced with ✓ or ✗).
- **Progress Bar**: For measurable operations. Specify the bar characters (e.g., `█` for filled, `░` for empty), width (percentage of terminal or fixed), and the information displayed alongside (percentage, ETA, items processed).
- **Streaming Log**: For build-tool-style output. Define the prefix format (timestamp, step name, or neither), line buffering behaviour, and how errors are visually distinguished from normal output within the stream.
- **Multi-Step Progress**: For operations with discrete phases. Define how each step is announced (e.g., `[1/4] Installing dependencies...`), how completion is marked, and how the overall summary is presented after all steps finish.
- Define the rule: spinners and progress bars write to **stderr** so stdout remains clean for piping.

##### Error Anatomy
Define the complete error output specification:

- **Error Format**: Define the exact structure of an error message. At minimum: severity label, error description, and recovery suggestion. Specify the format for each component and the separator between them. Example template:
  ```
  error: <what happened>
    ↳ <why it matters or what caused it>
    ↳ hint: <what the user should do>
  ```
- **Exit Code Mapping**: Define the exit code for each error category. At minimum: 0 (success), 1 (general error), 2 (usage/argument error). Extend with domain-specific codes if needed. Document every code.
- **Warning Format**: Define how non-fatal warnings are displayed. Specify whether they go to stderr (recommended), how they're visually distinguished from errors, and whether they can be suppressed (`--quiet`).
- **Validation Error Batching**: When multiple validation errors occur (e.g., multiple invalid flags), define whether they're reported one at a time or batched into a single output.
- **Stack Traces / Debug Output**: Define how detailed diagnostic information is exposed. Typically hidden by default, shown with `--debug` or `GROUNDWORK_DEBUG=1`. Specify the format.

##### Confirmation & Prompt Patterns
Define how the CLI interacts when it needs user input:

- **Destructive Action Guard**: Define which operations require confirmation (e.g., delete, overwrite, reset). Specify the prompt format, the accepted responses (y/n, yes/no), and the `--yes`/`--force` flag that bypasses confirmation. Define the behaviour when stdin is not a TTY (default to abort, not to proceed).
- **Selection Prompts**: Define the format for single-select and multi-select prompts. Specify the indicator characters (e.g., `>` for cursor, `[x]` for selected), keyboard controls, and the search/filter behaviour if the list is long.
- **Text Input Prompts**: Define the prompt format, default value display, and validation feedback. Specify inline validation timing (on enter, or live as the user types).
- **Non-Interactive Fallback**: When the CLI detects it's running in a non-interactive environment (pipe, CI, no TTY), define the behaviour: abort with a clear error ("This command requires interactive input. Use --flag to provide values non-interactively."), or fall back to defaults.

##### Help Text Anatomy
Define the exact format of `--help` output:

- **Usage Line**: The command synopsis. Specify the format (e.g., `Usage: groundwork <command> [flags]`), how optional vs. required arguments are distinguished (brackets, angle brackets), and how variadic arguments are shown.
- **Description**: A 1–2 sentence summary of what the command does. Specify the tone (matches the CLI's overall voice from Stage 4).
- **Subcommand List**: Grouped by category if the CLI has many subcommands. Specify column alignment, description truncation, and category header formatting.
- **Flag List**: Grouped logically (common flags first, then advanced). Specify the format for short + long flags, type annotations, default values, and descriptions. Define the alignment rules.
- **Examples Section**: Concrete usage examples. Specify how many (typically 2–4), the format (command on one line, description on the next or inline), and whether they show output.
- **See Also**: Links to related commands, documentation URLs, or man pages.
- **Footer**: Version, bug report URL, documentation URL.

##### Responsive Degradation
- Define the minimum terminal width the CLI supports (e.g., 40 columns). Below this width, define the degradation strategy (wrap, truncate, or switch to a compact output format).
- Specify how tables degrade: column priority (which columns are hidden first), switch to vertical key-value layout, or truncation with `...`.
- Define how the CLI detects terminal width (`$COLUMNS`, `tput cols`, or ioctl) and how it behaves when width is unknown (assume 80 columns).

##### Composition Rules
- Define the `--json` output contract: what fields are guaranteed, what the schema looks like, and how it relates to the human-readable output.
- Define `--quiet` behaviour: suppress all non-essential output. Only errors and the primary result (if applicable) are emitted.
- Define `--verbose` behaviour: show additional context, timing information, and intermediate steps.
- Specify the pipe detection rule: when stdout is not a TTY, automatically switch to machine-readable output (no colour, no spinners, no interactive prompts). Define whether this is the same as `--json` or a separate plain-text mode.
- Define how the CLI plays with standard Unix tools: can output be `grep`'d, `awk`'d, `sort`'ed, `head`'d? Specify any output format constraints that enable this.

##### Version & Update Communication
- Define the version display format for `--version` (e.g., `groundwork 1.2.3` or `groundwork version 1.2.3 (abc1234)`).
- Define the update notification UX: when a newer version is available, how and when is the user notified? Specify the frequency (once per day, once per session), the message format, and where it appears (stderr, after command output, or as a separate line).
- Specify the opt-out mechanism for update notifications (env var or config).

---

Before presenting the draft, run this self-check: **every section must contain committed, implementable values — not echoes of the user's words**.

The user's vocabulary must be fully translated:
- "Terse and Unix-traditional" → specific output templates with exact column widths and truncation rules.
- "Diagnostic errors" → a complete error message structure with severity labels, indentation, and recovery hint format.
- "Unicode symbols" → a full symbol vocabulary table with ASCII fallbacks.
- "Minimal by default" → exact rules for what each verbosity level shows and hides.
- "Functional colour" → specific ANSI colour-to-meaning mappings and `NO_COLOR` degradation.

If any section still reads like a design brief rather than a build specification, the translation is incomplete. Derive the missing values from the approved direction — do not go back to the user. Making these calls is the agent's core contribution.

### 5b: Review (Collaborative)

Present the complete draft to the user. This is the first time the user sees technical specifics — actual ANSI mappings, output templates, error format definitions, symbol tables.

The user's role shifts from providing direction to reacting to choices. They will say things like "that error format is too verbose," "I prefer the spinner style from ripgrep," or "the help text layout is exactly right." Walk through the spec together and adjust.

Do not rush this. The user has earned a say in the details by providing clear direction earlier. If they push back on a choice, propose alternatives that still honour the original intent. If they approve, move on.

Refine iteratively until the user is satisfied with the full specification.

Once approved, return to `instructions.md` and execute Stage 6: Commit.
