# Decisions

This file is the decisions ledger. It holds rulings: what was decided, and why. It is append-only.

## D1 — 2026-08-22 — Toolchain and repo shape

Decided 2026-08-08. Recorded 2026-08-22.

The rebuild is Go. It ships as a single binary. There is one repository, not two. Main was blanked by a single reset commit.

Why: the tool runs all the time. A single binary means nothing else has to be installed to run it. Consumer repos get the framework without Node. One source tree builds for every platform. So we can pick a platform later.

The execution plan carries this. It was ratified in PR #31.

## D2 — 2026-08-22 — Ratification executed

PR #31 merged as 275a2a7. The `legacy` branch was cut at that commit. The reset commit is 75fbd5b.

The driver flipped the Status headers of the ladder and the execution plan to ratified. The driver also fixed two stale counts in the ladder. See F2.

Why: the record of the act belongs in the ledger it created.

## D3 — 2026-08-22 — Module path

The Go module is `github.com/ryannel/groundwork`.

Why: it matches the repo address. It is lowercase, by Go convention.

## D4 — 2026-08-22 — Ruling on O34

O34 asks two things: how do we sequence execution, and which repos serve as proving grounds.

Sequencing is the ladder as ratified. There is no separate sequencing artifact.

Proving grounds: wordloop and magpie calibrate the Record's doc checks. Staycurrent is the held-out third repo. Magpie is the leading candidate for first real consumer. The final call on that is deferred to Bet 15.

Why: the spec's own evidence already names these repos for these roles. Deferring the consumer call costs nothing until Bet 15.

This ruling is reversible by a later decision.

## D5 — 2026-08-22 — Bet 0's branch

Bet 0 runs on branch `claude/v2-clean-slate-tkuacl`. The host fixed that branch name for this session. It lands on main by pull request.

Future bets name their branches `bet-N-<short-name>`, when the host allows.

Why: the host fixed the branch name for this session. Fighting it buys nothing.

## D6 — 2026-08-22 — Legacy CI pin

On the `legacy` branch, ci.yml's push filter moves from `[main]` to `[legacy]`. Release tags on that branch use a `legacy-v*` prefix.

Scheduled runs of integration.yml stop on legacy, because GitHub runs schedules only from the default branch. Manual dispatch still works.

Why: legacy must keep building on its own line without firing on main, which no longer holds its code.

## D7 — 2026-08-22 — Bet 0 closes

All four done conditions were checked against evidence. CI failed the on-purpose red test (run 222) and went green on its removal. Legacy's CI ran green on the legacy branch (run 220). The port list landed after register review. The ledgers hold the settled decisions.

One deviation from the ladder's wording, on purpose: the ladder expected the port list and its review to be two commits. Here the review ran before anything landed, so the list is one commit and F6 is the review's record. Stricter, not looser.

Why closing is right: a bet closes when its done conditions hold and no open question it owns remains. O34 was ruled in D4.

## D8 — 2026-08-22 — Ruling on O17: the journal's event schema

One event is one JSON object on one line. Each line is its own blob. It lives in the ref `refs/groundwork/journal`, at path `events/<session-id>/<sha256-of-the-line>.json`.

Why: appending to one shared file conflicts on every parallel branch. One path per line, named by content, lets two journals merge as a tree union. Nothing needs resolving. Replays land on the same path.

Order comes from the `ts` field, not the tree. Writes go through git plumbing. A journal write never touches the working tree.

Every line carries an envelope: `v`, `ts` (RFC3339 UTC), `kind`, `session`, `seq`, `commit` (HEAD at write time, may be empty), `branch`.

This bet has three kinds:

- `dispatch` — adds role, tier, tokens in/out/total, tokens_source, duration_ms, outcome.
- `dial` — adds from, to, scope, reason.
- `seal` — adds seal_kind, tag, target, action.

Here is one example line, for `dispatch`:

```
{"v":1,"ts":"2026-08-22T14:03:11Z","kind":"dispatch","session":"s-4f2a","seq":7,"commit":"a1b2c3d","branch":"claude/v2-clean-slate-tkuacl","role":"worker","tier":"execution","tokens":{"in":18422,"out":3110,"total":21532},"tokens_source":"host-report","duration_ms":184000,"outcome":"delivered"}
```

Two vocabularies are closed. A write outside them is rejected at write time, not warned.

Role: driver, worker, adversary, blind-author, capsule-writer, advisor, sim.

Tier: frontier, execution.

The session id comes from `GROUNDWORK_SESSION`. If that is unset, the tool generates one, and the line says so.

Later bets add kinds. The envelope does not change.

## D9 — 2026-08-22 — Ruling on O10: finding attribution and archival layout

The catcher vocabulary is closed: blind-review, battery, ci, driver, worker, owner-in-review, owner-in-use.

Every finding also carries a free detail line. That line names the specific review or check. The field is required at write time. The tool refuses an entry without it.

Why: the old world had this field optional. It was filled 0 times in 114 findings. An optional field is a field nobody fills.

Review outputs commit under `docs/evidence/<bet>/<slice>/`. They are never deleted.

This is ruled now. Slice 6 enforces it. The archive step itself belongs to later bets.

## D10 — 2026-08-22 — Ruling on O12: defect classes and the recurrence threshold

Nine classes, seeded from the evidence mining:

- green-but-wrong
- parallel-definition
- unrun-proof
- coverage-gap
- front-door-hollow
- record-not-written
- friction-waived
- register
- other

`other` needs a one-line reason. Heavy use of `other` is a sign to add a class.

Threshold: three findings of one class inside one bet, or five across two bets, forces an upstream change. That change is a rule, a check, a template, or a walk step. It gets recorded here, named from the class.

Why: in the mining, the dominant class appeared three times before anyone named it. Two is coincidence.

The count is mechanical. CI fails while a class is over threshold with no linked decision.

## D11 — 2026-08-22 — Bet 1 designed: the slice cut and small rulings

Bet 1 runs on the host-fixed branch, like bet 0. See D5.

Six slices:

1. The CLI skeleton and the dispatch writer.
2. The dial and seal verbs, plus vocabulary rejection.
3. The spend query, read from the ref alone.
4. The journal merge verb. Two branches, both lines survive.
5. The token cross-check against the host's reported usage.
6. Attribution and class tags on the findings ledger, checked in CI.

Small rulings from the design read:

Recurrence counting parses `docs/findings.md`, not the ref. The ref gains a finding kind in a later bet.

A journal line's `commit` field is HEAD at write time. It may be empty.

"Git discipline" in the ladder's Lands line means the per-slice backup push. That push carries the journal ref.

The findings backfill — adding Caught by and Class lines to F1–F6 — is a one-time format upgrade. It touches no entry's prose. Append-only is not violated.

The token cross-check includes one human step: the driver transcribes the host's reported figure. That is accepted for this bet.

Why this cut: the writer lands first because every later slice reads what it wrote. Verification of the ref's content (spend, merge, cross-check) follows the verbs that fill it. The findings check is last because it gates CI and needs the backfill.

## D12 — 2026-08-22 — tokens_source defaults to "unset"

A dispatch line's `tokens_source` says where its token figures came from. The CLI's default was `host-report`, which records a provenance claim the caller never made. That defeats the field. The default is now `unset`.

Why: a provenance field that lies by default is worse than none. The slice 1 blind review caught this.

## D13 — 2026-08-22 — Slice 2 rulings: rungs, seal actions, dial-chain scope, timestamps

Four rulings from building the dial and seal verbs.

The rung vocabulary is closed: slice, milestone, bet, program — the spec's own four, floor slice. The seal action vocabulary is closed: granted, revoked. The spec also names a seal being moved; until the amendment protocol lands in a later bet, a move is recorded as two lines — revoked, then granted.

The dial chain is repo-global and branch-blind. A scope's rung belongs to the work, not to a branch or a session, so the chain reads the whole ref. Consequence, accepted: after journals merge, replaying the chain can disagree with recorded from values. The merge slice must say this where it lands.

