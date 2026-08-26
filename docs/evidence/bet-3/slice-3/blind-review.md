# Blind review of slice 3

The first review. Verdict: lands after fixes — two highs led by the mirror denial of service and the signature-state blur. Its findings are F59 through F66, and it corrected F57 on the record (F62).


Working repo untouched. Here is the review.

---

# Blind review — bet 3 slice 3 (seals, and the battery's tenth row)

**Verdict: lands after fixes.**

The mechanism is sound. The charset defence holds against everything I threw at it, the four-kind closure and the parse strictness are real, the grant gate reads the record correctly, and the byte-for-byte restore does what R5 asks. Two defects should be fixed before this lands. Several record errors should be written down, including one recorded finding that is factually wrong.

`git status` at the end matches the start. No tag, journal write, or branch was made in the working repo. Everything below ran in copies.

---

## What held up

- **Mechanics.** `go test ./...` green in every package. `gofmt -l` clean. `go vet ./...` clean.
- **The full run.** On a copy: `10 rows: green 10, red 0, waived 0, quarantined 0, unrunnable 0` at `8.0+rb43026c`. The run wrote 11 journal lines under one session, seq 1..11, each `prev` present from seq 2 on. The chain row read them green.
- **The digest.** I set the lock digest to `r0000000` on a copy and read the drift error: "the rows compute rb43026c". That matches the declared `8.0+rb43026c`.
- **The red set.** I re-derived it at `237e45a`. Four assertion failures: the battery row-list pin, and the three cmd row-count pins. The eight new test files do not compile there (`undefined: Amended`), which is a build failure, not a red test. The two survivor pins are correctly out of the red set — `internal/battery/battery.go:108` already held `seal-verify` at `237e45a` (D28 forward-naming), and `internal/journal/kinds.go:19` already held `seal`. The new adapter pin passes at the baseline, as a survivor pin should.
- **Row-count arithmetic.** 10 rows. The hostile-repo split is `green 3, red 2, unrunnable 5`, which sums to 10, and the comment names the third green correctly.
- **Proof markers.** All three exist, once each. No orphan `TestProof_` anywhere.
- **The contract gut check.** I stripped every backtick from `docs/derivation-contract.md` and re-ran the pin. It failed with 16 errors. The pin is sensitive to the page, not just to the words.
- **The dogfood.** `b3s3.md` names `docs/derivation-contract.md` in `records:`, and the page grew section 2 in this slice.
- **Pathspec injection.** I could not get anything past the charset. `:!foo`, `:(glob)docs/*.md`, `:/docs`, `-rf`, `--output=x`, `docs/*.md`, `docs/?ne.md`, `docs/[a-z].md`, `/etc/passwd`, `docs\one.md`, `dòcs/one.md`, a newline, a NUL, and a 301-byte path are all refused. `../etc/passwd`, `docs/../../etc/passwd`, `docs//one.md` and `docs/` are refused by the segment check. `blobsAt` also passes `--` and drops non-blob entries, so a covered path that names a directory reads as gone rather than held.
- **Hostile tag content.** A tag whose covered line carries `\x1b[31m` is refused by the parse, and the escape is a space by the time it reaches the problem string. The row's evidence, the CLI's lines and the seal package's errors all go through `printable` then a clip.
- **Forged signatures cannot reach verified on this host.** I planted a signature block and asked for verification with and without a signers file. Both come back `unverified`. Git's own verify path fails here, so the failure direction is the safe one.
- **The grant gate.** No battery line → refused by name. An old green followed by a newer red → refused, naming the newer run. An old red followed by a newer green → allowed. A path not at HEAD → refused. A path outside the repo → refused.
- **Amend.** Refuses without a reason at both the flag layer and in `AmendSeal`. Prints before and after. Files the prior tag at `prior/seal/design/b3s3/<old oid>` in the mirror. Writes `revoked` then `granted`, both carrying the reason. The note reads "recorded by an agent: the amended tag is unsigned, so this is not the owner's own word", and the word "approved" appears nowhere. It cannot reach a non-seal ref: every subject outside `[a-z0-9_]+` is refused before any ref is touched.
- **Restore.** Non-tag bytes, a hostile index, and a tag already standing at a different object are all handled. `checkTagName` refuses `heads/main`, `seal/review/x`, `seal/design/B3S3` and `seal/design/b3s3/extra`. Git itself refuses to store a mirror path with a `..` segment, so the traversal case cannot even be planted.
- **Mirror commits are unsigned** and carry the tool's own identity, despite this host's global `commit.gpgsign=true`.

