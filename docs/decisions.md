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

## D32 — 2026-08-22 — Slice 3 rulings: what the scans judge, and what they leave alone

The three scans made defaults worth writing down, and the bounce sharpened four of them.

The wiring scan sweeps references from the module root, and its candidates come from the declared surfaces. A caller anywhere in the repo wires a function up. The scan matches names, not types, skips methods and package main, and errs green on doubt — a recursive dead function reads as wired, and a linkname'd caller may be invisible. Its claim is calibrated to that.

The honesty scan errs green whenever the test's own handle escapes its sight: cross-file helpers, assertion libraries, harnesses holding the t. Any Error() call counting as an assertion is an accepted and stated false-negative this bet. A panic or a Must call is a failure path — a test that can panic can fail. An unconditional skip anywhere at the top level is a skip.

The token scan reads hex colours only, in value positions — an issue number in a comment is not a colour. Named and functional colours are out of scope with fonts and spacing, and the green sentence says exactly what was scanned. Zero readable files on an applicable surface is unrunnable, never green — D17's rule.

Shared: cli and library are tokenless by declaration; a filename containing token is exempt; generated files are skipped aloud; a found red outlives a later surface's unrunnable; evidence names whole hits within the journal cap or falls back to a count.

## D33 — 2026-08-23 — Slice 5 bounce rulings: what a mutation target is, and what a run owes the record

The slice 5 blind review bounced the deletion test. These rulings resolve what it raised.

1. Targets come from the build, never from a directory walk. The go toolchain's own package list names the files a surface compiles, and only those files hold targets. A file the build excludes — a build tag, a platform suffix, a `_`-prefixed or ignored directory — is not a target. This is D30's rule again: two walkers in one repo must never disagree about what a package is.

2. The printed line must reconcile the sample as numbers: sampled equals killed plus survivors plus each inconclusive class plus not judged. Numbers are never cut from the line; names are cut first, falling back to counts. A run that exhausts its budget mid-sample is unrunnable, naming how far it got — never green, and never a red that blames the project. "Its own tests do not run" may describe only the project's suite, never the row's own clock.

3. Green requires zero survivors, at least one kill, and every sampled mutant accounted for. Inconclusive classes stay non-blocking — D26 holds — but they are always counted and printed. Thresholds on inconclusive rates wait for bet 14, beside the flake numbers.

4. The throwaway copy is faithful. It carries the project's git record, as a copy. A package whose tests ask git about the project must behave in the copy as it does in the project. On this repo the row must be able to judge internal/battery and internal/manifest.

5. Isolation is proven by a test that fails when isolation is removed — observed during the run, not read from the tree afterwards. And every mechanism added to internal/adapter is tested in internal/adapter, tests first.

6. Every error path renders its reason the way the scans do: paths relative to the repo, length capped, before the journal sees it.

Why: the row's job is telling the truth about other suites. A row that misclassifies its own failure modes — the build's exclusions, its own clock, its own copy — cannot be trusted on anyone else's.

## D34 — 2026-08-23 — A mutant that crashes the suite is a kill

The mutate row asks one question: did the suite notice the mutant. A package whose baseline run is clean, and whose run crashes with the mutant applied, has noticed. D32 already rules a panic a failure path. So a crash under mutation counts as a kill, and the line says how many kills were crashes.

D25 is untouched. The run-evidence reconciliation still refuses a partial log from a crashed run — that row must tally every test, and a crash makes the tally a lie. The mutate row's question is narrower, and the crash itself is the answer.

The cost note rides here too: verify on this repo is 241 seconds, the mutate row the larger half. Recorded so the price is chosen. The trend publication proof.md asks for is a later bet's work.

Why: on this repo two of ten sampled mutants blow the test binary up during registration. Calling that "did not finish" was honest but backwards — a suite that explodes over a deleted function did not fail to notice it. And bet 14 will put thresholds on inconclusive rates, so an inconclusive class holding real kills would poison those numbers.

## D35 — 2026-08-23 — Slice 5 re-review rulings: the copy refuses a borrowed git record, and a timeout is never a crash

Two rulings from the second review round.

1. A project whose .git is a file — a linked worktree, a submodule — is refused by the mutate row: unrunnable, naming the shape. That file points at a git directory outside the project, so a copy that carries it is not a copy; a test running on mutated code could write the developer's real history through it. D33's faithful-copy ruling means a self-contained record or none. Materialising a self-contained record for these shapes can come later if a real project needs it.

