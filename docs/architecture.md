# Architecture

Groundwork is a Next.js site run as a Node server (`npm run dev`, or `npm run build` then `npm start`). Each page
is drawn on request: it reads the YAML of the workspace, works out what the page says, and renders it, so an edit
shows on the next load. The readers keep what they work out until a file under the workspace changes, so a page
is cheap to draw again. Legacy readers leave generated `explorer/` and `evidence/` folders out of their watch: they do not read
them, and stamping their thousands of files cost seconds a request. The canonical `readModel` reader watches
`evidence/` as well as authored files because its citations depend on repository pins and evidence records. The site only reads; it writes nothing.

Plans are checked when they are written and before they are committed, not when a page reads them: checking every
reference of every plan against the whole of today cost seconds on each page of a large workspace. A page trusts
the check recorded in each plan's `base.lock.json`, and says when a plan has been edited since. `npm run dev`
compiles each route on its first visit and drops what the readers keep whenever the source changes; to read
workspaces rather than change Groundwork, run `npm run build` then `npm start`.

The layers below are enforced by `eslint.config.mjs`, and `test/architecture.test.ts` proves every rule still
fires. If a rule gets in the way, change the architecture on purpose, here and in the config, not with a
disable comment. Unused disable comments are errors.

During the model rebuild, `schema/workspace.schema.json`, `schema/plan.schema.json` and
`schema/evidence.schema.json` own the canonical contracts. `npm run generate` produces their TypeScript
registries and immutable type facade under `src/domain/model/`. `src/infrastructure/model-schema.ts` uses
Ajv for both direct checks and file loading; its errors retain JSON instance paths. The handwritten model
fixture under `test/fixtures/model/` exercises these contracts. Existing readers continue to use the
unchanged `schema/legacy-plan.schema.json` and legacy workspace validators until they move to the new
model. New fields are declared in JSON Schema and regenerated, rather than copied into handwritten types.

The canonical `WorkspaceModel` is serialisable data. `readModel` validates authored fragments, resolves only
schema-declared source citations and joins them by file containment. An unresolved pin, home or inherited
span stays in `problems`. Generated citation metadata follows the same schema definitions; arbitrary business
JSON and target-shift model-id citations are not rewritten. Duplicate evidence identities fail before any
reference can select an arbitrary record.

`indexOf` derives placement, execution edges, reverse queries, graph composition, roles, ownership and gaps.
Placement follows containment; resource ownership needs an explicit cited owner. Graph composition follows
selected, required and provided fields and reports unresolved or ambiguous composition. Its possible resolver
reach is not an observed runtime query plan. `apply` edits a private clone, preserves declared identities and
resolves new citations; `validateModel` rechecks the resulting fragments with the same contracts. `plansIndex`
is separate from the model index and gives each plan independent before and after values. Proposal
attribution is derived from the containing plan, change and op. Current facts retain strict effect-citation
validation. The plan projection boundary validates the base strictly, computes its own after model and uses
the same schema with only its annotated implementation-evidence policy relaxed. Missing implementation
evidence stays visible as a gap; retained citations describe baseline context, not implemented changes.

`legacyViewOf` is the named compatibility boundary for workspace/domain page consumers. Its workspace tree
retains canonical facets on their containing systems, with explicit aliases for legacy identity and narrative
fields. A recursive loss report compares every source field with that carrier. The page projection uses legacy
representations only where they are supported; it does not guess a transport, store form or service owner.
Other legacy consumers continue on the existing reader until their migration. Transitional `Model.place`
queries accept containment explicitly and never derive it from resource ownership.

## The model

A **workspace** holds **domains**. A domain holds **systems**. A system holds **components**. Plans live at
workspace level and may cross any domain. These four words are the only levels; one word per idea.

**Component** is the umbrella word for anything a system is built from. A component has a kind: a **service** (a
deployable microservice, worker or job), a **store** (a database), a **topic** (a queue or event stream), or a
user-facing app. Say "service" only when you mean that kind; say "component" when you mean any of them.

```
<workspace>/workspace.yaml            format, teams (handles, partner, contacts), the people (actors) who use the
                                      systems, and key journeys
  landscape.yaml                     authored areas and the major relationships used to enter the system model
  language.yaml                       the key terms the business has agreed on, anchored to the code
  domains/<domain>/domain.yaml
    language.yaml                     the domain's words: summary and concepts (system model)
    target.yaml                       where the domain is heading: its target architecture (people)
    systems/<system>/system.yaml      purpose, owning team (optional), components and what they talk to
    systems/<system>/contracts.yaml   what its components offer and keep (system model)
    systems/<system>/narratives.yaml  optional inferred stories, evidence references and input fingerprint
    systems/<system>/handlers.yaml    what runs when its endpoints and messages are reached (system model)
  story.yaml                          summary and stages across domains (system model)
  flows/<flow>.yaml                   one flow per file (system model)
  journeys/<journey>.yaml             a user journey and its interactions (system model)
  assets/                             screen drawings cited by journeys
  scans/<org>/<repo>.yaml             the commit each repo was last read at, and how far it has moved since
  programmes/<programme>/programme.yaml  the outcome some plans serve; shared scenarios, decisions, questions, milestones
  plans/<plan>/plan.yaml              the overlay, its work and its reasons (meta.programme, builds_on)
    progress.yaml                     what has happened: commitment, work and note events, append-only
    base.lock.json                    what an open plan was checked against (generated): checked_on, entities
                                      (target id → fingerprint), bases (plan → hash), programme { id, hash },
                                      composed (the hash of what its bases make), plan (the hash of the plan
                                      that was checked)
    base.yaml                         a landed plan's frozen today (generated)
    revisions/, assets/, mockups/     approved snapshots, pictures, the walking mockup
schema/plan.schema.json               the plan format, checked with ajv (in Groundwork, not the workspace)
```

`landscape.yaml` is optional. Its areas are authored, purpose-led entrances into the evidence, not a fifth level
beside workspace › domain › system › component. An area may reference systems from several domains and a system may
support several areas. The workspace page uses it when present; otherwise it keeps the domain-and-people map. Each
area has a dedicated page, and only the area-specific system relationships a person has reconciled are drawn there.
The authored landscape reads from left to right in relationship order, with parallel branches and at most
three connected areas per column. Its cards name the work and show a short purpose; the whole-width canvas
supports panning, zooming and full screen before the reader enters an area.
Information exchanges and activity transitions determine the rows; shared support does not imply a sequence.
Short branches move towards their destinations when doing so reduces total forward edge span without reversing
a relationship. A source is not held in the first row merely because it has no incoming relationships.
The pure `src/application/area-system-layout.ts` and `area-routing/route.ts` are shared with system maps:
the landscape uses their left-to-right layout and routes rounded paths through free gutters rather than through boxes.
Cycles retain their arrows as return paths. Canvas bounds grow with the drawing, using the page's vertical scroll.
Area details may also save an inferred `valueFlow`: evidence-referenced connections and named bands ordered
from information creation to use. The area opens on these value flows with each system collapsed once.
Expanding a system replaces its card with one bounded group; other systems stay collapsed and make room.
Collapsed anchors prefer the selected overview's cross-system relevance, then authored activity order. Other distinct activities remain
named on the same system card, so collapsing a multi-purpose system does not erase its secondary work.
`area-map/value-flow-system.ts` lays out the system's local value-flow bands. Core columns have fixed
spacing. Supporting components pack beneath the relevant band, gravitating towards their recorded core
neighbour without expanding every upstream column to fit a support tree. Unmatched components stay in a
labelled section inside the same boundary. Collapsed contributions use at most three rows per stage;
busy stages gain adjacent columns rather than pushing the consuming systems below every input. Headings
stay above contiguous cards on one row and repeat for dispersed contributions, retaining their original
band identity for filtering. They are placed again after expansion makes room. Full boundaries are excluded from route settling, which
uses component and heading obstacles instead. Spatial order explains business value; arrows
retain initiating request, store-access and event-delivery direction. The system-structure view remains
available for exact technical connections. The default value-flow canvas shows the key authored connections plus a small, labelled supporting forest
that connects reachable visible cards without adding hypothetical exchanges. Visible topics retain both
publishing and delivery sides where recorded. All connections, component selection and card expansion
reveal the remaining exchanges; filtering never changes card placement. Saved
`valueFlow.summaries` explain existing directed exchanges without adding edges or promoting them into the core.
An optional `valueFlow.overview` selects a concise, authored cross-system backbone from exact existing core
connections. It cannot introduce a new relationship. Other internal core work stays visible on expansion,
and component selection, resource expansion and All connections reveal secondary exchanges. Only currently
visible connections reserve routing corridors and label positions; disclosure does not move the cards.
Connection captions share one text and size policy in `shared/diagram-caption.ts`: compact typography,
word-aware shortening and at most two lines, with the full source label and qualifications retained in detail.
Routing reserves that displayed rectangle, including supporting exchanges, rather than measuring different
text from the renderer. `area-routing/route.ts` places captions immediately beside a real horizontal or vertical
segment inside the drawing's bounds. It never moves a caption to an unrelated free boundary. A bounded
alternative route is attempted when the first path has no caption slot. If the frame is exhausted, the edge
and direction remain intact and its full caption is available on hover or keyboard focus, with a notice in
the controls. Caption reservations must not make a physical relationship disappear or block its ports.
System gutters and supporting-row gaps use the stable caption dimensions of the full authored system,
independently of the current flow or connection filter. Default supporting labels are
quiet until focused; All connections reveals them. Collapsed exchanges keep their authored concise labels
in both modes, with the full purpose and operations retained in detail.
Cards inside SVG `foreignObject` elements use colours, not HTML opacity layers, to mute supporting work.
WebKit can paint an opacity-composited HTML card away from its SVG coordinates even though its reported
bounding rectangle is correct, leaving correctly routed arrows apparently detached. Inspect the painted
cards as well as the path geometry when checking alignment.
Shared-resource rows name their destination system and say when it is collapsed. Selecting a placed
resource expands its system, opens its containing service where needed and focuses the resource,
clearing flow-only filters that would hide it. Unplaced resources remain listed with an explicit
notice and no navigation action; a resource reference alone does not invent an arrow or ownership.
The component inspector puts its repository link beside a GitHub mark in the header. Repository identity
comes from the component's own code attribution, with the legacy explorer catalogue as a fallback.
Multiple source repositories are not reduced to an arbitrary first match.