---

## Findings

### H1 — One junk file on the mirror branch turns off restore and half-breaks grant (HIGH)

`mirrorTags` returns an error for the whole tree when any single file under `tags/` is not a seal tag name. That function backs both `Restore` and `updateMirror`. So one scribbled file stops every other tag from being restored, and stops every future grant from mirroring.

Reproduced through the built binary. I put a two-byte blob at `tags/evil` on `groundwork-seals`, then:

```
=== grant onto a poisoned mirror ===
groundwork seal grant: seal/design/demo stands, and the mirror did not take it: the mirror holds "tags/evil": the tag "evil" does not open with "seal/"
exit=1
=== the tag it left behind ===
seal/design/demo
=== seal verify on the half-made seal ===
seal/design/demo at 5fc04217fe49734756a0615b72f66e358c895242
  signature unsigned: this tag carries no signature, so it is no one's authority
  docs/one.md holds at 5626abf0f72e58d7a153368ba57db4c673c0e171
  battery 8.0+rb43026c from run-20260826T120000Z-abcd: no seal line in this journal names this tag, so the battery pair was not cross-checked
1 seal, 1 path, 0 moved, 1 unsigned, 0 problems
exit=0
=== restore ===
groundwork seal restore: the mirror holds "tags/evil": the tag "evil" does not open with "seal/"
exit=1
```

Three things are wrong here, in one chain.

First, `groundwork-seals` is the one branch R5 makes pushable on purpose. Anyone who can push can write that file. R5's whole point is that a seal on one machine proves nothing; with the mirror broken, no seal travels at all.

Second, D51.6 says "a mirrored file whose name is not a seal tag's is refused". Refusing that file is right. Refusing every other tag alongside it is not what D51.6 says, and `mirrorIndex` right below it takes the opposite policy for the same class of problem, with a comment explaining why: "a restore that stopped because a listing was scribbled on would be a way to stop one."

Third, the half-made seal that grant leaves behind **verifies green**. `GrantSeal`'s comment says "A seal half recorded is a thing somebody has to see." Nothing in the row or the verb shows it. The only signal is the transient error from the failed grant.

Fix: skip the bad file and report it, the way `mirrorIndex` already does. Keep `restoreOne` refusing to write a ref for a name that is not a seal tag's.

### H2 — An unverified seal is counted and printed as unsigned (HIGH)

`Verify` increments `rep.Unsigned` for any seal that is not `Verified`. Both the CLI summary and the row's clause then call that number "unsigned".

Reproduced end to end on a tag carrying a forged signature block:

```
seal/design/demo at c2a471a2cbf578edaf2cd3df5233f8d312d9da36
  signature unverified: the signature did not verify against .groundwork/allowed-signers
  ...
1 seal, 1 path, 0 moved, 1 unsigned, 0 problems
```

Two lines of one output disagree about one seal. D51.1 is explicit: "a forged signature block must never read exactly like no signature at all." The summary line makes it read exactly like no signature at all. The battery row does the same — `sealTotals.unsigned` is fed from `rep.Unsigned`, and its clause reads "N seals are unsigned, which is no one's authority".

Fix: count the two apart, and say both. The field name `Report.Unsigned` is itself the trap — it means "not authority".

### H3 — The unsigned clause falls off the red line exactly when the counts get large (MED, and it re-runs F54)

`addIfItFits` drops the clause when the whole line would pass 200 bytes. The row's own comment says "Unsigned is on every line this row prints". That is false above a certain size.

```
100 seals -> len=199 carriesUnsigned=true
500 seals -> len=199 carriesUnsigned=true
1000 seals -> len=144 carriesUnsigned=false
2000 seals -> len=144 carriesUnsigned=false
```

Worse, the test meant to guard the widest line measures the wrong branch — the same defect F54 records one slice ago. `TestTheSealRowLineFitsAtItsWidest` feeds `1<<62` into every count and a 400-byte problem. That produces a **174-byte** line, because those counts are what make the clause get dropped. The genuinely widest line the red branch can print is **200 bytes**, at `seals=100, problems=1, unsigned=1048576`:

```
widest red line = 200 bytes at {seals:100 unsigned:1048576 problems:1 first:<200 p's>}
   "1 problem across 100 seals, the first: ppp...ppp..., and 1048576 seals are unsigned, which is no one's authority"
```