2. go test's own timeout panic is a clock death, never a crash. D34's kill requires the suite to have noticed the mutant; "panic: test timed out" is the clock noticing the suite. The classification must name that marker explicitly, whatever set the timeout — the project's flags, GOFLAGS, or go test's default — because the row's own per-mutant clock cannot be assumed to fire first.

And a restatement, because a fix half-read it: D33's numbers-never-cut rule binds the whole accounting. If the full line cannot fit the journal cap, words give way — shorter class names, a shorter verdict — never the counts. A line that still had to cut a count is a defect in the line's design, not an allowed fallback.

Why: both new defects came from the previous round's fixes. The copy became faithful enough to carry an escape, and the crash class became generous enough to swallow a hang. A fix that widens a door gets the same review the door got.

## D36 — 2026-08-23 — Slice 5 third-round rulings: the last rung always fits, and the git guard minds its own business

Two rulings from the verification round.

1. The evidence line's ladder must end on a rung that provably fits the journal cap on any legal input. That rung may collapse the inconclusive classes into one counted total — sampled equals killed plus survived plus inconclusive plus not judged still reconciles — and may drop the version. The full split belongs to rungs that fit. The bound is proven by arithmetic over the widest legal fields, in a committed test, not measured off one fixture.

2. The borrowed-record guard refuses a non-directory .git only where it can govern a run: at the surface root, or at an ancestor of a package the build names. A test runs with its package directory as its working directory, and git resolves its record walking upward — a .git file on no such path cannot capture a run. A linked-worktree fixture under testdata is the project's own business, and refusing it was a false statement about a self-contained project.

Why: both rules are the same lesson as D33's. The row's own record must hold under the row's own arithmetic, and a guard that reaches past what it protects becomes the false red it was built to prevent.

## D37 — 2026-08-23 — Slice 6 rulings: waivers must work where they are enforced

Five answers to the slice's open questions.

1. CI fetches full history. A waiver's authority is its introducing commit, and a shallow clone hides that commit, so every waiver would be ignored exactly where the gate runs. The one-line change to ci.yml lands with this slice, by this ruling. A mechanism that silently no-ops at its enforcement point is the quiet green D10 exists to catch.

2. The waiver counter — three of one row in a bet, five across the repo file a finding — is a named deferral to bet 3. It reads the journal, and bet 3 owns the journal's chain and the seal machinery. Named here so it is not F13's shape again.

3. A waiver introduced by a merge commit is ignored, and that is correct. D24 says a waiver lands in its own commit touching only waiver files; a merge is not a granting act. Fail-closed stands.

4. The battery version does not move. The digest is over row identity — id, kind, severity — and no row changed. Waived and quarantined becoming reachable is the run honouring its own vocabulary, not a row made less strict.

5. The loud block repeats the waived row's line on purpose. D24 says printed loudly; twice is loud.

## D38 — 2026-08-23 — Slice 6 bounce rulings: the waiver's authority is its last commit

Seven rulings from the slice 6 review.

1. The own-commit rule binds to the commit whose content governs: the most recent commit that changed the waiver file, not the commit that created it. That commit must touch only waiver files. A rewrite inside a feature diff then voids the waiver, whatever the file's birth looked like. A rewrite in its own waiver-only commit is a re-grant, allowed by D24's letter; bet 3's counter counts grants from the file's history, not from the journal alone.

2. Every printed line the battery journals must fit the cap by construction — the quarantined line joins the waived line in having its bound proven by arithmetic in a committed test. This is the third time this class has fired (D33, D36); the rule is now general: no new printed line lands without its bound test.

3. D37.1 stands: ci.yml fetches full history, in this slice.

4. A waiver's reason and file name are checked like row ids: printable characters only, no control characters, refused at grant and refused at verify naming the file. Committed content is attacker-controlled content.

5. The loud block gets a heading and a blank line separating it from the table, so its lines cannot read as table rows.

6. An unreadable or non-waiver file in the waivers directory no longer blanks the run. The battery runs, the table and the journal render, the file is named loudly in the block, and the run exits 1. Fail-closed means the defect is unmissable, not that the report disappears.

7. An ignored waiver is named in the loud block and the journal, never on the row's own evidence line. D24's "red naming it" is satisfied by the block beside the table; D36's exactly-sized lines are not spent on it.

