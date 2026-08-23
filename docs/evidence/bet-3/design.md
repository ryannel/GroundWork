# Bet 3 design: planning and the board

**Status:** proposed. The driver ratifies the slice cut and the rulings. Nothing here is built.
**Written:** 2026-08-23, on the bet 3 branch at c5a0663.
**Sources read:** docs/ladder.md (bet 3 section, the four coverage tables), docs/spec/loop.md, proof.md, record.md, doors.md, changes.md, surfaces.md, index.md, docs/execution-plan.md §4, docs/decisions.md (all), docs/findings.md (all), docs/carried-over.md.

---

## 1. What bet 3 has to end with

The ladder's done-when, copied:

> A two-milestone bet decomposes into a board that starts red — red for the right reason. The stub check catches three stub styles it was never tuned against: a commented-out assertion, an always-true assertion, and an empty body. Three slices land in sequence. Each one turns exactly its own row green, driven by the test run. No file gets edited just to move the board.

Its lands line: program and bet artifacts, the derivation contract, proof plans, board derivation, test markers, two-direction traceability, seals and the amendment protocol.

The commitment rows bet 3 owns: B2, B7, B9, B15, B19, B25, K1, K2, K4, K14, K15, D7, D16, O11, O16, O33.

The inherited work, from the ledger: the hash-chained journal, signed seal tags, chain continuity in verify (F13, D26), the seal line's battery fields and the lock file's read source (D28), the waiver counter (D37 ruling 2), the `record` check verb (D39 ruling 2), and waiver-authority hardening (D24: "the seal machinery of a later bet hardens it").

---

## 2. The slice cut

Eight slices. The order follows one rule: a thing is built before the thing that grades it, and the grading runs last against fixtures nobody building the checks ever saw.

**Slice 1 — The plan artifacts and their reader.**
The program file, the bet file, and the per-slice proof plan. One markdown file per unit, machine-read fields in frontmatter, prose below. The reader, the id rules, and a `plan` battery row that fails when a file will not parse, an id repeats, or a referenced id does not resolve. No board yet, no seal yet.
Why first: every later slice reads these files. Nothing else can be defined until their shape is fixed.
Proves it: table tests over good and hostile frontmatter, plus the row's own red on a repo whose plan is broken.

**Slice 2 — The hash-chained journal, and chain continuity in verify.**
Each journal line carries the hash of the previous line in its own session. The envelope moves to v2. A `chain` battery row walks each session and reports a break, a gap, or an unchained prefix. This is F13's first and third parts.
Why here: it touches the journal writer alone, and every line written after it — including slice 3's seal lines — is then chained. Doing it after the seal work would leave the seal lines unchained.
Proves it: forged and deleted lines built with git plumbing, driven through the real row, in the shape F10's review used.

**Slice 3 — Seals: one mechanism, four kinds.**
`groundwork seal` grants, verifies, and amends. A seal is an annotated git tag naming the artifact paths it covers, their blob hashes, and the battery version. Signature verification against a committed allowed-signers file. The seal journal line gains the `battery` and `battery_run` fields D28 deferred. The seal mirror branch, because this host refuses tag pushes. The amendment protocol and its recorded before-and-after. A `seal-verify` battery row.
Why here: it needs the plan files to point at (slice 1) and the chain to record into (slice 2). It is the last piece of F13.
Proves it: seals granted and broken in scratch repos through the built binary; a moved artifact turns the row red; an unsigned seal never reads as verified.

**Slice 4 — Test markers and the board derivation.**
The proof marker in a Go test name, the `Slice:` commit trailer, and the derivation that joins the sealed plan to the adapter's per-test run results. `groundwork board` renders it. A `board` battery row reconciles expected state against actual: a proof on an unreached milestone must be red, a proof on a landed slice must be green, and green ahead of plan is flagged. The row writes nothing.
Why here: it stands on slices 1 and 3 and needs nothing from 5 to 8.
Proves it: fixture repos where the same plan and the same tests sit at different landed positions, with a test that fails if the row writes any file.

