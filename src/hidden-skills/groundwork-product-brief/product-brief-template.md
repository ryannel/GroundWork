# Product Brief Structure

The canonical section list for `docs/product-brief.md` — the shape both greenfield discovery (`groundwork-product-brief`) and brownfield recovery (`groundwork-product-brief-extract`) draft against, so the two writers produce indistinguishable documents. Do not invent a custom structure or drop a section; skip a section's content only when it is genuinely irrelevant to the product, never the heading.

#### System Purpose
A single, declarative paragraph: what the system is, who it serves, what it enables. No hedging, no marketing.

#### The Problem
What is broken or missing in the world? Ground it in the user's reality.

#### Target Users
Who uses this? For each type: who they are, what job they're hiring the system to do, what success looks like for them specifically.

#### Capabilities
The high-level things the system does, organised by theme. This is the full vision, not the MVP.

#### The Experience
How users move through the system at a macro level. Name the surfaces users meet the product through — each a deployed artifact: a web app, a mobile app, a command-line tool, an MCP server or API, a voice interface, a physical device — mark any not in the first build as later or aspirational, and describe each experience through its surface. Downstream phases design per interface type and architect, scaffold, and test per surface, so an experience that never names its surface leaves all of them guessing. A single-surface product names it once; the journey description carries the rest.

#### Domain Constraints
Hard rules. Things the system must or must never do. Ethical commitments. Every constraint listed here must have been explicitly stated or confirmed by the user — during discovery, or during the extract interview — never inferred from context.

#### Out of Scope
What this system does not do. Permanent boundaries, not MVP deferrals.

#### Success Indicators
Concrete signals that the system is delivering value. Specific enough that a designer or engineer could observe them. No vague sentiments. Include the long-term vision if shared.
