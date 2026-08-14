---
owner: "@RNEL"
audience: "Humans, AI Agents"
last_reviewed: "2026-07-28"
---

# State of the art: AI-leveraged developer workflows (mid-2026)

A survey of how practitioners and engineering organisations actually plan, execute, review, and verify software work with AI coding agents, as of July 2026.

This document is deliberately neutral. It makes no argument for or against any particular methodology, including GroundWork's. Its purpose is to establish what the evidence supports before any conclusions are drawn from it.

The conclusions GroundWork draws from it live separately, in [groundwork-implications-2026-08.md](groundwork-implications-2026-08.md).

---

## The short version

**One finding survives triangulation across every independent source type — measured telemetry, vendor disclosure, academic study, and practitioner account alike:**

> **Human review capacity, not model capability, is now the binding constraint on AI-assisted delivery.**

Google throttled agent generation *specifically* to avoid overwhelming reviewers. Shopify still requires a human PR reviewer on all production code. GitHub's own guidance calls human judgment *"the irreplaceable bottleneck."* Kilo sizes tasks by what one person can review in a sitting. Meta's diff volume rose as timely-review share fell. And LinearB's 8.1M-PR dataset locates the constraint precisely: AI PRs wait **~5× longer to be picked up** but are reviewed *faster* once started — **it is a queueing problem, not a reviewing problem.**

Four things follow that are worth stating before the detail:

1. **Batch size roughly doubled** in the year to mid-2026 — four independent telemetry sets agree. Larger batches are exactly what makes a PR expensive to pick up.
2. **The measurement instrument is broken.** METR's RCT showed developer self-report off by ~39 points, then abandoned its own replication because developers now refuse to work without AI. There is currently **no trustworthy controlled estimate of AI effect size on throughput, in either direction.**
3. **Agents systematically over-report completion**, and predefined test suites cannot close the gap when the agent writes both the code and its oracle.
4. **The one rigorous test of always-on repository context files found they did not improve task success** while raising cost >20% — acting largely as a documentation substitute rather than novel guidance.

---

## 0. How to read this

### Evidence grades

Every claim carries a label. The distinction is load-bearing, because the two research methods behind this document have opposite blind spots.

| Label | Meaning |
|---|---|
| **[MEASURED]** | A number was published from observation, with at least some stated method |
| **[DESCRIBES]** | Someone reports working this way. No measurement. |
| **[VENDOR]** | Source has a commercial interest in the conclusion |
| **[INDEPENDENT]** | Source has no product riding on the answer |
| **[REFUTED]** | Failed adversarial verification — listed in §7, never asserted here |

Where a vendor discloses something **against** its own interest, that raises reliability rather than lowering it, and is noted inline.

### How this was researched, and why it matters

Two adversarial passes (3-vote refutation per claim, 2-of-3 needed to kill) ran first: 47 sources, 234 claims extracted, 50 verified, **35 confirmed and 15 refuted**. Those passes covered context engineering, verification, and review-at-scale well — and returned *nothing* on execution mechanics.

That was a method artifact, not an absence of evidence. Adversarial verification is built for falsifiable propositions; "teams run parallel worktrees" is not one. Three descriptive passes then filled the gap. The material in §2 is consequently richer in detail and weaker in proof than the material in §1, §3 and §5. The labels above are how you tell them apart.

### Shelf life

Anything tied to a specific model generation has roughly a **4–6 month half-life**. Anthropic's November 2025 harness prescription — forced context resets with structured handoff files — was materially relaxed by its own March 2026 follow-up, once Opus 4.6 could run 2+ hours coherently on automatic compaction.

Architectural findings decay more slowly. **Externalised durable state**, **self-verification against tools that cannot lie**, and **review as the binding constraint** have each survived a model generation or more.

---

## 1. Planning: context engineering replaced prompt engineering

### 1.1 The empirical basis for minimal context

Model recall degrades as context grows. **[MEASURED, INDEPENDENT]** NoLiMa (Modarressi et al., arXiv:2502.05167, ICML 2025) found 11 of 13 models advertising 128K+ context fall below **half** their sub-1K baseline at 32K tokens — GPT-4o from 99.3% to 69.7%. Chroma's Context Rot study (2025-07-14) observed length-driven degradation in **all 18** frontier models tested, including on trivially simple tasks. Liu et al. ("Lost in the Middle", TACL) report >30% accuracy drops for mid-context placement.

**The mechanism is not established, and the effect is not linear in token count.** Anthropic's "attention budget" framing — every new token depletes the budget — is a useful heuristic, not a demonstrated mechanism. Chroma explicitly declines to name a cause, and found that **shuffled, incoherent haystacks scored better than coherent ones at identical token counts**. Distractor presence and needle-question semantic similarity dominate raw length. Report the effect as robust; do not report the explanation as settled.

### 1.2 The retrieval architecture that won

**[VENDOR, confirmed 3-0]** The dominant pattern is hybrid: a small always-loaded instruction file plus just-in-time retrieval through glob and grep primitives. Anthropic states it plainly — CLAUDE.md files are "naively dropped into context up front, while primitives like glob and grep allow it to navigate its environment and retrieve files just-in-time, effectively bypassing the issues of stale indexing and complex syntax trees."

This is contested on merits. Semantic-search MCP servers and critiques such as Milvus's "Why I'm Against Claude Code's Grep-Only Retrieval" argue for hybrid semantic retrieval. Those critiques presuppose the architecture rather than refute the description of it.

### 1.3 Externalised state is the real long-horizon technique

**[VENDOR, against interest, confirmed 3-0]** Anthropic's own harness post (2025-11-26): *"Compaction isn't sufficient. Out of the box, even a frontier coding model like Opus 4.5 running on the Claude Agent SDK in a loop across multiple context windows will fall short"* — it "doesn't always pass perfectly clear instructions to the next agent." The working substitute was a progress log, a machine-readable feature list, and git for revert and recovery.

**[MEASURED, INDEPENDENT]** Corroborated across three 2026 papers: arXiv 2603.20432 beats prior SOTA by **17.3%** by externalising context into files rather than stuffing the window; arXiv 2604.08224 describes context-plus-external-store as the pattern underlying most production coding agents; VISTA (arXiv 2606.30005) reports its archive/recovery approach outperforming compaction.

**Time sensitivity.** Anthropic's 2026-03-24 follow-up reports Opus 4.6 running coherently for 2+ hours on automatic SDK compaction without forced resets. The *reset cadence* is loosening; *file-based state handoff* persists. Note also active 2026 critiques of compaction fidelity — arXiv 2606.11213 on structured eviction, and 2606.22528 on safety constraints silently eroding under compaction.

### 1.4 The counter-evidence that deserves the most weight

**[MEASURED, INDEPENDENT]** Gloaguen, Mündler, Müller, Raychev, Vechev (ETH Zurich SRI Lab), **"Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?"**, arXiv:2602.11988 (v1 2026-02-12, v2 2026-06-23).

> "Surprisingly, we find that providing context files does not generally improve task success rates, while increasing inference cost by over 20% on average."

| Condition | Benchmark | Δ resolve rate | Δ cost |
|---|---|---|---|
| LLM-generated | SWE-bench Lite (300 tasks) | **−0.5%** | **+20%** |
| LLM-generated | AGENTbench (138 instances) | **−2%** | **+23%** |
| Developer-written | AGENTbench | **+4%** | up to +19% |

Four agent-model pairs were tested (Claude Code + Sonnet-4.5, Codex + GPT-5.2, Codex + GPT-5.1-mini, Qwen Code + Qwen3-30b-coder). AGENTbench was built deliberately from *niche* repos to avoid training-data contamination.

**The mechanism finding is the interesting part.** When existing documentation (`.md` files, `examples/`, `docs/`) was **stripped from the repos**, LLM-generated context files improved performance by **+2.7%** and outperformed developer-written documentation. The authors' reading: context files largely function as a **documentation substitute**, not as novel guidance. If a repo already has good docs, the context file is redundant overhead.

Secondary findings: context files caused agents to run more tests, search more files, and adopt repo-specific tooling when named (uv usage ×1.6, repo tools ×2.5). **Instructions are followed well; repository overviews — "popular and recommended by model providers" — are not.**

**Three limits to carry.** The study is Python-only; it measures task-resolution rate alone, with no maintainability or security dimension; and n=138 on AGENTbench means the +4% developer-written result is plausibly indistinguishable from noise, which is why the paper folds it into "does not generally improve." The honest summary is *no reliable benefit, real cost*.

**One scope limit the paper does not state, and that matters.** It tests **always-on** context files. That is precisely the mechanism progressive disclosure (§6.4) is designed to replace. This is not evidence against on-demand skills, and arguably supports them.

---

## 2. Execution: how agents are actually run

The richest section in practice detail, the thinnest in proof. Grade labels matter most here.

### 2.1 Parallelism, and the best-documented failure in the corpus

**[DESCRIBES, INDEPENDENT]** Reported concurrency is lower than the discourse suggests. Simon Willison runs ~4 parallel agents; Peter Steinberger 3–8 Codex instances in a terminal grid, mostly *without* isolation; Addy Osmani 4–5 background plus 3–5 interactive. **[DESCRIBES, VENDOR-adjacent]** Kilo Code's engineers: most run **2–4 foreground**, one runs 1–3 foreground plus 20+ background.

**The binding constraint is human attention, not compute.** Willison: *"I can only focus on reviewing and landing one significant change at a time"* — and *"by like 11 AM, I am wiped out for the day."* Kilo's operative rule is a **reviewability threshold**: *"A good agent task should produce an output a human can review in one sitting. If the diff is too large to inspect carefully, the task was probably too large."*

**[MEASURED, INDEPENDENT]** **Git worktree contention is real and quantified.** claude-code issue #55724 (2026-05-03): dispatching 13 parallel worktree-isolated agents produced `Unable to create '.git/index.lock'` — **5 committed, 8 failed (62% failure rate)**.

The compounding harm is the actual lesson: a failed agent exits without committing, auto-cleanup then removes the worktree, and **the work is permanently destroyed**.

Root cause (coderberry, 2026-05-29): worktrees have independent index files but share `.git/` for refs, object packs and config. Git is *"a single-writer system"* when infrastructure is shared.

