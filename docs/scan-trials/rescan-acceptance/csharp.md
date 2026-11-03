# C# and ASP.NET source evidence

The reusable C# extractor now reads pinned supplied bytes with Roslyn, retains local control and value
facts, resolves selected-source symbols, and discovers source ASP.NET controller routes. It does not run
MSBuild, restore packages, load target assemblies or call the target application.

`indexSource({ path, content, language: 'csharp' })` uses the isolated managed SDK when available, then an
installed SDK. Run the compiler-only setup before scanning C#14 source:

```sh
node --import ./tools/register.ts --conditions=react-server tools/scan-dotnet-setup.ts
```

The setup reads Microsoft's [.NET10 release metadata](https://builds.dotnet.microsoft.com/dotnet/release-metadata/10.0/releases.json),
checks the platform archive's SHA512, rejects archive paths leaving the installation, and installs under
`node_modules/.cache/groundwork/dotnet`. It selects a validated manifest after checking the SDK version.
It changes no global SDK installation. SDK and runtime versions, both Roslyn assemblies and all adapter
sources participate in parser identity. Source/index caches therefore reparse retained source when the
parser changes; unchanged compatible indexes remain reusable.

`collectCsharpSymbols` shares one selected-source compiler analysis for call targets, argument/formal
joins, lexical definitions, interface implementation candidates and DTO contracts. Exact source calls,
external symbols, polymorphic declarations and unresolved calls remain distinct. Direct
`AddScoped`/`AddTransient`/`AddSingleton` declarations and assembly-scan registration sources retain their
conditions. An implementation candidate is a drilldown into available source, never activated runtime DI.

ASP.NET routes carry exact compiler-derived input/output contract IDs. Local DTO references use namespace
and type identity; arrays, known collection/map wrappers, nullable unions, tuples and numeric source enums
retain their structure. Contracts remain source declarations. External/generated types, caller-dependent
generic parameters and effective serialisation remain unresolved. Deconstruction and callback assignments,
loops and exception topology retain frontiers. Preprocessor selection without project symbols quarantines
the file rather than treating inactive code as absent.

## Verified bounded proof

[Revision 004](../../../reports/rescan-launch-readiness-001/pretax/revision004/source-proof.json) covers
`volvo-cars/gpe-pretax` at `9ac2fd76c450a64d6f5c4bd49e1942ef8eb42c56`:

- The complete tracked inventory contains 128 C# files. All 102 production files are represented in two
  source shards of 100 and 2 files. All 26 test/support C# files are parsed in a separate third shard.
- SDK10.0.402 parses all 128 without syntax quarantine. The full production program has 6 controller routes,
  775 source contracts (type declarations and method inputs/outputs),185 exact call bindings,24 polymorphic call bindings and 14 implementation candidates.
  There are 425 external and 445 unresolved calls; these remain in the denominator.
- The cart proof joins the controller's mappings and interface call to the source implementation candidate,
  its registration conditions, core conditions and exact `GetCartPrices` helper. Source request/response
  contracts join directly to the local DTO graph. The actual C#14 extension methods have 7 exact call joins.
- The upgrade reparsed 128 indexes from retained bytes with zero Git blob reads. A second run reused all 128
  indexes with zero parsing and zero blob reads. A real adapter-content mutation regression also proves
  parser identity invalidation. Local freshness distinguishes unchanged analysis from changed rules;
  remote and deployed currency remain unknown.
- Six separately validated **Inferred** claims attempt purpose, actors, actions, journeys and relationships.
  Exact model usage is unavailable and explicitly unmetered.

These are source ingestion and bounded drilldown results. The 458 semantic compiler diagnostics concern
missing external packages and incomplete target/project context; they are distinct from syntax errors.
Schema validity, inventory coverage and a useful source graph do not establish complete endpoint semantics
or deployed behaviour. Wider repository scans remain stopped.

## Learning record

**Pattern/state:** C#14 extension blocks and compiler-field lowering — verified for the bounded proof.

**Evidence:** The pinned `Core/Extensions/FinancingOfferTermExtensions.cs` was quarantined by installed
SDK8/Roslyn 4.9; an isolated SDK9/Roslyn 4.13 Preview probe also rejected it. The retained earlier helper
assemblies were identical SDK8 copies. The original SDK8 partial pack and superseded revision002/revision003 rule receipts remain retained.

**Correction:** A reusable SHA512-verified managed compiler setup and manifest selection now supply SDK10.
Synthetic C#14 extension-block tests and the regenerated pinned file both pass. Other native regressions
cover namespace collisions, nested DTOs, actual adapter cache invalidation, ambiguous overloads, conditional
and multiple registrations, shadow MVC attributes, omitted array-size syntax, default parameters, filtered
catches, discard lambda parameters and explicit unsupported assignment frontiers.

**Follow-through:** The immutable revision004 aggregate and its interpretation target the final SDK10
fingerprints. The earlier SDK8 capture remains partial and is not the selected proof. Genuine external
package, project-symbol, source-to-runtime activation and unsupported control-lowering gaps remain visible.

## Aggregate published C# source shards

`scan:pass` publishes bounded local shards. Per-shard metadata alone cannot resolve calls or DTOs whose
source declarations sit in another shard. After the source pass, explicitly select the immutable production
generation folders and bind them together:

```json
{
  "format": "scan-csharp-program-inputs/v1",
  "cloneRoot": "/path/to/clones",
  "cacheDirectory": "/path/to/shared-cache",
  "shards": ["/path/to/pass/source-001/GENERATION", "/path/to/pass/source-002/GENERATION"]
}
```

```sh
node --import ./tools/register.ts --conditions=react-server \
  tools/scan-csharp-program.ts inputs.json /path/to/NEW-program-output
```

Input paths are relative to the manifest. Published inputs normalise every path to an absolute path so
the emitted manifest replays from its own output folder. Each generation must contain `scope.json`, `baseline.json` and a
validated `document.json`. The CLI reuses the selected source indexes, checks current parser/rule/configuration
fingerprints against every published baseline and refuses stale shards. It checks the aggregate again,
then writes immutable `document.json`, `receipt.json` and `inputs.json`. Its receipt includes source/index
work metrics, input generations, document hash and driver hash. It never resumes a repository queue.

The CLI and underlying `csharpProgramDocument(documents, indexes)` API are bounded to 512 selected indexes;
the CLI also caps selection at sixteen shards. Larger repositories need explicitly bounded source programs.
The caller must retain the complete repository inventory and explain any partition or exclusion. Keep tests
and test-support programs separate from production runtime binding. The source policy still prohibits target
builds, restores, fetches and runtime calls.

The Pre-tax proof's runtime identity is anchored in `Program.Main`, `Startup`, the Web SDK project and XML
project references to Core and Providers. Repository identity and analysis host IDs are not runtime identity.
The emitted runtime binding says source-declared and leaves deployed activation unknown.

**Diagnostic identity correction:** Repeated identical source programs exposed nondeterministic Roslyn
compiler-worker ordering. The collector now sorts all semantic diagnostics without truncating them, and
published gap identity hashes repository, commit and message. Raw duplicate occurrences are retained;
identical diagnostic facts are explicitly merged. Permutation and repeated native-program regressions
prove stable diagnostic lists, gap records and aggregate IDs. Final generic CLI output is replayed twice
and compared byte-for-byte before selection.
