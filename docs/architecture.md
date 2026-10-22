# Architecture

Groundwork is a Next.js site built as static files. At build time it reads the YAML of each workspace, works out
what each page says, and renders it. Nothing runs on a server.

The layers below are enforced by `eslint.config.mjs`, and `test/architecture.test.ts` proves every rule still
fires. If a rule gets in the way, change the architecture on purpose, here and in the config, not with a
disable comment. Unused disable comments are errors.

## The model

A **workspace** holds **domains**. A domain holds **systems**. A system holds **components**. Plans live at
workspace level and may cross any domain. These four words are the only levels; one word per idea.

**Component** is the umbrella word for anything a system is built from. A component has a kind: a **service** (a
deployable microservice, worker or job), a **store** (a database), a **topic** (a queue or event stream), or a
user-facing app. Say "service" only when you mean that kind; say "component" when you mean any of them.

```
<workspace>/workspace.yaml            format, teams, the people (actors) who use the systems, and key journeys
  language.yaml                       the key terms the business has agreed on, anchored to the code
  domains/<domain>/domain.yaml
    language.yaml                     the domain's words: summary and concepts (system model)
    target.yaml                       where the domain is heading: its target architecture (people)
    systems/<system>/system.yaml      purpose, components and what they talk to
    systems/<system>/contracts.yaml   what its components offer and keep (system model)
    systems/<system>/handlers.yaml    what runs when its endpoints and messages are reached (system model)
  story.yaml                          summary and stages across domains (system model)
  flows/<flow>.yaml                   one flow per file (system model)
  journeys/<journey>.yaml             a user journey and its interactions (system model)
  assets/                             screen drawings cited by journeys
  scans/<org>/<repo>.yaml             the commit each repo was last read at, and how far it has moved since
  plans/<plan>/plan.yaml              revisions/, status.json, assets/, mockups/
schema/plan.schema.json               the plan format, checked with ajv (in Groundwork, not the workspace)
```

### Where workspaces are

A workspace is its own repo, holding both its model of today and its plans, so a plan and the model it rests on
share one history. Groundwork keeps one example in `workspaces/` (`personal`).
`src/infrastructure/workspace-folders.ts` is the only code that knows where workspaces are, and every reader asks
it for a workspace's folder by id:

- `GROUNDWORK_WORKSPACES`, when set, names the only workspace folders read (separated by `:`, or `;` on Windows).
  A company's build uses it so that its site carries no other workspace: `private: true` only keeps a workspace
  off the lists, and a static build holds every workspace it read.
- Otherwise the examples in `workspaces/`, and the workspaces `groundwork.local.yaml` lists. That file is
  git-ignored, one per checkout, so whoever clones Groundwork links the workspaces they want. An entry is a folder
  on this machine, or `repo: <url>` with an optional `folder:`, cloned into `.workspaces/<name>` (git-ignored)
  by `npm run workspace -- pull`; a listed repo that is not cloned yet is an error that says to pull.
  `bundled: false` leaves the examples out. Tests read no workspace on disk: they build Acme, a small typed
  fixture in `test/fixtures/acme/`, with `test/workspace-kit.ts` and `test/plan-kit.ts`, and write it to a temp
  folder when they test the readers.
- A listed folder without a `workspace.yaml`, two folders with one id, or a local file with unknown keys is an
  error, never skipped. A workspace's id is the `id` in its `workspace.yaml`, whatever its folder is called.

`npm run workspace -- new|add|pull|remove|check|list` makes a workspace repo, links one by folder or repo URL,
clones or fast-forwards the linked repos, stops reading one, reads one as the app does, and lists what is
registered (`tools/workspace.ts`); the `groundwork-workspace` skill walks people through it.
Registering links Groundwork's skills into the workspace repo, git-ignored there. The list is read once per
process, so restart `npm run dev` after registering; Next does not watch folders outside its checkout either.

### The system model

How the systems work today, beside the structure. Every entry is in plan shape (the same `$defs` as
`plan.schema.json`) plus `origin: extracted | seeded | curated`. Sources are `{repo, path, lines, commit,
symbol?}`; the permalink is derived, never stored (a bare `{url}` is still read, for docs and dashboards).
`contracts.yaml` holds a system's stores, interfaces, schemas, messages, screens, graphs, subgraphs and
operations, plus `components:` detail (kind, summary, sources) for components named in `system.yaml`. The
structure stays the source of a component's name, tech and what it does. `handlers.yaml`, beside it, holds the
system's handlers (`handlers:`), each a fact like any other; the model reads them into `SystemContracts.handlers`.

