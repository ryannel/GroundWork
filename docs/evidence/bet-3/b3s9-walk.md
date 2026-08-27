# Slice 9 — the walk

The design review for bet 3's fix slice, dispatched after D69 ruled the bet stays open. The walk's record, verbatim. The driver's rulings on it stand in D70.

---

# WALK RECORD — b3s9, the bet 3 fix slice

Branch `claude/v2-clean-slate-tkuacl`, head `0787866`. Design only. No code changed, nothing committed.

---

## Diagram 1 — the board's decision flow under the proposed landing rule

```
              git: every Slice: trailer, over the whole history
                                 |
                                 v
                   +------------------------------+
                   |  board.Landings()  UNCHANGED |
                   |  oldest claim  = the landing |
                   |  newer claims  = strays      |
                   +------------------------------+
                     |            |             |
            At[slice]|      Unread|        Wrong|
                     v            v             v
        +----------------------+ named       named + RED
        | milestone reached?   |
        | every slice landed   |
        +----------------------+
             |            |
           no|            |yes
             v            v
      EXPECTED red   EXPECTED green
             |            |
             +-----+------+
                   v
          +------------------+
          | run says passed? |
          +------------------+
            |              |
         yes|              |no
            v              v
  exp red  -> AHEAD    exp red   -> ON PLAN
  exp green-> ON PLAN  exp green -> ?
                                   |
                                   v
              +--------------------------------------------+
              |  NEW GATE, and the only new gate            |
              |  is HEAD this proof's own slice's           |
              |  landing commit?   (At[slice] == h.Head)    |
              +--------------------------------------------+
                     |                          |
                  yes|                          |no
                     v                          v
          LANDING NOT PROVEN              BEHIND ITS PLAN
          counted apart from behind       counted behind
          named under "what a person      RED
          has to look at"                 verb exits 1
          verb exits 0
```

The gate is inert on almost every board. It can only fire when HEAD itself carries a `Slice:` trailer.

## Diagram 2 — the alias trace's judgment flow

```
        if <cond> { t.Errorf(...) }        the assertion's guard
                    |
                    v
        cond is a comparison?  == != < <= > >=  --no--> not vacuous
                    |yes
                    v
        either side holds a call?              --yes--> not vacuous
                    |no                                 (two calls, two answers)
                    v
        source(X) == source(Y)?                --yes--> VACUOUS   (today's rule)
                    |no
                    v
   +----------------------------------------------------------+
   |  NEW: one-hop alias trace, kept while walking a block     |
   |  top to bottom, at one nesting level                      |
   |                                                           |
   |    a := b   /   a = b     b a bare ident, no call         |
   |                            -> alias[a] = b                |
   |    a = <anything else>     -> drop alias[a]               |
   |    b = <anything>          -> drop every alias onto b     |
   |    &a  a.M()  f(a)  func(){...}  for  range  goto  label  |
   |                            -> drop the whole map          |
   |    leaving the block       -> drop the whole map          |
   +----------------------------------------------------------+
                    |
                    v
        resolve(X) == resolve(Y)?   at most one hop each side
                    |                          |
                 yes|                          |no
                    v                          v
                VACUOUS                   not vacuous
     the scan's existing words, unchanged:
     "only asserts under a condition that compares a value to itself"
```

No sixth shape name. The scan still speaks five shapes. Only the fifth one's reach moves.

---

## 1. The landing rule (F120, F124)

**Recommendation.** Three parts, taken together.

**1a. The landing stays the oldest claim.** D57.4 and contract 3.2 stand unchanged. `board.Landings` is not touched.

**1b. The contract states the writing rule out loud.** Section 3.2 gains D67.3's convention, promoted from a repo habit to a rule every adopting repo reads. Words for the page:

> No `Slice:` trailer rides a commit before the slice's work lands. A tests-first repo commits its failing test with `Bet:` and `Tests:` and no `Slice:`, then lands the work with all three. Every commit after the landing may carry the trailer. The board names each of those as a stray, and the record row reads them to find the slice's last code commit.

