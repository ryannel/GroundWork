# Sync Anchor

This file pins the principle files this skill embeds. When any listed file
changes, this skill must be reviewed in the same commit. CI verifies the
hashes match (`scripts/check_sync_anchors.py`, run by `./dev test contracts`).

The `references/` in this skill are self-contained distillations of these
sources, written for the architect's decision-time lens. A source edit forces
a review of the matching reference so the distillation never drifts.

| Principle file | SHA-256 | Last reviewed | Distilled into |
|---|---|---|---|
| src/docs/principles/system-design/code-structure.md | e46fb0a5fc9c4ecee1ac840af9b43dcf00fa66cf9635ce55faabfd5d95bc2362 | 2026-06-19 | references/core-and-boundaries.md |
| src/docs/principles/system-design/api-design.md | e892bd9a1e5edbb016d95fd7a6073076c0cbd1369c22ea6b489bb2fb54d2358f | 2026-06-19 | references/api-and-contracts.md |
| src/docs/principles/system-design/integration-patterns.md | c06186e2611f1cf393639fbbee46eb19851f83d0b68ec03c8e56df8db781d43c | 2026-06-19 | references/integration-patterns.md |
| src/docs/principles/system-design/real-time.md | da420fd1c174b7baa1e9a71902a2384e62f561eb3801a531fdc9831ded72d8f3 | 2026-06-19 | references/realtime-and-async.md |
| src/docs/principles/system-design/data-engineering.md | fd0df432fc96d51c52e6ad87bd0159fa7eac7840e669fbb4174a2b6a68ae331d | 2026-06-19 | references/data-architecture.md |
| src/docs/principles/quality/reliability.md | 9c9788504e0963458667d2727c3fc2359776108be593a2efc6603f6470002252 | 2026-06-19 | references/reliability.md |
| src/docs/principles/quality/performance.md | 18b6d3391c57d97342068f9f1da732b24de4221489d0459bb6ad8900fac0a02e | 2026-06-19 | references/performance-and-scale.md |
| src/docs/principles/quality/observability.md | 8aa60e213ba03e989c93263153e3a1ac10b2336f6d0360c394f473660d565a0b | 2026-06-26 | references/observability.md |
| src/docs/principles/quality/security.md | 61157d97677142737ec537954dc5aaad7a04012cc8a3dcc855e2d324287fdc64 | 2026-06-19 | references/security-and-trust.md |
| src/docs/principles/quality/privacy.md | d84f6bed50169b40daeb2a0ec7082dbd12d91d3abfa304b169cb9eb3fab494fb | 2026-06-19 | references/security-and-trust.md ("Privacy is a design input") |
| src/docs/principles/delivery/platform.md | 3cbf6c13298bf1c148278ae26acdbc2601a06615ff8d85cdb0de3b41c008c626 | 2026-06-19 | references/platform-and-delivery.md |
| src/docs/principles/delivery/progressive-delivery.md | 002806b15448ea8c509edd0fdf050d35397ed9e39e77abf5b8fbb3943ab296d9 | 2026-06-19 | references/platform-and-delivery.md |
| src/docs/principles/delivery/cost-engineering.md | b2e29328e8f704c6d385173247b7d3ccaf205b71b240b54f14193b8372befe58 | 2026-06-19 | references/platform-and-delivery.md |
| src/docs/principles/ai-native/agent-native-systems.md | a59972f54655061a66e696b000fb484563f7e882a463d7d448fe848f6b1a6162 | 2026-06-19 | references/ai-native-architecture.md |
| src/docs/principles/ai-native/ai-engineering.md | 79f8796d9ede943a3685ffc897e196c3ed081fd2861052df3003d34d3374e939 | 2026-06-19 | references/ai-native-architecture.md, references/agentic-systems.md |
| src/docs/principles/ai-native/agentic-systems.md | faf79028b59ccb6221c1e88ab2f67685c4e1b3626498a81e2bf5c7fc58298990 | 2026-06-19 | references/agentic-systems.md, references/ai-native-architecture.md |
| src/docs/principles/system-design/architecture-decisions.md | f02a30e5b490d2228ec1c06277e9e5967d40b9c3677e03c86a9b0683b119b874 | 2026-06-24 | references/decision-records.md |
| src/docs/principles/system-design/evolutionary-architecture.md | 6b50d45c4c15b087160e37f1cc98934eb5ba1031319adae61aa838b930abd366 | 2026-06-19 | references/evolutionary-architecture.md |
| src/docs/principles/system-design/surface-architecture.md | 724e2183433b0db8d54466deffc0be877d847cdb6b61f0da9060491907151b91 | 2026-06-19 | references/surface-architecture.md |
| src/docs/principles/system-design/identity-and-access.md | 18c99f755a37bec69de595a9784171c88639845c13c2f5a8497b55e40c3a5edf | 2026-06-19 | references/identity-and-access.md |
| src/docs/principles/system-design/durable-execution.md | e4faad5864bcbecb80c79983be6a941fee652f2f78b38701dd8bd2dda47c3ec3 | 2026-06-19 | references/durable-execution.md |
| src/docs/principles/index.md | 86e957ef6437b4ef551a67cb66f1e30aef971716636181bce5f5996f701323c6 | 2026-06-27 | SKILL.md ("The principles you carry") |
