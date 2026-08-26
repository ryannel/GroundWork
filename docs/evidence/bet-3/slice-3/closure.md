# Closure re-check

After the first fix round. Twelve of fourteen closed; reopened on the mirror-only wreck (F67), the revoked seal verifying green (F68), and the contract drift the fix itself opened (F69).


Closure re-check done. Report follows.

---

# Closure re-check — bet 3 slice 3, fix round

**Verdict: one REOPENED, one NEW must-fix, two NEW smalls. Everything else CLOSED.**

The fix round is strong work. Twelve of my fourteen findings are closed with probes I could not get past, and three of the fixes are better than what I asked for. But the atomic grant has a hole, and it is the same hole F59 named — it just moved from the tag to the mirror.

Tree as found. `git status` at the end matches the start byte for byte. No seal tag, no `groundwork-seals` branch, and nothing this review wrote reached `refs/groundwork/journal` — its newest line is still from session `rework` on 2026-08-23.

---

## The driver's question: is there a hole in the atomic grant?

Yes. Not between the check and the write — between the mirror write and the journal write.

`GrantSeal` writes three things: tag, mirror, journal. `undoTag` takes down **one** of them. When the journal write fails after the mirror succeeded, the tag is rolled back and the mirror blob stays.

```
=== grant with a journal that will refuse the write (bad session id) ===
groundwork seal grant: the journal did not take seal/design/demo: session "bad session!" holds ' ',
which is not a letter, a digit, a dash, an underscore or a dot,
so the tag was taken down and no seal was granted
exit=1
--- tags after ---
(none: the tag was rolled back)
--- mirror branch after ---
3d095c529e1d70f1d3542a452bfa6d737c667723
index.txt
tags/seal/design/demo
=== now restore ===
restored seal/design/demo at 585ad55a749a22ef5a9f1fe633572f34c5a248a0
1 tag: restored 1, already there 0, mismatched 0
=== and verify ===
seal/design/demo at badce66e7c85540512430232e8893305f199eef5
  signature unsigned: this tag carries no signature, so it is no one's authority
  docs/one.md holds at 5626abf0f72e58d7a153368ba57db4c673c0e171
  battery 8.0+rb43026c from run-20260826T120000Z-abcd: no seal line in this journal names this tag, so the battery pair was not cross-checked
1 seal, 1 path, 0 moved, 1 unsigned, 0 unverified, 0 problems
exit=0
```

The grant says "no seal was granted". That is now false. The next `seal restore` — in this clone or any other — produces the seal, and `seal verify` calls it sound with 0 problems and exit 0. F59's wreck is not gone; it travels on the branch instead of standing locally.

D52.2 says "tag, mirror, journal, or none of them". The reachable state is mirror-only, which the ruling forbids.

**Fix:** capture the mirror tip before `mirror()`, and on a journal failure reset the branch back to it — with the old value passed to `update-ref` so a concurrent writer is not clobbered. `undoTag` should undo both writes or neither.

**Two more holes worth naming, both smaller:**

The pre-flight `checkMirrorIsClean` is a good guard and it is TOCTOU-safe by luck rather than design: if the mirror is poisoned between the check and the write, `mirror()` fails and `undoTag` fires. That path works. But `undoTag` deletes the tag with a bare `update-ref -d`, with no old value. A concurrent writer that moved the tag in that window has it deleted by this rollback. One argument to `update-ref -d` closes it.

And the crash window is unclosed and unnamed: a process killed between `writeTag` and `mirror` leaves a tag with no mirror and no journal line, and nothing rolls back. Git has no cross-ref transaction, so this cannot be fixed here — but it is the same wreck, and no comment names it. Worth one sentence beside D52.2.

---

## Per finding

