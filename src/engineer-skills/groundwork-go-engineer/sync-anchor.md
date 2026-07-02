# Sync Anchor

This file pins the principle files this skill embeds — both the per-stack Go
idiom docs and the cross-cutting central canon this skill distils. When any
listed file changes, this skill must be reviewed in the same commit (and the
matching per-stack idiom doc reconciled to the canon). CI verifies the hashes
match.

| Principle file | SHA-256 | Last reviewed | Distilled into |
|---|---|---|---|
| src/generators/go-microservice/docs/principles/stack/go/index.md | 5404a872df986823ca05107485ec6e22952c25b39882e44ed82316c0044f0973 | 2026-06-19 | references/go-services.md |
| src/generators/go-microservice/docs/principles/stack/go/concurrency.md | e63a90b46f85ad63f0e1535f105106b9f30bff58e0270e9dc8d4b8f91951e0ca | 2026-05-26 | references/concurrency.md |
| src/generators/go-microservice/docs/principles/stack/go/testing.md | fd3561fbcb1c79bbd219ff0e76b8958898b0159daacef41bcf59092613773064 | 2026-06-26 | references/testing.md |
| src/docs/principles/foundations/testing.md | 4d7b9a8d05426ddd083c59ac6b9576937dfcaa3da086b8ce47edd0dd716e3656 | 2026-07-01 | references/testing.md |
| src/docs/principles/quality/observability.md | 8aa60e213ba03e989c93263153e3a1ac10b2336f6d0360c394f473660d565a0b | 2026-06-26 | references/observability.md |
| src/docs/principles/quality/security.md | 61157d97677142737ec537954dc5aaad7a04012cc8a3dcc855e2d324287fdc64 | 2026-06-26 | references/code-craft-security.md |
| src/docs/principles/foundations/code-craft.md | 4575548b540d86ecb44e255d81d7c0dbd638b209ea5a157119d5c887ecb292d7 | 2026-07-02 | references/code-craft-security.md |
| src/docs/principles/quality/performance.md | 18b6d3391c57d97342068f9f1da732b24de4221489d0459bb6ad8900fac0a02e | 2026-06-26 | references/reliability-performance.md |
| src/docs/principles/quality/reliability.md | 9c9788504e0963458667d2727c3fc2359776108be593a2efc6603f6470002252 | 2026-06-26 | references/reliability-performance.md |
| src/docs/principles/foundations/documentation.md | ed13b69b8a128dbc416b5f5108b5424bc1a3b755cf425c4fb4eaca5d591bc1da | 2026-07-02 | references/documentation.md |
