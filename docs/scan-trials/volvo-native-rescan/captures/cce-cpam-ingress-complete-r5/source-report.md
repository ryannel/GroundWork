# CPAM ingress

The full pinned source capture is selected by `bundle.final-r5.json` and `snapshot.final-r5.json`.
Snapshot: `9273eddda4c5fff911958b4a6b82143b69d166f1a50b66279bb19755660f27aa`.
Repository: `volvo-cars/cce-cpam-ingress` at `6db6ba2b9c76751a690ea9b0184b42e58412a09e`.

The capture has 160,947 native records. All 169 files are reconciled: 100 ordinary production Go files,
seven generated protobuf files, 45 test/fixture files, 12 configuration files and five support files.
The 712 declarations and 32 closures give 744 unique source bodies. They are retained as 1,645 implementation
frames and 1,671 execution bindings across the HTTP, event and local pipeline programs. All source `init`
identities include their file and offset; all seven generated initialisers have bindings in each importing
program. Unused aggregator business handlers are not invoked in the HTTP or local pipeline programs.

There are 98 entries: six REST routes, three process entries, 21 startup bindings and 68 callbacks.
Two callbacks have source subscriptions. The 34 interactions retain 32 exact owned SDK/store/library
invocations and two consumer boundaries. Six writes have actual nil-error acknowledgements; an ordinary
Go return is never used as evidence of success. Source types, tags, nested constructions, global declarations
and requested module versions are retained separately from imported wire/runtime behaviour.

The source review covers the import and brand/year filters, cached-result fallback, parser/verifier/converter
order, rule construction and metadata, worker/channel policy, compression, storage retry/deletion windows,
HTTP caller parts and response intentions. `source-review.final-r5.json` explains the findings with native
source claims. The matching completeness, method, registration, entry, I/O, schema-construction, subscription,
dispatch and write ledgers identify their exact records.

Important source distinctions remain explicit:

- HTTP import returns after scheduling a goroutine; the capacity-100 channel send can still block.
- The orchestrator processes channel jobs serially. It recognises `*MarketAuthJob`, not the unused `GlobDictJob` declaration.
- Two result publications require a nonempty market and both lists; the first can succeed before the second fails.
- Compressed publication logs a protobuf marshal error and returns `nil` without publishing. Mock writers do not publish to Kafka.
- Archived-blob recovery deletes before a single upload retry. The deletion and retry are separate writes.
- Rule files use LZ4; event compression uses GZIP. Caller construction and imported codecs remain distinct.
- Health passes a `*strings.Reader` to the JSON encoder. The text response header literally uses `text/plain, charset=UTF-8`.
- Responders write status before encoding/writing; a later attempt to write 500 does not prove the effective response status.
- Aggregator `Run` does not consult its stored reader-skip flag. SDK deduplication and offset behaviour are unknown.
- `BoolVariation` retains actual arguments as a library invocation with null target/effect. Configured flag purpose is a separate source declaration.
- The reusable HTTP transport is not an invented remote component. Unused generic publisher methods have no guessed topic destination.

Native schema/reference/seal validation passes. The strict replay passes 581 requests plus 24 supporting
pages; all requests, responses and continuations are schema-validated, with `maxNodes=2000` and
`maxRecords=5000`. Source acceptance passes 198 assertions across 63 queries, including actual message
value lineage, every REST and exposed subscription, exact I/O owners and negative library/network cases.
Independent root acceptance passed 83 strict queries. Thirty-one standard views and four source views are
explicitly bounded; smaller owner segments supply the positive boundary checks. These are source and query
checks, not application tests or runtime observations.

All 18,713 final evidence records are verified, representing 9,115 unique pinned tuples. The native source
validator checked 18,693 baseline records and five new unique initialiser tuples. Exact tuple equality covers
the repeated host records and subsequent identity-only changes. `source-verification.final-r5.json` records
that provenance, with the saved baseline evidence and delta validator log.

Imported dependency implementations, effective environment/deployment, SDK header/offset/deduplication
policy, dynamic object identity, mutable capture versions, channel scheduling and complete path feasibility
remain explicit gaps. Response contracts retain intended source statuses and actual helper arguments; the
outcome engine does not solve dynamic `WriteHeader` semantics. No available local source inspection remains.
No source build/test, dependency fetch, live endpoint, store or broker was run.

Earlier candidates are preserved and unselected. R1 omitted colliding generated `init` identities; r2 corrects
those bodies, r3 adds shared PCF package initialisation bindings, and r5 removes unsupported per-call remote
flag reachability. R4 is an invalid unselected candidate with an unsupported gap owner; its correction is in r5.
The selected bundle uses fresh revision identities and preserves logical IDs.

Replay from the Groundwork checkout:

```sh
npm run knowledge:validate -- reports/volvo-native-rescan/cce-cpam-ingress-complete/bundle.final-r5.json --snapshot reports/volvo-native-rescan/cce-cpam-ingress-complete/snapshot.final-r5.json
node --import ./tools/register.ts --conditions=react-server reports/volvo-native-rescan/cce-cpam-ingress-complete/queries.mjs bundle.final-r5.json query-replay final-r5
node --import ./tools/register.ts --conditions=react-server reports/volvo-native-rescan/cce-cpam-ingress-complete/acceptance.mjs bundle.final-r5.json source-replay final-r5
```

Use fresh replay directories. Adding `--sources /Users/RNEL/.cache/groundwork/clones` to native validation
can independently recheck all final ranges. Disposable SQLite files are indexes; the selected JSON pair and
saved strict query packs are authoritative.