The cap itself is safe — the head alone maxes at 174, so `addIfItFits` cannot overflow. But the test's stated claim ("the red line at its widest") is wrong, the real slack is zero not 26 bytes, and the loud clause R4 asks for is silently conditional.

Fix: shorten the clause so it always fits, or measure the true widest in the test. Either way the row's comment has to stop claiming the clause is on every line unless it is.

### H4 — F57 is factually wrong about this container (MED, record)

F57 says: "the container has no ssh-keygen, and git's SSH signature path needs it on both ends. No SSH-signed tag can be created here and none can be verified here."

The second half is true. The first half is not. This host's global git config has `gpg.format=ssh` and `gpg.ssh.program=/tmp/code-sign`, a shim that supports `-Y sign`. I made a real SSH-signed tag in a scratch repo:

```
$ git tag -s -m "signed" v1 ; echo exit=$?
exit=0
$ git cat-file tag v1 | tail -7
signed
-----BEGIN SSH SIGNATURE-----
U1NIU0lHAAAAAQAAADMAAAALc3NoLWVkMjU1MTkAAAAgrLzsfFISF4by8Q+FKz27YpkK1USsBB+m
...
-----END SSH SIGNATURE-----
```

Signatures can be created here. They cannot be verified here, because the shim only implements `-Y sign`:

```
Error: unsupported code-sign operation: currently only SSH-style signing (-Y sign) is supported
```

The finding's conclusion survives — the Verified branch still has no test this repo can run, and the failure direction is still safe. But the stated fact is wrong, and F57 is the record a future reader will trust. It should say what is actually true: signing works through the host shim, verification does not, and the key the shim holds is not readable as a public key (`/home/claude/.ssh/commit_signing_key.pub` is zero bytes), so no allowed-signers entry can be built for it either.

### H5 — The unverified note collapses three different situations into one (MED)

`checkSignature`'s own doc says: "Every path out of here that is not Verified says so in its own words, because 'not verified' covers three different situations and a reader has to know which one they are in." There are only two Unverified notes, and the one this repo will actually hit is the vague one.

With no signers file (a scratch repo):
```
signature unverified: the signature did not verify: this repo ships no .groundwork/allowed-signers, so nothing here can check it
```

With the file this slice commits:
```
signature unverified: the signature did not verify against .groundwork/allowed-signers
```

The second reads as "we checked it and it is bad". On this host the truth is "nothing here could check it at all". Since the slice commits `.groundwork/allowed-signers`, the second branch is the one every run of this repo takes. That is the branch F57 claims "reports unverified in its own words".

Fix: `verifySignature` should say why git failed — no verifier, a key nobody listed, or a bad signature — rather than one sentence for all three.

### H6 — `signerFrom` parses GPG status output, and git's SSH path does not produce it (MED, host-untestable)

`signerFrom` looks for `[GNUPG:] GOODSIG`. Git emits that for GPG. For SSH it prints ssh-keygen's own text instead. I proved the shape by shimming a verifier that says the signature is good:

```
(c) shimmed verifier: sig="verified" signer="" note="a good signature by a key .groundwork/allowed-signers lists" authority=true
(c) git verify-tag: out="" err=<nil>
(c) signerFrom(out)=""
```

`Verified` is reachable when git exits zero, which is right. But `Signer` comes back empty, so `amendmentNote` falls through to "signed by a key the allowed-signers file lists". R6 asks the record to "state who signed the amended tag". On the SSH path it never will.

This is only visible on a machine with a real verifier, which is the owner's. Worth recording beside F57 so it is not discovered there.

### H7 — Restore rebuilds a tag under a name its own bytes do not declare (MED)

`restoreOne` points `refs/tags/<file name>` at the object, and nothing checks that the tag object's own `tag ` header matches. I filed the bytes of `seal/acceptance/other` under `tags/seal/design/b3s3`, with a matching index line:

```
-> err=<nil> res=[{Tag:seal/design/b3s3 OID:9a2af... Status:restored Why:}]
refs/tags/seal/design/b3s3 -> 9a2af...
its own bytes declare: "...tag seal/acceptance/other\ntagger ..."
verify after: seals=1 problems=1 first="the tag seal/design/b3s3 carries the name seal/acceptance/other in its message, and the two must be one name"
```

Verify catches it, so the damage is contained. But restore reports "restored" for a lie, and the index cross-check is no help because whoever wrote the file also wrote the index.

The deeper case is worth recording rather than fixing: a well-formed seal invented on the mirror branch restores cleanly and then **verifies green**, because "no seal line in this journal names this tag" is a note, not a problem. That is the mirror becoming the record, which is what D51.6 exists to prevent. R4's missing signature is the only real control, and that is already deferred — but nothing in R5, D51.6 or the contract page says so.

