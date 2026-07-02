# Phase 6: Draft, Review & Present

The architecture document synthesises decisions from Phases 2 through 5. Drafting before all phases are complete produces a document missing data flows, technology rationale, and boundary definitions — the sections that make the difference between a useful architecture and a technology shopping list. Verify that all phases in `.groundwork/cache/architecture-cache.md` are marked `complete` before starting the draft.

**Before drafting**, silently scan the conversation. If any area from Phases 2–5 surfaced but remains too thin to write about, ask one more targeted question before proceeding.

When ready:

1. **Load the template.** Read `.groundwork/skills/groundwork-architecture/architecture-template.md` to load the required section structure. Do not invent a custom structure — the template is the canonical format.

2. **Draft.** Synthesize Phases 2–5 into the template structure. The Service-Level Requirements table carries the architectural obligations into service-level design — every decision made in Phase 4 that imposes a requirement on a downstream service gets a row in this table. Apply the `groundwork-writer` skill: declarative, active voice, no hedging. Record decisions and their rationale — not the options that were considered.

   Write the draft as a directory of per-section files under `.groundwork/cache/architecture-draft/`. Each file stays bounded in size, so any later change (review revise, post-review edit) touches only the affected files instead of regenerating the whole doc in a single turn. Regenerating the whole doc at once exhausts the per-response output token budget on rich architectures; the per-section layout makes that failure structurally impossible. Use one `write_file` call per section (the tool creates parent directories automatically):

   | File | Content |
   |---|---|
   | `00-header.md` | The document title and brief introduction. No summary section — the Downstream Context (Protocol 5) is written separately at commit, not concatenated into the doc |
   | `01-constraints-and-budgets.md` | Template section 1 |
   | `02-top-level-topology.md` | Template section 2 |
   | `03-key-capabilities.md` | Template section 3 (capability areas and technology decisions with rationale, including the **Capability Ports & Providers** table: each capability → provider → footprint settled in Phase 5) |
   | `04-component-boundaries.md` | Template section 4 |
   | `05-communication-patterns.md` | Template section 5 |
   | `06-service-level-requirements.md` | Template section 6 (the SLR table) |
   | `07-surfaces-and-capability-core.md` | Template section 7: the core's deployment (hosted or embedded) with its consequence for contract format, and one line per surface — type, access path, auth. For independently deployed surfaces, the contract-compatibility stance. Detail lives in `docs/surfaces.md` (written at commit); this section carries the decisions |

   The numeric prefixes determine concatenation order at commit. Each file is a self-contained markdown section — its top-level heading should start at H2 (`## 1. Constraints & Budgets`) to compose cleanly when the files are concatenated.

3. **Review.** Announce the shift into review. Assemble the draft — a shell operation, not a model emission, so it costs no output tokens regardless of doc size: `run_command("cat .groundwork/cache/architecture-draft/*.md > .groundwork/cache/architecture-draft.md")`. Then dispatch `groundwork-review` per Protocol 9 with `document_path: .groundwork/cache/architecture-draft.md` and `document_type: architecture`. The gate is fail-closed and the revise cap is Protocol 8's, not restated here: on REVISE, apply every 🔴 Critical finding directly to the affected section file(s) under `.groundwork/cache/architecture-draft/` only — each `write_file` stays bounded to one section, never the whole doc — re-assemble with the same `cat` command, and re-dispatch until PRESENT.

4. **Present.** Once the verdict is PRESENT, present the final draft section by section — emit each section file's contents in turn, pausing briefly between sections so the user can respond. Do not emit the full document in a single message; large architectures exceed the per-response output token budget. After all sections are presented, surface any 🟡 Advisory findings from the final review pass so the user can decide whether to act on them. Clean up the assembled file once presentation is complete: `run_command("rm .groundwork/cache/architecture-draft.md")`. The section files remain the source of truth for Phase 7.

5. Ask the user whether to save the architecture as-is or refine anything first. When the user wants to push a section deeper — or a section reads thin against the quality standard in the entry `instructions.md` — load `.groundwork/skills/groundwork-elicit/instructions.md` and follow it. Proceed to Phase 7 only on explicit approval.