**1c. The board stops asserting what it cannot know at one commit, and names it.** A fourth `Flag`, `landing not proven`. It is reached only when all three hold: the proof's plan position expects green, the run says the proof is not green, and HEAD is that proof's own slice's landing commit.

**Why.** I looked for a trailer-ordering rule that fixes F124 and there is none. Take sift at `035d288`. Only one commit carries `Slice: s_tokenize` at that point — `035d288` itself. Oldest and newest are the same commit. `LANDED` reads yes either way. The same at `af14585`, `ee669c1` and `863e12f`. So the newest-claim reading fixes F120's mis-aimed pointer and does nothing at all for F124's exit 1.

That is the finding this walk adds. F120 and F124 are one fault seen at two commits, but they are **not one fix**. The pointer is a trailer-ordering question. The false red is not.

I then looked for a mechanical discriminator. A trailer-reading board cannot tell an honest tests-first red from a regression. Both look identical at HEAD: a landed slice, a failing proof of its own. The only things that separate them are the commit's content and the writing convention. So the choice was: read content, or state the convention and guard the worst commit.

Reading content works. `journal.FilesIn(dir, commit)` already exists, so no git seam widens. But it needs a stack fact — which paths are test files — and the `Adapter` interface is a ratified three-call seam. Widening it for a fix slice is out of proportion. Worse, a slice whose whole deliverable is a test file would read unlanded forever.

Reading the run does not work. "Landed means trailer plus proofs green" turns every regression into a benign un-landing. That is the theft D57.4 worried about, arriving from the other side.

So: state the convention, and put the guard at the one commit where the damage is worst. That commit is the one CI runs on right after you commit red. One commit later the same failure is red again.

The guard needs no new input. `Landings` already computes `At[slice]`, and `History.Head` already holds the true HEAD — `journal.Trailers` runs `git log HEAD` over the whole history and returns every commit, so `commits[0].ID` is HEAD, not the newest trailer-carrying commit. The gate is one map lookup.

Checked against the walk tables:

| commit | today | under 1c |
|---|---|---|
| sift `035d288` | 6 on plan, exit 0 | unchanged |
| sift `9bfa992` | 2 ahead, exit 0 | unchanged |
| sift `af14585` | **1 behind, exit 1** | 1 landing not proven, exit 0 |
| sift `2d812e1` | all green, exit 0 | unchanged |
| gauge `863e12f` | **1 behind, exit 1** | 1 landing not proven, exit 0 |
| a regression one commit after a landing | 1 behind, exit 1 | unchanged, still red |

**What LANDED, EXPECTED and the strays note mean under this rule.**

`LANDED` keeps its meaning exactly: a commit reachable from HEAD claims this slice, read at the oldest claim. The contract gains one sentence saying what it does not mean — it says a commit claims the slice, never that the work is proven.

`EXPECTED` is untouched. It still comes from milestone position. See answer 3.

The strays note keeps its rule: every newer claim is named. One new note kind joins it, in its own `Board` field rather than in `Unread` — `Unread` means a trailer the board declined to read, and this one was read. Shape of the line:

```
what a person has to look at:
  claimed before its work  s_record_parse  af14585  its own proof p_record_parse is not green here
```

That line is what tells an adopting repo its convention is wrong. It is never red.

**What changes in internal/board and beside it.**

