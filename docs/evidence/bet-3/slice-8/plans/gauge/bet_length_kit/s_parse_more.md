---
id: s_parse_more
bet: bet_length_kit
milestone: m2_arithmetic
proofs:
  - id: p_parse_fraction
    marker: TestProof_p_parse_fraction_ReadsAFraction
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
  - id: p_parse_negative
    marker: TestProof_p_parse_negative_RefusesANegativeLength
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
fixtures:
  - a length written as a fraction, and a negative length
real:
  - the parser itself
faked: []
facing:
  - i_read_fraction
  - i_refuse_negative
---

# Slice — read a fraction, and refuse a negative length

Translated from `PLAN-INTENT.md`, sections "The slices" and "The proofs".
