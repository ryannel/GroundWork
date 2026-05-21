# GroundWork Operating Contract

**This document is mandatory. Every GroundWork methodology skill MUST load and follow these protocols. They are non-negotiable and apply in every phase, every bet, and every conversation.**

---

## Protocol 1: Discovery Notes

Out-of-phase signals captured now save the user from repeating themselves in later phases — capture them immediately.

During any GroundWork conversation, the user will mention things that belong to a different phase — design preferences during a product brief, delivery priorities during architecture, architectural instincts during UX design. These signals are valuable and must be preserved.

### How It Works

During every turn, silently monitor for out-of-phase signals. When you hear one:

1. Acknowledge it naturally within the conversation if appropriate, then steer back to the current topic.
2. Append the signal as a new bullet under the appropriate section header in `.groundwork/cache/discovery-notes.md`. Use file editing tools — shell commands (echo, sed) corrupt markdown formatting. If the file does not exist, create it with all section headers listed below.
3. Continue with the next discovery question in the same turn so the user's flow is not interrupted.

### Section Headers

The discovery notes file uses these sections:

| Section | What goes here |
|---|---|
| `## UX Design` | Design preferences, aesthetic instincts, interaction patterns |
| `## Architecture` | Infrastructure preferences, scaling instincts, technology opinions |
| `## Bets` | Delivery priorities, MVP scope instincts, feature sequencing |
| `## Design Details` | Implementation details from capability and boundary conversations — async flows, callback patterns, job lifecycles, data ownership decisions, contract format choices, resiliency patterns |

### When to Check

At the start of any phase, check `.groundwork/cache/discovery-notes.md` for entries under your phase's header. Treat them as pre-discovered context. Re-asking signals that were already captured wastes the user's time and erodes trust in the process. Carry this context into the relevant stages.

---

## Protocol 2: Living Documents

Documents that fall behind the conversation lose value. All `docs/` artifacts are living documents — update them as new information surfaces.

This is not restricted to a specific phase or direction. Any phase, any bet, any conversation: if new information surfaces that refines an existing document, update it immediately.

- A bet can update the product brief.
- Architecture can update the UX design.
- Delivery can update architecture.
- A user interview can update everything.

### How to Apply Updates

- **Surgical and targeted.** Change only what new information warrants. Do not rewrite sections that are still accurate.
- **Do not ask for permission.** These are refinements consistent with the user's own words and decisions, not new product choices.
- **Report what changed.** After committing, briefly list any upstream documents that were updated and what specifically shifted.
- If no updates are warranted, skip silently.

---

## Protocol 3: Phase Lifecycle

Every methodology phase follows the same lifecycle. The sequence ensures artifacts are committed consistently — deviating risks orphaned cache files or lost discovery notes.

### 1. Initialize

Check if the phase's cache file exists in `.groundwork/cache/`.

- If it **does not exist**, create it from the phase's template.
- If it **does exist**, read it. If work is in progress, summarise what has been completed and ask whether the user wants to resume or start fresh. If they choose to start fresh, reset the cache from the template. If they choose to resume, skip to the first incomplete stage.

### 2. Check Discovery Notes

Check `.groundwork/cache/discovery-notes.md` for entries under the current phase's section header.

- If entries exist, treat them as pre-discovered context. Carry them into the relevant stages. Do NOT re-ask these questions.
- If the file does not exist or has no relevant entries, skip this step.

### 3. Execute Stages

Work through the phase's stages as defined in its instructions. Update the cache file as each stage completes.

Do not mark a phase complete until the user explicitly confirms — premature completion commits artifacts the user may not endorse.

### 4. Commit

When the user gives explicit final approval:

1. Write the final artifact to `docs/`.
2. Delete the phase's cache file from `.groundwork/cache/`.
3. **Apply the Living Documents protocol**: scan the conversation for insights that refine any existing `docs/` artifact. Apply surgical updates. Report what changed.
4. **Update discovery notes**: scan the conversation for out-of-phase signals not captured in real time. Append new signals to `.groundwork/cache/discovery-notes.md`. Remove entries that were incorporated into the committed artifact.
5. Confirm completion with a brief, clear message.
6. **Recommend a fresh context** for the next phase — a clean context gives the next skill full working memory. This is a recommendation, not a requirement.
7. Hand off to the `groundwork-orchestrator` skill immediately. Do not ask the user to invoke it.

---

## Protocol 4: Conversational Pacing

The goal of pacing is to manage the user's cognitive load. Complex, structural decisions — the ones that shape the product, constrain the design space, or have downstream consequences — deserve focused attention. Rushing through them in a compound question produces shallow answers that collapse under implementation pressure.

Give important questions room to breathe. When a decision has real trade-offs or downstream consequences, present it on its own, explore it fully, and resolve it before moving on. When several questions are straightforward or closely related, grouping them keeps the conversation moving without overwhelming the user.

Converge toward proposals. Once you have enough signal to form a recommendation, propose it and let the user react — continued interrogation past the point of sufficient information wastes the user's time and energy. The conversation should feel like it's building toward something, not circling.

Confirm before advancing to the next phase. Summarise what was established and get explicit confirmation before moving on — premature advancement commits decisions the user may not endorse.