**Slice 5 — The stub check: red for the right reason.**
A proof the plan expects red must fail at a real assertion. A proof that passes, skips, fails to build, or dies before its assertion is not a red for the right reason. The check calls the honesty scan's own code rather than a second copy of it.
Why here: it reads expected state, so the board has to exist first.
Proves it: this slice is graded in slice 8 against sealed fixtures it never saw. Its own tests use separate, openly-authored cases.

**Slice 6 — Two-direction traceability and the cross-bet invalidation signal.**
Backward: every proof names the design anchor it comes from, and the row fails on an anchor that does not resolve. Forward: every user-facing item the bet's design names is claimed by exactly one slice's proof or recorded as a deferral. A `trace` battery row. Beside it, the invalidation signal: a bet's plan declares the premises it stands on, and amending or withdrawing an artifact marks every later bet that cites it.
Why here: it reads the plan and the seal, and nothing later depends on it.
Proves it: a fixture bet with a design item that belongs to no slice — the failure shape the spec names, where every slice was individually correct.

**Slice 7 — The record row, the waiver counter, the history shape, and the close scope.**
D39's `record` check: the records a plan declares must exist, and must not predate the work they describe. D37's waiver counter: three waivers of one row in a bet, or five across the repo, and the row stays red until a finding names it. D24's hardening: the counter reads the waiver files' own git history, per D38. The merge-commit rule surfaces.md asks for. The bet-close row scope D7 replaces the ceremony list with. The lock file's read source, D28's second deferral.
Why here: every one of these needs bet boundaries, which only slices 1 and 3 create.
Proves it: shallow-clone and merge-commit shapes driven through the real rows, in the shape F24 and F26 used on the waiver machinery.

**Slice 8 — The held-out grading run.**
The sealed fixture set is run once: the two-milestone bet decomposes, the board starts red for the right reason, three slices land in sequence and each turns exactly its own row green, and the stub check faces the three planted styles. Grading only — no tuning. A finding is filed for every miss and every false red, and any fix is its own slice at a new battery version.
Why last: nothing grades itself, and the grade is worthless if the graded code was tuned against the fixtures.
Proves it: the sealed answer keys, and docs/evidence/bet-3/holdout.md as the record.

---

## 3. Where the inherited work lands

| Inherited item | Source | Owner |
|---|---|---|
| The hash-chained journal | F13, D26 | Slice 2 |
| `verify` checks chain continuity | F13, D26 | Slice 2 |
| Signed seal tags | F13, D26, proof.md | Slice 3, under ruling R4 |
| The seal line's `battery` and `battery_run` fields | D28 | Slice 3 |
| Waiver-authority hardening | D24 | Slice 3 (the seal covers waiver files) and slice 7 (the counter) |
| The waiver counter, three and five | D37 ruling 2 | Slice 7 |
| The `record` check verb | D39 ruling 2 | Slice 7 |
| The lock file read from the HEAD blob | D28 | Slice 7 |

Nothing on that list is ruled out of the bet.

Two things the brief named stay out, with reasons the driver can ratify:

- **F30, the node adapter pinning discovery to the project's own test command.** F30 binds the later adapter bet by name. Bet 3 adds no adapter call that F30 touches. It stays out.
- **F14, the web profile's missing probe list.** Untouched here. Bet 3 builds no probe.

---

## 4. The rulings the driver must make

Each one is written to be adopted as it stands, in D26's format. Numbers are local to this document.

### R1 — Where plans live, and what a plan file is

Three files, all committed, all markdown:

- `docs/plan/<program>/program.md`
- `docs/plan/<program>/<bet>/bet.md`
- `docs/plan/<program>/<bet>/<slice>.md` — the proof plan

Every machine-read field lives in the frontmatter. Everything below the frontmatter is prose, and no parser reads it. A field with no reader in this bet is not written at all.

Ids use lowercase letters, digits and underscore. An id is unique across the repo.