Why: a waiver is the one mechanism that turns red into not-red, so its authority chain has to be airtight. The review broke it with an ordinary feature commit — the exact shape D24 was written to forbid.

## D39 — 2026-08-23 — The record-not-written class tripped its threshold: records get a mechanical check

Three findings share the class: stale counts at ratification (F2), the holdout record that a ruling required and nobody wrote (F20), and a handoff that stopped moving while the work went on (F25). The common cause is the same one the spec names: a record that relies on someone remembering does not get written.

The upgrade, in two parts.

1. Now: the driver's landing checklist is mechanical. Before a slice lands, the driver verifies in one pass that the evidence directory exists, the ledger entries for the round are appended, and the handoff file's timestamp postdates the round's last code change. A dispatch that ends a round names the record it must have moved.

2. Bet 3: the record machinery makes the check a verb. The seal work already reads the journal and the tree; a `record` check that fails loudly when a required record is missing or stale joins it, so the checklist stops being the driver's memory — which is the defect this class keeps finding.

Why: findings recur caught this trip in CI the moment F25 landed. The cure for records that depend on remembering is machinery that does not.

## D40 — 2026-08-23 — A merge never governs a waiver

The closure check re-opened the hijack through a merge: the diff reader shows nothing for a merge commit, so a waiver rewritten inside one stood, row swapped and expiry renewed. The ruling extends D37.3 from introduction to governance: a merge is not a granting act, and a waiver whose governing commit — the last commit that changed it — is a merge is ignored, naming the merge. Two branches that re-grant the same waiver and conflict resolve the conflict, then re-grant in a commit of their own on the merged branch. That friction is the cost of an authority chain with one link shape.

Why: the alternative was teaching the diff reader merge semantics — more code on the exact surface an attacker probes, to bless a case a one-line re-grant makes unnecessary. Fail-closed and simple beats clever here.

## D41 — 2026-08-23 — The wiring row learns profiles, and the battery pays the holdout's price

Two rulings from the held-out grading.

1. The wiring row reads the manifest's profile, the way the token row already does. On a library profile, an exported function is the product — its callers live in other repos, and their absence proves nothing. The row keeps its teeth where they are honest: an unexported function nothing reaches, and an exported function that nothing at all names, tests included. The spec's own library profile says the front door is a consumer example; the consumer-fixture round trip that proves exports for real arrives with that machinery, and this entry names the deferral.

2. The fix is tuning after a graded run, so D26's price is paid in full: the battery version moves major, to 5.0, and both holdout repos are burned. The 4.0 grading stands as recorded — it is the record of the catch. Any future claim against the done-when's held-out clause needs freshly authored holdouts at the new version.

Why: the holdout existed to find the rule this repo's shape could never break. It did, on its first run. Fixing the rule and pretending the same repos still count as unseen would turn the sealed-key discipline into theatre.

## D42 — 2026-08-23 — Slice 8 rulings: the three small calls inside D41

D41 said the wiring row reads the profile. Building it needed three smaller calls, taken here rather than asked.

1. `init` is never a candidate. The runtime calls it and no file names it, so an init nothing mentions is every init ever written, not dead code. The rule only bites now, because a library is the first profile whose unexported functions are judged.

2. Test files are swept for references only when a library surface is declared. A library's exports are judged on what its tests name, so the sweep has to reach them. A repo with no library surface is swept exactly as before, and its evidence is byte-identical. The completeness rule follows: on a library, a test file that will not parse leaves the row unrunnable, because an export could otherwise look dead when the only file naming it went unread.

3. A directory declared under two surfaces, one of them a library, is judged as a library. That is this row's standing posture — precision over recall, every doubt resolved green — and the library declaration is the one saying the callers may live where this scan cannot look.

Why: all three are inside the ruling, not beside it. Each is written into the row's own comment so the next reader meets it there rather than here.

## D43 — 2026-08-23 — Bet 2 closes

The audit, clause by clause, stands in docs/evidence/bet-2/holdout.md: both gradings, both directions, nothing papered over. The judgment this entry records:

Every done-when clause is met on the surfaces the bet's ruled scope covers. The deletion test, the never-run reconciliation, the vacuous-assertion scan, honest-work-green, no-false-reds on this repo, waivers, and the flake policy all held on the second held-out set at 5.0 — with zero false reds on a library profile the battery had never seen, against eight at 4.0. The clause that reads partly met does so entirely on node surfaces, whose scans and mutation D25 and D26 placed in later bets before slice 1 ran; the losses there are named in F28 and F30, and F30 binds the later adapter bet to pin discovery to the project's own test command.