- `board.go` — a fourth `Flag` constant `NotProven Flag = "landing not proven"`, given the same one-place treatment `Actuals()` gets. `flag()` takes one more argument. `row()` passes it. `Derive` computes `read.At[s.ID] == h.Head` per slice. A new `Board.Premature []Note` field and a `NotProven()` accessor beside `Ahead()`, `Behind()`, `OnPlan()`.
- `board.go` `Holds()` — no edit needed. `Behind()` no longer holds these rows, so `Holds()` stops returning false on its own. That is the single exit-code point (`cmd/groundwork/board.go:101`), so the verb needs no edit either.
- `render.go:68` — the counts line gains a fourth number. `notes()` renders the new block.
- `internal/battery/boardrow.go:220` — `boardTotals` gains the count, kept apart from `behind`, per D57.1: a count that cannot tell a red cause from a benign one is one count too few. `boardVerdict` adds the hits after `Wrong`/`Unread` and before `Ahead`, because they are rarer than the flags and rarer things go first.
- `docs/derivation-contract.md` §3.2 (the convention), §3.3 (the fourth flag row in the table, and the sentence on `LANDED`).

**What it costs.** A repo that commits red, then two unrelated commits, then lands, still reads falsely behind for those two commits. The guard covers the landing commit and no further. That cost is named on the contract page, beside the convention that removes it.

A fourth flag also widens a closed vocabulary. Three states became four, and every reader of `Flag` must be checked once.

**What it rejects.** The newest-claim reading, because it names the real landing commit as the stray at every later commit and fixes no false red. Reading the commit's changed files, because it needs a stack fact from a ratified three-call seam and would leave a test-only slice unlanded forever. Reading the run into landedness, because it turns every regression benign.

---

## 2. The stub catch (F119)

**Recommendation.** A one-hop alias trace inside `selfComparison`'s judgment, in `internal/battery/honestyrow.go`. Two places:

- `(*assertions).walk`, the `*ast.AssignStmt` case at roughly line 550. It calls `a.escapes(value)` today and nothing else. It gains the alias bookkeeping in diagram 2.
- `(*assertions).selfComparison` at line 702. Today it compares `a.source(bin.X)` to `a.source(bin.Y)`. It gains one resolve step on each side, at most one hop.

Nothing else moves. The five shape strings are unchanged. `vacuousShape` is unchanged. The stub row is unchanged — it reads the scan's judgment, and the judgment's reach is what moved.

**Why.** D58.1 made the scan's escape set the stub row's whole boundary, and D66.2 ruled the ladder's named style owes a catch. So the fix belongs where the scan judges, and nowhere else. Keeping the same five shape strings is what keeps D54 satisfied: no second definition of vacuous is written, because no second name is written. The row still prints the scan's words whole, and contract §3.4's list of five still reads true.

The trace is symmetric, so `got := want` above `if got != want` is caught as well as `want := got`.

**What new escape shapes remain.** Named as documented limits on the contract page and in the scan's own doc comment:

- **Two hops.** `mid := got; want := mid; if got != want`. One hop only.
- **Arithmetic identities.** `want := got + 0`, or `if got != got+0`. Catching these needs a constant folder, which is a second definition of vacuous in all but name.
- **Selector and index aliases.** `want := s.got`. Only a bare identifier aliases, because a selector can read through a pointer somebody else writes.
- **Helper-returned copies.** `want := copyOf(got)`. `holdsCall` already bars it, and it stays barred.
- **Two literals.** `want := 5; got := 5; if got != want`. Genuinely vacuous, and a different shape.

**Which I name as limits versus catch.** Catch exactly one: the one-hop bare-identifier alias, in both directions, in straight-line code with no intervening write. Everything above is a named limit. That is the scan's standing posture — precision over recall — and the row's line already says what the scan found rather than what is true of the repo.

**What it costs.** Real work in the guards. Six of them, and every one exists to stop a false red: reassignment of the alias, reassignment of the source, address-taken, method call on either name, either name passed to any call, and any func literal, loop, `goto` or label. Leaving the block drops the map. Each guard needs its own red test. A missed guard is a false red on honest code, which is the worst thing this row can do.

**What it rejects.** A general dataflow pass, which would follow aliases anywhere and would need a false-red budget nobody has measured. A second vacuous rule living in the stub row, which D54 forbids and D66.2 named. A sixth shape string, which would force a contract edit and a new sentence in every table.

---

## 3. Ladder versus contract (F125)

