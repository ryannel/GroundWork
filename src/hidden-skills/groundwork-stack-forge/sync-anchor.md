# Sync Anchor

This file pins the principle files this skill embeds. When any listed file
changes, this skill must be reviewed in the same commit. CI verifies the
hashes match (`scripts/check_sync_anchors.py`, run by `./dev test contracts`).

The Day-2 baseline is the bar every forged stack's seed is held to
(`instructions.md`), elaborated per-stack in `references/authoring-engineer-skills.md`.
A source edit forces a review of that elaboration so it never drifts from the
canonical bar.

| Principle file | SHA-256 | Last reviewed | Distilled into |
|---|---|---|---|
| src/docs/principles/delivery/day-2-operational-baseline.md | f2d123df38883ba4a8182a6ca5eb763c29fd82672be0c0f79241459225e8cead | 2026-07-02 | instructions.md, references/authoring-engineer-skills.md |
