# Sync Anchor

This file pins the principle files this skill embeds. When any listed file
changes, this skill must be reviewed in the same commit. CI verifies the
hashes match (`scripts/check_sync_anchors.py`, run by `./dev test contracts`).

The `references/` in this skill are self-contained distillations of these
sources, written for the product persona's decision-time lens. A source edit
forces a review of the matching reference so the distillation never drifts.

| Principle file | SHA-256 | Last reviewed |
|---|---|---|
| src/docs/principles/foundations/product-engineering.md | bd9758c3d1e0f177797c449700874aafa241bcf5de3f0c8bb3aff15b259c9e3e | 2026-07-01 |
| src/docs/principles/foundations/continuous-discovery.md | 4ab56e83a03bbbc2575b7695980f7ee4036c86624da21fcdc966ad62c3f35afc | 2026-06-19 |
| src/docs/principles/foundations/product-risks.md | c89a37dfbf3cb3d459010c4094403af3dfd1ea98dcb0d88e5cc156f16bcc9d85 | 2026-07-01 |
| src/docs/principles/foundations/success-metrics.md | 0273825959258009a1efa9d13eb2fcaa03e26792b444f7428afee6a7ca5835fe | 2026-06-19 |
| src/docs/principles/foundations/requirements-and-specs.md | 49f5d554397ccf51ad73e2729caf5991bf3c47d0f1013a083b1177d2356e3b79 | 2026-06-19 |
| src/docs/principles/foundations/prioritization-and-appetite.md | a721e2f87248594b8c9c2a6c1d89a93cb05c914388772744f82a761a0a955eb5 | 2026-07-01 |
| src/docs/principles/ai-native/ai-native-product.md | 38527dd861c7cfbc0bcba59155d778e06cdc82619608cb574ad0754301a6918b | 2026-06-19 |
