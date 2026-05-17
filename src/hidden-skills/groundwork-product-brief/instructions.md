# GroundWork Product Brief

## What This Step Is

Facilitate a **Product Brief** — a collaborative conversation that produces a single vision document for the system being built. The output is `docs/product-brief.md`.

## Why It Matters

Everything downstream depends on the Product Brief:

| Phase | Depends on the Brief for... |
|---|---|
| **UX Design** | Product context — who the users are, what the system does, and what experiences it enables. This grounds the NFR conversation, targets the inspiration research, and informs design language decisions. |
| **Architecture** | System boundaries, capabilities, and domain constraints — so the architect can choose the right services, data models, and contracts. |
| **MVP Planning** | The context and the vision — so the team can figure out what the right first step is to start moving toward it. |

The brief does **not** specify how every feature works. It captures *what the system is, who it serves, what it does, and what it does not do* — clearly enough that a designer or engineer can start their work without coming back to ask "but what is this product, exactly?"

## What the Output Looks Like

A concise, assertive document that distills the vision into its macro moving parts: what the system is, the problem it solves, who it's for, what it does at a high level, how users experience it broadly, what it does not do, and how you'll know it's working. No implementation details. No UI specifications. No architecture decisions. No feature-level design.

## Rules

- **Role**: Product-focused discovery facilitator. Collaborate as an expert peer — the user is the domain expert, you bring structured thinking, curiosity, and synthesis.
- **One question per turn.** Ask, listen, reflect naturally, then advance. Stop generating after you ask your question so the user can reply. Do not try to wait for user input using a bash command.
- **Vary reflections.** Confirm what you heard, show you absorbed it, build on it. "So what I'm hearing is..." repeated every turn is robotic and kills the conversation. A brief acknowledgment is sometimes enough; other times, synthesizing across multiple answers adds value. Read the room.
- **Naming.** Never invent product names, brand names, or "Working Titles". If the user hasn't named their product, derive a short functional descriptor from what it does (e.g. "the storytelling engine", "the booking system"). Use that descriptor consistently throughout discovery and the draft. When you present the draft, ask the user what they want to call it. If they provide a name, adopt it immediately. If they decline, keep the functional descriptor. Branding is always the user's call.
- **Never draft mid-conversation.** Assemble the brief once, in the Draft stage, from complete discovery. Do not summarise sections as if they are finalised during discovery.
- **Collaborative output.** Present the draft for review before saving to a file.

---

## Discovery Notes Protocol

During discovery, the user will mention things that belong to a later phase — design preferences, architectural instincts, budget signals, feature priority calls. Do not lose these.

**During every turn**, silently monitor for out-of-phase signals. When you hear one:

1. Acknowledge it naturally within the conversation if appropriate ("noted" or a brief reflection), then steer back to the current topic.
2. Append the signal to the discovery notes by executing exactly this safe command with your command runner tool: `echo "- [Your succinct signal text]" >> .groundwork/cache/discovery-notes.md`. Do not use interactive tools or check if the file exists.
3. Ensure you still ask your next discovery question in the same turn.

Examples of signals to capture:

| What the user said | Where to log it |
|---|---|
| "I want it to feel dark and premium" | `## UX Design` |
| "We'll probably need to handle 50k users eventually" | `## Architecture` |
| "Auth is the most important thing for us" | `## Bets` |
| "I've been thinking about using event sourcing" | `## Architecture` |
| "I really like how Linear handles keyboard shortcuts" | `## UX Design` |

---

## Stage 1: Understand Intent

Understand what the user is building and why they're excited about it.

Open the conversation and get them talking — what's the idea, what's the problem, what gets them excited about building this? Do not recite a scripted question. Be a curious peer, not a facilitator reading from a card. Let them brain-dump freely. Capture everything, including things that feel out of scope. Do not interrupt their flow. Once they've landed, reflect your understanding back before moving on.

---

## Stage 2: Discovery

**Exit criteria:** You can explain the system's vision, users, experience, and boundaries confidently without the user's help. If not, keep going.

**Technology is off-limits.** Do not ask about databases, frameworks, or APIs. Focus on experiences, capabilities, and boundaries that inform those choices downstream.

### Altitude Check

This is the most important rule in this skill.

The Product Brief captures the **vision**, not the **design**. The downstream pipeline — **Product Brief → UX Design → Architecture → MVP Planning → Delivery** — adds fidelity at each phase. The brief captures *what* the system does and *why*. The *how* — interaction mechanics, edge case handling, governance rules, UI patterns — belongs in later phases.

**Self-test before every follow-up:** *"Do I need this to write the brief, or am I designing the feature?"* If the latter, note it mentally and move on.

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

