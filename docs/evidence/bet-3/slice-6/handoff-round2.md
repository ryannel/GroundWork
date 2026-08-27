# Handoff — bet 3 slice 6, fix round 2

Builder's running record for the review fixes. Ledgers untouched. Base for this round:
368ed9d (D61 and F94-F97 recorded), with the slice's own work still in the working tree.

Read first: D61's three rulings, F94 to F97, and D60.5 and D60.7 (the two the record drifted from).

## The six items, and what each became

Filled in as each lands.

### 1. F94/H1 — the cap, the symlink, and the false comment

`trace.MaxDesignBytes = 256 * 1024`, the manifest's cap rather than the plan reader's 64 KiB.
The justification is what the file is: a design doc is prose written for people, and prose runs
longer than a page of frontmatter. This repo's own design is about 20 KiB, so the cap sits an
order of magnitude above the real thing and far below what hurts.

`anchorsOf` now refuses three things before a byte is read, each one a dangling anchor with its
reason named:

- a symlink — **refused, cheaply, by `Lstat`**, so the /dev/zero probe is deterministic;
- anything that is not a regular file — a read of a named pipe never returns;
- a file over the cap, named with its size.

The cap is checked twice on purpose: the size the file claims gives the error its number without
reading anything, and a limited read of `MaxDesignBytes+1` is what actually holds — a file can grow
between the two, and a device can claim a size of zero.

The false comment is gone. What replaced it says what each guard does and what the plan reader's
path check cannot do: it keeps the written path inside the repo, and a committed symlink sits at
such a path and points wherever it likes. The page carries the same three rules (§4.1).

The reviewer's two probes run through the real row, `TestProof_b3s6_backward_a_design_file_the_row_will_not_read_is_named`:

```
red | 190 bytes | 1 proof: 1 dangling; 0 facing ids: 0 unclaimed, 0 claimed twice; 0 marked (unsealed): docs/design.md was not read for demo_s1_p: is 419430400 bytes, over the limit of 262144 bytes and 1 more
red | 189 bytes | 1 proof: 1 dangling; 0 facing ids: 0 unclaimed, 0 claimed twice; 0 marked (unsealed): docs/design.md was not read for demo_s1_p: is a symlink, and a design file is read as a file and 1 more
```

Both name the file and the number, and the battery is alive to say so. The 400 MB file is sparse,
so the case costs no disk: the row refuses it on its size and never reads a byte. A third case
covers the named pipe at the package level.

The unread message lost four words to make room — "was not read for <proof>" rather than "holds the
proof <proof>, and it could not be read" — so the whole reason fits the line beside the head.

### 2. F95/M2+M5 — the page and the plan file

§4.4 said the clauses name which unsealed things and how many; the row passes nil clauses by
design (D60.7). The page now says they are named beside the row's other findings, and says why
there is no count: a count of them would have to sit in the head to be worth anything, and the head
is full at its widest (195 of 200 bytes). I kept the note and fixed the page rather than adding a
seventh count — the arithmetic does not allow one, and the names are what a reader acts on.

`b3s6.md`'s `real:` now reads "the plan and the design docs this repo commits, read from the
working tree" and "real seals, granted and amended through the seal verb", which is what D60.5 and
F92 make true.

### 3. F96/D61.1+2 — both readings, in D61's words

§4.2 carries ruling 2: the slice's facing list is the claiming unit, because a proof carries no
facing field and the slice is the unit that lands. §4.3 carries ruling 1: the mark falls on every
bet whose premises name the artifact, closed bets included and across programs, and later is
satisfied by construction because a premise is a sealed artifact.

Two table rows added and driven: a premise in one program naming an artifact sealed under another,
and a premise of the first bet on a ladder whose artifact moved. Both are marked, neither is red.

### 4. F97/D61.3 — the duplicate

`internal/plan/resolve.go` refuses a facing id repeated in one slice's list, at load, in the switch
beside its sibling ("claims the facing item %s twice"). Its case joins
`TestProof_b3s1_references_resolve_or_the_reader_names_them`, the table where the bet's own doubled
slice already sits.

