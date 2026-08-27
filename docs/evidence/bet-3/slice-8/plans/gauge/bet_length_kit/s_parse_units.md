---
id: s_parse_units
bet: bet_length_kit
milestone: m1_read_and_print
proofs:
  - id: p_parse_metres
    marker: TestProof_p_parse_metres_ReadsAPlainMetreLength
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
  - id: p_parse_centimetres
    marker: TestProof_p_parse_centimetres_ReadsCentimetresAsMetres
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
fixtures:
  - a length written in metres, and one written in centimetres
real:
  - the unit parser itself
faked: []
facing:
  - i_read_metres
  - i_read_centimetres
---

# Slice — read a plain decimal length with a metric unit suffix

Translated from `PLAN-INTENT.md`, sections "The slices" and "The proofs".
