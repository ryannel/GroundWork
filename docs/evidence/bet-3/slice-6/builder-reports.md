# Builder reports

## The build


Built, proved, and left uncommitted in the working tree. Handoff at `/tmp/claude-0/-home-user-GroundWork/a5b7b708-4ccf-5ae9-9ab1-41cce247b571/scratchpad/handoff-b3s6.md`.

## What was built

The battery's thirteenth row, `trace`/`trace`/blocking, at **11.0+rffb3f30** (was 10.0+r0a7f797).

- `/home/user/GroundWork/internal/trace/trace.go` — the derivation. Backward: anchors resolved against the design file's real heading slugs (the slug rule lives here and nowhere else). Forward: each facing id claimed by exactly one of its bet's slices or deferred. Premises: the record read for amendments and withdrawals.
- `/home/user/GroundWork/internal/battery/tracerow.go` — the row.
- `/home/user/GroundWork/internal/seal/mirror.go` — new exported `SubjectOf`, the inverse of `TagName`, reusing `checkTagName` so one rule says what a seal tag is called.
- `docs/derivation-contract.md` gains section 4 with a twelve-row verdict table; `b3s6.md`'s `records:` now declares that page (F90a).

The row never repeats the plan row: a plan that will not load leaves it unrunnable, and both headline proofs assert the plan row is green on their red fixtures.

## Rulings (candidates — I touched neither ledger)

- **Unsealed is loud, never blocking, and flips with R4's.** The anchor resolving is the red; whether a seal covers the file is a state. The head carries `(unsealed)` and the hits name each unsealed file and artifact. That is what keeps this repo's verify honest over three bets of unsealed history.
- **I did not grant the design seal.** A seal is a sign-off; the builder granting the seal its own row reads is the self-graded shape this repo avoids. It also makes a tag this host cannot push and a branch it cannot delete, outside the commit the driver lands, and the grant gate wants a green run over a committed tree. No red of this row depends on it. One command after landing flips the line.
- A **mark is loud, never red** (R13 says "marks", and nothing here lets a bet answer one). R13's journal line **is** the row's own battery-row line. An item **claimed and deferred is claimed twice**. Design files are read **from the working tree** until R15's slice.

## Red/green split

Red at 63c4189: three new test files (two packages fail to build), the kind-vocabulary pin, the shipped-rows pin, three summary pins in `cmd/groundwork/battery_test.go`, and the new `SubjectOf` test. The hostile-repo split moves to `13 rows: green 6, red 2, waived 0, quarantined 0, unrunnable 5` — the trace row is green on a repo with no plan, on the plan row's own D45 shape. Green survivors: `internal/plan` and `internal/board` contract pins, untouched by the new section.

## Blanking

Fifty rules, three passes: **48 killed, 0 survivors, 2 declared can-never-fail** with honest comments. The survivors bought six real tests, including a seal restored with no journal line behind it (R5's fresh clone), and a control character in an anchor driven through a real plan file.

## Verify

`13 rows: green 13, red 0, waived 0, quarantined 0, unrunnable 0` at 11.0+rffb3f30. Trace line:

```
trace  green  24 proofs: 0 dangling; 14 facing ids: 0 unclaimed, 0 claimed twice; 0 marked (unsealed): docs/evidence/bet-3/design.md carries no seal in this repo
```

`go test -p 1 ./...` green alone; `internal/battery` **136.9 s**, inside the 180 s clock. Fourteen journal lines chain under session b3s6, seq 1 to 14.

## Open

Five candidate findings, chief among them: a mark never clears; this repo's design is unsealed so R12's sealed half is a state not a check; and a proof's `from:` path is not held to its bet's `design:` list.
---

## The fix round


Fix round 2 is done. Round-2 handoff at `/tmp/claude-0/-home-user-GroundWork/a5b7b708-4ccf-5ae9-9ab1-41cce247b571/scratchpad/handoff-b3s6-round2.md`.

**1. F94/H1 — the cap.** `trace.MaxDesignBytes = 256 KiB`, the manifest's cap, because a design doc is prose and prose runs longer than frontmatter (this repo's design is ~20 KiB). `anchorsOf` refuses three things, each a dangling anchor with its reason named: a symlink (refused by `Lstat`, so the /dev/zero probe is deterministic), anything not a regular file (a read of a named pipe never returns), and a file over the cap. The cap is **one gate, on the read** — the first draft's size pre-check was a second rule no test could reach, so it went, and the size the file claims is used only for the number in the message. The false comment is replaced by one that says what the plan reader's path check cannot do: it keeps the written path inside the repo, and a committed symlink at such a path points wherever it likes. Both reviewer probes run through the real row:

