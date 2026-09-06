# Feature planning: UX and UI review

## Design premise

A feature plan should help someone understand an intended change, challenge it, and follow the evidence. Its primary object is a connected feature, owned by a product and affecting several components. The document is useful because its parts connect; treating them as seven equally weighted blocks conceals that value.

This review is based on the local React mockup, its seeded plans, section renderers, and the tax-rules example. It is a heuristic review and implementation pass, not research with users.

## Main findings and decisions

| Finding | Consequence | Design response |
| --- | --- | --- |
| All sections render in a single long document | Readers lose context and spend time scrolling between a screen, contract, and test | Focused, addressable sections with persistent navigation and previous/next links |
| The page starts with content rather than orientation | New readers must infer scope, readiness, and the best starting point | Overview with intended outcome, review priorities, a plan map, affected components, and related features |
| Section tabs mix intent, experience, implementation, and validation | The process is visible only to someone who already knows it | Four groups: Define, Experience, Build, Validate |
| Cross-references are dense, truncated, and explained mostly through hover | Connections are hard to interpret and easy to overlook | Explicit relationship labels; journey details show their connections directly; secondary detail uses native disclosure controls |
| Mockups sit far away from the journey | Reviewers must remember which step they are inspecting | Step selection with the corresponding screen and system links alongside it |
| Linked tests are described as proof, even when merely planned | The interface overstates readiness | “Linked to a test” and “Tested by”; passing results remain a separate metric |
| A primary “Move to Shipped” control appears before evidence is reviewed | It implies a consequential shortcut and does nothing in the mockup | Primary actions now explore the journey or review validation |
| Missing sections disappear | A partially drafted feature can appear complete | All sections remain visible, with explicit undrafted states |
| Components and overlapping features are compressed into dots or tooltips | Cross-product impact is difficult to assess | Readable component and feature links with ownership context |
| Decorative controls occupy the global header | Search and styling controls compete with planning | Working feature search, quiet global navigation, one theme toggle |

## Information architecture

The hierarchy remains **workspace → product → feature**. Components are the implementation footprint of a feature, rather than another mandatory level in the navigation path.

Home now establishes the workspace hierarchy before asking the reader to resume work. A prominent example plan provides a useful starting point because most seeded features have no written specification. Product and workspace pages remain inventories of active work, ideas, and shipped features. Product cards navigate to products; the workspace filter controls filtering. Product component lists name their linked work instead of relying on tiny coloured dots.

Inside a feature, the overview answers “What is this, what needs attention, and where should I go?” The sections answer narrower questions:

| Section | Reader's question | Structure and interactions |
| --- | --- | --- |
| Brief & scope | Why should this exist? | Problem and outcome, then success criteria and explicit exclusions. Test links indicate coverage, not success. |
| User journey | What happens to the user? | Ordered step selector, actor and surface, selected experience, branches, live screen, then implementation and test links. |
| Screens & prototype | What does it look and feel like? | Screen selector and a single preview canvas. Live examples remain interactive; missing external references are stated honestly. |
| System flow | How does the experience work? | Trace a journey or test, inspect nodes, open contracts, choose diagram scale, and identify component ownership. |
| API contracts | What crosses a boundary? | Contracts grouped by source and destination; expandable changes, request/response, and backlinks. |
| Data model | What changes at rest? | Tables grouped by owning component, explicit column headers and change markers, and links to flow, journey, and tests. |
| Tests & coverage | What evidence do we have? | Separate status totals, actionable missing links, status filters, scenario detail, and a full coverage matrix. |

The groups suggest a reading sequence without imposing a rigid workflow. An engineer can open a contract directly; a reviewer can start with the experience. Deep links and browser history remain useful throughout.

## Space and visual hierarchy

The desktop feature workspace uses a narrow, stable navigation rail and a flexible content area. The overview can use the full area for comparative information; focused views use a compact feature header to reserve more room for actual work. Prose stays constrained while diagrams and tables can use wider surfaces.

The previous floating glass header and stronger ambient effects are quieted. Borders establish grouping, type size establishes priority, and the accent identifies selected navigation and useful actions. Status colours continue to represent status. There is no overall completion percentage that could confuse “written”, “covered”, and “passing”.

At narrower widths, the journey's two columns stack. On mobile, a sticky section selector shows the current section without hiding it in an overflowing tab strip. Wide diagrams and tables scroll within their own regions; the diagram also offers a fit option. The design retains light and dark themes.

## Connecting and exploring

The main loop is **journey step → live screen → system trace → contract or table → linked test → success criterion**. References go to a specific item and can be revisited with browser history. Component scope is explicit in section controls and a visible banner. Normal section navigation preserves that scope. Item references open their full context so a filter cannot conceal the target. Brief and screen views explain that they show full context while a component scope is selected.

The overview's review priority counts missing criterion, journey, contract, and table test links. The tests section names those gaps and links back to the items that need a decision. The coverage matrix is labelled as including all tests, independent of the scenario status filter.

## Accessibility and interaction quality

The implementation adds a skip link, current-page and current-step semantics, named form controls, pressed state for test/trace filters, expanded state for disclosure buttons, and keyboard activation for SVG diagram nodes and contracts. Native selects and details elements provide keyboard behaviour without custom interaction machinery. Test status names are available alongside colour indicators in the coverage matrix.

Full screen-reader and contrast audits remain separate validation work. The prototype is not claimed to meet a formal accessibility conformance level.

## Prototype boundaries and next product decisions

This pass changes the planning and review experience, not the persistence layer. Existing creation/idea controls elsewhere in the mockup still need authoring flows. Missing sections deliberately explain their state instead of pretending a button writes a plan. The Figma seed URL is a placeholder and no longer appears as a working external reference.

Before implementing collaboration, define who can accept a plan, how decisions and unresolved questions are recorded, how evidence becomes stale after a change, and what moving between stages means. Those concepts should have real data and behaviour before the UI implies approval or readiness.

The seed also distinguishes affected components from external components participating in a flow. That distinction should be formalised before using footprint counts as an exhaustive dependency report.

## Verification

Production TypeScript/Vite build passes. Lint completes with warnings in the existing hook, ref, and mixed-export patterns; there are no build-blocking errors. Vite reports its configuration migration notice and a bundle-size warning.

Browser checks cover the overview, selected journey steps, live region recomputation (DE produces €170.17 from a €143.00 subtotal), journey-to-flow tracing, passing and empty failing test filters, feature search, an undrafted brief, component scope routing, and desktop/mobile light/dark layouts. Mobile navigation was revised after visual inspection exposed the hidden-current-tab problem.