Why: humans seal these files and the tower will render committed docs, so markdown. A parser that read prose would break every time someone rewrote a sentence. And a field nobody reads is a field two slices will fill two ways — D28's lesson.

The spec names a per-milestone file. Here a milestone is a section of the bet file, because a milestone's only machine-read content is its order and its headline proofs. If a later bet needs per-milestone prose, it splits the file then.

### R2 — The proof plan's fields (O11, first half)

`program.md`: id, title, goal, done (one falsifiable line), ladder (ordered bet ids, each with one line and a proof sketch).

`bet.md`: id, title, program, design (paths of the sealed design docs), milestones (ordered: id, title), slices (ordered: id, milestone), facing (id plus one line, for each user-visible thing the design names), deferred (facing id plus reason), premises (ids of sealed artifacts this bet stands on).

`<slice>.md`: id, bet, milestone, proofs (each: id, marker, from, headline, retire_at_close), fixtures (the axes that must vary), real (what runs real), faked (what does not), facing (the ids this slice claims), records (paths this slice owes), and a data block — reversibility, expected runtime class, fixture provenance — required when the slice declares it touches data.

There is no lane field. Lanes land in bet 8, and they add it then.

Why: these are the entries proof.md names, and nothing else. Each one has a reader in this bet.

### R3 — One seal mechanism, four kinds (O33, and O11's second half)

Kinds, closed: design, acceptance, birth, adoption. The journal's `seal_kind` is closed to the same four.

A seal is an annotated git tag named `seal/<kind>/<subject-id>`. Its message carries the kind, the subject id, and every path the seal covers with that path's blob hash at the sealed commit. The battery version pair rides as trailers on the same tag, which is where D23 puts it.

Composition is a longer path list, never a second tag. On the complex lane the design seal covers the design docs and the slice proof plans together, in one tag.

`seal verify` recomputes each covered path's blob hash at HEAD and names every path that moved. It also checks the tag's battery trailers against the seal line's `battery` and `battery_run` fields, which is the check D23 asked a later bet for.

Why: this makes "does the work still match what was sealed" a hash comparison instead of a reading. It is also the whole amendment protocol's foundation: a moved artifact is red until the tag moves through the verb.

### R4 — What a signature is in this environment

proof.md asks for seal tags signed with a key the agents cannot read. In this environment there is no such key. The agents run inside the container, and any key the container can use, they can read.

So:

- The CLI never holds or creates a signing key. It only verifies.
- Verification uses git's SSH signature path against a committed allowed-signers file at `.groundwork/allowed-signers`, so a fresh clone can verify with no keyring setup.
- A seal has three states: verified (a good signature by a listed key), unsigned, and missing. Missing is red. Unsigned is printed loudly and never counts as human authority.
- In bet 3, unsigned is loud but not blocking. Making it blocking now would either put a signing key inside the agents' reach — which defeats the control — or block every run in this environment.
- The deferral is named here: when the owner's key signs seals, unsigned becomes blocking, and that flip is a major battery bump.

Why: the control is only real when the key sits outside the audited party. Saying that plainly is worth more than a signature the audited party can produce on demand.

### R5 — Seal tags and the host limit (F1, F12)

The host's git proxy refuses pushes outside `refs/heads`. A seal that exists on one machine is not proof of anything.

Mechanism, in D20's shape: each seal tag's raw object bytes are stored as a blob on the branch `groundwork-seals`, one file per tag name, with a small index. `groundwork seal restore` rehydrates the tags in any clone — `git hash-object -t tag -w`, then `update-ref` — reproducing the same object id, so an owner's signature survives the round trip byte for byte.

The branch is a mirror, not a second record. The tag stays the thing the tools read.

### R6 — The amendment protocol, and the half machinery cannot enforce (K1)

`seal amend` prints the before and the after, refuses without a reason, moves the tag, records the prior target in the mirror, and writes the journal line. Until a move kind exists, a move is two lines — revoked then granted, per D13.