A system is a bounded context: one team and one language. A domain's `language.yaml` holds the words its systems
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
People write it; the scan never does. The domain's Target architecture tab draws it.

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
  and links to the index; it does not list them.
- A domain's Plans page, `/[workspace]/[domain]/plans/`, is the same index narrowed to the plans that reach the
  domain (`domainPlanRowsOf`), with no domain filter; each row names the other domains it also lands in.
- Plan types live in `src/domain/plan/`. `plan.generated.ts` is generated from `schema/plan.schema.json` by
  `npm run generate`; a test fails if it is stale. Generated files are exempt from size limits only.
- Everything worked out from a plan (the derived layer: graph, journeys, impact, delivery, diffs) lives in
  `src/application/plan/`. It is pure, so the same code runs at build time and in the browser.
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
    `base.lock.json` fingerprints what an open plan's `modify`, `remove` and `after` ops target; when today moves
    under them, the cover names the drift. `npm run plan:base -- check <plan>` validates and writes the lock;
    `-- land <plan>` writes `base.yaml` and drops the lock. `src/infrastructure/plan-base-store.ts` loads both.
- `src/infrastructure/plan-store.ts` reads plans, revisions and status onto their base, and validates them against
  the schema.
- The plan viewer is one feature, `src/features/plan/`, with subfolders per chapter. Charts that know the model
  stay in the feature; `ui` stays model-agnostic.

### Routes

