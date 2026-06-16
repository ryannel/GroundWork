# Sync Anchor

This file pins the principle files this skill embeds. When any listed file
changes, this skill must be reviewed in the same commit. CI verifies the
hashes match (`scripts/check_sync_anchors.py`, run by `./dev test contracts`).

The `references/` in this skill are self-contained distillations of these
sources, written for the product persona's decision-time lens. A source edit
forces a review of the matching reference so the distillation never drifts.

| Principle file | SHA-256 | Last reviewed |
|---|---|---|
| src/docs/principles/foundations/product-engineering.md | 4b18f0a1eef7a7758401c97a6e0c61b29f05b563a5f5b7d83f9d45bf156a42ca | 2026-06-16 |
| src/docs/principles/foundations/continuous-discovery.md | de543cc7b4d0e2fa85a44b1f2c46169c43080efd5bfdc9e0e35f69db4fa328c0 | 2026-06-14 |
| src/docs/principles/foundations/product-risks.md | 9f0eabb60e7ee057f34b440a2d57b94b0403060d828b0dfcd45cd71ea1ac2f6f | 2026-06-16 |
| src/docs/principles/foundations/success-metrics.md | 1b56701792b0d27313b15a622d9f591fb3b3e2a8a5d485eb5b0f3fbc8b6f7618 | 2026-06-14 |
| src/docs/principles/foundations/requirements-and-specs.md | ac4289654af6ccdb7b4cbf89b820e2b15067766e262d1dfc8d4d83572d804d7f | 2026-06-14 |
| src/docs/principles/foundations/prioritization-and-appetite.md | b4ce5ed6b41df2bbb546d684ae769d101afdea09247c6427e330bd9cebb57806 | 2026-06-16 |
| src/docs/principles/ai-native/ai-native-product.md | 4b3f444bde6a843de73488129c2abeb46fe007b195f97313f8b67f1819c9a8bd | 2026-06-14 |
