# System narratives

A narrative explains a system through an ordered spine of responsibilities. It is an **Inferred**
interpretation of existing evidence. The saved order guides card placement; it never changes an API,
event or data-access arrow, or asserts that independent activities form one request.

Use [groundwork-diagram](../.agents/skills/groundwork-diagram/SKILL.md) to author or review these views:
it covers value-flow explanation, apparent orphans, ownership, visual review and dataset-wide runs.
This document defines the production representation and commands used by that workflow.

## After a scan updates the production model

Run from the Groundwork checkout (the workspace must be registered):

```sh
node --import ./tools/register.ts --conditions=react-server tools/system-narrative.ts packet volvo-cars price > /tmp/price-context.json
```

Give the packet and this document to the LLM. The packet includes the system, contracts, handlers and
workspace flows, with their existing source references. It hashes the exact inputs, including absent
local files and the complete flow catalogue. Read the relevant evidence and cited code. Use existing
component and evidence IDs; do not invent actors, transfers or causal links. A shared database does not
establish shared document lineage. Distinguish background preparation from later request handling.

Write `narratives.yaml` beside that system's `system.yaml`. The closed schema is defined in
`src/infrastructure/system-narratives.ts`, and the domain shape in `src/domain/system-narrative.ts`.
The first story defines the whole overview, including all components needed to explain the system.
Its two to eight stages define columns in one row; supporting components sit beneath the related stage.
Arrange preparation and request handling logically without implying they form a single execution.
Later stories define optional flow highlights; include each participating component as a stage or supporting
component. Highlighting and filtering preserve the overview positions. Components outside the authored order remain visible below it, rather than disappearing.
Optional `connections` name existing directed edges with an action and evidence IDs; `relatedSystems`
keeps named neighbouring systems close when this technical view opens.

```yaml
format: 1
label: Inferred
authored: 2026-10-29
generator: Actual model/run identity, or explicitly unknown
basis: <exact basis from the packet>
stories:
  - id: prepare-inputs
    name: Prepare inputs
    summary: Explain the outcome in one or two sentences.
    confidence: medium
    reasoning: Explain the evidence and assumptions behind this interpretation.
    limitations:
      - Explain any unresolved handoff or conditional behaviour.
    stages:
      - component: svc:editor
        title: Maintain inputs
        summary: Explain what happens here.
        supporting: []
        evidence: [flow:maintain-inputs]
      - component: svc:processor
        title: Prepare data
        summary: Explain how the inputs become useful.
        supporting: [st:inputs]
        evidence: [flow:prepare-data]
```

Validate before handover:

```sh
node --import ./tools/register.ts --conditions=react-server tools/system-narrative.ts check volvo-cars price
```

This checks shape, duplicate identities, component membership, reference existence and input freshness.
It does **not** certify the prose or an execution path: review each stage against its cited evidence.
Stage order is reading order; only existing technical relationships are drawn. Keep the interpretation's
reasoning and limitations even when a human agrees with it.

On refresh, generate a new packet, compare the changed evidence with the saved stories, preserve useful
reviewed choices, and revise only affected meaning. Do not merely replace `basis` to clear a warning.
Changed inputs disable narrative layout and show a review notice until re-authored. The fingerprint is
conservative: any workspace flow change requires review. It establishes local model currency, not
remote or deployed currency. The separate scan interpretation sidecar remains authoritative for scan
interpretations; this file is a production workspace view and does not replace that contract.

The site never calls an LLM. Generation is an agent step after model publication, using the packet and
this workflow, so page loads remain deterministic and the interpretation can be reviewed in git.

## Value flows across systems

An area's `landscape.yaml` detail can save `valueFlow` with a title, summary, confidence, reasoning,
limitations, named `bands` and evidence-referenced `connections`. Band nodes use existing component IDs
and logical columns. Keep creation and publication separate from later request handling. Calls point from
requester to provider; writes and reads point to the store; event arrows show producer → topic → consumer.
Never reverse a call merely to make every arrow point right. The first question is what information becomes
useful, not how many components fit on a screen.

The default projection collapses each system once at its main cross-system responsibility. Expansion
reveals the same saved flow at component level, retaining topics and keeping other systems collapsed.
Components outside the core remain as quieter supporting material. Flow highlighting and filtering are
optional. Validate all component and evidence references against the current map, retain uncertainty about
unmapped origins, and review screenshots in both collapsed and expanded states after updating the model.

### Key connections and supporting explanations

The value-flow view starts with the authored `connections`, then keeps a small set of labelled supporting
links so every reachable visible component retains a route into the core. Saved explanations and local
business exchanges take priority over shared infrastructure. Visible topics retain recorded publishing and
delivery within the selected scope. With an explicit overview, secondary cross-system delivery is revealed
through exploration or All connections. Separate recorded groups stay separate; missing connections are never invented.
Other exchanges stay available through **All connections**, selecting a component or expanding its card;
the technical model is never pruned. This selected graph is a reading aid, not an execution sequence.
Default labels describe the work for a newcomer, not the number of calls.

Optional `valueFlow.summaries` use the same `{from, to, kind, label, evidence}` shape as `connections`.
They rename existing supporting exchanges only; they do not create a connection or make it part of the key
flow. After a scan, use the component, endpoint and handler context to author concise action labels, such as
“Find cars for sale”. Cite every operation covered by a summary. Keep unrelated work distinct and do not call
mixed read/write operations “Read”. Several callers using the same operation share the same explanation.
The viewer retains the individual calls and qualifications in the connection details. When no saved summary
exists, endpoint prose is the fallback; the application does not invent a business interpretation at runtime.
Review these summaries alongside the value flow after evidence changes and validate their references.

An area may save `valueFlow.overview` to select a concise default cross-system backbone from exact existing
core endpoints and kinds, retaining secondary exchanges for exploration. An empty array deliberately keeps
independent systems separate. The supporting forest still explains work within each expanded system.
`valueFlow.columns: [{system, column}]` gives collapsed systems an area-wide source-to-consumer reading
order, independent of the component columns inside `bands`. These are saved editorial choices, not inferred
execution or altered arrow directions. On new evidence, follow the diagram skill's
[maintenance workflow](../.agents/skills/groundwork-diagram/references/maintenance.md) to review affected
placements, neighbours, ownership and default prominence, then inspect the actual rendered result.
