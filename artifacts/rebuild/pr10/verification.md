# PR 10 verification

## Entry navigation

The original flow projection only followed an explicit `causes` target or a `call`. A plain
`publish` now follows each subscription whose recorded message resolves to the exact canonical
message. The tests cover two subscriptions, an unrelated subscription and a publish without
`causes`. The links preserve the plan and version. An explicit `causes` and a matching
subscription yield one link to that entry.

The shared index already emitted `?step=` with the exact authored identity. The canvas now reads
that selection and writes it through browser history. The browser test opens a copied address for
a nested step, selects a recorded failure, returns with Back and closes the details. Its plan and
version stay selected. Selection still resolves only within the loaded flow.

## Evidence index

Canonical source records name an exact file identity. The old index only read the legacy inline
path. The builder now resolves the file within the repository and keeps the authored span. The
record detail still returns the original JSON. Missing file identities stay unresolved.

A scratch index of the pinned Volvo CDLS repository loaded 33,193 records. All five query
commands ran. The path-filtered source list, record detail and outgoing file link resolve
`ev:volvo-cars-cdls-mono-volvocars-c55c2db0c2b0dc7690f93320` to
`.github/actions/lint-a11y-metrics/stylelint-a11y.config.mjs`, lines 9–14. The repository-scoped
search found three results for `stylelint`. The focused fixture also checks that an unresolved
file identity stays unplaced and that the legacy inline-path format still works.

A separate index built from the complete merged canonical Volvo evidence loaded 117 repositories,
354,395 records and 466,906 links. It measures 340,377,600 bytes. The live 9,508,937,728-byte index
is retained. The scratch index excludes uncited analysis, so the size comparison describes its
input scope and is insufficient to replace the live index.

## Retirement order

Only the unused legacy view adapter and its adapter-only tests have been removed. The independent
progress reader and writer still use the legacy plan schema. Old capture and replay commands still
validate their knowledge, discovery and interpretation inputs. The native scan reads the retained
repository pass through `scan.schema.json`. Historical scan marks still record distinct branch
checks. PR 8 measured 116 marks, 74 checked, and 42 differing pins among 108 repositories with a
native record. Each retained format needs its own replacement proof.

The live and fallback explorer, historical scan marks and all Volvo data and cache files remain
in place. The original PR 1 baselines and PR 8 and 9 review receipts remain the frozen references.