The bet's ledger: eight slices, five bounces, three review rounds at the deepest, thirteen findings (F18–F30), eleven rulings (D33–D43), three catches by the battery on its own repo, two sealed held-out sets — the first burned by its own catch, which is the mechanism working. The branch merges to main by PR 34; the wip-snapshot branch is deleted at close per D27; the next bet restarts the branch from main.

Why closing is right: the ladder's letter on node surfaces cannot be met by a bet that was ruled not to build node scanning, and pretending otherwise would either block the ladder on scope nobody ruled into this bet or invite quiet re-scoping. The record says exactly what is proven, on what, and what is owed.

## D44 — 2026-08-23 — Bet 3 designed: eight slices, seventeen rulings

The design stands at docs/evidence/bet-3/design.md, ratified as written: the eight-slice cut, and rulings R1 through R17 adopted verbatim. The load-bearing ones, restated in a line each: plans are three markdown files with frontmatter the machine reads and prose it never does; one seal mechanism, four kinds, an annotated tag naming paths and blob hashes; the CLI verifies signatures and never holds a key — unsigned is loud, non-blocking, and the flip to blocking waits for an owner key and a major bump; seal tags mirror to a branch because the proxy refuses tag pushes; the journal chain is per session, envelope v2, and D8's no-change sentence is amended — v1 lines read as an unchained prefix, never as forgery; the board is a derivation that writes nothing, landed-ness read from a Slice: trailer; proof markers live in Go test names; the stub check reuses the honesty scan's own judgment; each row-adding slice bumps the major, walking 5.0 toward 12.0.

The three open items, settled: unsigned seals stay non-blocking this bet, with the flip named. Two authored fixture repos, not one — bet 2's discipline earned its cost twice. And this repo plans bet 3 in its own new format, as dogfood beside the held-out proof.

The design's gaps are filed as F32 and F33. The held-out fixtures are authored and sealed before slice 1 lands, with docs/evidence/bet-3/holdout.md written at the same moment — F20's rule.

Why this cut: a thing is built before the thing that grades it, and the grade runs last against fixtures nobody building the checks ever saw.

## D45 — 2026-08-25 — Slice 1 review rulings: the field goes, D17 stands, the caps are ratified, the anchors move

Four rulings from the slice 1 blind review, taken by the driver.

1. touches_data is removed. R2's field list is closed — "these are the entries proof.md names, and nothing else" — and the data block's own presence already says what the boolean says. A field that can only ever agree with or contradict the thing beside it is a field that exists to be wrong. The block's presence is the declaration.

2. D17 stands as ratified: a docs/plan with no program directory is unrunnable, and its evidence names what the directory holds instead. A stray file beside a real program is red — there is a plan, and it is misshapen. Only a docs/plan that offers nothing to parse has nothing to misstate.

3. The parser's caps are ratified as built and belong on the contract page: 64 KiB per file, 1000 bytes per scalar, 64 bytes per id, 300 bytes per path, 40 bytes per key, depth 3. So are the flat repo-wide id space and the one-directory-level tree rule. The review is right that these were rulings the moment they were written; this entry is where they live, and the contract page must carry every one (F38).

4. The dogfood's from: anchors move to design.md's real heading slugs. The design file is not edited to fit the anchors — it is ratified, and reshaping its headings to rescue references would be the tail wagging the dog. References conform to the thing they reference.

Why now: the design is unsealed until slice 3's machinery lands, so every one of these is a cheap edit today and an amendment protocol tomorrow.

## D46 — 2026-08-25 — Main tracks landed slices

The owner's instruction: merge the bet branch to main as slices land, not once at bet close. Bet 2 merged in one piece at close; from here, main moves with each landed slice.

Why: this build runs in a cloud session that can be reclaimed. A landed slice sitting only on a feature branch is one host failure from being work in flight again. Main is where finished work is safest, so finished work goes there as it finishes. The bet still runs on its branch and review still gates every slice — the only change is how often the branch's landed prefix reaches main.

## D47 — 2026-08-25 — Paired interview runs, once the method stands

The owner's instruction, recorded so it outlives the chat: once the method is fully in place, start sub-agent test runs in pairs — one agent interviewing, one being interviewed — at sonnet class to start. These are live trials of the method on real agents, beside the fixture-based proof the ladder already carries.