Connection captions use one text and size policy in `shared/diagram-caption.ts`: compact typography,
word-aware shortening and at most two lines. The original label and qualifications remain in detail.
Routing reserves the displayed rectangle, rather than measuring different text from the renderer.
`area-routing/route.ts` keeps captions immediately beside a real segment, inside the owning bounds, and
protects the corridor between text and its arrow from neighbouring requests. It never moves a caption to
an unrelated free boundary. A bounded alternative route is attempted when no legal slot exists. If that
frame is exhausted, the relationship and direction remain intact, with the full caption on hover or keyboard
focus and an explicit notice. Caption reservations must not block a physical relationship's ports.
System gutters and supporting-row gaps use stable caption dimensions from the full authored system,
independently of the current flow or connection filter.

With an explicit overview, the default supporting forest stays within systems rather than adding secondary
cross-system bridges. An empty overview represents independent work without an in-area backbone.
Optional `valueFlow.columns` assigns area-wide reading columns to unique member systems, separately from
component columns within a local activity. Sources can remain before consumers even when their internal
preparation sequences use different stages. Omitted system placements retain the existing fallback.
Grouped links deduplicate purpose labels and retain the exact calls in their details. Reference validation prevents unresolved identities entering
this view; `area-map/value-flow-layout.ts` owns the reversible collapsed/expanded projection.
Recorded subgraph membership is a separate, undirected supporting connection, never an inferred API call.
Private resources recorded beside a consumer are placed with their known publisher when that component is
in the area; library-managed private topics may use explicit sole-owner writing access without inventing
a message contract. An unknown topic producer or store owner stays omitted; a captured publisher or accessor
still contributes its own evidenced exchange. Access alone does not establish ownership.
`area-map/transport.ts` packs the initial overview with every component identity and technical exchange,
retaining purpose summaries, evidence and qualifications. API contracts, resource rows and repository detail
load once from the read-only area `map.json` route on expansion or entry to the system-structure view.
A failed load offers retry; Reset cancels pending expansion, and refreshed server data starts a fresh detail
session. The full transport omits only fields that reconstruct exactly. No evidence is discarded.

The workspace's Value Flows catalogue sits directly below Map in the landscape rail. It projects the same
validated area value-flow bands into named outcomes, summaries and supporting system names, grouped by area.
Search matches those words, participating components and authored exchanges; it does not maintain a second
model. Query and area filters live in the address. Native history updates use fresh state so Next notifies
`useSearchParams`; existing silent address updates elsewhere keep their behaviour. Results link to
`areas/[area]/?flow=<band>#value-flow-map`. The map starts with that flow highlighted and its surrounding
systems collapsed, framing all participating cards and their exact core routes together, including independent
contributions. The frame fits both dimensions up to reading size independently of the previous camera;
Fit flow restores it without moving cards. Its explanation stays immediately above the visible drawing.
The camera controls, flow selector and explanations share one permanent header above the canvas. Selecting
or clearing a flow highlights it in place: it preserves page scroll, zoom, pan and the focused selector.
Fit flow deliberately reframes the chosen work. Incoming flow links still frame it on the initial arrival;
subsequent focus changes do not automatically scroll the page back to the canvas.
Participant cards have accent outlines and only exact authored exchanges receive accent arrows. Other links
remain faint even when they touch a participating system; the flow is not every dependency of those systems.
Only this flow hides the remaining cards and exchanges without changing positions. Repeated selected-band
captions are replaced by the one explanation above the drawing, while other captions stay quiet as context.
Following a flow also restores its exact authored exchanges when systems expand, with their own labels and
normal emphasis. Opening a participating system focuses that flow's local components rather than its first
unrelated activity, and collapse remains accessible beside the flow explanation. Other context stays available;
changing flow returns to its corresponding scope. Full screen respects the current camera intent;
manual zoom and pan otherwise remain under the reader's control.

Area system maps open before the activity list, using the full page width beside the navigation rail and
a viewport that uses the available screen height. Other workspace pages retain the standard reading width.
Opening a system reveals its boundary at a readable scale, with an automatic minimum of 85%. Very large
systems require panning; Fit map is the explicit action for a complete canvas overview. Opening from a
previous distant overview restores reading size. Subsequent manual panning and zooming stay under the
reader's control. Cross-system context is faint with quiet labels until selected or All connections is shown.
Collapsed systems show authored high-level exchanges. Expanded systems show connections with known component
targets, landing on those components or their API resource groups, never on a system's dotted boundary.
Untargeted authored exchanges remain in the collapsed overview; no component target is invented for them.
API resource groups retain protocol, versions and every underlying operation identity. Individual operations
and their contracts live in the inspector, not on the canvas. Selection does not resize component cards.
Systems may have an optional `narratives.yaml`, a saved Inferred interpretation with ordered stages,
component IDs, supporting components, evidence references, reasoning and limitations. The first story defines
the whole overview: primary components form one row, with supporting components beneath their related stage.
Later stories highlight subsets, with optional filtering. Both preserve the overview positions.
Technical arrows keep their original direction. The reader checks the fingerprint of the system's structure,
contracts, handlers and workspace flows; stale or unresolved stories show a review notice and use the
technical layout. `tools/system-narrative.ts` exports the LLM context packet and checks a saved narrative;
`docs/system-narratives.md` defines the post-scan authoring workflow. No LLM runs on a page request.
Expanded component flows read left to right: callers on the left, what they rely on to the right, because
cards are lists of rows whose ports sit on their sides. Each column is ordered by the mean position of the
cards it connects to, sweeping both ways and keeping the order that crosses the fewest lines
(`area-map/column-order.ts`). A chain longer than five columns wraps into a band below, like a line of text. Lines that share a gap get a lane each (`area-routing/lanes.ts`), staying in the
free space between cards, and are drawn above the cards so none is hidden. Labels on lines that land on a
named row stay hidden until the line is highlighted. Apps, services, stores
and topics have labelled, distinct treatments. Stores and topics appear once, with recorded technology;
modelled access and publishing/consumption links are distinguished from claims of deployed behaviour.
Stores used by only one service appear as selectable rows in that service's card. A topic or queue that one
service publishes, and that service owns, sits in that service's card however many components consume it;
its consumers are drawn as event lines from the publisher, and the layout treats them that way too. Users
are checked across the whole model, not just the visible area. Shared stores remain independent nodes.
While a system is open, the lines inside it lead and every line between systems (system to system, or a card
to another system) is faint and thin until something at either end is focused or selected; the legend says so. Explicitly classified infrastructure
(such as feature flags and sign-in) stays quiet until its caller is focused or the Platform toggle is on;
it remains in the model and inspector. The default connection forest never bridges business groups through
shared infrastructure. A business provider does not become infrastructure merely because many systems use it.
A component card (`src/ui/canvas/component-card.tsx`) leads with its name; a tinted icon and a faint
label give its kind. Plan system maps share its header in a dense treatment for narrow stage columns,
keeping the team stripe and existing interface rows. Their headers reserve at least 104 pixels so the kind,
name and purpose fit above the row ports. A system opens with its cards closed: under the name, one strip counts what the card
holds, and every line to its APIs, stores or topics lands on the card itself. That leaves one line per pair of
components and kind of link, labelled with how many calls it carries. Opening a card (the strip toggles it;
following a line opens its destination) lists titled sections, and lines then fan out to the API group or
resource row they use. The sections each have their own icon, colour and count: API (a
protocol badge, the resource path, then versions and operation count), Owns data (databases and caches),
Publishes to (owned topics and queues), and Uses shared (resources other components own, which open their
own details). Long dotted topic names keep their last parts. Card heights come from one place,
`src/application/area-map/card-geometry.ts`, which the stylesheet matches, so lines land on the middle of
the row they name. Arrowheads keep one size whatever the line's width.
Protocol-only API groups show the protocol badge and "API", not an invented endpoint address.

Plan and landscape system maps share `src/ui/canvas/system-card.tsx`: a System label and icon, the name,
purpose and component count, and an explicit Expand action. The name also expands; the plan's Details
action opens its inspector separately. Expanded systems use the shared canvas boundary and header with
Collapse. The expanded heading spans the boundary, with a divider above the components; it has no inset
card or selection stripe. Plan headings name how many components they contain. Plan columns reserve
128 pixels above their components for that header and keep their stage
arrangement. System counts include the model's services, stores and topics; a plan's count describes its
own model, which can cover less than the landscape. Landscape cards retain their other named activities.
Plan maps with authored stages offer two arrangements over the same scope: Value flow follows those
stages; System structure groups every component by its recorded system, including systems that span
several stages. The structural projection uses the shared system layout to place connected groups and
retains unassigned components without inventing a system. Resources remain inside their expanded system;
internal connections appear when their endpoints are visible. Overview / All components controls detail
separately. Each arrangement remembers its expanded systems and detail, while connection and platform
filters carry between them. Guided stops change the connection filter without resetting the arrangement.
Only the selected arrangement is drawn. Maps without authored stages keep their existing structural layout.
API and resource row anchors retain the enclosing card as a routing obstacle; only outer system
boundaries are ignored, so return paths cannot cut through their destination card.
The pure overview helpers live in `src/application/area-map/`; the API inspector is under
`src/features/workspace/area-map/`. Selection can isolate incoming (Used by) or outgoing (Depends on)
connections. Resting on a component for 120ms (or focusing it from the keyboard) lights its connections and
mutes the rest; leaving it waits 300ms, so passing over cards on the way somewhere does not flash the diagram.
Pointing at a line lights it at once and redraws it, with its label, on top of everything else. Pointing at a line
mutes nothing, so moving across a bundle of lines moves the highlight from one line to the next. Each line takes
pointer events only on a wide, undashed hit path, so dotted lines are as easy to point at as solid ones. Lines and
markers live in `src/ui/canvas/canvas-edge.tsx`; the timing lives in `src/ui/canvas/use-steady-hover.ts`.
All resting paths draw before the separate label layer, so a later path cannot strike through an earlier
label. Labels keep the same focus, context and support treatment without adding keyboard focus targets.
Diagram viewports support trackpad and two-finger touch pinch zoom, anchored at the gesture centre.
Ordinary scrolling still pans; zoom gestures affect the diagram rather than the browser page.
Full screen fills the browser viewport using the same canvas shell; Escape or the control restores the page,
including in embedded browsers without a native full-screen API.
The shared gesture handling lives in `src/ui/canvas/use-canvas-pinch.ts`.
Dragging the background pans once the pointer has moved a few pixels, so clicks stay clicks. The pointer is
captured only for the pan, and the pan ends on release, on lost capture, or on any move with no button held, so
the view never follows a loose mouse after the canvas changes under it (`src/ui/use-explorer-viewport.ts`). When
opening a card or system moves the selected component, the view moves with it rather than centring it again, so
the reader keeps their place (`src/ui/use-canvas-focus.ts`).