| Route                                               | Page                                 |
| --------------------------------------------------- | ------------------------------------ |
| `/`                                                 | the workspaces                       |
| `/design/`                                          | every piece of the design system     |
| `/[workspace]/`                                     | the map of one workspace             |
| `/[workspace]/language/`                            | key terms and the words in the code  |
| `/[workspace]/people/`                              | the people who use the systems       |
| `/[workspace]/plans/`                               | every plan, to search and filter     |
| `/[workspace]/[domain]/`                            | one domain                           |
| `/[workspace]/[domain]/target/`                     | one domain's target architecture     |
| `/[workspace]/[domain]/flows/[flow]/`               | one domain, with one flow open       |
| `/[workspace]/[domain]/[system]/`                   | one system                           |
| `/[workspace]/[domain]/[system]/flows/[flow]/`      | one system, with one flow open       |
| `/[workspace]/journeys/`                            | the journeys through the systems     |
| `/[workspace]/journeys/[key]/`                      | one journey, walked step by step     |
| `/[workspace]/reference/`                           | the kinds of thing the systems hold  |
| `/[workspace]/reference/[kind]/`                    | the catalogue of one kind            |
| `/[workspace]/things/?id=<token>`                   | one thing as it runs today           |
| `/[workspace]/model.json`                           | the workspace today, for the browser |
| `/[workspace]/attribution.json`                     | who said each fact, for thing pages  |
| `/[workspace]/assets/[...file]`                     | the workspace's images               |
| `/[workspace]/plans/[plan]/`                        | a plan's cover                       |
| `/[workspace]/plans/[plan]/[chapter]/[screen]/`     | one screen of a plan                 |
| `/[workspace]/plans/[plan]/things/?id=<token>`      | one thing of a plan, as a page       |
| `/[workspace]/plans/[plan]/plan.json`               | the checked plan, for the browser    |
| `/[workspace]/plans/[plan]/revisions/[v]/plan.json` | an earlier version, for the browser  |
| `/[workspace]/plans/[plan]/assets/[...file]`        | a plan's diagrams and images         |
| `/[workspace]/plans/[plan]/mockups/[...file]`       | a plan's mockup pages                |

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
its map, language and people, and the plans), Domains (one link each, counting its systems) and Look up (the
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
its team and its size (`10 parts · 7 stores`); it lists no parts, because a system can hold too many. A system in
the domain never repeats the domain's name. Systems of other domains never mix with the domain's own: they sit in
a band ruled off beneath them (`src/application/plan-viz-system-map-outside.ts`), each under the column of its tier
so its lines stay short, grouped under the name of its domain. The toolbar
switches between Systems and Components and filters the lines (calls, events, data); the reader can also unfold one
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
whom; pointing at a card traces its lines and shows their tags. Clicking a card opens it in the inspector, which
lists the systems it gets data from and gives data to, and the map keeps that card traced until another is opened
(`use-system-map.ts` follows the inspector's open id). A component marked `infrastructure: true` in its
system.yaml (feature flags, sign-in, error tracking) is plumbing no business data comes from, so the map leaves it
and its lines out until the reader presses Infrastructure (`plan-viz-system-map-infra.ts`).

Each domain tab draws its own header (`DomainTab`, in `domain-page.tsx`): the tab's name as the title, under the
domain in the trail, and a line on how to read it. The overview alone keeps the domain's name, purpose, numbers and
teams (`DomainHeader`), so the map, flows and other tabs start straight away. Each flow read beside the list is
titled with its name.

`plans`, `things`, `assets`, `journeys`, `reference`, `language` and `people` are reserved and cannot be domain ids, `flows` cannot be
a system id, and `assets`,
`mockups`, `things` and `revisions` cannot be
chapters. Screens render on the server. The step, lens and open inspector are client state in the URL. Entity chips render as
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
with its path, and the way back to the workspace. Its other screens are not built, and the workspace's lists leave
it out until it is fixed; its `plan.json` holds only `{ errors }`.

Every thing the inspector can show, except the parts of one (fields, steps and regions), also has its own page at
`things/?id=<token>` (`thingAt`). That is one page per plan, and one per workspace, not one per thing: the build
draws the shell, and the browser reads `?id=`, takes the model it fetches anyway and draws the thing, so the export
does not grow with the model. It shows the same body as the inspector, with the others of its kind down the side,
the pager and keys stepping through them, Copy link and the today / with-this-plan switch. The inspector's bar
links to it with Open as page; a system opened read today links to its own system page instead (`Reader.pages`, from
`systemPagesOf`). The inspector shows a system's neighbours (Gets data from, Gives data to), parts, stores and flows
(`systemGroups`), naming at most six of each. Read today, the code evidence comes from `attribution.json`, kept out of
`model.json` because every page fetches that.

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
mode is `?show=asis|tobe|diff`. A static export has one file per route, so each page is built once for everyone
(the lens off, the diff mode) and a small client component, wrapped in `<Suspense>`, reads the search and shows the
cut. `ByLens` holds one render for each team and picks one, which is how Your part (`/cover/part/`) becomes a page
per team; `DimByLens` draws a page once and dims the other teams' rows. The reference catalogues carry each row's
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
today and no switch. A flow draws as a sequence, a work item shows its GitHub issue (title, state from
`status.json`, link and the text to file), and an As at picker under the bar opens the thing as it stood in an
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

Plan assets and mockups are served by static route handlers from the workspace's `plans/<slug>/`, not copied into
`public/`: there is one source, and the URLs mirror the folder layout, so a mockup's `../assets/x.svg` still
resolves.

## Layers

```
app ──▶ features ──▶ ui
 │         │
 │         ▼
 ├────▶ application ──▶ domain ──▶ shared
 │         ▲
 └────▶ infrastructure
tools ──▶ infrastructure, application, domain, shared
```

| Folder                | Holds                                                                                | May import                                  | Packages                              |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------- |
| `src/domain`          | The model's types and rules                                                          | shared                                      | none                                  |
| `src/application`     | What the app works out from the model: use cases, view models                        | domain, shared                              | none                                  |
| `src/infrastructure`  | Reading the world: files, YAML (checked with zod), git, GitHub. Server only          | domain, application, shared                 | `node:*`, yaml, zod, ajv, server-only |
| `src/features/<name>` | The screens of one feature, in React                                                 | application, domain, ui, shared             | react, next                           |
| `src/ui`              | The design system. Knows nothing of the model                                        | shared                                      | react, next                           |
| `src/shared`          | Small pure helpers (text, dates, collections)                                        | nothing                                     | none                                  |
| `src/app`             | Next.js routes: load with infrastructure, compute with application, render a feature | all of the above                            | react, next                           |
| `tools`               | Command-line tools                                                                   | infrastructure, application, domain, shared | `node:*`, yaml                        |

- Features are reached only through their `index.ts`, and an `index.ts` only re-exports by name
  (`export { x } from`): no code, no `export *`. A feature never imports another feature; move what they
  share to `ui`, `application` or `shared`.
- `domain`, `application` and `shared` are pure: the same input gives the same answer. They do not read the
  clock (`new Date()`, `Date.now()`), roll dice (`Math.random()`) or touch the world (`window`, `document`,
  `fetch`, `process`, timers…). The caller passes today in.
- Every file in `src/infrastructure` imports `server-only`. Only `src/infrastructure/workspace-folders.ts`,
  tools and configs read `process.env`.
- No junk-drawer names: no file called `utils`, `helpers`, `common`, `misc`, `lib`, `core`, `manager`…
- `src/app` contains only Next.js route files (`page`, `layout`, `not-found`…) and `globals.css`.
- A file outside these folders is an error.
- Imports across folders use `@/`, never `../`.

## Next.js

- Static export only: no `'use server'`, no `revalidate`, no dynamic rendering. Nothing that needs a server or
  the pages router: no `next/headers`, `next/server`, `next/cache`, `next/router`, `next/head`,
  `next/document`, `next/legacy/image` or `next/dist/*`.
- A route file exports only what Next.js reads (`default`, `metadata`, `generateMetadata`,
  `generateStaticParams`, `viewport`…) and types.
- Server components by default. A client component lives in `*.client.tsx` and starts with `'use client'`; the
  name shows the boundary at every import.
- Internal links use `next/link`. Styles are CSS modules. No `style` props: use a class or a data attribute.
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

A page should feel instant. A static page ships what it draws twice, as HTML and as the payload React hydrates
from, so drawing what the reader has not asked for costs every reader on every visit.

- One page per kind of record, not per record. A thing page reads `?id=` and draws from `plan.json` or
  `model.json` in the browser, so a plan with a thousand things still exports one page.
- Draw once, and let the client change what it shows. Do not hand a client component a drawing for every
  choice (every lens, team or tab); `groundwork/one-per-choice` rejects it. Files still on the debt list in
  `eslint.config.mjs` come off it as they are fixed.
- Prefetch only what the reader reaches for. Use `IntentLink` for long lists of links; `next/link`'s
  `prefetch` prop is rejected by `groundwork/link-prefetch`.
- A route whose list can be empty (no plans, no pictures) uses `orNothing` from `src/shared/static-params.ts`,
  because a static export refuses a route that lists no addresses.
- `npm run budget`, after a build, fails if any exported page weighs more than 1 MB and lists the heaviest.

## Code

- TypeScript strict, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and
  `noUncheckedSideEffectImports`; typed lint rules
  (`strictTypeChecked`).
- No `as` casts outside tests: parse with zod at the edge, narrow everywhere else. No enums, namespaces or
  classes (except errors). Switches over unions are exhaustive.
- Named exports only, except where Next.js or a tool config needs a default.
- Small pieces: 300 lines a file, 60 a function (120 for a component), 3 parameters, depth 3, complexity 12.
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
  operators in one condition, at most 15 imports of values per file. Components destructure their props in
  the signature, and handlers are named `handleX` and passed as `onX`.
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

- `id-length`, `@typescript-eslint/no-magic-numbers`, `explicit-function-return-type` on components: thousands
  of hits on short loop names, layout numbers and JSX return types, with nothing found.
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

| Command                             | Runs                                                                                              | When                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------- |
| `npm run lint:changed`              | ESLint on changed and new files, and the component behind any changed CSS module                  | while working               |
| `npm test` / `npm run test:changed` | unit tests (all, or those touched by changes)                                                     | while working               |
| `npm run mutate:changed`            | mutation tests of the changed pure-layer files (`--base <ref>` to compare with a branch)          | while working, pull request |
| pre-commit hook                     | ESLint, Stylelint and Prettier on staged files, `tsc`, and the tests related to them, in parallel | each commit                 |
| `npm run design:drift`              | fails if a feature styles looks or draws raw controls more than the baseline allows               | while working               |
| `npm run budget`                    | after a build, fails if any exported page weighs more than 1 MB                                   | after a build, CI           |
| `npm run check:static`              | typecheck, type coverage, styles, design drift, format, cycles and knip                           | part of `check`             |
| `npm run check`                     | `check:static`, lint, and all tests with coverage                                                 | pre-push hook               |
| CI                                  | `npm audit`, `check:static`, lint, tests and the build, as parallel jobs from cold                | every push and pull request |
| Mutation                            | `npm run mutate:changed` against the pull request's base; the report is attached to the run       | PRs touching pure layers    |
| CodeQL                              | `security-extended` queries over the TypeScript and the workflows                                 | every push, PR and weekly   |
| Dependabot                          | grouped pull requests for npm and Actions bumps; security fixes as soon as an advisory lands      | weekly                      |

`npm run mutate` runs every pure-layer file: about 50,000 mutants, hours of work. It keeps its results in
`reports/stryker-incremental.json` and reruns only what changed since. `patches/` fixes Stryker's Vitest runner
for Vitest 5 (stryker-js#6210); `npm ci` applies it, and fails if the runner is bumped, until the patch is
dropped or remade.

ESLint, Stylelint, Prettier and `tsc` keep caches in `node_modules/.cache`, so a rerun only rechecks what
changed. A cached lint can miss an error that a change in one file causes in another; `tsc`, the pre-push check
and CI catch it. Import cycles are checked by dpdm rather than `import/no-cycle`, which walks the whole graph for
every file.

For speed, ESLint lints across all cores (`--concurrency auto`) and Vitest runs unit test files in threads
rather than forks (the architecture tests need forks to `chdir`). Each file still gets its own module graph:
tests mock modules, so sharing one would leak mocks.