Why record it now: the machinery these runs exercise arrives over several bets, and an instruction that lives only in conversation is gone by then. The driver schedules the first pair when the method's core — plans, journal, seals, board — is landed and proven.

## D48 — 2026-08-26 — Slice 2 rulings: the chain's edges, taken as built

Nine calls the chain slice needed, made by the builder and ratified here. The load-bearing ones:

1. A v1 line at a seq above a chained line is a break. The unchained prefix is a prefix. Once a session's chain begins, a line that drops out of it is the cheapest forgery there is — nothing has to hash. R7's never-call-v1-forged holds for the prefix; it does not license a downgrade afterwards.
2. A journal line that is not JSON is a break, not an error. An error would leave the row unrunnable, and unrunnable never fails a run — F43's shape exactly: one corrupted line would silence the whole check.
3. A repo with no journal ref is green; a ref that exists and holds no event is unrunnable. Both halves follow the plan row's precedent and D17.
4. Every error out of CheckChain makes the row unrunnable, including a repo the walker cannot open. This diverges from the plan row, which goes red when RepoRoot fails. The divergence is accepted and named; if a third row meets the same edge, rule the posture once for all rows.
5. prev is written even when empty, so every v2 line carries the field and a chained first line is never shaped like a v1 line.
6. A line is grouped by the session it names, not the directory it sits in. Moving a blob between session directories changes nothing about what the line says.
7. Past a gap or a repeated seq, the walk names that seq and stops checking that session's prevs — the missing link is the one fact the reader acts on.
8. When two clones share a highest seq, the writer points the next line at the lower hash, so both clones land in the same place.
9. The chain row registers last, so inside a battery run it reads the lines the earlier rows just wrote.

Why ratify rather than re-cut: each call sits inside R7's frame, each is written into the code's own comments, and the review gets them all as claims to attack.

## D49 — 2026-08-26 — The session is the run

Four rulings from the slice 2 review, taken by the driver.

1. When GROUNDWORK_SESSION is unset, the tool generates one session id per process, not per write. A run is a session. That is what D8's model always meant, and it is what makes the chain cover the default mode: a deleted line inside a run becomes a gap, and R7's promise holds without anyone setting a variable. Two concurrent runs still get distinct ids, so the merge's independence stands. What stays uncovered: deleting a whole one-line session, which no per-session chain can see — that is R4's ground, with the tip-rewrite case beside it.
2. Every value a battery evidence line takes from a journal line goes through printable before it goes through a clip. A forger controls the line's fields; the table must not be theirs to draw. This is D38 ruling 4 applied where it was missed.
3. The chain walk compares each line's computed hash to the path it sits at, and a mismatch is a break. The check is free and closes the rewrite-in-place probe. What it cannot close: a tip rewritten and refiled, and a whole session invented in the v1 shape. Both are named here as accepted until the seal lands, and the evidence now counts wholly unchained sessions so a reader can watch that number instead of trusting it.
4. The message smalls: a not-JSON break names the position it broke at, never a borrowed seq; a gap message never names a seq that is present; a line with no session field is a break, not a group.

Why 1 is in scope for this slice: the chain row's headline claim depends on it, and a row that overclaims in the default mode is F48's finding, not a deferrable nicety.

## D50 — 2026-08-26 — Slice 2 fix-round rulings, and the closure's two fixes

Five calls from the fix round, ratified, and the closure's two regressions fixed by the driver.

1. The unrunnable branch keeps cut, not printable. D49.2 covers values a line takes off a journal line; git's own words about a ref it could not walk are not one, and no test can reach a control character in them — an unprovable rule is what F50 names. The reviewer's caveat is recorded with it: the branch is safe because treeEntries and scanBatch quote with %q, and that dependency is named in the code.
2. cut came off the green and red lines. Both are bounded by arithmetic, so the cut was dead code a mutation could remove unnoticed — m17 did exactly that. The bound is the guarantee, which is why F54's fix matters: the bound must measure the widest branch.
3. MaxWhyBytes is enforced in breakAt, not asserted about a list of strings. A cap held by construction stays true when someone writes a longer reason.
4. The error branch is reached by pointing the ref at a blob — the plainest shape git allows, nothing that behaves differently as root.
5. A line rewritten in place is two breaks: the path no longer fits the content, and the next line's prev no longer fits either. The count leads, so the reader sees two and acts on the first.