### Where workspaces are

A workspace is its own repo, holding both its model of today and its plans, so a plan and the model it rests on
share one history. Groundwork keeps one example in `workspaces/` (`personal`).
`src/infrastructure/workspace-folders.ts` is the only code that knows where workspaces are, and every reader asks
it for a workspace's folder by id:

- `GROUNDWORK_WORKSPACES`, when set, names the only workspace folders read (separated by `:`, or `;` on Windows).
  A company's server uses it so that its site serves no other workspace: `private: true` only keeps a workspace
  off the lists, and the site serves every workspace it reads.
- Otherwise the examples in `workspaces/`, and the workspaces `groundwork.local.yaml` lists. That file is
  git-ignored, one per checkout, so whoever clones Groundwork links the workspaces they want. An entry is a folder
  on this machine, or `repo: <url>` with an optional `folder:`, cloned into `.workspaces/<name>` (git-ignored)
  by `npm run workspace -- pull`; a listed repo that is not cloned yet is an error that says to pull.
  `bundled: false` leaves the examples out. Tests read no workspace on disk: they build Acme, a small typed
  fixture in `test/fixtures/acme/`, with `test/workspace-kit.ts` and `test/plan-kit.ts`, and write it to a temp
  folder when they test the readers.
- A listed folder without a `workspace.yaml`, two folders with one id, or a local file with unknown keys is an
  error, never skipped. A workspace's id is the `id` in its `workspace.yaml`, whatever its folder is called.

`npm run workspace -- new|add|pull|remove|check|precommit|list` makes a workspace repo, links one by folder or
repo URL, clones or fast-forwards the linked repos, stops reading one, checks one and every plan in it, checks
what a commit stages, and lists what is registered (`tools/workspace.ts`); the `groundwork-workspace` skill walks
people through it. Registering links Groundwork's skills into the workspace repo, git-ignored there, and installs
its pre-commit hook in `.git/hooks`: when YAML is staged it runs `precommit`, which runs `check` and refuses a
staged plan whose `base.lock.json` does not hold the check of what it says now. Groundwork's own `lefthook.yml`
checks the examples in `workspaces/`. Registration is resolved
afresh on each read. The existing workspace file stamps invalidate model and plan readers when a workspace
is linked, removed, relocated or edited, including folders outside this checkout; no restart is needed.
`workspace-folders.ts` also exposes the name, id, folder and registration source for command discovery.
Commands that select a workspace require its id when several are registered, and print their selected
workspace and path to stderr so JSON on stdout stays usable. Examples remain in `workspaces/` for compatibility,
but are labelled separately in the library and switcher; the folder is not a registry of company workspaces.

The workspace library's view model takes registration provenance as plain data. Local paths and repository
links are displayed only in development, never in production HTML or client props. A generic navigation
context in `src/ui/scope-switcher.client.tsx` lets the workspace layout provide a named scope and links to the
shared app bar on every workspace and plan page, without UI importing the model or features importing one
another. Workspace switching opens the chosen workspace's root, not a potentially unrelated plan or system.
The switcher reuses `Menu` with start alignment so its panel stays inside a narrow viewport. `workspace open`
uses the operating system's browser launcher (`open`, `rundll32` or `xdg-open`); these are system binaries,
not npm dependencies, and the latter two are declared in Knip's external binary list.

### The system model

How the systems work today, beside the structure. Every entry is in plan shape (the same `$defs` as
`plan.schema.json`) plus `origin: extracted | seeded | curated`. Sources are `{repo, path, lines, commit,
symbol?}`; the permalink is derived, never stored (a bare `{url}` is still read, for docs and dashboards).
`contracts.yaml` holds a system's stores, interfaces, schemas, messages, screens, graphs, subgraphs and
operations, plus `components:` detail (kind, summary, sources) for components named in `system.yaml`. The
structure stays the source of a component's name, tech and what it does. `handlers.yaml`, beside it, holds the
system's handlers (`handlers:`), each a fact like any other; the model reads them into `SystemContracts.handlers`.

A system is a bounded context: one team and one language. Its `team` may be missing while no one is named (the
system shows its owner is not known), and `runs_on` names the platform system it runs on. A team in
`workspace.yaml` may list `handles` (the names CODEOWNERS, GitHub and Backstage use for it; each names one team), and
a team outside the company is `partner: true` with `contacts`. A partner's systems are described from its documents:
facts with `origin: documented` cite `{ url, pointer or heading, version }`, which `tools/sources.ts` counts as
attributed without fetching. A domain's `language.yaml` holds the words its systems
use, each a concept with what it means, where it is born (`born_in`, a component, so its home system follows) and
what each other system calls it (`aka`). A word lives in the domain where it is born; `npm run workspace -- check`
warns when it does not (`src/application/workspace-language.ts`). Every domain's words join today's
`domain.concepts`, so plans and views read one language.

The workspace's own `language.yaml` holds the **key terms**: the words the business has agreed on, in groups,
each with what it means, its aliases, examples and the terms it relates to. Each key term is anchored (`anchors`)
to where it lives in the code, a domain's word (`con:…`), a system or a domain, with how well the code's word fits
(`same`, `renamed`, `close`, `clash` or `lives-in`). A key term may have no anchor yet. `check` warns when an
anchor or relation points at nothing.

A domain's `target.yaml` is its **target architecture**: where the domain is heading, not what runs today and
not a plan. It holds a summary, `stages` (the things the business makes, in order, each with an optional key
`term`, the systems or components that should `own` it and the stages it is made `from`) and `shifts` (what is
true `today`, what the `target` is, and the ids that show it). Stage and shift ids are local; owners, cites and
`[[id]]`s point into today's model, and `check` warns when they do not (`src/application/workspace-target.ts`).
People write it; the scan never does. The domain's Target architecture tab draws it as a flow: one card per
stage listing its owners, and a line from each stage to every stage it feeds. Each stage made from nothing starts
a lane; lanes meet at a hub and run on as one trunk (`src/application/workspace-target-flow-grid.ts` places the
stages, `workspace-target-flow.ts` sizes and draws them). Owners that live elsewhere say where, and stages owned
entirely outside the company are dashed. The stages are then listed in reading order, then the shifts. Today's
calls are left out.

- `src/domain/workspace-model.ts` has the types: `WorkspaceModel`, `Attribution` (origin and code sources by id,
  nested ids included) and `Scan` (a repo's high-water mark: `head` from `tools/scan-mark.ts`, and `checked`, the tip and commits
  behind that `tools/scan-status.ts --record` last saw).
- `src/infrastructure/workspace-model.ts` reads the files (each one optional), takes `origin` off, keeps the
  sources as attribution, turns them into permalinks and checks each entry against its plan `$def`. An id
  defined twice is an error.
- `src/application/workspace-model.ts` `systemModelOf(workspace, model)` assembles one plan-shaped document with
  no changes (teams and colours from `workspace.yaml`, `sys:<system>` per system, components as services or
  stores) and derives it, so every plan view can draw today. A test proves the Acme test fixture's document has
  no validation errors, draws every component and resolves every flow step.

### Service explorer

The optional service explorer reads a disposable projection under `<workspace>/explorer/`; its typed
contracts are in `src/domain/service-explorer.ts`. A workspace has one explorer page, with selected immutable
JSON artefacts loaded on demand. Infrastructure validates manifest membership, byte bounds, content hashes,
references and snapshot identity before publication and again in the browser. The current selected proof
covers Customer Service and Pre-tax as a compatible fallback. Completed corpus publications use a small
catalogue selecting repository manifests and hash-bound page-index buckets. Logical pages and indexes travel
in bounded content-addressed packs; the browser verifies both physical and logical hashes. A publication ID
separate from the evidence snapshot selects the complete immutable generation. The browser fetches only the
selected evidence, from `/explorer-data/<workspace>/<generation>/<file>`, which reads the installed generation
in place under `<workspace>/explorer/corpus/` (`src/infrastructure/scan-explorer/corpus-assets.ts` installs it;
`src/infrastructure/explorer-assets.ts` reads it back) and lets the
browser keep it; nothing is copied into `public/`, and there is no HTML/data route per source method. A repository scope
remains distinct from a source-proven runtime component. The source inventory, published navigation references
and reviewed Inferred context are separately navigable. Publication does not migrate production YAML.

### Evidence

What a scan finds in a repository is the canonical record of today, and it lives in the workspace repo, current
only: git holds its history, so nothing keeps an older scan beside the newer one.

```
<workspace>/evidence/<repo>/
  repository.json                     repo, commit, scannedAt, language and the passes run
  discovery.json                      readiness, scopes, declared components and knowledge gaps (optional)
  <family>.jsonl                      one record per line, sorted by id: files, framework, contracts, schemas,
                                      claims, and the sources they cite
<workspace>/.groundwork/              git-ignored, rebuilt by a rescan or from the above
  analysis/<repo>/                    call-level analysis: bindings, summaries, gaps and the sources they cite
  syntax/<repo>/                      the syntax graph (nodes, edges, regions)
  evidence.sqlite                     the index every reader queries
```

A rescan replaces a repository's folder whole. Records drop the repo and commit (`repository.json` says them
once) and carry no source text: code is read from a clone at the commit. Call-level analysis (a record per
call site) and the syntax graph follow mechanically from the code at the commit and run to gigabytes, so they are
caches, not evidence; only the spans a fact cites stay in `sources.jsonl`. For Volvo's 117 repositories the
evidence is about 110 MB, the analysis 3.5 GB. The types are in `src/domain/evidence/evidence.ts`, the
shaping in `src/application/evidence/`, and the writer in `src/infrastructure/scan-explorer/evidence-files.ts`.

`npm run evidence:index -- <workspace>` builds `evidence.sqlite` (`evidence-index-builder.ts`) from the evidence
and the analysis cache: one row per record with its label, file and lines, the links between records, and an FTS5 search table. It writes beside
the live file and renames into place, so readers never see half an index. The site, an MCP server or a REST API
all read through one synchronous port, `EvidenceQuery` (`src/application/evidence/evidence-query.ts`), which
`src/infrastructure/evidence/evidence-index.ts` implements over `node:sqlite`, read-only, reopening when the
file is replaced. `npm run evidence -- <workspace> search <text>` queries it from the command line.
`npm run evidence:migrate` converts the earlier capture and discovery catalogues once; scans should write this
format directly.