**Recommendation.** The contract is truth. The milestone is the unit. `docs/ladder.md`'s bet 3 clause is corrected, loudly, in a ruling.

Proposed replacement for the third and fourth sentences of bet 3's done-when:

> Three slices land in sequence, and the board tracks each landing as it arrives. A milestone's proofs turn green when its last slice lands, driven by the test run. No board goes red on a repo that commits its tests first.

**Why.** Contract §3.3's rule is `R10` in `docs/evidence/bet-3/design.md`, and `design.md` is sealed. Teaching the board slice-level expectations contradicts a sealed ruling, and would need `design.md` re-sealed. The ladder is not sealed and the contract page is not sealed, so the cheap change and the honest change are the same change.

The reason §3.3 gives is also sound. A milestone is what a bet promises, and a slice is how it gets there.

It coheres with answer 1. Slice-level expectations would make F124 sharper, not softer: at `af14585` `s_record_parse` would read landed, its own proof would read expected green, and the false red would fire at every red-proof commit whatever the milestone held. Keeping the milestone unit keeps the fault confined to the commit where a milestone completes, which is exactly where the answer-1 gate sits.

The replacement clause is still falsifiable, and its third sentence is new teeth: it is the clause F124 would have failed.

**What it costs.** It reads as moving the goalposts after a failed grade. That cost cannot be argued away, only met. It is met by three things: the corrected clause is stricter, not looser; the correction is a numbered ruling, not a quiet edit; and both pages carry the correction where a reader meets the old claim.

F125's second half costs nothing extra. `b3s8.md` says its first fixture is "a two-milestone bet whose three slices land in sequence", and neither sealed repo was that. That sentence came from `R11`, which is sealed and says the same. Rather than amend `R11`, author the fresh fixtures to match it exactly. See answer 7.

**What it rejects.** Teaching the board slice-level expectations. It contradicts sealed `R10`, it needs `design.md` re-sealed, and it makes F124 worse.

---

## 4. The wiring sentence (F121)

**Recommendation.** Reword the constant. Leave the position alone.

`internal/battery/wiringrow.go:99`:

```go
const libraryDeclared = "on profile library an export is dead only when nothing at all names it"
```

The gauge line then reads:

```
the wiring scan found 1 exported function nothing wires up: convert.go:15 ToMetres is
exported and nothing in the module names it; on profile library an export is dead only
when nothing at all names it
```

**Why.** The clause's job is to say which rule was applied. The old wording says what the rule does not require, so read after a hit it sounds like an excuse. The new wording says what the rule does require, so read after a hit it is the rule that condemned it. No reader can take it as a stand-down.

It also still fits the two no-hit lines the constant serves, so one constant stays one constant.

**What it costs.** Eighteen more bytes on a 200-byte line, in the droppable tail. The give-way ladder drops it first, exactly as today, so no hit is lost that is not lost today.

**What it rejects.** Moving the clause in front of the hits. F121 offers that as one of two fixes, but the clause would then be undroppable prefix, and the gauge line already runs near 190 of the 200 bytes. Buying clarity by dropping the name of a hit is a bad trade, and D57.6 says the reason outranks the value only when a line must give something up.

---

## 5. Scope — F122 and F127

**Recommendation.** Both stay recorded. Neither brings code into b3s9. Both get a posture ruled here, because D66.3 asked for a walk and this is it.

**F122, the mutate row mid-bet.** Posture: the unrunnable is the right answer and stays. Mutation needs a package whose tests pass unmutated. A package holding an unlanded slice's red proof cannot give one. Going unrunnable leaves the half being built unjudged rather than misjudged, which is D62.5's safe direction. What the row could add later is legibility, not judgment: a clause naming how many targets were blocked by packages holding proofs the plan expects red. That clause is a candidate for the bet that next touches the battery, per D66.3, and it is not b3s9's.

Why not now: `mutaterow.go` is 44,000 bytes and the fix slice already opens the board, the scan, the contract and the ladder. Widening it there buys nothing the grading asks for.