What machinery cannot enforce here: "only on the owner's explicit words". An agent typing a reason is not the owner speaking. So the record states who signed the amended tag, and an unsigned amendment reads as agent-recorded, never owner-approved. Same limit as R4, recorded once.

### R7 — The journal chain (this amends D8)

The chain is per session, not repo-global. D8's union merge works because sessions are independent, and a repo-global chain would conflict on every merge.

Each line carries `prev`: the sha256 of the previous line of the same session. `seq` stays the ordering field.

The envelope's `v` moves from 1 to 2. D8 says "the envelope does not change"; this ruling amends that sentence. Later bets still add kinds without touching the envelope.

A v1 line has no `prev`. The chain check names the unchained prefix and never calls it forged. A break — a gap in seq, or a `prev` that does not match — is red, naming the session and the seq.

What the chain proves: deletion and rewriting become evident to anyone who reads the ref. What it does not prove: it cannot stop an agent with write access from rewriting the chain forward. Only R4's signature can do that, and only with the key outside.

### R8 — What the board physically is (B25, D16, K15)

The board is a derivation. It is never a file anyone edits.

Three inputs:

1. The sealed plan — which proofs exist, and which milestone each belongs to.
2. Git — which slices have landed, read from a `Slice: <slice-id>` trailer on commits, never from a file's claim.
3. The adapter's per-test run results — which proofs are red and green.

`groundwork board` renders it, stamped with the run it came from. A `board` battery row fails when expected and actual disagree. The row writes nothing.

The only committed board is the frozen one written at archive. The archive step that calls for it belongs to a later bet (see the gaps, §5).

Derivation-contract addition: a slice's commit carries `Slice: <id>` beside the existing `Bet:` and `Tests:` trailers. That is what makes landed-ness readable from git, and it is what keeps expected state out of the plan file.

### R9 — Test markers (O16)

Go: the marker lives in the test function's name, because `-run` filters names and no second file can then drift from it.

A proof's test is named `TestProof_<proof-id>_<readable words>`. Proof ids are lowercase letters, digits and underscore, so the id is spelled identically in the plan file and in the test name — D28's one-spelling rule. A bet's filter is `go test ./... -run 'Proof_b3'`.

Proof ids use underscore where row ids (D28) use dash. That is deliberate and worth stating: a proof id has to sit inside a Go identifier, and a row id never does. Neither charset admits the other's separator, so the two cannot be confused for one spelling of the same thing.

Other stacks declare their marker convention through the adapter seam and land with their adapter bets. An unmapped stack is a fail-closed red row, per D25. Bet 3 ships the Go path only, and §5 names that deferral.

### R10 — Expected state, and the stub check (B19, K14)

Expected state comes from plan position. A proof whose milestone still holds unlanded slices is expected red. A proof on a fully landed milestone is expected green. Green ahead of plan is flagged, not silently accepted.

The stub check judges the reds: a proof expected red must fail at an assertion. Passing, skipping, failing to build, or dying before the assertion each fail the row, with the reason named.

All three stub styles the ladder names surface here. An empty body, a commented-out assertion, and an always-true assertion all pass when the plan says they must fail.

The stub check calls the honesty scan's own code for the vacuous-assertion judgment. It never carries a second definition of vacuous — proof.md's own rule, and a class this ledger already knows.

### R11 — Held-out fixtures for bet 3

Bet 3 needs its own held-out set. Bet 2's are burned (D41), and they prove nothing about a board.

Two purpose-authored Go fixture repos:

- One carrying a two-milestone bet whose three slices land in sequence.
- One carrying the three planted stub styles beside honest twins.

A dispatch that never sees bet 3's code authors them. The answer keys are sealed before slice 1 lands, and `docs/evidence/bet-3/holdout.md` is written at the same moment — F20 says the record is written when the keys are sealed, not later. The keys ride in branch history, because tags cannot push (D27, F1, F12).

A graded run burns the fixture. Tuning after a grading bumps the major and needs freshly authored fixtures, exactly as D41 ruled.

### R12 — Two-direction traceability (B7)