This corpus publisher is a compatibility bridge, not the authoritative company query model. References
reconstructed from bounded visual frames are partial navigation aids; they cannot establish exhaustive
callers or endpoint correspondence. The production direction is an evidence-derived relationship index
and shared bounded queries for the UI, CLI and MCP. Presentation must not define semantic relationships.

`src/application/scan-explorer` builds bounded, source-backed component, entry, data and reverse-caller
queries over current scan records and retained canonical selections. The exporter produces component-first
views and separate method/schema frames. `src/application/explorer-focus.ts` can collapse nested expression
operations for reading; the complete delivered source view remains available. Source containment, branches
and asynchronous boundaries remain distinct from observed runtime execution. Inferred purpose is labelled.
See the [service explorer contract](scan-trials/service-explorer/README.md).

### Canonical execution proof

The endpoint execution redesign is implemented separately from the production plan-shaped YAML reader.
The current [runtime component and interface contracts](scan-trials/runtime-components.md) bind code,
call sites and schemas to technical component identities with commit-pinned GitHub sources.
Its [capture contracts](scan-trials/capture-proof/README.md) and
[write and asynchronous continuation contracts](scan-trials/soft-offer-proof/README.md) describe the accepted
proof scope and remaining adoption gates. `schema/knowledge.schema.json` defines immutable revision bundles, snapshot
selection, control/data records and query messages; `npm run generate:knowledge` generates domain types.

`src/domain/knowledge` defines revision references and validation rules. `src/application/knowledge` performs
snapshot-bound control, value, outcome, effect, invalidation, asynchronous continuation, consistency and
bounded supporting-record queries through `KnowledgeReader`.
Lexical captures remain separate from formal parameters; invocation-bound capture origins are described in
[lexical captures](scan-trials/lexical-captures.md). Capture bindings do not establish callback scheduling.
`src/infrastructure/knowledge` validates documents, verifies hashes and builds a disposable SQLite index.
`npm run proof:capture` and `npm run proof:soft-offer` replay pinned Volvo fixtures and export query responses
and static drawings. Archived v1/v2 schemas preserve both original snapshots. The v2 extension adds
write acknowledgements, channel bindings, subscriptions, handoffs, delivery policies and consistency boundaries.
The v3 extension adds runtime/execution/resource/entry bindings, interface contracts, interaction queries and
derived GitHub anchors. The default proof view draws components first, with selectable schemas and internal logic.
No runtime server or new application route is introduced. The existing workspace loader is unchanged.

For this proof, validated immutable bundles plus a snapshot manifest are authoritative; database indexes and
visual projections are rebuilt from them. Technical identities do not depend on team ownership or the
current domain/system grouping. This is the intended separation for the new model; the legacy hierarchy
and team constraints described above still apply to the existing reader until deliberately migrated.

### Question-led scan pipeline

The reusable scanner is separate from the production workspace reader and the existing immutable execution
captures. `schema/scan.schema.json` owns its versioned contracts and generated domain types. Source indexes,
local summaries, actor actions/outcomes, obligation receipts and freshness are separate from visual projections.
Typed local semantic graphs preserve parsed atoms, control and value relations, lexical bindings, callbacks,
SQL bindings and explicit runtime uncertainty. Independent bounded checkers query those relations; display
syntax cannot substitute for missing structure. Public validation checks evidence ownership and scope too.
Parser diagnostics quarantine a file's semantic extraction; recovery trees remain in the disposable index.
Explicit repository trials inventory the tracked tree and publish bounded shards plus an aggregate selection;
analysis host placeholders remain consistent across shards without establishing runtime component identity.
Repository v2 summaries reference complete, hash-bound trial metrics rather than repeating freshness lists.
Large logical scan documents use checked storage fragments; each physical page remains bounded, while
source and programme callers have separate total decoding limits. Reassembly preserves all records and
logical generation identity before the existing schema and role checks. These storage formats do not
change the canonical scan model or establish runtime behaviour.
`src/infrastructure/scan/` owns compiler adapters, pinned Git reads, content caches and contract validation;
only this infrastructure folder may import the TypeScript compiler. The installed compiler is a runtime
dependency of these offline tools, not a browser dependency. Pure scan rules and dependency invalidation live
in domain/application; clocks, references and filesystem access are supplied by infrastructure or tools.
Freshness compares an accepted source baseline with an explicitly observed reference and analysis versions.
Only changed blobs are reparsed; dependent facts can be invalidated without rereading unchanged source.
A local reference observation does not establish current remote or deployed state. Benchmarks use explicit
fixed scopes and do not restart the wider Volvo scan queue.

### The landscape

The Landscape is the workspace at its most zoomed out, in three pages: **Map** (`/[workspace]/`), **Language**
(`/[workspace]/language/`) and **People** (`/[workspace]/people/`). Only domains and people appear; systems and
components belong to the domain and system pages, and teams are not shown.

- The Map (`src/features/workspace/landscape-map.client.tsx`) is a context map. Each domain is a box with its
  purpose, how many systems it runs and the people who work in it as chips. The customer (an actor with
  `customer: true` in `workspace.yaml`) sits apart on the left. Domains run left to right by reliance: the ones the
  customer uses, then the ones those call or hear events from. One curved line between two domains stands for
  everything that runs between them.
- A person works in the domains whose systems they `use`. A person's journeys are the user journeys and flows
  whose `actor` names them. Picking a person lights where their journeys go and lists them, to search. Picking one
  lights just that journey and links to its explorer. Resting on a domain lights what it connects to and names
  what the lines carry.
- `src/application/landscape-domains.ts` rolls the model up to domains, people, lines and journeys.
  `landscape-domains-layout.ts` places the boxes in columns (loops broken where first met, each column ordered by
  where its neighbours sit). `landscape-domains-lines.ts` draws the curves, spreading where lines meet a box so
  they do not cross there.
- Language lists the key terms in their groups, with how well each fits the code, then every domain's words
  from the scan; search and a domain filter narrow both. Picking one opens it beside the list (`?term=`): what
  it means, its aliases and examples, where it lives (domain › system › component), what the code calls it and
  what it relates to (`src/application/language-page.ts`). A domain's Language tab is the same page narrowed to
  the domain (`domainLanguageOf`): its own summary, the key terms that live in it and its words, with no domain
  filter. A scan seeds the words; people polish the key terms. People lists everyone, customers first, with their domains and
  journeys.

### Plans

- Plans have their own index, `/[workspace]/plans/` (`src/features/workspace/plans-page.tsx`), built to find one
  among hundreds: search by words, cut by domain or stage, sort, fifty rows at a time. The cut travels in the
  address (`?q=`, `?domain=`, `?stage=`, `?sort=`). `src/application/plan-index.ts` reads each plan as a row: the
  domains it lands in (those holding a component it changes, or a repo its work goes to), its stage (draft, in
  review, approved, then in delivery and delivered from its work items) and its date. The rail counts the plans
  and links to the index; it does not list them. When the workspace has programmes, the index opens on them (each
  with its plan count, how many are held up and the next held up, from `programmeRowsOf`) and then lists only the
  plans on their own; any search or cut lists every plan that matches, programme or not.
- A domain's Plans page, `/[workspace]/[domain]/plans/`, is the same index narrowed to the plans that reach the
  domain (`domainPlanRowsOf`), with no domain filter; each row names the other domains it also lands in.
- Plan types live in `src/domain/plan/`. `plan.generated.ts` is generated from `schema/plan.schema.json` by
  `npm run generate`; a test fails if it is stale. Generated files are exempt from size limits only.
- Everything worked out from a plan (the derived layer: graph, journeys, impact, delivery, diffs) lives in
  `src/application/plan/`. It is pure, so the same code runs on the server and in the browser.
- Handlers (`h:` ids) say what a component does when an endpoint, message, interaction or schedule reaches it,
  as a tree of steps. `handler-walk.ts` flattens the tree and words each step's guard ("when …", "for each …");
  `check-handlers.ts` validates them; `derive-handler-edges.ts` turns their calls, publishes, reads and writes
  into edges merged into `edges()`; `derive-handlers.ts` gives the Model `handlerEdges`, `handlersOf` and
  `callTree`.
- A plan holds no copy of today. It lists its changes as ops and, under `context`, the ids it relies on but
  names nowhere else. `src/application/plan/plan-base.ts` reads a plan onto its base:
  - an open plan's base is today, live from the system model, cut to the part the plan names (`scopeOf`: what
    its versions name, and everything that names in turn, with a graph's root types trimmed to fields in reach);
  - a landed plan's base is `base.yaml`, frozen from today when it shipped, so it reads against the system it
    changed.
  - a plan that `builds_on` others reads today with the open plans of its `builds_on` closure applied first, in
    dependency order (`plan-stack.ts` orders them; `stack-base.ts` applies their ops). A landed base is part of
    today and drops out. Its as-is is "after the plans it builds on" and its to-be "after this plan", so its diff
    shows only its own increment; the part it draws holds what those plans added and changed, and `inherited`
    (id → `{ plan, title, kind: 'added' | 'modified' }`) says which plan did it (`Model.inheritedFrom`).
    `base.lock.json` fingerprints what an open plan's `modify`, `remove` and `after` ops target, and records the
    hash of each open plan it builds on, of its programme, and of what those plans made; when today, a base or the
    programme moves, the cover names it and the plan is stale until checked again (it reads them as they are now).
    The lock also keeps the hash of the plan it checked; when the plan has been written since, its cover and its
    row in the plans index say so. `npm run plan:base -- check <plan>` validates and writes the lock; `-- land <plan>` writes `base.yaml` and drops
    the lock, and refuses while a plan it builds on has not landed. `src/infrastructure/plan-base-store.ts` loads
    both.
  - Two open plans that neither builds on, directly or further down, and that touch the same thing (both modify
    it, one removes what the other changes or a part of it, or both add it) overlap: a warning on both, and a line
    in `npm run workspace -- check`. A plan that builds on both is an error, since what it reads would depend on
    which went first; a list order never decides.
- `src/infrastructure/plan-store.ts` reads plans and revisions onto their base. `readPlan` trusts the check a plan
  passed when it was written and only shapes the part it draws against the schema; `checkPlan` checks every
  reference against the whole base (what today finds wrong with itself is left out), for `plan:base`,
  `workspace check` and the pre-commit hook. A plan reads its neighbours only by id (`src/application/plan/check-neighbours.ts`): the plans it
  `builds_on` (they exist, never itself, never in a circle), the programme it joins (`meta.programme`), and ids in
  another plan or the programme, qualified as `<plan or programme>/<id>` in `depends_on`, `blocked_by`, `after`,
  `serves` and `[[…]]` citations.
