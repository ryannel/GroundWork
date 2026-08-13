# Product Brief Structure

The canonical section list for `docs/product-brief.md` — the shape both greenfield discovery (`groundwork-product-brief`) and brownfield recovery (`groundwork-product-brief-extract`) draft against, so the two writers produce indistinguishable documents.

The brief is a **half-page orientation and boundary record, not a specification**. It answers, for any human or agent opening the project cold: what problem this system solves, for whom, through what surfaces, and what it will never do. The discovery conversation still runs at full depth — its richness reaches downstream phases through the Downstream Context file and the hand-off cache (Protocols 5 and 6), and delivered capability state lives in `docs/surfaces.md`'s capability ledger, not here. This document holds only what a gate consumes or a newcomer needs, which is why it is the slowest-drifting file in the project: it changes when the product's purpose, audience, or boundaries move, and at no other time.

Do not invent a custom structure or drop a section; skip a section's content only when it is genuinely irrelevant to the product, never the heading.

#### Purpose & Problem

One declarative paragraph: what the system is, who it serves, and what it enables — grounded in what is broken or missing in the world that this system exists to fix. No hedging, no marketing. Close the paragraph with the one or two concrete signals that would show the system is delivering its value — observable in practice, not sentiments.

#### Audience

Each user type in at most two lines: who they are, and the job they hire the system to do. The deep persona work — success narratives, emotional texture, the mental model a designer works from — happens in the discovery conversation and reaches downstream phases through the Downstream Context file and hand-off, not this document.

#### Surfaces

The deployed artifacts users meet the product through — a web app, a mobile app, a command-line tool, an MCP server or API, a voice interface, a physical device — one line each with its interface type, marked MVP / later / aspirational. Downstream phases design per interface type and architect, scaffold, and test per surface, so a surface never named here leaves all of them guessing. Once the architecture phase writes `docs/surfaces.md`, that registry is the canonical surface record and this list is its historical seed.

#### Non-goals & Hard Rules

The boundary record the scope gates read. Two kinds of entry: what this system deliberately does **not** do (permanent boundaries, not MVP deferrals), and the hard rules it must never break — ethical commitments, compliance lines, domain absolutes. Every entry was explicitly stated or confirmed by the user — during discovery or the extract interview — never inferred. The product persona's scope-fit check and the bet-pitch review's out-of-scope gate judge pitches against this section: write each entry concretely enough that a reviewer can tell when a pitch crosses it.