Backward: every proof carries `from: <design-path>#<anchor>`. The row fails when the anchor does not resolve inside a sealed design file.

Forward: every id in the bet file's `facing` list is claimed by exactly one slice's proof, or listed under `deferred` with a reason. Unclaimed and unrecorded is red. Claimed twice is red.

Why the forward half exists: the recorded failure was a sealed Undo pattern that belonged to no slice. Every slice was individually correct, and only this direction sees that.

### R13 — The cross-bet invalidation signal (B9)

A bet file declares `premises` — the ids of sealed artifacts it stands on. Amending or withdrawing an artifact marks every later bet whose premises name it. The signal is a battery row plus a journal line, and it re-runs at every bet close, which is where the ladder already puts it.

### R14 — The record row, the waiver counter, history shape, and the close scope

- **record (D39).** A slice plan declares `records`, a list of paths it owes. The row fails when one is missing, and when one's last commit predates the slice's last code commit. It judges declared records only. A row that invents obligations becomes the friction-waived class.
- **The waiver counter (D37 ruling 2, D24).** Three grants of one row inside one bet, or five across the repo, and that row stays red until a finding names it. Grants are counted from each waiver file's own git history, per D38 — not from the journal alone. A shallow clone cannot see that history, so the row reports unrunnable and never counts zero. That is D17's rule.
- **History shape.** A check that a bet closes on a merge commit, never a squash. A squash erases every `Slice:` trailer the board reads.
- **The close scope (D7).** `verify --close` runs the rows that exist at bet close: full suite, seal-verify, board, trace, record. Later bets add their rows to the same scope. The ceremony list is replaced by a scope, not by prose.

### R15 — The lock file's read source (D28's second deferral)

Once the seal machinery exists, the battery lock file is read from the HEAD blob, the same read a covered path gets. A working-tree-only bump then reads as drift, which is the honest answer: an uncommitted battery version is not one anybody can be held to. CI is unaffected — it already reads committed content.

### R16 — Version bumps during this bet

Each slice that adds a row moves the major, per D23 — once per slice, however many rows that slice adds. Slices 1 through 7 each add at least one row, so the version walks from 5.0 to about 12.0 across the bet.

Each bump rotates the deletion test's sample, and F29 proved that finds real survivors in this repo's own code. Budget one fix round per bump, and never fix by weakening a row.

Bet 2's held-out claim is pinned at 5.0 and is untouched by these bumps.

D28 closed the row-kind vocabulary to D26's nine verbs plus version. Each new row here joins that closed list as its own kind — `plan`, `chain`, `board`, `stub`, `trace`, `record`, `waiver-count`, `history` — following D29's precedent with the manifest row. `seal-verify` is already on D26's list and needs no addition. Filing a new row under an existing kind would misname it in every table and journal line.

### R17 — The derivation contract is one page (K2)

`docs/derivation-contract.md` is created in slice 1 and appended by every later slice that adds a parsed shape — the seal ceremony in slice 3, test naming and trailers in slice 4, history shape in slice 7. Every kept parser's test names the section it implements, so read and write ship together, as surfaces.md requires.

Later bets append their own sections: `Lane:` with lanes in bet 8, `Visual:` with the UI rows in bet 11.

---

## 5. The coverage read (D31)

D31 makes this a standing duty of every bet design: read the bet's spec sections for requirements no slice carries, and for vocabulary no ruling pins, before the cut is ratified.

### 5.1 Every bet-3 commitment row has a slice