The trace row's `by[0]`/`by[1]` line stays: two claims now mean two slices, which is the case it
names. Its comment says why. The verdict table needed no row, because the state stops being
reachable — §4.2 says so in prose.

### 5. The lows

- **(a) one rule, one spelling.** `traceTotals.outcome()` is gone. The row's verdict comes from
  `traceOutcome(rep)`, which asks `rep.Sound()` — the trace package's own ruling on which states are
  red, stated once. `verdict` takes the outcome as an argument. And the three states that never
  reached the row in a test now do: a design file the row will not read, a withdrawn premise, and an
  item claimed and deferred.
- **(b) the middle column joins the pin.** Each table row carries the middle cell's words and an
  assertion about the report, so a gutted middle cell fails and a row that produces nothing fails.
  That last part matters for the premises rows: their verdict is "no" either way, so without the
  state check a mark could stop happening and the pin would pass.
- **(c) links in headings.** `linkText` strips an inline link's target and keeps its words, which is
  what a renderer's anchor is built from. The case is on the page and in the table test.
  Reference-style links and images are named as the limit, in the code and on the page.
- **(d) the premise-id charset.** One test walks nine ids past both rules and fails when
  `plan.CheckID` and `seal.SubjectOf` disagree — the boundary at `seal.MaxSubjectBytes` included.
- **(e)** the two-slices subtest checks the plan row, like its siblings.
- **(f)** three dense sentences split, the two worst in `tracerow.go` (57 and 53 words).

## The blanking table, round 2

Fifteen rules — everything the fix round added or moved, plus four probes that mutate the contract
page itself, because a pin is only worth what a mutated page proves. Script at `scratchpad/sweep4.py`,
raw output at `scratchpad/sweep-4.txt`. Filters: `internal/trace` whole, `internal/plan` whole,
`internal/battery -run 'Trace|b3s6'`.

**15 killed, 0 survivors, 0 did-not-build.**

| Rule | Answer |
|---|---|
| anchorsOf refuses a symlinked design file | killed |
| anchorsOf refuses a design file that is not a regular file | killed |
| anchorsOf refuses a design file over the cap | killed |
| the over-cap message names the file's own size | killed |
| a heading's text is read through linkText | killed |
| linkText drops a link's target and keeps its words | killed |
| the plan reader refuses a facing id claimed twice by one slice | killed |
| the row's verdict is the report's own Sound | killed |
| Sound counts Dangling / Unclaimed / Twice (three rules) | killed |
| the pin catches a rewritten middle cell | killed |
| the pin catches a flipped verdict cell | killed |
| the pin catches a dropped table row | killed |
| the pin catches a mark that stopped happening | killed |

Two notes on how two of those died, because the way they died is the point.

The not-a-regular-file rule died by hanging: with the refusal blanked, the row opens the named pipe
and the read never returns, so the suite ran to its own ten-minute clock and panicked. That is the
defect the rule prevents, seen from the inside.

The limited read is one gate now, not two. The first draft checked the size the file claims and then
read under a limit, and the second check was a rule no test could reach — a file that grows between
the two, or one that lies about its size. Rather than declare an unprovable rule, the check moved
onto the read alone, where the 400 MB case drives it, and the size the file claims is used only for
the number in the message.

## The proofs, run

gofmt clean, `go vet ./...` clean.

`go test -p 1 -count=1 ./...` green alone (`scratchpad/green-r2b.txt`). `internal/battery` at
**130.0 s**, inside the 180 s clock.

One full verify alone, `GROUNDWORK_SESSION=b3s6r2 go run ./cmd/groundwork verify`, kept whole at
`scratchpad/verify-b3s6-r2.txt`. The session is its own because the session is the run (D49.1); the
first round's lines stay where they are.