Timestamps are RFC3339 with nanoseconds. Ordering is ts, then seq within a session. A true same-instant tie across sessions falls to tree order — the session id that sorts first. The chain is best-effort under clock skew, and says so.

Why: the blind review proved second-granularity timestamps let an alphabetically earlier session win a from-chain race. Nanoseconds shrink the tie to practical impossibility; the residual rule makes the outcome stated instead of accidental.

## D14 — 2026-08-22 — Slice 3 rulings: what the spend query does with what it reads

Four rulings for the spend query, all from its blind review.

A line of an unknown kind is skipped, not an error. Later bets add kinds, and an old binary must keep counting what it understands.

A line the query cannot parse fails the whole report, loudly, naming the object. A spend figure that silently omitted part of the record would be worse than no figure.

Rows sort by total tokens descending, ties broken by key, alphabetically. The summary row is labelled (total) and an empty key renders (none) — parentheses sit outside the session charset, so neither can collide with real data.

Exit codes split by where a bad value is caught: a bad --by is a usage error, exit 2, caught in the CLI; a bad --role reaches the writer and is a write error, exit 1. The split is stated here so it reads as chosen, not accidental.

## D15 — 2026-08-22 — Slice 4 rulings: what a merge may bring in

Three rulings for the merge verb.

A merge must never lose or rewrite a local line. The union is checked after it is built: every local entry must survive unchanged, or the merge is refused with the offending path named. Content addressing makes honest collisions impossible; the check is for a fetched ref that lies.

The union carries the other side's whole tree, not just events/. A later bet that adds a path under the ref gets it carried across merges. The counts in the output sentence count events only. The journal ref shares the repo's trust domain — fetch it only from clones of this project, the same rule the code itself lives under.

merge takes a positional argument where other subcommands take flags. A merge has exactly one operand and it is not optional; a flag would dress it as one.

## D16 — 2026-08-22 — The unrun-proof class tripped its threshold: builders now run their own mutations

D10 set the rule: three findings of one class inside one bet forces an upstream change. Bet 1 has seven unrun-proof findings — properties claimed in code or comments that no test pinned, proven by reviewers' mutations in every slice so far (F7, F8, F9, and slice 4's review).

The upstream change: every build brief now requires the builder to run the mutation for each property it claims — break the guard, watch the named test fail, restore it — and to report which mutation proved which claim before handoff. The reviewer still hunts; the builder no longer hands over unproven claims.

Why this fix: the defects were never in the code — every mutated implementation was correct. The generator of the defect was the handoff itself, which let "verified" mean "written". This names the class, per D10.

## D17 — 2026-08-22 — Slice 5 rulings: a verifier may never pass on nothing

Rulings for the token cross-check, from its review's bounce.

A verification that checked nothing is a failure, not a pass. checked 0 never exits 0. A sidecar without a dispatches key is malformed. A sidecar with an empty list fails, saying the sidecar claims no dispatches.

A seq holding more than one journal line is ambiguous — whether or not the sidecar claims that seq. The real shape: two clones shared a session id, both wrote seq 1, and the merge rightly kept both. The verifier prints every figure, calls the row ambiguous, and fails. It never picks a winner by blob order, and it never passes a session whose journal disagrees with itself. Ambiguous rows get their own count in the summary.

The other slice-5 calls, recorded: a missing sidecar exits 2 and never passes. A wrong-session sidecar fails — it is the wrong file. Journal lines the sidecar does not claim are unchecked and never fail. The sidecar lives uncommitted at .groundwork/host-usage/<session>.json.

Why: the verb exists to catch a wrong figure. Every path that lets it say ok without having compared real numbers — an empty claim set, a wrapped subtraction, a silently collapsed collision — is the verb lying about its one job.

## D18 — 2026-08-22 — The green-but-wrong class tripped its threshold: adversarial inputs join the builder's duty

The slice-6 backfill classified the ledger, and green-but-wrong stands at six findings: F4, F7, F8, F9, F10, F11. Every one is a tool reporting success while the record it produced was wrong. D10's threshold forces an upstream change named from the class.