The closure's two regressions — the first-line-deletion panic (F53) and the narrow bound (F54) — were fixed at closure by the driver as one-line changes with their tests, each proven by blanking. The register trim on the row's comments landed in the same pass.

## D51 — 2026-08-26 — Slice 3 rulings: the seal's edges, taken as built

Six calls from the seal slice, made by the builder and ratified by the driver.

1. Four signature states, not R4's three. A tag carrying a signature that does not check out is unverified, kept apart from unsigned — a forged signature block must never read exactly like no signature at all. Only verified is authority. Missing is red. Unsigned and unverified are both loud, neither blocks this bet, and R4's named flip lands on both together.
2. A seal is granted on a green battery run, read from the journal. No --battery flag: the grant reads the newest battery line, refuses when there is none, refuses when that run held a red row. A version the caller typed is a claim about a run that may never have happened.
3. The seal line gains reason, omitempty. R6 refuses an amendment without a reason, and a reason that is only printed is not on the record.
4. A covered path is written plainly: letters, digits, dot, underscore, slash, dash; no empty, dot or dot-dot segment; 300 bytes. Tighter than git on purpose — the path goes back to git as a pathspec, and a leading colon, a glob or a leading dash would turn one path into a different question.
5. A repo with no seal tag is green, the plan row's D45 precedent: no subject, nothing to misstate, and the line never claims a seal was checked.
6. A restore never overwrites. A name a different object stands at is reported as mismatched and left alone; a mirrored file whose name is not a seal tag's is refused. The branch is a mirror, and a restore that clobbered a local tag would quietly make the mirror the record.

Why ratify: each sits inside R3 through R6, each is in the code's own comments, and the review meets them as claims to attack.

## D52 — 2026-08-26 — Slice 3 review rulings

Nine rulings from the slice 3 review, taken by the driver.

1. The mirror walker skips and reports a bad file, the index reader's own policy. One scribbled file on a pushable branch must never stop the other tags — a restore that stops because a listing was scribbled on is a way to stop one. The name check stays where it bites: no ref is ever written for a name that is not a seal tag's.
2. A grant that cannot mirror removes its own tag and fails whole. A seal that exists only where it was made is not half a seal, it is a standing wreck that verifies green — so the grant is atomic: tag, mirror, journal, or none of them.
3. Unverified and unsigned are counted and printed apart, everywhere — summary, row clause, journal. The Report field named Unsigned is renamed so the trap goes with it.
4. The unsigned-and-unverified clause is guaranteed by arithmetic on every line the row prints, and the widest-line test measures the true widest, found by search over the count space, not by feeding maxima into every field. F61 is the second entry in this class; a widest-line test that was not searched is not a proof.
5. The unverified note says which of its three situations the reader is in — no verifier on this machine, a key nobody listed, a bad signature — read from what git actually said. The signer on the SSH path is parsed from git's SSH verify output, with the host limit named in the code: this container cannot run that branch, and F62 records where it first runs for real.
6. Restore compares the tag header inside the bytes to the file name before writing any ref. The deeper limit is named in the contract page rather than fixed: a well-formed seal invented on the mirror restores and verifies, because only R4's signature can bind a seal to its author, and that flip is already deferred. The mirror must never quietly become the record; until signatures land, the page says so.
7. The covered-path rule is stated once: the code tightens to the contract page — a path opens with a letter, a digit or a dot. The page gains the Battery-Run shape and the name-versus-message red. The error message is rewritten to be read once.
8. The journal's seal line records the signature state and the signer, omitempty, D51.3's own logic applied to R6's who-signed. And verification reads the signers file from HEAD, not the working tree — R4 says committed, and a file an agent can swap without a commit is not committed.
9. The smalls, ruled: a grant needs a green run that checked something — zero green rows is a refusal; the seal verb refuses a tag that is not a seal tag by name; the cross-check reads the newest seal line of either action, so a newer revoked is never out-answered by an older grant; short() joins the printable pattern; amend prints the paths that differ, clipped, not their counts; the stale journal comment is fixed.

Why these directions: every one falls out of a ruling already made — D51.1's states kept apart, D51.3's record-not-print, D45.4's references-conform, F54's class, D49.2's printable. The review found the places the rulings were not yet obeyed.

## D53 — 2026-08-26 — The front-door-hollow class tripped its threshold: proofs walk the default path

