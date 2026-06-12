# Phase 6: Draft, Review & Present

The architecture document synthesises decisions from Phases 2 through 5. Drafting before all phases are complete produces a document missing data flows, technology rationale, and boundary definitions — the sections that make the difference between a useful architecture and a technology shopping list. Verify that all phases in `.groundwork/cache/architecture-cache.md` are marked `complete` before starting the draft.

**Before drafting**, silently scan the conversation. If any area from Phases 2–5 surfaced but remains too thin to write about, ask one more targeted question before proceeding.

When ready:

1. **Load the template.** Read `.agents/groundwork/skills/groundwork-architecture/architecture-template.md` to load the required section structure. Do not invent a custom structure — the template is the canonical format.

2. **Draft.** Synthesize Phases 2–5 into the template structure. The Service-Level Requirements table carries the architectural obligations into service-level design — every decision made in Phase 4 that imposes a requirement on a downstream service gets a row in this table. Apply the `groundwork-writer` skill: declarative, active voice, no hedging. Record decisions and their rationale — not the options that were considered.

   Write the draft as a directory of per-section files under `.groundwork/cache/architecture-draft/`. Each file stays bounded in size, so any later change (review revise, post-review edit) touches only the affected files instead of regenerating the whole doc in a single turn. Regenerating the whole doc at once exhausts the per-response output token budget on rich architectures; the per-section layout makes that failure structurally impossible. Use one `write_file` call per section (the tool creates parent directories automatically):

   | File | Content |
   |---|---|
   | `00-header.md` | The `## Summary for Downstream` section first (Key Decisions, Binding Constraints, Deferred Questions, Out of Scope per Protocol 5), then the document title and brief introduction |
   | `01-constraints-and-budgets.md` | Template section 1 |
   | `02-top-level-topology.md` | Template section 2 |
   | `03-key-capabilities.md` | Template section 3 (capability areas and technology decisions with rationale) |
   | `04-component-boundaries.md` | Template section 4 |
   | `05-communication-patterns.md` | Template section 5 |
   | `06-service-level-requirements.md` | Template section 6 (the SLR table) |

   The numeric prefixes determine concatenation order at commit. Each file is a self-contained markdown section — its top-level heading should start at H2 (`## 1. Constraints & Budgets`) to compose cleanly when the files are concatenated.

3. **Review.** Announce that the review process is starting. Assemble the draft for review: `run_command("cat .groundwork/cache/architecture-draft/*.md > .groundwork/cache/architecture-draft.md")`. This is a shell operation, not a model emission — it does not consume output tokens regardless of doc size. Then invoke the review subagent (Protocol 9) with `document_path: .groundwork/cache/architecture-draft.md` and `document_type: architecture`. Report the verdict and any findings explicitly before proceeding. The gate is fail-closed (Protocol 8): proceed only on a parseable `VERDICT: PRESENT`; a review that errors, hangs, or returns no verdict follows Protocol 9's failure path.

4. **Revise loop.** If the verdict is **REVISE**:
   - Apply all 🔴 Critical findings directly to the affected section file(s) under `.groundwork/cache/architecture-draft/`. Do not produce a list of suggestions — rewrite only the files the finding implicates. Each `write_file` is bounded by the size of one section, never the whole doc.
   - Re-assemble: `run_command("cat .groundwork/cache/architecture-draft/*.md > .groundwork/cache/architecture-draft.md")`.
   - Run the review again. Repeat until the verdict is **PRESENT**.
   - **Cap.** After 3 REVISE verdicts, apply the revise cap defined in Protocol 8: stop revising, surface remaining 🔴 Critical findings as 🟡 Advisory, and disclose that the review did not reach PRESENT and how many critical findings remain.

5. **Present.** Once the verdict is PRESENT, present the final draft section by section — emit each section file's contents in turn, pausing briefly between sections so the user can respond. Do not emit the full document in a single message; large architectures exceed the per-response output token budget. After all sections are presented, surface any 🟡 Advisory findings from the final review pass so the user can decide whether to act on them. Clean up the assembled file once presentation is complete: `run_command("rm .groundwork/cache/architecture-draft.md")`. The section files remain the source of truth for Phase 7.

6. Ask the user whether to save the architecture as-is or refine anything first. When the user wants to push a section deeper — or a section reads thin against the quality standard in the entry `instructions.md` — load `.agents/groundwork/skills/groundwork-elicit/instructions.md` and follow it. Proceed to Phase 7 only on explicit approval.