```
battery 11.0+rffb3f30
...
trace         green    24 proofs: 0 dangling; 14 facing ids: 0 unclaimed, 0 claimed twice; 0 marked (unsealed): docs/evidence/bet-3/design.md carries no seal in this repo
13 rows: green 13, red 0, waived 0, quarantined 0, unrunnable 0
```

The digest is unchanged at **rffb3f30**: no row was added, removed, renamed or re-severitied, and
the head's shape did not move. The version row confirms it against the committed lock file.

Fourteen journal lines chain under `b3s6r2`, seq 1 to 14, the trace row at 13 and the run's own
line at 14.

## Candidate ledger entries from this round

Nothing new to rule. Every fix follows a ruling already made: D61's three, D60.5 and D60.7, D54.1
for the one spelling, D49.2 for printable, F55's four answers for the sweep. The one call I made
inside the fixes is the cap's size — 256 KiB, the manifest's, because a design doc is prose — and it
is written on the page and in the code where the next reader meets it.

Still open, unchanged from round 1: F91's mark that never clears, F92's ungranted design seal
(the driver's, from the landed tree), and F93's three named boundaries.

# Micro-round — F98

## 1. The escape

`anchorsOf` now resolves the whole path and holds it inside the repo. `inside(root, at)` runs
`filepath.EvalSymlinks` on **both** sides and refuses when the file resolves out: the path because
every element of it is a committed name, and the root because a repo under a symlinked home or a
symlinked `/tmp` is an ordinary repo, and resolving one side only would refuse to read anything in
it. The message names no path: `resolves outside this repo`.

The last-element `Lstat` refusal stays beside it. Two rules, because it took two: one names the
file that is a symlink, the other names the directory that was.

- The reviewer's probe (`ln -s /outside docs/sub`, `from: docs/sub/secret.md#anchor`) is red, and
  reproduced red before the fix.
- The last-element probes stay red, each with its own reason.
- A real design file under real directories still reads, and reads through a symlinked root too —
  both shapes are driven in one test.

The comment and §4.1 now say what the code does: four refusals, with the containment one spelled
out and quoting the row's own words.

## 2. The cap, pinned to the page

`MaxDesignBytes` is written on the page as `262144 bytes, which is 256 KiB`, and
`TestThePageWritesTheCapTheRowHolds` holds the number the way
`TestTheContractWritesEveryCapTheParserHolds` holds the plan parser's. The same test holds the
containment refusal: `outsideTheRepo` is a constant, and the page quotes it.

## 3. The boundary

`TestTheDesignFileCapIsDrivenAtItsBoundary`: a file of exactly `MaxDesignBytes` reads and resolves
its anchor; one byte more is refused with the reason named.

## 4. Code spans

Named in both places. `linkText` runs inside a code span, where a renderer leaves the brackets
alone: ``## The `[a](b)` form`` slugs as `the-a-form` here and `the-ab-form` on GitHub. Both this
and the reference-style-link limit fail the same way — an anchor nobody can resolve, named on the
row's line — which is the direction to be wrong in.

## Proofs

Blanking, this round: **8 rules, 8 killed, 0 survivors** (`scratchpad/sweep-5.txt`, `sweep-6.txt`).
They are the containment check and its two resolutions, the two refusals it sits between, the
page's cap number, and the page's containment bullet. One blank was rewritten after it failed to
compile, so the mutation was the rule and not the compiler.

gofmt clean, `go vet ./...` clean. `go test -p 1 -count=1 ./...` green alone
(`scratchpad/green-r3.txt`), `internal/battery` at **125.4 s**.

One verify alone, session `b3s6r3` (`scratchpad/verify-b3s6-r3.txt`):

```
battery 11.0+rffb3f30
trace   green   24 proofs: 0 dangling; 14 facing ids: 0 unclaimed, 0 claimed twice; 0 marked (unsealed): docs/evidence/bet-3/design.md carries no seal in this repo
13 rows: green 13, red 0, waived 0, quarantined 0, unrunnable 0
```

Digest unchanged at rffb3f30. Ledgers untouched; nothing new to rule this round.