- A change may have `requires` (`req:` ids) and no ops yet, only while an open question in `blocked_by` holds it
  back. Work items need not implement a change (recovery and operations work), and carry `needed_by`.
- `plans/<plan>/progress.yaml` is an append-only record of what happened to the plan's work items and milestones:
  `commitment` events (proposed, accepted, declined, withdrawn, with a promised date and confidence), `work` events
  (not started, in progress, blocked, done) and notes, each with who said it and where (`application/plan/progress.ts`
  checks them). A work item's GitHub issue state is its latest `github` work event. There is no team-wide vote.
  `npm run progress -- add <workspace> <plan> …` (`tools/progress.ts`) appends one checked event, creating the file
  when needed, and leaves out a `github` work event that repeats the latest one, so the issue sync is idempotent;
  `-- show` prints where the work stands. The site never writes it.
- Three things are tracked for every piece of work and never mixed (`Model.standing`, worked out by the store in
  `src/infrastructure/plan-standing.ts` and sent with `plan.json`):
  - **commitment** and **progress** (`application/plan/work-standing.ts`): per work item, its latest commitment
    (state, promised date, confidence, who said it, where), its latest work event and when we last heard; its
    `needed_by` (or its milestone's `due`) against the promised date, as a gap in days (positive is later than
    needed); and its blockers: a `depends_on` item, here or in another plan, whose commitment was declined or
    withdrawn, and an open question or undecided decision in `blocked_by`. A milestone rolls its own and its
    items' commitments up (declined if any is, accepted only if all are) and is blocked by an `after` milestone
    that was declined. Each team hears last from the newest event about its items.
  - **realisation** (`application/plan/realisation.ts`): each op compared with today's model (never a stacked
    plan's base) and rolled up per change: missing, partial, matches or differs. Only facts with authority count:
    read from code or written by people, or documented when the owning team is a partner; the demo seed does not.
- `programmes/<programme>/programme.yaml` (`$defs/programme` in the plan schema) holds an outcome and the problem,
  scenarios, decisions, questions and milestones its plans share; `src/infrastructure/workspace-programmes.ts`
  reads and checks them, and `npm run workspace -- check` reports them. `programmes`, `partners` and `impact` are
  reserved, so no domain may take them.
- Every plan of a workspace is read once into one index (`src/application/workspace-work/workspace-plan-index.ts`,
  loaded and kept until a file changes by `src/infrastructure/workspace-plan-index.ts`): its plans in landing order,
  programmes, changes and work keyed `<plan>/<id>`, each `builds_on` edge with the changes there the plan reads
  (`through`, from the ids its ops use and the work it waits on) and its health (ready, waiting, stale or conflict),
  and the overlaps. Each screen about many plans projects from it to one plain, worded view model: `workCardVM`,
  `stackCoverVM` (a plan's cover), `partnerPageVM`, `programmePageVM` and `impactVM` (pending work on a team or a
  system: now, next, then, blocked).
- The pages about work across plans project from that index: the programmes (`programmeRowsOf`) and one programme
  (`programmePageVM`: outcome and standing, then its plans in landing order with what each builds on, its milestones
  with the plan milestones that serve them, its decisions and questions, where it lands from `landingOf`, and the
  partner work it depends on); the partners (`partnersVM`: the systems each owns, its work across plans, when we last
  heard, with an age) and one partner (`partnerPageVM`). Last heard is never called overdue: no team has an agreed
  check-in cadence yet. A system page's Plans section starts with the work still to do there across plans
  (`impactRowsOf`), grouped now, next, then and blocked, each row saying who owns it ("Orders owns", or "Payments
  owns · we depend on this"), which plan it is in and how it stands; a change's systems include what it changes that
  a plan below it added. The page bodies live in `src/features/workspace/`; the partner page takes each item's
  `WorkCard` from its route, which reaches it through the plan feature's index, as a system page takes its map.
- One work card draws every team's work (`src/features/plan/work/work-card.tsx`, on `RecordCard`): who owns it
  ("we depend on this" for a partner), its commitment, progress, needed-by date and how many days later the promise
  is, when we last heard, and what holds it up, as links. Ours ends in its GitHub issue; a partner's in Record update,
  a form that drafts one `progress.yaml` event (`application/plan/progress-draft.ts`) and gives the exact
  `npm run progress -- add …` command and an agent prompt that appends it. The site still writes nothing. The build
  waves draw partners' items in their real waves beside ours, never in a lane of their own, and Send to GitHub
  leaves them out and says how many are recorded separately. The inspector shows the same card for a work item.
- A stacked plan's cover says what it reads after (each base as checked ✓, or changed since), when it was checked,
  the work those plans have not delivered, its overlaps with links to the change in both plans, the programme it is
  part of, and the one command that checks it again. Wherever the changes chapter or a thing's page shows something
  a plan below added or changed, `InheritedNote` labels it once per group: "Added by Sales tool · not live yet".
- The plan viewer is one feature, `src/features/plan/`, with subfolders per chapter. Charts that know the model
  stay in the feature; `ui` stays model-agnostic.

### Routes

| Route                                               | Page                                      |
| --------------------------------------------------- | ----------------------------------------- |
| `/`                                                 | the workspaces                            |
| `/design/`                                          | every piece of the design system          |
| `/[workspace]/`                                     | the map of one workspace                  |
| `/[workspace]/value-flows/`                         | searchable work across areas              |
| `/[workspace]/areas/[area]/`                        | one authored entrance into its systems    |
| `/[workspace]/areas/[area]/map.json`                | an area's map, for the browser            |
| `/[workspace]/explorer/`                            | the service explorer                      |
| `/[workspace]/explorer/data/[file]`                 | the service explorer's data               |
| `/[workspace]/language/`                            | key terms and the words in the code       |
| `/[workspace]/people/`                              | the people who use the systems            |
| `/[workspace]/plans/`                               | every plan, to search and filter          |
| `/[workspace]/programmes/`                          | the programmes                            |
| `/[workspace]/programmes/[programme]/`              | one programme and its plans in order      |
| `/[workspace]/partners/`                            | the partners                              |
| `/[workspace]/partners/[team]/`                     | one partner (its team id without `team:`) |
| `/[workspace]/[domain]/`                            | one domain                                |
| `/[workspace]/[domain]/plans/`                      | the plans that reach one domain           |
| `/[workspace]/[domain]/flows/`                      | one domain's flows                        |
| `/[workspace]/[domain]/flows/[flow]/`               | one domain, with one flow open            |
| `/[workspace]/[domain]/map/`                        | one domain's map                          |
| `/[workspace]/[domain]/language/`                   | one domain's words                        |
| `/[workspace]/[domain]/interfaces/`                 | one domain's interfaces                   |
| `/[workspace]/[domain]/target/`                     | one domain's target architecture          |
| `/[workspace]/[domain]/[system]/`                   | one system                                |
| `/[workspace]/[domain]/[system]/flows/[flow]/`      | one system, with one flow open            |
| `/[workspace]/journeys/`                            | the journeys through the systems          |
| `/[workspace]/journeys/[key]/`                      | one journey, walked step by step          |
| `/[workspace]/reference/`                           | the kinds of thing the systems hold       |
| `/[workspace]/reference/[kind]/`                    | the catalogue of one kind                 |
| `/[workspace]/things/?id=<token>`                   | one thing as it runs today                |
| `/[workspace]/model.json`                           | the workspace today, for the browser      |
| `/[workspace]/assets/[...file]`                     | the workspace's images                    |
| `/[workspace]/plans/[plan]/`                        | a plan's cover                            |
| `/[workspace]/plans/[plan]/[chapter]/[screen]/`     | one screen of a plan                      |
| `/[workspace]/plans/[plan]/things/?id=<token>`      | one thing of a plan, as a page            |
| `/[workspace]/plans/[plan]/plan.json`               | the checked plan, for the browser         |
| `/[workspace]/plans/[plan]/revisions/[v]/plan.json` | an earlier version, for the browser       |
| `/[workspace]/plans/[plan]/assets/[...file]`        | a plan's diagrams and images              |
| `/[workspace]/plans/[plan]/mockups/[...file]`       | a plan's mockup pages                     |
| `/explorer-data/[workspace]/[generation]/[file]`    | the service explorer's evidence           |

A domain page and a system page are each a layout, and each flow through them is a page under it, so a domain
can run hundreds of flows: the page carries only the flow being read, and choosing another fetches just that
flow. The flow's address is its id without `flow:`. The domain's layout sits in the route group `(overview)` so
it does not wrap its systems' pages. A system page puts its plans first, and always shows the section: with none,
it says so and invites the reader to ask the agent for the first. A domain's overview leaves plans to its Plans
page. Their flows are a searchable list, and
only user journeys are cards, at most six, with a link to them all. That link is the journeys index, which lists every journey
and flow as one line, to be narrowed by words or by domain, never as cards. The sidebar counts every journey but names only
the key ones, and the one being read.

The sidebar has two shapes. Across the workspace it reads in three sections: Overview (the landscape, opening to
its map, language and people, the plans, then the programmes and the partners, each only when the workspace has
some), Domains (one link each, counting its systems) and Look up (the
journeys and the reference); `src/application/workspace-nav.ts` builds it. Inside a domain, on its pages and its
systems' pages, the sidebar steps into the domain (`src/application/domain-nav.ts`): a link back to the
workspace, the domain's name, its pages (overview, plans, flows, map, language, interfaces; the domain page has no
tabs), then its systems. The system being read opens to the sections of its page, each an anchor, in the page's
order: plans, map, edges, flows, components, data, user journeys and code. `RailSpy`
(`src/ui/nav-rail-spy.client.tsx`) marks the section being read as the page scrolls.

A system page puts what it is for and how it fits before what it is made of: the drawing and its edges come before
its components, and its code comes last. Each component card says what the component does and folds the rest
(the endpoints it answers, what it calls, listens to and keeps) behind a line of counts. Neighbours in the same
domain never repeat the domain's name, on the edges or the map.