The change: any brief for code that reads input it did not write — a fetched ref, a tag name, a sidecar file, extreme numbers — now names an adversarial-input duty. The builder probes hostile shapes before handoff, the way D16 makes it run mutations: forged content, revision syntax, wrapped arithmetic, absent and empty and duplicate fields. The reviewer still hunts; the builder no longer hands over a verb that has only met honest input.

Also ruled here: an entry records one Class line per defect class it genuinely holds, and each entry-class pair counts once — F7 through F11 each carry green-but-wrong and unrun-proof, because each bundled a real defect with a mutation-proven test hole. The recurrence counter's first version counts classes across the whole ledger, threshold three, and demands a decision heading named from the class — a whole-file match would be vacuous, since D10's own body lists every class name. Bet-scoped counting per D10's exact wording arrives when enough bets exist to scope over; this simplification is recorded so it reads as chosen. Known weakness, accepted: a class named by a common word — other, register — could be answered by an unrelated heading. If that ever happens it is a finding.

## D19 — 2026-08-22 — The real cross-check ran, and the numbers matched

The done condition asks for one token figure cross-checked against the host's own reported usage. Three real dispatches from building this bet were journaled in session bet-1-driver and checked against the host's reports:

- seq 1, slice 4's builder: journal 125819, host 125819 — ok.
- seq 2, slice 5's builder: journal 184619, host 184619 — ok.
- seq 3, slice 5's rework: journal 276425, host 276425 — ok.

checked 3, ok 3. The host reports one undifferentiated figure per dispatch, so each line records it as tokens out with in 0, and tokens_source says so. Why that shape: the writer enforces total = in + out, and a provenance field that states the unknown beats a split invented to look complete.

## D20 — 2026-08-22 — The journal backs up to a branch until the host allows the real ref

The host's git proxy accepts pushes only to branches. The journal lives at refs/groundwork/journal, so the per-slice backup push D11 requires cannot carry it directly. See F12.

The mechanism: the journal's tip also pushes to the branch groundwork-journal. Any clone restores the real ref with one command: git update-ref refs/groundwork/journal origin/groundwork-journal. The branch is a mirror, not a second journal — the ref stays the one the tools read and write.

Why: a journal on one machine is not a record. The mirror costs one push and no code.

## D21 — 2026-08-22 — The other class reached its threshold, and the answer is a new class: host-limit

Adding F12 put three findings in `other`: F1, F5, F12. D10 says heavy use of other is a sign to add a class, and the threshold rule demands an upstream answer. Two of the three share a real cause: the session host's git proxy allows pushes only to branches. That is not a code defect and not a one-off — it is a capability gap in the ground the work stands on, and it will recur wherever a host constrains the tools.

The class `host-limit` joins the vocabulary: a defect caused by a host capability gap, worked around rather than fixed. F1 and F12 re-class to it. F5 stays other, with its reason.

Why a class and not a decision heading for other: a heading would satisfy the counter while leaving other as a bucket that hides a real pattern. The pattern has a name now, and the counter watches it.

## D22 — 2026-08-22 — Bet 1 closes

All six done conditions were checked against evidence.

Three structurally different verbs write journal lines: dispatch from arguments, dial from the ref's own prior state, seal from git objects. Every line carries role, tier, tokens, duration and session id. Spend is queried from the ref alone — no fixture exists anywhere in its tests. The cross-check ran on three real dispatches and matched the host to the token (D19). Two real clones merged and both lines survived, with a hostile ref refused. Every finding records what caught it, and CI gates on it.

The bet owned three open questions; all are ruled: O17 in D8, O10 in D9, O12 in D10.

The ladder was re-checked at close. Nothing this bet delivered invalidates a later bet. The journal ref backs up to the groundwork-journal branch (D20) until the host allows the real ref.

The bet's own record: twelve findings, one bounce, two defect classes over threshold with their upstream rulings (D16, D18), and one vocabulary addition forced by the counter's first live run (D21).

## D23 — 2026-08-22 — Ruling on O3: the battery version