| | Verdict |
|---|---|
| **H1** mirror junk turns off restore | **CLOSED**, but see the reopened half below |
| **H2** unverified printed as unsigned | **CLOSED** |
| **H3** widest-line test measures the wrong branch | **CLOSED** — and verified independently |
| **H4** F57 wrong about signing | **CLOSED** (F62) |
| **H5** the unverified note is vague | **CLOSED** |
| **H6** `signerFrom` misses git's SSH wording | **CLOSED** — probed live |
| **H7** restore rebuilds under a lying name | **CLOSED**, deeper limit recorded |
| **H8** dead `missing()` guard | **CLOSED** |
| **H9** two mutation survivors | **CLOSED** |
| **H10** one path rule stated three ways | **CLOSED** |
| **H11** who-signed printed, not recorded | **CLOSED** |
| **H12** signers file read from the worktree | **CLOSED** in behaviour, thin in proof (see NEW-3) |
| **H13** seven smalls | six CLOSED, **one REOPENED** |
| **H14** no red commit | noted, driver's call |

### H1 — CLOSED

```
=== grant onto a poisoned mirror ===
groundwork seal grant: groundwork-seals holds tags/evil, which is not a mirrored seal tag: the tag "evil" does not open with "seal/"
exit=1
--- tags after the refused grant ---
seal/design/good              (only the earlier one; nothing new was made)
=== restore with junk on the branch ===
ignored tags/evil: the tag "evil" does not open with "seal/"
restored seal/design/good at 4ccd08f4bee4041d22e98b7c7da1bed1a2d49902
1 tag: restored 1, already there 0, mismatched 0
exit=0
```

Refuses before making anything; restores the good tag and names the junk. Exactly what D52.1 and D52.2 asked for.

### H2 — CLOSED

```
1 seal, 1 path, 0 moved, 0 unsigned, 1 unverified, 0 problems
```

A forged block now reads `unverified` on the per-seal line, in the summary, and in the row's head. `Report.NoAuthority()` is a method, so no field holds the blur.

### H3 — CLOSED, and better than asked

I re-searched the count space independently, including `math.MaxInt64` in all four fields:

```
widest head = 136 bytes  (the comment claims at most 136 — exact)
widest line = 200 bytes  (cap 200)
green widest = 152 bytes: "9223372036854775807 seals over 9223372036854775807 paths,
   9223372036854775807 unsigned, 9223372036854775807 unverified: every hash still matches at HEAD"
```

The guarantee is now structural, not best-effort: the head is bounded at 136 by arithmetic, both counts live in it, and the problem gets `200 - len(head)`. No line can drop a count. The shipped search finds 200 too and asserts both counts on every line it builds. F61's class is properly closed.

### H5 / H6 — CLOSED, probed live

Four branches, four distinct notes, and the signer parses on the SSH shape. Run against a shim that answers the way `ssh-keygen` does:

```
(1) host:            sig="unverified" signer=""  note="no verifier ran on this machine, so nothing here could check it"
(2) shimmed good:    sig="verified"   signer="owner@example.com"
                     note="a good signature by owner@example.com, listed in .groundwork/allowed-signers"
    verifySignature -> said="Good \"git\" signature for owner@example.com with ED25519 key SHA256:AAAA\n"
(3) unlisted key:    note=".groundwork/allowed-signers lists no key that matches the one that signed it"
(4) bad signature:   note="the signature does not check out"
(5) other:           note="git could not verify it, and said: the moon is in the wrong phase"
```

The diagnosis behind the fix is right: git sends that wording to stderr under `--raw`, which is why my first probe saw nothing. `gitBoth` reading both streams is the correct fix, and `signerFrom` now returns a real principal.

### H7 — CLOSED, and the deeper limit recorded

```
-> tags=[{Tag:seal/design/b3s3 OID: Status:mismatched
   Why:these bytes name the tag seal/acceptance/other, and the mirror files them under seal/design/b3s3}]
refs/tags/seal/design/b3s3 -> <none>
```

No ref written. And D52.6's paragraph on the contract page states the limit I flagged plainly — that anyone who can push can invent a whole seal, that verify will call it sound, and that only R4's deferred signature can bind a seal to its author. "Until then the mirror is watched, not trusted." That is the honest record I asked for.

### H8 — CLOSED

A mirror with tags and no index restores byte for byte: `back at f9affbdb... (was f9affbdb...) same=true`. The presence check now asks the tree instead of an exit code.