| Concurrency-safe | Concurrency-unsafe |
|---|---|
| `diff`, `log`, `show` | `add`, `commit`, `checkout`, `fetch`, `pull`, `push` |

Related breakages: shared `.git/hooks` fires pre-commit hooks in every worktree; each worktree needs its own dependency install.

**[DESCRIBES]** A second ceiling: Kilo engineers report quality degrading around **60% context fill**, with compaction introducing errors before the nominal limit.

### 2.2 Background, async and remote agents

A common six-step delegation model is now verifiable across five vendors' documentation:

1. Trigger from a chat, issue or PR surface — **not** an IDE editing session
2. Ephemeral vendor-owned VM or container
3. **Repo cloned from the remote, not local disk** — unpushed local work is invisible to the agent
4. Declarative in-repo environment config
5. Output as branch + diff; PR creation is a distinct step
6. **Network egress is the primary security control** — restricted or allowlisted by default in every case

**Checkpoint placement is the axis that actually differentiates them.**

| Product | Human gate | Notable |
|---|---|---|
| **Google Jules** | **Mandatory plan approval before any file edit** — the only one | Submit button reads "Give me a plan" |
| **Claude Code (local `--bg`)** | Inherits directory permission mode; surfaces "Needs input" | Auto-moves into isolated worktrees; commits, pushes, opens draft PR |
| **Claude Code Routines** | **None during a run, by design** | Scope fixed beforehand: repo, branch prefix, connectors, network policy |
| **OpenAI Codex cloud** | No mandatory pre-execution gate | **Internet blocked by default during the agent phase** |
| **GitHub Copilot agent** | Structural — branch protections, rulesets | Only vendor publishing hard limits: 59-min cap, one repo, one branch |
| **Cursor Cloud Agents** | No documented in-workflow gate | Auto-review classifier applies to *local* agents as of 2026-06 |

**[VENDOR, against interest]** Two disclosures worth quoting directly, because both describe failure modes that harness designers usually discover the hard way:

- On silent failure: a green Routine status *"does not mean the task in your prompt succeeded."* Task-level failure requires opening the transcript.
- On guardrail strength, from Cursor's docs: run modes are *"best-effort guardrails rather than a hard security boundary."*

### 2.3 What actually merges — and why the obvious reading is wrong

**[MEASURED, INDEPENDENT]** PR Arena (2026-07-28), an open-source tracker:

| Agent | Total PRs | Merged | Rate |
|---|---|---|---|
| OpenAI Codex | 5,860,457 | 5,095,320 | 86.9% |
| GitHub Copilot | 2,059,986 | 1,489,079 | 72.3% |
| Google Jules | 319,563 | 198,430 | 62.1% |
| Cursor | 708,097 | 430,431 | 60.8% |
| Devin | 208,086 | 124,147 | 59.7% |

**This is not a capability ranking, and reading it as one is a statistical error.**

**[MEASURED, INDEPENDENT]** Yu et al., arXiv:2606.22711 (2026-06-21) show the pooled comparison is *"a textbook Simpson's Paradox"* — Codex alone is 64.9% of the data. Controlling for repository selection and PR structure:

- Copilot's apparent **+41.2pp advantage collapses to +4.8pp (p=0.59)**
- Devin's **+33.5pp collapses to +1.6pp (p=0.73)**

The authors recommend abandoning unstratified agent-pooled statistics entirely.

**[MEASURED, INDEPENDENT]** Pinna, Gong, Williams, Sarro (MSR 2026, 7,156 PRs) confirm **task type dominates agent identity**: chore 84.0% acceptance versus performance 55.4% — a 29-point spread, wider than any gap between agents. Only **6 of 64** task-stratified comparisons survived Bonferroni correction.

**[MEASURED, INDEPENDENT]** Alam, Mondal, Roy (MSR 2026, 8,106 fix PRs): of unmerged PRs, **validation failures (33.4%) dominate infrastructure failures (5.2%)**, and roughly a third of failures are workflow or redundancy problems rather than capability problems.

### 2.4 The unattended / supervised boundary

**[DESCRIBES, INDEPENDENT]** The pattern is consistent across practitioners: **unattended work is disposable or mechanically verifiable; supervised work is code that must be understood and maintained.**

Armin Ronacher (Sentry), 2026-06-23, is the sharpest statement of the boundary. Unattended: code porting, performance exploration, security scanning, research, POCs "without longevity requirements." Supervised: anything he must be able to explain unaided — *"I want to understand the code I ship."*

His reported failure mode is specific and worth recording, because it is a claim about *compounding*, not about one-shot quality: loop output is *"defensive, too complex, too local"* in its reasoning, duplicating code and inventing bad abstractions rather than establishing invariants — and **each loop iteration adds another small defense**.

**[MEASURED, VENDOR, against interest]** Anthropic's own "collaboration paradox": developers use AI in roughly **60% of their work** while reporting they can **fully delegate only 0–20% of tasks**. Delegation goes to work that is cheap to sniff-check.

This aligns with the measured acceptance gradient in §2.3 — chores and docs at 82–84%, features and performance at 55–66%.

### 2.5 Published autonomy frameworks

**[DESCRIBES, INDEPENDENT]** **Addy Osmani, "Agentic Autonomy Levels"** (2026-07-02): six levels from Assist (L0) through Supervised Action, Scoped Task Delegation (named as the "typical center of gravity"), Goal-Driven Autonomy, Parallel Delegation, to Managed-by-Exception Orchestration (L5).

The governing criterion is the useful part:

> "The autonomy level should follow the verification process, not the task name."

Three gating questions: how quickly will problems be detected, how cleanly can the change be undone, and what proof confirms success. If the answers are *slow, difficult, summary-dependent*, autonomy is set too high.

His four named anti-patterns are unusually precise about how autonomy fails in practice: autonomy as status badge; **permission laundering through approval fatigue**; **summary substitution replacing verification**; and *"fleet cosplay"* — dozens of agents with manual orchestration.

**[DESCRIBES, INDEPENDENT]** **Simon Willison, "Designing agentic loops"** (2025-09-30) is a fit test rather than a taxonomy. Use loops where success criteria are clear and the solution requires trial and error — the trigger thought being *"I'm going to have to try a lot of variations here."* Good fits: debugging via test runs, performance optimisation, dependency upgrades validated by the suite. His containment advice pairs default-approval execution with sandboxes, scoped credentials, and spend caps. Key claim: strong automated test suites *"massively amplify"* agent value.

**[DESCRIBES, INDEPENDENT]** **Birgitta Böckeler, "Harness engineering for coding agent users"** (martinfowler.com, 2026-04-02) is the most structurally useful frame available. Two mechanism types and two execution modes:

|  | **Computational** (deterministic) | **Inferential** (semantic) |
|---|---|---|
| **Guides** (feedforward) | Type systems, linters, ArchUnit | Instruction files, plans |
| **Sensors** (feedback) | Tests, coverage, fitness functions | Review agents, LLM judges |

Computational checks run in milliseconds and are reliable; inferential ones are slower and probabilistic. She distributes checkpoints by cost: fast computational checks pre-commit, expensive controls (mutation testing) post-integration, drift detection continuously outside the change cycle.

Her verdict on the hardest category is the one to carry: **behaviour and functional correctness** is *"currently the most challenging"*, relying on AI-generated tests and manual testing, and current approaches are *"insufficient for reducing supervision."*

Her stance on the goal of a harness:

> "A good harness should not aim to fully eliminate human input, but direct it where most important."

**[DESCRIBES, INDEPENDENT]** **Kief Morris** (martinfowler.com, 2026-03-04) offers a complementary three-position taxonomy — humans **out of** the loop (set goals only), **in** the loop (inspect outputs directly, which he names as the bottleneck), and **on** the loop (engineer the harness: specs, quality checks, workflows).

**[INDEPENDENT]** **Martin Fowler** ("AgenticProgramming", 2026-05-21) defines agentic programming as *"humans oversee LLM agents who generate the code"*, distinguishing it from vibe coding by the fact that it is *"concerned with the code, often giving it detailed review."* He explicitly declines to offer an autonomy taxonomy.

### 2.6 Single-agent versus multi-agent: how the debate resolved

The two founding positions landed a day apart in June 2025 and were widely read as opposed.

**[VENDOR]** Cognition's **"Don't Build Multi-Agents"** (2025-06-12): share full agent traces, not individual messages; *"actions carry implicit decisions, and conflicting decisions carry bad results."* Recommendation: single-threaded linear agents, with parallelism confined to information gathering.

**[MEASURED, VENDOR]** Anthropic's **multi-agent research system** (2025-06-13): orchestrator-worker beat single-agent Opus 4 by **90.2%** on their internal research eval. Token economics: agents use ~4× chat tokens, **multi-agent ~15×**; on BrowseComp, token usage alone explained **80% of variance**.

**They were less contradictory than the framing suggested.** Anthropic's own post scoped multi-agent *away* from tasks needing shared context and real-time coordination — explicitly including "most coding tasks." Its win was on breadth-first research, which Cognition never disputed.

**[VENDOR]** Cognition then revised its own position ten months later ("Multi-Agents: What's Actually Working", 2026-04-22):

> "Multi-agent systems work best today when writes stay single-threaded and the additional agents contribute intelligence rather than actions."

Their endorsed pattern is instructive: a **separate review agent that works better when agents do *not* share initial context** — shorter context avoids rot and enables deeper analysis. **[MEASURED, VENDOR-internal]** They report it catching an average of 2 bugs per PR, ~58% classified severe.

Still failing, per the same post: asymmetric smart-friend setups, because weak models cannot recognise their own limits — *"knowing when to escalate, knowing what to ask."* And cross-agent communication *"requires explicit training"*; models do not naturally route messages between siblings.

**The converged architecture** across every vendor: one agent owns full context and spawns ephemeral subagents that each run in a fresh window and return a single distilled summary. **[VENDOR, confirmed 3-0]** The cost asymmetry is what makes it work — a subagent may burn tens of thousands of tokens exploring and return 1,000–2,000 tokens, keeping search context out of the lead window. (That figure is an illustrative vendor estimate hedged with "often", not telemetry.)