A version is a declared MAJOR.MINOR plus a digest of the canonical row list, like `1.0+r3f9c1ab`. Major moves when a row is added, removed, or made stricter. Minor moves for everything else. The digest is the first 7 hex of sha256 over that same row list.

`groundwork verify version` prints the pair. A committed lock file holds it. CI fails when the digest moves without a declared bump.

Seals record the version twice: as trailers on the annotated tag, and as fields on the journal seal line (battery, battery_run). A later bet's seal-verify checks the two agree.

Why: a hand-typed version drifts from what the rows do; the digest catches drift while the declared half stays readable.

## D24 — 2026-08-22 — Ruling on O7: waivers

A waiver is one committed file per waiver under .groundwork/waivers/, plus journal lines on grant and on use. One file per waiver so branches merge cleanly — D8's reason, reused. A waiver must land in its own commit touching only waiver files, never buried in a feature diff. Expiry is required, at most 30 days out; an expired waiver is ignored and the row goes red naming it. A waiver never turns a row green — waived is its own outcome, printed loudly. Three waivers of one row in a bet, or five across the repo, file a finding — D10's numbers reused.

Authority this bet: the committed file with git attribution and the journal lines. The seal machinery of a later bet hardens it.

Why: a waiver is a claim that a check is wrong, and claims belong in the record — one file, one commit, one expiry, all countable. A waiver that could hide in a feature diff or outlive its excuse would become the quiet green D10 exists to catch.

## D25 — 2026-08-22 — Ruling on O27: the per-stack adapter

One named seam, two shapes. Go runs in-process, through go/ast and go test -json. Every other stack runs out of process: a command declared in the capability manifest, printing one JSON object on stdout under a versioned schema. The seam carries three calls this bet: discover, run, mutants. Every adapter passes one conformance suite against a shipped fixture pack. An unmapped stack is a fail-closed red row, never a skip. Out-of-process adapters get a timeout and an output cap; a killed run reports unrunnable, never a partial tally.

Why: the framework shells out to each stack's own tooling — the execution plan settled that — and a stack the battery cannot read must never pass in silence.

## D26 — 2026-08-22 — Bet 2 designed: the slice cut and small rulings

Seven slices:

1. The verify verb, the row model, the run record, and the battery and battery-row journal kinds.
2. Topology profiles, the capability manifest, and the adapter seam with its conformance suite.
3. The three scans — honesty, wiring, token.
4. Evidence-of-execution rows.
5. The deletion test, run in a throwaway worktree.
6. Waivers, drive artifacts, and the flake policy.
7. The held-out run and this repo's history. Grading only — no tuning.

Small rulings from the design read:

K0 is read as the seam under one verify verb. The nine rows land across their owning bets. The verb list, reversible: honesty, wiring, token, divergence, reachability, flag, mutate, seal-verify, run-evidence.

The held-out set is two purpose-authored repos, one Go and one TypeScript. A separate dispatch that never sees the battery code builds them. Their answer keys are sealed before slice 1 and recorded in docs/evidence/bet-2/holdout.md. A run burns the repo — later tuning bumps the major version and needs a fresh one. magpie and staycurrent are reachable and serve the no-false-reds direction only.

A mutant that fails to compile is inconclusive, never a catch.

The flake mechanism ships with provisional numbers — rerun once, quarantine on disagreement. Bet 14's O28 rules the real thresholds.

The hash-chained journal and signed seals that proof.md requires join bet 3, with the seal machinery. See F13 — no bet owned them until this ruling.

Why this cut: the floor first, the seam second, then the rows that stand on both, and grading last so nothing grades itself.

## D27 — 2026-08-22 — Durability pushes: nothing lives only in the cloud container

The session runs in an ephemeral container, so the owner ruled: push as we go. Three mechanisms, on top of the per-slice push the working agreement already demands.

