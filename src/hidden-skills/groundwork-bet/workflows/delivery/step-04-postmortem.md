# Delivery Step 4 — Milestone postmortem & opening the next rung

The spine (`../04-delivery.md`) routes here after a milestone closes. Run the postmortem, pause per the chosen mode, then either open the next milestone (below) or, on the final milestone, transition to Validation.

## Milestone postmortem & course-correction

A green milestone is not a finished milestone. The board going green proves the suite passes; it does not prove the milestone proved *what it set out to prove*, nor whether what it taught us should change the rest of the plan. Validation's retrospective is too late for that — by then the whole bet is built against assumptions a mid-bet milestone may already have disproved. This checkpoint is the proactive one: at every milestone boundary, before the next one opens, run a focused pass over four questions, then open the next rung — a facilitated conversation, not a ceremony, and where the next milestone is sliced from what this one taught while it is still cheap.

1. **Did this milestone honestly prove its intent, at the front door?** Start from the acceptance-auditor's milestone-scope verdict (dispatched at the close, `step-03-milestone-close.md`) — an independent read of the Proof-of-work prose against the assembled diff, so this judgment is no longer the driver attesting to its own delivery. The board is green — but is it green for the right reason, driven through the real product (the honest-green tells, `../03-decomposition.md` Step 3)? The failure this catches is the *quietly hollowed proof* — a real dependency the milestone meant to prove faked by the time the last slice closes while the suite stays green. When the auditor (or your own read of its evidence) finds one, work the real thing in and re-prove it through the shipping build now — not roll forward and discover at validation that the bet never proved its core premise. Treat a deferred-to-mock-where-the-real-thing-was-meant as a finding, every time, even on a fully green board.

2. **What did building this milestone teach that the remaining plan does not yet know?** Implementation reveals what design could only assume. Re-read the remaining ladder in light of what is now built: an assumption that broke, a downstream slice now redundant, a slice now missing because a real boundary needed wiring the design did not foresee, a downstream proof that reads wrong now its premise is concrete, or a whole milestone the ladder is missing. The question is not "is the plan still perfect" — it is "does what we learned change what we should build next." Route by weight: (a) only *how the next rung should be sliced* → carry it into *Opening a milestone* (below); (b) the ladder is *missing a rung* → *Introducing a milestone* (below, within appetite); (c) an approved *rung, design, or the appetite* is wrong → an Amendment or Change Navigation (Q3).

3. **Route any needed change through the integrity machinery — never a silent edit.** A change to *what the plan proves* (a milestone's or slice's Proof of work, an acceptance criterion) is an **Amendment** (`on-amendment.md`, with its commit format). A change to the *design itself* (an API/data shape, a milestone's existence, the appetite) is **Change Navigation** (`on-change-navigation.md`): write the change proposal and route by severity — though a *missing rung that fits the appetite and the locked design* is the lighter **ladder amendment** handled in-delivery (*Introducing a milestone* below), with no revert. Either way the trail — the recorded amendment commit, or a change-proposal file — is what lets the next slice's prose-integrity reconciliation tell an approved change from a silent one. "Adjust as we go" is a feature of this process precisely because it leaves that trail.

4. **Where does the delivered work actually stand?** Note anything the milestone surfaced that the next milestone or the final validation needs — a readiness caveat, a discovery-note signal for a future bet (`.groundwork/cache/discovery-notes.md`), a `docs/maturity.md` row. Capture it now while it is fresh; do not bank on remembering it at validation. Append a ~2-line postmortem gist to the memlog (`./dev bet log <bet-slug> -- "M<N> postmortem: <gist>"`) so a fresh-context resume reads the lesson without replaying the whole milestone.

**Pause per the chosen mode.** In slice-by-slice and milestone-by-milestone modes, always pause here: present the postmortem and get the user's decision before opening the next milestone. In whole-bet mode, surface the postmortem summary and proceed automatically *unless* it found a course-correction (a hollowed proof, a remaining-plan change, an amendment, a new milestone, or a Change Navigation) — that is the user's call and pauses even in whole-bet mode. Routinely authoring the next rung's slices is *not* a course-correction; a clean postmortem rolls straight on, the scoped Protocol 9 review gating the new slices.

**Then open the next milestone.** With this milestone's lessons in hand, the user's go-ahead (or whole-bet autonomy), and any ladder amendment or Change Navigation already routed, run *Opening a milestone* below. (The final milestone has no next rung; its postmortem closes into Validation.)

## Opening a milestone — authoring the next rung

Every milestone after the first is *unsliced* until Delivery reaches it: decomposition approved its headline proof in the ladder, not its slices. Opening it is where those slices are authored — deferred so they are written from what the milestones before them *actually taught*, not an up-front guess. This is *plan just enough* in motion.

For milestone 1 there is nothing to open — roll straight into the Slice Loop. For every later milestone, open it at the end of the previous milestone's postmortem:

1. **Author the milestone's slices** following Decomposition Step 4–5 (`../03-decomposition.md`) — vertical slices, falsifiable Required Capabilities tracing to the design, a headline Proof of work per slice, all consistent with the milestone's approved headline proof. Apply what the delivered milestones taught: a foreseen slice may now be redundant, a boundary may now need one the design missed. This is the freshest place to set a slice's **Model tier** lift — a slice now visibly challenging or vague from ground truth flags `frontier` (Decomposition Step 4).
2. **Review them** — run the Decomposition Gate scoped to this milestone, then the Protocol 9 decomposition review on the new slice files (fail-closed, exactly as Decomposition Step 6). Revise to a clean verdict.
3. **Record the authored slices** — on the user's approval, commit the new slice files (`bet(<bet-slug>): author milestone <N>`). This is additive authoring — it adds this rung's slices and changes no existing proof.
4. **Materialize this milestone's slice stubs** (`step-01-readiness.md` Step 0.5's procedure, scoped to the new slices) and commit the extended red board before the Slice Loop opens its first slice.

If opening the milestone reveals the *headline proof itself* is now wrong — not just its slices — route it through the Amendment Protocol (`on-amendment.md`) or Change Navigation (`on-change-navigation.md`).

## Introducing a milestone — a ladder amendment

The ladder is fluid: a postmortem can reveal that a milestone is *missing* — a demonstrable state the bet needs that the up-front ladder did not foresee. Introducing a new rung is a supported, first-class move. Because downstream milestones are unsliced, inserting or re-ordering one is cheap — there are no authored slices to unwind.

1. **Appetite check first.** Confirm the new rung fits the bet's **appetite** and is derivable from the locked design. If it would exceed the appetite, or needs capability the design never covered, stop — that is Change Navigation, not a ladder amendment. Never grow the ladder silently to absorb scope the bet did not bet on; the "2–5 milestones; more is a roadmap" rule (`../03-decomposition.md`) still bounds it.
2. **Author the new milestone's `index.md`** with a **front-door headline proof**, placed and numbered at the right rung (re-numbering unopened downstream folders is cheap — they are unsliced).
3. **Review it** — the Decomposition Gate scoped to the new milestone, then the Protocol 9 decomposition review (fail-closed). Revise to a clean verdict.
4. **User approval is a hard stop** — adding a success-signal rung changes the definition of done.
5. **Record the new rung** additively (`bet(<bet-slug>): add milestone <N>`) and **materialize its headline stub**. Its slices are authored when Delivery reaches it, via *Opening a milestone* above.

---

➡️ Next milestone opened (slices authored, reviewed, recorded, stubs materialized)? Return to the Slice Loop: `step-02-slice-loop.md`. Final milestone's postmortem done? Proceed to Validation: `../05-validation.md`.