| ID | Item | Slice |
|---|---|---|
| B2 | The program artifact | 1 |
| B7 | Two-direction decomposition traceability | 6 |
| B9 | The cross-bet invalidation signal | 6 |
| B15 | The proof plan | 1 (format), read by 4 |
| B19 | The red-for-the-right-reason stub check | 5, graded in 8 |
| B25 | The board derivation | 4 |
| K1 | The approved tag with its amendment protocol | 3 |
| K2 | The derivation contract | 1, appended by 3, 4, 7 (R17) |
| K4 | Programs and bets as sealed artifacts | 1 (the artifacts), 3 (the seal) |
| K14 | Whole-ladder red materialization | 4, demonstrated in 8 |
| K15 | The proofs board read row by row at acceptance | 4 |
| D7 | Bet-close validation as a ceremony list | 7 (the close scope) |
| D16 | The separate bet-progress suite | Nothing to delete on a clean slate. The positive obligation is the derived board, slice 4 |
| O11 | Proof plan format and seal composition | R2 and R3 |
| O16 | Test-marker syntax per stack | R9, Go only; other stacks named in 5.3 |
| O33 | One seal mechanism parameterized by kind | R3 |

### 5.2 Spec requirements that touch planning, seals, or the chain

| Requirement (source) | Owner |
|---|---|
| The CLI hash-chains journal lines (proof.md) | Slice 2 |
| `verify` checks chain continuity (proof.md) | Slice 2 |
| Seal tags are signed with a key the agents cannot read (proof.md) | Slice 3, under R4's stated limit |
| Every seal records the battery version it was granted under (loop.md, D23, D28) | Slice 3 |
| A seal is a git tag; the amendment protocol is the only way it moves (loop.md) | Slice 3 |
| Probe *intent* sealed with the plan that names it; probe *code* sealed at first green (proof.md) | Slice 3 supplies the mechanism. The moments arrive with probes, in bets 11 to 13 |
| Tests are born once, in their permanent home; membership is a marker (proof.md) | Slice 4 |
| The board is derived; expected state comes from plan position, never from edits (proof.md) | Slice 4 |
| Bets run on their own branches, so mainline CI never sees mid-bet red (proof.md) | Slice 4, stated in the contract page |
| Deliberate exceptions marked retire-at-close (proof.md) | Slice 1 field; honoured by the archive step, later bet |
| Every slice carries a proof plan, with fixture axes and real-versus-faked (proof.md) | Slice 1 |
| A data-touching slice's three extra entries (proof.md) | Slice 1 |
| A plan lists every user-visible default, string, and edge case it introduces (proof.md) | Slice 1 carries the `facing` list. Deciding an unnamed one as a recorded default is the decision discipline, bet 9 |
| Slicing is checked in both directions (loop.md) | Slice 6 |
| The retrospective checks the sealed ladder for invalidated later bets (loop.md) | Slice 6 |
| Only the next bet is designed in full; later bets get one line and a proof sketch (loop.md) | Slice 1, the program file's ladder entries |
| Planning-file field shapes, test naming, the seal ceremony, history shape (surfaces.md) | R17's page, slices 1, 3, 4, 7 |
| Plans are authored and sealed; state is derived from git; nothing self-reported (surfaces.md) | Slices 1, 3, 4 |
| A record that is missing or stale fails loudly (D39) | Slice 7 |
| The waiver counter (D24, D37) | Slice 7 |
| The lock file read from the HEAD blob (D28) | Slice 7 |

### 5.3 Gaps: requirements with no bet-3 slice and no clear owner

These four are for the ledger. D31 says design time is where they get named.

**G1 — "Universal checks run from the installed package, never the working tree. `verify` confirms the package hash against the lockfile" (proof.md).** No commitment row in changes.md carries this, so no bet owns it. It is F13's shape again: a ratified requirement the coverage count never saw, because the count counts commitments, not requirements. The nearest home is bet 15, which hands three live installs from a package to an installed binary. Recommended: file a finding, class coverage-gap, and let the driver assign it.

**G2 — "A probe diff re-opens the seal and re-runs the adversary" (proof.md).** Bet 3 builds the seal half: a changed covered path turns seal-verify red. The re-run-the-adversary half needs the adversary, which is bet 8. Recommended: a finding naming bet 8, so the seal half does not read as the whole rule.

**G3 — The archive step.** proof.md says the board freezes at archive. surfaces.md says the bet's final board and capsule index are committed as files at archive. Bet 3 can supply `board --freeze`; the capsule index needs capsules (bet 8); and no bet's lands line names an archive verb that calls either. Recommended: a finding, so the frozen view has an owner before a bet actually archives.