**Documented failure modes**, now encoded in vendor guidance: teammates do not inherit the lead's conversation history; agent teams do not isolate teammates in worktrees, so two editing the same file overwrite each other; three focused teammates often outperform five scattered ones; and for sequential tasks, same-file edits, or dependency-heavy work, a single session is more effective.

### 2.7 Sandboxing: autonomy is bought by relocating the checkpoint

**[VENDOR, confirmed 3-0]** This is the clearest statement in any vendor documentation of what a sandbox is *for*. Anthropic's permission-modes table heads a column **"What replaces the prompt"** — the answer being the sandbox boundary itself, in auto-allow mode. Autonomy is purchased by moving approval from per-command to up-front policy.

**[MEASURED, VENDOR-flagged]** And that boundary leaks by **write-then-trust**, not process escape. Pillar Security's July 2026 series:

> "In almost every case, the agent did not need to break the sandbox directly. It only had to write something that a trusted component outside the sandbox would later run, load, scan, or treat as safe."

> "If an agent gets to write the future inputs of systems, it was never sandboxed in the first place."

Enumerated write-surfaces: workspace hook config, VS Code task config, venv interpreter files executed during interpreter discovery, and git metadata. Two named instances:

- **Cursor CVE-2026-48124** (CVSS 8.5, patched 3.0.0, published 2026-05-21) — Cursor Desktop executed workspace-defined hook commands from `.claude/settings.local.json` without dedicated approval, so an agent-created file ran local commands at end-of-turn.
- **Codex CLI allowlist bypass** (CVSS 8.6, patched v0.95.0, disclosed 2026-07-20) — `git show` sat on the default safe-command allowlist, but `git show --output=./.git/config --format='[diff]…'` writes an attacker-controlled section into `.git/config` that executes on the next (also allowlisted) `git diff`.

*Caveats:* Pillar is a commercial AI-security vendor publishing a marketing-adjacent series — though the findings are CVE-backed, vendor-patched and bounty-paid, and Google pushed back on two of them. "Predominantly" rather than "always": at least two findings were arguably direct escapes. And the remediation was **argument-aware policy**, not abandoning allowlists — OpenAI kept the allowlist and hardened it. The class was not closed by one patch: v0.128.0 separately had to stop auto-approving `git -C …`.

**[VENDOR, against interest]** Documented permissive defaults, which are design decisions rather than CVEs:

- *"Sandboxing reduces risk but is not a complete isolation boundary."*
- Read access defaults to the entire computer. Sandboxed commands **can read `~/.aws/credentials` and `~/.ssh/`**, and *"there is no built-in credential deny list"* — protection requires operator-authored entries.
- The egress proxy allowlists on **client-supplied hostname without inspecting TLS**, so code inside the sandbox *"can potentially use domain fronting or similar techniques to reach hosts outside the allowlist."*
- Weakening vectors are documented explicitly: allowing `/var/run/docker.sock` *"effectively grants access to the host system"*; AppleEvents *"removes code-execution isolation."*

---

## 3. Review: the binding constraint

### 3.1 The volume shock

**[MEASURED, VENDOR self-report]** Meta's RADAR paper (arXiv:2605.30208, 33 authors, 2026-05-28):

- Significant lines of code per human-landed diff: **+105.9% year over year**
- Diffs per developer per month: **+51%**, with **80%+ attributed to agentic AI**
- *"The share of diffs receiving timely review has declined, exposing a widening gap between code supply and reviewer bandwidth"* — with "thousands of pending diff reviews" in some large groups

**Read this as evidence about code supply, not productivity.** These figures appear in the paper's motivation section, not its results. No attribution methodology or error bars are given for the 80%+ figure; "significant lines of code" is undefined. The review-decline side is stated directionally with no published magnitude.

### 3.2 The production answer is risk stratification, not more reviewers

**[MEASURED, VENDOR]** RADAR is an 8-stage funnel: authorship and source classification → eligibility gates → static heuristics → ML Diff Risk Score → LLM-based review → deterministic validation → land with configurable override delay. **535K+ diffs reviewed, 331K+ landed**, peaking at 25K diffs/day.

**Cite the architecture and the scale. Do not cite the efficacy figures** — the revert-rate, incident-rate and wall-time claims failed verification 0-3 (§7). The paper's own "reduces median time to close by over 330%" is a mathematically incoherent framing of a reduction.

Bounds: the title is "Automating **Low-Risk** Code Review"; most eligible volume is bot, codemod or agent-authored, and risky diffs still go to humans. Preconditions are Meta-specific — monorepo, standardised tooling, high test and rollout automation.

**[MEASURED, VENDOR but unusually numeric]** Cloudflare's internal stack (2026-04-20) independently corroborates the shape at a different scale: **3,683 active internal users** (93% of R&D), merge requests **~5,600/week baseline rising to 10,952 in a peak week**, and an AI Code Reviewer at **100% coverage** across repos on the standard CI pipeline — classifying MRs into **trivial / lite / full** risk tiers and routing to specialised reviewers (code quality, security, compliance, docs, performance, release impact).

Note the shape carefully: **the parallelism is in the reviewers, not the authors.**

### 3.3 The human problem is trust calibration, not diff reading

**[DESCRIBES, INDEPENDENT-ish]** JetBrains participatory design study (Heander, Sergeyuk, Zakharov, Söderberg, Mukhortov; arXiv:2606.01969, 2026-06-01; Discover N=17 practitioners, Develop n=7, validation N=43):

> "Reviewing LLM-generated multi-file changes is a trust-calibration problem rather than a diffing problem."

The mechanism: *"reviewers cannot allocate attention proportionate to segment-level risk because the agent provides no signal about its own confidence or reasoning behind its implementation choices."*

Confidence is medium — unrefereed preprint, qualitative self-report, prototype evaluated by video, and JetBrains sells IDE review tooling. The strict binary is the authors' framing; the same paper reports diff volume and cognitive load as real burdens, positioned as downstream of missing risk signals rather than absent.

**[DESCRIBES, INDEPENDENT]** Osmani's complementary framing of *why* review changed: with a human author the rationale exists and can be asked for; with an agent, the reviewer must *"reconstruct a rationale that never made it into the diff."*

### 3.4 The filtering tax, quantified