The held-out fixture repos push to their own branches, holdout-go-fieldkit and holdout-ts-tallysheet. Their answer-key tags cannot push (host-limit, F12's rule), so the key commits ride in the branch history and the evidence file records the tag targets.

In-flight worker output snapshots to the wip-snapshot branch through plumbing — a commit built from a temp index, never touching the working tree or the real index. The snapshot is not a slice commit and never merges; it is overwritten per slice and deleted at bet close.

The journal mirror re-pushes with the work, per D20.

Why: the review-then-land discipline stays — a slice still lands only after its blind review — but between handoff and landing, the work now also exists on origin.

## D28 — 2026-08-22 — Slice 1 rulings: the battery's small vocabularies, and what waits for bet 3

Four vocabularies the slice fixed, recorded: the row kind list is D26's nine verbs plus version, closed. Severity is blocking or advisory, closed — both exist, only blocking is used, and giving advisory a weaker meaning later is a major version bump. Row ids use lowercase, digits and dash only — they are printed, typed into waivers, and hashed, so one spelling per row. The digest preimage writes each field on its own line; the closed vocabularies are what keep a newline out of it.

Two deferrals, named so bet 3 is reminded: the seal line's battery and battery_run fields (D23's second recording place) land with the seal machinery. And the lock file stays read from the working tree — CI is the enforcement point for committed, and a HEAD-blob read is revisited with the same machinery.

Why: a vocabulary nobody wrote down is a vocabulary two slices will spell two ways, and a deferral nobody wrote down is F13's class again.

## D29 — 2026-08-22 — Slice 2 rulings: the manifest's home, and the version goes major

The capability manifest lives at .groundwork/manifest.json, committed. The spec names the manifest but not its path. Choosing the GroundWork home directory keeps project-authored framework files in one place, beside D24's waivers. The .gitignore narrows to .groundwork/host-usage/ only, and a test fails if the manifest is ever ignored again.

The battery version moved to 1.0, not 0.2. The manifest row is a new row, and D23 says a new row moves the major. The brief said minor; D23 wins — the ledger outranks a brief.

The manifest row joins the closed kind vocabulary as its own kind. Filing it under wiring would misname it in every table and journal line.

The node adapter ships inside testdata for now. When an install step exists, it wants a real home; that bet inherits the note.

## D30 — 2026-08-22 — Ruling: what discovered means, and what a test is

The slice 2 bounce forced the question the spec is silent on. Three rulings.

Discover lists what reads as a test: every Test function with the testing.T signature in any _test.go file under the surface — including tests a build tag excludes and tests a TestMain gate filters out. TestMain itself is never a test; it takes testing.M and is a harness. Benchmarks and examples are not tests this bet.

Why: the never-run scan exists to catch code that looks like a test to a reader and never executes. If discover listed only what go test would run, discovered would always equal ran, and the scan could catch nothing. Discover reads the source the way a reader does; run reports what the runner did.

A subtest belongs to its parent. Run results collapse t.Run entries into the parent test, and one top-level Test function is one test. Why: discover cannot see dynamic subtest names statically, so the parent is the only unit both sides can name.

The reconciliation contract this fixes for slice 4: discovered minus ran is the never-run set, red. Ran minus discovered is a discover defect, also red — the adapter lied or the parser missed a shape. Conformance requires the two sets to agree on the fixture packs after collapsing, and the packs must carry the hostile shapes: a TestMain gate, a benchmark, a t.Run table.

The out-of-process run refuses an empty run log, the same direction as the Go path: an empty green log is the defect the battery exists to catch.

## D31 — 2026-08-22 — The coverage-gap class tripped its threshold: every bet design now runs a coverage read

Three coverage gaps stand in the ledger: a ratified requirement no bet owned (F13), a spec profile with no probe list (F14), and a semantics silence that bounced a slice (F15). D10's threshold demands an upstream change named from the class.

The change: every bet's design dispatch now carries a standing duty — read the bet's spec sections for requirements no slice carries, and for vocabulary no ruling pins, before the slice cut is ratified. What the read finds becomes rulings or findings at design time, not bounces at review time. The bet 2 design already did half of this and caught F13; the duty makes it every bet's floor.

Why: all three gaps share one generator — the spec says more than the ladder's coverage counts, and a slice met the silence first. Reading for silence at design time is cheaper than bouncing on it at review time.