**F127, a facing id no proof asserts.** Posture: R12's claiming unit stays the slice, per D61.2. Closing the hole means giving a proof its own facing field, which changes the plan file's shape in contract §1.5 and contradicts sealed `R12`. That is a plan-shape change and it wants its own bet.

One thing does come into b3s9: a single sentence in contract §4.2, beside D61.2's sentence, naming the limit out loud.

> The slice is the claiming unit, so nothing links a facing item to a proof. A slice may claim an item none of its proofs asserts, and no row can see that.

The slice already opens that file. One honest sentence costs a line and makes an invisible hole visible.

**What it costs.** Two known holes stay open across a re-grade. If the fresh fixtures happen to bite on either, the grading files it again. That is acceptable — both are recorded, both have a ruled posture, and neither sits inside a done-when clause.

**What it rejects.** Folding either into b3s9. D69 named a fix slice for the graded faults, and these two were named as losses, not faults.

---

## 6. The seal map and the minimal amendment set

`seal/design/bet_3` (tag object `0a29858`) covers ten paths:

```
docs/evidence/bet-3/design.md
docs/plan/rebuild/bet_3/b3s1.md
docs/plan/rebuild/bet_3/b3s2.md
docs/plan/rebuild/bet_3/b3s3.md
docs/plan/rebuild/bet_3/b3s4.md
docs/plan/rebuild/bet_3/b3s5.md
docs/plan/rebuild/bet_3/b3s6.md
docs/plan/rebuild/bet_3/b3s7.md
docs/plan/rebuild/bet_3/b3s8.md
docs/plan/rebuild/bet_3/bet.md
```

Sealed at battery `11.0+rffb3f30`, run `run-20260827T012010Z-49ca`.

**Does `bet.md` need amending to add b3s9?** Yes, and the plan row proves it. `internal/plan/resolve.go:320` reds with `docs/plan/rebuild/bet_3/b3s9.md plans the slice b3s9, and docs/plan/rebuild/bet_3/bet.md does not list it` the moment the file exists unlisted. So `bet.md`'s blob must change, and `bet.md` is covered.

**Which milestone does b3s9 join?** `m_b3_grading`, the existing one. Not a new milestone.

Adding it there has a consequence worth having. Under milestone-unit expectations, `m_b3_grading` stops reading fully landed, so `b3s8`'s proof turns `EXPECTED red` while it passes, and reads `ahead of plan`. This repo's own board then says bet 3 is not done. That is exactly what D69 ruled. A new milestone would hide it.

**Does `design.md` need a new section?** No. The existing sections honestly cover every anchor b3s9 needs:

- `R10 — Expected state, and the stub check (B19, K14)` already names the always-true style by name and already says the stub check calls the honesty scan's own code. It carries the stub-catch proof honestly. It also carries the board flag, because the flag is how expected and actual sit together.
- `R8 — What the board physically is (B25, D16, K15)` declares the `Slice:` trailer and what it is for. It carries the landing-rule proof.
- `R11 — Held-out fixtures for bet 3` carries the re-grade proof, exactly as it carries b3s8's.

So `design.md`'s blob does not change and its seal entry stays valid. That keeps the amendment to plan files.

**F121's fix carries no plan proof.** The wiring row is bet 2's, and bet 3's design has no wiring section. An anchor there would be dishonest. The fix rides as an ordinary code change with an ordinary test in `internal/battery/wiringrow_test.go`. A slice's proofs are its headline claims, not every test it writes.

**b3s9.md itself.** Not strictly required in the seal — an uncovered new path does not redden `seal-verify`. Included anyway, so "bet 3's plan is sealed" stays a true sentence, and because the amendment is already being spoken.

**F131's pending item.** `runs.md` into `b3s8.md`'s `records:` list. It is in the amendment set. F131's forward lesson goes in the decision: declare a slice's records when the slice plan is written, because a records list is frozen at sealing.

---

## 7. The fresh fixtures — holdout4

