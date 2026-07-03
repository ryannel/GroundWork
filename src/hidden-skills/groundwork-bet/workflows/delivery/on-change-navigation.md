# Delivery: Change Navigation

Loaded only when triggered — implementation reveals the locked design committed to something wrong.

## Change Navigation — when reality contradicts the locked design

Mid-delivery discoveries that invalidate the design are not failures of the process; pushing through them silently is. When implementation reveals the design committed to something wrong — surfaced by a slice-worker, a review, or the milestone postmortem:

1. **Pause the slice** and write a change proposal at `docs/bets/<bet-slug>/change-proposal-<n>.md` (template: `.groundwork/skills/groundwork-bet/templates/change-proposal.md`): the discovery and its evidence, the impact across pitch / technical design / decomposition / built artifacts, the before/after of every proposed edit, and the severity.
2. **Route by severity.** *Minor* — the API/data design and milestones survive, specific proofs or design sections need correction: on approval, apply the edits, re-review mutated docs (Protocol 9), amend affected proofs through the Amendment Protocol (`on-amendment.md`), resume the slice. *Ladder amendment* — the design holds and the ladder is simply missing a rung that fits the appetite: not a design contradiction at all — handle it in-delivery via *Introducing a milestone* (`step-04-postmortem.md`), no revert. *Structural* — an API/data design, a milestone, or the appetite itself is wrong: on approval, revert to Design Foundations (`status: design`), rework the design with the proposal as input, and re-run Decomposition for the affected scope; unaffected delivered slices stand.
3. The proposal stays in the bet directory either way — the audit trail Validation and the retrospective read.
