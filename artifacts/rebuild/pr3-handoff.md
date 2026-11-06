# PR 3: canonical schemas and generation

Base: PR 2 merge `23fbccb270af46a1c58e464af03679daaceeb655`. Branch: `codex/rebuild-pr3`.
The user has authorised merging verified PRs and continuing the stack in separate worktrees. No direct main push is authorised.

## Contracts

`schema/workspace.schema.json` owns authored workspace contracts, including all entities and step constructs in design §3–§4. `schema/plan.schema.json` now describes an overlay rather than a copied base model. Its operations address complete ids, including nested steps, failures, fields and regions. `schema/evidence.schema.json` defines all 22 existing evidence families, repository metadata and discovery metadata. Source evidence refers to a file record; repository metadata holds the shared commit pin. Inferred claims retain their label, reasoning and limitations.

`npm run generate` writes the legacy plan types and the canonical type registries plus their immutable facade. Local schema references are resolved within these three authorities; unknown references fail generation. Ajv retains conditional constraints, tagged shapes, uniqueness and id grammars that TypeScript cannot express. The generator applies the existing lint and formatting commands to its output; no lint or architecture rule is changed. Every canonical type declaration, including the type-only facade, is generated.

`src/infrastructure/model-schema.ts` provides a single Ajv configuration, typed predicates, data checking and YAML/JSON file loading. Errors retain their instance paths. Generic uniqueness keywords check child ids across alternatives, parallel lanes and retry exhaustion. The handwritten fixture has examples of every authored file, protocol, field tag and handler construct, plus one record per evidence family and rejected documents. It is explicitly synthetic and makes no company claims.

## Compatibility

Existing plan readers now use `schema/legacy-plan.schema.json`, an exact byte copy of the former authority. Its generated types change only their source banner. The old workspace validators and evidence readers remain in place until their consumers migrate. Semantic reference resolution, model indexes, derivations and gap reporting belong to PR 4; this PR proves the contracts and load boundary.

The consumer inventory remains conservative: no compatibility adapter is claimed migrated and no explorer capability is retired. All 20 parity items remain unproven. Volvo and the original code checkout remain unchanged at their recorded revisions.

## Proof

Committed verification artefacts are under `artifacts/rebuild/verification/pr3/`:

- `contracts.json` records schema hashes, definition counts and fixture coverage.
- `legacy-schema-integrity.json` proves the legacy schema is byte-identical to its PR 2 source.
- `baseline-integrity.json` verifies all 193 frozen baseline files without refreshing them.
- `compare-personal.json` and `compare-volvo-cars.json` contain no differences; Acme has only the existing precisely allowed 43-byte HTML wrapper variation. No allowance is added or broadened.
- `build.log` and `budget.log` record the production build and all 599 pages under 1,024 KB; the largest is 1,021 KB.
- `mutation.json` and `mutation.log` record 47 of 58 whole-file mutants detected (81.03%), above the unchanged 75% floor.

The initial whole-file mutation run exposed ineffective coverage of legacy shape checking (2 of 58 detected). Five focused regressions now prove authored-data extraction, synthetic child-id removal, blame of the last edit, append/drop error paths and preserved-schema guidance. The original failure remains recorded. No source file was excluded from mutation testing and no threshold was changed.

The full check passes, including static checks, lint and coverage; `check.log` records the complete test counts and coverage. The focused check also passes, including 2,126 related tests (`check-quick.log`). Generation replay and CI must pass before merge. Failed or incomplete runs do not constitute proof.

## Next work

After merging this PR, create PR 4 from updated main in its own worktree. Read the repository specification and run the task checkpoint and workspace registry commands. Build `WorkspaceModel`, `readModel`, `apply`, `indexOf`, `plansIndex` and the explicit loss-reporting compatibility boundary. Derive facts from recorded evidence and keep ownership separate from placement.

PR 7 still requires a person to accept headline and edge review rows. Before PR 9, reconfirm design §10.2 with the user. Keep code and Volvo data PRs separate and never edit the original code checkout.
