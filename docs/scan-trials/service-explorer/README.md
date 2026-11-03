# Service explorer

A bounded read model connects scan evidence to the application without loading an entire source graph.
The primary route is purpose → entry → branch or effect → dependency, storage or asynchronous boundary →
schema → pinned source. Technical component identity stays independent of teams and grouping.

## Contracts and queries

`src/application/scan-explorer` reads immutable canonical snapshots and current `scan/v1` query publications.
Current inputs require a source-declared runtime binding, repository pin, selected records and coverage.
Service overview, entry flow, data inspection, implementation candidates and reverse caller queries return
bounded pages, source links, snapshot, omissions and continuation information. Source reachability does
not establish runtime execution. Polymorphic implementation candidates remain separate from exact calls.

Caller/provider correspondence requires target identity, method, path and compatible transport evidence.
Retained caller-built payloads and provider contracts remain distinct. Missing configuration, multiple
matches and version mismatches remain candidate or unresolved relationships. Similar service names never
establish a confirmed connection.

`tools/scan-service-explorer-export.ts` converts validated evidence into the disposable visual format in
`src/domain/service-explorer.ts`. Its input selects evidence, runtime declarations and a snapshot-bound
interpretation sidecar. The exporter derives graph relationships from typed records, rather than inventing
a narrative sequence. It separates implementation frames and schema pages to keep each view readable.

## Publication and application

Publish a workspace's generated projection under `<workspace>/explorer/`:

- `manifest.json`: `service-explorer/v1`, workspace and snapshot identity, component entries, labelled
  inferred purpose, and the byte size and SHA-256 digest of every selected page.
- Flat JSON pages: `service-explorer-page/v1`, at most 64 KiB each, with typed nodes/edges, field structure,
  source links, coverage gaps and selected-evidence completeness.

`src/infrastructure/service-explorer-format.ts` validates the closed manifest and its file references.
`service-explorer-files.ts` verifies regular files, bounds, hashes, workspace and snapshot before serving
any page. The browser verifies the same selected page before drawing it. Nodes and links must reference
existing identities and delivered source anchors. Page targets must cross the manifest-selected loader.
No source expressions are evaluated.

The application route is `/<workspace>/explorer/`, linked as **Services** in workspace navigation. It serves
one HTML explorer per workspace plus static selected JSON artefacts. Keyboard-selectable SVG nodes reveal
source details and schema inspection; exact implementations and nested schemas open further frames.
Partial selections and runtime uncertainty remain visible. A workspace without a published projection
shows a missing-evidence state.

System component cards link directly to a published service when its identity matches unambiguously.
The service, selected frame and inspected node are encoded in the URL, so reloads and browser history
retain the exploration. Small entry catalogues are drawn inside their service boundary; relationships
outside that boundary keep the published evidence. The canvas supports pan, scroll and explicit zoom
without removing detail at smaller scales. Selecting a node opens its sources and neighbouring
connections; schema frames show fields and navigable referenced structures instead of an empty graph.

This projection is replaceable. It does not alter production workspace YAML, advance scan marks or claim
that the older canonical captures and current source records are the same storage contract. Tests exercise
actual page publication, tampering, graph reference validation and branch → storage → schema → source
navigation. Corpus launch eligibility and per-repository acceptance remain separate in the
[re-scan acceptance contract](../rescan-acceptance/README.md).

## Completed corpus publication

The full corpus uses `explorer/catalogue.json` to select one bounded repository manifest at a time.
Each manifest contains hash-bound artifact indexes, partitioned by page filename. The browser verifies
the selected manifest, index and page before rendering; it does not fetch the entire corpus graph.
Pages remain limited to 64 KiB, indexes to 2 MiB and the catalogue and each manifest to 256 KiB.
The earlier selected two-service publication remains a compatible fallback.

The completed corpus is the capture catalogue named by `<workspace>/evidence/evidence.yaml`.

```sh
npm run explorer:publish -- <workspace> <output-root>
npm run explorer:refine -- <workspace> <output-root/snapshot>
npm run explorer:repair-entries -- <workspace> <output-root/snapshot>
npm run explorer:pack -- <output-root/snapshot> <packed-output>
npm run explorer:install -- <packed-output>
```

Publication resumes completed repository checkpoints. It verifies selected capture and sidecar hashes,
reads framed source and programmes through the bounded decoder, and supports reviewed unframed legacy
programmes within their explicit 512 MiB limit. It does not restart extraction. Refinement adds a folder
browser for every captured inventory entry, bounded published navigation references and the reviewed inferred
context. Missing implementations and unsupported file types retain their pinned source and limitations.
These references are reconstructed from published visual frames. They are partial navigation aids, not an
exhaustive source-reference index or evidence of deployed caller/provider correspondence. An authoritative
relationship query must read an index derived directly from the scan records.

The compatibility repair joins entry metadata with its captured native method body by exact source identity.
It fixes publications where an earlier metadata-only placeholder prevented the later native frame from being
selected. Future publication defers unresolved entry frames until captured method frames have been written.
Missing method bodies remain explicit gaps. No name-based matching is used.

Packing combines logical pages and indexes into content-addressed JSON packs, at most 2 MiB each.
The loader verifies the pack and the requested member independently. A publication ID includes the evidence
snapshot and selected manifest hashes; it changes when the projection changes. The source snapshot remains
available separately. Intermediate visual files are disposable build output and are not the company model.

Installation archives the projection beneath the registered workspace's `explorer/corpus/<publication>/`,
then atomically selects the catalogue. The site serves the selected publication's files in place from
`/explorer-data/<workspace>/<publication>/<file>`, so nothing is copied into `public/`. There is one explorer
screen per workspace, rather than an HTML route for every source method. Repository scopes are labelled explicitly and never stand in for a
source-proven deployed component. Existing system pages link through exact component identities and
registered repository homes, independently of teams.
