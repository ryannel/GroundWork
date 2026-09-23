# Legacy import format

This guide describes the input format for `groundwork-v2 export`. Active project plans live in each repository’s `.groundwork/plans/`; see [the portable guide](PORTABLE.md). The `content/` paths below are relative to an export source directory.

# AI-authored content

Groundwork is a viewer for plans authored by an AI assistant. The UI provides search, filtering, navigation and inspection. Creation and editing happen through content documents, not forms. This revision uses local files; it does not claim to provide an AI chat service, authentication, a database or a write API.

## Structure

```text
content/
  project.json                         # schemaVersion and optional viewerId
  members/<id>.json                     # reusable owner identity
  workspaces/<id>.json                  # platform/domain
  products/<id>.json                    # belongs to a workspace
  components/<id>.json                  # belongs to a product
  features/<id>/
    feature.json                       # metadata, ownerId, productId, touches
    purpose.json                       # problem, outcome, non-goals, success criteria
    journey.json                       # ordered user actions, screens and system references
    design.json                        # screen references and registered live prototypes
    flow.json                          # nodes, decisions and service boundaries
    api.json                           # contracts and before/after response schemas
    storage.json                       # tables and field changes
    tests.json                         # Given/When/Then scenarios and evidence status
schemas/                               # generated JSON Schemas for each document type
```

`project.json` owns the format version for the whole directory. Unsupported versions fail explicitly. Entity filenames and feature folder names must match their IDs. All section files are optional: omit a section that has not been drafted. Never insert invented test results to make a draft appear complete.

This `content/` directory is not loaded automatically by the running app. `groundwork-v2 export` reads it and writes a portable plan under `.groundwork/plans/`, which the viewer then loads live from the Hub. Adding a workspace, product or feature needs no route, page component, import list or seed edit; running `export` again picks up the change.

## Authoring a feature

1. Read the owning product, its components and any related feature documents.
2. Choose a stable URL-safe ID. Keep it unchanged when renaming the feature.
3. Create `content/features/<id>/feature.json`, using an existing product and member ID. `touches` lists components being changed, including components owned by other products in the same workspace. It is distinct from every participant in a system flow.
4. Add the relevant section files. Local references point to IDs inside this feature; component references point to global component IDs.
5. Set `updatedAt` to the real time of the content revision in ISO 8601 with a timezone. Do not regenerate timestamps at application startup.
6. Run `npm run content:validate -- content` to validate this directory (the bare `npm run content:validate`, with no path, validates the bundled Word Loop fixture instead), then `npm test`. Review the changed JSON, then run `groundwork-v2 export` and review the resulting plan in the viewer before publishing the revision. Multi-file edits should be validated together as one revision; the loader never exposes a partially validated revision.

Minimal feature metadata (replace the example ID and timestamp):

```json
{
  "id": "f-example",
  "productId": "p-pricing",
  "title": "Describe the intended capability",
  "summary": "One sentence explaining the intended change.",
  "stage": "idea",
  "ownerId": "ryan-nel",
  "touches": ["c-pricing-api"],
  "updatedAt": "2026-09-05T12:00:00Z"
}
```

Workspaces, products and components accept an optional numeric `order` for intentional display order. Unordered records follow ordered records, sorted by name. Feature lists are sorted by their stored update timestamps.

The lifecycle is `idea`, `exploring`, `designing`, `specced`, `building`, `shipped`. These values describe work stages, not percentage completion. Schema definitions list all product kinds, change states and test states.

## Linking rules

- Ownership is stored once: product → workspace; component → product; feature → product/member. Display names resolve from those records.
- A journey action lists its flow nodes and, when needed, its specific edges and contracts. The order of journey actions is meaningful.
- Each flow node has a kind. Decisions carry authored expressions and branches. Stores reference tables. Boundaries reference API contracts whose sender/receiver match the edge's component owners.
- Node coordinates are authoring data. Nodes visible in the same action cannot overlap. Nodes in mutually exclusive actions may reuse coordinates.
- Use `change: "unspecified"` when importing a target contract or storage record without a verified implementation baseline. This is distinct from `unchanged`. Only use `added`/`updated`/`removed` when the source supports that classification. Contract `responseSchema.before` and `.after` contain complete field trees. The viewer computes added, removed, updated and unchanged fields; do not duplicate the computed diff in content.
- Tests reference journey steps, contracts and tables. Success criteria reference tests. Reverse links, coverage gaps and product coordination lists are derived rather than maintained manually.
- IDs for section items are unique within their section and feature. Field names are unique within each parent. Global entity IDs are unique within their entity collection; product slugs are unique within their workspace.
- External design references must be HTTP(S) URLs. Raster images can also reference portable assets under `/images/` (PNG, JPEG, WebP, GIF or AVIF); pass the containing image directory with `export --assets`. Image references render inline. Live mockups (`kind: 'live'`) are not supported by the runtime: `server/format.ts` rejects that design-reference kind. Ordinary briefs, flows, APIs, schemas, tests and external screen references do not require code.

