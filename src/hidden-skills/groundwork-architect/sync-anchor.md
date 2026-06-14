# Sync Anchor

This file pins the principle files this skill embeds. When any listed file
changes, this skill must be reviewed in the same commit. CI verifies the
hashes match (`scripts/check_sync_anchors.py`, run by `./dev test contracts`).

The `references/` in this skill are self-contained distillations of these
sources, written for the architect's decision-time lens. A source edit forces
a review of the matching reference so the distillation never drifts.

| Principle file | SHA-256 | Last reviewed |
|---|---|---|
| src/docs/principles/system-design/hexagonal-architecture.md | db8b8522781944df561e2ce48ebc6f0ed5bdeeaebf12e8d5a4d4efd7056e208c | 2026-06-14 |
| src/docs/principles/system-design/api-design.md | 59d550461bb400732340b15739256bf38160e03e1d0db47cad6e9b496b170590 | 2026-06-14 |
| src/docs/principles/system-design/integration-patterns.md | 4f35102594c4ba8d7334960a17bb49e80637a5d5852f3449a198043640855005 | 2026-06-14 |
| src/docs/principles/system-design/real-time.md | 33432760cf02f49e50cfbc4dfc4a108f13e5611c3f17163c7bc0bbfd4a2c65f5 | 2026-06-14 |
| src/docs/principles/system-design/data-engineering.md | 887df4c63ea5b0b5a49205799e145e309bcf00bea2977918e729c1758e3c456e | 2026-06-14 |
| src/docs/principles/quality/reliability.md | 6bd829f36618bcd09f89828783a8e49e627d36f0bc24da6a43114ee0636f0c74 | 2026-06-14 |
| src/docs/principles/quality/performance.md | 18904b7e9f4eddc1c0b9b7de57b55ff8bcb218aea7d213f9520938ec6e8558d6 | 2026-06-14 |
| src/docs/principles/quality/observability.md | e7d22e13a7fb2e0053508079d378c5d7b2df0b4fa8dff0a2c87644f66f72a184 | 2026-06-14 |
| src/docs/principles/quality/security.md | f3e4578fe408e6eb4c9a419d6585e7440fc642c641e73b8acba695696d61a33a | 2026-06-14 |
| src/docs/principles/quality/privacy.md | 4cc7ef656c2cc5b48932f3dccc40ff59c6598a1effb66a944f3bd2fed468dd81 | 2026-06-13 |
| src/docs/principles/delivery/platform.md | e65c9ebf8ec125f77677291e93effad8e7c7824b32d5dc9536bcbd56d963fe92 | 2026-06-14 |
| src/docs/principles/delivery/progressive-delivery.md | 4e29819df3ffa4da2b60e15b6491219ca1ba0810d0ecc4ce196135473ca03e22 | 2026-06-14 |
| src/docs/principles/delivery/cost-engineering.md | 541a70fe40fcf239250a40c919c22e55ea52d8f7ef44a22fb7bf6862f3dcec45 | 2026-06-14 |
| src/docs/principles/ai-native/agent-native-systems.md | 60e7c7bdc376340e87169a6bcae0b90c812d7eda52763d10350df14b5b7f0fd0 | 2026-06-13 |
| src/docs/principles/ai-native/ai-engineering.md | c45bab702c57e6c58b3572f2f1af36adf1c89f4b9da6d0f9f2361e0880c9e01a | 2026-06-13 |
| src/docs/principles/ai-native/agentic-systems.md | dabc4be9c7aa9b43a0ce7428369ed29c87388ceb614c84a5c06462ffd28abcfc | 2026-06-14 |
| src/docs/principles/system-design/architecture-decisions.md | 6882b60d363ab32857dfdfd2c26ccb23a753300c2e412ff8cf378c661fb8bf41 | 2026-06-14 |
| src/docs/principles/system-design/evolutionary-architecture.md | 03ecc9d6be68b4b043fcbfea45d683b643bc567cdb36f1a23d1c9d54fe152437 | 2026-06-14 |
| src/docs/principles/system-design/surface-architecture.md | 6300fca8509c483e3ad371f6527c931b00bbe77e46b660c56c87a9c0d4e8c2dc | 2026-06-14 |
| src/docs/principles/system-design/identity-and-access.md | ba8b3a25d00ff79cc598ff2937e8709bfa753fc7a83ec1b2e094e1f246f2f539 | 2026-06-14 |
| src/docs/principles/system-design/durable-execution.md | 74a533606e3b03c4ce3549f0b1af46a6d59e86769132aa9f248432af6ddd00bd | 2026-06-14 |
| src/docs/principles/index.md | 59e0d6bd8f83846ef243508479ed99c58cd4742bce7eb2f4da1d86bb8b62c54a | 2026-06-13 |
