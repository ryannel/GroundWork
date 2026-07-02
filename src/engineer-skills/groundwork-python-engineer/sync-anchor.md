# Sync Anchor

This file pins the principle files this skill embeds — both the per-stack Python
idiom docs and the cross-cutting central canon this skill distils. When any
listed file changes, this skill must be reviewed in the same commit (and the
matching per-stack idiom doc reconciled to the canon). CI verifies the hashes
match.

| Principle file | SHA-256 | Last reviewed | Distilled into |
|---|---|---|---|
| src/generators/python-microservice/docs/principles/stack/python/async.md | 6fdd399fb3052381020ff6e792a724d72bdabe674817794093853cbf24fa9f97 | 2026-05-26 | references/async-patterns.md |
| src/generators/python-microservice/docs/principles/stack/python/resilience.md | d5a7b8f089acdb71d64c1bd4fc9ce80e6947504b01b0ace695ac5ee66554a1b1 | 2026-06-19 | references/resilience.md |
| src/generators/python-microservice/docs/principles/stack/python/testing.md | f15e62c83b659788f8b3e39f560779e892080d6bce73768be093d919f3e6946c | 2026-06-26 | references/testing.md |
| src/generators/python-microservice/docs/principles/stack/python/documentation.md | ac58228ba22435bf9bad2ea5bf924bdf9e3674e9967515d5c82aaf3b7825214d | 2026-05-26 | references/documentation-mcp.md |
| src/generators/python-microservice/docs/principles/stack/python/mcp.md | 1e6deab0b45c7271e0038e9b3d51bc30cb2917488f608e847d566739ac6caeba | 2026-06-19 | references/documentation-mcp.md |
| src/docs/principles/foundations/testing.md | 4d7b9a8d05426ddd083c59ac6b9576937dfcaa3da086b8ce47edd0dd716e3656 | 2026-07-01 | references/testing.md |
| src/docs/principles/quality/observability.md | 8aa60e213ba03e989c93263153e3a1ac10b2336f6d0360c394f473660d565a0b | 2026-06-26 | references/observability.md |
| src/docs/principles/quality/security.md | 61157d97677142737ec537954dc5aaad7a04012cc8a3dcc855e2d324287fdc64 | 2026-06-26 | references/security.md |
| src/docs/principles/quality/reliability.md | 9c9788504e0963458667d2727c3fc2359776108be593a2efc6603f6470002252 | 2026-06-26 | references/resilience.md |
| src/docs/principles/quality/performance.md | 18b6d3391c57d97342068f9f1da732b24de4221489d0459bb6ad8900fac0a02e | 2026-07-02 | references/resilience.md |
| src/docs/principles/foundations/documentation.md | ed13b69b8a128dbc416b5f5108b5424bc1a3b755cf425c4fb4eaca5d591bc1da | 2026-07-02 | references/documentation-mcp.md |
| src/docs/principles/ai-native/ai-engineering.md | 497dd03b03ec00d6f18d3c5d843b8be1117d588eb28e24e96c3330b64a0a16cb | 2026-07-02 | references/ml-systems-ai-engineering.md |
| src/docs/principles/ai-native/agent-native-systems.md | a59972f54655061a66e696b000fb484563f7e882a463d7d448fe848f6b1a6162 | 2026-07-02 | references/ml-systems-ai-engineering.md |