Two purpose-authored Go repos, named on branches `holdout4-go-<name>`, keys in branch history per D27/F1/F12. `docs/evidence/bet-3/holdout4.md` is written at sealing, per F20 and R11.

**Repo A — the board and the landing rule.** Matches `R11` exactly, which cures F125's second half by construction.

- A two-milestone bet whose **three** slices land in sequence.
- Every landed slice lands **tests-first, in two commits**: a commit whose new tests fail, then the commit that makes them pass.
- The trailer convention **varies between slices, on purpose**. At least one slice puts `Slice:` on both commits. At least one puts it on the landing only. Both shapes are then graded against the same rule.
- At least one slice lands in **three** commits — red, an intermediate, then the landing — so the answer-1 gate's narrowness is graded honestly rather than assumed.
- At least one milestone completes at a red-proof commit, which is the `af14585` shape that broke it.
- The key names, per slice, the commit its author considers the landing, and why.

**Repo B — the stub styles.** The ladder's three, beside honest twins.

- An empty body.
- A commented-out assertion.
- **An always-true assertion whose two sides are not spelled the same.** Plus one or two more always-true assertions, each reaching always-true by a different route.
- The key names each stub's style, its file and line, and for each always-true one, how it reaches always-true in the author's own words.

The extra always-true variants are graded but the ladder's clause does not turn on them. The clause names three styles. What the extras buy is a measured answer to "where does the scan's reach end", instead of a claimed one.

**What the authoring dispatch may be told.**

- Author two Go repos. Read nothing under this repository. Push through git alone.
- The two repo shapes above, in the vocabulary of an ordinary Go project.
- That the ladder names three stub styles: an empty body, a commented-out assertion, an always-true assertion. The ladder is public and this is its own wording.
- That each repo carries `PLAN-INTENT.md`, the prose a blind adopter later translates into plan files.
- The key's schema: per proof — expected, honest, style, where, note. Per slice — the landing commit. Per repo — any wrinkle.
- That real repos disagree about commit conventions, and that this one should too.

**What it must never be told.**

- Anything from this walk. Not the one-hop alias trace, not the guards, not the named limits, not the `landing not proven` flag, not the landing-commit gate, not the convention in 1b.
- Not `docs/derivation-contract.md`, not `docs/ladder.md`'s bet 3 clause, not `internal/board`, not `internal/battery`, not `docs/evidence/bet-3/`.
- Not the phrases "one hop", "no intervening write", "landing not proven", "claimed before its work".
- Not that any particular shape defeated a check before, and not that F119 or F124 exist.

**The line to hold.** The brief describes the shapes a real repo has. It never describes what a check looks for. Naming the target class is fine — the ladder already names it in public. Naming the rule is not. An author who cannot see the rule can only make the class harder, and harder is the direction this exercise wants.

**What it costs.** Two more repos authored blind, sealed before the fix slice's red commit lands. Both burn on first grading.

---

## 8. The slice shape — b3s9

**Proof markers, three, house style.**

| marker | from |
|---|---|
| `TestProof_b3s9_stub_an_aliased_always_true_assertion_is_caught` | `docs/evidence/bet-3/design.md#r10--expected-state-and-the-stub-check-b19-k14` |
| `TestProof_b3s9_board_a_landing_commit_is_not_behind_its_own_plan` | `docs/evidence/bet-3/design.md#r8--what-the-board-physically-is-b25-d16-k15` |
| `TestProof_b3s9_grading_the_fresh_fixtures_are_graded_once_at_13_0` | `docs/evidence/bet-3/design.md#r11--held-out-fixtures-for-bet-3` |

Anchors checked by §4.1's slug rule. The third matches `b3s8.md`'s existing anchor character for character, which is the check that the rule was applied right.

The third proof learns from F128 and F134. It must open `docs/evidence/bet-3/slice-9/runs.md`, read the supplement's own section body rather than the page, and require the battery version `13.0`, both fixture names, and a floor on the count of verbatim run captures. Every new assertion probed by blanking the load-bearing text in memory, per F118's rule: no git command touches an uncommitted file.

