# Final re-check

Scope: F67, F68, F69. All closed; verdict lands. Its two smalls are F71, fixed at landing; its landing caveat is D55.


Final gate report.

---

# Final re-check — bet 3 slice 3, second fix round

**Verdict: F67, F68 and F69 all CLOSED. Slice 3 lands.**

One survivor worth a line in the ledger, and one judgement call on the amend, below. Neither gates.

Tree as found. `git status` matches the start, the journal ref is unmoved at `dc40ec8`, no seal tag, no `groundwork-seals` branch. Everything ran in copies.

---

## F67 — the wreck moved from the tag to the mirror — **CLOSED**

All three probes the driver asked for.

**The journal-refuses probe, on a grant that created the branch.** Tag gone, branch gone, restore produces nothing:

```
branch before: <absent>
groundwork seal grant: the journal did not take seal/design/demo: session "bad session!" holds ' ',
which is not a letter, a digit, a dash, an underscore or a dot,
so the tag and its mirror were put back and no seal was granted
exit=1
--- tags after:    <end>
--- branch after:  <absent: rolled back to nothing>
--- restore: ---
this repo has no groundwork-seals branch, so there is no seal to restore
--- tags after restore: <end>
```

Last round this same probe left `tags/seal/design/demo` on the branch and the next restore rebuilt the seal. Now nothing remains, and the message no longer claims something false.

**The branch already existed.** It goes back to the exact prior tip, with the earlier seal untouched:

```
branch was: 76439508438e3da144f5becee06abcd6acaac607
mirror held: index.txt tags/seal/design/first
--- branch now: 76439508438e3da144f5becee06abcd6acaac607
--- same as before? YES
--- mirror holds: index.txt tags/seal/design/first
--- tags: seal/design/first
--- restore: already there seal/design/first ... restored 0, already there 1, mismatched 0
```

**A concurrent writer moved the ref.** Both halves are protected by their old values, and the rollback says out loud that it did not finish:

```
the branch moved under us:
  rollback said: ... the rollback did not finish: groundwork-seals could not be put back:
    error: cannot lock ref 'refs/heads/groundwork-seals': is at da2af2b8...
  OK: the branch is still at the other writer's commit da2af2b8d8e4f4506722b42df706f49fa3ac080e

the tag moved under us:
  rollback said: ... seal/design/b3s3 could not be taken down again:
    error: cannot lock ref 'refs/tags/seal/design/b3s3': is at 058c7cde...
  OK: the other writer's tag 058c7cde6b8e7210e5b199f5cadef45e2f460522 is untouched

the ordinary case:
  rollback said: ... so the tag and its mirror were put back and no seal was granted
  (tag gone, branch gone, no "did not finish")
```

The design reads correctly too. `mirrorWas` is read before any write, `tagOID` right after the tag write, `mirrorNow` right after the mirror write; the rollback undoes the mirror first, then the tag, and joins both failures. If `mirror()` errors, `mirrorNow` is still empty and the branch is correctly left alone — `updateMirror`'s `update-ref` is its last statement, so a failure there means the branch never moved.

The crash window is named beside the D52.2 comment, with something a person can act on: "after a grant that died, run `groundwork seal restore` and `groundwork seal verify` and look at what stands." That is the honest treatment I asked for.

## F68 — a revoked seal verifies green — **CLOSED**

My planted-ref-lock dying-amend probe, unchanged from last round:

```
--- journal seal lines ---  1 granted   2 revoked
=== verify after the dead amend ===
  battery 8.0+rb43026c from run-20260826T120000Z-abcd: the seal line says the same
  problem: seal/design/demo stands, and the newest thing the journal says about it is revoked
1 seal, 1 path, 0 moved, 1 unsigned, 0 unverified, 1 problem
exit=1

seal-verify   red   1 problem across 1 seal, 1 unsigned, 0 unverified, the first:
                    seal/design/demo stands, and the newest thing the journal says about it is revoked
```

Zero problems last round, one now, exit 1, and the battery row red naming tag and action. The check sits before the pair compare, so a revoked line can never be answered by a matching battery pair again.

One cosmetic thing, not a gate: the battery line still reads "the seal line says the same" one line above the problem, because `batteryStanding` compares pairs and does not know about the action. The problem line directly underneath says the real situation and the row is red, so nobody is misled — but the two lines read oddly together.

## F69 — the record gap and three smalls — **CLOSED**

**The §2.4 table.** Five fields, "five more fields", and the `reason` row corrected to match `journal.go`'s comment.

**The pin reads structure, and it is the right way round.** I gut-tested it three ways:

```
gut ONE table cell (blank the `signer` first cell)
  FAIL: section 2.4's table has no row for signer

move signature/signer out of the table into prose
  (the word "signature" still appears 8 times on the page)
  FAIL: section 2.4's table has no row for signature
  FAIL: section 2.4's table has no row for signer

strip every backtick from the page
  18 failures
```

Survives a prose mention, dies on a gutted cell. That is exactly D54.1's model, and it is stronger than what I asked for.

**The staged-file gap.** My `N13b` mutation — `git show HEAD:...` → `git show :...`, reading the index instead of HEAD — now dies (`P01 KILLED`). The test stages its planted file and the comment names why.

**`checkMirrorIsClean` in `AmendSeal`.** The amend now stops before anything moves:

```
=== amend onto a poisoned mirror (was: went through) ===
groundwork seal amend: groundwork-seals holds tags/evil, which is not a mirrored seal tag: the tag "evil" does not open with "seal/"
exit=1
--- tag unmoved? YES
--- journal seal lines: 1  (only the original grant, no revoked line)
```

**The signerFrom sentence** — partly. The F60/F62 paragraph was split into three, which reads better. The specific sentence I named is unchanged: "A good signature by a key that matches no principal names nobody, and that is reported as nobody rather than guessed at." Still needs a second reading. Cosmetic; note it for whenever that file is next open.

---

## My own sweep of the round-2 rules

Ten mutations ran and could have failed: **8 killed, 1 genuine survivor, 1 can-never-fail.**

Killed: `openSigners` reading HEAD, the non-granted-action problem, the mirror half of the rollback, the branch-absent delete, the branch reset's old value, `mirrorNow`'s read, the amend's clean-check, and the table-row pin itself.

**Survivor (LOW-MED, does not gate).** Dropping the old value from the *tag* delete — `update-ref -d refs/tags/<tag>` with no oid — kills nothing. The branch half of that same guarantee is tested (`P05` dies), the tag half is not. F67 names both holes by hand: "undoTag deletes with no old value, so a concurrent writer's tag can be clobbered". The code is right; the proof covers one of the two refs. My probe above kills it, and the repo has no equivalent. One test, or one extra assertion on the existing concurrent-writer test.

**Can-never-fail, not a gap.** Moving the `mirrorWas` read to after the tag write survives, and should: `git tag -a` does not touch the mirror branch, so the two orderings give the same value in any single-threaded run. The ordering is defensive, correctly kept, and no test can distinguish it. Recording it as can-never-fail rather than as a survivor, per F55.

That accounts for the builder's "8 new blanking rules, 8 killed" — their eight were killed, and the tag-old-value rule was not among them.

---

## Mechanics, and the ledger gate

- **`go test ./...` green at 5fb0782 with the fix-round tree**, every package including `internal/findings`. `gofmt -l` clean, `go vet ./...` clean.
- **The ledger gate is cleared.** `groundwork findings check`: 70 findings, all attributed and classified, exit 0. `groundwork findings recur`: `front-door-hollow 3` and `parallel-definition 3`, both answered — "every class at or over 3 findings has a decision named from it", exit 0. `TestRecurPassesOnTheRealLedger` and `TestRealLedgerHoldsTheAnsweredClasses` both pass.
- **Full verify on a copy:** `10 rows: green 10, red 0, waived 0, quarantined 0, unrunnable 0` at `8.0+rb43026c`, digest unmoved ("the rows compute the same digest"), **783 tests** in 9 suites — matching the claim. The run's own 11 journal lines chain, seq 1..11.
- **Proof markers:** 12 across the repo, three for b3s3, each once, no orphans.

D53 and D54 both read as real rules rather than three fixes dressed up, and each names the model to copy from this slice. D53.2 in particular — "the assertion is that NOTHING remains, not that an error was printed" — is the rule that would have caught F67 at build time.

---

## The two judgement calls

**The amend's missing rollback: it stands for this landing.** It is now much narrower than when I raised it. `checkMirrorIsClean` runs first, so the poisoned-mirror path no longer reaches a partial write at all. The remaining window is a failure *between* the revoked line and the tag write — which I can only reach by planting a ref lock by hand — and F68's fix means the result is now **loudly red** rather than silently green. So the failure is visible, which was the actual complaint. Scheduling the rollback as its own change is the right call, and D53.2 already binds whoever picks it up.

**F70 stands as recorded, with one caveat for the landing.** A battery that goes green over a red suite means `groundwork verify` is not a sufficient landing gate on its own. For this landing that is covered — I ran `go test ./...` separately and it is green. Worth carrying that pairing explicitly in the landing checklist until F70's row exists, rather than leaving it to whoever lands the next slice to remember.

**Nothing here gates. Slice 3 lands.**