**G4 — Test markers on non-Go stacks.** O16 is bet 3's open question, and R9 can only answer it for Go. Other stacks answer it through the adapter seam, in the bets that ship their adapters. Recorded as a named deferral in the same shape as F28 and F30, not as a silent gap.

One more note for a later bet, not a gap: the `record` row's timestamp comparison is a small staleness check. O31 asks bet 6 for one staleness checker parameterized for docs, dated rules, and the blessed module. Bet 6 should absorb this one rather than build a second.

---

## 6. Risks the driver should know

Bet 3 reaches into three pieces of landed machinery: the journal, the battery, and the waiver system. Each has a way to regress.

1. **The envelope change amends a ratified decision.** R7 moves the journal envelope to v2, and D8 said the envelope does not change. Every reader must accept both versions: the spend query, the token cross-check, the merge, and the battery's own journal writes. This repo's ref already holds v1 lines from bets 0 to 2, so a chain row that reads them as breaks would open with a false red on the record of three bets. The unchained prefix must be named, not blamed.

2. **The merge and the chain must agree.** D15's union merge checks that every local entry survives unchanged. Two clones that both wrote chained lines merge into one ref where each session's chain is intact but the tree holds two of them. The chain row reads per session, so this works — but it is exactly the shape F10 broke on, and it deserves hostile-commit tests before it lands.

3. **Seven major bumps in one bet.** Each row-adding slice moves the version (R16). Each bump rotates the deletion test's sample, and F29 showed that rotation finding three real survivors in landed code. Expect that again, budget for it, and never answer it by weakening a row. Verify's wall clock also grows with every row; it was 241 seconds at bet 2's close (D34), and proof.md says a slow battery is what makes people bypass it.

4. **The waiver machinery is the most fragile thing bet 3 touches.** It took three review rounds and four rulings in bet 2 (F24, F26, D38, D40). R14's counter reads waiver file history; R3's seal may cover waiver files as paths. Keep both additive. Nothing in bet 3 should re-implement waiver authority.

5. **Two new rows judge the repo's own paperwork.** `record` and the waiver counter can both become false-red generators, which is the friction-waived class the ledger already names. R14 keeps them narrow: declared records only, and an unrunnable state rather than a silent zero.

6. **The board row must write nothing.** A derivation that writes is one small change away from a board a person can move by hand — the exact thing the done-when forbids. Prove it with a test that fails if any file changes during the row.

7. **The stub check overlaps the honesty scan.** Two definitions of vacuous would be the parallel-definition class. R10 forbids the second copy; the review should check that the code obeys it.

8. **The host limits bind this bet harder than the last two.** Tag pushes are refused (F1, F12) and branches cannot be deleted (F31). Seals are tags. Without R5's mirror, every seal this bet grants dies with the container. Fixture branches also cannot be cleaned up from here, so name them knowing they will outlive the bet.

9. **The lock file's read source moves (R15).** After that slice, bumping the version in the working tree and running verify before committing reads as drift. That is intended, and it will surprise the first person it happens to. The message has to say which file it read.

---

## 7. What I did not decide

Three things the driver or the owner should settle before slice 1:

1. **Whether unsigned seals stay non-blocking (R4).** I recommend yes, with the flip named. The alternative — a signing key inside the container — would defeat the control the spec asks for.

2. **The cost of two authored fixture repos (R11).** Bet 2 paid for two held-out repos, and one of them was burned by its own catch. Bet 3 needs the same again. If the driver wants to spend less, the honest reduction is one fixture with both plants in it, not a graded run against fixtures the builders saw.

3. **Whether this repo plans bet 3 in its own new format.** I recommend it: writing `docs/plan/rebuild/bet-3/*.md` for this bet proves the format is writable by the people who have to write it, and costs one slice-1 commit. It is dogfood, not proof — the held-out run is the proof.