Fix the cheap half: compare the raw bytes' `tag ` header to the file name before restoring.

### H8 — `missing()` is wrong for `cat-file`, so the no-index branch is dead (MED)

`missing(err)` tests for exit code 1. `git cat-file` exits **128** for a missing path:

```
cat-file on a missing path: missing(err)=false err=... exit status 128: fatal: path 'nope.txt' does not exist in 'HEAD'
rev-parse on a missing ref: missing(err)=true err=... exit status 1:
```

So `mirrorIndex`'s guard — "A repo with no index... returns empty map" — can never fire. A mirror branch holding tag files but no `index.txt` fails the whole restore with a raw git error:

```
mirror with no index.txt -> err=git cat-file blob 54dab7f...:index.txt: exit status 128: fatal: path 'index.txt' does not exist in '54dab7f...'
```

A tool-written mirror always has an index, so this is unreachable through the writing path — which is why no test caught it. It is F55's "can-never-fail" class: a guard that reads as protection and is not.

### H9 — Two genuine mutation survivors, against a claim of 48 killed and 0 survived (MED)

I blanked 37 load-bearing rules, one at a time, building and running the affected packages serially. Four of my patches did not compile; three I rewrote and re-ran. Of the 33 mutations that ran and could have failed: **31 killed, 2 survived, 2 can-never-fail.**

| Mutation | Result |
|---|---|
| M01 `seal: ` prefix, M02 trailer name, M03 trailer shape, M04 four-kind closure, M05 covered-path charset, M06 dot-dot segment, M07 restore never overwrites, M09b grant needs a battery line, M10 grant refuses a red run, M11 mirror name check, M12 name vs message, M13 trailer vs journal, M14 unsigned is never authority, M15 covers sorted, M16 no duplicate, M17 amend needs a reason, M18b seal `printable`, M19 row `printable`, M20 `Authority()`, M21 row red on a problem, M22b grant refuses a standing tag, M24 a tree is not a blob, M25 unsigned clause, M27 journal battery pair, M28 lightweight tag refused, M30 subject charset, M31 blob-hash shape, M32 covers list non-empty, M33 nothing after the trailers | killed |
| **M08 mirror index vs bytes** | **survived** |
| **M29 the no-signers-file branch** | **survived** |
| M23 `--cleanup=verbatim` | can-never-fail |
| M34 the blank line after the covers list | can-never-fail |
| M26 a missing seal is red | did-not-build (my patch; covered by two shipped tests) |

**M08.** Blanking `if claimed != "" && claimed != written` in `restoreOne` kills nothing. The rule is reachable — my probe hits it:

```
-> res=[{Tag:seal/design/b3s3 Status:mismatched Why:the mirror's index names dddd... and its bytes hash to 794938...}]
```

D51.6's index half has no shipped test.

**M29.** Blanking the `!hasSigners` branch kills nothing. That matters more than it looks. `newRepo` ships no allowed-signers file, so `TestProof_b3s3_unsigned_never_reads_as_human_authority` — the R4 headline proof — walks the *no-signers* branch, not the "git said no" branch. Both notes contain "did not verify", which is all the test asserts, so it cannot tell them apart. The proof marker for R4 does not exercise the path this repo takes, and nothing pins which path it took.

**M23** is can-never-fail, not a survivor. I checked the bytes directly: `git tag -a --cleanup=verbatim -F -` and `git tag -a -F -` produce identical messages for the shape `Render` fixes. The flag is right to keep, but its comment ("Without it git strips and reflows, and the tag would then hold something other than what the contract says a seal message is") describes something no input can produce.

**M34** is can-never-fail too. The loop above exits only when `at >= len(lines)` or `lines[at] == ""`, so `lines[at] != ""` in the following check is dead. A reader cannot tell.

### H10 — The contract page, the error message, and the code state three different path rules (MED)

The charset is `^[A-Za-z0-9._][A-Za-z0-9._/-]*$`, so a covered path may open with an underscore.

The contract page says: "starting with a letter, a digit or a dot."
The error message says: "letters, digits, dots, dashes, underscores and slashes, opening with none of the last three."

Both exclude the underscore. The code allows it. Through the built binary:

```
$ groundwork seal grant --kind design --subject demo --path _leading.md --path docs/two.md
granted seal/design/demo at 632b30f8...
  covers 2 paths, under battery 8.0+rb43026c from run-20260826T120000Z-abcd
```