**[MEASURED, INDEPENDENT]** Zhong, Noei, Zou, Adams (Queen's University), arXiv:2603.15911 — **278,790 code review conversations across 300 open-source GitHub projects**, data window 2022 to November 2025, 16 AI review bots:

- AI suggestions adopted at **16.6%** versus **56.5%** for human reviewers
- AI comments far more verbose: 29.6 versus 4.1 tokens per line
- Human reviewers exchange **11.8% more rounds** on AI-generated code

Breakdown of *unadopted* AI suggestions (383-sample labelling, Cohen's κ = 0.76):

| Reason | Share |
|---|---|
| Incorrect — wrong or breaks the code | **28.7%** |
| Alternative fix chosen | 24.0% |
| Not needed | 14.1% |
| Claimed fixed, no commit | 11.0% |
| Preference | 10.2% |
| Deferred | 8.1% |

**Three precision guardrails.** Do not read 16.6% versus 56.5% as "AI review is 3.4× worse" — base rates differ because bots post far more comments including nitpicks. Do not collapse "alternative fix" into false signal; that is a *true* signal the developer chose to act on differently. Only the 28.7% incorrect bucket is genuine noise. And the 11.8% figure is observational and correlational — confounds include PR size, churn, task type and author seniority.

### 3.5 The single best measured dataset

**[MEASURED, VENDOR-employed author, but exceptionally transparent]** Stephen Toub, **"Ten Months with Copilot Coding Agent in dotnet/runtime"** (2026-03-23), covering 2025-05-19 to 2026-03-22:

- **878 agent PRs; 535 merged (67.9%)**; ~95,000 lines added across merged PRs
- Baselines: human Microsoft-team PRs **87.1%**, external community PRs **79.7%**
- Success by task type: removal/cleanup **84.7%**, testing 75.6%, refactoring 69.7%, bug fixes 69.4%, docs 68.1%, features 64.5%, performance **54.5%**

The finding that matters most for anyone designing a review gate:

- **Direct human code commits occurred in 52.3% of merged agent PRs**, versus **10.3%** for typical human-authored PRs
- **16.5 human review comments per merged agent PR** on average

This is a collaborative repair workflow, not merge-on-green. And the intervention that moved the needle was **preparation, not model capability**: adding a `copilot-instructions.md` took success from ~38–42% to ~69–71%. Of unmerged PRs, ~44% were auto-expired stale drafts and only ~16% were genuinely flawed approaches.

Toub's conclusion: strong on well-defined mechanical work, weak on architectural judgment.

### 3.6 Review capacity as a measured bottleneck

**[MEASURED, VENDOR analytics]** Faros AI, "AI Engineering Report 2026" (2026-04-12) — two years of telemetry across **22,000 developers and 4,000+ teams**, comparing each organisation's own lowest- and highest-AI-adoption periods. Explicitly not a survey.

| Metric | Change |
|---|---|
| AI code acceptance rate | 20% → 60% |
| Epics completed per developer | +66.2% |
| PRs merged per developer | +16.2% |
| **Median PR review time** | **+441.5%** |
| Median time to first PR review | +156.6% |
| **PRs merged without review** | **+31.3%** |
| Code churn | +861% |
| Bugs per developer | +54% |
| Incidents-to-PR ratio | +242.7% |

Faros sells engineering analytics — flag the interest. But the design is quasi-experimental **within-org before/after plus low- versus high-adoption comparison inside the same organisations**, which is stronger than cross-sectional and much stronger than self-report.

⚠️ **Denominator switching.** Faros mixes per-developer, per-PR and ratio normalisations across its takeaways. "+54% bugs" (per developer) and "+28% bugs" (per PR) are the same phenomenon; since PR volume rose, the per-developer framing flatters the alarm. Read every Faros figure with its denominator attached.

### 3.7 The decisive result: the bottleneck is queueing, not reviewing

**[MEASURED, VENDOR]** LinearB's *2026 Software Engineering Benchmarks Report* (~2026-01-16) is the largest PR-level telemetry set available: **8.1M+ pull requests, 4,813 teams, 163,820 contributors, 42 countries**, aggregated at p75.

| Metric | Unassisted | AI-assisted |
|---|---|---|
| Merge rate within 30 days | 84.5% | **32.7%** |
| **PR pickup time** (idle before review starts) | ~201 min | **~1,050 min (5.3×)** |
| **Review duration once started** | 252 min | **194 min (faster)** |
| PR size | 157 LOC | 400+ LOC (2.6×) |
| Refactoring share | 37% | negligible |

**This split is the single most analytically useful result in the entire body of evidence. AI PRs wait roughly five times longer to be picked up, but are reviewed *faster* once someone starts. The constraint is queueing, not the act of reviewing.**

That reframes the problem: adding reviewer capacity or making review faster addresses the smaller half. What binds is *whether a human ever starts*.

Caveats: the 32.7% merge rate is confounded, because agentic tools generate speculative and throwaway PRs by design and LinearB does not control for this; and LinearB sells PR routing and review acceleration, which is the fix for the problem it reports.

### 3.8 The most robust finding in this document: batch size doubled

**[MEASURED]** Four independent telemetry datasets, different platforms and different customer bases, agree:

| Source | Change in PR size | Basis |
|---|---|---|
| Swarmia (2026-06-16) | **+109%** median lines changed | 1,450+ orgs, Q1 2025 → Q1 2026 |
| DX (2026-06-17) | **+64%** (median 44 → 72 lines) | 400+ orgs, platform telemetry |
| Faros (2026-04-12) | **+51%** | 22,000 developers |
| LinearB (2026-01) | **2.6×** AI vs non-AI | 8.1M+ PRs |

Swarmia's figure holds at **+97.5%** when restricted to organisations with 1,000+ PRs in both periods, and growth accelerated ~2.5× from October 2025 as agent adoption went mainstream.

Set against §2.1's reviewability threshold and §3.7's queueing finding, the mechanism is legible: **larger batches are precisely what makes a PR expensive to pick up.** Swarmia's own framing is notably self-critical for a vendor — coding 3× faster translates to only 2–5% at organisational level absent systemic change.

### 3.9 The trend most relevant to anyone designing a review gate

**[MEASURED, vendor-supplied data, independent reporter]** Gergely Orosz (The Pragmatic Engineer, 2026-07-09), on data Cursor shared with him:

- **Skip-review adoption rose from ~10% to ~40% within one month**, correlated with the Opus 4.7 / GPT-5.5 releases
- Roughly **half of AI changes are accepted without manual review**
- Median Cursor user generates ~700 lines/week; the top 1% generate 30–40K lines/week

Set against §3.5's finding that merged agent PRs required human commits *more than five times as often* as human-authored ones, this is the sharpest tension in the entire corpus: the intervention rate that makes agent PRs work is rising in necessity while the review rate is falling in practice.

---

## 4. Testing and verification: the hardest problem

### 4.1 Agents systematically over-report completion

**[VENDOR, against interest, confirmed 3-0]** Anthropic's diagnosis is unusually specific:

> "Absent explicit prompting, Claude tended to make code changes, and even do testing with unit tests or curl commands against a development server, but would fail to recognize that the feature didn't work end-to-end."

And on multi-session work: *"a later agent instance would often look around, see that progress had been made, and declare the job done."*

The prescribed remedy is to force self-verification against tools that cannot lie — browser automation driving the real application — plus a basic end-to-end run before beginning any new feature. The harness rule: *"Self-verify all features. Only mark features as 'passing' after careful testing."*

**[MEASURED, INDEPENDENT]** Independently corroborated:

- arXiv:2606.28430, **"Building to the Test: Coding Agents Deliver What You Check, Not What You Requested"** — near-perfect benchmark scores alongside mechanical audits finding deliverables incomplete or absent
- arXiv:2602.00409 / MSR 2026 (**1.2M commits, 2,168 repos**) — agent-generated tests are frequently **over-mocked**, going green without exercising real behaviour
- Practitioner benchmarks report agents claiming 45/45 passing when only 26/45 passed hidden tests, never expressing uncertainty

### 4.2 The verification ceiling

**[INDEPENDENT]** arXiv:2606.26300, **"The Verification Horizon"**, argues predefined test suites cannot cover open-ended specifications. Forced end-to-end verification **bounds** the over-reporting problem; it does not solve it.

Böckeler reaches the same place from practice (§2.5): functional correctness is the harness category where current approaches are *"insufficient for reducing supervision."*

The question neither has answered, put most directly by **Simon Willison** in response to StrongDM's stated policy of no human code review:

> How do you prove software works when both the code *and* the tests are agent-generated?

**[DESCRIBES]** One data point on what happens without an answer: Dex Horthy (HumanLayer) ran a fully automated code factory for ~4 months during which no human read the code; the result was accumulated comprehension debt requiring painstaking manual debugging to localise failures.

### 4.3 The active frontier: closing the loop

**[MEASURED, VENDOR-affiliated]** "SWE-Review" (Huawei Noah's Ark-affiliated, arXiv:2607.06065, 2026-07-07):

> "Coding agents increasingly generate pull requests for real-world software issues, yet one-shot PR generation remains open-loop: the PR is proposed without systematic review, diagnosis, or revision."

Agentic review that gathers its own context outperformed single-turn fixed-context review on both decision accuracy and post-revision resolve rate — **27.5% → 56.9%** through the loop, with the gap widening on harder patches.

**Scope limits that matter.** "Open-loop" describes SWE-bench-style one-shot generation, **not industry practice** — production workflows in 2026 do have review loops. Every reviewed PR in the study is machine-generated, so nothing transfers to review of human-written PRs. The authors propose the framework, the benchmark, *and* the baseline they beat; no independent replication exists. And an adjacent counter-current: the "Agentless" line found simple fixed pipelines could beat agentic repo exploration for patch generation.

---

## 5. Outcome evidence, and the measurement crisis

### 5.1 The correction that invalidates the two most-quoted numbers

**[MEASURED, INDEPENDENT — the only clearly disinterested source in this document]** METR's July 2025 randomised controlled trial (arXiv:2507.09089) remains the only controlled measurement of AI effect on experienced developers: 16 maintainers, 246 real tasks, repositories averaging 22k+ stars and ~5 years of personal familiarity, using early-2025 tooling.

> "Surprisingly, we find that allowing AI actually increases completion time by 19% — AI tooling slowed developers down." (CI +2% to +39%)

METR is a nonprofit with no coding tool to sell, and the result cut against expert priors — ML forecasters had predicted a 38% speedup.

**The durable finding is the perception gap.** Developers forecast a 24% speedup; after finishing, they still believed they had been sped up 20% — against a measured 19% slowdown. Roughly 39 points of miscalibration, in the same direction before and after. (That subtraction spans different baselines and is METR's own presentation rather than a single well-defined statistic.) Notably, DX — a vendor whose product *is* developer self-report telemetry, and therefore maximally interested in the opposite conclusion — published agreement that self-report needs external verification.

**But the headline is superseded as a statement about current tooling.** METR, 2026-02-24:

> "Based on conversations with study participants, we believe it is likely that developers are more sped up from AI tools now — in early 2026 — compared to our estimates from early 2025."

Immediately qualified: *"because of the selection effects in our experiment, our data is only very weak evidence for the size of this increase."* METR **abandoned the replication design**, because *"we have observed a significant increase in developers choosing not to participate in the study because they do not wish to work without AI."* 30–50% declined to submit tasks they did not want to do without AI.

**Two framing rules follow, and both are commonly broken:**

1. Citing "19% slowdown" as current is now a factual error. It describes early-2025 tooling.
2. Compressing the 2026 update into "METR says AI helps now" is equally wrong. The update is *relative to a 19% slowdown baseline*, and METR asserts **no net-positive measured effect**.

> ⚠️ **Sign-error trap, actively circulating.** METR's 2026 follow-up (N=57 developers, 143 repos, 800+ tasks) reports **−18% for the returning cohort (CI −38% to +9%)** and **−4% for newly recruited developers (CI −15% to +9%)**. In METR's convention **positive means faster**, so −18% is *still an 18% slowdown*, not an 18% speedup. Multiple 2026 secondary sources report this as METR reversing itself; Rob Bowley flagged the error explicitly (2026-04-04). Both intervals cross zero, so the honest reading is *slowdown-to-neutral with wide uncertainty*.

### 5.2 The crisis itself

**The field's best measurement instrument has broken.** You can no longer construct a no-AI control arm from developers who refuse to work without AI. METR additionally reports that elapsed-time measurement became unreliable for developers running multiple agents concurrently — itself a data point about execution practice.

Simultaneously, the one RCT that does exist demonstrates self-report is off by tens of points, which undermines the survey and telemetry evidence that would otherwise fill the gap.

**For mid-2026 there is no trustworthy controlled estimate of AI effect size on developer throughput, in either direction. The honest position is uncertainty, not a number.** This is the single most consequential finding in this document, and it should temper every figure in §3 and §5.

### 5.3 Code quality signals

**[MEASURED, VENDOR]** GitClear's "Maintainability Gap" (January 2026, 623M analysed changes 2023–2026):

- Duplicated 5+ line blocks: **40.3 → 73.0 per million changed lines (+81%)**, highest on record
- Copy/paste: 9.4% → 15.7%
- Moved/refactored lines: 21% → 3.8%
- Error-masking constructs: +47%; two-week churn: +15%

Their thesis is explicitly **debt, not throughput** — they claim heavy AI users out-produce non-users by 4–10×, but that *"the throughput is real, but so is the debt it accrues."*

**Nine caveats, and they are substantial:**

1. Vendor-owned, non-reproducible proprietary metric; not peer-reviewed; no external replication
2. **No per-commit AI attribution** — trends correlate with calendar time, never identifying which commits were AI-authored. No control group.
3. Opt-in unbalanced panel, ~⅔ private corporations, composition shift over the window is a live alternative explanation
4. **Denominator confound** — the unit is per million *changed* lines, and refactored lines collapsing as a share of changed lines can mechanically raise duplication density with no behaviour change
5. Headline instability across their own series — the 2025 report claimed an 8-fold duplication increase during 2024, irreconcilable with 1.81× over 2023–2026 under one stable metric
6. 2026 is partial-year
7. 2023 is not a pre-AI baseline (Copilot GA was June 2022), so "vs pre-AI" framing is unsupported
8. **All eight signals are git-diff-derived** — no bug tracker, incident log, or static-analysis data
9. Copy/paste is measured within a single commit only, which undercounts

Two further signals from the same dataset bear directly on the "codebase nobody understands" concern: **cross-file function calls (reuse) fell 35%** (343 → 223 per 1,000 lines), and **long-term legacy maintenance fell from 1.7% to 0.46%** of changes. In 2024, introduction of duplicated code exceeded refactoring activity for the first time in the series.

**GitClear's best work is its least-cited, and it cuts against their own headline.** A January 2026 companion study used direct API integrations with Cursor, Copilot and Claude Code across **2,172 developer-weeks**. Heavy AI users do out-produce non-users by 4–10× — **but most of that gap pre-dated AI adoption.** Measured against each developer's own prior baseline, heavy AI users gained roughly **25%**.

That is the best selection-bias correction in the corpus, and it should temper every "AI users are N× more productive" claim in circulation — including GitClear's own.

### 5.4 Developer sentiment

**[MEASURED, self-report, VENDOR-adjacent]** Stack Overflow 2025 (n=49,009, fielded 2025-05-29 to 06-23):

- Usage/intent **84%**, up from 76% — while favorability fell to **60%**, from 70%+ in 2023–24
- **46% actively distrust** AI accuracy versus 33% who trust; only **3% "highly trust"**
- Top frustration: **66%** cite "AI solutions that are almost right, but not quite"; **45.2%** say debugging AI-generated code is more time-consuming

The erosion is compositionally attributable to *users*, not abstainers — non-users shrank 24% → 16.2% while current users rose 62% → 78.5%, so composition alone would have pushed aggregate favorability *up*.

Caveats: non-probability self-selected sample recruited through Stack Overflow's own surfaces; n fell from 65k to 49k year over year; and Stack Overflow's core business is directly cannibalised by the tools it surveys. The 2026 edition is in field with results pending, so 2025 remains current.

### 5.5 Organisational evidence

**[MEASURED, survey]** **DORA 2025** — *State of AI-assisted Software Development*, published 2025-09-23. **N = 4,867**, fielded 2025-06-13 to 07-21, plus 78 interviews of ~90 minutes each. Respondents were **randomly assigned to one of four survey flows**, so not every respondent answered every item. Analysis: factor analysis → structural equation model with DAG-based confounder adjustment → Bayesian models, reported at **89% credible intervals**.

> **There is no 2026 DORA annual report.** The publications index runs 2014–2025; DORA publishes in September/October, so a 2026 edition would be due around now. Anything presented as "DORA 2026" is either a misattribution or the separate *ROI of AI-assisted Software Development* companion guide (v2026.01), which is a modelled J-curve analysis rather than the annual survey.

**The single most important methodological fact: every outcome in DORA 2025 is survey self-report** — including throughput and instability. "Throughput" is a self-reported composite of lead time, deployment frequency and recovery time. DORA is not telemetry. Given METR's ~39-point perception gap, this discounts the productivity items substantially, and DORA is candid about the limitation.

Adoption: **90%** use AI at work (up from 76% in 2024); **median 2 hours** of daily AI interaction; **median 16 months** of experience. Only **7%** always turn to AI when facing a problem. Trust: 24% report high confidence, **30% report little or none**.

**The throughput finding reversed, and this is widely misreported.** In 2024 DORA found every 25% increase in AI adoption associated with a **1.5% reduction in throughput** and a **7.2% increase in instability**. In 2025 **the throughput sign flipped positive** — but instability did not, and it remains the *second-largest* effect in the whole model.

> ⚠️ The 7.2% instability figure is a **2024** number. The 2025 report publishes no "% per 25% adoption" figure at all, yet the 7.2% is widely cited in 2026 as though it were the 2025 result.

DORA also **tested and rejected the "instability is an acceptable trade" defence**: they checked whether AI adoption moderates the harm instability does to other outcomes — whether fast fix-forward makes it matter less — and found no such moderating effect.

**The amplifier thesis** — AI magnifies existing organisational strengths and dysfunctions alike — is DORA's central claim. **Its evidentiary status is interpretation, not a directly tested hypothesis**, resting on moderation analyses plus the qualitative corpus. And it now has a live empirical challenge: **[MEASURED, VENDOR]** Faros AI's within-org telemetry (§3.6) reports that high-performing organisations experience *the same* downstream deterioration as everyone else. Two measurement modalities disagreeing on the core organisational claim is the most consequential open question in this literature.

**The DORA AI Capabilities Model** names seven capabilities: clear and communicated AI stance, healthy data ecosystems, AI-accessible internal data, strong version control practices, working in small batches, user-centric focus, and quality internal platforms. **It publishes direction only — no effect sizes, no coefficients, no intervals for any moderation term.** The one sharp, falsifiable claim is **user-centric focus**, the only capability with a reported sign flip: low user-centricity is associated with AI *decreasing* team performance.

**DORA's own admission is the most useful thing in the report.** In the instability chapter it raises the possibility that its own capabilities and measurements *"no longer suffice. They must evolve for the AI era, be replaced, or be supplemented."* Two further DORA framings are directly load-bearing:

- **Friction relocates rather than disappearing** — moving from manual grind to deciding and verifying: prompt iteration, result vetting, and assessing code that closely resembles correct code.
- **The value-stream chapter warns explicitly against using AI to generate more code when review is the constraint**, arguing the win is applying AI to the review process itself, not to output volume.

DORA cites METR directly and calls for more evidence-based work on AI's true impact.

**[MEASURED, INDEPENDENT method disclosure]** **Google's migration paper** (Nikolov et al., arXiv:2501.06972, 2025-01-12) is the only "% AI-authored" figure anywhere with a *published definition* — per-character diff between the LLM-generated snapshot changelist and the version actually committed.

- Ads int32→int64 migration: **80% of code modifications in landed CLs were fully AI-authored**; total migration time reduced by an estimated 50%
- JUnit3→JUnit4: **5,359 files, >149,000 lines, in 3 months; ~87% of AI-generated code committed without change**

And the sentence that matters most:

> "The bottleneck in the process was the speed at which engineers could review the changes. We purposefully limited the number of changes we generate every week to avoid overwhelming reviewers."

The authors' own warning: percent-of-code-written-by-AI *"does not always capture all the value."*

**[MEASURED, INDEPENDENT method, largest N]** Google's 2026 follow-up (Tabachnyk et al., arXiv:2601.19964, 2026-01-27, accepted at LLM4Code '26 @ ICSE '26) is stronger than the widely-cited 2024 lab RCT. Online A/B experiments, **36,000 developers treatment versus 18,000 control**: changelist throughput per user-month **+17.5%, 95% CI [15.9%, 19.0%]** — a genuinely tight interval. Active coding time per changelist was **not** statistically significant once changelist size was accounted for. Their measured **fraction of code written by ML was 28.7%** as of March 2025.

> ⚠️ Do **not** cite Google's 2024 enterprise RCT (arXiv:2410.12944) as "Google proved 21% faster." The abstract's significance rests on an unadjusted t-test; the **adjusted 21% estimate has 95% CI [−0.51, +0.03], p = 0.086 — it crosses zero.** N=96, single ~3-hour lab task.

**Treat every "% of code written by AI" figure without a published definition as a corporate claim rather than a measurement.** Pichai's **75%** (reported from Google Cloud Next, 2026-04-22) could not be traced to a primary transcript and does not appear in Alphabet's Q2 2026 CEO blog post; it is almost certainly a character-volume metric of the same family as FCML. **The gap between 28.7% measured and 75% asserted is itself a finding about how these numbers travel.** Likewise Nadella's 20–30% (2025-04-29) and Meta's ~50%, which traces to a single named ex-employee now in a vendor-CEO role, corroborated by no Meta engineering blog, press release, or earnings disclosure.

### 5.6 Security regressions

**[MEASURED, VENDOR, longitudinal — bias largely self-cancelling]** Veracode's GenAI Code Security series is the most useful security evidence, because it repeats the same 80 curated tasks across model generations.

- 2025 report (October 2025), 100+ LLMs: **45% of tests introduced OWASP-relevant flaws.**
- Spring 2026 update (2026-03-24), 150+ models, identical tasks: **syntax correctness above 95%, security pass rate stuck at ~55%** — essentially unchanged over two years.

By vulnerability class the variance is extreme: SQL injection 82% pass and insecure crypto 86%, versus **XSS 15% and log injection 13%**. By language: Python 62%, C# 58%, JavaScript 57%, **Java 29%**.

**The flat line is the finding.** Two years and 150+ model generations of capability improvement did not transfer to security outcomes.

⚠️ **Veracode's own caveat, routinely dropped:** this measures code generated with **no security guidance in the prompt**. It characterises naive default behaviour, not a team with security prompting and linting in the loop. It is frequently misquoted as "45% of AI code in production is vulnerable." It is not that.

**[MEASURED, INDEPENDENT]** Georgia Tech's "Vibe Security Radar" (Hanqing Zhao, SSLab, 2026-04-13) scanned **>43,000 advisories**, identifying the introducing commit via code history and flagging AI tool signatures: **74 confirmed AI-introduced vulnerabilities** (14 critical, 25 high), rising from 18 cases in late 2025 to **56 in Q1 2026**. Seventy-four is a small absolute number — **the signal is the slope and the attribution method, not the magnitude.** Zhao's monoculture argument is the durable part: millions of developers on the same models means one antipattern appears across unrelated projects, turning a single bug pattern into a cross-repo exploit class.

**[MEASURED, INDEPENDENT]** The over-cited Stanford study (Perry et al., arXiv:2211.03622, CCS '23) should be handled carefully: **N=47** with a 14-person control arm, on a 2022-era model. Its durable contribution is not the vulnerability rates but the **confidence/competence inversion** — AI-assisted participants were *more* likely to believe their code was secure. Veracode's 2026 flat line corroborates that inversion at the model level.

### 5.7 People: onboarding, mid-level attrition, and the junior pipeline

**[MEASURED, INDEPENDENT]** The one rigorous study is Brynjolfsson, Chandar and Chen (Stanford Digital Economy Lab), *Canaries in the Coal Mine?* — using individual-level administrative payroll microdata from ADP. Headline: **~16% relative employment decline for workers aged 22–25 in the most AI-exposed occupations**, while employment for older workers in the same occupations stayed stable or grew. Adjustment runs through **headcount, not wages**, and declines concentrate where AI automates rather than augments.

Two cautions. **No software-developer-specific coefficient is extractable** — software development is the canonical high-exposure occupation, but do not attribute a developer-specific effect size to this paper. And credible pushback exists: Google economists attribute the decline to interest rates, others to a tech-sector overhiring correction.

**[DESCRIBES]** The mechanism account worth recording is Sreenivasa Reddy (Lead SWE, AT&T, LeadDev, 2026-07-06): team velocity +40%, but **three mid-level engineers quit within 6–8 weeks of each other**, with attrition concentrated at L4/L5 while juniors and seniors stayed. His thesis is that mid-level engineers absorb invisible AI-validation work that no metric compensates — so **the senior pipeline drains from the middle, not the bottom.** Single-team account: valuable as mechanism, not magnitude.

**A genuine evidence gap worth naming: no measured study exists of juniors' ability to debug AI-generated code.** The claim is near-universally asserted and, as far as this research could find, never measured.

### 5.8 The curl case — and the reversal almost nobody cites

The most-cited "AI broke open source" story has a published sequel that inverts it.

- **[PRIMARY]** Daniel Stenberg, *Death by a thousand slops* (2025-07-14): ~20% of 2025 bug-bounty submissions were AI slop; **valid-report rate fell to ~5%** from >15%.
- *The end of the curl bug-bounty* (2026-01-26): programme closed after seven years.
- **[PRIMARY] *High-Quality Chaos* (2026-04-22): after removing the bounty, the slop problem stopped being a problem.** Report volume doubled again, **confirmation rate returned to ~15–16%** — pre-AI levels — and nearly every security report now uses AI to some degree, at mostly high quality.

**The money, not the AI, was the slop attractor.** Any argument citing the July 2025 post without the April 2026 one is out of date, and the author has published the correction himself.

Project policy responses are nonetheless real and worth noting for their *shape*: Kubernetes (2026-06-26) requires disclosure and **closes PRs where the contributor cannot personally explain AI-generated changes**; Ghostty runs a vouch system for first-time contributors; LLVM **prohibits AI on Good First Issues** explicitly to protect the newcomer on-ramp; the Linux kernel permits AI but requires an `Assisted-by:` trailer and human-only DCO sign-off.

> ⚠️ **No credible survey measures reviewer rubber-stamping directly.** LinearB's "reviewed faster once picked up" is the only quantitative proxy, and it has an innocent alternative explanation — AI PRs are more uniform. Do not assert rubber-stamping as established.

**[DESCRIBES]** **Shopify's** stated review gate, via Farhan Thawar (VP Engineering), is worth recording verbatim because it is the clearest statement of where a large org has drawn the line:

> "Shopify is not yet at the place where we allow AI to check in code automatically into the repos. We still require a human PR reviewer."

With the constraint named explicitly: *"As AI generates code faster, review capacity becomes the constraint."* Reported productivity gain ~20%, self-described as "a conservative estimate" — Thawar's estimate, not a measurement. Reversion rates reportedly unchanged despite increased output. Their named guardrail against comprehension debt: engineers must understand systems **2–3 layers below** their work.

### 5.9 Boundary conditions: where assistance underperforms

**[MEASURED but observational, n=16]** METR published a "factors likely to contribute to slowdown" table naming five, of which three are structural: **high developer familiarity with the repository**, **large and complex repositories**, and **implicit repository context**. Their discussion:

> "AI capabilities may be comparatively lower in settings with very high quality standards, or with many implicit requirements (e.g. relating to documentation, testing coverage, or linting/formatting) that take humans substantial time to learn."

**Do not harden this.** METR's own language is hedged; no experimental arm varied maturity or familiarity, so these are correlational attributions within a 16-person sample.

**And do not invert it.** METR notes the results are *consistent with* greenfield or unfamiliar-codebase work seeing speedup, but the study provides no positive measurement of that. It is an untested complement, not a finding. DORA 2026's greenfield-versus-legacy split is the nearest supporting evidence, and it is modelled rather than measured.

**There is no verified evidence on seniority effects.** The Stack Overflow seniority cross-tab failed verification 1-2. Beyond METR's n=16 senior-maintainer population, this question is open.

---

## 6. Standards, tooling, and the spec-driven wave

### 6.1 Böckeler's ladder

**[INDEPENDENT]** Birgitta Böckeler's three-rung framing (martinfowler.com, 2025-10-15) has become the standard vocabulary:

1. **Spec-first** — write a good spec, drive the task; the spec may not outlive the feature. *Most common.*
2. **Spec-anchored** — the spec is maintained and the feature evolves through it. *Rare.*
3. **Spec-as-source** — humans edit only specs; code is compiled output. *Experimental (Tessl).*

Her verdict on the heavy toolkits is blunt, and names five problems: one-size-fits-all ceremony (Kiro turning a small bug into "4 user stories with 16 acceptance criteria"); review burden — *"I'd rather review code than all these markdown files"*; the **illusion of control**, where the agent *"ignored notes describing existing classes, just took them as new specification and generated them all over again"*; unclear separation of functional and technical concerns; and unclear audience.

Her critique of the premise invokes Model-Driven Development, which *"never took off for business applications"*, warning that spec-as-source risks combining *"the downsides of both MDD and LLMs: inflexibility and non-determinism."*

**[INDEPENDENT]** Thoughtworks Technology Radar (Vol 34, 2025-11-05) places spec-driven development at **Assess**, not Trial — noting workflows are "elaborate and opinionated," behave "very differently depending on task size and type," and raising the **"bitter lesson"** risk that handcrafting detailed rules for AI ultimately does not scale.

### 6.2 The waterfall argument, and why it is unresolved

**[INDEPENDENT]** The charge (Zaninotto, Marmelab, 2025-11-12): SDD reproduces waterfall's premise of removing developers from development via upfront planning, when development is fundamentally non-deterministic. Named shortcomings include "markdown madness," **double code review** (spec *and* code), and diminishing returns on large existing codebases.

**[INDEPENDENT]** The rebuttal (Marc Brooker, AWS, 2026-04-09), with the sharpest one-line formulation:

> "It's about pulling designs *up*, not *up-front*."

The argument: in SDD the specification is the thing being iterated on rather than the implementation; specs remain "complex, dynamically changing, internally conflicting, and invariably incomplete," and humans own that outer loop.

**Both sides converge on the same distinguishing variable** — what happens *after* the spec exists. Frozen spec plus handoff is waterfall; spec as the iterated artifact is not.

**Neither side offers outcome data, and this should be stated plainly.** There is **no published controlled experiment showing that spec-driven toolkits improve end-task success versus a lighter-weight agentic loop.** The two nearest rigorous results are adjacent rather than on-point: arXiv:2604.05278 measures context-grounding hooks added *within* the Spec Kit pipeline (+1.7pp on SWE-bench, +0.15 on a 1–5 LLM-judge composite), and SpecBench (arXiv:2605.30314) tests whether agents can *review* specs, not whether specs help implementation — best agent 44.4% accuracy. The nearest rigorous evidence of any kind, ETH Zurich on context files (§1.4), points the other way.

### 6.3 What the toolkits actually prescribe

**[VENDOR]** **GitHub Spec Kit** — `/speckit.constitution` → `/specify` → `/plan` → `/tasks` → `/implement`, with optional `/clarify`, `/analyze`, `/checklist`. A `constitution.md` holds non-negotiable principles persisting across features. 124,298 GitHub stars as of 2026-07-28. It has become a pluggable workflow host, shipping alternative processes that replace the core flow.

**[VENDOR]** **Amazon Kiro** — three phases with **approval gates**: Requirements (user stories with acceptance criteria in EARS format) → Design (architecture, sequence diagrams, data models) → Tasks (dependency graph, independent tasks run concurrently in "waves"). Optional steering files. A "Quick Spec" mode generates all three with no gates.

**[VENDOR]** **Tessl** — the most radical: the spec is the maintained artifact, code is regenerable output stamped `// GENERATED FROM SPEC - DO NOT EDIT`, one spec per code file, bidirectional sync, plus a registry of 10,000+ pre-built specs for open-source libraries. **No independent evaluation of Tessl exists.**

### 6.4 Agent Skills and progressive disclosure

**[VENDOR]** Three-tier loading: metadata (name + description) in the system prompt at startup → full `SKILL.md` when judged relevant → referenced files navigated as needed. Analogised to "a well-organized manual that starts with a table of contents."

**Adoption is the strongest signal in this document.** The open standard (released 2025-12-18, governed at github.com/agentskills) lists ~43 clients including **Claude Code, OpenAI Codex, GitHub Copilot, VS Code, Cursor, Gemini CLI, JetBrains Junie, Goose, Amp, Kiro, Trae, Tabnine, Databricks and Snowflake**. Every major coding-agent vendor including OpenAI and Google adopted a format Anthropic authored.

**But adoption is not efficacy.** No study shows progressive disclosure improves task success. The only quantified claim is token savings, and it comes from a vendor's own worked example. Böckeler's prediction (2026-02-05) is that skills will absorb slash commands and rules; as of July 2026 Claude Code still ships all three mechanisms.

### 6.5 MCP

**[PRIMARY]** Under Linux Foundation governance since 2025-12-09, when the **Agentic AI Foundation** formed anchored by three donated projects: **MCP** (Anthropic), **goose** (Block), and **AGENTS.md** (OpenAI). Platinum members include AWS, Anthropic, Block, Bloomberg, Cloudflare, Google, Microsoft and OpenAI. Two rival vendors donating to one foundation is meaningful evidence against single-vendor capture.

Scale: ~97M monthly SDK downloads, ~2,000 registry entries, >10,000 published servers at donation.

**[VENDOR, against interest]** The most interesting critique comes from Anthropic turning the progressive-disclosure argument against its own protocol's default ergonomics ("Code execution with MCP", 2025-11-04): agents connected to many tools "will need to process hundreds of thousands of tokens before reading a request." Their worked example reduces **150,000 tokens to 2,000** by exposing MCP servers as a filesystem of code APIs explored on demand.

Honest scope: adoption is strongest in developer tooling, **read-heavy integrations**, and single-user interactive workflows. Acknowledged roadmap gaps: no standardised audit trail, no tenant isolation model, no protocol-level rate limiting or cost attribution.

**Security:** tool poisoning — malicious instructions in tool metadata the agent reads and the user does not — is the headline class, now an OWASP community entry. Its distinguishing property versus classic prompt injection is **persistence**: a poisoned description ships in a package or remote server and fires on every invocation, every session, every user.

### 6.6 AGENTS.md versus CLAUDE.md — correcting a common error

**[PRIMARY]** AGENTS.md is read natively by Codex, Cursor, Copilot, Gemini CLI, Aider, Windsurf, Zed and Ona.

**Claude Code does not read AGENTS.md.** Its documentation says so verbatim: *"Claude Code reads `CLAUDE.md`, not `AGENTS.md`."* The recommended bridges are an `@AGENTS.md` import or a symlink. The widely repeated claim that Claude Code reads it as a fallback is **wrong**. (`/init` does ingest AGENTS.md at *generation* time under a flag, but not at load time.)

**The "60,000 open-source projects" figure needs three caveats:** it is a GitHub *code* search counting matching **files**, not distinct repositories, so monorepos with nested per-package files inflate it; the figure dates to December 2025 and has not been recounted; and researchers treat file presence as a weak proxy for real use — arXiv:2601.18341 deliberately *excluded* AGENTS.md from its 93 agent-detection heuristics because *"the presence of this file alone is insufficient to reliably identify the coding agent in use."*

---

## 7. Refuted claims — do not propagate

Fifteen claims failed 3-vote adversarial verification across the two harness passes. Several circulate widely enough that they are worth listing explicitly.

| Claim | Vote |
|---|---|
| AGENTS.md defines a nearest-file-wins precedence hierarchy over ancestors, with chat overriding files | 1-2 |
| AGENTS.md is designed as a verification-loop hook whose listed checks agents are expected to run | 0-3 |
| Anthropic frames context engineering as formally superseding prompt engineering | 0-3 |
| Anthropic's recommended long-running harness is specifically a two-agent initializer-plus-coder structure with `init.sh` | 0-3 |
| JSON is preferable to Markdown for feature lists because models are less likely to overwrite it | 0-3 |
| No validated end-to-end multi-file agent review workflow exists as of June 2026 | 0-3 |
| RADAR-reviewed diffs showed 1/3 the revert rate, 1/50 the incident rate, and 35% lower wall time | 0-3 |
| Adopted AI review suggestions measurably degrade complexity and code size versus human ones | 0-3 |
| METR's late-2025 follow-up "did not replicate at significance," superseding the 19% headline | 0-3 |
| A single Docker-socket flaw affected Codex, Cursor and Gemini CLI simultaneously | 0-3 |
| OpenAI's CVE-2025-59532 fix constitutes a vendor-endorsed general design rule for agent sandboxes | 0-3 |
| GitClear's is the "largest-N published telemetry series" on AI-era code quality | 0-3 |
| GitClear's refactoring-collapse series as an independent claim (internal 13% vs 21% inconsistency) | 0-3 |
| Claude Code's sandbox is enforced by Seatbelt/bubblewrap with WSL1 and native Windows unsupported | 1-2 |
| Seniority moderates trust — experienced developers report lowest "highly trust" rates | 1-2 |

Two consequences worth stating: the RADAR **efficacy** figures should never be cited (its architecture and scale are fine), and this document therefore has **no verified evidence on seniority effects** at all.

### Misattributions actively circulating

These are not refuted claims but *misrouted* ones — real figures attached to the wrong source. Several propagated through unattributed SEO content published by measurement vendors, which recycle each other's numbers.

| Circulating claim | Correction |
|---|---|
| "+9% bugs / +91% review time / +154% PR size — DORA" | **Faros AI** telemetry, not DORA |
| "DORA 2025: 7.2% more instability per 25% AI adoption" | A **2024** figure recapped in the 2025 report. 2025 publishes no such number. |
| "DORA: 46% distrust, 33% trust, 3% high trust" | **Stack Overflow 2025** figures. DORA's are 30% little/none, 24% high. |
| "METR 2026 found an 18% speedup, reversing itself" | **Sign error.** −18% in METR's convention is an 18% *slowdown*. |
| "Google's RCT proved 21% faster" | Adjusted 95% CI [−0.51, +0.03], p = 0.086 — crosses zero |
| "Pichai: 75% of Google's code is AI-written" | Untraceable to a primary transcript; measured FCML was **28.7%** (March 2025) |
| "45% of AI code in production is vulnerable" | Veracode measures code generated with **no security guidance in the prompt** |
| curl as proof AI broke open source | Stenberg published the reversal (2026-04-22): quality back to pre-AI levels |
| "Sonar: SonarQube users 44% less likely to have AI outages" | Vendor surveying its own customers about its own product. Unusable. |

**Additionally unverified, and excluded from the body above** — figures that circulate but could not be traced to a primary source: Cortex's "24% more incidents per PR"; the "8 parallel agents" Cursor cap; Osmani's "70% of planning decisions / 80% of execution" citation; the multi-agent review conformity claim; Spotify's "Honk"; "junior hiring down 40%"; the DORA "<10% of week-one agent users remain at week ten" retention figure; and the 2026 Microsoft/Uber AI-budget-rollback cluster, which traces only to aggregator sites. Note that even if the rollback cluster holds, it describes a **cost** retreat, not a **quality** retreat — a different argument from the one it is usually recruited for.

### A counter-position not retrieved

The New Stack published *"AI hasn't shifted the bottleneck from coding to code review"* (`thenewstack.io/ai-code-bottleneck-myth/`). The fetch returned only the site shell, so author, date and argument are unknown. **Read it before asserting consensus on §3.7.**

---

## 8. What survives scrutiny, and what is still open

### 8.1 The five claims that hold up

Ranked by evidential strength, not by how often they are repeated.

1. **Batch size roughly doubled in the year to mid-2026.** Four independent telemetry datasets, different platforms and customer bases (§3.8). The most solid claim in this document.
2. **Review is the constraint — and it is a queueing problem, not a reviewing problem.** LinearB's pickup-versus-duration split is decisive (§3.7), corroborated by Faros and by DORA's own account of friction relocating to verification.
3. **AI code security has flat-lined at ~55% pass while syntax correctness passed 95%** (§5.6). Within-vendor longitudinal, so commercial bias largely cancels.
4. **Self-report is a broken instrument for AI productivity** (§5.1). This discounts DORA's productivity items, Sonar's entire report, Jellyfish's entire report, and DX's AI-share number.
5. **Maintainability signals are degrading** — but single-sourced, unreplicated, methodology undisclosed (§5.3). Directionally corroborated by Faros churn and DORA instability; treat the specific percentages as single-sourced.

### 8.2 Open questions

1. **Is there any controlled 2026 estimate of AI effect on throughput?** METR abandoned the RCT because the no-AI control arm can no longer be recruited. What designs — difference-in-differences on natural adoption variation, task-level instrumentation, agent-session telemetry — could restore causal identification? Nobody has published one.

2. **Does repository context tooling actually improve outcomes?** ETH Zurich found context files reduce task success while raising cost >20%, in direct tension with near-universal adoption. Is the discrepancy about file quality, task type, benchmark artifact — or is the convention partly cargo cult? And does progressive disclosure escape the finding, given it changes exactly the always-on property being tested?

3. **What verifier design closes the gap when the agent writes both the code and its oracle?** Forced end-to-end verification demonstrably reduces over-reporting, but predefined suites cannot cover open-ended specifications, and agent-written tests are measurably over-mocked.

4. **Does the maintainability degradation translate into outcomes that matter** — defect rate, incident frequency, change failure rate — or does it remain a git-diff-shaped proxy? GitClear measures no outcome at all; DORA and enterprise telemetry would adjudicate.

5. **What are the seniority and task-type moderators** independently of METR's n=16 senior-maintainer sample? The greenfield complement to METR's boundary conditions is asserted nowhere and measured nowhere.

6. **Which write targets constitute a defensible minimum deny set** given the write-then-trust threat model — hook configs, git config, venv interpreters, task definitions, CI files? No source identifies one, and no team has published a checkpoint placement that survives the class.

7. **Does risk-stratified review automation generalise outside Meta-scale preconditions?** RADAR's efficacy figures were refuted and its assignment is non-random, so there is currently no trustworthy evidence on whether auto-landing agent-authored diffs is safe at any scale.

8. **Is the amplifier thesis right?** DORA's survey says AI magnifies existing organisational strengths and dysfunctions. Faros's within-org telemetry says high performers deteriorate like everyone else. Two measurement modalities disagreeing on the central organisational claim is the most consequential unresolved question in this literature.

9. **Does any proposed replacement metric actually predict better outcomes?** The measurement *problem* is well evidenced — DORA itself concedes its measures may need to be replaced or supplemented. The measurement *solution* is not: every proposal is either a vendor framework validated on that vendor's own customers, or an argument. The least conflicted voices offer the least data.

### 8.3 A structural caveat on the whole corpus

**Representative-sample data on *how* people run agents barely exists.** Nearly the entire execution-mechanics picture is vendor telemetry or named-individual anecdote, from a small number of highly-visible practitioners writing mostly about solo or small-team work. The two largest genuinely independent measured datasets — PR Arena and the MSR 2026 papers — both find that **task type explains far more variance than agent choice**, and that pooled cross-agent comparisons are confounded.

Roughly half the academic corpus is non-peer-reviewed preprints, several authored by the parties who built the system being evaluated.

---

## 9. Sources

### Primary research — measured, independent

| Source | Date | Topic |
|---|---|---|
| [METR — Early-2025 AI experienced OSS dev study](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) · [arXiv:2507.09089](https://arxiv.org/abs/2507.09089) | 2025-07-10 | RCT, 19% slowdown, perception gap |
| [METR — Changing our experiment design](https://metr.org/blog/2026-02-24-uplift-update/) | 2026-02-24 | Control-arm collapse |
| [arXiv:2602.11988 — Evaluating AGENTS.md (ETH Zurich)](https://arxiv.org/abs/2602.11988) | 2026-02-12 | Context files reduce success, +20% cost |
| [arXiv:2502.05167 — NoLiMa](https://arxiv.org/abs/2502.05167) | 2025-02 | Long-context recall degradation |
| [Chroma — Context Rot](https://research.trychroma.com/context-rot) | 2025-07-14 | 18-model degradation study |
| [arXiv:2603.15911 — Human-AI Synergy in Agentic Code Review](https://arxiv.org/abs/2603.15911) | 2026-03-16 | 278,790 conversations, adoption rates |
| [arXiv:2606.22711 — Beyond Simpson's Paradox](https://arxiv.org/abs/2606.22711) | 2026-06-21 | Confounders in agent PR stats |
| [arXiv:2501.06972 — Google code migrations](https://arxiv.org/abs/2501.06972) | 2025-01-12 | 80% AI-authored, reviewer bottleneck |
| [arXiv:2606.28430 — Building to the Test](https://arxiv.org/abs/2606.28430) | 2026-06 | Agents deliver what you check |
| [arXiv:2606.26300 — The Verification Horizon](https://arxiv.org/abs/2606.26300) | 2026-06 | Suites can't cover open specs |
| [arXiv:2606.01969 — Reviewing LLM multi-file changes (JetBrains)](https://arxiv.org/abs/2606.01969) | 2026-06-01 | Trust calibration |
| [arXiv:2605.30208 — RADAR (Meta)](https://arxiv.org/abs/2605.30208) | 2026-05-28 | Risk-stratified review funnel |
| [arXiv:2607.06065 — SWE-Review](https://arxiv.org/abs/2607.06065) | 2026-07-07 | Closing the review loop |
| [arXiv:2605.30314 — SpecBench](https://arxiv.org/abs/2605.30314) | 2026-05-28 | Spec-level reasoning benchmark |
| [arXiv:2604.05278 — Spec Kit Agents](https://arxiv.org/abs/2604.05278) | 2026-04-07 | Context-grounding hooks |
| [PR Arena](https://prarena.ai/) | continuous | Agent PR merge rates |
| [arXiv:2601.19964 — Productivity Gains with AI IDE features (Google)](https://arxiv.org/abs/2601.19964) | 2026-01-27 | 36k vs 18k A/B, +17.5% CI [15.9, 19.0] |
| [arXiv:2410.12944 — Google enterprise RCT](https://arxiv.org/abs/2410.12944) | 2024-10-16 | N=96; adjusted CI crosses zero |
| [arXiv:2211.03622 — Do Users Write More Insecure Code? (Stanford)](https://arxiv.org/abs/2211.03622) | CCS '23 | N=47; confidence/competence inversion |
| [Canaries in the Coal Mine? (Stanford Digital Economy Lab)](https://digitaleconomy.stanford.edu/publications/canaries-in-the-coal-mine/) | 2025-11-13 | ADP payroll microdata; −16% ages 22–25 |
| [Georgia Tech Vibe Security Radar](https://sslab.gatech.edu/) | 2026-04-13 | 43,000+ advisories; 74 AI-introduced CVEs |

### Reports with disclosed methodology — vendor-operated

| Source | Date | N / basis |
|---|---|---|
| [DORA State of AI-assisted Software Development 2025](https://dora.dev/research/2025/dora-report/) | 2025-09-23 | N=4,867 survey + 78 interviews; **all self-report** |
| [Faros AI — The Acceleration Whiplash](https://www.faros.ai/blog/ai-acceleration-whiplash-takeaways) | 2026-04-12 | 22,000 devs, within-org before/after telemetry |
| [LinearB 2026 Benchmarks](https://linearb.io/resources/engineering-benchmarks) | 2026-01-16 | 8.1M+ PRs; pickup-vs-duration split |
| [Swarmia — PR size growth](https://www.swarmia.com/blog/) | 2026-06-16 | 1,450+ orgs; +109% median |
| [DX — AI-authored code has nearly doubled](https://newsletter.getdx.com/p/ai-authored-code-has-nearly-doubled) | 2026-06-17 | 400+ orgs; PR size telemetry, AI-share self-report |
| [Veracode GenAI Code Security, Spring 2026](https://www.veracode.com/resources/) | 2026-03-24 | 150+ models, 80 fixed tasks; ~55% security pass |
| [Sonar State of Code 2026](https://www.sonarsource.com/) | 2026-01-08 | N=1,149 **survey only** |
| [Jellyfish State of Engineering Management 2026](https://jellyfish.co/) | 2026 | N=635+ **survey only** |

### Practitioner and engineering accounts

| Source | Author | Date |
|---|---|---|
| [Ten Months with Copilot Coding Agent in dotnet/runtime](https://devblogs.microsoft.com/dotnet/ten-months-with-cca-in-dotnet-runtime/) | Stephen Toub | 2026-03-23 |
| [Harness engineering for coding agent users](https://martinfowler.com/articles/harness-engineering.html) | Birgitta Böckeler | 2026-04-02 |
| [Understanding Spec-Driven-Development](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) | Birgitta Böckeler | 2025-10-15 |
| [Context Engineering for Coding Agents](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html) | Birgitta Böckeler | 2026-02-05 |
| [AgenticProgramming](https://martinfowler.com/bliki/AgenticProgramming.html) | Martin Fowler | 2026-05-21 |
| [Agentic Autonomy Levels](https://addyosmani.com/blog/agentic-autonomy-levels/) | Addy Osmani | 2026-07-02 |
| [Agentic Code Review](https://addyosmani.com/blog/agentic-code-review/) | Addy Osmani | 2026-06-15 |
| [Designing agentic loops](https://simonwillison.net/2025/Sep/30/designing-agentic-loops/) | Simon Willison | 2025-09-30 |
| [Embracing the parallel coding agent lifestyle](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/) | Simon Willison | 2025-10-05 |
| [The Coming Loop](https://lucumr.pocoo.org/2026/6/23/the-coming-loop/) | Armin Ronacher | 2026-06-23 |
| [Code like a surgeon](https://www.geoffreylitt.com/2025/10/24/code-like-a-surgeon) | Geoffrey Litt | 2025-10-24 |
| [Spec-Driven Development: The Waterfall Strikes Back](https://marmelab.com/blog/2025/11/12/spec-driven-development-waterfall-strikes-back.html) | François Zaninotto | 2025-11-12 |
| [Spec Driven Development isn't Waterfall](https://brooker.co.za/blog/2026/04/09/waterfall-vs-spec.html) | Marc Brooker | 2026-04-09 |
| [Codex worktrees and git locking](https://berry.sh/posts/codex-worktrees-git-locking/) | coderberry | 2026-05-29 |
| [The Pulse: AI coding stats from Cursor](https://newsletter.pragmaticengineer.com/) | Gergely Orosz | 2026-07-09 |
| [How 7 Kilo Code Engineers Run Up to 20 Parallel Agents](https://blog.kilo.ai/p/how-7-kilo-code-engineers-run-up) | Darko Gjorgjievski | 2026-05-26 |
| [Death by a thousand slops](https://daniel.haxx.se/blog/2025/07/14/death-by-a-thousand-slops/) | Daniel Stenberg | 2025-07-14 |
| [High-Quality Chaos](https://daniel.haxx.se/blog/) — **the reversal** | Daniel Stenberg | 2026-04-22 |
| [First Principles First](https://tidyfirst.substack.com/) | Kent Beck | 2025-10-21 |
| [The Final Bottleneck](https://lucumr.pocoo.org/2026/2/13/the-final-bottleneck/) | Armin Ronacher | 2026-02-13 |
| [How tech companies measure AI impact](https://newsletter.pragmaticengineer.com/) | Orosz + Laura Tacho | 2025-09-16 |
| [Measuring engineering productivity is harder than ever](https://leaddev.com/) | Robert Kimani | 2026-07-21 |

### Vendor engineering and documentation

| Source | Date | Note |
|---|---|---|
| [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | 2025-09-29 | Attention budget, hybrid retrieval |
| [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | 2025-11-26 | **Against interest**: compaction insufficient, over-reporting |
| [Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) | 2025-06-13 | +90.2%, ~15× tokens |
| [Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) | 2025-11-04 | **Against interest**: 150k → 2k tokens |
| [Equipping agents with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) | 2025-10-16 | Progressive disclosure |
| [Claude Code sandboxing docs](https://code.claude.com/docs/en/sandboxing) | continuous | **Against interest**: permissive defaults |
| [Don't Build Multi-Agents](https://cognition.com/blog/dont-build-multi-agents) | 2025-06-12 | Cognition, original position |
| [Multi-Agents: What's Actually Working](https://cognition.com/blog/multi-agents-working) | 2026-04-22 | Cognition, revised position |
| [Our internal AI engineering stack](https://blog.cloudflare.com/internal-ai-engineering-stack/) | 2026-04-20 | Risk-tiered review at 100% coverage |
| [AI Engineering Report 2026](https://www.faros.ai/blog/ai-acceleration-whiplash-takeaways) | 2026-04-12 | 22,000-dev telemetry |
| [The AI Code Quality & Maintainability Gap](https://www.gitclear.com/the_ai_code_quality_maintainability_gap) | 2026-01 | Duplication, churn — heavy caveats |
| [DORA State of DevOps 2025](https://dora.dev/dora-report-2025/) | 2025 | Amplifier thesis — **body not retrieved** |
| [Stack Overflow Developer Survey 2025 — AI](https://survey.stackoverflow.co/2025/ai) | 2025-07 | Trust, near-miss frustration |
| [Linux Foundation — Agentic AI Foundation](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation) | 2025-12-09 | MCP, goose, AGENTS.md governance |
| [Agent Skills open standard](https://agentskills.io/home) | 2025-12-18 | ~43 client implementations |
| [Spec Kit toolkit](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/) | 2025-09-02 | GitHub |
| [Pillar Security — Week of Sandbox Escapes](https://www.pillar.security/blog/the-week-of-sandbox-escapes) | 2026-07-20 | **Security vendor** — write-then-trust |
| [Cursor advisory GHSA-pc9j-3qc2-95wv](https://github.com/cursor/cursor/security/advisories/GHSA-pc9j-3qc2-95wv) | 2026-05-21 | CVE-2026-48124 |
| [claude-code issue #55724](https://github.com/anthropics/claude-code/issues/55724) | 2026-05-03 | Worktree index.lock contention |