Three findings share the shape: a mechanism whose front door opens onto nothing. The default-mode journal chained nothing because every test set the session variable (F48). A junk file turned off the mirror for everyone (F59). The atomic grant's failure path left a wreck that traveled (F67).

The rulings, standing from here:

1. A slice's headline proof exercises the path the DEFAULT configuration takes. A proof that sets a variable, plants a file, or shims a branch the shipped tool never walks is proving a different tool. The reviewer checks this by asking of each headline proof: which branch did this walk, and is that the shipped one? The R4 proof's branch pin from this slice is the model.
2. An operation that writes more than one thing proves its failure paths leave no partial state — each write's failure gets a fixture, and the assertion is that NOTHING remains, not that an error was printed. The slice 3 grant probes are the model.

Why a rule and not three fixes: all three findings were built green and reviewed red. The class survives fixes because it lives in what the proofs never ask.

## D54 — 2026-08-26 — The parallel-definition class tripped its threshold: one truth, one place, structure-read pins

Three findings share the shape: two statements of one truth, drifting. The row test seam samples against a different version than a real run (F46). One path rule stated three ways (F64). The contract page missing the fields the code just gained (F69).

The rulings, standing from here:

1. Where a truth must appear in two places — a parser and its contract page, a row and its test seam — one place is declared the source and the other carries a pin that reads the source's STRUCTURE, not its words. The slice 3 fix's table-reading contract pin is the model: it survived a prose mention and failed a gutted cell, which is the right way round.
2. A change that adds a machine-read field is not done until the page and its pin both carry it — the landing checklist (D39) gains that line, and the driver checks it at every landing alongside the evidence directory.

Why now: the class reached three through two review rounds in one slice — the drift happens at fix time, when attention is on the code and the page is yesterday's problem.

## D55 — 2026-08-26 — The landing gate pairs verify with the test suite

Until F70's row exists, a green battery does not prove the tests pass — the run-evidence row reconciles which tests ran, not how they ended. So the driver's landing checklist gains a line: no slice lands on verify alone; go test ./... runs green beside it, on the same tree. The line comes out when the row that asks the suite's own question lands.

Why: the slice 3 second fix round watched verify stay green over a red package. The gap is assigned (F70); this is the manual bridge until it closes.

## D56 — 2026-08-26 — Slice 4 rulings: the board's edges, taken as built

Six calls from the board slice, made by the builder and ratified by the driver.

