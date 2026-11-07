# Historical scan-trial proof boundary

The six commands in `package.json:48–53` replay pinned research bundles or verify their source ranges. They have no dependency on a workspace registration, live model reader, plan store or compatibility adapter. PR 8 replaces the live workspace consumers and the rebuild capture tools. The research commands retain the bundle formats and inputs that make their earlier claims reproducible. PR 10 owns their retirement dependencies after the new scan path has been proven. See `docs/rebuild/rebuild.md:160–168,186–189` and `docs/rebuild/design.md:440–445`.

| Command | Exact entrypoint path | Audited local modules |
| --- | --- | --- |
| `proof:capture` | `tools/capture-proof.ts:18–35` reads the pinned capture fixture, imports its snapshot into a disposable SQLite index, queries it, and writes the runtime walkthrough. The fixture reads its bundle and snapshot at `tools/capture-proof-fixture.ts:16–19`. | 57 |
| `proof:soft-offer` | `tools/soft-offer-proof.ts:18–46,106–111` reads the pinned soft-offer fixture, imports its snapshot, queries it, and writes the runtime walkthrough. The fixture reads its bundle and snapshot at `tools/soft-offer-proof-fixture.ts:15–18`. | 57 |
| `proof:runtime` | `tools/runtime-proof.ts:17–36,53–73` selects capture or soft-offer and optionally reads a query request. The selection reads only the named runtime fixture at `tools/runtime-proof-fixture.ts:10–18`. | 54 |
| `proof:capture:sources` | `tools/verify-capture-evidence.ts:6–23` uses a caller-supplied clone root. It checks that the pinned Git blobs and cited line ranges exist. | 6 |
| `proof:soft-offer:sources` | `tools/verify-soft-offer-evidence.ts:24–46` checks pinned Git blobs and line-range digests against the saved source lock. | 6 |
| `proof:runtime:sources` | `tools/verify-runtime-evidence.ts:18–48` checks the selected pinned Git blobs and range digests and verifies that each evidence record has a derived GitHub anchor. | 9 |

The module counts include the entrypoint and type-only imports. The audit resolved relative imports, the `@/` source alias and the `#domain/` alias. All six closures contained zero live workspace readers. The common Node loader only resolves module paths. See `tools/register.ts:17–28`.

| Pinned bundle | Contract | Records | Evidence records | Source lock rows |
| --- | --- | ---: | ---: | ---: |
| `docs/scan-trials/capture-proof/bundle.json` | v1 | 307 | 37 | — |
| `docs/scan-trials/soft-offer-proof/bundle.json` | v2 | 514 | 43 | 43 |
| `docs/scan-trials/capture-proof/runtime/bundle.json` | v3 | 355 | 40 | 40 |
| `docs/scan-trials/soft-offer-proof/runtime/bundle.json` | v3 | 602 | 50 | 50 |

The read-only audit counted each bundle's records and checked the matching source-lock row counts. Each has a companion `snapshot.json`. The knowledge parser still registers all three archived formats at `src/infrastructure/knowledge/knowledge-format.ts:98–114`. Both original proof commands intentionally replay their immutable inputs. See `docs/scan-trials/runtime-components.md:219–223`.

There are zero direct calls to the six package commands in the checked-in workflow files. The scanner project covers 23 test files that import one or more of the three proof fixture readers. CI invokes that project through coverage. The workflow test job and scanner inclusion are at `.github/workflows/ci.yml:55–66` and `vitest.config.ts:39–49`. The historical skill documentation presents these commands as saved Volvo examples at `.agents/skills/groundwork-explore/canonical-scan.md:389–392`.

The direct production callers of the helper files are confined to the replay and verifier entrypoints and their drawing or fixture modules. Their test callers exercise those same pinned fixtures. The shared knowledge parser, index and domain query modules have other callers and are outside this exclusive-helper review.

| Helper | Direct production callers |
| --- | --- |
| `capture-proof-drawing.ts` | `tools/capture-proof.ts:13` |
| `capture-proof-fixture.ts` | `tools/capture-proof.ts:14`, `tools/verify-capture-evidence.ts:4` |
| `soft-offer-proof-drawing.ts` | `tools/soft-offer-proof.ts:14` |
| `soft-offer-proof-fixture.ts` | `tools/soft-offer-proof.ts:15`, `tools/verify-soft-offer-evidence.ts:6` |
| `runtime-proof-contracts.ts` | `tools/runtime-proof-page.ts:3` |
| `runtime-proof-fixture.ts` | `tools/runtime-proof.ts:13`, `tools/verify-runtime-evidence.ts:8` |
| `runtime-proof-internals.ts` | `tools/runtime-proof-page.ts:4` |
| `runtime-proof-layout.ts` | `tools/runtime-proof-page.ts:5`, `tools/runtime-proof-svg.ts:6` |
| `runtime-proof-page.ts` | `tools/runtime-proof.ts:14` |
| `runtime-proof-sources.ts` | `tools/runtime-proof-contracts.ts:7`, `tools/runtime-proof-internals.ts:9`, `tools/runtime-proof-page.ts:6` |
| `runtime-proof-svg.ts` | `tools/runtime-proof.ts:15`, `tools/runtime-proof-internals.ts:10`, `tools/runtime-proof-page.ts:7` |
| `runtime-proof-view.ts` | `tools/runtime-proof-contracts.ts:8`, `tools/runtime-proof-internals.ts:11`, `tools/runtime-proof-layout.ts:3`, `tools/runtime-proof-page.ts:8`, `tools/runtime-proof-sources.ts:4`, `tools/runtime-proof-svg.ts:7` |

The mergeable packet covers four command source candidates as support, which the inventory displays as references, and eleven exclusive helper candidates as pending PR 10 retirement. The capture and soft-offer source verifier files have no current or original discovery match. Their package-script rows already appear as structural references. Both source verifiers are reviewed in the packet's separate `outsideCandidateSet` field so the six entrypoints remain traceable. `runtime-proof-svg.ts` likewise falls outside the candidate set. See the discovery rules at `tools/rebuild/inventory.ts:18–23,103–114,124–135` and the role and review rules at `tools/rebuild/consumer-inventory.ts:307–343,447–450`.

This audit inspected source, imports, workflow configuration and saved input bytes. No proof replay or external source check was required to establish the boundary. The four bundles, four manifests, three source locks and their producers remain part of the historical proof until the PR 10 retirement checks.