```
red | 1 proof: 1 dangling; ... docs/design.md was not read for demo_s1_p: is 419430400 bytes, over the limit of 262144 bytes and 1 more
red | 1 proof: 1 dangling; ... docs/design.md was not read for demo_s1_p: is a symlink, and a design file is read as a file and 1 more
```

**2. F95.** §4.4 now says unsealed things are named, not counted, and says why: a seventh count cannot fit a head already at 195 of 200 bytes. `b3s6.md`'s `real:` reads working-tree plan and design docs plus real seals through the verb, per D60.5.

**3. F96/D61.** §4.2 carries ruling 2's words, §4.3 ruling 1's. Two table rows added and driven: a cross-program premise, and a premise of the first bet on a ladder.

**4. F97/D61.3.** The plan reader refuses a doubled facing claim at load, in the switch beside its siblings, its case in the reference-resolution proof. The trace row's two-claims line stays — two claims now mean two slices — with the comment saying why.

**5. LOWs.** `traceTotals.outcome()` is gone; the row's verdict is `rep.Sound()`, one spelling. The pin now drives the middle column *and* asserts each row's state, which matters for the premises rows whose verdict is "no" either way. `linkText` strips an inline link's target. One test ties `plan.CheckID` to `seal.SubjectOf` across nine ids. The two-slices subtest checks the plan row. Three dense sentences split. The three never-driven states now reach the row.

**Proofs.** Blanking: **15 rules, 15 killed, 0 survivors** — including four probes that mutate the contract page (a rewritten middle cell, a flipped verdict, a dropped row, a mark that stopped happening). gofmt and vet clean. `go test -p 1 -count=1 ./...` green alone, `internal/battery` **130.0 s**. One verify alone: `13 rows: green 13, red 0, waived 0, quarantined 0, unrunnable 0` at **11.0+rffb3f30** — digest unchanged — with the trace line unchanged and honest. Fourteen journal lines chain under `b3s6r2`. Ledgers untouched.
---

## The micro-round


Micro-round done. Handoff appended at `scratchpad/handoff-b3s6-round2.md`.

**1. F98 — the escape is closed.** `anchorsOf` calls `inside(root, at)`, which runs `filepath.EvalSymlinks` on **both** sides and refuses when the file resolves out of the repo: the path because every element of it is a committed name, the root because a repo under a symlinked home or `/tmp` is an ordinary repo and resolving one side only would refuse to read anything in it. The message names no path — `resolves outside this repo`. The last-element `Lstat` refusal stays beside it, so each shape gets its own reason.

- The reviewer's probe (`ln -s /outside docs/sub`) reproduced green, and is now red.
- The last-element probes (symlink to `/dev/zero`, named pipe, over-cap) stay red.
- A real design file under real directories still reads — driven on both shapes, plain root and symlinked root, in one test.

Comment and §4.1 rewritten to say what the code does: four refusals, containment spelled out.

**2. N2 — the cap is pinned.** The page writes `262144 bytes, which is 256 KiB`, and `TestThePageWritesTheCapTheRowHolds` holds it the way `TestTheContractWritesEveryCapTheParserHolds` holds the parser's caps. The same test pins the containment refusal: `outsideTheRepo` is a constant the page quotes.

**3. N3 — the boundary is driven.** Exactly `MaxDesignBytes` reads and resolves its anchor; one byte more is refused with the reason named.

**4. N4 — code spans named.** In the comment and on the page: `linkText` fires inside a code span where a renderer would not, so ``## The `[a](b)` form`` slugs as `the-a-form` here and `the-ab-form` on GitHub. Both that and the reference-link limit fail as an unresolvable anchor named on the row's line, which is the direction to be wrong in.

**Proofs.** Blanking: **8 rules, 8 killed, 0 survivors** — the containment check, its two resolutions, the two refusals around it, the page's cap number, and the page's containment bullet (one blank rewritten after it failed to compile). gofmt and vet clean. `go test -p 1 -count=1 ./...` green alone, `internal/battery` **125.4 s**. One verify alone: `13 rows: green 13, red 0, waived 0, quarantined 0, unrunnable 0` at **11.0+rffb3f30**, digest unchanged, trace line unchanged. Ledgers untouched.