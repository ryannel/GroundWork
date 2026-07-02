# Sync Anchor

This file pins the principle files this skill embeds. When any listed file
changes, this skill must be reviewed in the same commit. CI verifies the
hashes match (`scripts/check_sync_anchors.py`, run by `./dev test contracts`).

The `references/` in this skill are self-contained distillations of these
sources, written for the designer's decision-time lens. A source edit forces
a review of the matching reference so the distillation never drifts.

| Principle file | SHA-256 | Last reviewed | Distilled into |
|---|---|---|---|
| src/docs/principles/design/design-foundations.md | 8e9a9e29e2d3787b0242df75e6aa090b817ba19d675fec494d725d71b21ad584 | 2026-06-20 | SKILL.md ("The principles you carry"), references/design-review.md |
| src/docs/principles/design/visual-design.md | 40c4a59f2658f6075f60c745ac1d320afa1a2728542a1c0145153dc1752e20d2 | 2026-06-21 | references/visual-craft.md |
| src/docs/principles/design/layout-and-space.md | 757c407126cf3cbc60be071bbdf6d17721c8d77105c7e6a9a6237d039fa1d09b | 2026-06-20 | references/layout-and-space.md |
| src/docs/principles/design/interaction-and-motion.md | 99c47d80bd0960b5bd325842cb55199697e10917034511a82af89c873fc76e39 | 2026-06-20 | references/interaction-and-motion.md |
| src/docs/principles/design/usability-and-ux.md | 912999d2e125b393dbe46b7cf7a4172f5e5f2a48c3bc8459d8166afe34eb527c | 2026-06-27 | references/usability-and-ux.md |
| src/docs/principles/design/design-systems-and-tokens.md | 3a7b416e122e4d79451a6ac2de56c7cb9142999902d60a20801572c24e201bcd | 2026-06-20 | references/design-systems-and-tokens.md |
| src/docs/principles/design/ai-native-design.md | b70c6906aad413e3cf40e7493cd247a8b47b5bfcd010841f22793e23348836ff | 2026-06-20 | references/ai-native-design.md |
| src/docs/principles/quality/accessibility.md | f921e7bf6256bc105b127b841d0a30af8a70ad1ddd7632d492589f052e6501b2 | 2026-06-20 | references/accessibility.md |