A domain's Map is the one drawing of how its systems fit; its overview no longer draws them. A domain can hold
hundreds of parts, so when its story names no stages the map reads system by system
(`src/application/plan-viz-system-map-columns.ts`): each system sits in the column of its tier, and opens folded
to one card. A folded card names the system, says what it does, and ends with
its team and its size (`17 components`); it lists no components, because a system can hold too many. A system in
the domain never repeats the domain's name. Systems of other domains never mix with the domain's own: they sit in
a band ruled off beneath them (`src/application/plan-viz-system-map-outside.ts`), each under the column of its tier
so its lines stay short, grouped under the name of its domain. The toolbar
switches between Overview and All components and filters the lines (calls, events, data); the reader can also unfold one
system to see its parts. A system's own page keeps a column per step.

Each column of a domain's map is one tier, read left to right the way a request travels
(`plan-viz-system-map-roles.ts`): Channels, Gateway, Forward-facing, Back end and Upstream sources. A person may
put a system in a tier with `tier:` in its system.yaml; otherwise the model implies it
(`plan-viz-system-map-tiers.ts`): the system holding a graph's gateway is the gateway, a system serving one of its
subgraphs is forward-facing, a system nothing else on the map calls or tells, but which calls out, is a channel, and
the rest are back end. An outside party (an external component) that only its own system talks to stays inside
that system, as one of its details; one that several systems talk to stands on its own in Upstream sources, as a
one-line card (`sharedOutside`, in `plan-viz-system-map-columns.ts`). The gateway is drawn asking every subgraph it composes, even where no flow walks
that call, so the fan-out reads at a glance. Empty tiers draw no column.
A map read by tier draws one line for each pair of cards (`plan-viz-system-map-merge.ts`), from the one that needs
the data to the one that has it: a caller to what it calls, a listener to who tells it, a reader to the store. The
columns sit wide apart so each line can carry a short tag at its arrow naming the data it carries (`Product +2`):
the schema each call answers with, else its interface, and each event by name (`carries`, in
`plan-viz-system-map-input.ts`). Its tip lists every one, with how many calls. At rest the lines are faint and untagged, so the map shows only who talks to
whom; pointing at a card traces its lines and shows their tags. Clicking a component opens it in the inspector, which
lists the systems it gets data from and gives data to, and the map keeps that card traced until another is opened
(`use-system-map.ts` follows the inspector's open id). A component marked `infrastructure: true` in its
system.yaml (feature flags, sign-in, error tracking) is plumbing no business data comes from, so the map leaves it
and its lines out until the reader presses Infrastructure (`plan-viz-system-map-infra.ts`).

Each domain tab draws its own header (`DomainTab`, in `domain-page.tsx`): the tab's name as the title, under the
domain in the trail, and a line on how to read it. The overview alone keeps the domain's name, purpose, numbers and
teams (`DomainHeader`), so the map, flows and other tabs start straight away. Each flow read beside the list is
titled with its name.

`plans`, `things`, `assets`, `journeys`, `reference`, `language`, `people`, `areas`, `programmes`, `partners` and
`impact` are reserved and cannot be domain ids, `flows` cannot be
a system id, and `assets`,
`mockups`, `things` and `revisions` cannot be
chapters. Screens render on the server. The step, lens and open inspector live in the URL; the server reads the
lens, and the browser the rest. Entity chips render as
`<button data-inspect="id">`; one client inspector catches clicks, fetches `plan.json` once (by a relative URL,
so it works under any base path) and works out the rest in the browser, so no page inlines the plan.

Outside any plan, the journeys and reference teach the systems as they run today, drawn from the model of
today. A journey's key is a user journey's id (`uj-…`) or a flow group's key from `journeyGroups`; its walk is the
plan's, with the arrow keys, steady layout and remembered sections, but as-is only: no `?mode`, no `d` toggle, no
comparison or rollout notes. The reference lists only the kinds with entries and shows each catalogue with no
`?show` modes and no status.

A thing's page answers what a reader looking something up needs next. An endpoint or message with handlers says
what happens when it is called or arrives (`src/application/today-handler.ts`, drawn by `handler-story.tsx`): the
systems and stores it reaches, then each step in order with its forks, loops, retries and failures, each call
opening to what the callee does in turn, four deep, stopping at a handler already shown. A store lists what it holds
(`today-store.ts`): a database its tables, each opening to its columns; a topic its messages, with what each carries,
who announces it and who hears it. The palette names the system each thing belongs to and finds an endpoint by its
method and path, so "price cart v5" finds it.

A plan that fails to load or has errors still gets its cover, which shows `PlanErrors`: each error and warning
with its path, and the way back to the workspace. Its other screens are not drawn, and the workspace's lists leave
it out until it is fixed; its `plan.json` holds only `{ errors }`.

Every thing the inspector can show, except the parts of one (fields, steps and regions), also has its own page at
`things/?id=<token>` (`thingAt`). That is one route per plan, and one per workspace, not one per thing: the server
reads `?id=` and draws the thing. It shows the same body as the inspector, with the others of its kind down the side,
the pager and keys stepping through them, Copy link and the today / with-this-plan switch. The inspector's bar
links to it with Open as page; a system opened read today links to its own system page instead (`Reader.pages`, from
`systemPagesOf`). The inspector shows a system's neighbours (Gets data from, Gives data to), parts, stores and flows
(`systemGroups`), naming at most six of each. Read today, the thing page draws the code evidence on the server; it
is kept out of `model.json` because every page fetches that.

The workspace's own pages read today, outside any plan. They fetch `/<workspace>/model.json`, the system model
as a plan-shaped document with no work and so no status, and pass the inspector, palette, hover cards and keys a
`Reader` (`todayReaderOf`): where the model is, where the thing page lives (`/<workspace>/things/`) and what images
resolve against (`/<workspace>/`, so `assets/x.svg` is served from the workspace's `assets/`). A plan builds its
own `Reader` with `planReaderOf`. A layout that wraps pages at several depths (a domain's overview and its map, a
system and its flows) leaves the depth out of `TodayOverlays`, and `TodayReaders` reads it from the open address.
Read today, there is no today / with-this-plan switch, no versions, no
status and no "in this plan"; a thing's page there also says where it sits (domain › system › component), what it
works with, the flows it takes part in and the code that says so, with who said it and the commit.

The team lens is the search parameter `?team=<id>` (with or without the `team:` prefix), and the catalogues'
mode is `?show=asis|tobe|diff`. A page whose words change with the team is drawn by the server for the team in
the address: Your part (`/cover/part/`) and the test pyramid read `lens` from `BodyProps` (`lensTeam` names the
plan team), so changing the lens (`useSetLens`) asks for the page again. A cut that only hides or dims what is
drawn for everyone stays in the browser, so it needs no new page: `DimByLens` dims the other teams' rows, and a
small client component reads `?show=` and shows that mode. The reference catalogues carry each row's
words and teams in `data-search` and `data-teams`, and one filter hides what the lens and the search box leave out.
While a lens is on, `LensCarry` adds `?team=` to a click on a link to another screen of a plan, so the cut follows
the reader; the `j` and `k` keys do not carry it. While a lens is on, `RailCut` hides the rail's screens that are
not the team's (`teamPages`: what it owns, changes, tests, builds or decides; the cover, the why, the reference
and each chapter's first screen stay), and the progress strip above each screen says where it falls in the team's
pages, with Read the full plan to turn the lens off. Without a lens the strip shows the chapter and screen, and the
step a walk stands on (`walkHere`).

The open thing is the hash `#i-<token>`, where the token is the id with `:` and `#` written `-` and `.`
(`svc:orders` is `#i-svc-orders`). Each open or hop pushes a history entry, so Back steps through what was seen and
Close returns to the page; an address pasted cold is adopted as one entry.

Keys are one table in `features/plan/keys.ts` (`keyAction`, and `SHORTCUTS` for the cheat sheet); `PlanKeys` in
`keys.client.tsx` acts on them, and nothing fires while typing in a field. `j` or `→` next screen or walk step,
`k` or `←` previous, `J` and `K` the next and previous chapter, `/` or `⌘K` the palette, `⌘⇧P` the plan switcher,
`T` the next theme, `D` the next view (a walk between today and the plan, or a reference page's radios marked
`data-cycle`), `?` the cheat sheet of keys and symbols, and `Esc` closes whatever is on top. With a dialog open only
`?` passes. Holding `⌥` on a What changes screen fades the plan's new parts (`data-status="added"`) to show today;
the screen's own Show today toggle does the same until pressed again. The plan's bar shows where it stands, a menu
of its versions, a Read as picker that sets `?team=`, search and help; below 56rem those fold behind a More button.

Each history entry carries the trail of ids opened before it, so the inspector's bar shows the last three as
crumbs, and a crumb goes back that many entries. Copy link copies the address, hash and all. A thing that changes
has a switch between today and with this plan; it is client state, starts on the plan, and is not in the address.
Plan-level things (decisions, risks, questions, work items, milestones, changes, tests and scenarios) have no
today and no switch. A flow draws as a sequence, a work item shows its work card and, unless a partner owns it,
its GitHub issue (title, state from the latest GitHub event in `progress.yaml`, link and the text to file), and an As at picker under the bar opens the thing as it stood in an
earlier version kept in the ledger, from `revisions/<v>/plan.json`. While the inspector is open
every `[data-inspect]` for the open id outside it carries `data-picked`, and on a window at least `72rem` wide the
page narrows by `--inspector-w` so the panel does not cover it. Resting the pointer on a `[data-inspect]` for
280ms, or giving it keyboard focus for 120ms, shows a hover card (type, status, team, what the plan does to it,
its gist); touch never shows one, and a scroll, click, `Esc` or leaving it hides it. The card is `aria-hidden`:
the thing's own name is what assistive tech reads. Anything inside `[data-no-hover]` (the inspector's header)
shows no card.

Walking a flow as it runs today, a step the plan revisits shows `◇ Changes ahead` (`PinAhead`), and reading it
pins what the step carries that the plan changes. Pins are kept per plan in `localStorage` under
`groundwork:ahead:<workspace>/<plan>`, so they outlast a reload. `ChangesAhead`, among the plan's overlays, shows
them as a pill in the corner and a tray listing each with a link to the screen of chapter 4 that draws it
(`aheadStop`, else the ledger). A pin is ticked off once that screen is read; `Esc` or a click outside closes the
tray.

A scenario screen in the journey is a walk: every step of every flow the scenario passes through, in order. It
draws in the browser from `plan.json`. The place on the walk is `?step=<flow or step id>&mode=today|plan`, so a
step can be linked to. While a walk is on the page, `→` and `←` move one step, and leave for the next or previous
screen only at its ends; stepping back into a scenario opens it at its last step. The pager says "Next step" or
"Previous step" with the step's title until the walk's ends. `d` switches between today and
the plan. Disclosures marked `data-keep` and the flow's diagram or sequence view keep the reader's choice across
steps and screens for the session, and the page holds its height and scroll while stepping, so what the reader
is watching stays where it is.

Other screens read in stops keep the stop in `?stop=<key>`: the system map and graph stages on Today, the walk
behind each journey screen, the tabs of the changes screens (flows, screens, versioned interfaces, records, and
the ledger's `component` and `team` groupings), and the Reference's events, where the first stop `all` shows every
line closed and each later stop, `?stop=<event id>`, opens one event's line and brings it into view.
The keys work the same way: `→` and `←` move a stop and leave the screen only at the ends, and stepping back into
a screen opens it at its last stop. While stops are on the page, the pager offers "Next step" or "Previous step"
with the stop's title instead of the next screen. The system map and the build-order graph draw at reading size
and scroll sideways in the page, and the map's stage pills scroll to each stage; full screen still zooms and pans.

The Reference's risk grid filters its register: a click on a cell with risks shows only the risks in it, with
"n of m risks" and a "Clear filter" button, and a second click on the cell clears it. The filter lives in the page,
not the address.

Plan assets and mockups are served by route handlers from the workspace's `plans/<slug>/`, not copied into
`public/`: there is one source, and the URLs mirror the folder layout, so a mockup's `../assets/x.svg` still
resolves. File segments and plan slugs cannot escape the selected folder, including through file or directory
symlinks. Links to files within that same folder remain supported. These checks assume workspace files are
maintained by trusted local writers; they are not an atomic filesystem sandbox against concurrent hostile writes.

## Layers

```
app ──▶ features ──▶ ui
 │         │
 │         ▼
 ├────▶ application ──▶ domain ──▶ shared
 │         ▲
 └────▶ infrastructure
tools ──▶ scan ──▶ infrastructure, application, domain, shared
```

| Folder                                     | Holds                                                                                | May import                                        | Packages                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------- |
| `src/domain`                               | The model's types and rules                                                          | shared                                            | none                                  |
| `src/application`                          | What the app works out from the model: use cases, view models                        | domain, shared                                    | none                                  |
| `src/infrastructure`                       | Reading the world: files, YAML (checked with zod), git, GitHub. Server only          | domain, application, shared                       | `node:*`, yaml, zod, ajv, server-only |
| `src/infrastructure/scan`, `scan-explorer` | Reading source repos into evidence. Run by tools, never by a page                    | infrastructure, application, domain, shared       | as infrastructure, plus typescript    |
| `src/features/<name>`                      | The screens of one feature, in React                                                 | application, domain, ui, shared                   | react, next                           |
| `src/ui`                                   | The design system. Knows nothing of the model                                        | shared                                            | react, next                           |
| `src/shared`                               | Small pure helpers (text, dates, collections)                                        | nothing                                           | none                                  |
| `src/app`                                  | Next.js routes: load with infrastructure, compute with application, render a feature | all of the above                                  | react, next                           |
| `tools`                                    | Command-line tools                                                                   | scan, infrastructure, application, domain, shared | `node:*`, yaml                        |

- Features are reached only through their `index.ts`, and an `index.ts` only re-exports by name
  (`export { x } from`): no code, no `export *`. A feature never imports another feature; move what they
  share to `ui`, `application` or `shared`.
- `domain`, `application` and `shared` are pure: the same input gives the same answer. They do not read the
  clock (`new Date()`, `Date.now()`), roll dice (`Math.random()`) or touch the world (`window`, `document`,
  `fetch`, `process`, timers…). The caller passes today in.
- Every file in `src/infrastructure` imports `server-only`. Only `src/infrastructure/workspace-folders.ts`,
  tools and configs read `process.env`.
- The site reads the disk, and makes paths to it, only through `src/infrastructure/disk.ts`: nothing else
  outside `scan` imports `node:fs` or calls `path.join` or `path.resolve` (use `pathIn` and `resolvedFrom`).
  Which folder a page reads is known only on request, so each read and join there carries
  `/* turbopackIgnore: true */`. The build reads an unmarked join as a file to ship with the page and traces
  every file in the checkout it could match, scan reports included, which took tens of minutes and gigabytes
  of memory.
  Bounded reads check the open file and cap the bytes read, including when a file grows after its size check.
  A replaced final symlink is not followed; missing files alone return null, and other disk errors propagate.
- The scanner (`src/infrastructure/scan`, `scan-explorer`) is its own layer: tools run it, and no page, feature
  or site reader may import it, so its parsers and the TypeScript compiler never reach the site's bundle or its
  build trace. What a page needs from a scan (the explorer's published files) is read by site infrastructure
  (`explorer-assets.ts`, `service-explorer-files.ts`).
- Group code by behaviour and responsibility. There is no file-count ceiling: a cohesive folder may grow.
  Keep private helpers with the code they explain. Extract a module when it has an independent responsibility,
  real reuse or a useful test boundary, not merely to reduce a line count.
- No junk-drawer names: no file called `utils`, `helpers`, `common`, `misc`, `lib`, `core`, `manager`…
- `src/app` contains only Next.js route files (`page`, `layout`, `not-found`…) and `globals.css`.
- A file outside these folders is an error.
- Imports across folders use `@/`, never `../`.

## Next.js

- Drawn on request: the root layout awaits `connection()`, so no page is pre-built or cached and an edit to the
  YAML shows on the next load. No `'use server'` (the site only reads), and no route segment options that cache
  or pre-build (`revalidate`, `fetchCache`, `dynamic`, `dynamicParams`, `generateStaticParams`):
  `groundwork/drawn-on-request` rejects them. An unknown id calls `notFound()`. A page reads the address through
  its `searchParams`, with `firstParam` and `paramOrNull` from `src/shared/search-params.ts`.
- Nothing from the pages router or that caches: no `next/cache`, `next/router`, `next/head`, `next/document`,
  `next/legacy/image` or `next/dist/*`.
- A route file exports only what Next.js reads (`default`, `metadata`, `generateMetadata`, `viewport`, `GET`…)
  and types.
- Every page names itself for the tab (`groundwork/page-metadata`). Layouts set a title template
  (`%s · <workspace>`, `%s · <domain>`), so a page usually exports a fixed `metadata` title; a page about one
  named record uses `generateMetadata` with that record's name. A template does not reach the page beside its
  layout, so an index page exports an empty `metadata` and takes the layout's own title (the workspace, domain
  or system name).
- The React Compiler's checks are on, past its recommended set: no state derived in an effect, no hook
  factories, no `useMemo` without a value.
- Server components by default. A client component lives in `*.client.tsx` and starts with `'use client'`; the
  name shows the boundary at every import.
- Internal links use `next/link`. Styles are CSS modules. No `style` props: use a class or a data attribute.
  The root layout imports `globals.css` before styled components so its cascade-layer order is established
  before component layers; otherwise base button resets can override component padding.
- A component and its CSS module are a pair: `card.tsx` imports `./card.module.css` as `styles` and no other
  file imports it. Every `styles.x` must be a class in the module, and every class in the module must be used.
  Style state with data attributes, not dynamic class names.
- Only `src/app/layout.tsx` imports `globals.css`, which holds the design tokens. Stylelint rejects raw colours,
  sizes, spacing, radii and shadows anywhere else.

### The design system

`src/ui` decides how things look; a feature decides only where they go. Every piece has a specimen at
`/design/`, which says what it is for. When a feature needs something that is not there, add it to `src/ui`
with a specimen, rather than styling it in the feature.

- Words use `Text` and `TextLink` (tone, size, weight, mono, caps, clamp), not a feature's own `color` or
  `font-*`.
- Controls use `Button`, `SearchField`, `Select` and `FilterChips`, not a raw `<button>`, `<input>` or
  `<select>`. Rows of one kind use `List` and `ListItem`; tables use `DataTable`; progress uses `ProgressBar`.
- Common layouts use `Stack` (one under another), `Cluster` (side by side, wrapping) and `SplitView` (a long
  list with the picked thing open in a panel beside it), so most features need no CSS module at all.
- A feature's CSS module holds layout: `display`, grid, flex, gap, margins, padding, sizes and position. Colour,
  background, borders, radii, fonts, shadows, cursors and `::-webkit-*` styling belong in `src/ui`.

`npm run design:drift` holds the line while older features move across. It counts, per file in
`src/features`, the CSS declarations about looks and the raw controls, plus the rule bodies copied between
stylesheets, and fails if any count rises above `tools/design-drift.baseline.json`. When a count falls, run
`npm run design:drift -- --update` and commit the smaller baseline, so it cannot creep back.

### Speed

A page should feel instant. A page ships what it draws twice, as HTML and as the payload React hydrates from, so
drawing what the reader has not asked for costs every reader on every visit.

- One route per kind of record, not per record. A thing page reads `?id=` on the server and draws that thing.
- Draw what the address asks for. Do not hand a client component a drawing for every choice (every lens, team or
  tab); `groundwork/one-per-choice` rejects it. Read the choice on the server, or draw once and let the client
  hide or dim. Files still on the debt list in
  `eslint.config.mjs` come off it as they are fixed.
- Prefetch only what the reader reaches for. Use `IntentLink` for long lists of links; `next/link`'s
  `prefetch` prop is rejected by `groundwork/link-prefetch`.
- `npm run budget`, after a build, starts the built site, follows its links from the home page, and fails if any
  page weighs more than 1 MB; it lists the heaviest.

## Code

- TypeScript strict, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and
  `noUncheckedSideEffectImports`; typed lint rules
  (`strictTypeChecked`).
- No `as` casts outside tests: parse with zod at the edge, narrow everywhere else. No enums, namespaces or
  classes (except errors). Switches over unions are exhaustive.
- Named exports only, except where Next.js or a tool config needs a default.
- Keep control flow shallow: depth 3 and complexity 12 remain enforced. File length, function length, parameter,
  statement and import counts are review signals, not hard limits. Repeated strings alone do not justify an abstraction.
  Union members, error classes and JSX depth have no count limit either: splitting a complete model or a readable
  component solely to satisfy a number obscures its responsibility.
- kebab-case file names. Tests sit next to the code as `*.test.ts(x)`; component tests use jsdom.
- knip fails on unused files, exports and dependencies. Coverage of domain, application and shared stays at 90%.
- No `any`, written or inferred: type coverage outside tests is 100% (`npm run typecoverage`, strict), which
  also catches `any` leaking out of library types. `ts-reset.d.ts` closes the common leaks (`JSON.parse`,
  `.json()`, `Array.isArray`, `.filter(Boolean)`, storage, `Map`); narrow what is left to `unknown`. The one
  way out is `// type-coverage:ignore-next-line`, and an ignore that hides nothing fails.
- Tests must notice wrong code, not just run it. Mutation testing (Stryker) plants small bugs in the domain,
  application and shared files a pull request touches, and fails if fewer than 75% of them make a test fail.
  Touching an old file brings it under the bar too, so the score rises as the code is worked on.
- Data is read-only. Every property, index signature, array, tuple, `Map` and `Set` in a type, interface or
  parameter is `readonly` (`groundwork/readonly-types`, which fixes itself). Build new values with `map`,
  `filter`, spreads and `toSorted`; mutate only a local working variable you then return. Props are read-only.
- Exported functions in `.ts` files write their return type. Methods in types are written as properties.
- No escape hatches. Inline ESLint config is switched off (`noInlineConfig`), so `eslint-disable` does nothing
  and is itself an error; `@ts-ignore`, `@ts-expect-error` and `@ts-nocheck` are errors. To change a rule,
  change `eslint.config.mjs`, where it is reviewed.
- Clean code: no names that say nothing (`tmp`, `str`, `ret`, `val`, `res`, `cb`, `err`…), no `TODO` or
  `FIXME` comments, no commented-out code, no `else` after `return`, no `++`, no `for…in`, at most three
  operators in one condition. Components destructure their props in
  the signature, and handlers are named `handleX` and passed as `onX`.
- Comments and words on screen are in British English (`groundwork/british-spelling`: colour, behaviour,
  catalogue, organise…). Code names in `backticks` or "quotes" are left alone.
- Code is written once. jscpd (`npm run duplication`) fails if more than 0.5% of the lines outside tests are
  copied blocks of 70 tokens or more; ESLint's `sonarjs/no-identical-functions` catches copies within a file.
- Security: no `eval`, `new Function`, `innerHTML` and friends (`no-unsanitized`), `dangerouslySetInnerHTML`
  (except the theme script in the root layout), `javascript:` URLs, `target="_blank"` without `rel`, regexes
  built from strings, or regexes that backtrack super-linearly; every regex has the `u` flag. Child processes
  run with an argument list (`execFile`, `spawn`), never `exec` or `shell: true`. `no-secrets` rejects
  high-entropy strings. CodeQL (`security-extended`) scans every push, and CI fails on any production
  dependency advisory and on a critical one in development.
- Tests: no `.only` or `.skip`, no `expect` inside a condition, mocks are typed, React tests query through
  `screen`.

### Rules we chose not to turn on

Each was measured against the code. They cost more than they catch:

- `id-length`, `@typescript-eslint/no-magic-numbers`, `unicorn/prevent-abbreviations`,
  `explicit-function-return-type` on components: thousands of hits (5,300, 2,200 and 1,400) on short callback
  names, layout numbers, `props` and JSX return types, with nothing found. `prefer-destructuring` (100) and a
  200-line file limit (173 files) read no better for the churn.
- `security/detect-object-injection`: hundreds of false alarms on typed record lookups; `noUncheckedIndexedAccess`
  and the readonly types already guard them. `security/detect-unsafe-regex`: replaced by the more exact
  `regexp/no-super-linear-*`. `security/detect-non-literal-fs-filename`: the layers already confine `fs` to
  infrastructure.
- `noPropertyAccessFromIndexSignature`: 2,000+ hits of `record.key` that read better than `record['key']`.
- `react/no-multi-comp`, `react/jsx-props-no-spreading`: small private sub-components and prop pass-through
  are how the design system stays small.
- `sonarjs/assertions-in-tests`, `sonarjs/no-dead-store`, `sonarjs/no-redundant-assignments`: repeat
  `vitest/expect-expect` and `no-useless-assignment` at several times the cost. `sonarjs/aws-*` and
  `@typescript-eslint/no-unsafe-enum-assignment` cannot fire (no CDK code; enums are banned). Together these
  were a third of lint time.
- `testing-library/no-node-access` and `no-container`: the design system styles state with data attributes,
  which tests read off the nodes.

## Checks

| Command                             | Runs                                                                                         | When                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------- |
| `npm run lint:changed`              | ESLint on changed and new files, and the component behind any changed CSS module             | while working               |
| `npm test` / `npm run test:changed` | unit, integration and scanner tests (all, or those touched by changes)                       | while working               |
| `npm run mutate:changed`            | mutation tests of the changed pure-layer files (`--base <ref>` to compare with a branch)     | while working, pull request |
| pre-commit hook                     | ESLint, Stylelint and Prettier on staged files, in parallel                                  | each commit                 |
| `npm run design:drift`              | fails if a feature styles looks or draws raw controls more than the baseline allows          | while working               |
| `npm run budget`                    | after a build, fails if any page of the running site weighs more than 1 MB                   | after a build, CI           |
| `npm run check:static`              | typecheck, type coverage, styles, design drift, format, cycles, duplication and knip         | part of `check`             |
| `npm run check`                     | `check:static`, lint, and all tests with coverage                                            | shared changes, pre-push    |
| CI                                  | `npm audit`, `check:static`, lint, tests and the build, as parallel jobs from cold           | every push and pull request |
| Mutation                            | `npm run mutate:changed` against the pull request's base; the report is attached to the run  | PRs touching pure layers    |
| CodeQL                              | `security-extended` queries over the TypeScript and the workflows                            | every push, PR and weekly   |
| Dependabot                          | grouped pull requests for npm and Actions bumps; security fixes as soon as an advisory lands | weekly                      |

`npm run mutate` runs every pure-layer file: about 50,000 mutants, hours of work. It keeps its results in
`reports/stryker-incremental.json` and reruns only what changed since. `patches/` fixes Stryker's Vitest runner
for Vitest 5 (stryker-js#6210); `npm ci` applies it, and fails if the runner is bumped, until the patch is
dropped or remade.

ESLint, Stylelint, Prettier and `tsc` keep caches in `node_modules/.cache`, so a rerun only rechecks what
changed. A cached lint can miss an error that a change in one file causes in another; `tsc`, the pre-push check
and CI catch it. Import cycles are checked by dpdm rather than `import/no-cycle`, which walks the whole graph for
every file.

Full ESLint runs are uncached: type-dependent rules and CSS-module checks can change without an edit to the
file being linted. Focused runs keep a content cache, but bypass it for CSS-module changes and check the whole
repository without it when lint policy, TypeScript configuration or dependencies change. Git paths are read
with NUL separators so spaces, non-ASCII names and embedded newlines remain intact; Git failures fail the check.
ESLint uses one worker to avoid building multiple copies of the typed project in memory.
Vitest runs unit test files in threads
rather than forks (the architecture tests need forks to `chdir`). Each file still gets its own module graph:
tests mock modules, so sharing one would leak mocks. Unit tests use four workers; integration tests use two,
with time for native compilers to start. Scanner and command-line tests have a separate `scanner` project and `test:scan` command; `test:web` runs
unit and site integration tests. Shared-logic changes still check related scanner tests. The projects run in
order, followed by architecture tests on one
worker. `check` runs static checks, lint and coverage in sequence so those workloads do not compete.

### Reference queries and freshness

`src/application/reference/` owns reference queries, headings and plan registers. Reference pages filter the
complete model on the server, then render thirty records at a time. Search, team, mode and page live in the URL;
full records open in the shared inspector. Scoped maps carry only the lookup records their drawing reaches.
Maps with more than twelve components open at system level; the Components control expands their details.

Labels belong to the model being rendered; deriving another workspace cannot change them. Server plan caches
refresh when workspace files change or the UTC date changes, so deadlines do not stay frozen overnight. Browser
model reads share pending requests, keep successful results for one minute and failed results for five seconds,
and retain at most twenty settled models.

### Focused development checks

Run `npm run check:begin` before editing. It records content hashes in a Git-ignored local cache; it neither
commits nor alters existing work. `npm run check:quick` compares with that checkpoint, including new and deleted
files, and checks formatting, lint, styles, types and related tests. It prints each check's elapsed time.
Alternatively pass specific files or folders: `npm run check:quick -- src/features/workspace/component-cards.tsx`.
The checkpoint is deliberately not advanced after a check. Use one task per checkout so concurrent edits cannot
be mistaken for the current task; independent worktrees have independent checkpoints.

UI-only checks use `tsconfig.web.json`, excluding scanner implementations and tests as root files. TypeScript
still follows imported dependencies. Shared logic and tooling use the full project and related scanner tests.
`npm run check` and the merge checks still cover the whole repository, including architecture and coverage.
Commits run the fast staged-file checks. Type checking and the full test suite, including integration, scanner
and architecture tests with coverage, remain mandatory before every push and in CI. Use focused checks while
editing; the successful pre-push `npm run check` counts as the full check for unchanged inputs. Avoid running
the same full suite immediately before that hook. For a local handover without a push, run `npm run check`
explicitly. Build and page-budget requirements remain separate.
Generated `docs/scan-trials/` and `artifacts/` outputs remain on disk and in Git where already tracked; source
formatting and task checkpoints exclude them. Maintained source, tests, schemas and ordinary documentation stay
in scope. A checkpoint is a development aid, never a substitute for the merge checks.

For local feature work, use the focused checks before handover. Shared logic, infrastructure, tooling and
configuration changes require the full check. Routes, server/client boundaries, dependencies and build
configuration also require a production build; rendering and data-loading changes require the page budget.
The intended warm feedback budget for a small UI edit is thirty seconds; measure it rather than assuming it.

### Model identities and code links

`src/domain/ids.ts` owns model id construction, prefix and child-path parsing, legacy address tokens and
alias resolution. `src/domain/code-links.ts` owns Git-host links and remote parsing. Callers pass structured
references rather than interpolate prefixes or Git-host paths. Existing citation styles remain explicit
arguments while legacy consumers migrate. `groundwork/identity-boundary` rejects direct prefix construction,
prefix stripping, child-path parsing and Git-host path construction elsewhere. Tests retain literal examples,
including deliberately invalid inputs and source snippets that prove the rule fires.

Standalone Node tools may import the pure domain modules through `#domain/*`, mapped by `package.json`
to `src/domain/*.ts`. This preserves direct `node tools/<tool>.ts` commands without requiring the app's
alias loader. The normal layer boundaries still apply to these imports.
