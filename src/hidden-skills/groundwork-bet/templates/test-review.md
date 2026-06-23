# Test Review: [Bet Name]

*This document puts the bet's proof of work in front of the user before they approve it. Approving means: turning these tests green is the definition of done for this bet. Each entry describes one milestone or slice test in plain language — what it proves and why that is the right proof — so the user is reviewing what will be built, not reading test code. Write the prose from each test's target-state intent; never paste assertion code here.*

*This is the headline suite — the high-impact proofs written up front. The granular edge-case and permutation tests are added during Delivery, as each slice is built (see `decomposition.md` → Test Plan). Keep this surface to the proofs that matter for the review.*

---

## Milestone [N]: [Milestone Title]

**Proves:** [the consumer-visible outcome this milestone reaches, in plain language — one or two sentences. State what becomes true about the product, not how the test is written.]

**How we prove it:** [the shape of the proof in prose — what the test exercises end to end and the observable condition it passes on. A reader should understand the test without seeing its code.]

**Test:** `tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.<ext>` · traces to [the interface in `03-api-design.md` (or store in `04-data-design.md`) for a capability milestone, or the surface subsection in `01-ui-design.md` for a surface milestone].

---

### Slice [N.M] — [service]: [Slice Title]

**Proves:** [the vertical capability this slice contributes, in one plain-language sentence — what it makes true that the milestone depends on.]

**Test:** `tests/bets/<bet-slug>/test_slice_<N>_<service>_<slice-slug>.<ext>` · traces to [the contract operation, channel, or schema table it rests on].

---
*(One entry per milestone test and one per slice test — the headline suite, not every assertion. A test in the suite with no entry here is unreviewed; an entry describing a test that no longer exists, or whose proof no longer matches the test, is stale — both block the sign-off.)*
