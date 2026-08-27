# Slice 8 — the blind review

A fresh reviewer, given only the diff 9b98767..afceeae and the slice brief. It re-materialized both fixtures, re-ran the binary, and re-graded against both keys. Its report, verbatim:

---

I re-materialized both fixtures myself, re-ran the binary, and re-graded against both keys. The repo is untouched.

## What I probed and found clean

- **The recorded outputs are real.** I rebuilt the binary, cloned both branches, reset to the tip's parent, applied the plan copies from the diff, and ran `board` and `verify`. All four outputs reproduce byte-for-byte against `docs/evidence/bet-3/slice-8/runs.md`, modulo commit hash and timestamp. Nothing in that record is fabricated.
- **The translation is honest.** I read both plan copies against both `PLAN-INTENT.md` files, id by id. Program, bet, milestone, slice, facing and proof ids all match the prose. No marker is wrong. No translation choice hid a red or invented one.
- **No invented miss, no misattribution.** Every grade the record states matches the key: sift's six statuses, gauge's three stub styles and their line numbers, both sets of landing commits. The "checks-side, not translation-side" attribution is correct for all four filed findings.
- **The red commit was honestly red.** `fa65ea1` added only the test file; the placeholder branch fires there.

## Findings

**1. Two of the four graded questions were never asked, and the record does not say so. Serious.**
`docs/ladder.md:55` sets bet 3's done-when in four clauses. The grading exercised decomposition and the stub styles. It never exercised "the board starts red for the right reason" or "three slices land in sequence". `runs.md:30` says each fixture was run twice, both times at one mid-bet commit. Both fixtures carry the earlier commits needed; nobody ran there. Caught by reading the slice plan's four clauses against the two `board` invocations. The fixtures are now burned, so this loss is permanent, and `docs/evidence/bet-3/holdout.md` claims a complete grade without naming it.

**2. F120 understates the fault, and only because of finding 1. Serious.**
I ran `board` at the sift commits the grading skipped. At `035d288` — the red-proof commit, nothing implemented — the board reports `s_tokenize  LANDED yes` while both its proofs fail. At `af14585` it reports milestone 1 fully landed, expects `p_record_parse` green, sees it fail, prints `behind its plan`, and exits 1. So the fault is not only a stray pointer: LANDED and EXPECTED are wrong at every red-proof commit, and the board goes falsely behind-plan with a non-zero exit. `docs/findings.md:1329` says only "landing pointers aimed one commit early" and classes it `green-but-wrong`. The real worst case is a false red. D66.1 was ruled on that understated version.

**3. "Each one turns exactly its own row green" cannot be met by design, and the grading never noticed. Moderate.**
`docs/derivation-contract.md:369` makes the milestone the unit, not the slice. My run at `9bfa992` confirms it: `s_tokenize` is landed, its proofs still read EXPECTED red, and both are flagged `ahead of plan`. The ladder's done-when and the board's own rule contradict each other. Slice 8 is the moment that contradiction was due to surface. Related: the slice's own front matter at `docs/plan/rebuild/bet_3/b3s8.md` declares the fixture as "a two-milestone bet whose three slices land in sequence". Neither sealed repo is that — sift lands two of four, gauge two of five. That mismatch also went unrecorded.

**4. There is a fifth finding hiding, in the sift key's facing wrinkle. Moderate.**
`holdout.md:46` says trace counts ids per slice, not per proof, so the predicted miscount never happened. That is true but it is the hole, not the absence of one. R11's sibling rule R12 says each facing id is "claimed by exactly one slice's **proof**"; `internal/trace/trace.go:10` implements "claimed by exactly one of its **slices**". Nothing anywhere links an item to a proof. So an item a slice claims but no proof asserts is invisible to every row. Cost nothing on these fixtures — exactly like F122, which was filed. Caught by reading R12's wording against the trace row's own comment.

**5. The headline score is wrong on its own terms. Minor.**
`holdout.md:24` reads "one miss, one false red". Nothing went falsely red at either tip: F120 is classed `green-but-wrong` and describes a green row with a wrong hit. Meanwhile the one genuinely contestable red — `wiring` on gauge, which sends `verify` to exit 1 — was cleared into prose, and F121 files only its wording. The score line and F120's own class disagree.

**6. The proof test does not prove what its marker says. Moderate.**
`internal/battery/holdoutgrading_test.go` checks one anchor, one heading, the absence of a placeholder, twenty words, and two repo names. It never opens `runs.md`. It cannot see whether a run happened, whether it happened once, or at which battery version. The marker claims "the sealed fixtures are run once" and the test proves that prose exists. `runs.md` is also absent from the slice's `records:` list, so no row and no test pins it; a later edit could gut it and everything stays green.

**7. The record over-claims singleness. Minor.**
`holdout.md:22` says "no fixture was run a second time". `runs.md:804` discloses a throwaway program that ran `plan.Load` and `manifest.Load` against both fixtures before the graded run. It changed nothing, but the `plan` row's green was pre-tested with the battery's own loader. The grading record's flat sentence drops that, and no rule was stated for what to do had the plans failed to parse — adjusting them there would have been tuning.

**8. Attribution is inconsistent across the four findings. Low.**
`docs/findings.md` 1318–1362: F119 and F120 say `Caught by: battery`, F121 says `worker`, F122 says `blind-review`. All four came out of the same runner-plus-grader pair. Each line is individually defensible; together they make the ledger hard to count by source.
