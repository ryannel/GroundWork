---
id: s_convert
bet: bet_length_kit
milestone: m2_arithmetic
proofs:
  - id: p_convert_feet
    marker: TestProof_p_convert_feet_ConvertsMetresToFeet
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
  - id: p_convert_round_trip
    marker: TestProof_p_convert_round_trip_ReturnsToTheSameMetres
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
fixtures:
  - metres going out to feet, and feet coming back to metres
real:
  - the converter itself
faked: []
facing:
  - i_to_feet
  - i_round_trip
---

# Slice — convert metres to feet, and back again without drift

Translated from `PLAN-INTENT.md`, sections "The slices" and "The proofs".
