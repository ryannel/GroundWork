# Manage and Segment native rescan

This is a source-pinned canonical v3 capture of `volvo-cars/popcat-manage-and-segment` at
`b3605063154f542ec1615d363ab858b86c743110`. It adds broad registration/contract/schema coverage and a second
write-and-publish trace. It does not establish complete endpoint behaviour or deployment.

The checkpoint inventory and the available local clone agree on this commit. All extraction reads pinned Git
objects. No fetch was performed: upstream freshness is a separate question.

## Inventory and coverage

The source census found **100 controller HTTP registrations in 23 controllers**, plus **four operational
registrations or middleware families**. Every one has a native `entry`, `entry_binding`, executing component
binding and coverage. `entry-inventory.json` records the method/path, symbol, file/range and analysis state.
The actual controller census happens to match the legacy endpoint count; it was counted independently from
source rather than treating the old model as a reliable inbound census.

Operational discoveries are the health-check path, the Development-only `/` redirect, the versioned Swagger
document route template and Development-only Swagger UI middleware. Imported health/Swagger HTTP-method
behaviour remains `UNRESOLVED`. The UI entry's path is explicitly `unresolved:Swagger UI middleware route`,
a discovery placeholder rather than an invented concrete route or assumed `/swagger` default. Generated assets
and effective registrations remain a gap.

No application message-consumer/subscription, hosted-worker, CronJob or scheduled-job registration was found
in the pinned application/deployment/Terraform/pipeline sources searched. Kafka code here is producer code.
The repository also contains scheduled CodeQL analysis (`.github/workflows/codeql.yml:20–21`) and Dependabot
updates (`.github/dependabot.yml`); these are repository maintenance automation, outside the captured
application-runtime scope. Their execution is not represented as an API job or silently asserted absent.

Only two controller entries have a detailed bounded local write/publish trace: the original soft-offer POST
and the newly captured fee POST. **The other 98 controller entries retain opaque delegated execution with
explicit gaps.** All four operational entries remain partial. Source request/response contract inspection does
not complete their behaviour. Six outbound HTTP client invocations have isolated partial client graphs;
these do not establish that every inbound endpoint invokes them.

The selected bundle has **3,546 records**, including **2,944 new records** and the original soft-offer proof's
**602 records preserved identically**. It includes 312 native coverage records: 101 `examined` and 211 `partial`.
These count individual obligations, not completed endpoints. It includes 41 gaps, of which 34 are new.

## New information retained natively

- Source request/response DTOs, local inheritance, generic response envelopes, nested objects/collections,
  required annotations, nullable declarations and explicit supported length/pattern constraints. Significant
  fields link to actual commit-pinned file ranges, including validation constants. Source-only `Range` and
  other unsupported constraints are retained as anchored gaps rather than silently dropped or invented keys.
  The 265 constructed type/collection references include API, integration and internal model declarations;
  this is not a claim that 265 distinct public DTO classes exist.
- **74 protobuf message definitions**, numeric tags and reserved tags/names, plus repeated-item shapes.
  **53 additional message-family contracts** connect declared builder cases and service topic selectors to
  their wire schemas. The commercial-segment topic is a technical component independent of teams. Existing
  commercial-item/topic and consumer context are preserved from the original proof. No additional consumers,
  deliveries or exactly-once guarantees are inferred from a producer declaration.
- **20 root PostgreSQL table column shapes** from the pinned generated EF model snapshot, with inherited
  columns, SQL types, explicit constraints, key declarations and per-column anchors. Resources bind to the
  existing PostgreSQL runtime component. Nested owned-table mappings, all relational constraints and the
  applied migration/deployment state remain incomplete. Internal entities and persisted columns remain
  separate representations; physical connection values are not invented.
- Six actual outbound HTTP client call sites: Pop Authz relation check, deletion, paginated listing, tuple
  lookup and tuple save, plus Azure AD token creation. Native interactions retain methods, relative paths,
  query/form/body construction, expected result source types and waiting behaviour. Logical configured
  Pop Authz/Azure AD targets are components; actual deployed destinations, secrets and complete effective
  wire behaviour remain unresolved. Credential values were not captured.
- Authorisation source policy: disabled checks and GET requests bypass the Pop Authz relation check; writes
  require the available subject/path/relation conditions and lowercased subject ID. Authentication and
  framework enforcement remain partial. LaunchDarkly source presence is retained as a boundary claim;
  imported SDK network activity is not invented.

The application declares camel-case JSON settings and null omission in the retained original evidence.
New contracts keep source DTOs distinct from effective wire schemas because formatter/version negotiation
and imported behaviour have not been closed. No additional-properties policy, enum or constant was inferred
from a list of known C# fields or extraction completeness.

## Fee POST trace

`POST /api/commercial-items/fees` is bound to the existing Manage and Segment API component. Its native graph
contains the declared input mapping, internal/deterministic identifiers, tracked staging, awaited save,
Created/HasData guard, no-tracking refetch, successful-refetch guard, notification-enabled guard, FeeCreated
construction, protobuf serialisation, awaited publication and producer persistence-report branches.

The data graph follows request Code/Name/SKU values into the entity, stored field bindings, the refetched
message and constructed response. The actual mapping obtains the internal ID through
`FromContextOrGenerateNew` and `InternalId.FromGuid`; the deterministic identity uses Fee.Code. Imported
mapping/identity/EF/Kafka implementation details and concurrent modification remain explicit limits.

The controller's conditional 201 return can follow disabled notifications, a failed refetch Result, null
message/bytes or a non-persisted producer report. Exceptions can escape after an acknowledged database save.
A native consistency boundary retains the database/publication failure window. This bounded path establishes
neither an outbox/shared transaction nor downstream completion. No consumer handoff was fabricated for FeeCreated.

## Verification and replay

The generic validator passed both the new selection and pinned local file/range checks: **1,019 source ranges**
(1,001 from this repository and 18 retained assortment-consumer ranges). This verifies availability/ranges,
not citation entailment or deployment. Original proof-record identity and all 104 entry/exposure/coverage
pairs are also checked by the acceptance harness.

**Nine schema-valid query requests and responses passed**: fee control trace, interactions, 201 outcome, name
lineage, consistency, original soft-offer asynchronous continuation, an opaque registration, outbound
contracts and message schemas. The fee interaction result has three call sites across API→PostgreSQL and
API→Kafka; its control trace has 18 nodes and 30 edges. All queries stayed within their node/support budgets
and retain `exhaustive: false`. Complete traversal of the represented graph is not complete source behaviour.
Query frontiers remain visible, including opaque operations, unresolved implementations/representations and
an unhandled exception boundary.

Run from the Groundwork checkout:

```sh
npm run knowledge:validate -- reports/volvo-native-rescan/manage-and-segment/bundle.json --snapshot reports/volvo-native-rescan/manage-and-segment/snapshot.json --sources /Users/RNEL/.cache/groundwork/clones
node --import ./tools/register.ts --conditions=react-server reports/volvo-native-rescan/manage-and-segment/acceptance.mjs
```

`generate.py`, `fee-flow.py`, `messages.py`, `storage.py` and `outbound.py` preserve the source-pinned extraction
procedure. The selected authoritative files are the top-level `bundle.json` and `snapshot.json`; `drafts/initial`
retains an earlier immutable draft selection for audit and must not be merged alongside its replacement.

No Volvo application tests, endpoints, stores, brokers, package registries or other runtime services were run
or contacted. No application, skills, source repositories, original proof fixtures or production workspace files
were edited. This capture belongs to the canonical model; production app migration and legacy scan-mark
advancement remain separate work.