## Validation and maintenance

`src/data/content-schema.ts` is the source of truth. TypeScript domain types are inferred from these schemas. `npm run content:schemas` regenerates editor/AI JSON Schemas; `npm run content:check-schemas` detects stale generated files. Do not edit generated schema files directly. An AI tool can use the appropriate file in `schemas/` as its structured-output contract, then run whole-directory validation to check relationships that JSON Schema cannot express.

```sh
npm run content:validate                       # validates the bundled Word Loop fixture (no path given)
npm run content:validate -- /path/to/candidate  # validates a complete candidate revision
npm run content:schemas                        # after changing the model
npm test
npm run build                                 # validates the fixture and generated schemas first
```

Errors include the source file, item or property and broken reference. Unknown properties are rejected so typos cannot silently disappear. A malformed or unsupported revision must be corrected before it is used. The loader accepts unknown input and returns a typed snapshot only after structure and relationship validation succeed.

`src/data/content.ts` contains the environment-independent loader and repository factory. `src/data/store.ts` provides the repository to the running app from the Hub API response and adds view selectors; it no longer discovers `content/` files itself. Persist authored facts; keep counts, incoming work, activity sorting, coverage and reverse references derived.

`viewerId` is optional: omit it for a blank system with no member records. When present it must name an existing member. It is local presentation configuration, not an authentication or authorization mechanism. Cross-workspace references are currently rejected deliberately; supporting them later requires an explicit model and permission design.

The `tests/fixtures/wordloop/` directory preserves the imported Wordloop Meeting Recording test fixture. See [the import review](../tests/fixtures/wordloop/provenance/REVIEW.md) for provenance, delivery structure and known source disagreements. A new blank project needs only `project.json`. Example planning data is isolated in `tests/fixtures/content/` and is never loaded by the app. Marked-passing tests are authored evidence labels, not live test execution results. No test runner or external deployment is triggered by viewing a plan.


## System structure: ownership and dependencies

A product registers the services, internal components, infrastructure and external providers needed to describe its system. `productId` locates a record in the catalog; it does not imply that the product owns an external vendor.

A component can have:

- `kind`: `service`, `module`, `database`, `object-storage`, `local-storage`, `queue`, `cache`, or `external-service`. Existing records without a kind render as modules.
- `parentId`: the service or module it is **part of**. Parents and children belong to the same product. Containment can nest, but cannot cycle. Services and external providers are top-level records.
- `dependsOn`: the IDs it **uses**. Dependencies may cross products within the workspace and may be reciprocal. They do not establish ownership or imply planned changes. Self-dependencies, duplicates and missing references are rejected.

For example, Wordloop's App, Core and ML are services. The audio buffer is local storage inside App. Core depends on Postgres, object storage and ML. ML depends on Core, object storage, AssemblyAI and OpenAI. Postgres and object storage are infrastructure; AssemblyAI and OpenAI are external providers. A shared resource has one record and multiple dependents rather than being copied under each service.

```json
{
  "id": "c-audio-buffer",
  "productId": "p-example",
  "name": "Audio buffer",
  "kind": "local-storage",
  "parentId": "c-app",
  "description": "Temporary audio retained by the browser until upload is acknowledged."
}
```

`feature.touches` still means actual planned changes. Touch the smallest known unit: work on an internal module rolls up to its service automatically. Selecting a service includes its descendants in journey, flow, contract, storage and test lenses, but never automatically includes its dependencies. Feature scope options include components actually referenced by the feature plus their ancestors, so a provider can be inspected without being marked changed. Related work detects parent/child overlap while keeping unrelated sibling changes separate.

The product overview shows top-level services, infrastructure, and providers in a system diagram and detail cards. Product filters use that same level; links to an internal component resolve to its top-level owner here. Internal modules and local stores remain available in feature details, flows, contracts, and storage lenses. The diagram derives from `dependsOn`, rolls child dependencies up to their owners, removes within-service edges, and deduplicates shared connections. Arrowheads point to dependencies; reciprocal dependencies have arrows at both ends. These relationships describe dependency, not a chronological request flow. Selecting a node highlights its connections and offers a link to active plans. Flow labels and API ownership include the component path (for example, App / Audio buffer). Flow colors group a service with its internals. Existing IDs stay stable through renaming and reorganization, preserving deep links and contracts.

Storage records accept optional `kind`: `table` (the default), `object`, or `local-file`. The collection is still named `tables` for compatibility, but presentation uses the actual record kind and calls non-SQL members fields rather than columns. A storage record belongs to its actual store (Postgres, object storage, or App's local buffer), while `dependsOn` describes which service uses that store.