**Records b3s9 declares** — declared in the plan file when it is written, so F131's trap is never sprung:

```yaml
records:
  - docs/evidence/bet-3/holdout4.md
  - docs/evidence/bet-3/slice-9/runs.md
```

**Facing.** Empty. b3s9 delivers no new user-visible surface. It moves two rows' judgments and one row's wording.

**The version bump.** `.groundwork-battery.json` from `{"version":"12.0",...}` to `13.0`. Once, per D23 and D69. The digest recomputes. The bump rides in the landing commit, never left dirty — D62.8 makes an uncommitted bump read red, and this repo's own slice 7 build proved it. The bump rotates the mutation sample (`mutaterow.go:214`). Budget one fix round, per D28 and R16, and never fix by weakening a row.

**The red/green commit plan.** Three commits. The slice's own history is written under the rule the slice proposes.

1. **Red.** The three proof tests and the unit tests for the alias guards and the board gate, all failing. Trailers `Bet: bet_3` and `Tests:`. **No `Slice:` trailer** — that is 1b, applied to itself.
2. **Green, the landing.** `honestyrow.go`, `board.go`, `render.go`, `boardrow.go`, `wiringrow.go`, `derivation-contract.md` §3.2/§3.3/§3.4/§4.2, `ladder.md`'s clause, `b3s9.md`, `bet.md`, `b3s8.md`, the lock at 13.0. Trailer `Slice: b3s9`.
3. **Evidence.** `holdout4.md`'s grading record and `slice-9/runs.md`, written after the blind run against the landed binary. Trailer `Slice: b3s9` — a stray the board names, and the commit the record row reads for staleness.

At commit 2 the grading proof is still failing, because `runs.md` does not exist yet. That is the answer-1 gate's own shape, on this repo, at this commit. The board will flag it `landing not proven` and exit 0, and go green at commit 3. Worth saying out loud in the slice's report: the fix demonstrates itself, and the demonstration is real rather than arranged.

**Dispatch order.** Three agents, following D69's "runner and grader apart, the way slice 8 ran".

1. Owner speaks the amendment. Fresh fixtures authored blind, keys sealed, `holdout4.md` written at sealing.
2. Builder: commits 1 and 2.
3. Blind runner: runs the landed 13.0 binary on both fixtures, records verbatim, opens no key.
4. Grader: opens the keys, grades, files every miss and every false red.
5. Builder or driver: commit 3.
6. Blind reviewer on the diff and the brief. Then the close audit re-runs.

---

## AMENDMENT REQUEST — for the owner

`groundwork seal amend --kind design --subject bet_3 --reason "<the owner's words>"` with all eleven paths. Three blobs change; `design.md` and b3s1–b3s7 are unchanged and re-listed as they are.

| path | change | why, one line |
|---|---|---|
| `docs/plan/rebuild/bet_3/bet.md` | add `- id: b3s9` / `milestone: m_b3_grading` to `slices:` | without it the plan row reds: a slice file the bet does not list |
| `docs/plan/rebuild/bet_3/b3s8.md` | add `docs/evidence/bet-3/slice-8/runs.md` to `records:` | F131's pending item — the run record is pinned by one test alone today |
| `docs/plan/rebuild/bet_3/b3s9.md` | new file, added to the covered set | so "bet 3's plan is sealed" stays a true sentence |
| `docs/evidence/bet-3/design.md` | **no change** | R8, R10 and R11 honestly carry all three of b3s9's anchors |
| `docs/plan/rebuild/bet_3/b3s1.md` … `b3s7.md` | **no change** | re-listed unchanged |

Nothing else in the amendment. `docs/ladder.md` and `docs/derivation-contract.md` are not sealed and are not part of it — they change under a recorded ruling instead.

An agent never moves this seal. R6 and D67.6 hold.