1. "Flagged, not silently accepted" means named and counted everywhere the board is shown, and never red. Expected-red-actually-green is the plan lagging the work — the state of every honest slice between its test going green and its commit landing, and of every repo whose history predates the trailer. Expected-green-actually-not-green is work regressing, and that is red. The ahead count lives in the head where no cut reaches it (F61's lesson), each ahead proof is named, and the render carries a flag column.
2. The board runs the proofs its plan names through a -run filter built from the markers, never the whole suite twice. That is what R9's marker is for. The filter is quoted, and a plan too large for a command line falls back to the marker prefix. Filtering rides an optional seam beside RunPackage, not a change to the adapter contract.
3. A shallow clone is named on the board row, never unrunnable — the opposite of R14's waiver-counter rule, and rightly: the counter's miss is unsafe (unseen grants read as zero), the board's miss is safe (unseen landings push toward expected red, the flagged direction). This host's own clones are all shallow, so the other rule would mean the row never runs anywhere.
4. Merges never govern landed-ness — D38 and D40's precedent applied to trailers. A Slice: trailer on a merge is counted, named, and not read. A slice claimed twice is landed with the second commit named. Four shapes are red: a doubled trailer, an empty value, a value outside the charset, a value naming no declared slice — misstatements in the one input landed-ness is read from.
5. The render's stamp is what a reader needs to ask whether the board is still true — start time, cost, results read, the commit the landed set was read at, and whether the history was short — never a second run-id vocabulary. Inside verify the row's line is journalled under the battery's own run id.
6. Six seams moved so one truth has one source (D54.1): the adapter chooser, the outcome ranking, git's own trailer parser, the journal's printable, the id check, and the marker prefix — each exported from the package that owns it instead of copied.

One harness lesson rides with this entry: a blanking sweep's -run filter must include the proof markers, because a proof is named for what it proves, not for the row it proves it about. The builder's first filter hid all three headline proofs, and the four-way table (F55) is what surfaced it.

## D57 — 2026-08-26 — Slice 4 review rulings

Six rulings from the board review, taken by the driver.

1. The head carries two counts, misstated apart from unread — D52.3 applied where the review found it missing. A count that cannot tell a red cause from a benign one is one count too few.
2. The row's clauses ride every branch, and the render shows what Run.Twice knows. A signal that hides exactly when the board looks clean is aimed the wrong way.
3. The contract pin drives the verdict cells. A pin that passes a lying table guards the table's shape and not its content.
4. When two commits claim one slice, the oldest claim is the landing and every newer claim is a stray, named. History lands things once; what comes after is commentary. The page's "second commit" means the later one, and the code and pin now say so.
5. On an unmapped stack the manifest row owns the red; the board row stays unrunnable so one cause draws one red. The seam's doc names that split instead of claiming a red its caller does not make.
6. In a hit's give-way ladder, the reason outranks the value. A reader can fetch a value from the commit the line names; the reason is the line's own contribution.

Why these directions: every one applies a ruling already made — D52.3, D54.1, F61's head discipline, D45's one-cause-one-red posture — to the places this review found them not yet obeyed.

## D58 — 2026-08-26 — Slice 5 rulings: the stub check's edges, and R10 reconciled

Three calls from the stub slice, made by the builder and ratified by the driver.

1. R10's two paragraphs contradict each other on any repo whose work runs ahead of its plan: green ahead of plan is flagged never red, and a passing expected-red proof fails the row. Every mid-bet repo holds both at once, this one included. The reconciliation reads paragraph one as the rule for honest work ahead of its plan, and paragraph two through the paragraph that follows it: a passing expected-red proof is red WHEN the honesty scan says its test cannot fail, in the scan's own words. The three ladder styles are exactly the three shapes the scan names. The cost is named as F83, and both sealed fixture descriptions grade the same under this rule as under the strict one.
2. A proof whose test does not exist is counted, and red only when its own slice has landed — a slice that landed without writing its proof claimed work it never did, and no other row sees that. A plan naming future slices' proofs before they exist is a plan doing its job.
3. Build failures, crashes and timeouts arrive per surface, not per test, so they draw their own red line naming the surface; anything else a surface broke on stays unrunnable.

Why ratify: ruling 1 is the significant one, and it holds because the reconciliation preserves what B19 actually buys — the planted stub styles all fail the row — while refusing the false red D56.1 already ruled against. The sealed graders will test exactly this in slice 8.

## D59 — 2026-08-26 — Two sentences of D58 corrected, and the guard's cost stated

D58.1 carried two supporting sentences that are not so, found by the review and recorded in F86. The ledger is append-only, so the correction lives here, beside the ruling a reader will meet: the ladder's three styles are AMONG the five shapes the honesty scan names, not exactly them; and the sealed-fixture claim holds only as far as the open descriptions show — one holdout's wrinkle is noted only in its key, which nobody building could read. D58.1's direction stands unchanged.

One more small ruling from the closure: while any surface has gone unrun, a landed slice missing its proof passes the stub row — the row cannot tell that absence from the surface's — and the contract page now states that cost beside the rule instead of leaving it implied. The clause naming the unrun surface is what keeps the state visible.

## D60 — 2026-08-26 — Slice 6 rulings: the trace row's edges, taken as built

Seven calls from the traceability slice, made by the builder and ratified by the driver.

1. Unsealed is loud, never blocking, and flips with R4's flip. The anchor resolving is the red; whether a seal covers the file is a state, named in the head and per hit. That is what keeps this repo's verify honest over three bets of unsealed history.
2. A mark is loud, never red, and does not clear — R13 says marks, and nothing yet lets a bet answer one. The clearing verb is named as F91's gap.
3. R13's journal line is the row's own battery-row line, which names the marked bets. A second line would be a second record of one fact.
4. An item both claimed and deferred is claimed twice. R12's or is exclusive: two records of one item's fate is exactly the two-ways-of-reading shape the plan reader refuses everywhere else.
5. Design files are read from the working tree until R15's slice moves committed reads onto their own ground.
6. The builder does not grant the design seal. A seal is a sign-off, and the builder granting the seal its own row reads is the self-graded shape this repo avoids. The driver grants it after the slice lands, from the landed tree, which is what a sign-off is.
7. Unsealed things are named as hits, not folded into a clause — each is one file or one artifact a reader may need to chase.

Why ratify: six follows the review discipline itself — the one who built a thing never blesses it — and the rest sit inside R12 and R13 with their costs named.