This is the slice-1 rule — the page and the parser have to agree in both directions — and `TestTheContractWritesTheSealTagShape` cannot catch it, because it only checks which words appear on the page.

Two smaller gaps in the same place. The page never gives the `Battery-Run:` shape, though the parser refuses anything that is not `run-YYYYMMDDTHHMMSSZ-xxxx`. And section 2.5 lists three ways the row goes red but omits the name-versus-message check, which `checkOne` also makes red.

The error message is also hard to read on its own terms. "Opening with none of the last three" makes the reader count backwards through a list. That is a sentence needing a second reading, which "Write plainly" rules out.

### H11 — R6's who-signed is printed but never recorded (MED)

D51.3 moved the reason onto the journal line with this reasoning: "a reason that is only printed is not on the record." The signature state of an amended tag is only printed. The journal's seal line carries no signature or signer field. `Amended.Signature`, `Amended.Signer` and `Amended.Note` live for one terminal line and are gone.

R6 says "the record states who signed the amended tag". By D51.3's own logic that is not satisfied.

### H12 — `signersFile` reads the working tree, not HEAD (LOW-MED)

R4 says verification runs "against a committed allowed-signers file". `signersFile` stats the path on disk and hands it to git. The comment names the choice honestly, but D51 did not ratify the deviation, and nothing warns when the file on disk differs from the committed one. Today it cannot matter, because nothing here can verify. It will matter on the owner's machine, which is where the only real check runs.

### H13 — Smaller things (LOW)

- **A battery run with every count at zero is treated as green.** `Red()` only asks whether `counts["red"] > 0`. A run that checked nothing grants a seal. D51.2's wording ("none or red") does cover it as written, but "green run" and "run that did nothing" are not the same claim.
- **`seal verify <tag>` accepts any tag name.** `VerifyTag` does not check that its argument is a seal tag. `groundwork seal verify v1.0` reads a release tag as a seal and reports it red: `v1.0: the first line is "a release", and a seal message opens with "seal: "`. Harmless — the value goes through `plain` — but it lets any annotated tag's text be quoted back through the seal verb.
- **A revoked seal still cross-checks off its older granted line.** `newestGrant` walks backwards for `action == "granted"` only. If `AmendSeal` fails after writing the revoked line, the older granted line still answers the cross-check, and verify shows nothing.
- **`short()` in `internal/journal/journal.go` skips `printable`.** Every other clip helper in this slice — `clip`, `say`, `plain`, `clipProblem` — runs `printable` first. `short` only makes the text valid UTF-8. It handles caller-supplied battery values, so nothing forged reaches it today, but it is the one clip in the slice that breaks the pattern, and D50.1 is the precedent for naming that choice in the code.
- **`amend` prints counts, not paths.** "before: 2 paths ... after: 1 path" does not tell a reader which path left. R6 asks it to print the before and the after; it prints how many.
- **The journal comment and the amend behaviour disagree.** `journal.go` says "A grant has no reason to give, and leaves the field off." `AmendSeal` writes the reason on the granted line as well as the revoked one. The behaviour is better; the comment is stale.
- **Register.** Two of the new comments run long enough to need a second reading: `AmendSeal`'s six-clause opening sentence, and the last sentence of `clip`'s doc. The `checkPath` error message named in H10 is the worst of them.

### H14 — There is no red commit for this slice (LOW, process)

Slice 2 landed as two commits: `1a1de63` "the tests ... red", then `237e45a` "green". Slice 3 is entirely uncommitted, and `dac3e9a` landed the ledger entries before the code. The record holds no red state for a 5,100-line slice. The builder verified red at `237e45a` and I reproduced it, but only four assertions actually fail there; the eight new test files fail to build. A future reader cannot see any of that from history.

---

## What I would do before this lands

Must fix: **H1** (the mirror denial of service, and the orphan seal it leaves verifying green) and **H2** (unverified printed as unsigned, against D51.1).

Must write down: **H4** (F57 is wrong about signing on this host), **H5** and **H6** (the signature notes and the empty signer on the SSH path), **H10** (three statements of one path rule), **H3** (the widest-line test measures the wrong branch — this is F54 recurring, and the class deserves a second entry).

Should fix while the code is open: **H7** (compare the tag header to the file name), **H8** (the dead `missing()` guard), and the two mutation survivors in **H9** — each needs one test, and M29's test should pin which signature branch the R4 proof marker walks.