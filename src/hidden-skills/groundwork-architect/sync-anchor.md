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
| src/docs/principles/system-design/integration-patterns.md | 248f65c9a89c41777e654112c4d4413449eb8ac6167a92ab2422612c73666e63 | 2026-07-02 | references/integration-and-workflows.md |
| src/docs/principles/system-design/real-time.md | 688eb10a9094e31783e38dbd7c7c1e21e2891cd159e9eaa390230a23731c7792 | 2026-07-02 | references/realtime-and-async.md |
| src/docs/principles/system-design/data-engineering.md | 09d90d749c8e47ce797b53b2031f70c190a035a379c77efeb109abfa11b2f976 | 2026-07-02 | references/data-architecture.md |
| src/docs/principles/quality/reliability.md | 9c9788504e0963458667d2727c3fc2359776108be593a2efc6603f6470002252 | 2026-06-19 | references/reliability.md |
| src/docs/principles/quality/performance.md | 18b6d3391c57d97342068f9f1da732b24de4221489d0459bb6ad8900fac0a02e | 2026-06-19 | references/performance-and-scale.md |
| src/docs/principles/quality/observability.md | 8aa60e213ba03e989c93263153e3a1ac10b2336f6d0360c394f473660d565a0b | 2026-06-26 | references/observability.md |
| src/docs/principles/quality/security.md | 61157d97677142737ec537954dc5aaad7a04012cc8a3dcc855e2d324287fdc64 | 2026-06-19 | references/security-and-trust.md |
| src/docs/principles/quality/privacy.md | ce190ecd57944845a54c011e365a3bc867f6ec49ead83bee1628f90967f44341 | 2026-07-02 | references/security-and-trust.md ("Privacy is a design input") |
| src/docs/principles/delivery/platform.md | 5b1d0f79eef5f58cc49fd4ccf4ea39a431c5ad716fd9bcd5efe9752c83e30107 | 2026-07-02 | references/platform-and-delivery.md |
| src/docs/principles/delivery/progressive-delivery.md | 6180f4817ed48d16b14c6be25bd8c617646f459c38e4523121ba4f56e40f4779 | 2026-07-02 | references/platform-and-delivery.md |
| src/docs/principles/delivery/cost-engineering.md | b2e29328e8f704c6d385173247b7d3ccaf205b71b240b54f14193b8372befe58 | 2026-06-19 | references/platform-and-delivery.md |
| src/docs/principles/ai-native/agent-native-systems.md | a59972f54655061a66e696b000fb484563f7e882a463d7d448fe848f6b1a6162 | 2026-06-19 | references/ai-native-architecture.md |
| src/docs/principles/ai-native/ai-engineering.md | c14be94362dbe8fb131654fcb5e2199d9e5655ad1063f45ec2944afeb948bdb7 | 2026-07-02 | references/ai-native-architecture.md, references/agentic-systems.md |
| src/docs/principles/ai-native/agentic-systems.md | c6707c27f8390ab64d33aa92dbf699c79505050b33643e40af4d1681cf6baa21 | 2026-07-02 | references/agentic-systems.md, references/ai-native-architecture.md |
| src/docs/principles/system-design/architecture-decisions.md | f02a30e5b490d2228ec1c06277e9e5967d40b9c3677e03c86a9b0683b119b874 | 2026-06-24 | references/decision-records.md |
| src/docs/principles/system-design/evolutionary-architecture.md | 6b50d45c4c15b087160e37f1cc98934eb5ba1031319adae61aa838b930abd366 | 2026-06-19 | references/evolutionary-architecture.md |
| src/docs/principles/system-design/surface-architecture.md | 724e2183433b0db8d54466deffc0be877d847cdb6b61f0da9060491907151b91 | 2026-06-19 | references/surface-architecture.md |
| src/docs/principles/system-design/identity-and-access.md | 18c99f755a37bec69de595a9784171c88639845c13c2f5a8497b55e40c3a5edf | 2026-06-19 | references/security-and-trust.md (identity-and-access.md reference retired into it, F2 2026-07-02) |
| src/docs/principles/system-design/durable-execution.md | e2a62134e215c18aacec2cb3f0743a9750b8d9160c46d260a89626a9ba237724 | 2026-07-02 | references/integration-and-workflows.md (durable-execution.md reference retired into it, F2 2026-07-02) |
| src/docs/principles/index.md | 4ffad66f242db249904fe17f7a816234a35e206b4e765ea8338b4e3f4ea86be4 | 2026-07-02 | SKILL.md ("The principles you carry") |