### H9 — CLOSED

My `M08` mutant is killed (`N02 KILLED`). The R4 headline proof now walks three not-verified branches with **real** `git tag -s` signatures and pins which branch ran through the note text, so it cannot drift onto a branch this repo never takes. Both can-never-fail shapes are gone: the dead condition after the covers loop is removed with a comment explaining why one guard is enough, and the `--cleanup=verbatim` comment now says what git actually does (strips trailing whitespace, drops blank lines, removes hash lines — "it does not reflow"), which I confirmed by diffing the two tag messages.

### H10 — CLOSED

```
groundwork seal grant: the covered path "_leading.md" must open with a letter, a digit or a dot,
then hold only letters, digits, dots, dashes, underscores and slashes
```

Code tightened to the page, message readable in one pass. The page gained the `Battery-Run` shape (`run-<8 digits>T<6 digits>Z-<4 hex>`) with an example, and the name-versus-message red.

### H11 — CLOSED

```
1 granted signature='unsigned' signer=None reason=None
2 revoked signature='unsigned' signer=None reason='swap'
3 granted signature='unsigned' signer=None reason='swap'
```

R6's who-signed is on the record now, `omitempty`, on all three lines.

### H12 — CLOSED in behaviour

Swapping `.groundwork/allowed-signers` on disk changes nothing: the note stays `no verifier ran on this machine`. `openSigners` reads HEAD and lays the committed bytes in a temp file. See NEW-3 for the proof gap.

### H13 — six CLOSED, one REOPENED

Closed: zero-green run refused (`the newest battery run ... checked nothing, and a seal stands on a run that checked something`); non-seal name refused by the verb (`the tag "v1.0" does not open with "seal/"`, exit 2); `short()` printable; amend prints the differing paths (`no longer covers: docs/one.md` / `now covers: docs/two.md`, clipped at five); the stale journal comment fixed.

**REOPENED — a revoked seal still verifies green.** D52.9 changed the cross-check to read the newest line of either action. That stops the out-answering, but the check only compares battery pairs, and a revoked line carries the same pair. So the state D52.9 set out to make visible is still invisible.

Reproduced by planting a ref lock so the amend dies at the tag write:

```
groundwork seal amend: git tag -a --cleanup=verbatim -F - -f seal/design/demo: exit status 128:
  fatal: cannot lock ref 'refs/tags/seal/design/demo' ...
exit=1
--- tag now --- 8b80fc50...  (was 8b80fc50... — unmoved)
--- journal seal lines ---
1 granted ''
2 revoked 'swap the file'
=== verify after the dead amend ===
  battery 8.0+rb43026c from run-20260826T120000Z-abcd: the seal line says the same
1 seal, 1 path, 0 moved, 1 unsigned, 0 unverified, 0 problems
exit=0
```

The record says the seal is revoked. The tool says it is fine, with 0 problems. `newestLine` finds the revoked line and never looks at its action. One line in `checkBattery` — a newest line whose action is not `granted` is a problem — closes it.

---

## New in the fix diff

### NEW-1 (HIGH) — the mirror is not rolled back
Covered above. This is the driver's question, answered.

### NEW-2 (MED) — the contract page never names the two fields the fix added
`internal/journal/seals.go` now reads `signature` and `signer`:

```
81:  Signature  string `json:"signature"`
82:  Signer     string `json:"signer"`
```

Section 2.4 of the contract page still opens "and **three** more fields this section adds" and its table lists only `battery`, `battery_run`, `reason`. Neither new field appears anywhere on the page — `grep '`signature`\|`signer`'` returns nothing. The contract pin's `want` list was not extended either, so nothing catches the drift.

This is F64's own class, reintroduced by the fix for F65: a field the reader reads that the page never names. Two lines in the table, two entries in the pin's want list.

While that table is open: it still says `reason` is "left off a grant", but the amend's *granted* line carries one. `journal.go`'s comment was corrected for exactly this ("Both lines an amendment writes carry it, revoked and granted alike"). The page was not.