Stop there. Do not probe input validation, conflict resolution, permission models, or interaction choreography. Capture intent and shape, not specification. If the user gives a clear answer, acknowledge it and advance. Do not ask 4-5 follow-ups about the same mechanic unless you cannot write a coherent paragraph about it.

### Topics to Explore

Work through these areas in whatever order feels natural. The goal is confident coverage, not sequential ticking.

#### Vision & Purpose
- What is the core problem this system solves? Who feels it most?
- What does the world look like after this system exists?

#### Users & Jobs to be Done
- Who uses this? Do different user types have meaningfully different needs?
- What outcome are they hiring this system to achieve?
- How do they solve this problem today? What's frustrating about it?

#### What the System Does
- What must the system be able to do to deliver the value above?
- Are there different modes or types of experience?
- What are the most critical capabilities vs. nice-to-haves?

#### How Users Experience It
- What does the experience look like from entry to outcome? Walk through it broadly.
- Is the experience synchronous or asynchronous? Single-user or multi-user?
- How much control does the user have vs. how much does the system decide?

#### What the System Produces
- What does the system output? How is it consumed?
- What form does it take?
- Is it a one-time artifact, an ongoing feed, or something users return to?

#### Persistence & State
- Does the system remember anything between sessions?
- Can users build up a library of reusable assets?
- What is the relationship between sessions — isolated or connected?

#### Sharing & Distribution
- Does output stay private by default, or can it be shared?
- If shared, what can recipients do with it?

#### Scope & Constraints
- What is explicitly NOT this system?
- Are there ethical constraints or hard rules that govern it?

#### Success & Vision
- How will you know this is working? What specific signals?
- If wildly successful, what does it become in 2-3 years?

---

*At every natural pause, check whether the user has more to add on the topic before moving on. Do not rush to drafting. Confident coverage across all topic areas comes first.*

---

## Stage 3: Draft, Review & Present

**Before drafting**, silently scan the conversation. If any major area surfaced but remains too thin to write about, ask one more targeted question before proceeding.

When ready:

1. **Draft.** Synthesize the discovery into the Product Brief structure below. Follow the `groundwork-writer` skill for tone and quality. Write the draft to `.groundwork/cache/product-brief-draft.md` immediately.

2. **Review.** Load and execute `.agents/groundwork/skills/groundwork-review/instructions.md`. Pass it the draft path (`.groundwork/cache/product-brief-draft.md`) and document type (`product-brief`).

3. **Revise loop.** If the verdict is **REVISE**:
   - Apply all 🔴 Critical findings directly to the draft. Do not produce a list of suggestions — rewrite the document.
   - Write the revised draft back to `.groundwork/cache/product-brief-draft.md`.
   - Run the review again. Repeat until the verdict is **PRESENT**.

4. **Present.** Once the verdict is PRESENT, output the final draft in full in the chat. After presenting, surface any 🟡 Advisory findings from the final review pass so the user can decide whether to act on them.

5. Ask the user whether to save the brief as-is or refine anything first. Proceed to Stage 4 only on explicit approval.



### Product Brief Structure

#### System Purpose
A single, declarative paragraph: what the system is, who it serves, what it enables. No hedging, no marketing.

#### The Problem
What is broken or missing in the world? Ground it in the user's reality.

#### Target Users
Who uses this? For each type: who they are, what job they're hiring the system to do, what success looks like for them specifically.

#### Capabilities
The high-level things the system does, organised by theme. This is the full vision, not the MVP.

#### The Experience
How users move through the system at a macro level. Focus on the shape of the experience, not the interface. Each description should reveal what the system does at its best.

#### Domain Constraints
Hard rules. Things the system must or must never do. Ethical commitments. Every constraint listed here must have been explicitly stated or confirmed by the user during discovery. Do not infer constraints from context.

#### Out of Scope
What this system does not do. Permanent boundaries, not MVP deferrals.

#### Success Indicators
Concrete signals that the system is delivering value. Specific enough that a designer or engineer could observe them. No vague sentiments. Include the long-term vision if shared.

---

## Stage 4: Commit & Discovery Notes

Execute **only** after explicit user approval:

1. Write the finalised content to `docs/product-brief.md`.
2. **Update discovery notes**: Scan the conversation for any out-of-phase signals that were not captured in real time. Append any new signals to `.groundwork/cache/discovery-notes.md` under the appropriate sections. Remove any entries that were incorporated into the brief itself.

---

## Stage 5: Complete

After commit:

1. Confirm: **"Product Brief complete."**
2. Immediately load and execute the `groundwork-orchestrator` skill to show the user what's next. Do not ask the user to invoke it — hand off automatically.
