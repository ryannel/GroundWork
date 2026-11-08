# Retire the legacy model adapter

The adapter has no production caller. PR 8 classified its former runtime callers against the
consolidated model and recorded 148 consumers with zero adapters. The original personal, Acme
and Volvo comparisons passed with zero unexplained differences. The adapter's last source hash
is `84cd31a0fcb1633dee231a72f02b6eca408cf78edd70a881d805d5713d99ad1f`.

The current-model integration test now renders the domain through `modelDomainViewOf` and
`modelDomainNavOf`. It still checks loading, plan application, field identities, the rendered
domain heading and the link to its system. The workspace library test still checks a mixture
of consolidated and format-1 registrations.

The original source and comparison evidence are pinned in
`artifacts/rebuild/pr8/legacy-retention-binding-audit.json` and
`artifacts/rebuild/pr8/release/comparison.json`.
