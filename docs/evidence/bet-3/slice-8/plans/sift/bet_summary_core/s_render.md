---
id: s_render
bet: bet_summary_core
milestone: m2_summarise
proofs:
  - id: p_render_table
    marker: TestProof_p_render_table_PrintsAnAlignedTable
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
  - id: p_render_empty
    marker: TestProof_p_render_empty_SaysWhenThereIsNothing
    from: PLAN-INTENT.md#the-proofs
    headline: true
    retire_at_close: false
fixtures:
  - counts of more than one kind, and no counts at all
real:
  - the renderer itself
faked: []
facing:
  - i_table_output
  - i_empty_report
---

# Slice — print the counts

One kind per line, sorted by kind, aligned. A plain line when there is nothing
to report.

Translated from `PLAN-INTENT.md`, sections "The slices" and "The proofs".