### NEW-3 (LOW-MED) — the HEAD-not-worktree proof cannot see the index
`openSigners` correctly reads `HEAD:.groundwork/allowed-signers`. Changing that one string to `:.groundwork/allowed-signers` — the index — survives the whole suite (`N13b SURVIVED`). Both D52.8 tests only distinguish HEAD from the working tree; neither ever stages a file.

```
git show HEAD:...  -> fatal: path '.groundwork/allowed-signers' exists on disk, but not in 'HEAD'
git show :...      -> # staged only
```

A staged file is no more committed than a swapped one, so this is inside what D52.8 rules. The behaviour is right; the proof has a near neighbour it cannot tell apart. One `git add` in one of the two tests fixes it.

### NEW-4 (LOW) — the writer-strict rule is applied to one of the two writing verbs
`checkMirrorIsClean` runs in `GrantSeal` and not in `AmendSeal`. Its comment says "New work is different: granting onto a branch somebody has scribbled on stops until a person has looked at it." An amendment is new work and does not stop:

```
=== amend onto a poisoned mirror ===
seal/design/demo
  before: 1 path at 16f9d45c...
  after:  1 path at 16f9d45c...
  no longer covers: docs/one.md
  now covers: docs/two.md
  reason: swap the file
  recorded by an agent: the amended tag is unsigned, so this is not the owner's own word
exit=0
--- prior target filed? ---
prior/seal/design/demo/98ed4e3b...   tags/evil   tags/seal/design/demo
```

No harm done here — the amend completes correctly and the junk is simply carried along. But either the amend should take the same guard, or the comment should say the rule is the grant's alone. Related: `AmendSeal` has no rollback at all, which is what the reopened H13 small is about.

### NEW-5 (LOW) — register nit
One sentence in `signerFrom`'s doc needs a second reading: "A good signature by a key that matches no principal names nobody, and that is reported as nobody rather than guessed at." The rest of the new prose is a clear improvement — `checkMirrorIsClean`'s "The reader is permissive and the writer is strict, on purpose" and the contract's "the mirror is watched, not trusted" are both good.

---

## Mechanics

- **Full verify on a copy:** `10 rows: green 10, red 0, waived 0, quarantined 0, unrunnable 0` at `8.0+rb43026c`. The version row confirms the digest is unmoved: "declares 8.0+rb43026c, and the rows compute the same digest". 778 tests in 9 suites, matching the builder's claim.
- **`go test ./...`** green in every package. **`gofmt -l`** clean. **`go vet ./...`** clean.
- **My own sweep of the fix round's rules:** 30 mutations ran and could have failed. **28 killed, 1 genuine survivor (N13b, above), 1 can-never-fail.** The can-never-fail is `nameInTag` reading the whole object instead of the header block — I confirmed git refuses a tag object with no `tag` header (`error: object fails fsck: missingTagEntry`), and when both a header and a body line start with `tag ` the header comes first, so the narrowing cannot change any answer. Correct to keep, not a proof gap.

  Killed among them: both `undoTag` calls, `checkMirrorIsClean`, the skip-and-report, the name-in-tag comparison, the index-versus-bytes check, all three `whyNotVerified` branches, `signerFrom`'s SSH branch, `gitBoth`'s stderr, the counts-in-the-head, the problem's budget, the charset tightening, the tree-based index check, the journal's signature and signer fields, the signer-needs-a-state guard, `short()`'s printable, the verb's name check, the amend's differing-paths lines, and the restore's ignored-files lines.

---

## What must happen before this lands

1. **NEW-1** — roll the mirror back too, or the grant is not atomic and D52.2 is not met. This is the one that gates.
2. **H13 reopened** — a seal whose newest journal line is `revoked` must be a problem, not green.
3. **NEW-2** — put `signature` and `signer` in the contract page's 2.4 table and in the pin's want list, fix "three more fields", and correct the `reason` row.

Cheap and worth doing in the same pass: `update-ref -d` with an old value in `undoTag`; one `git add` in a D52.8 test; a sentence naming the crash window; and either the amend's clean-check or a corrected comment.