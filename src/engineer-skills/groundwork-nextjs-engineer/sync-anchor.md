# Sync Anchor

This file pins the principle files this skill embeds — both the per-stack
TypeScript/frontend idiom doc and the cross-cutting central canon this skill
distils. When any listed file changes, this skill must be reviewed in the same
commit. CI verifies the hashes match.

| Principle file | SHA-256 | Last reviewed | Distilled into |
|---|---|---|---|
| src/generators/nextjs-app/docs/principles/stack/typescript/frontend.md | 98232d067ad03c08d6c1ca5f2caec30e7c3400da55c3afb7754482bc121d7554 | 2026-05-26 | references/server-components.md, references/data-fetching.md, references/tailwind-and-styling.md, references/architecture.md, references/accessibility.md, references/performance.md, references/version-corrections.md |
| src/docs/principles/foundations/testing.md | 4d7b9a8d05426ddd083c59ac6b9576937dfcaa3da086b8ce47edd0dd716e3656 | 2026-07-01 | references/testing.md |
| src/docs/principles/quality/observability.md | 8aa60e213ba03e989c93263153e3a1ac10b2336f6d0360c394f473660d565a0b | 2026-06-26 | references/observability.md |
| src/docs/principles/quality/security.md | 61157d97677142737ec537954dc5aaad7a04012cc8a3dcc855e2d324287fdc64 | 2026-06-26 | references/security.md |
| src/docs/principles/quality/performance.md | 18b6d3391c57d97342068f9f1da732b24de4221489d0459bb6ad8900fac0a02e | 2026-06-26 | references/performance.md |
| src/docs/principles/quality/accessibility.md | f921e7bf6256bc105b127b841d0a30af8a70ad1ddd7632d492589f052e6501b2 | 2026-06-26 | references/accessibility.md |
| src/docs/principles/foundations/documentation.md | ed13b69b8a128dbc416b5f5108b5424bc1a3b755cf425c4fb4eaca5d591bc1da | 2026-07-02 | references/documentation.md |
